import type { Metadata } from "next";
import Link from "next/link";

import { MonthGrid } from "@/components/calendar/month-grid";
import { TimeGrid } from "@/components/calendar/time-grid";
import { buttonClass, cx } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import {
  calendarRange,
  chunkWeeks,
  isValidDateKey,
  monthIndexOfKey,
  startOfMonthKey,
  stepKey,
  type CalendarView,
} from "@/lib/calendar";
import type { BookingStatus } from "@/lib/domain";
import type { SessionView } from "@/lib/schedule";
import { dayKey, formatDayLong, formatMonthYear, formatDayShort } from "@/lib/time";
import { getBookingsInRange, getSetupSummaries } from "@/server/bookings";
import { getStudioSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Calendar" };

const VIEWS: CalendarView[] = ["day", "week", "month"];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const params = await searchParams;
  await requireUser();

  const settings = await getStudioSettings();
  const tz = settings.timezone;
  const today = dayKey(new Date(), tz);

  const view: CalendarView = VIEWS.includes(params.view as CalendarView)
    ? (params.view as CalendarView)
    : "week";
  const anchor = isValidDateKey(params.date) ? params.date : today;

  const { days, rangeStart, rangeEnd } = calendarRange(view, anchor, tz);

  const rows = await getBookingsInRange(rangeStart, rangeEnd);
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
      options: line.options.map((o) => ({
        name: o.name,
        swatchHex: o.swatchHex,
        imageUrl: o.imageUrl,
      })),
    })),
  }));

  const heading =
    view === "day"
      ? formatDayLong(days[0], tz)
      : view === "week"
        ? `${formatDayShort(days[0], tz)} – ${formatDayShort(days[6], tz)}`
        : formatMonthYear(days[Math.floor(days.length / 2)], tz);

  const href = (nextView: CalendarView, nextDate: string) =>
    `/calendar?view=${nextView}&date=${nextDate}`;

  return (
    <div className="pt-10">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div>
          <p className="eyebrow text-muted">Calendar</p>
          <h1 className="display mt-3 text-4xl sm:text-5xl">{heading}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-sm border border-line bg-white p-0.5">
            {VIEWS.map((v) => (
              <Link
                key={v}
                href={href(v, anchor)}
                aria-current={v === view ? "page" : undefined}
                className={cx(
                  "eyebrow rounded-[2px] px-3 py-2 capitalize transition-colors",
                  v === view ? "bg-ink text-white" : "text-muted hover:text-ink",
                )}
              >
                {v}
              </Link>
            ))}
          </div>

          <div className="inline-flex items-center gap-1">
            <Link
              href={href(view, stepKey(view, anchor, -1))}
              aria-label="Previous"
              className={buttonClass("secondary", "sm", "px-2.5")}
            >
              ←
            </Link>
            <Link href={href(view, today)} className={buttonClass("secondary", "sm")}>
              Today
            </Link>
            <Link
              href={href(view, stepKey(view, anchor, 1))}
              aria-label="Next"
              className={buttonClass("secondary", "sm", "px-2.5")}
            >
              →
            </Link>
          </div>

          <Link href="/bookings/new" className={buttonClass("primary")}>
            New booking
          </Link>
        </div>
      </div>

      {view === "month" ? (
        <MonthGrid
          weeks={chunkWeeks(days)}
          sessions={sessions}
          timezone={tz}
          focusMonth={monthIndexOfKey(startOfMonthKey(anchor))}
          today={today}
        />
      ) : (
        <TimeGrid days={days} sessions={sessions} timezone={tz} dense={view === "week"} />
      )}

      <p className="eyebrow mt-6 text-line-strong">
        {view === "month"
          ? "Select a date to open its day"
          : "Click an empty slot to start a booking there"}
        <span className="mx-2">·</span>
        Shaded bands are setup and reset time
      </p>
    </div>
  );
}
