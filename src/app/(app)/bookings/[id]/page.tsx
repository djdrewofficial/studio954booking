import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingActions } from "@/components/booking-actions";
import { SetupRecipe } from "@/components/setup-recipe";
import { StatusAction } from "@/components/status-action";
import { Eyebrow, StatusChip } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import {
  BOOKING_KIND_LABEL,
  BOOKING_STATUS_LABEL,
  BOOKING_TYPE_LABEL,
  isLiveStatus,
  type BookingKind,
  type BookingStatus,
  type BookingType,
} from "@/lib/domain";
import { formatDate, formatDayLong, formatDuration, formatTime, formatTimeRange } from "@/lib/time";
import { getBookingDetail, getNotificationLog } from "@/server/bookings";
import { isEmailConfigured } from "@/server/email/mailer";
import { formatStudioAddress, getStudioSettings } from "@/server/settings";


export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const detail = await getBookingDetail(id);
  return { title: detail?.title ?? "Booking" };
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();

  const [detail, settings] = await Promise.all([getBookingDetail(id), getStudioSettings()]);
  if (!detail) notFound();

  const tz = settings.timezone;
  const log = await getNotificationLog(id);

  const status = detail.status as BookingStatus;
  const setupAt = new Date(detail.startsAt.getTime() - detail.setupMinutes * 60_000);
  const resetUntil = new Date(detail.endsAt.getTime() + detail.resetMinutes * 60_000);
  const durationMinutes = Math.round(
    (detail.endsAt.getTime() - detail.startsAt.getTime()) / 60_000,
  );

  return (
    <div className="pt-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          <p className="eyebrow text-muted">
            {BOOKING_KIND_LABEL[detail.kind as BookingKind]}
            <span className="mx-2 text-line-strong">/</span>
            {BOOKING_TYPE_LABEL[detail.bookingType as BookingType]}
          </p>
          <h1 className="display mt-3 text-4xl sm:text-6xl">{detail.title}</h1>
          {detail.clientName ? (
            <p className="mt-2 text-lg text-muted">{detail.clientName}</p>
          ) : null}
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <StatusChip
            label={BOOKING_STATUS_LABEL[status]}
            live={isLiveStatus(status)}
            muted={status === "upcoming" || status === "cancelled"}
          />
          <StatusAction bookingId={detail.id} status={status} showOverride size="md" />
        </div>
      </div>

      {/* When */}
      <div className="mt-10 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-5">
        <span className="display text-2xl">{formatDayLong(detail.startsAt, tz)}</span>
        <span className="timecode text-lg text-ink">
          {formatTimeRange(detail.startsAt, detail.endsAt, tz)}
        </span>
        <span className="eyebrow text-muted">{formatDuration(durationMinutes)}</span>
      </div>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
        {/* ---- Left: how the room has to look --------------------------- */}
        <div>
          <section>
            <Eyebrow as="h2">Studio setup</Eyebrow>
            {detail.set ? (
              <>
                <p className="display mt-4 text-3xl">{detail.set.name}</p>
                {detail.set.description ? (
                  <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
                    {detail.set.description}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-4 text-sm text-muted">
                No set chosen yet.{" "}
                <Link href={`/bookings/${id}/edit`} className="underline underline-offset-2">
                  Pick one
                </Link>
                .
              </p>
            )}

            {detail.setup.length ? (
              <SetupRecipe
                setup={detail.setup.map((line) => ({
                  categoryName: line.categoryName,
                  categorySlug: line.categorySlug,
                  options: line.options.map((o) => ({ name: o.name, swatchHex: o.swatchHex })),
                }))}
                layout="block"
                className="mt-6"
              />
            ) : null}

            {detail.microphoneCount > 0 ? (
              <div className="mt-4 flex items-baseline justify-between border-b border-line py-3">
                <Eyebrow>Microphones</Eyebrow>
                <span className="timecode text-[0.9375rem]">{detail.microphoneCount}</span>
              </div>
            ) : null}
          </section>

          {detail.notes ? (
            <section className="mt-12">
              <Eyebrow as="h2">Notes</Eyebrow>
              <p className="mt-4 max-w-prose whitespace-pre-line text-[0.9375rem] leading-relaxed">
                {detail.notes}
              </p>
            </section>
          ) : null}

          {detail.internalNotes ? (
            <section className="mt-10 border-l-2 border-line-strong pl-5">
              <Eyebrow as="h2">Internal only</Eyebrow>
              <p className="mt-3 max-w-prose whitespace-pre-line text-[0.9375rem] leading-relaxed text-muted">
                {detail.internalNotes}
              </p>
            </section>
          ) : null}

          {detail.addons.length ? (
            <section className="mt-12">
              <Eyebrow as="h2">Add-ons</Eyebrow>
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {detail.addons.map((addon) => (
                  <li key={addon.addonId} className="flex items-baseline justify-between gap-4 py-3">
                    <span className="text-[0.9375rem]">
                      {addon.name}
                      {addon.quantity > 1 ? (
                        <span className="ml-2 text-muted">× {addon.quantity}</span>
                      ) : null}
                    </span>
                    <span className="timecode text-sm text-muted">
                      ${((addon.priceCents * addon.quantity) / 100).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="mt-12 border-t border-line pt-6">
            <BookingActions
              bookingId={detail.id}
              isCancelled={status === "cancelled"}
              isRecurring={Boolean(detail.recurrenceGroupId)}
              emailConfigured={isEmailConfigured()}
            />
          </div>
        </div>

        {/* ---- Right: schedule and people ------------------------------- */}
        <aside className="flex flex-col gap-10">
          <section>
            <Eyebrow as="h2">Schedule</Eyebrow>
            <dl className="mt-4 divide-y divide-line border-y border-line">
              {detail.setupMinutes > 0 ? (
                <Row
                  label="Setup"
                  value={`${formatTime(setupAt, tz)} – ${formatTime(detail.startsAt, tz)}`}
                  muted
                />
              ) : null}
              <Row
                label="Session"
                value={formatTimeRange(detail.startsAt, detail.endsAt, tz)}
                emphasis
              />
              {detail.resetMinutes > 0 ? (
                <Row
                  label="Reset"
                  value={`${formatTime(detail.endsAt, tz)} – ${formatTime(resetUntil, tz)}`}
                  muted
                />
              ) : null}
              <Row
                label="Room held"
                value={formatDuration(durationMinutes + detail.setupMinutes + detail.resetMinutes)}
              />
            </dl>
            {formatStudioAddress(settings) ? (
              <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted">
                {formatStudioAddress(settings)}
              </p>
            ) : null}
          </section>

          <section>
            <Eyebrow as="h2">Organizer</Eyebrow>
            <div className="mt-4 border-y border-line py-3">
              <p className="text-[0.9375rem]">{detail.organizerName}</p>
              <a
                href={`mailto:${detail.organizerEmail}`}
                className="block text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
              >
                {detail.organizerEmail}
              </a>
              {detail.organizerPhone ? (
                <a
                  href={`tel:${detail.organizerPhone}`}
                  className="timecode block text-sm text-muted hover:text-ink"
                >
                  {detail.organizerPhone}
                </a>
              ) : null}
            </div>
          </section>

          <section>
            <Eyebrow as="h2">
              Attendees {detail.attendees.length ? `(${detail.attendees.length})` : ""}
            </Eyebrow>
            {detail.attendees.length ? (
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {detail.attendees.map((attendee) => (
                  <li key={attendee.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[0.9375rem]">{attendee.name}</p>
                      {attendee.email ? (
                        <p className="truncate text-sm text-muted">{attendee.email}</p>
                      ) : null}
                    </div>
                    {attendee.notify ? (
                      <span className="eyebrow shrink-0 pt-1 text-muted">Notified</span>
                    ) : (
                      <span className="eyebrow shrink-0 pt-1 text-line-strong">Silent</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted">Just the organizer.</p>
            )}
          </section>

          <section>
            <Eyebrow as="h2">Notifications</Eyebrow>
            {log.length ? (
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {log.slice(0, 8).map((entry) => (
                  <li key={entry.id} className="py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="eyebrow text-ink">{entry.kind.replace(/_/g, " ")}</span>
                      <span
                        className={
                          entry.status === "sent"
                            ? "eyebrow text-muted"
                            : entry.status === "failed"
                              ? "eyebrow text-danger"
                              : "eyebrow text-line-strong"
                        }
                      >
                        {entry.status}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[0.8125rem] text-muted">
                      {entry.recipientEmail} · {formatDate(entry.createdAt, tz)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted">Nothing sent yet.</p>
            )}
          </section>

          {detail.googleEventId ? (
            <p className="eyebrow text-muted">Synced to Google Calendar</p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  emphasis,
}: {
  label: string;
  value: string;
  muted?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="eyebrow text-muted">{label}</dt>
      <dd
        className={
          emphasis
            ? "timecode text-sm font-medium text-ink"
            : muted
              ? "timecode text-sm text-muted"
              : "timecode text-sm text-ink"
        }
      >
        {value}
      </dd>
    </div>
  );
}
