"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import type { BookingKind, BookingStatus, BookingType } from "@/lib/domain";
import { BOOKING_STATUSES } from "@/lib/domain";
import { bookingSchema, fieldErrors } from "@/lib/validation";
import {
  BookingConflictError,
  createBookings,
  deleteBooking,
  deleteBookings,
  getBookingDetail,
  getRecurrenceSiblings,
  setBookingStatus,
  updateBooking,
} from "@/server/bookings";
import { getStudioSettings } from "@/server/settings";
import { syncBookingToCalendar, removeBookingFromCalendar } from "@/server/google/calendar";
import { sendBookingConfirmation } from "@/server/email/send";

export type ConflictSummary = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  blockedStart: string;
  blockedEnd: string;
};

export type ActionResult =
  | { ok: true; bookingId?: string }
  | { ok: false; message: string; errors?: Record<string, string>; conflicts?: ConflictSummary[] };

function conflictResult(error: BookingConflictError): ActionResult {
  return {
    ok: false,
    message: error.conflicts.length
      ? "The studio is already held during that window."
      : "Those times overlap — including setup and reset time.",
    conflicts: error.conflicts.map((c) => ({
      id: c.id,
      title: c.title,
      startsAt: c.startsAt.toISOString(),
      endsAt: c.endsAt.toISOString(),
      blockedStart: c.blockedStart.toISOString(),
      blockedEnd: c.blockedEnd.toISOString(),
    })),
  };
}

function revalidateBookingViews(id?: string) {
  revalidatePath("/today");
  revalidatePath("/calendar");
  revalidatePath("/bookings");
  revalidatePath("/prep");
  if (id) revalidatePath(`/bookings/${id}`);
}

/* ---------------------------------------------------------------------------
 * Create / update
 * ------------------------------------------------------------------------ */

export async function createBookingAction(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields.", errors: fieldErrors(parsed.error) };
  }

  const settings = await getStudioSettings();

  try {
    const { ids } = await createBookings(parsed.data, {
      timezone: settings.timezone,
      userId: user.id,
    });

    // Side effects are best-effort: a booking must never fail to save because
    // Google or the mail provider is having a bad day.
    await Promise.allSettled([
      ...ids.map((id) => syncBookingToCalendar(id)),
      settings.notifyConfirmation ? sendBookingConfirmation(ids[0]) : Promise.resolve(),
    ]);

    revalidateBookingViews(ids[0]);
    return { ok: true, bookingId: ids[0] };
  } catch (error) {
    if (error instanceof BookingConflictError) return conflictResult(error);
    throw error;
  }
}

export async function updateBookingAction(id: string, raw: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields.", errors: fieldErrors(parsed.error) };
  }

  const settings = await getStudioSettings();

  try {
    await updateBooking(id, parsed.data, { timezone: settings.timezone, userId: null });
    await Promise.allSettled([syncBookingToCalendar(id)]);
    revalidateBookingViews(id);
    return { ok: true, bookingId: id };
  } catch (error) {
    if (error instanceof BookingConflictError) return conflictResult(error);
    throw error;
  }
}

/* ---------------------------------------------------------------------------
 * Status
 * ------------------------------------------------------------------------ */

export async function setStatusAction(
  bookingId: string,
  status: BookingStatus,
): Promise<ActionResult> {
  await requireUser();
  if (!BOOKING_STATUSES.includes(status)) {
    return { ok: false, message: "That is not a valid status." };
  }

  await setBookingStatus(bookingId, status);

  if (status === "cancelled") {
    await Promise.allSettled([removeBookingFromCalendar(bookingId)]);
  }

  revalidateBookingViews(bookingId);
  return { ok: true, bookingId };
}

/* ---------------------------------------------------------------------------
 * Delete
 * ------------------------------------------------------------------------ */

export async function deleteBookingAction(
  id: string,
  scope: "one" | "series" = "one",
): Promise<ActionResult> {
  await requireUser();

  const detail = await getBookingDetail(id);
  if (!detail) return { ok: false, message: "That booking no longer exists." };

  if (scope === "series" && detail.recurrenceGroupId) {
    const siblings = await getRecurrenceSiblings(detail.recurrenceGroupId, detail.startsAt);
    await Promise.allSettled(siblings.map((s) => removeBookingFromCalendar(s.id)));
    await deleteBookings(siblings.map((s) => s.id));
  } else {
    await Promise.allSettled([removeBookingFromCalendar(id)]);
    await deleteBooking(id);
  }

  revalidateBookingViews();
  return { ok: true };
}

/**
 * Live availability check for the booking form. Runs the same query the save
 * path uses, so what the form promises is what the database will accept.
 */
