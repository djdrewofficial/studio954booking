import { NextResponse } from "next/server";

import { safeEqual } from "@/lib/auth";
import { bookingsStartingBetween } from "@/server/bookings";
import { alreadySent, sendBookingReminder } from "@/server/email/send";
import { getStudioSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

/**
 * Reminder dispatcher, meant to be hit by a scheduler every 15–30 minutes.
 *
 * The windows are deliberately wider than the schedule interval and every send
 * is guarded by the notification log, so a missed run catches up on the next
 * pass and nobody is ever emailed twice.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://booking.studio954.com/api/cron/reminders
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!safeEqual(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getStudioSettings();
  const now = new Date();
  const hours = (n: number) => new Date(now.getTime() + n * 3_600_000);
  const minutes = (n: number) => new Date(now.getTime() + n * 60_000);

  const results = { dayBefore: 0, sameDay: 0, skipped: 0, failed: 0 };

  if (settings.notifyReminder24h) {
    const due = await bookingsStartingBetween(hours(23), hours(25));
    for (const booking of due) {
      if (await alreadySent(booking.id, "reminder_24h")) {
        results.skipped += 1;
        continue;
      }
      const outcome = await sendBookingReminder(booking.id, "day_before");
      results.dayBefore += outcome.sent;
      results.failed += outcome.failed;
    }
  }

  if (settings.notifyReminderSameDay) {
    const due = await bookingsStartingBetween(now, minutes(settings.sameDayReminderLeadMinutes));
    for (const booking of due) {
      if (await alreadySent(booking.id, "reminder_same_day")) {
        results.skipped += 1;
        continue;
      }
      const outcome = await sendBookingReminder(booking.id, "same_day");
      results.sameDay += outcome.sent;
      results.failed += outcome.failed;
    }
  }

  return NextResponse.json({ ranAt: now.toISOString(), ...results });
}
