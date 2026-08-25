/**
 * What a booking costs.
 *
 * Only external rentals are priced: internal work is the studio's own time,
 * and a membership session is already paid for by the plan (anything past the
 * allowance is settled separately rather than silently invoiced here).
 *
 * A quote is base + hourly + add-ons. Our technician and our equipment are
 * always part of an external rental, whether or not the client uses them, so
 * they never appear as a surcharge — the ours/theirs choice on a booking says
 * how to prepare the room, not what to charge.
 *
 * The result is itemised rather than a single number, so the booking screen
 * can show exactly where the figure comes from.
 *
 * Pure module — the caller supplies the rate card.
 */

import type { BookingKind, BookingType } from "./domain";
import { isBillableKind } from "./domain";

export type Rate = {
  bookingType: BookingType;
  baseCents: number;
  hourlyCents: number;
};

export type QuoteInput = {
  kind: BookingKind;
  bookingType: BookingType;
  /** Session length excluding buffers — nobody pays for turnaround. */
  minutes: number;
  addonCents?: number;
};

export type QuoteLine = { label: string; detail: string | null; cents: number };
export type Quote = { lines: QuoteLine[]; totalCents: number; billable: boolean };

/**
 * Builds an itemised quote. Returns an empty, non-billable quote for internal
 * and membership bookings so callers never have to special-case them.
 */
export function quoteFor(input: QuoteInput, rate: Rate | undefined): Quote {
  if (!isBillableKind(input.kind)) {
    return { lines: [], totalCents: 0, billable: false };
  }

  const lines: QuoteLine[] = [];
  const hours = input.minutes / 60;

  if (rate?.baseCents) {
    lines.push({ label: "Session", detail: null, cents: rate.baseCents });
  }

  if (rate?.hourlyCents) {
    lines.push({
      label: "Studio time",
      detail: `${formatHours(hours)} × ${formatMoney(rate.hourlyCents)}`,
      cents: Math.round(hours * rate.hourlyCents),
    });
  }

  if (input.addonCents) {
    lines.push({ label: "Add-ons", detail: null, cents: input.addonCents });
  }

  return {
    lines,
    totalCents: lines.reduce((total, line) => total + line.cents, 0),
    billable: true,
  };
}

/** "$1,250.00" — whole dollars drop the cents, which is how a rate card reads. */
export function formatMoney(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0
    ? `$${dollars.toLocaleString("en-US")}`
    : `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Accepts "1250", "$1,250", "1250.00" and returns cents. */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

function formatHours(hours: number): string {
  const rounded = Math.round(hours * 100) / 100;
  return rounded === 1 ? "1 hr" : `${rounded} hr`;
}
