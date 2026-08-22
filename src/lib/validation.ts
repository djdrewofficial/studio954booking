import { z } from "zod";

import {
  BOOKING_KINDS,
  BOOKING_STATUSES,
  BOOKING_TYPES,
  RECURRENCE_FREQUENCIES,
  USER_ROLES,
} from "./domain";

/**
 * One schema per input surface, shared by the client form and the server
 * action. The server always re-validates — the client copy exists only to give
 * fast feedback, never to be trusted.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour time like 14:30");

const optionalText = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .transform((v) => (v ? v : undefined));

const shortText = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max);

/* ---------------------------------------------------------------------------
 * Auth
 * ------------------------------------------------------------------------ */

export const loginSchema = z.object({
  email: z.email("Enter a valid email").transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, "Enter your password"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const userSchema = z.object({
  name: shortText("Name"),
  email: z.email("Enter a valid email").transform((v) => v.trim().toLowerCase()),
  role: z.enum(USER_ROLES),
  password: z
    .string()
    .min(10, "Use at least 10 characters")
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type UserInput = z.infer<typeof userSchema>;

/* ---------------------------------------------------------------------------
 * Bookings
 * ------------------------------------------------------------------------ */

export const attendeeSchema = z.object({
  name: shortText("Attendee name", 120),
  email: z
    .union([z.email("Enter a valid email"), z.literal("")])
    .optional()
    .transform((v) => (v ? v.trim().toLowerCase() : undefined)),
  notify: z.boolean().default(true),
});
export type AttendeeInput = z.infer<typeof attendeeSchema>;

export const bookingSchema = z
  .object({
    title: shortText("Booking title"),
    kind: z.enum(BOOKING_KINDS),
    bookingType: z.enum(BOOKING_TYPES),
    clientName: optionalText,

    date: isoDate,
    startTime: clockTime,
    endTime: clockTime,
    setupMinutes: z.coerce.number().int().min(0).max(480),
    resetMinutes: z.coerce.number().int().min(0).max(480),

    studioSetId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
    setOptionIds: z.array(z.uuid()).default([]),

    organizerName: shortText("Organizer name", 120),
    organizerEmail: z
      .email("Enter a valid organizer email")
      .transform((v) => v.trim().toLowerCase()),
    organizerPhone: optionalText,

    notes: optionalText,
    internalNotes: optionalText,
    microphoneCount: z.coerce.number().int().min(0).max(24).default(0),

    attendees: z.array(attendeeSchema).max(50).default([]),

    usesTeleprompter: z.boolean().default(false),
    /**
     * Scripts are uploaded to storage first, then referenced here, so a
     * booking can carry its copy before it has ever been saved.
     */
    teleprompterFiles: z
      .array(
        z.object({
          fileName: z.string().trim().min(1).max(255),
          storagePath: z.string().trim().min(1).max(500),
          contentType: z.string().max(160).optional(),
          sizeBytes: z.coerce.number().int().min(0).max(50_000_000).optional(),
        }),
      )
      .max(10)
      .default([]),

    recurrence: z.enum(RECURRENCE_FREQUENCIES).default("none"),
    recurrenceUntil: isoDate.optional().or(z.literal("").transform(() => undefined)),
  })
  .refine((v) => v.endTime > v.startTime, {
    message: "The session must end after it starts",
    path: ["endTime"],
  })
  .refine((v) => v.recurrence === "none" || Boolean(v.recurrenceUntil), {
    message: "Choose the date the repeat should stop",
    path: ["recurrenceUntil"],
  });
export type BookingInput = z.infer<typeof bookingSchema>;

export const statusChangeSchema = z.object({
  bookingId: z.uuid(),
  status: z.enum(BOOKING_STATUSES),
});

export const duplicateBookingSchema = z.object({
  bookingId: z.uuid(),
  date: isoDate,
  startTime: clockTime,
});

/* ---------------------------------------------------------------------------
 * Settings
 * ------------------------------------------------------------------------ */

export const studioSettingsSchema = z.object({
  studioName: shortText("Studio name"),
  timezone: shortText("Timezone"),
  addressLine1: optionalText,
  addressLine2: optionalText,
  city: optionalText,
  region: optionalText,
  postalCode: optionalText,
  contactEmail: z
    .union([z.email("Enter a valid email"), z.literal("")])
    .optional()
    .transform((v) => (v ? v.toLowerCase() : undefined)),
  logoUrl: optionalText,
  arrivalInstructions: optionalText,
  externalSetupMinutes: z.coerce.number().int().min(0).max(480),
  externalResetMinutes: z.coerce.number().int().min(0).max(480),
  internalSetupMinutes: z.coerce.number().int().min(0).max(480),
  internalResetMinutes: z.coerce.number().int().min(0).max(480),
});

export const notificationSettingsSchema = z.object({
  notifyConfirmation: z.boolean().default(false),
  notifyReminder24h: z.boolean().default(false),
  notifyReminderSameDay: z.boolean().default(false),
  sameDayReminderLeadMinutes: z.coerce.number().int().min(15).max(720),
  notifyInternalTeam: z.boolean().default(false),
  internalNotificationEmail: z
    .union([z.email("Enter a valid email"), z.literal("")])
    .optional()
    .transform((v) => (v ? v.toLowerCase() : undefined)),
});

export const studioSetSchema = z.object({
  id: z.uuid().optional(),
  name: shortText("Set name"),
  description: optionalText,
  imageUrl: optionalText,
  isActive: z.boolean().default(true),
});

export const setOptionSchema = z.object({
  id: z.uuid().optional(),
  categoryId: z.uuid("Choose a category"),
  name: shortText("Option name", 120),
  description: optionalText,
  imageUrl: optionalText,
  swatchHex: z
    .union([z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #1A1A1A"), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  isActive: z.boolean().default(true),
  /** Empty means the option is offered on every set. */
  studioSetIds: z.array(z.uuid()).default([]),
});

export const setOptionCategorySchema = z.object({
  id: z.uuid().optional(),
  name: shortText("Category name", 80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only")
    .max(40),
  allowsMultiple: z.boolean().default(false),
  isRequired: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const addonSchema = z.object({
  id: z.uuid().optional(),
  name: shortText("Add-on name", 120),
  description: optionalText,
  priceCents: z.coerce.number().int().min(0).max(10_000_00),
  isActive: z.boolean().default(true),
});

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

export type FieldErrors = Record<string, string>;

/** Flattens a Zod error into `{ fieldName: firstMessage }` for form rendering. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
