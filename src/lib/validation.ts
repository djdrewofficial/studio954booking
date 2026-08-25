import { z } from "zod";

import {
  BOOKING_KINDS,
  BOOKING_STATUSES,
  BOOKING_TYPES,
  ENTITLEMENT_KINDS,
  EQUIPMENT_PROVIDERS,
  MEMBERSHIP_STATUSES,
  RECURRENCE_FREQUENCIES,
  TECHNICIAN_PROVIDERS,
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

    /** The durable client record, when this booking belongs to one. */
    clientId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
    /** Which membership the session draws down. Required when kind is membership. */
    clientMembershipId: z.uuid().optional().or(z.literal("").transform(() => undefined)),

    technicianProvider: z.enum(TECHNICIAN_PROVIDERS).default("none"),
    equipmentProvider: z.enum(EQUIPMENT_PROVIDERS).default("studio"),

    /**
     * Only read when priceManual is set. Otherwise the server quotes from the
     * rate card, so a stale client-side figure can never become the price.
     */
    priceCents: z.coerce.number().int().min(0).max(1_000_000_00).optional(),
    priceManual: z.boolean().default(false),

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
  })
  // Mirrors the database constraint, so the form explains it rather than
  // letting the insert fail.
  .refine((v) => v.kind !== "membership" || Boolean(v.clientMembershipId), {
    message: "Choose the client whose membership covers this",
    path: ["clientMembershipId"],
  })
  .refine((v) => v.kind !== "membership" || Boolean(v.clientId), {
    message: "A membership booking needs a client",
    path: ["clientId"],
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
 * Clients, memberships and the rate card
 * ------------------------------------------------------------------------ */

export const clientSchema = z.object({
  id: z.uuid().optional(),
  name: shortText("Client name", 160),
  contactName: optionalText,
  email: z.union([z.literal(""), z.email("Enter a valid email")]).optional(),
  phone: optionalText,
  notes: optionalText,
  isActive: z.boolean().default(true),
});

export const membershipPlanSchema = z.object({
  id: z.uuid().optional(),
  name: shortText("Plan name", 120),
  description: optionalText,
  priceCents: z.coerce.number().int().min(0).max(100_000_00),
  isActive: z.boolean().default(true),
});

/**
 * One line of what a plan includes. Studio time arrives from the form in
 * hours and is stored in minutes, matching every other duration in the app.
 */
export const planEntitlementSchema = z
  .object({
    id: z.uuid().optional(),
    planId: z.uuid(),
    entitlementKind: z.enum(ENTITLEMENT_KINDS),
    /** Empty means "any appointment", which is a real choice, not a blank. */
    bookingType: z.union([z.literal(""), z.enum(BOOKING_TYPES)]).optional(),
    amount: z.coerce.number().int().positive("Enter how many"),
  })
  .refine((v) => v.entitlementKind !== "studio_hours" || !v.bookingType, {
    message: "Studio time is not tied to one appointment type",
    path: ["bookingType"],
  });

export const clientMembershipSchema = z
  .object({
    id: z.uuid().optional(),
    clientId: z.uuid(),
    planId: z.uuid("Choose a plan"),
    status: z.enum(MEMBERSHIP_STATUSES).default("active"),
    startedOn: isoDate,
    endedOn: z.union([z.literal(""), isoDate]).optional(),
    notes: optionalText,
  })
  .refine((v) => !v.endedOn || v.endedOn >= v.startedOn, {
    message: "The end date cannot be before the start date",
    path: ["endedOn"],
  });

export const bookingTypeRateSchema = z.object({
  bookingType: z.enum(BOOKING_TYPES),
  baseCents: z.coerce.number().int().min(0).max(100_000_00),
  hourlyCents: z.coerce.number().int().min(0).max(100_000_00),
});

/**
 * Who is running the session and whose gear is in the room. Recorded on every
 * booking because it changes how the room is prepared — never what it costs,
 * since our crew and gear are included in an external rental either way.
 */
export const providerSchema = z.object({
  technicianProvider: z.enum(TECHNICIAN_PROVIDERS).default("none"),
  equipmentProvider: z.enum(EQUIPMENT_PROVIDERS).default("studio"),
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
