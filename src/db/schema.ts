import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ---------------------------------------------------------------------------
 * People
 * ------------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    /** "admin" | "team" */
    role: text("role").notNull().default("team"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email)],
);

/** Opaque session cookies. Only the hash of the token is ever stored. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_key").on(t.tokenHash),
    index("sessions_user_id_idx").on(t.userId),
  ],
);

/* ---------------------------------------------------------------------------
 * Studio configuration (single row, id = 1)
 * ------------------------------------------------------------------------ */

export const studioSettings = pgTable("studio_settings", {
  id: integer("id").primaryKey().default(1),
  studioName: text("studio_name").notNull().default("Studio 954"),
  timezone: text("timezone").notNull().default("America/New_York"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  region: text("region"),
  postalCode: text("postal_code"),
  contactEmail: text("contact_email"),
  logoUrl: text("logo_url"),
  arrivalInstructions: text("arrival_instructions"),

  externalSetupMinutes: integer("external_setup_minutes").notNull().default(30),
  externalResetMinutes: integer("external_reset_minutes").notNull().default(30),
  internalSetupMinutes: integer("internal_setup_minutes").notNull().default(15),
  internalResetMinutes: integer("internal_reset_minutes").notNull().default(15),

  notifyConfirmation: boolean("notify_confirmation").notNull().default(true),
  notifyReminder24h: boolean("notify_reminder_24h").notNull().default(true),
  notifyReminderSameDay: boolean("notify_reminder_same_day").notNull().default(true),
  sameDayReminderLeadMinutes: integer("same_day_reminder_lead_minutes").notNull().default(120),
  notifyInternalTeam: boolean("notify_internal_team").notNull().default(false),
  internalNotificationEmail: text("internal_notification_email"),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------------------------------------------------------------------------
 * Sets and their customisation options
 * ------------------------------------------------------------------------ */

export const studioSets = pgTable("studio_sets", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** e.g. Curtain / Background, Seating, Table, Accent Lighting, Decor */
export const setOptionCategories = pgTable(
  "set_option_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    /** Decor can take several picks; a curtain cannot. */
    allowsMultiple: boolean("allows_multiple").notNull().default(false),
    isRequired: boolean("is_required").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [uniqueIndex("set_option_categories_slug_key").on(t.slug)],
);

export const setOptions = pgTable(
  "set_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => setOptionCategories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    /** Optional colour chip for curtains / lighting. */
    swatchHex: text("swatch_hex"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("set_options_category_id_idx").on(t.categoryId)],
);

/**
 * Restricts an option to particular sets. An option with no rows here is
 * offered on every set.
 */
export const setOptionSets = pgTable(
  "set_option_sets",
  {
    setOptionId: uuid("set_option_id")
      .notNull()
      .references(() => setOptions.id, { onDelete: "cascade" }),
    studioSetId: uuid("studio_set_id")
      .notNull()
      .references(() => studioSets.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.setOptionId, t.studioSetId] })],
);

/* ---------------------------------------------------------------------------
 * Add-ons (external rentals)
 * ------------------------------------------------------------------------ */

export const addons = pgTable("addons", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

/* ---------------------------------------------------------------------------
 * Bookings
 * ------------------------------------------------------------------------ */

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    /** "internal" | "external" */
    kind: text("kind").notNull().default("internal"),
    /** podcast | interview | social_content | photoshoot | product_shoot | livestream | other */
    bookingType: text("booking_type").notNull().default("other"),
    /** upcoming | setting_up | ready | checked_in | in_session | finished | resetting | complete | cancelled */
    status: text("status").notNull().default("upcoming"),

    clientName: text("client_name"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    setupMinutes: integer("setup_minutes").notNull().default(30),
    resetMinutes: integer("reset_minutes").notNull().default(30),

    studioSetId: uuid("studio_set_id").references(() => studioSets.id, { onDelete: "set null" }),

    organizerName: text("organizer_name").notNull(),
    organizerEmail: text("organizer_email").notNull(),
    organizerPhone: text("organizer_phone"),

    notes: text("notes"),
    internalNotes: text("internal_notes"),
    microphoneCount: integer("microphone_count").notNull().default(0),

    /** Shared by every occurrence generated from one recurrence rule. */
    recurrenceGroupId: uuid("recurrence_group_id"),

    googleEventId: text("google_event_id"),
    googleSyncedAt: timestamp("google_synced_at", { withTimezone: true }),

    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    /**
     * The full window the studio is occupied, buffers included. Maintained by
     * a database trigger — never write these from application code. The
     * `defaultNow()` exists only so inserts type-check; the trigger always
     * overwrites it.
     */
    blockedStart: timestamp("blocked_start", { withTimezone: true }).notNull().defaultNow(),
    blockedEnd: timestamp("blocked_end", { withTimezone: true }).notNull().defaultNow(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bookings_starts_at_idx").on(t.startsAt),
    index("bookings_status_idx").on(t.status),
    index("bookings_recurrence_group_idx").on(t.recurrenceGroupId),
  ],
);

export const bookingAttendees = pgTable(
  "booking_attendees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    /** Whether this person receives confirmations, reminders and invites. */
    notify: boolean("notify").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("booking_attendees_booking_id_idx").on(t.bookingId)],
);

/** The exact room recipe for one booking. */
export const bookingSetOptions = pgTable(
  "booking_set_options",
  {
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    setOptionId: uuid("set_option_id")
      .notNull()
      .references(() => setOptions.id, { onDelete: "restrict" }),
  },
  (t) => [primaryKey({ columns: [t.bookingId, t.setOptionId] })],
);

export const bookingAddons = pgTable(
  "booking_addons",
  {
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    addonId: uuid("addon_id")
      .notNull()
      .references(() => addons.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    /** Price captured at booking time so later price edits do not rewrite history. */
    priceCentsAtBooking: integer("price_cents_at_booking").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bookingId, t.addonId] })],
);

/* ---------------------------------------------------------------------------
 * Outbound mail + integrations
 * ------------------------------------------------------------------------ */

export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
    /** confirmation | reminder_24h | reminder_same_day | cancellation | internal_alert */
    kind: text("kind").notNull(),
    recipientEmail: text("recipient_email").notNull(),
    /** sent | failed | skipped */
    status: text("status").notNull(),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notification_logs_booking_id_idx").on(t.bookingId),
    index("notification_logs_kind_idx").on(t.kind),
  ],
);

export const calendarIntegrations = pgTable("calendar_integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull().default("google"),
  calendarId: text("calendar_id").notNull(),
  accountEmail: text("account_email"),
  /** connected | error | disconnected */
  status: text("status").notNull().default("disconnected"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
