import "server-only";

import { cache } from "react";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { studioSettings } from "@/db/schema";
import type { BookingKind } from "@/lib/domain";
import { DEFAULT_TIMEZONE } from "@/lib/time";

export type StudioSettings = typeof studioSettings.$inferSelect;

const FALLBACK: StudioSettings = {
  id: 1,
  studioName: "Studio 954",
  timezone: DEFAULT_TIMEZONE,
  addressLine1: null,
  addressLine2: null,
  city: null,
  region: null,
  postalCode: null,
  contactEmail: null,
  logoUrl: null,
  arrivalInstructions: null,
  externalSetupMinutes: 30,
  externalResetMinutes: 30,
  internalSetupMinutes: 15,
  internalResetMinutes: 15,
  notifyConfirmation: true,
  notifyReminder24h: true,
  notifyReminderSameDay: true,
  sameDayReminderLeadMinutes: 120,
  notifyInternalTeam: false,
  internalNotificationEmail: null,
  updatedAt: new Date(),
};

/**
 * The studio's own configuration. Falls back to sane defaults so the app still
 * renders on a database that has not been seeded yet.
 */
export const getStudioSettings = cache(async (): Promise<StudioSettings> => {
  const rows = await db.select().from(studioSettings).where(eq(studioSettings.id, 1)).limit(1);
  return rows[0] ?? FALLBACK;
});

/** The studio timezone — every date on screen is rendered through this. */
export async function getTimezone(): Promise<string> {
  return (await getStudioSettings()).timezone;
}

/** Internal shoots turn the room around faster than paid rentals. */
export function defaultBuffers(settings: StudioSettings, kind: BookingKind) {
  // Members are outside clients too — they arrive with their own people and
  // gear, so they get the rental turnaround rather than the internal one.
  return kind === "internal"
    ? { setupMinutes: settings.internalSetupMinutes, resetMinutes: settings.internalResetMinutes }
    : { setupMinutes: settings.externalSetupMinutes, resetMinutes: settings.externalResetMinutes };
}

export function formatStudioAddress(settings: StudioSettings): string | null {
  const street = [settings.addressLine1, settings.addressLine2].filter(Boolean).join(", ");
  const locality = [settings.city, settings.region].filter(Boolean).join(", ");
  const full = [street, locality, settings.postalCode].filter(Boolean).join(" · ");
  return full || null;
}
