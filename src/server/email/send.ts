import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { notificationLogs } from "@/db/schema";
import { getBookingDetail } from "@/server/bookings";
import { formatStudioAddress, getStudioSettings } from "@/server/settings";

import { buildIcs } from "./ics";
import { getMailer, isEmailConfigured, type OutboundEmail } from "./mailer";
import { confirmationEmail, reminderEmail, type EmailBooking } from "./templates";

export type NotificationKind =
  | "confirmation"
  | "reminder_24h"
  | "reminder_same_day"
  | "cancellation";

export type SendOutcome = { sent: number; skipped: number; failed: number; reason?: string };

/** Everyone who has opted in to hear about a booking, deduplicated by address. */
function recipients(detail: Awaited<ReturnType<typeof getBookingDetail>>) {
  if (!detail) return [];
  const seen = new Map<string, { name: string; email: string }>();

  seen.set(detail.organizerEmail.toLowerCase(), {
    name: detail.organizerName,
    email: detail.organizerEmail,
  });

  for (const attendee of detail.attendees) {
    if (!attendee.notify || !attendee.email) continue;
    const key = attendee.email.toLowerCase();
    if (!seen.has(key)) seen.set(key, { name: attendee.name, email: attendee.email });
  }

  return [...seen.values()];
}

/** Records every attempt so Settings can show what actually went out. */
async function logAttempt(
  bookingId: string,
  kind: NotificationKind,
  recipientEmail: string,
  status: "sent" | "failed" | "skipped",
  extra: { providerMessageId?: string | null; error?: string } = {},
) {
  await db.insert(notificationLogs).values({
    bookingId,
    kind,
    recipientEmail,
    status,
    providerMessageId: extra.providerMessageId ?? null,
    error: extra.error ?? null,
  });
}

/** Guards against a reminder cron firing twice for the same booking. */
export async function alreadySent(bookingId: string, kind: NotificationKind): Promise<boolean> {
  const rows = await db
    .select({ id: notificationLogs.id })
    .from(notificationLogs)
    .where(
      and(
        eq(notificationLogs.bookingId, bookingId),
        eq(notificationLogs.kind, kind),
        eq(notificationLogs.status, "sent"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function dispatch(
  bookingId: string,
  kind: NotificationKind,
  build: (booking: EmailBooking) => { subject: string; html: string; text: string },
  opts: { attachIcs?: boolean } = {},
): Promise<SendOutcome> {
  const detail = await getBookingDetail(bookingId);
  if (!detail) return { sent: 0, skipped: 0, failed: 0, reason: "Booking not found." };
  if (detail.status === "cancelled" && kind !== "cancellation") {
    return { sent: 0, skipped: 0, failed: 0, reason: "Booking is cancelled." };
  }

  const settings = await getStudioSettings();
  const people = recipients(detail);
  if (!people.length) return { sent: 0, skipped: 0, failed: 0, reason: "Nobody to notify." };

  const emailBooking: EmailBooking = {
    id: detail.id,
    title: detail.title,
    bookingType: detail.bookingType,
    startsAt: detail.startsAt,
    endsAt: detail.endsAt,
    organizerName: detail.organizerName,
    setName: detail.set?.name ?? null,
    notes: detail.notes,
    setup: detail.setup,
  };

  const content = build(emailBooking);
  const ics = opts.attachIcs
    ? buildIcs({
        uid: `booking-${detail.id}@studio954`,
        title: detail.title,
        description: detail.notes,
        location: formatStudioAddress(settings),
        startsAt: detail.startsAt,
        endsAt: detail.endsAt,
        organizer: { name: detail.organizerName, email: detail.organizerEmail },
        attendees: detail.attendees
          .filter((a) => a.email)
          .map((a) => ({ name: a.name, email: a.email! })),
      })
    : undefined;

  // With no provider configured we still write a log row, so the studio can
  // see exactly what *would* have gone out.
  if (!isEmailConfigured()) {
    await Promise.all(
      people.map((p) =>
        logAttempt(bookingId, kind, p.email, "skipped", { error: "No email provider configured" }),
      ),
    );
    return {
      sent: 0,
      skipped: people.length,
      failed: 0,
      reason: "No email provider configured — set RESEND_API_KEY and EMAIL_FROM.",
    };
  }

  const mailer = getMailer();
  const outcome: SendOutcome = { sent: 0, skipped: 0, failed: 0 };

  for (const person of people) {
    const message: OutboundEmail = {
      to: person.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      ics: ics ? { filename: "studio-954-session.ics", content: ics } : undefined,
    };

    try {
      const result = await mailer.send(message);
      if (result.status === "sent") {
        outcome.sent += 1;
        await logAttempt(bookingId, kind, person.email, "sent", {
          providerMessageId: result.providerMessageId,
        });
      } else {
        outcome.failed += 1;
        await logAttempt(bookingId, kind, person.email, "failed", { error: result.error });
      }
    } catch (error) {
      outcome.failed += 1;
      await logAttempt(bookingId, kind, person.email, "failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return outcome;
}

export async function sendBookingConfirmation(bookingId: string) {
  const settings = await getStudioSettings();
  const outcome = await dispatch(
    bookingId,
    "confirmation",
    (booking) => confirmationEmail(booking, settings),
    { attachIcs: true },
  );
  return { ...outcome, sent: outcome.sent > 0 ? outcome.sent : 0 };
}

export async function sendBookingReminder(bookingId: string, variant: "day_before" | "same_day") {
  const settings = await getStudioSettings();
  const kind: NotificationKind = variant === "day_before" ? "reminder_24h" : "reminder_same_day";
  if (await alreadySent(bookingId, kind)) {
    return { sent: 0, skipped: 1, failed: 0, reason: "Already sent." };
  }
  return dispatch(bookingId, kind, (booking) => reminderEmail(booking, settings, variant), {
    attachIcs: variant === "day_before",
  });
}
