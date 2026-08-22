import "server-only";

import type { BookingCatalogue, BookingFormValues } from "@/components/booking-form/types";
import type { SessionUser } from "@/lib/auth";
import type { BookingKind, BookingType } from "@/lib/domain";
import { ceilToQuarterHour, dayKey, timeValue } from "@/lib/time";
import { getBookingDetail, getDuplicateTemplate } from "@/server/bookings";
import { getOptionCatalogue, listStudioSets } from "@/server/sets";
import { defaultBuffers, getStudioSettings } from "@/server/settings";

/** Everything the stepped form needs to render, in one round trip. */
export async function loadBookingCatalogue(): Promise<BookingCatalogue> {
  const [settings, sets, categories] = await Promise.all([
    getStudioSettings(),
    listStudioSets(),
    getOptionCatalogue(),
  ]);

  return {
    timezone: settings.timezone,
    sets: sets.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      imageUrl: s.imageUrl,
    })),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      allowsMultiple: c.allowsMultiple,
      isRequired: c.isRequired,
      options: c.options.map((o) => ({
        id: o.id,
        name: o.name,
        description: o.description,
        imageUrl: o.imageUrl,
        swatchHex: o.swatchHex,
        studioSetIds: o.studioSetIds,
      })),
    })),
    defaults: {
      internal: defaultBuffers(settings, "internal"),
      external: defaultBuffers(settings, "external"),
    },
  };
}

function addMinutesToClock(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(23 * 60 + 55, h * 60 + m + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Sensible starting values: today, the next quarter hour, a two hour session,
 * and the signed-in person as organizer. A booking should mostly be a matter of
 * typing a title and pressing save.
 */
export async function newBookingDefaults(
  user: SessionUser,
  params: { date?: string; time?: string; duplicateOf?: string } = {},
): Promise<BookingFormValues> {
  const settings = await getStudioSettings();
  const tz = settings.timezone;
  const now = new Date();

  const date = params.date ?? dayKey(now, tz);
  const startTime = params.time ?? timeValue(ceilToQuarterHour(now), tz);

  const base: BookingFormValues = {
    title: "",
    kind: "internal",
    bookingType: "podcast",
    clientName: "",
    date,
    startTime,
    endTime: addMinutesToClock(startTime, 120),
    ...defaultBuffers(settings, "internal"),
    studioSetId: "",
    setOptionIds: [],
    organizerName: user.name,
    organizerEmail: user.email,
    organizerPhone: "",
    notes: "",
    internalNotes: "",
    microphoneCount: 0,
    attendees: [],
    recurrence: "none",
    recurrenceUntil: "",
  };

  if (!params.duplicateOf) return base;

  const template = await getDuplicateTemplate(params.duplicateOf);
  if (!template) return base;

  return {
    ...base,
    title: template.title,
    kind: template.kind,
    bookingType: template.bookingType,
    clientName: template.clientName ?? "",
    endTime: addMinutesToClock(startTime, template.durationMinutes),
    setupMinutes: template.setupMinutes,
    resetMinutes: template.resetMinutes,
    studioSetId: template.studioSetId ?? "",
    setOptionIds: template.setOptionIds,
    organizerName: template.organizerName,
    organizerEmail: template.organizerEmail,
    organizerPhone: template.organizerPhone ?? "",
    notes: template.notes ?? "",
    internalNotes: template.internalNotes ?? "",
    microphoneCount: template.microphoneCount,
    attendees: template.attendees.map((a) => ({
      name: a.name,
      email: a.email ?? "",
      notify: a.notify,
    })),
  };
}

/** Turns a stored booking back into editable form values. */
export async function bookingToFormValues(id: string): Promise<BookingFormValues | null> {
  const [detail, settings] = await Promise.all([getBookingDetail(id), getStudioSettings()]);
  if (!detail) return null;
  const tz = settings.timezone;

  return {
    title: detail.title,
    kind: detail.kind as BookingKind,
    bookingType: detail.bookingType as BookingType,
    clientName: detail.clientName ?? "",
    date: dayKey(detail.startsAt, tz),
    startTime: timeValue(detail.startsAt, tz),
    endTime: timeValue(detail.endsAt, tz),
    setupMinutes: detail.setupMinutes,
    resetMinutes: detail.resetMinutes,
    studioSetId: detail.studioSetId ?? "",
    setOptionIds: detail.options.map((o) => o.id),
    organizerName: detail.organizerName,
    organizerEmail: detail.organizerEmail,
    organizerPhone: detail.organizerPhone ?? "",
    notes: detail.notes ?? "",
    internalNotes: detail.internalNotes ?? "",
    microphoneCount: detail.microphoneCount,
    attendees: detail.attendees.map((a) => ({
      name: a.name,
      email: a.email ?? "",
      notify: a.notify,
    })),
    recurrence: "none",
    recurrenceUntil: "",
  };
}
