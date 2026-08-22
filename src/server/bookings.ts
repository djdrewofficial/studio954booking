import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import {
  addons,
  bookingAddons,
  bookingAttendees,
  bookingFiles,
  bookingSetOptions,
  bookings,
  notificationLogs,
  setOptionCategories,
  setOptions,
  studioSets,
} from "@/db/schema";
import type { BookingStatus } from "@/lib/domain";
import type { BookingInput } from "@/lib/validation";
import { addDays, instantFromLocalParts } from "@/lib/time";

/* ---------------------------------------------------------------------------
 * Read models
 * ------------------------------------------------------------------------ */

const attendeeCountSql = sql<number>`(
  select count(*)::int from ${bookingAttendees}
  where ${bookingAttendees.bookingId} = ${bookings.id}
)`;

const listColumns = {
  id: bookings.id,
  title: bookings.title,
  kind: bookings.kind,
  bookingType: bookings.bookingType,
  status: bookings.status,
  clientName: bookings.clientName,
  startsAt: bookings.startsAt,
  endsAt: bookings.endsAt,
  setupMinutes: bookings.setupMinutes,
  resetMinutes: bookings.resetMinutes,
  blockedStart: bookings.blockedStart,
  blockedEnd: bookings.blockedEnd,
  organizerName: bookings.organizerName,
  organizerEmail: bookings.organizerEmail,
  notes: bookings.notes,
  microphoneCount: bookings.microphoneCount,
  usesTeleprompter: bookings.usesTeleprompter,
  setName: studioSets.name,
  attendeeCount: attendeeCountSql,
};

export type BookingSummary = Awaited<ReturnType<typeof getBookingsInRange>>[number];

/** Every booking whose *occupied* window touches the range — buffers included. */
export async function getBookingsInRange(start: Date, end: Date) {
  return db
    .select(listColumns)
    .from(bookings)
    .leftJoin(studioSets, eq(studioSets.id, bookings.studioSetId))
    .where(and(lt(bookings.blockedStart, end), gt(bookings.blockedEnd, start)))
    .orderBy(asc(bookings.startsAt));
}

export type BookingScope = "upcoming" | "past" | "all";

