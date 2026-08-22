"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  BOOKING_KIND_LABEL,
  BOOKING_STATUS_LABEL,
  BOOKING_TYPE_LABEL,
  STATUS_TONE,
  type BookingKind,
  type BookingType,
} from "@/lib/domain";
import {
  freeUntil,
  isPast,
  nextSession,
  relativeLead,
  roomStateAt,
  type RoomState,
  type SessionView,
} from "@/lib/schedule";
import { formatDuration, formatTime, formatTimeRange } from "@/lib/time";

import { SetupRecipe } from "./setup-recipe";
import { StatusAction } from "./status-action";
import { EmptyState, StatusChip, buttonClass, cx } from "./ui";

/**
 * The day, read top to bottom. The clock ticks client-side so the "happening
 * now" marker stays honest on a screen left up all day in the studio.
 */
export function TodayRundown({
  sessions,
  timezone,
  initialNow,
}: {
  sessions: SessionView[];
  timezone: string;
  initialNow: number;
}) {
  const [now, setNow] = useState(() => new Date(initialNow));

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const state = roomStateAt(sessions, now);
  const current = state.phase === "clear" ? null : state.session;
  const next = nextSession(sessions, now, current);
  const clearUntil = freeUntil(sessions, now);

  return (
    <>
      <div className="mt-8 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <RoomCard state={state} timezone={timezone} clearUntil={clearUntil} />
        <NextCard next={next} now={now} timezone={timezone} />
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          headline="Nothing booked today"
          body="The studio is free all day. Anything you schedule will show up here in order, with its setup and reset time."
          action={
            <Link href="/bookings/new" className={buttonClass("primary", "lg")}>
              Book the studio
            </Link>
          }
        />
      ) : (
        <section aria-label="Today's sessions" className="mt-10 flex flex-col gap-4">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              timezone={timezone}
              now={now}
              isLive={state.phase === "live" && state.session.id === session.id}
              isSettingUp={state.phase === "setup" && state.session.id === session.id}
              isResetting={state.phase === "reset" && state.session.id === session.id}
            />
          ))}
        </section>
      )}
    </>
  );
}

/* ---------------------------------------------------------------------------
 * What the room is doing right now
 * ------------------------------------------------------------------------ */

function RoomCard({
  state,
  timezone,
  clearUntil,
}: {
  state: RoomState;
  timezone: string;
  clearUntil: Date | null;
}) {
  if (state.phase === "clear") {
    return (
      <div className="card flex flex-col justify-center px-7 py-8">
        <span className="label">Right now</span>
        <p className="display mt-3 text-4xl sm:text-5xl">The room is free</p>
        <p className="mt-3 text-lg text-muted">
          {clearUntil
            ? `Nothing needed until ${formatTime(clearUntil, timezone)}.`
            : "Nothing else scheduled today."}
        </p>
      </div>
    );
  }

  const { session } = state;

  const headline =
    state.phase === "live"
      ? "Happening now"
      : state.phase === "setup"
        ? "Setting up the room"
        : "Resetting the room";

  const detail =
    state.phase === "live"
      ? `${formatTimeRange(session.startsAt, session.endsAt, timezone)} · ${formatDuration(
          state.minutesRemaining,
        )} left`
      : state.phase === "setup"
        ? `Doors at ${formatTime(session.startsAt, timezone)} · ${relativeLead(
            state.minutesUntilStart,
          )}`
        : `Finished at ${formatTime(session.endsAt, timezone)} · clear by ${formatTime(
            session.blockedEnd,
            timezone,
          )}`;

  return (
    <div
      className={cx(
        "rounded-[22px] px-7 py-8 shadow-lift",
        state.phase === "live" ? "bg-accent text-white" : "bg-ink text-white",
      )}
    >
      <span className="flex items-center gap-2.5 font-semibold">
        {state.phase === "live" ? (
          <span className="tally size-2.5 rounded-full bg-white" aria-hidden />
        ) : null}
        {headline}
      </span>

      <Link
        href={`/bookings/${session.id}`}
        className="display mt-3 block text-4xl underline-offset-4 hover:underline sm:text-5xl"
      >
        {session.title}
      </Link>

      <p className={cx("mt-3 text-lg", state.phase === "live" ? "text-white/80" : "text-ink-muted")}>
        {detail}
      </p>

      <div className="mt-6">
        <StatusAction
          bookingId={session.id}
          status={session.status}
          size="md"
          onDark={state.phase !== "live"}
        />
      </div>
    </div>
  );
}

