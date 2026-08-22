import "server-only";

import { eq } from "drizzle-orm";
import type { calendar_v3 } from "googleapis";

import { db } from "@/db";
import { bookings, calendarIntegrations } from "@/db/schema";
import { BOOKING_KIND_LABEL, BOOKING_TYPE_LABEL, type BookingKind, type BookingType } from "@/lib/domain";
import { formatDuration, formatTime } from "@/lib/time";
import { getBookingDetail } from "@/server/bookings";
import { formatStudioAddress, getStudioSettings } from "@/server/settings";

/**
 * Google Calendar sync.
 *
 * Every entry point is a no-op when credentials are absent, so the rest of the
 * product works untouched during development. Two credential styles are
 * supported:
 *
 *   1. Service account (recommended) — create one, then share the Studio 954
 *      calendar with its client email and grant "Make changes to events".
 *   2. OAuth refresh token — for syncing into a personal Google account.
 *
 * Note: a service account cannot add Google attendees without domain-wide
 * delegation. Attendees are invited through the .ics attachment on the
 * confirmation email instead, which works for every calendar app.
 */

export type CalendarStatus = {
  configured: boolean;
  calendarId: string | null;
  mode: "service_account" | "oauth" | null;
  lastSyncAt: Date | null;
  lastError: string | null;
  /** Which environment variables are still missing. */
  missing: string[];
};

const CALENDAR_ID = () => process.env.GOOGLE_CALENDAR_ID ?? null;

export function isCalendarConfigured(): boolean {
  if (!CALENDAR_ID()) return false;
  const hasServiceAccount =
    Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) &&
    Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  const hasOauth =
    Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_OAUTH_CLIENT_SECRET) &&
    Boolean(process.env.GOOGLE_OAUTH_REFRESH_TOKEN);
  return hasServiceAccount || hasOauth;
}

export function missingCalendarEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.GOOGLE_CALENDAR_ID) missing.push("GOOGLE_CALENDAR_ID");

  const hasServiceAccount =
    Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) &&
    Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  const hasOauth =
    Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_OAUTH_CLIENT_SECRET) &&
    Boolean(process.env.GOOGLE_OAUTH_REFRESH_TOKEN);

  if (!hasServiceAccount && !hasOauth) {
    missing.push(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (or the GOOGLE_OAUTH_* trio)",
    );
  }
  return missing;
}

async function getClient(): Promise<calendar_v3.Calendar | null> {
  if (!isCalendarConfigured()) return null;
  const { google } = await import("googleapis");
  const scopes = ["https://www.googleapis.com/auth/calendar.events"];

  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      // Private keys are stored with literal \n so they survive .env files.
      key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      scopes,
    });
    return google.calendar({ version: "v3", auth });
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
  return google.calendar({ version: "v3", auth });
}

/** The description doubles as a call sheet for anyone reading the event. */
function buildDescription(
  detail: NonNullable<Awaited<ReturnType<typeof getBookingDetail>>>,
  timezone: string,
): string {
  const setupAt = new Date(detail.startsAt.getTime() - detail.setupMinutes * 60_000);
  const resetUntil = new Date(detail.endsAt.getTime() + detail.resetMinutes * 60_000);

  const lines: string[] = [
    `${BOOKING_KIND_LABEL[detail.kind as BookingKind]} · ${
      BOOKING_TYPE_LABEL[detail.bookingType as BookingType] ?? "Session"
    }`,
    detail.clientName ? `Client: ${detail.clientName}` : null,
    `Organizer: ${detail.organizerName} (${detail.organizerEmail})`,
    "",
    detail.set ? `SET — ${detail.set.name}` : null,
    ...detail.setup.map((line) => `${line.categoryName}: ${line.options.map((o) => o.name).join(" + ")}`),
    detail.microphoneCount > 0 ? `Microphones: ${detail.microphoneCount}` : null,
    "",
    `Setup from ${formatTime(setupAt, timezone)} (${formatDuration(detail.setupMinutes)})`,
    `Reset until ${formatTime(resetUntil, timezone)} (${formatDuration(detail.resetMinutes)})`,
  ].filter((l): l is string => l !== null);

  if (detail.attendees.length) {
    lines.push("", "ATTENDEES");
    for (const a of detail.attendees) {
      lines.push(a.email ? `${a.name} — ${a.email}` : a.name);
    }
  }

  if (detail.notes) lines.push("", "NOTES", detail.notes);
  // Internal notes only travel to the studio's own calendar, never to guests.
  if (detail.internalNotes) lines.push("", "INTERNAL", detail.internalNotes);

  return lines.join("\n");
}

