import { instantFromLocalParts } from "./time";

export type CalendarView = "day" | "week" | "month";

/**
 * Calendar arithmetic is done on `YYYY-MM-DD` keys anchored at UTC midday, so
 * adding a day never lands on a daylight-saving seam. Keys are converted to
 * real instants only at the edges.
 */

export function isValidDateKey(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)));
}

export function addDaysToKey(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonthsToKey(key: string, months: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  const targetMonth = d.getUTCMonth() + months;
  const firstOfTarget = new Date(Date.UTC(d.getUTCFullYear(), targetMonth, 1, 12));
  // Clamp so 31 Jan + 1 month lands on 28/29 Feb rather than spilling into March.
  const daysInTarget = new Date(
    Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0, 12),
  ).getUTCDate();
  firstOfTarget.setUTCDate(Math.min(d.getUTCDate(), daysInTarget));
  return firstOfTarget.toISOString().slice(0, 10);
}

/** 0 = Sunday. The studio week runs Sunday to Saturday. */
export function weekdayOfKey(key: string): number {
  return new Date(`${key}T12:00:00Z`).getUTCDay();
}

export function startOfWeekKey(key: string): string {
  return addDaysToKey(key, -weekdayOfKey(key));
}

export function startOfMonthKey(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

export function monthIndexOfKey(key: string): number {
  return Number(key.slice(5, 7)) - 1;
}

/** The day keys a view covers, and the instants bounding them. */
export function calendarRange(view: CalendarView, anchor: string, timezone: string) {
  let dayKeys: string[];

  if (view === "day") {
    dayKeys = [anchor];
  } else if (view === "week") {
    const start = startOfWeekKey(anchor);
    dayKeys = Array.from({ length: 7 }, (_, i) => addDaysToKey(start, i));
  } else {
    const gridStart = startOfWeekKey(startOfMonthKey(anchor));
    const nextMonth = startOfMonthKey(addMonthsToKey(startOfMonthKey(anchor), 1));
    // Whole weeks until the grid has passed the end of the month.
    const total = Math.ceil(
      (Date.parse(`${nextMonth}T12:00:00Z`) - Date.parse(`${gridStart}T12:00:00Z`)) / 86_400_000 / 7,
    ) * 7;
    dayKeys = Array.from({ length: total }, (_, i) => addDaysToKey(gridStart, i));
  }

  return {
    dayKeys,
    days: dayKeys.map((key) => instantFromLocalParts(key, "00:00", timezone)),
    rangeStart: instantFromLocalParts(dayKeys[0], "00:00", timezone),
    rangeEnd: instantFromLocalParts(addDaysToKey(dayKeys[dayKeys.length - 1], 1), "00:00", timezone),
  };
}

/** Chunks a flat list of days into weeks of seven for the month grid. */
export function chunkWeeks<T>(days: T[]): T[][] {
  const weeks: T[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

export function stepKey(view: CalendarView, key: string, direction: -1 | 1): string {
  if (view === "day") return addDaysToKey(key, direction);
  if (view === "week") return addDaysToKey(key, 7 * direction);
  return addMonthsToKey(startOfMonthKey(key), direction);
}
