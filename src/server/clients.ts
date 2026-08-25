import "server-only";

import { and, asc, desc, eq, gte, inArray, isNotNull, lt, ne } from "drizzle-orm";

import { db } from "@/db";
import {
  bookings,
  clientMemberships,
  clients,
  membershipPlanEntitlements,
  membershipPlans,
} from "@/db/schema";
import type { BookingType } from "@/lib/domain";
import type { AllowanceLine, Entitlement, MembershipDraw, Period } from "@/lib/membership";
import { allowanceFor, coversDraw, periodFor } from "@/lib/membership";
import { durationMinutes } from "@/lib/time";

export type Client = typeof clients.$inferSelect;
export type MembershipPlan = typeof membershipPlans.$inferSelect;
export type PlanEntitlement = typeof membershipPlanEntitlements.$inferSelect;
export type ClientMembership = typeof clientMemberships.$inferSelect;

export type PlanWithEntitlements = MembershipPlan & { entitlements: PlanEntitlement[] };

/* ---------------------------------------------------------------------------
 * Clients
 * ------------------------------------------------------------------------ */

export async function listClients(includeArchived = false): Promise<Client[]> {
  const rows = await db.select().from(clients).orderBy(asc(clients.name));
  return includeArchived ? rows : rows.filter((c) => c.isActive);
}

export async function getClient(id: string): Promise<Client | null> {
  const rows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return rows[0] ?? null;
}

/* ---------------------------------------------------------------------------
 * Plans
 * ------------------------------------------------------------------------ */

/**
 * Every plan with its entitlement lines. Two queries then assembled in memory,
 * matching how the set catalogue is built — this data is small and it keeps
 * the call sites simple.
 */
export async function listPlans(includeArchived = false): Promise<PlanWithEntitlements[]> {
  const [planRows, lineRows] = await Promise.all([
    db.select().from(membershipPlans).orderBy(asc(membershipPlans.sortOrder), asc(membershipPlans.name)),
    db
      .select()
      .from(membershipPlanEntitlements)
      .orderBy(asc(membershipPlanEntitlements.sortOrder)),
  ]);

  const byPlan = new Map<string, PlanEntitlement[]>();
  for (const line of lineRows) {
    const list = byPlan.get(line.planId) ?? [];
    list.push(line);
    byPlan.set(line.planId, list);
  }

  const assembled = planRows.map((plan) => ({
    ...plan,
    entitlements: byPlan.get(plan.id) ?? [],
  }));
  return includeArchived ? assembled : assembled.filter((p) => p.isActive);
}

export async function getPlan(id: string): Promise<PlanWithEntitlements | null> {
  const rows = await db.select().from(membershipPlans).where(eq(membershipPlans.id, id)).limit(1);
  const plan = rows[0];
  if (!plan) return null;

  const entitlements = await db
    .select()
    .from(membershipPlanEntitlements)
    .where(eq(membershipPlanEntitlements.planId, id))
    .orderBy(asc(membershipPlanEntitlements.sortOrder));

  return { ...plan, entitlements };
}

/* ---------------------------------------------------------------------------
 * Memberships and what is left on them
 * ------------------------------------------------------------------------ */

export type MembershipSummary = {
  membership: ClientMembership;
  client: Client;
  plan: PlanWithEntitlements;
  period: Period;
  lines: AllowanceLine[];
};

/** Every membership a client has held, newest first. */
export async function listMembershipsForClient(clientId: string): Promise<ClientMembership[]> {
  return db
    .select()
    .from(clientMemberships)
    .where(eq(clientMemberships.clientId, clientId))
    .orderBy(desc(clientMemberships.startedOn));
}

