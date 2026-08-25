/**
 * The vocabulary of a Studio 954 booking. Kept in one place so the labels on
 * screen, the options in a form, and the values allowed by the database check
 * constraints can never drift apart.
 */

export const BOOKING_KINDS = ["internal", "membership", "external"] as const;
export type BookingKind = (typeof BOOKING_KINDS)[number];

export const BOOKING_KIND_LABEL: Record<BookingKind, string> = {
  internal: "Internal",
  membership: "Membership",
  external: "External Rental",
};

/** Only these kinds are ever invoiced; internal work is the studio's own time. */
export function isBillableKind(kind: BookingKind): boolean {
  return kind === "external";
}

export const BOOKING_TYPES = [
  "podcast",
  "interview",
  "social_content",
  "content_day",
  "photoshoot",
  "product_shoot",
  "livestream",
  "other",
] as const;
export type BookingType = (typeof BOOKING_TYPES)[number];

export const BOOKING_TYPE_LABEL: Record<BookingType, string> = {
  podcast: "Podcast",
  interview: "Interview",
  social_content: "Social Content",
  content_day: "Content Shoot Day",
  photoshoot: "Photoshoot",
  product_shoot: "Product Shoot",
  livestream: "Livestream",
  other: "Other",
};

/* ---------------------------------------------------------------------------
 * Who brings the crew and the gear
 *
 * Recorded on every booking because it changes both what the room needs and,
 * for an external client, what the session costs.
 * ------------------------------------------------------------------------ */

export const TECHNICIAN_PROVIDERS = ["studio", "client", "none"] as const;
export type TechnicianProvider = (typeof TECHNICIAN_PROVIDERS)[number];

export const TECHNICIAN_PROVIDER_LABEL: Record<TechnicianProvider, string> = {
  studio: "Our technician",
  client: "Their technician",
  none: "No technician",
};

export const EQUIPMENT_PROVIDERS = ["studio", "client"] as const;
export type EquipmentProvider = (typeof EQUIPMENT_PROVIDERS)[number];

export const EQUIPMENT_PROVIDER_LABEL: Record<EquipmentProvider, string> = {
  studio: "Our equipment",
  client: "Their equipment",
};

/* ---------------------------------------------------------------------------
 * Memberships
 * ------------------------------------------------------------------------ */

export const ENTITLEMENT_KINDS = ["studio_hours", "appointment_count"] as const;
export type EntitlementKind = (typeof ENTITLEMENT_KINDS)[number];

export const ENTITLEMENT_KIND_LABEL: Record<EntitlementKind, string> = {
  studio_hours: "Studio hours",
  appointment_count: "Appointments",
};

export const MEMBERSHIP_STATUSES = ["active", "paused", "cancelled"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const MEMBERSHIP_STATUS_LABEL: Record<MembershipStatus, string> = {
  active: "Active",
  paused: "Paused",
  cancelled: "Cancelled",
};

/* ---------------------------------------------------------------------------
 * Operational status
 * ------------------------------------------------------------------------ */

export const BOOKING_STATUSES = [
  "upcoming",
  "setting_up",
  "ready",
  "checked_in",
  "in_session",
  "finished",
  "resetting",
  "complete",
  "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  upcoming: "Upcoming",
  setting_up: "Setting Up",
  ready: "Ready",
  checked_in: "Checked In",
  in_session: "In Session",
  finished: "Finished",
  resetting: "Resetting",
  complete: "Complete",
  cancelled: "Cancelled",
};

/**
 * The one obvious next move for a booking in a given state. Nobody should have
 * to hunt through a dropdown to say "they're here" — the button just says it.
 * Statuses can still be set directly; this only drives the primary action.
 */
export const NEXT_STATUS_ACTION: Partial<
  Record<BookingStatus, { next: BookingStatus; label: string }>
> = {
  upcoming: { next: "setting_up", label: "Start Setup" },
  setting_up: { next: "ready", label: "Mark Ready" },
  ready: { next: "checked_in", label: "Check In" },
  checked_in: { next: "in_session", label: "Start Session" },
  in_session: { next: "finished", label: "Finish Session" },
  finished: { next: "resetting", label: "Start Reset" },
  resetting: { next: "complete", label: "Mark Reset Complete" },
};

/** Statuses that mean the room is done with this booking. */
export const CLOSED_STATUSES: readonly BookingStatus[] = ["complete", "cancelled"];

/** The single status that earns the magenta tally light. */
export function isLiveStatus(status: BookingStatus): boolean {
  return status === "in_session";
}

/**
 * Three meanings worth colouring: the room is live, the room is ready, or the
 * team is working on the room. Everything else stays quiet.
 */
export type StatusTone = "live" | "ready" | "prep" | "neutral" | "done" | "off";

export const STATUS_TONE: Record<BookingStatus, StatusTone> = {
  upcoming: "neutral",
  setting_up: "prep",
  ready: "ready",
  checked_in: "ready",
  in_session: "live",
  finished: "prep",
  resetting: "prep",
  complete: "done",
  cancelled: "off",
};

export function isCancelled(status: BookingStatus): boolean {
  return status === "cancelled";
}

/* ---------------------------------------------------------------------------
 * Recurrence — deliberately small
 * ------------------------------------------------------------------------ */

export const RECURRENCE_FREQUENCIES = ["none", "weekly", "biweekly"] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const RECURRENCE_LABEL: Record<RecurrenceFrequency, string> = {
  none: "Does not repeat",
  weekly: "Every week",
  biweekly: "Every other week",
};

/* ---------------------------------------------------------------------------
 * People
 * ------------------------------------------------------------------------ */

export const USER_ROLES = ["admin", "team"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  team: "Team",
};

/** Admins manage settings, sets, add-ons and people. Team runs the room. */
export function canManageSettings(role: UserRole): boolean {
  return role === "admin";
}