export async function listBookings(opts: {
  search?: string;
  scope?: BookingScope;
  kind?: "internal" | "external";
  limit?: number;
}) {
  const { search, scope = "upcoming", kind, limit = 200 } = opts;
  const now = new Date();

  const filters = [];
  if (scope === "upcoming") filters.push(gte(bookings.endsAt, now));
  if (scope === "past") filters.push(lt(bookings.endsAt, now));
  if (kind) filters.push(eq(bookings.kind, kind));
  if (search?.trim()) {
    const q = `%${search.trim()}%`;
    filters.push(
      or(
        ilike(bookings.title, q),
        ilike(bookings.clientName, q),
        ilike(bookings.organizerName, q),
        ilike(bookings.organizerEmail, q),
      ),
    );
  }

  return db
    .select(listColumns)
    .from(bookings)
    .leftJoin(studioSets, eq(studioSets.id, bookings.studioSetId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(scope === "past" ? desc(bookings.startsAt) : asc(bookings.startsAt))
    .limit(limit);
}

export type BookingDetail = NonNullable<Awaited<ReturnType<typeof getBookingDetail>>>;

/** A booking with everything needed to actually set the room up. */
export async function getBookingDetail(id: string) {
  const rows = await db
    .select({
      booking: bookings,
      set: studioSets,
    })
    .from(bookings)
    .leftJoin(studioSets, eq(studioSets.id, bookings.studioSetId))
    .where(eq(bookings.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const [attendees, options, addonRows, files] = await Promise.all([
    db
      .select()
      .from(bookingAttendees)
      .where(eq(bookingAttendees.bookingId, id))
      .orderBy(asc(bookingAttendees.createdAt)),
    db
      .select({
        id: setOptions.id,
        name: setOptions.name,
        imageUrl: setOptions.imageUrl,
        swatchHex: setOptions.swatchHex,
        categoryId: setOptionCategories.id,
        categoryName: setOptionCategories.name,
        categorySlug: setOptionCategories.slug,
        categorySort: setOptionCategories.sortOrder,
        optionSort: setOptions.sortOrder,
      })
      .from(bookingSetOptions)
      .innerJoin(setOptions, eq(setOptions.id, bookingSetOptions.setOptionId))
      .innerJoin(setOptionCategories, eq(setOptionCategories.id, setOptions.categoryId))
      .where(eq(bookingSetOptions.bookingId, id))
      .orderBy(asc(setOptionCategories.sortOrder), asc(setOptions.sortOrder)),
    db
      .select({
        addonId: bookingAddons.addonId,
        name: addons.name,
        quantity: bookingAddons.quantity,
        priceCents: bookingAddons.priceCentsAtBooking,
      })
      .from(bookingAddons)
      .innerJoin(addons, eq(addons.id, bookingAddons.addonId))
      .where(eq(bookingAddons.bookingId, id))
      .orderBy(asc(addons.sortOrder)),
    db
      .select()
      .from(bookingFiles)
      .where(eq(bookingFiles.bookingId, id))
      .orderBy(asc(bookingFiles.createdAt)),
  ]);

  /** Options regrouped into the call-sheet shape: one line per category. */
  const setup = groupOptionsByCategory(options);

  return { ...row.booking, set: row.set, attendees, options, setup, addons: addonRows, files };
}

export type SetupLine = {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  options: { id: string; name: string; imageUrl: string | null; swatchHex: string | null }[];
};

export function groupOptionsByCategory(
  options: {
    id: string;
    name: string;
    imageUrl: string | null;
    swatchHex: string | null;
    categoryId: string;
    categoryName: string;
    categorySlug: string;
  }[],
): SetupLine[] {
  const byCategory = new Map<string, SetupLine>();
  for (const o of options) {
    let line = byCategory.get(o.categoryId);
    if (!line) {
      line = {
        categoryId: o.categoryId,
        categoryName: o.categoryName,
        categorySlug: o.categorySlug,
        options: [],
      };
      byCategory.set(o.categoryId, line);
    }
    line.options.push({
      id: o.id,
      name: o.name,
      imageUrl: o.imageUrl,
      swatchHex: o.swatchHex,
    });
  }
  return [...byCategory.values()];
}

/**
 * The room recipe for several bookings at once, keyed by booking id. Used by
 * the Today rundown and the prep sheet, where every session needs to show how
 * the studio has to look without an N+1 of detail queries.
 */
export async function getSetupSummaries(
  bookingIds: string[],
): Promise<Map<string, SetupLine[]>> {
  if (!bookingIds.length) return new Map();

  const rows = await db
    .select({
      bookingId: bookingSetOptions.bookingId,
      id: setOptions.id,
      name: setOptions.name,
      imageUrl: setOptions.imageUrl,
      swatchHex: setOptions.swatchHex,
      categoryId: setOptionCategories.id,
      categoryName: setOptionCategories.name,
      categorySlug: setOptionCategories.slug,
    })
    .from(bookingSetOptions)
    .innerJoin(setOptions, eq(setOptions.id, bookingSetOptions.setOptionId))
    .innerJoin(setOptionCategories, eq(setOptionCategories.id, setOptions.categoryId))
    .where(inArray(bookingSetOptions.bookingId, bookingIds))
    .orderBy(asc(setOptionCategories.sortOrder), asc(setOptions.sortOrder));

  const byBooking = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byBooking.get(row.bookingId) ?? [];
    list.push(row);
    byBooking.set(row.bookingId, list);
  }

  const out = new Map<string, SetupLine[]>();
  for (const [bookingId, list] of byBooking) {
    out.set(bookingId, groupOptionsByCategory(list));
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Conflicts
 *
 * Postgres already refuses to store an overlap (see the `bookings_no_overlap`
 * exclusion constraint). This query exists so we can *explain* the clash
 * before the user submits, rather than surfacing a database error.
 * ------------------------------------------------------------------------ */

export type Conflict = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  blockedStart: Date;
  blockedEnd: Date;
  setupMinutes: number;
  resetMinutes: number;
};

export async function findConflicts(
  windows: { start: Date; end: Date }[],
  excludeBookingIds: string[] = [],
): Promise<Conflict[]> {
  if (windows.length === 0) return [];

  const overlaps = windows.map((w) =>
    and(lt(bookings.blockedStart, w.end), gt(bookings.blockedEnd, w.start)),
  );

  const filters = [ne(bookings.status, "cancelled"), or(...overlaps)!];
  if (excludeBookingIds.length) {
    filters.push(notInArray(bookings.id, excludeBookingIds));
  }

  return db
    .select({
      id: bookings.id,
      title: bookings.title,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      blockedStart: bookings.blockedStart,
      blockedEnd: bookings.blockedEnd,
      setupMinutes: bookings.setupMinutes,
      resetMinutes: bookings.resetMinutes,
    })
    .from(bookings)
    .where(and(...filters))
    .orderBy(asc(bookings.startsAt))
    .limit(10);
}

/* ---------------------------------------------------------------------------
 * Recurrence — weekly or every other week, until a chosen date. That is all.
 * ------------------------------------------------------------------------ */

const MAX_OCCURRENCES = 52;

export function occurrenceDates(input: BookingInput): string[] {
  if (input.recurrence === "none" || !input.recurrenceUntil) return [input.date];

  const step = input.recurrence === "weekly" ? 7 : 14;
  const until = new Date(`${input.recurrenceUntil}T23:59:59Z`);
  const dates: string[] = [];

  let cursor = new Date(`${input.date}T12:00:00Z`); // midday avoids DST edges
  while (cursor <= until && dates.length < MAX_OCCURRENCES) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor = addDays(cursor, step);
  }
  return dates.length ? dates : [input.date];
}

/** Turns validated form input into concrete instants for each occurrence. */
export function plannedWindows(input: BookingInput, timezone: string) {
  return occurrenceDates(input).map((date) => {
    const startsAt = instantFromLocalParts(date, input.startTime, timezone);
    const endsAt = instantFromLocalParts(date, input.endTime, timezone);
    return {
      date,
      startsAt,
      endsAt,
      blocked: {
        start: new Date(startsAt.getTime() - input.setupMinutes * 60_000),
        end: new Date(endsAt.getTime() + input.resetMinutes * 60_000),
      },
    };
  });
}

/** Two occurrences of the same recurring booking must not collide either. */
export function selfOverlap(windows: { start: Date; end: Date }[]): boolean {
  const sorted = [...windows].sort((a, b) => a.start.getTime() - b.start.getTime());
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].start < sorted[i - 1].end) return true;
  }
  return false;
}

