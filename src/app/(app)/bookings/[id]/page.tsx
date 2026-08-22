import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingActions } from "@/components/booking-actions";
import { SetupRecipe } from "@/components/setup-recipe";
import { StatusAction } from "@/components/status-action";
import { StatusChip } from "@/components/ui";
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

  const setup = detail.setup.map((line) => ({
    categoryName: line.categoryName,
    categorySlug: line.categorySlug,
    options: line.options.map((o) => ({
      name: o.name,
      swatchHex: o.swatchHex,
      imageUrl: o.imageUrl,
    })),
  }));

  return (
    <div className="pt-8">
      <Link
        href="/bookings"
        className="inline-flex items-center gap-2 font-semibold text-muted hover:text-ink"
      >
        ← All bookings
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip label={BOOKING_STATUS_LABEL[status]} tone={STATUS_TONE[status]} />
            <span className="rounded-full bg-sand px-3.5 py-1.5 font-semibold text-muted">
              {BOOKING_TYPE_LABEL[detail.bookingType as BookingType]}
            </span>
            <span className="rounded-full bg-sand px-3.5 py-1.5 font-semibold text-muted">
              {BOOKING_KIND_LABEL[detail.kind as BookingKind]}
            </span>
          </div>
          <h1 className="display mt-4 text-4xl sm:text-5xl">{detail.title}</h1>
          {detail.clientName ? <p className="mt-2 text-xl text-muted">{detail.clientName}</p> : null}
        </div>

        <StatusAction bookingId={detail.id} status={status} showOverride size="md" />
      </div>

      <div className="card mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 px-7 py-6">
        <span className="display text-2xl">{formatDayLong(detail.startsAt, tz)}</span>
        <span className="timecode text-2xl text-accent-ink">
          {formatTimeRange(detail.startsAt, detail.endsAt, tz)}
        </span>
        <span className="rounded-full bg-sand px-4 py-1.5 font-semibold text-muted">
          {formatDuration(durationMinutes)}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ---- How the room has to look ------------------------------- */}
        <div className="flex flex-col gap-6">
          <section className="card overflow-hidden">
            {detail.set?.imageUrl ? (
              <div className="relative aspect-[21/9] w-full bg-sand">
                <Image
                  src={detail.set.imageUrl}
                  alt={detail.set.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 700px"
                  unoptimized
                />
              </div>
            ) : null}

            <div className="px-7 py-6">
              <p className="label">How the studio should look</p>
              {detail.set ? (
                <>
                  <h2 className="display mt-2 text-3xl">{detail.set.name}</h2>
                  {detail.set.description ? (
                    <p className="mt-2 max-w-prose text-muted">{detail.set.description}</p>
                  ) : null}
                </>
              ) : (
                <p className="mt-3 text-muted">
                  No set chosen yet.{" "}
                  <Link
                    href={`/bookings/${id}/edit`}
                    className="font-semibold text-accent-ink underline underline-offset-2"
                  >
                    Pick one
                  </Link>
                  .
                </p>
              )}

              {setup.length ? <SetupRecipe setup={setup} className="mt-6" /> : null}

              {detail.microphoneCount > 0 ? (
                <p className="mt-6 inline-block rounded-full bg-sand px-4 py-2 font-semibold">
                  {detail.microphoneCount} microphone{detail.microphoneCount === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>
          </section>

          {detail.notes ? (
            <section className="card px-7 py-6">
              <p className="label">Notes</p>
              <p className="mt-3 max-w-prose whitespace-pre-line leading-relaxed">{detail.notes}</p>
            </section>
          ) : null}

          {detail.internalNotes ? (
            <section className="card border-l-4 border-l-prep px-7 py-6">
              <p className="label text-prep">Team only — not shared with the client</p>
              <p className="mt-3 max-w-prose whitespace-pre-line leading-relaxed text-muted">
                {detail.internalNotes}
              </p>
            </section>
          ) : null}

          {detail.addons.length ? (
            <section className="card px-7 py-6">
              <p className="label">Add-ons</p>
              <ul className="mt-4 flex flex-col gap-3">
                {detail.addons.map((addon) => (
                  <li key={addon.addonId} className="flex items-baseline justify-between gap-4">
                    <span className="font-medium">
                      {addon.name}
                      {addon.quantity > 1 ? (
                        <span className="ml-2 text-muted">× {addon.quantity}</span>
                      ) : null}
                    </span>
                    <span className="timecode text-muted">
                      ${((addon.priceCents * addon.quantity) / 100).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <BookingActions
            bookingId={detail.id}
            isCancelled={status === "cancelled"}
            isRecurring={Boolean(detail.recurrenceGroupId)}
            emailConfigured={isEmailConfigured()}
          />
        </div>

        {/* ---- Schedule and people ------------------------------------ */}
        <aside className="flex flex-col gap-6">
          <section className="card px-7 py-6">
            <p className="label">Studio schedule</p>
            <ul className="mt-4 flex flex-col gap-3">
              {detail.setupMinutes > 0 ? (
                <TimeRow
                  label="Set up"
                  value={`${formatTime(setupAt, tz)} – ${formatTime(detail.startsAt, tz)}`}
                  tone="prep"
                />
              ) : null}
              <TimeRow
                label="Session"
                value={formatTimeRange(detail.startsAt, detail.endsAt, tz)}
                tone="accent"
              />
              {detail.resetMinutes > 0 ? (
                <TimeRow
                  label="Reset"
                  value={`${formatTime(detail.endsAt, tz)} – ${formatTime(resetUntil, tz)}`}
                  tone="prep"
                />
              ) : null}
              <TimeRow
                label="Room held for"
                value={formatDuration(durationMinutes + detail.setupMinutes + detail.resetMinutes)}
              />
            </ul>
            {formatStudioAddress(settings) ? (
              <p className="mt-5 text-[0.9375rem] leading-relaxed text-muted">
                {formatStudioAddress(settings)}
              </p>
            ) : null}
          </section>

          <section className="card px-7 py-6">
            <p className="label">Organizer</p>
            <p className="mt-3 text-lg font-semibold">{detail.organizerName}</p>
            <a
              href={`mailto:${detail.organizerEmail}`}
              className="block break-words text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              {detail.organizerEmail}
            </a>
            {detail.organizerPhone ? (
              <a
                href={`tel:${detail.organizerPhone}`}
                className="timecode mt-1 block text-muted hover:text-ink"
              >
                {detail.organizerPhone}
              </a>
            ) : null}
          </section>

          <section className="card px-7 py-6">
            <p className="label">
              Who&rsquo;s coming {detail.attendees.length ? `(${detail.attendees.length})` : ""}
            </p>
            {detail.attendees.length ? (
              <ul className="mt-4 flex flex-col gap-4">
                {detail.attendees.map((attendee) => (
                  <li key={attendee.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{attendee.name}</p>
                      {attendee.email ? (
                        <p className="truncate text-[0.9375rem] text-muted">{attendee.email}</p>
                      ) : null}
                    </div>
                    <span
                      className={
                        attendee.notify
                          ? "shrink-0 rounded-full bg-ready-soft px-3 py-1 text-[0.8125rem] font-semibold text-ready"
                          : "shrink-0 rounded-full bg-sand px-3 py-1 text-[0.8125rem] font-semibold text-muted"
                      }
                    >
                      {attendee.notify ? "Emailed" : "Not emailed"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-muted">Just the organizer so far.</p>
            )}
          </section>

          <section className="card px-7 py-6">
            <p className="label">Emails sent</p>
            {log.length ? (
              <ul className="mt-4 flex flex-col gap-3">
                {log.slice(0, 6).map((entry) => (
                  <li key={entry.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium capitalize">{entry.kind.replace(/_/g, " ")}</span>
                      <span
                        className={
                          entry.status === "failed"
                            ? "text-[0.9375rem] font-semibold text-danger"
                            : "text-[0.9375rem] text-muted"
                        }
                      >
                        {entry.status}
                      </span>
                    </div>
                    <p className="truncate text-[0.9375rem] text-muted">
                      {entry.recipientEmail} · {formatDate(entry.createdAt, tz)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-muted">Nothing sent yet.</p>
            )}
          </section>

          {detail.googleEventId ? (
            <p className="text-center font-semibold text-ready">On the Google Calendar</p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function TimeRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "prep" | "accent";
}) {
  return (
    <li className="flex items-baseline justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span
        className={
          tone === "accent"
            ? "timecode text-lg text-accent-ink"
            : tone === "prep"
              ? "timecode text-prep"
              : "timecode"
        }
      >
        {value}
      </span>
    </li>
  );
}