function NextCard({
  next,
  now,
  timezone,
}: {
  next: SessionView | null;
  now: Date;
  timezone: string;
}) {
  if (!next) {
    return (
      <div className="card flex flex-col justify-center px-7 py-8">
        <span className="label">Up next</span>
        <p className="mt-3 text-lg text-muted">Nothing else on the schedule today.</p>
      </div>
    );
  }

  return (
    <div className="card flex flex-col justify-center px-7 py-8">
      <span className="label">Up next</span>
      <Link
        href={`/bookings/${next.id}`}
        className="display mt-3 block text-2xl underline-offset-4 hover:underline sm:text-3xl"
      >
        {next.title}
      </Link>
      <p className="timecode mt-3 text-lg">
        {formatTime(next.startsAt, timezone)}
        <span className="ml-2 font-normal text-muted">
          {relativeLead(Math.round((next.startsAt.getTime() - now.getTime()) / 60_000))}
        </span>
      </p>
      {next.setupMinutes > 0 ? (
        <p className="mt-4 rounded-full bg-prep-soft px-4 py-2 text-center font-semibold text-prep">
          Start setting up at {formatTime(next.blockedStart, timezone)}
        </p>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * One session
 * ------------------------------------------------------------------------ */

function SessionCard({
  session,
  timezone,
  now,
  isLive,
  isSettingUp,
  isResetting,
}: {
  session: SessionView;
  timezone: string;
  now: Date;
  isLive: boolean;
  isSettingUp: boolean;
  isResetting: boolean;
}) {
  const past = isPast(session, now);
  const cancelled = session.status === "cancelled";
  const durationMinutes = Math.round(
    (session.endsAt.getTime() - session.startsAt.getTime()) / 60_000,
  );

  return (
    <article
      className={cx(
        "card overflow-hidden transition-opacity",
        isLive ? "ring-2 ring-accent" : null,
        past && !cancelled ? "opacity-60 hover:opacity-100" : null,
        cancelled ? "opacity-50" : null,
      )}
    >
      {session.setupMinutes > 0 ? (
        <BufferBar
          label="Set up the room"
          from={session.blockedStart}
          to={session.startsAt}
          minutes={session.setupMinutes}
          timezone={timezone}
          active={isSettingUp}
        />
      ) : null}

      <div className="grid gap-x-6 gap-y-5 px-6 py-6 sm:grid-cols-[132px_minmax(0,1fr)] sm:px-7">
        {/* When */}
        <div>
          <div className="timecode text-3xl">{formatTime(session.startsAt, timezone)}</div>
          <div className="text-muted">to {formatTime(session.endsAt, timezone)}</div>
          <div className="mt-2 inline-block rounded-full bg-sand px-3 py-1 text-[0.9375rem] font-semibold text-muted">
            {formatDuration(durationMinutes)}
          </div>
        </div>

        {/* What */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <h3 className="display text-2xl sm:text-3xl">
                <Link href={`/bookings/${session.id}`} className="underline-offset-4 hover:underline">
                  {session.title}
                </Link>
              </h3>
              <p className="mt-1 text-muted">
                {[
                  session.clientName,
                  BOOKING_TYPE_LABEL[session.bookingType as BookingType],
                  BOOKING_KIND_LABEL[session.kind as BookingKind],
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <StatusChip
                label={BOOKING_STATUS_LABEL[session.status]}
                tone={STATUS_TONE[session.status]}
              />
              {session.setName ? (
                <span className="font-semibold text-ink">{session.setName}</span>
              ) : (
                <span className="text-muted">No set chosen</span>
              )}
            </div>
          </div>

          <SetupRecipe setup={session.setup} size="sm" className="mt-5" />

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted">
              {[
                `${session.attendeeCount} ${session.attendeeCount === 1 ? "person" : "people"}`,
                session.microphoneCount > 0 ? `${session.microphoneCount} mics` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <StatusAction bookingId={session.id} status={session.status} />
          </div>
        </div>
      </div>

      {session.resetMinutes > 0 ? (
        <BufferBar
          label="Reset the room"
          from={session.endsAt}
          to={session.blockedEnd}
          minutes={session.resetMinutes}
          timezone={timezone}
          active={isResetting}
        />
      ) : null}
    </article>
  );
}

/** Buffers look calm and clearly unlike a session — the room is held, not booked. */
function BufferBar({
  label,
  from,
  to,
  minutes,
  timezone,
  active,
}: {
  label: string;
  from: Date;
  to: Date;
  minutes: number;
  timezone: string;
  active: boolean;
}) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-x-3 gap-y-1 px-6 py-3 sm:px-7",
        active ? "bg-prep-soft text-prep" : "bg-sand text-muted",
      )}
    >
      <span className="font-semibold">{label}</span>
      <span>
        {formatTime(from, timezone)} – {formatTime(to, timezone)} · {formatDuration(minutes)}
      </span>
    </div>
  );
}
