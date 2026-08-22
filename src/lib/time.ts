import { TZDate } from "@date-fns/tz";
import { addDays, addMinutes, differenceInMinutes, startOfWeek } from "date-fns";

/**
 * Every timestamp in Studio 954 is stored as an absolute instant (timestamptz)
 * and rendered in the studio's own timezone. Nothing in the UI should ever call
 * `toLocaleString` directly — the person looking at the iPad in the studio and
 * the person looking from a laptop elsewhere must see the same clock time.
 */

export const DEFAULT_TIMEZONE = "America/New_York";

function zoned(date: Date, tz: string): TZDate {
  return new TZDate(date, tz);
}

/** Builds the absolute instant for a wall-clock date + time in the studio's timezone. */
export function instantFromLocalParts(
  isoDate: string,
  time: string,
  tz: string,
): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) {
    throw new Error(`Unparseable date/time: ${isoDate} ${time}`);
  }
  return new Date(
    new TZDate(year, month - 1, day, hour, minute, 0, tz).getTime(),
  );
}

/** "2026-08-22" in the studio's timezone — the canonical key for a studio day. */
export function dayKey(date: Date, tz: string): string {
  const z = zoned(date, tz);
  const m = `${z.getMonth() + 1}`.padStart(2, "0");
  const d = `${z.getDate()}`.padStart(2, "0");
  return `${z.getFullYear()}-${m}-${d}`;
}

/** "10:00" — for prefilling `<input type="time">`. */
export function timeValue(date: Date, tz: string): string {
  const z = zoned(date, tz);
  return `${`${z.getHours()}`.padStart(2, "0")}:${`${z.getMinutes()}`.padStart(2, "0")}`;
}

export function startOfDayInTz(date: Date, tz: string): Date {
  return instantFromLocalParts(dayKey(date, tz), "00:00", tz);
}

export function endOfDayInTz(date: Date, tz: string): Date {
  return addDays(startOfDayInTz(date, tz), 1);
}

/** Weeks run Sunday to Saturday, matching how the studio schedules. */
export function startOfWeekInTz(date: Date, tz: string): Date {
  const z = zoned(date, tz);
  const weekStart = startOfWeek(z, { weekStartsOn: 0 });
  return instantFromLocalParts(
    `${weekStart.getFullYear()}-${`${weekStart.getMonth() + 1}`.padStart(2, "0")}-${`${weekStart.getDate()}`.padStart(2, "0")}`,
    "00:00",
    tz,
  );
}

/** Minutes elapsed since midnight in the studio's timezone — drives calendar layout. */
export function minutesIntoDay(date: Date, tz: string): number {
  const z = zoned(date, tz);
  return z.getHours() * 60 + z.getMinutes();
}

export function hourOfDay(date: Date, tz: string): number {
  return zoned(date, tz).getHours();
}

/* ---------------------------------------------------------------------------
 * Formatting
 * ------------------------------------------------------------------------ */

function parts(date: Date, tz: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz }).format(date);
}

/** "10:00 AM" */
export function formatTime(date: Date, tz: string): string {
  return parts(date, tz, { hour: "numeric", minute: "2-digit" });
}

/** "10:00 AM – 12:00 PM" */
export function formatTimeRange(start: Date, end: Date, tz: string): string {
  return `${formatTime(start, tz)} – ${formatTime(end, tz)}`;
}

/** "Saturday, August 22" */
export function formatDayLong(date: Date, tz: string): string {
  return parts(date, tz, { weekday: "long", month: "long", day: "numeric" });
}

/** "Sat Aug 22" */
export function formatDayShort(date: Date, tz: string): string {
  return parts(date, tz, { weekday: "short", month: "short", day: "numeric" });
}

/** "Aug 22, 2026" */
export function formatDate(date: Date, tz: string): string {
  return parts(date, tz, { month: "short", day: "numeric", year: "numeric" });
}

/** "August 2026" */
export function formatMonthYear(date: Date, tz: string): string {
  return parts(date, tz, { month: "long", year: "numeric" });
}

/** "2 hr 30 min" — never "2.5 hours". */
export function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

export function durationMinutes(start: Date, end: Date): number {
  return differenceInMinutes(end, start);
}

/** The window the studio is actually occupied, buffers included. */
export function blockedWindow(booking: {
  startsAt: Date;
  endsAt: Date;
  setupMinutes: number;
  resetMinutes: number;
}) {
  return {
    start: addMinutes(booking.startsAt, -booking.setupMinutes),
    end: addMinutes(booking.endsAt, booking.resetMinutes),
  };
}

/** Rounds up to the next quarter hour — used for smart default booking times. */
export function ceilToQuarterHour(date: Date): Date {
  const ms = 15 * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

export { addDays, addMinutes };