/* ---------------------------------------------------------------------------
 * Writes
 * ------------------------------------------------------------------------ */

export class BookingConflictError extends Error {
  constructor(readonly conflicts: Conflict[]) {
    super("The studio is already booked during that window.");
    this.name = "BookingConflictError";
  }
}

/** Postgres raises 23P01 when the no-overlap exclusion constraint bites. */
function isExclusionViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23P01";
}

type WriteContext = { timezone: string; userId: string | null };

export async function createBookings(
  input: BookingInput,
  ctx: WriteContext,
): Promise<{ ids: string[] }> {
  const windows = plannedWindows(input, ctx.timezone);

  if (selfOverlap(windows.map((w) => w.blocked))) {
    throw new BookingConflictError([]);
  }

  const conflicts = await findConflicts(windows.map((w) => w.blocked));
  if (conflicts.length) throw new BookingConflictError(conflicts);

  const recurrenceGroupId = windows.length > 1 ? crypto.randomUUID() : null;

  try {
    return await db.transaction(async (tx) => {
      const ids: string[] = [];

      for (const w of windows) {
        const [row] = await tx
          .insert(bookings)
          .values({
            title: input.title,
            kind: input.kind,
            bookingType: input.bookingType,
            clientName: input.clientName ?? null,
            startsAt: w.startsAt,
            endsAt: w.endsAt,
            setupMinutes: input.setupMinutes,
            resetMinutes: input.resetMinutes,
            studioSetId: input.studioSetId ?? null,
            organizerName: input.organizerName,
            organizerEmail: input.organizerEmail,
            organizerPhone: input.organizerPhone ?? null,
            notes: input.notes ?? null,
            internalNotes: input.internalNotes ?? null,
            microphoneCount: input.microphoneCount,
            usesTeleprompter: input.usesTeleprompter,
            recurrenceGroupId,
            createdById: ctx.userId,
          })
          .returning({ id: bookings.id });

        ids.push(row.id);
        await writeChildren(tx, row.id, input);
      }

      return { ids };
    });
  } catch (error) {
    if (isExclusionViolation(error)) throw new BookingConflictError([]);
    throw error;
  }
}