async function recordStatus(status: "connected" | "error", error?: string) {
  const calendarId = CALENDAR_ID();
  if (!calendarId) return;

  const [existing] = await db
    .select({ id: calendarIntegrations.id })
    .from(calendarIntegrations)
    .where(eq(calendarIntegrations.calendarId, calendarId))
    .limit(1);

  const values = {
    provider: "google",
    calendarId,
    status,
    lastSyncAt: new Date(),
    lastError: error ?? null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(calendarIntegrations).set(values).where(eq(calendarIntegrations.id, existing.id));
  } else {
    await db.insert(calendarIntegrations).values(values);
  }
}

/** Creates the event, or updates it in place if this booking already has one. */
export async function syncBookingToCalendar(bookingId: string): Promise<void> {
  const client = await getClient();
  if (!client) return;

  const calendarId = CALENDAR_ID()!;
  const detail = await getBookingDetail(bookingId);
  if (!detail) return;

  const settings = await getStudioSettings();

  const requestBody: calendar_v3.Schema$Event = {
    summary: detail.clientName ? `${detail.title} — ${detail.clientName}` : detail.title,
    description: buildDescription(detail, settings.timezone),
    location: formatStudioAddress(settings) ?? settings.studioName,
    start: { dateTime: detail.startsAt.toISOString(), timeZone: settings.timezone },
    end: { dateTime: detail.endsAt.toISOString(), timeZone: settings.timezone },
    status: detail.status === "cancelled" ? "cancelled" : "confirmed",
    extendedProperties: { private: { studio954BookingId: detail.id } },
  };

  try {
    if (detail.googleEventId) {
      await client.events.update({
        calendarId,
        eventId: detail.googleEventId,
        requestBody,
      });
    } else {
      const created = await client.events.insert({ calendarId, requestBody });
      if (created.data.id) {
        await db
          .update(bookings)
          .set({ googleEventId: created.data.id, googleSyncedAt: new Date() })
          .where(eq(bookings.id, bookingId));
      }
    }

    await db
      .update(bookings)
      .set({ googleSyncedAt: new Date() })
      .where(eq(bookings.id, bookingId));
    await recordStatus("connected");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Google Calendar error";
    console.error(`[studio954] calendar sync failed for ${bookingId}: ${message}`);
    await recordStatus("error", message);
  }
}

export async function removeBookingFromCalendar(bookingId: string): Promise<void> {
  const client = await getClient();
  if (!client) return;

  const [row] = await db
    .select({ googleEventId: bookings.googleEventId })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!row?.googleEventId) return;

  try {
    await client.events.delete({ calendarId: CALENDAR_ID()!, eventId: row.googleEventId });
    await db
      .update(bookings)
      .set({ googleEventId: null, googleSyncedAt: null })
      .where(eq(bookings.id, bookingId));
    await recordStatus("connected");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Google Calendar error";
    await recordStatus("error", message);
  }
}

export async function getCalendarStatus(): Promise<CalendarStatus> {
  const calendarId = CALENDAR_ID();
  const configured = isCalendarConfigured();

  const [row] = calendarId
    ? await db
        .select()
        .from(calendarIntegrations)
        .where(eq(calendarIntegrations.calendarId, calendarId))
        .limit(1)
    : [];

  return {
    configured,
    calendarId,
    mode: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
      ? "service_account"
      : process.env.GOOGLE_OAUTH_REFRESH_TOKEN
        ? "oauth"
        : null,
    lastSyncAt: row?.lastSyncAt ?? null,
    lastError: row?.lastError ?? null,
    missing: missingCalendarEnv(),
  };
}

/**
 * Reads events created directly on the studio calendar so they can block
 * availability. Returns an empty list when unconfigured. Wired into the
 * conflict checker in a later phase — the shape is settled now so nothing
 * downstream has to change.
 */
export async function fetchExternalBusyWindows(
  from: Date,
  to: Date,
): Promise<{ id: string; title: string; start: Date; end: Date }[]> {
  const client = await getClient();
  if (!client) return [];

  try {
    const { data } = await client.events.list({
      calendarId: CALENDAR_ID()!,
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
    });

    return (data.items ?? [])
      // Anything this app created is already represented in our own table.
      .filter((e) => !e.extendedProperties?.private?.studio954BookingId)
      .filter((e) => e.start?.dateTime && e.end?.dateTime && e.status !== "cancelled")
      .map((e) => ({
        id: e.id!,
        title: e.summary ?? "Busy",
        start: new Date(e.start!.dateTime!),
        end: new Date(e.end!.dateTime!),
      }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Google Calendar error";
    await recordStatus("error", message);
    return [];
  }
}