/** The client's live membership, if they have one. At most one can be active. */
export async function getActiveMembership(clientId: string): Promise<ClientMembership | null> {
  const rows = await db
    .select()
    .from(clientMemberships)
    .where(and(eq(clientMemberships.clientId, clientId), eq(clientMemberships.status, "active")))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * What a membership has left in the period containing `on`.
 *
 * Usage is counted from the bookings themselves rather than a stored balance,
 * so a cancelled booking returns its allowance immediately and there is no
 * ledger that can drift out of step with the schedule.
 */
export async function summariseMembership(
  membershipId: string,
  on: Date,
  timezone: string,
): Promise<MembershipSummary | null> {
  const rows = await db
    .select({ membership: clientMemberships, client: clients })
    .from(clientMemberships)
    .innerJoin(clients, eq(clients.id, clientMemberships.clientId))
    .where(eq(clientMemberships.id, membershipId))
    .limit(1);

  const found = rows[0];
  if (!found) return null;

  const plan = await getPlan(found.membership.planId);
  if (!plan) return null;

  const period = periodFor(found.membership.startedOn, on, timezone);
  const draws = await drawsInPeriod(membershipId, period);

  return {
    membership: found.membership,
    client: found.client,
    plan,
    period,
    lines: allowanceFor(toEntitlements(plan.entitlements), draws),
  };
}

/**
 * The sessions charged against a membership inside one period.
 *
 * Cancelled bookings are excluded — the room is free again, so the allowance
 * should be too. Buffers are excluded from the minutes: nobody's plan should
 * be spent on turnaround time.
 */
async function drawsInPeriod(membershipId: string, period: Period): Promise<MembershipDraw[]> {
  const rows = await db
    .select({
      bookingType: bookings.bookingType,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.clientMembershipId, membershipId),
        ne(bookings.status, "cancelled"),
        gte(bookings.startsAt, period.start),
        lt(bookings.startsAt, period.end),
      ),
    );

  return rows.map((row) => ({
    bookingType: row.bookingType as BookingType,
    minutes: durationMinutes(row.startsAt, row.endsAt),
  }));
}

/**
 * Whether one more booking still fits, and a plain sentence explaining it when
 * it does not. Nothing here blocks the booking — the studio may happily take
 * the work and settle up — but the form says so before anyone confirms.
 *
 * `excludeBookingId` keeps an edit from counting itself twice.
 */
export async function checkMembershipCoverage(
  membershipId: string,
  draw: MembershipDraw,
  on: Date,
  timezone: string,
  excludeBookingId?: string,
): Promise<{ covered: boolean; reason: string | null; lines: AllowanceLine[] }> {
  const summary = await summariseMembership(membershipId, on, timezone);
  if (!summary) {
    return { covered: false, reason: "That membership no longer exists.", lines: [] };
  }
  if (summary.membership.status !== "active") {
    return { covered: false, reason: "This membership is not active.", lines: summary.lines };
  }

  let existing = await drawsInPeriod(membershipId, summary.period);
  if (excludeBookingId) {
    const self = await db
      .select({
        bookingType: bookings.bookingType,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
      })
      .from(bookings)
      .where(eq(bookings.id, excludeBookingId))
      .limit(1);
    const row = self[0];
    if (row) {
      const minutes = durationMinutes(row.startsAt, row.endsAt);
      const index = existing.findIndex(
        (d) => d.bookingType === row.bookingType && d.minutes === minutes,
      );
      if (index >= 0) existing = existing.filter((_, i) => i !== index);
    }
  }

  const entitlements = toEntitlements(summary.plan.entitlements);
  const verdict = coversDraw(entitlements, existing, draw);
  return {
    covered: verdict.covered,
    reason: verdict.reason,
    lines: allowanceFor(entitlements, [...existing, draw]),
  };
}

/** Every client holding a live membership, with what is left on it. */
export async function listActiveMemberships(
  on: Date,
  timezone: string,
): Promise<MembershipSummary[]> {
  const rows = await db
    .select({ id: clientMemberships.id })
    .from(clientMemberships)
    .where(eq(clientMemberships.status, "active"));

  const summaries = await Promise.all(
    rows.map((row) => summariseMembership(row.id, on, timezone)),
  );
  return summaries.filter((s): s is MembershipSummary => s !== null);
}

/**
 * Every client with their live membership and plan name, in one query.
 *
 * The obvious shape — list clients, then look up each one's membership — costs
 * 1 + 2N round trips and is what the booking form and the clients screen both
 * need on every render. At a pool of six connections that is enough to starve
 * the server, so it is deliberately a single join.
 */
