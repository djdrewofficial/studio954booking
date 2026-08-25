/**
 * Membership allowances.
 *
 * A plan is a list of entitlement lines — either a pool of studio time or a
 * count of a particular appointment type. Allowances refill monthly on the day
 * the membership started and do not roll over, so nothing here keeps a
 * balance: usage is always *derived* from the bookings that sit inside the
 * current period. Cancel a booking and the allowance comes straight back, with
 * no ledger to reconcile and no way for a stored balance to drift.
 *
 * Pure module — no database, no clock of its own. Callers pass the instant.
 */

import { TZDate } from "@date-fns/tz";

import type { BookingType, EntitlementKind } from "./domain";
import { BOOKING_TYPE_LABEL } from "./domain";
import { formatDuration } from "./time";

export type Entitlement = {
  entitlementKind: EntitlementKind;
  /** Only meaningful for appointment lines. Null means "any type". */
  bookingType: BookingType | null;
  /** Minutes for a studio-time line; a plain count for an appointment line. */
  amount: number;
};

/** One booking's draw on an allowance. */
export type MembershipDraw = {
  bookingType: BookingType;
  /** Session length excluding buffers — members are not billed for turnaround. */
  minutes: number;
};

export type Period = { start: Date; end: Date };

/**
 * The allowance period containing `on`, anchored to the day of the month the
 * membership began.
 *
 * Anchors past the end of a short month clamp to that month's last day, so a
 * membership started on the 31st refills on the 28th in February rather than
 * slipping into March.
 */
export function periodFor(startedOn: string | Date, on: Date, timezone: string): Period {
  // Drizzle hands back a "YYYY-MM-DD" string for a date column; a raw driver
  // may hand back a Date. Accept either rather than depend on the caller.
  //
  // A date column carries no timezone, and a driver parses it to UTC midnight,
  // so the day must be read in UTC. Reading it in the studio's timezone would
  // shift a membership started on the 5th back to the 4th.
  const anchorDay =
    startedOn instanceof Date ? startedOn.getUTCDate() : Number(startedOn.slice(8, 10));
  const here = new TZDate(on, timezone);
  const year = here.getFullYear();
  const month = here.getMonth();

  // This month's refill date. If we have not reached it yet, the period that
  // contains `on` began last month.
  const thisMonth = clampedAnchor(year, month, anchorDay, timezone);
  const start =
    here.getTime() >= thisMonth.getTime()
      ? thisMonth
      : clampedAnchor(year, month - 1, anchorDay, timezone);
  const end = clampedAnchor(start.getFullYear(), start.getMonth() + 1, anchorDay, timezone);

  return { start: new Date(start.getTime()), end: new Date(end.getTime()) };
}

/** The anchor day in a given month, pulled back to the last day if it overflows. */
function clampedAnchor(year: number, month: number, day: number, timezone: string): TZDate {
  const normalisedYear = year + Math.floor(month / 12);
  const normalisedMonth = ((month % 12) + 12) % 12;
  const lastDay = new TZDate(normalisedYear, normalisedMonth + 1, 0, timezone).getDate();
  return new TZDate(normalisedYear, normalisedMonth, Math.min(day, lastDay), 0, 0, 0, 0, timezone);
}

/* ---------------------------------------------------------------------------
 * Drawing down
 * ------------------------------------------------------------------------ */

export type AllowanceLine = {
  entitlementKind: EntitlementKind;
  bookingType: BookingType | null;
  /** What the plan includes: minutes, or a count. */
  allowed: number;
  /** What has been used this period, in the same unit. */
  used: number;
  /** Never negative — overage is reported separately. */
  remaining: number;
  /** How far past the allowance this period has gone, in the same unit. */
  over: number;
  label: string;
};

/**
 * Works out what is left on each line of a plan for one period.
 *
 * An appointment line for a specific type is consumed only by bookings of that
 * type. A line with no type absorbs anything left over, which is what makes
 * "3 podcasts + 2 of anything" express itself without extra columns.
 */
