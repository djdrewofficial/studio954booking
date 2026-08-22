"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { setupOneLine } from "@/components/setup-recipe";
import { cx } from "@/components/ui";
import type { SessionView } from "@/lib/schedule";
import { dayKey, formatTime, minutesIntoDay } from "@/lib/time";

const SLOT_MINUTES = 15;
const PIXELS_PER_HOUR = 60;

/**
 * The day and week views share one grid. Sessions are drawn as solid blocks;
 * their setup and reset buffers are drawn as a quieter band behind them, so a
 * glance shows both when the client is in the room and when the room is
 * actually unavailable.
 */
export function TimeGrid({
  days,
  sessions,
  timezone,
  dense,
}: {
  days: Date[];
  sessions: SessionView[];
  timezone: string;
  /** Week view packs more columns and hides the recipe line. */
  dense: boolean;
}) {
  const [now, setNow] = useState<Date | null>(null);

  // The clock only exists on the client; the first tick is deferred so the
  // server and client markup match on hydration.
  useEffect(() => {
    const tick = () => setNow(new Date());
    const initial = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, []);

  // Show 7am–10pm by default, widening to fit anything booked outside it.
  const { startHour, endHour } = useMemo(() => {
    let start = 7;
    let end = 22;
    for (const s of sessions) {
      start = Math.min(start, Math.floor(minutesIntoDay(s.blockedStart, timezone) / 60));
      const endMinutes = minutesIntoDay(s.blockedEnd, timezone);
      end = Math.max(end, Math.ceil((endMinutes === 0 ? 1440 : endMinutes) / 60));
    }
    return { startHour: Math.max(0, start), endHour: Math.min(24, Math.max(end, start + 6)) };
  }, [sessions, timezone]);

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const gridHeight = hours.length * PIXELS_PER_HOUR;
  const windowStartMinutes = startHour * 60;

  const byDay = useMemo(() => {
    const map = new Map<string, SessionView[]>();
    for (const s of sessions) {
      const key = dayKey(s.startsAt, timezone);
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return map;
  }, [sessions, timezone]);

  return (
    <div className="mt-6 overflow-x-auto">
      <div className={cx("min-w-full", dense ? "min-w-[720px]" : "")}>
        {/* Day headings */}
        <div
          className="grid border-b border-line"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}
        >
          <div />
          {days.map((day) => {
            const isToday = now ? dayKey(day, timezone) === dayKey(now, timezone) : false;
            return (
              <div key={day.toISOString()} className="border-l border-line px-3 py-3">
                <div className={cx("eyebrow", isToday ? "text-accent-ink" : "text-muted")}>
                  {new Intl.DateTimeFormat("en-US", {
                    weekday: "short",
                    timeZone: timezone,
                  }).format(day)}
                </div>
                <div className={cx("display mt-1 text-2xl", isToday ? "text-ink" : "text-muted")}>
                  {new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: timezone }).format(
                    day,
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}
        >
          {/* Hour gutter */}
          <div style={{ height: gridHeight }}>
            {hours.map((hour, i) => (
              <div
                key={hour}
                className="relative"
                style={{ height: PIXELS_PER_HOUR }}
                aria-hidden={i === 0 ? undefined : true}
              >
                <span className="timecode absolute -top-2 right-2 text-[0.6875rem] text-muted">
                  {hour === 0
                    ? "12 AM"
                    : hour < 12
                      ? `${hour} AM`
                      : hour === 12
                        ? "12 PM"
                        : `${hour - 12} PM`}
                </span>
              </div>
            ))}
          </div>

          {days.map((day) => (
            <DayColumn
              key={day.toISOString()}
              day={day}
              sessions={byDay.get(dayKey(day, timezone)) ?? []}
              timezone={timezone}
              hours={hours}
              gridHeight={gridHeight}
              windowStartMinutes={windowStartMinutes}
              now={now}
              dense={dense}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  day,
  sessions,
  timezone,
  hours,
  gridHeight,
  windowStartMinutes,
  now,
  dense,
}: {
  day: Date;
  sessions: SessionView[];
  timezone: string;
  hours: number[];
  gridHeight: number;
  windowStartMinutes: number;
  now: Date | null;
  dense: boolean;
}) {
  const columnRef = useRef<HTMLDivElement>(null);
  const isToday = now ? dayKey(day, timezone) === dayKey(now, timezone) : false;
  const totalMinutes = hours.length * 60;

  const offset = (date: Date) =>
    ((minutesIntoDay(date, timezone) - windowStartMinutes) / totalMinutes) * gridHeight;

  /** Turns a click in empty space into a pre-filled new booking. */
  function newBookingHref(event: React.MouseEvent<HTMLDivElement>): string {
    const rect = columnRef.current?.getBoundingClientRect();
    if (!rect) return "/bookings/new";
    const y = event.clientY - rect.top;
    const raw = windowStartMinutes + (y / gridHeight) * totalMinutes;
    const snapped = Math.max(0, Math.min(23 * 60 + 45, Math.round(raw / SLOT_MINUTES) * SLOT_MINUTES));
    const time = `${String(Math.floor(snapped / 60)).padStart(2, "0")}:${String(snapped % 60).padStart(2, "0")}`;
    return `/bookings/new?date=${dayKey(day, timezone)}&time=${time}`;
  }

  return (
    <div
      ref={columnRef}
      className="relative border-l border-line"
      style={{ height: gridHeight }}
      onClick={(event) => {
        // Only bare grid clicks create; clicks on a session bubble out first.
        if (event.target !== event.currentTarget) return;
        window.location.href = newBookingHref(event);
      }}
      role="presentation"
    >
      {hours.map((hour) => (
        <div
          key={hour}
          className="pointer-events-none border-t border-line/70"
          style={{ height: PIXELS_PER_HOUR }}
          aria-hidden
        />
      ))}

      {isToday && now ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
          style={{ top: offset(now) }}
          aria-hidden
        >
          <span className="size-2 -translate-x-1 rounded-full bg-accent" />
          <span className="h-px flex-1 bg-accent" />
        </div>
      ) : null}

      {sessions.map((session) => {
        const blockedTop = offset(session.blockedStart);
        const blockedHeight = Math.max(
          offset(session.blockedEnd) - blockedTop,
          16,
        );
        const sessionTop = offset(session.startsAt);
        const sessionHeight = Math.max(offset(session.endsAt) - sessionTop, 22);
        const isLive = session.status === "in_session";
        const isExternal = session.kind === "external";
        const cancelled = session.status === "cancelled";
        const recipe = setupOneLine(session.setup);

        return (
          <div key={session.id} className="absolute inset-x-1 z-10">
            {/* Buffer band — the room is held, but nobody is shooting. */}
            {blockedHeight > sessionHeight ? (
              <div
                className="absolute inset-x-0 rounded-sm border border-line bg-paper-sunk"
                style={{ top: blockedTop, height: blockedHeight }}
                title={`Held from ${formatTime(session.blockedStart, timezone)} to ${formatTime(
                  session.blockedEnd,
                  timezone,
                )}`}
                aria-hidden
              />
            ) : null}

            <Link
              href={`/bookings/${session.id}`}
              className={cx(
                "absolute inset-x-0 flex flex-col overflow-hidden rounded-sm border px-2 py-1.5 transition-shadow hover:shadow-md",
                cancelled
                  ? "border-line bg-white text-muted line-through opacity-60"
                  : isExternal
                    ? "border-ink bg-ink text-white"
                    : "border-line-strong bg-white text-ink",
                isLive ? "border-l-[3px] border-l-accent" : null,
              )}
              style={{ top: sessionTop, height: sessionHeight }}
            >
              <span className="timecode text-[0.6875rem] opacity-80">
                {formatTime(session.startsAt, timezone)}
              </span>
              <span className="truncate text-[0.8125rem] font-semibold leading-tight">
                {session.title}
              </span>
              {sessionHeight > 60 ? (
                <span className="truncate text-[0.75rem] opacity-75">
                  {[session.clientName, session.setName].filter(Boolean).join(" · ")}
                </span>
              ) : null}
              {!dense && sessionHeight > 90 && recipe ? (
                <span className="mt-1 line-clamp-2 text-[0.75rem] opacity-60">{recipe}</span>
              ) : null}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