export async function listClientsWithMembership(includeArchived = false): Promise<
  {
    client: Client;
    membership: ClientMembership | null;
    planName: string | null;
  }[]
> {
  const rows = await db
    .select({
      client: clients,
      membership: clientMemberships,
      planName: membershipPlans.name,
    })
    .from(clients)
    .leftJoin(
      clientMemberships,
      and(eq(clientMemberships.clientId, clients.id), eq(clientMemberships.status, "active")),
    )
    .leftJoin(membershipPlans, eq(membershipPlans.id, clientMemberships.planId))
    .orderBy(asc(clients.name));

  return rows
    .filter((row) => includeArchived || row.client.isActive)
    .map((row) => ({
      client: row.client,
      membership: row.membership,
      planName: row.planName,
    }));
}

/**
 * The same, plus what each live membership has left this period.
 *
 * Three queries whatever the number of clients: the join above, every
 * entitlement line for the plans in play, and every booking attached to those
 * memberships. Periods differ per membership, so the draws are filtered in
 * memory rather than with a query each.
 */
export async function listClientAllowances(
  on: Date,
  timezone: string,
  includeArchived = false,
): Promise<
  {
    client: Client;
    membership: ClientMembership | null;
    planName: string | null;
    period: Period | null;
    lines: AllowanceLine[];
  }[]
> {
  const base = await listClientsWithMembership(includeArchived);
  const live = base.filter((row) => row.membership);

  if (live.length === 0) {
    return base.map((row) => ({ ...row, period: null, lines: [] }));
  }

  const planIds = [...new Set(live.map((row) => row.membership!.planId))];
  const membershipIds = live.map((row) => row.membership!.id);

  const [entitlementRows, bookingRows] = await Promise.all([
    db
      .select()
      .from(membershipPlanEntitlements)
      .where(inArray(membershipPlanEntitlements.planId, planIds))
      .orderBy(asc(membershipPlanEntitlements.sortOrder)),
    db
      .select({
        membershipId: bookings.clientMembershipId,
        bookingType: bookings.bookingType,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
      })
      .from(bookings)
      .where(
        and(inArray(bookings.clientMembershipId, membershipIds), ne(bookings.status, "cancelled")),
      ),
  ]);

  const byPlan = new Map<string, PlanEntitlement[]>();
  for (const line of entitlementRows) {
    const list = byPlan.get(line.planId) ?? [];
    list.push(line);
    byPlan.set(line.planId, list);
  }

  return base.map((row) => {
    if (!row.membership) return { ...row, period: null, lines: [] };

    const period = periodFor(row.membership.startedOn, on, timezone);
    const draws = bookingRows
      .filter(
        (b) =>
          b.membershipId === row.membership!.id &&
          b.startsAt >= period.start &&
          b.startsAt < period.end,
      )
      .map((b) => ({
        bookingType: b.bookingType as BookingType,
        minutes: durationMinutes(b.startsAt, b.endsAt),
      }));

    return {
      ...row,
      period,
      lines: allowanceFor(toEntitlements(byPlan.get(row.membership.planId) ?? []), draws),
    };
  });
}

/** Bookings that drew on a membership, for the client's history panel. */
export async function listMembershipBookings(membershipId: string, limit = 50) {
  return db
    .select({
      id: bookings.id,
      title: bookings.title,
      bookingType: bookings.bookingType,
      status: bookings.status,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
    })
    .from(bookings)
    .where(and(eq(bookings.clientMembershipId, membershipId), isNotNull(bookings.id)))
    .orderBy(desc(bookings.startsAt))
    .limit(limit);
}

/** The database row shape narrowed to what the pure allowance maths expects. */
function toEntitlements(rows: readonly PlanEntitlement[]): Entitlement[] {
  return rows.map((row) => ({
    entitlementKind: row.entitlementKind as Entitlement["entitlementKind"],
    bookingType: (row.bookingType as BookingType | null) ?? null,
    amount: row.amount,
  }));
}
