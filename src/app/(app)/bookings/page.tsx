import type { Metadata } from "next";
import Link from "next/link";

import { BookingFilters } from "@/components/booking-filters";
import { setupOneLine } from "@/components/setup-recipe";
import { EmptyState, StatusChip, buttonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import {
  BOOKING_KIND_LABEL,
  BOOKING_STATUS_LABEL,
  BOOKING_TYPE_LABEL,
  STATUS_TONE,
  type BookingKind,
  type BookingStatus,
  type BookingType,
} from "@/lib/domain";
import { dayKey, formatDayLong, formatTimeRange } from "@/lib/time";
import { getSetupSummaries, listBookings, type BookingScope } from "@/server/bookings";
import { getStudioSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Bookings" };

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; scope?: string; kind?: string }>;
}) {
  const params = await searchParams;
  await requireUser();

  const scope: BookingScope =
    params.scope === "past" || params.scope === "all" ? params.scope : "upcoming";
  const kind = params.kind === "internal" || params.kind === "external" ? params.kind : "";
  const search = params.q ?? "";

  const settings = await getStudioSettings();
  const tz = settings.timezone;

  const rows = await listBookings({ scope, kind: kind || undefined, search });
  const setups = await getSetupSummaries(rows.map((r) => r.id));

  // Grouped by studio day so the list reads like a schedule, not a table dump.
  const days = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = dayKey(row.startsAt, tz);
    days.set(key, [...(days.get(key) ?? []), row]);
  }

  return (
    <div className="pt-10">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <p className="eyebrow text-muted">Bookings</p>
          <h1 className="display mt-3 text-4xl sm:text-5xl">
            {scope === "past" ? "Everything that has happened." : "Everything on the books."}
          </h1>
        </div>
        <Link href="/bookings/new" className={buttonClass("primary")}>
          New booking
        </Link>
      </div>

      <BookingFilters scope={scope} kind={kind} search={search} />

      {rows.length === 0 ? (
        <EmptyState
          headline={search ? "Nothing matches that." : "No bookings here yet."}
          body={
            search
              ? "Try a different name, client or organizer."
              : scope === "past"
                ? "Completed sessions will collect here."
                : "Create a booking and it will show up on Today and the calendar."
          }
          action={
            search ? undefined : (
              <Link href="/bookings/new" className={buttonClass("primary")}>
                New booking
              </Link>
            )
          }
        />
      ) : (
        <div className="mt-2">
          {[...days.entries()].map(([key, dayRows]) => (
            <section key={key} className="mt-8">
              <h2 className="eyebrow sticky top-14 z-10 bg-paper py-3 text-muted md:top-14">
                {formatDayLong(dayRows[0].startsAt, tz)}
              </h2>

              <ul>
                {dayRows.map((row) => {
                  const status = row.status as BookingStatus;
                  const recipe = setupOneLine(
                    (setups.get(row.id) ?? []).map((line) => ({
                      categoryName: line.categoryName,
                      categorySlug: line.categorySlug,
                      options: line.options.map((o) => ({
                  name: o.name,
                  swatchHex: o.swatchHex,
                  imageUrl: o.imageUrl,
                })),
                    })),
                  );

                  return (
                    <li key={row.id} className="border-t border-line">
                      <Link
                        href={`/bookings/${row.id}`}
                        className="group grid grid-cols-1 gap-x-6 gap-y-2 py-5 transition-colors hover:bg-white sm:grid-cols-[168px_minmax(0,1fr)_auto]"
                      >
                        <span className="timecode text-sm text-muted">
                          {formatTimeRange(row.startsAt, row.endsAt, tz)}
                        </span>

                        <span className="min-w-0">
                          <span className="display block text-xl group-hover:underline group-hover:underline-offset-4">
                            {row.title}
                          </span>
                          <span className="mt-1 block text-sm text-muted">
                            {[
                              row.clientName,
                              BOOKING_TYPE_LABEL[row.bookingType as BookingType],
                              BOOKING_KIND_LABEL[row.kind as BookingKind],
                              row.setName,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                          {recipe ? (
                            <span className="mt-1 block truncate text-[0.8125rem] text-line-strong">
                              {recipe}
                            </span>
                          ) : null}
                        </span>

                        <span className="flex items-start sm:justify-end">
                          <StatusChip
                            label={BOOKING_STATUS_LABEL[status]}
                            tone={STATUS_TONE[status]}
                          />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