export async function checkConflictsAction(input: {
  date: string;
  startTime: string;
  endTime: string;
  setupMinutes: number;
  resetMinutes: number;
  excludeBookingId?: string;
}): Promise<{ conflicts: ConflictSummary[] }> {
  await requireUser();
  const settings = await getStudioSettings();

  const { instantFromLocalParts } = await import("@/lib/time");
  const { findConflicts } = await import("@/server/bookings");

  let startsAt: Date;
  let endsAt: Date;
  try {
    startsAt = instantFromLocalParts(input.date, input.startTime, settings.timezone);
    endsAt = instantFromLocalParts(input.date, input.endTime, settings.timezone);
  } catch {
    return { conflicts: [] };
  }
  if (endsAt <= startsAt) return { conflicts: [] };

  const conflicts = await findConflicts(
    [
      {
        start: new Date(startsAt.getTime() - input.setupMinutes * 60_000),
        end: new Date(endsAt.getTime() + input.resetMinutes * 60_000),
      },
    ],
    input.excludeBookingId ? [input.excludeBookingId] : [],
  );

  return {
    conflicts: conflicts.map((c) => ({
      id: c.id,
      title: c.title,
      startsAt: c.startsAt.toISOString(),
      endsAt: c.endsAt.toISOString(),
      blockedStart: c.blockedStart.toISOString(),
      blockedEnd: c.blockedEnd.toISOString(),
    })),
  };
}

/** Sends (or re-sends) the confirmation for a booking on demand. */
export async function sendConfirmationAction(bookingId: string): Promise<ActionResult> {
  await requireUser();
  const result = await sendBookingConfirmation(bookingId);
  revalidatePath(`/bookings/${bookingId}`);
  return result.sent
    ? { ok: true, bookingId }
    : { ok: false, message: result.reason ?? "The confirmation could not be sent." };
}

/* ---------------------------------------------------------------------------
 * Live feedback while the form is open
 * ------------------------------------------------------------------------ */

export type AllowanceSummary = {
  label: string;
  detail: string;
  over: boolean;
};

/**
 * What a membership has left if this booking were added, and a plain sentence
 * when it would not be covered.
 *
 * Nothing blocks an over-allowance booking — the studio may well want the work
 * and settle up afterwards — but the form says so before anyone confirms.
 */
export async function checkMembershipAction(input: {
  clientMembershipId: string;
  bookingType: string;
  date: string;
  startTime: string;
  endTime: string;
  excludeBookingId?: string;
}): Promise<{ covered: boolean; reason: string | null; lines: AllowanceSummary[] }> {
  await requireUser();
  const settings = await getStudioSettings();

  const { instantFromLocalParts, durationMinutes } = await import("@/lib/time");
  const { checkMembershipCoverage } = await import("@/server/clients");
  const { describeRemaining } = await import("@/lib/membership");

  let minutes: number;
  try {
    const startsAt = instantFromLocalParts(input.date, input.startTime, settings.timezone);
    const endsAt = instantFromLocalParts(input.date, input.endTime, settings.timezone);
    if (endsAt <= startsAt) return { covered: true, reason: null, lines: [] };
    minutes = durationMinutes(startsAt, endsAt);
  } catch {
    return { covered: true, reason: null, lines: [] };
  }

  const result = await checkMembershipCoverage(
    input.clientMembershipId,
    { bookingType: input.bookingType as BookingType, minutes },
    new Date(),
    settings.timezone,
    input.excludeBookingId,
  );

  return {
    covered: result.covered,
    reason: result.reason,
    lines: result.lines.map((line) => ({
      label: line.label,
      detail: describeRemaining(line),
      over: line.over > 0,
    })),
  };
}

/** What an external booking of this shape would cost, for the live summary. */
export async function quotePreviewAction(input: {
  kind: string;
  bookingType: string;
  date: string;
  startTime: string;
  endTime: string;
}): Promise<{ billable: boolean; totalCents: number; lines: { label: string; detail: string | null; cents: number }[] }> {
  await requireUser();
  const settings = await getStudioSettings();

  const { instantFromLocalParts, durationMinutes } = await import("@/lib/time");
  const { quoteBooking } = await import("@/server/rates");

  let minutes: number;
  try {
    const startsAt = instantFromLocalParts(input.date, input.startTime, settings.timezone);
    const endsAt = instantFromLocalParts(input.date, input.endTime, settings.timezone);
    if (endsAt <= startsAt) return { billable: false, totalCents: 0, lines: [] };
    minutes = durationMinutes(startsAt, endsAt);
  } catch {
    return { billable: false, totalCents: 0, lines: [] };
  }

  const quote = await quoteBooking({
    kind: input.kind as BookingKind,
    bookingType: input.bookingType as BookingType,
    minutes,
  });

  return { billable: quote.billable, totalCents: quote.totalCents, lines: quote.lines };
}
