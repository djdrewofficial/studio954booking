"use client";

import Link from "next/link";

import { cx } from "@/components/ui";
import type { SessionView } from "@/lib/schedule";
import { dayKey, formatTime } from "@/lib/time";

/**
 * The month is a planning view, not an operational one: enough to see shape
 * and density, with the detail one click away.
 */
export function MonthGrid({
  weeks,
  sessions,
  timezone,
  focusMonth,
  today,
}: {
  weeks: Date[][];
  sessions: SessionView[];
  timezone: string;
  /** Days outside this month are dimmed. */
  focusMonth: number;
  today: string;
}) {
  const byDay = new Map<string, SessionView[]>();
  for (const s of sessions) {
    const key = dayKey(s.startsAt, timezone);
    byDay.set(key, [...(byDay.get(key) ?? []), s]);
  }

  return (
    <div className="mt-6 border-t border-line">
      <div className="grid grid-cols-7">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <div key={label} className="border-b border-line px-3 py-2">
            <span className="eyebrow text-muted">{label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {weeks.flat().map((day) => {
          const key = dayKey(day, timezone);
          const daySessions = byDay.get(key) ?? [];
          const inMonth =
            Number(
              new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: timezone }).format(day),
            ) ===
            focusMonth + 1;
          const isToday = key === today;

          return (
            <div
              key={key}
              className={cx(
                "min-h-28 border-b border-l border-line p-2 transition-colors first:border-l-0 sm:min-h-32",
                inMonth ? "bg-paper" : "bg-paper-sunk/40",
              )}
            >
              <div className="flex items-baseline justify-between">
                <Link
                  href={`/calendar?view=day&date=${key}`}
                  className={cx(
                    "timecode text-sm underline-offset-4 hover:underline",
                    isToday
                      ? "font-semibold text-accent-ink"
                      : inMonth
                        ? "text-ink"
                        : "text-line-strong",
                  )}
                >
                  {new Intl.DateTimeFormat("en-US", {
                    day: "numeric",
                    timeZone: timezone,
                  }).format(day)}
                </Link>
                {daySessions.length > 2 ? (
                  <span className="eyebrow text-line-strong">{daySessions.length}</span>
                ) : null}
              </div>

              <ul className="mt-1.5 space-y-1">
                {daySessions.slice(0, 3).map((session) => (
                  <li key={session.id}>
                    <Link
                      href={`/bookings/${session.id}`}
                      className={cx(
                        "block truncate rounded-[2px] px-1.5 py-1 text-[0.75rem] leading-tight transition-colors",
                        session.status === "cancelled"
                          ? "text-line-strong line-through"
                          : session.kind === "external"
                            ? "bg-ink text-white"
                            : "bg-white text-ink ring-1 ring-line",
                      )}
                    >
                      <span className="timecode mr-1.5 opacity-70">
                        {formatTime(session.startsAt, timezone)}
                      </span>
                      {session.title}
                    </Link>
                  </li>
                ))}
                {daySessions.length > 3 ? (
                  <li>
                    <Link
                      href={`/calendar?view=day&date=${key}`}
                      className="eyebrow block px-1.5 text-muted hover:text-ink"
                    >
                      +{daySessions.length - 3} more
                    </Link>
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
