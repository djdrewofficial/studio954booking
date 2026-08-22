import type { Metadata } from "next";
import Link from "next/link";

import { PrintButton } from "@/components/print-button";
import { EmptyState, buttonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { addDaysToKey, isValidDateKey } from "@/lib/calendar";
import { BOOKING_KIND_LABEL, BOOKING_TYPE_LABEL, type BookingKind, type BookingType } from "@/lib/domain";
import {
  dayKey,
  endOfDayInTz,
  formatDayLong,
  formatDuration,
  formatTime,
  formatTimeRange,
  instantFromLocalParts,
  startOfDayInTz,
} from "@/lib/time";
import { getBookingsInRange, getSetupSummaries } from "@/server/bookings";
import { formatStudioAddress, getStudioSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Prep sheet" };

/**
 * The prep sheet is the one screen designed to leave the building. It reads as
 * a call sheet: what the room must look like, by when, in running order.
 */
export default async function PrepSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  await requireUser();

  const settings = await getStudioSettings();
  const tz = settings.timezone;
  const today = dayKey(new Date(), tz);
  const target = isValidDateKey(params.date) ? params.date : today;

  const anchor = instantFromLocalParts(target, "12:00", tz);
  const dayStart = startOfDayInTz(anchor, tz);
  const dayEnd = endOfDayInTz(anchor, tz);

  const rows = (await getBookingsInRange(dayStart, dayEnd))
    .filter((b) => b.startsAt < dayEnd && b.endsAt > dayStart)
    .filter((b) => b.status !== "cancelled");

  const setups = await getSetupSummaries(rows.map((r) => r.id));
  const address = formatStudioAddress(settings);

  return (
    <div className="pt-10 print:pt-0">
      {/* Screen-only controls */}
      <div className="flex flex-wrap items-center justify-between gap-4" data-print="hide">
        <div className="flex items-center gap-1">
          <Link
            href={`/prep?date=${addDaysToKey(target, -1)}`}
            aria-label="Previous day"
            className={buttonClass("secondary", "sm", "px-2.5")}
          >
            ←
          </Link>
          <Link href={`/prep?date=${today}`} className={buttonClass("secondary", "sm")}>
            Today
          </Link>
          <Link
            href={`/prep?date=${addDaysToKey(target, 1)}`}
            aria-label="Next day"
            className={buttonClass("secondary", "sm", "px-2.5")}
          >
            →
          </Link>
        </div>
        <PrintButton />
      </div>

      {/* Masthead — printed at the top of the sheet */}
      <header className="mt-8 border-b-2 border-ink pb-5 print:mt-0">
        <div className="flex items-baseline justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="block h-5 w-1 bg-accent print:bg-black" aria-hidden />
            <span className="eyebrow-lg">{settings.studioName}</span>
          </div>
          <span className="eyebrow text-muted">Prep sheet</span>
        </div>
        <h1 className="display mt-6 text-4xl uppercase sm:text-6xl">{formatDayLong(anchor, tz)}</h1>
        <p className="mt-3 text-sm text-muted">
          {rows.length === 0
            ? "No sessions scheduled"
            : `${rows.length} ${rows.length === 1 ? "session" : "sessions"}`}
          {address ? ` · ${address}` : ""}
        </p>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          headline="Nothing to prep."
          body="No sessions are booked for this day."
          action={
            <Link href="/bookings/new" className={buttonClass("primary")}>
              New booking
            </Link>
          }
        />
      ) : (
        <div>
          {rows.map((row, index) => {
            const setupAt = new Date(row.startsAt.getTime() - row.setupMinutes * 60_000);
            const resetUntil = new Date(row.endsAt.getTime() + row.resetMinutes * 60_000);
            const setup = setups.get(row.id) ?? [];

            return (
              <section
                key={row.id}
                data-print="keep"
                className="border-b border-line py-9 print:py-6"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                  <h2 className="display text-3xl uppercase sm:text-4xl">
                    <span className="timecode mr-4 text-muted">
                      {formatTime(row.startsAt, tz)}
                    </span>
                    {row.title}
                  </h2>
                  <span className="eyebrow text-muted">
                    {String(index + 1).padStart(2, "0")} / {String(rows.length).padStart(2, "0")}
                  </span>
                </div>

                {row.setupMinutes > 0 ? (
                  <p className="eyebrow-lg mt-4 text-accent-ink print:text-black">
                    Setup by {formatTime(setupAt, tz)}
                  </p>
                ) : null}

                <dl className="mt-6 grid gap-x-10 gap-y-0 sm:grid-cols-2">
                  <PrepRow label="Session" value={formatTimeRange(row.startsAt, row.endsAt, tz)} />
                  <PrepRow
                    label="Type"
                    value={`${BOOKING_TYPE_LABEL[row.bookingType as BookingType]} · ${
                      BOOKING_KIND_LABEL[row.kind as BookingKind]
                    }`}
                  />
                  <PrepRow label="Set" value={row.setName ?? "Not chosen"} />
                  {setup.map((line) => (
                    <PrepRow
                      key={line.categorySlug}
                      label={line.categoryName}
                      value={line.options.map((o) => o.name).join(" + ")}
                    />
                  ))}
                  <PrepRow
                    label="Microphones"
                    value={row.microphoneCount > 0 ? String(row.microphoneCount) : "—"}
                  />
                  <PrepRow label="Attendees" value={String(row.attendeeCount)} />
                  <PrepRow label="Organizer" value={row.organizerName} />
                </dl>

                {row.notes ? (
                  <div className="mt-6 border-l-2 border-line-strong pl-5">
                    <p className="eyebrow text-muted">Notes</p>
                    <p className="mt-2 max-w-prose whitespace-pre-line text-[0.9375rem] leading-relaxed">
                      {row.notes}
                    </p>
                  </div>
                ) : null}

                {row.resetMinutes > 0 ? (
                  <p className="eyebrow mt-6 text-muted">
                    Reset {formatTime(row.endsAt, tz)} – {formatTime(resetUntil, tz)} (
                    {formatDuration(row.resetMinutes)})
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      <footer className="mt-8 hidden print:block">
        <p className="eyebrow text-muted">
          {settings.studioName} · {formatDayLong(anchor, tz)}
        </p>
      </footer>
    </div>
  );
}

function PrepRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5">
      <dt className="eyebrow text-muted">{label}</dt>
      <dd className="text-right text-[0.9375rem]">{value}</dd>
    </div>
  );
}
