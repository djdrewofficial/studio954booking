import type { Metadata } from "next";
import Link from "next/link";

import { TodayRundown } from "@/components/today-rundown";
import { buttonClass } from "@/components/ui";
import type { BookingStatus } from "@/lib/domain";
import type { SessionView } from "@/lib/schedule";
import { endOfDayInTz, formatDayLong, startOfDayInTz } from "@/lib/time";
import { getBookingsInRange, getSetupSummaries } from "@/server/bookings";
import { getStudioSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const settings = await getStudioSettings();
  const tz = settings.timezone;
  const now = new Date();

  const dayStart = startOfDayInTz(now, tz);
  const dayEnd = endOfDayInTz(now, tz);

  const held = await getBookingsInRange(dayStart, dayEnd);
  // Keep sessions that actually run today; a buffer bleeding over midnight
  // should not make tomorrow's shoot appear on today's rundown.
  const rows = held.filter((b) => b.startsAt < dayEnd && b.endsAt > dayStart);

  const setups = await getSetupSummaries(rows.map((r) => r.id));

  const sessions: SessionView[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind,
    bookingType: row.bookingType,
    status: row.status as BookingStatus,
    clientName: row.clientName,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    setupMinutes: row.setupMinutes,
    resetMinutes: row.resetMinutes,
    blockedStart: row.blockedStart,
    blockedEnd: row.blockedEnd,
    setName: row.setName,
    attendeeCount: row.attendeeCount,
    microphoneCount: row.microphoneCount,
    notes: row.notes,
    setup: (setups.get(row.id) ?? []).map((line) => ({
      categoryName: line.categoryName,
      categorySlug: line.categorySlug,
      options: line.options.map((o) => ({ name: o.name, swatchHex: o.swatchHex })),
    })),
  }));

  return (
    <div className="pt-10">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div>
          <p className="eyebrow-lg text-muted">Today at {settings.studioName}</p>
          <h1 className="display mt-4 text-4xl sm:text-6xl">{formatDayLong(now, tz)}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/prep" className={buttonClass("secondary")}>
            Prep sheet
          </Link>
          <Link href="/bookings/new" className={buttonClass("primary")}>
            New booking
          </Link>
        </div>
      </div>

      <TodayRundown sessions={sessions} timezone={tz} initialNow={now.getTime()} />
    </div>
  );
}
