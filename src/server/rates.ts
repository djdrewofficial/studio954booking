import "server-only";

import { asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { addons, bookingAddons, bookingTypeRates } from "@/db/schema";
import type { BookingKind, BookingType } from "@/lib/domain";
import { BOOKING_TYPES } from "@/lib/domain";
import type { Quote, Rate } from "@/lib/pricing";
import { quoteFor } from "@/lib/pricing";

export type BookingTypeRate = typeof bookingTypeRates.$inferSelect;

/**
 * The rate card, always complete: a booking type with no row yet reads as
 * zero rather than going missing, so the settings screen can list every type
 * and a new type never breaks a quote.
 */
export async function listRates(): Promise<BookingTypeRate[]> {
  const rows = await db.select().from(bookingTypeRates).orderBy(asc(bookingTypeRates.bookingType));
  const byType = new Map(rows.map((row) => [row.bookingType, row]));

  return BOOKING_TYPES.map(
    (type) =>
      byType.get(type) ?? {
        bookingType: type,
        baseCents: 0,
        hourlyCents: 0,
        updatedAt: new Date(),
      },
  );
}

export async function getRate(bookingType: BookingType): Promise<Rate> {
  const rows = await db
    .select()
    .from(bookingTypeRates)
    .where(eq(bookingTypeRates.bookingType, bookingType))
    .limit(1);

  const row = rows[0];
  return {
    bookingType,
    baseCents: row?.baseCents ?? 0,
    hourlyCents: row?.hourlyCents ?? 0,
  };
}

/** What the chosen add-ons come to, at today's prices. */
export async function addonTotalCents(
  chosen: readonly { addonId: string; quantity: number }[],
): Promise<number> {
  if (chosen.length === 0) return 0;

  const rows = await db
    .select({ id: addons.id, priceCents: addons.priceCents })
    .from(addons)
    .where(
      inArray(
        addons.id,
        chosen.map((c) => c.addonId),
      ),
    );

  const priceById = new Map(rows.map((row) => [row.id, row.priceCents]));
  return chosen.reduce(
    (total, item) => total + (priceById.get(item.addonId) ?? 0) * item.quantity,
    0,
  );
}

/** What a saved booking's add-ons came to, at the prices captured that day. */
export async function savedAddonTotalCents(bookingId: string): Promise<number> {
  const rows = await db
    .select({
      quantity: bookingAddons.quantity,
      priceCents: bookingAddons.priceCentsAtBooking,
    })
    .from(bookingAddons)
    .where(eq(bookingAddons.bookingId, bookingId));

  return rows.reduce((total, row) => total + row.priceCents * row.quantity, 0);
}

/**
 * Prices one booking against the current rate card.
 *
 * Callers store the resulting total on the booking so later edits to the card
 * never rewrite an existing quote — the same reason `booking_addons` keeps its
 * own `price_cents_at_booking`.
 */
export async function quoteBooking(input: {
  kind: BookingKind;
  bookingType: BookingType;
  minutes: number;
  addonCents?: number;
}): Promise<Quote> {
  return quoteFor(input, await getRate(input.bookingType));
}
