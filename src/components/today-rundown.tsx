"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  BOOKING_KIND_LABEL,
  BOOKING_STATUS_LABEL,
  BOOKING_TYPE_LABEL,
  isLiveStatus,
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
 * The day, read top to bottom like a rundown. The clock ticks client-side so
 * the "now" marker stays honest on a screen left up all day in the studio.
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
  const next = nextSession(sessions, now);
  const clearUntil = freeUntil(sessions, now);

  return (
    <>
      <RoomBand
        state={state}
        next={next}
        clearUntil={clearUntil}
        timezone={timezone}
        now={now}
        hasSessions={sessions.length > 0}
      />

      {sessions.length === 0 ? (
        <EmptyState
          headline="Nothing booked today."
          body="The studio is clear. Anything scheduled will appear here in order, with its setup and reset windows."
          action={
            <Link href="/bookings/new" className={buttonClass("primary")}>
              New booking
            </Link>
          }
        />
      ) : (
        <section aria-label="Today's sessions" className="mt-12">
          {sessions.map((session) => (
            <SessionBlock
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
 * The dark band: what is happening now, and what is next
 * ------------------------------------------------------------------------ */

function RoomBand({
  state,
  next,
  clearUntil,
  timezone,
  now,
  hasSessions,
}: {
  state: RoomState;
  next: SessionView | null;
  clearUntil: Date | null;
  timezone: string;
  now: Date;
  hasSessions: boolean;
}) {
  const live = state.phase === "live";

  return (
    <div className="mt-8 grid gap-px bg-ink-line md:grid-cols-[1.6fr_1fr]">
      <div className="relative bg-ink px-6 py-7 sm:px-8">
        {live ? <span className="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden /> : null}

        {state.phase === "live" ? (
          <>
            <div className="flex items-center gap-2">
              <span className="tally size-2 rounded-full bg-accent" aria-hidden />
              <span className="eyebrow text-accent">On air now</span>
            </div>
            <BandTitle session={state.session} />
            <p className="timecode mt-3 text-sm text-ink-muted">
              {formatTimeRange(state.session.startsAt, state.session.endsAt, timezone)}
              <span className="mx-2 text-ink-line">/</span>
              {formatDuration(state.minutesRemaining)} remaining
            </p>
          </>
        ) : state.phase === "setup" ? (
          <>
            <span className="eyebrow text-white">Setting up</span>
            <BandTitle session={state.session} />
            <p className="timecode mt-3 text-sm text-ink-muted">
              Doors at {formatTime(state.session.startsAt, timezone)}
              <span className="mx-2 text-ink-line">/</span>
              {relativeLead(state.minutesUntilStart)}
            </p>
          </>
        ) : state.phase === "reset" ? (
          <>
            <span className="eyebrow text-white">Resetting the room</span>
            <BandTitle session={state.session} />
            <p className="timecode mt-3 text-sm text-ink-muted">
              Clear by {formatTime(state.session.blockedEnd, timezone)}
              <span className="mx-2 text-ink-line">/</span>
              {formatDuration(state.minutesRemaining)} left
            </p>
          </>
        ) : (
          <>
            <span className="eyebrow text-ink-muted">Room status</span>
            <p className="display mt-4 text-4xl text-white sm:text-5xl">The room is clear.</p>
            <p className="timecode mt-3 text-sm text-ink-muted">
              {clearUntil
                ? `Free until ${formatTime(clearUntil, timezone)}`
                : hasSessions
                  ? "Nothing further today"
                  : "No sessions booked today"}
            </p>
          </>
        )}
      </div>

      <div className="bg-ink px-6 py-7 sm:px-8">
        <span className="eyebrow text-ink-muted">Next</span>
        {next ? (
          <>
            <Link
              href={`/bookings/${next.id}`}
              className="display mt-4 block text-2xl text-white underline-offset-4 hover:underline sm:text-3xl"
            >
              {next.title}
            </Link>
            <p className="timecode mt-3 text-sm text-ink-muted">
              {formatTime(next.startsAt, timezone)}
              <span className="mx-2 text-ink-line">/</span>
              {relativeLead(Math.round((next.startsAt.getTime() - now.getTime()) / 60_000))}
            </p>
            {next.setupMinutes > 0 ? (
              <p className="eyebrow mt-4 text-ink-muted">
                Setup from {formatTime(next.blockedStart, timezone)}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-4 text-sm text-ink-muted">Nothing else on the schedule today.</p>
        )}
      </div>
    </div>
  );
}

function BandTitle({ session }: { session: SessionView }) {
  return (
    <Link
      href={`/bookings/${session.id}`}
      className="display mt-4 block text-4xl text-white underline-offset-4 hover:underline sm:text-5xl"
    >
      {session.title}
    </Link>
  );
}

/* ---------------------------------------------------------------------------
 * One session, with its setup and reset windows
 * ------------------------------------------------------------------------ */

function SessionBlock({
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

  return (
    <div
      className={cx(
        "relative transition-opacity",
        past && !cancelled ? "opacity-45 hover:opacity-100" : null,
        cancelled ? "opacity-40" : null,
      )}
    >
      {session.setupMinutes > 0 ? (
        <BufferStrip
          label="Setup"
          from={session.blockedStart}
          to={session.startsAt}
          minutes={session.setupMinutes}
          timezone={timezone}
          active={isSettingUp}
        />
      ) : null}

      <article
        className={cx(
          "grid grid-cols-[76px_1fr] gap-x-4 border-t py-6 sm:grid-cols-[132px_1fr] sm:gap-x-8",
          isLive ? "border-accent" : "border-line",
        )}
      >
        {isLive ? (
          <span className="absolute left-0 w-[3px] bg-accent" style={{ height: "1px" }} aria-hidden />
        ) : null}

        <div>
          <div
            className={cx(
              "timecode text-lg font-medium sm:text-2xl",
              isLive ? "text-accent-ink" : "text-ink",
            )}
          >
            {formatTime(session.startsAt, timezone)}
          </div>
          <div className="timecode text-sm text-muted">{formatTime(session.endsAt, timezone)}</div>
          <div className="eyebrow mt-3 text-muted">
            {formatDuration(Math.round((session.endsAt.getTime() - session.startsAt.getTime()) / 60_000))}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <h3 className="display text-2xl sm:text-3xl">
                <Link
                  href={`/bookings/${session.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {session.title}
                </Link>
              </h3>
              <p className="mt-1.5 text-sm text-muted">
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
              {session.setName ? (
                <span className="eyebrow text-ink">{session.setName}</span>
              ) : (
                <span className="eyebrow text-muted">No set chosen</span>
              )}
              <StatusChip
                label={BOOKING_STATUS_LABEL[session.status]}
                live={isLiveStatus(session.status)}
                muted={session.status === "upcoming" || cancelled}
              />
            </div>
          </div>

          <SetupRecipe setup={session.setup} className="mt-5" />

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {[
                `${session.attendeeCount} ${session.attendeeCount === 1 ? "attendee" : "attendees"}`,
                session.microphoneCount > 0 ? `${session.microphoneCount} mics` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <StatusAction bookingId={session.id} status={session.status} />
          </div>
        </div>
      </article>

      {session.resetMinutes > 0 ? (
        <BufferStrip
          label="Reset"
          from={session.endsAt}
          to={session.blockedEnd}
          minutes={session.resetMinutes}
          timezone={timezone}
          active={isResetting}
        />
      ) : null}
    </div>
  );
}

/**
 * Buffers look deliberately unlike bookings: sunk, quiet, and labelled — they
 * hold the room without pretending to be a session.
 */
function BufferStrip({
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
        "grid grid-cols-[76px_1fr] items-center gap-x-4 py-2 sm:grid-cols-[132px_1fr] sm:gap-x-8",
        active ? "bg-accent-wash" : "bg-paper-sunk",
      )}
    >
      <span className="timecode text-[0.8125rem] text-muted">{formatTime(from, timezone)}</span>
      <span className="eyebrow text-muted">
        {label} · {formatDuration(minutes)} · until {formatTime(to, timezone)}
      </span>
    </div>
  );
}