export function allowanceFor(
  entitlements: readonly Entitlement[],
  draws: readonly MembershipDraw[],
): AllowanceLine[] {
  const specific = entitlements.filter(
    (e) => e.entitlementKind === "appointment_count" && e.bookingType !== null,
  );
  const general = entitlements.filter(
    (e) => e.entitlementKind === "appointment_count" && e.bookingType === null,
  );
  const hours = entitlements.filter((e) => e.entitlementKind === "studio_hours");

  // Each booking is counted against its own type first; whatever the typed
  // lines cannot absorb falls through to the general lines.
  const usedByType = new Map<BookingType, number>();
  for (const draw of draws) {
    usedByType.set(draw.bookingType, (usedByType.get(draw.bookingType) ?? 0) + 1);
  }

  const lines: AllowanceLine[] = [];
  let spillover = 0;

  for (const line of specific) {
    const type = line.bookingType as BookingType;
    const used = usedByType.get(type) ?? 0;
    const counted = Math.min(used, line.amount);
    spillover += used - counted;
    lines.push(makeLine(line, line.amount, counted, BOOKING_TYPE_LABEL[type]));
  }

  // Bookings of a type the plan never names also land on the general lines.
  const namedTypes = new Set(specific.map((l) => l.bookingType));
  for (const [type, used] of usedByType) {
    if (!namedTypes.has(type)) spillover += used;
  }

  for (const line of general) {
    const counted = Math.min(spillover, line.amount);
    spillover -= counted;
    lines.push(makeLine(line, line.amount, counted, "Any appointment"));
  }

  // Studio time is a straight pool: every session draws its own length.
  const minutesUsed = draws.reduce((total, d) => total + d.minutes, 0);
  let minutesLeft = minutesUsed;
  for (const line of hours) {
    const counted = Math.min(minutesLeft, line.amount);
    minutesLeft -= counted;
    lines.push(makeLine(line, line.amount, counted, "Studio time"));
  }

  // Anything the plan could not absorb is overage on the last line of its kind.
  if (spillover > 0 && lines.length > 0) {
    const last = lastOfKind(lines, "appointment_count");
    if (last) last.over += spillover;
  }
  if (minutesLeft > 0) {
    const last = lastOfKind(lines, "studio_hours");
    if (last) last.over += minutesLeft;
  }

  return lines;
}

function makeLine(
  entitlement: Entitlement,
  allowed: number,
  used: number,
  label: string,
): AllowanceLine {
  return {
    entitlementKind: entitlement.entitlementKind,
    bookingType: entitlement.bookingType,
    allowed,
    used,
    remaining: Math.max(0, allowed - used),
    over: 0,
    label,
  };
}

function lastOfKind(lines: AllowanceLine[], kind: EntitlementKind): AllowanceLine | undefined {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].entitlementKind === kind) return lines[i];
  }
  return undefined;
}

/**
 * Whether a plan can still cover one more booking of this shape.
 *
 * Nothing in the app blocks an over-allowance booking — the studio may well
 * want to take it and settle up later — but the form says so plainly before
 * anyone confirms.
 */
export function coversDraw(
  entitlements: readonly Entitlement[],
  existing: readonly MembershipDraw[],
  next: MembershipDraw,
): { covered: boolean; reason: string | null } {
  if (entitlements.length === 0) {
    return { covered: false, reason: "This plan does not include any sessions." };
  }

  const before = allowanceFor(entitlements, existing);
  const after = allowanceFor(entitlements, [...existing, next]);

  const wentOver = after.some((line, i) => line.over > (before[i]?.over ?? 0));
  if (!wentOver) return { covered: true, reason: null };

  const hours = after.find((l) => l.entitlementKind === "studio_hours");
  if (hours && hours.over > 0) {
    return {
      covered: false,
      reason: `This runs ${formatDuration(hours.over)} past the studio time left this period.`,
    };
  }
  return {
    covered: false,
    reason: `${BOOKING_TYPE_LABEL[next.bookingType]} sessions are used up for this period.`,
  };
}

/** How a line reads on screen: "2 of 3 left", "4 hr 30 min of 10 hr left". */
export function describeRemaining(line: AllowanceLine): string {
  if (line.entitlementKind === "studio_hours") {
    return line.over > 0
      ? `${formatDuration(line.over)} over ${formatDuration(line.allowed)}`
      : `${formatDuration(line.remaining)} of ${formatDuration(line.allowed)} left`;
  }
  return line.over > 0
    ? `${line.over} over ${line.allowed}`
    : `${line.remaining} of ${line.allowed} left`;
}