export async function updateBooking(
  id: string,
  input: BookingInput,
  ctx: WriteContext,
): Promise<void> {
  const startsAt = instantFromLocalParts(input.date, input.startTime, ctx.timezone);
  const endsAt = instantFromLocalParts(input.date, input.endTime, ctx.timezone);
  const window = {
    start: new Date(startsAt.getTime() - input.setupMinutes * 60_000),
    end: new Date(endsAt.getTime() + input.resetMinutes * 60_000),
  };

  const conflicts = await findConflicts([window], [id]);
  if (conflicts.length) throw new BookingConflictError(conflicts);

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(bookings)
        .set({
          title: input.title,
          kind: input.kind,
          bookingType: input.bookingType,
          clientName: input.clientName ?? null,
          startsAt,
          endsAt,
          setupMinutes: input.setupMinutes,
          resetMinutes: input.resetMinutes,
          studioSetId: input.studioSetId ?? null,
          organizerName: input.organizerName,
          organizerEmail: input.organizerEmail,
          organizerPhone: input.organizerPhone ?? null,
          notes: input.notes ?? null,
          internalNotes: input.internalNotes ?? null,
          microphoneCount: input.microphoneCount,
          usesTeleprompter: input.usesTeleprompter,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, id));

      await tx.delete(bookingSetOptions).where(eq(bookingSetOptions.bookingId, id));
      await tx.delete(bookingAttendees).where(eq(bookingAttendees.bookingId, id));
      await tx.delete(bookingFiles).where(eq(bookingFiles.bookingId, id));
      await writeChildren(tx, id, input);
    });
  } catch (error) {
    if (isExclusionViolation(error)) throw new BookingConflictError([]);
    throw error;
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function writeChildren(tx: Tx, bookingId: string, input: BookingInput) {
  if (input.setOptionIds.length) {
    await tx
      .insert(bookingSetOptions)
      .values(input.setOptionIds.map((setOptionId) => ({ bookingId, setOptionId })));
  }
  if (input.attendees.length) {
    await tx.insert(bookingAttendees).values(
      input.attendees.map((a) => ({
        bookingId,
        name: a.name,
        email: a.email ?? null,
        notify: a.notify,
      })),
    );
  }
  if (input.teleprompterFiles.length) {
    await tx.insert(bookingFiles).values(
      input.teleprompterFiles.map((f) => ({
        bookingId,
        kind: "teleprompter_script",
        fileName: f.fileName,
        storagePath: f.storagePath,
        contentType: f.contentType ?? null,
        sizeBytes: f.sizeBytes ?? null,
      })),
    );
  }
}

export async function setBookingStatus(id: string, status: BookingStatus): Promise<void> {
  await db
    .update(bookings)
    .set({
      status,
      cancelledAt: status === "cancelled" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, id));
}

export async function deleteBooking(id: string): Promise<void> {
  await db.delete(bookings).where(eq(bookings.id, id));
}

/** Everything a duplicate should carry over, minus the date and time. */
export async function getDuplicateTemplate(id: string) {
  const detail = await getBookingDetail(id);
  if (!detail) return null;

  return {
    title: detail.title,
    kind: detail.kind as BookingInput["kind"],
    bookingType: detail.bookingType as BookingInput["bookingType"],
    clientName: detail.clientName ?? undefined,
    setupMinutes: detail.setupMinutes,
    resetMinutes: detail.resetMinutes,
    studioSetId: detail.studioSetId ?? undefined,
    setOptionIds: detail.options.map((o) => o.id),
    organizerName: detail.organizerName,
    organizerEmail: detail.organizerEmail,
    organizerPhone: detail.organizerPhone ?? undefined,
    notes: detail.notes ?? undefined,
    internalNotes: detail.internalNotes ?? undefined,
    microphoneCount: detail.microphoneCount,
    // The teleprompter itself carries over; the script does not, since a new
    // date almost always means new copy.
    usesTeleprompter: detail.usesTeleprompter,
    attendees: detail.attendees.map((a) => ({
      name: a.name,
      email: a.email ?? undefined,
      notify: a.notify,
    })),
    durationMinutes: Math.round((detail.endsAt.getTime() - detail.startsAt.getTime()) / 60_000),
  };
}

export async function getRecurrenceSiblings(groupId: string, afterOrEqual: Date) {
  return db
    .select({ id: bookings.id, startsAt: bookings.startsAt })
    .from(bookings)
    .where(and(eq(bookings.recurrenceGroupId, groupId), gte(bookings.startsAt, afterOrEqual)))
    .orderBy(asc(bookings.startsAt));
}

export async function deleteBookings(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await db.delete(bookings).where(inArray(bookings.id, ids));
}

/** What has been emailed about a booking, newest first. */
export async function getNotificationLog(bookingId: string) {
  return db
    .select({
      id: notificationLogs.id,
      kind: notificationLogs.kind,
      recipientEmail: notificationLogs.recipientEmail,
      status: notificationLogs.status,
      error: notificationLogs.error,
      createdAt: notificationLogs.createdAt,
    })
    .from(notificationLogs)
    .where(eq(notificationLogs.bookingId, bookingId))
    .orderBy(desc(notificationLogs.createdAt))
    .limit(25);
}

/** Bookings needing a reminder in a window — used by the cron endpoint. */
export async function bookingsStartingBetween(start: Date, end: Date) {
  return db
    .select({
      id: bookings.id,
      title: bookings.title,
      startsAt: bookings.startsAt,
      status: bookings.status,
    })
    .from(bookings)
    .where(
      and(
        gte(bookings.startsAt, start),
        lte(bookings.startsAt, end),
        ne(bookings.status, "cancelled"),
      ),
    );
}
