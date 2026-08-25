"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  addons,
  bookingTypeRates,
  clientMemberships,
  clients,
  membershipPlanEntitlements,
  membershipPlans,
  setOptionCategories,
  setOptionSets,
  setOptions,
  studioSets,
  studioSettings,
  users,
} from "@/db/schema";
import { hashPassword, requireAdmin, requireCapability } from "@/lib/auth";
import { BOOKING_TYPES, canManageClients } from "@/lib/domain";
import {
  addonSchema,
  bookingTypeRateSchema,
  clientMembershipSchema,
  clientSchema,
  fieldErrors,
  membershipPlanSchema,
  planEntitlementSchema,
  notificationSettingsSchema,
  setOptionCategorySchema,
  setOptionSchema,
  studioSetSchema,
  studioSettingsSchema,
  userSchema,
} from "@/lib/validation";

export type SettingsFormState = { ok?: boolean; message?: string; errors?: Record<string, string> };

function bool(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

function revalidateSettings() {
  revalidatePath("/settings", "layout");
  revalidatePath("/today");
  revalidatePath("/calendar");
  revalidatePath("/bookings");
}

/* ---------------------------------------------------------------------------
 * Studio
 * ------------------------------------------------------------------------ */

export async function saveStudioSettings(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireAdmin();

  const parsed = studioSettingsSchema.safeParse({
    studioName: text(formData, "studioName"),
    timezone: text(formData, "timezone"),
    addressLine1: text(formData, "addressLine1"),
    addressLine2: text(formData, "addressLine2"),
    city: text(formData, "city"),
    region: text(formData, "region"),
    postalCode: text(formData, "postalCode"),
    contactEmail: text(formData, "contactEmail"),
    logoUrl: text(formData, "logoUrl"),
    arrivalInstructions: text(formData, "arrivalInstructions"),
    externalSetupMinutes: text(formData, "externalSetupMinutes"),
    externalResetMinutes: text(formData, "externalResetMinutes"),
    internalSetupMinutes: text(formData, "internalSetupMinutes"),
    internalResetMinutes: text(formData, "internalResetMinutes"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // Timezone must be one the runtime actually understands, or every date on
  // screen would silently fall back to UTC.
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: parsed.data.timezone });
  } catch {
    return { errors: { timezone: "That is not a recognised IANA timezone." } };
  }

  const values = {
    ...parsed.data,
    addressLine1: parsed.data.addressLine1 ?? null,
    addressLine2: parsed.data.addressLine2 ?? null,
    city: parsed.data.city ?? null,
    region: parsed.data.region ?? null,
    postalCode: parsed.data.postalCode ?? null,
    contactEmail: parsed.data.contactEmail ?? null,
    logoUrl: parsed.data.logoUrl ?? null,
    arrivalInstructions: parsed.data.arrivalInstructions ?? null,
    updatedAt: new Date(),
  };

  await db
    .insert(studioSettings)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: studioSettings.id, set: values });

  revalidateSettings();
  return { ok: true, message: "Studio settings saved." };
}

export async function saveNotificationSettings(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireAdmin();

  const parsed = notificationSettingsSchema.safeParse({
    notifyConfirmation: bool(formData, "notifyConfirmation"),
    notifyReminder24h: bool(formData, "notifyReminder24h"),
    notifyReminderSameDay: bool(formData, "notifyReminderSameDay"),
    sameDayReminderLeadMinutes: text(formData, "sameDayReminderLeadMinutes"),
    notifyInternalTeam: bool(formData, "notifyInternalTeam"),
    internalNotificationEmail: text(formData, "internalNotificationEmail"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const values = {
    ...parsed.data,
    internalNotificationEmail: parsed.data.internalNotificationEmail ?? null,
    updatedAt: new Date(),
  };

  await db
    .insert(studioSettings)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: studioSettings.id, set: values });

  revalidateSettings();
  return { ok: true, message: "Notification settings saved." };
}

/* ---------------------------------------------------------------------------
 * Sets
 * ------------------------------------------------------------------------ */

export async function saveStudioSet(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireAdmin();

  const id = text(formData, "id");
  const parsed = studioSetSchema.safeParse({
    id: id || undefined,
    name: text(formData, "name"),
    description: text(formData, "description"),
    imageUrl: text(formData, "imageUrl"),
    isActive: bool(formData, "isActive"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const values = {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    imageUrl: parsed.data.imageUrl ?? null,
    isActive: parsed.data.isActive,
    updatedAt: new Date(),
  };

  if (parsed.data.id) {
    await db.update(studioSets).set(values).where(eq(studioSets.id, parsed.data.id));
  } else {
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${studioSets.sortOrder}), 0) + 1` })
      .from(studioSets);
    await db.insert(studioSets).values({ ...values, sortOrder: next });
  }

  revalidateSettings();
  return { ok: true, message: parsed.data.id ? "Set updated." : "Set created." };
}

/** Sets are archived rather than deleted so historic bookings keep their name. */
export async function archiveStudioSet(id: string, isActive: boolean): Promise<SettingsFormState> {
  await requireAdmin();
  await db
    .update(studioSets)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(studioSets.id, id));
  revalidateSettings();
  return { ok: true, message: isActive ? "Set restored." : "Set archived." };
}

/* ---------------------------------------------------------------------------
 * Option categories and options
 * ------------------------------------------------------------------------ */

export async function saveOptionCategory(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireAdmin();

  const id = text(formData, "id");
  const parsed = setOptionCategorySchema.safeParse({
    id: id || undefined,
    name: text(formData, "name"),
    slug: text(formData, "slug"),
    allowsMultiple: bool(formData, "allowsMultiple"),
    isRequired: bool(formData, "isRequired"),
    isActive: bool(formData, "isActive"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const values = {
    name: parsed.data.name,
    slug: parsed.data.slug,
    allowsMultiple: parsed.data.allowsMultiple,
    isRequired: parsed.data.isRequired,
    isActive: parsed.data.isActive,
  };

  try {
    if (parsed.data.id) {
      await db
        .update(setOptionCategories)
        .set(values)
        .where(eq(setOptionCategories.id, parsed.data.id));
    } else {
      const [{ next }] = await db
        .select({ next: sql<number>`coalesce(max(${setOptionCategories.sortOrder}), 0) + 1` })
        .from(setOptionCategories);
      await db.insert(setOptionCategories).values({ ...values, sortOrder: next });
    }
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      return { errors: { slug: "That slug is already in use." } };
    }
    throw error;
  }

  revalidateSettings();
  return { ok: true, message: "Category saved." };
}

export async function saveSetOption(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireAdmin();

  const id = text(formData, "id");
  const parsed = setOptionSchema.safeParse({
    id: id || undefined,
    categoryId: text(formData, "categoryId"),
    name: text(formData, "name"),
    description: text(formData, "description"),
    imageUrl: text(formData, "imageUrl"),
    swatchHex: text(formData, "swatchHex"),
    isActive: bool(formData, "isActive"),
    studioSetIds: formData.getAll("studioSetIds").map(String).filter(Boolean),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const values = {
    categoryId: parsed.data.categoryId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    imageUrl: parsed.data.imageUrl ?? null,
    swatchHex: parsed.data.swatchHex ?? null,
    isActive: parsed.data.isActive,
  };

  await db.transaction(async (tx) => {
    let optionId = parsed.data.id;

    if (optionId) {
      await tx.update(setOptions).set(values).where(eq(setOptions.id, optionId));
      await tx.delete(setOptionSets).where(eq(setOptionSets.setOptionId, optionId));
    } else {
      const [{ next }] = await tx
        .select({ next: sql<number>`coalesce(max(${setOptions.sortOrder}), 0) + 1` })
        .from(setOptions)
        .where(eq(setOptions.categoryId, parsed.data.categoryId));
      const [row] = await tx
        .insert(setOptions)
        .values({ ...values, sortOrder: next })
        .returning({ id: setOptions.id });
      optionId = row.id;
    }

    if (parsed.data.studioSetIds.length) {
      await tx.insert(setOptionSets).values(
        parsed.data.studioSetIds.map((studioSetId) => ({
          setOptionId: optionId!,
          studioSetId,
        })),
      );
    }
  });

  revalidateSettings();
  return { ok: true, message: "Option saved." };
}

export async function archiveSetOption(id: string, isActive: boolean): Promise<SettingsFormState> {
  await requireAdmin();
  await db.update(setOptions).set({ isActive }).where(eq(setOptions.id, id));
  revalidateSettings();
  return { ok: true, message: isActive ? "Option restored." : "Option archived." };
}

/* ---------------------------------------------------------------------------
 * Add-ons
 * ------------------------------------------------------------------------ */

export async function saveAddon(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireAdmin();

  const id = text(formData, "id");
  const dollars = Number(text(formData, "price") || 0);
  const parsed = addonSchema.safeParse({
    id: id || undefined,
    name: text(formData, "name"),
    description: text(formData, "description"),
    priceCents: Math.round(dollars * 100),
    isActive: bool(formData, "isActive"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const values = {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    priceCents: parsed.data.priceCents,
    isActive: parsed.data.isActive,
  };

  if (parsed.data.id) {
    await db.update(addons).set(values).where(eq(addons.id, parsed.data.id));
  } else {
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${addons.sortOrder}), 0) + 1` })
      .from(addons);
    await db.insert(addons).values({ ...values, sortOrder: next });
  }

  revalidateSettings();
  return { ok: true, message: "Add-on saved." };
}

export async function archiveAddon(id: string, isActive: boolean): Promise<SettingsFormState> {
  await requireAdmin();
  await db.update(addons).set({ isActive }).where(eq(addons.id, id));
  revalidateSettings();
  return { ok: true, message: isActive ? "Add-on restored." : "Add-on archived." };
}

/* ---------------------------------------------------------------------------
 * Team
 * ------------------------------------------------------------------------ */

export async function saveUser(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireAdmin();

  const id = text(formData, "id");
  const parsed = userSchema.safeParse({
    name: text(formData, "name"),
    email: text(formData, "email"),
    role: text(formData, "role"),
    password: text(formData, "password"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  if (!id && !parsed.data.password) {
    return { errors: { password: "Set a password for the new account." } };
  }

  try {
    if (id) {
      await db
        .update(users)
        .set({
          name: parsed.data.name,
          email: parsed.data.email,
          role: parsed.data.role,
          ...(parsed.data.password
            ? { passwordHash: await hashPassword(parsed.data.password) }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, id));
    } else {
      await db.insert(users).values({
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        passwordHash: await hashPassword(parsed.data.password!),
      });
    }
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      return { errors: { email: "Someone already uses that email." } };
    }
    throw error;
  }

  revalidateSettings();
  return { ok: true, message: id ? "Account updated." : "Account created." };
}

/** Accounts are deactivated rather than deleted so their bookings keep an author. */
export async function setUserActive(id: string, isActive: boolean): Promise<SettingsFormState> {
  const admin = await requireAdmin();
  if (admin.id === id && !isActive) {
    return { ok: false, message: "You cannot deactivate your own account." };
  }
  await db.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, id));
  revalidateSettings();
  return { ok: true, message: isActive ? "Account reactivated." : "Account deactivated." };
}

/* ---------------------------------------------------------------------------
 * Clients
 * ------------------------------------------------------------------------ */

function money(formData: FormData, key: string): number {
  return Math.round(Number(text(formData, key) || 0) * 100);
}

export async function saveClient(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireCapability(canManageClients);

  const id = text(formData, "id");
  const parsed = clientSchema.safeParse({
    id: id || undefined,
    name: text(formData, "name"),
    contactName: text(formData, "contactName"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    notes: text(formData, "notes"),
    isActive: bool(formData, "isActive"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const values = {
    name: parsed.data.name,
    contactName: parsed.data.contactName ?? null,
    email: parsed.data.email || null,
    phone: parsed.data.phone ?? null,
    notes: parsed.data.notes ?? null,
    isActive: parsed.data.isActive,
    updatedAt: new Date(),
  };

  if (parsed.data.id) {
    await db.update(clients).set(values).where(eq(clients.id, parsed.data.id));
  } else {
    await db.insert(clients).values(values);
  }

  revalidateSettings();
  revalidatePath("/clients", "layout");
  return { ok: true, message: "Client saved." };
}

/* ---------------------------------------------------------------------------
 * Membership plans and what they include
 * ------------------------------------------------------------------------ */

export async function saveMembershipPlan(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireCapability(canManageClients);

  const id = text(formData, "id");
  const parsed = membershipPlanSchema.safeParse({
    id: id || undefined,
    name: text(formData, "name"),
    description: text(formData, "description"),
    priceCents: money(formData, "price"),
    isActive: bool(formData, "isActive"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const values = {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    priceCents: parsed.data.priceCents,
    isActive: parsed.data.isActive,
  };

  if (parsed.data.id) {
    await db.update(membershipPlans).set(values).where(eq(membershipPlans.id, parsed.data.id));
  } else {
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${membershipPlans.sortOrder}), 0) + 1` })
      .from(membershipPlans);
    await db.insert(membershipPlans).values({ ...values, sortOrder: next });
  }

  revalidateSettings();
  return { ok: true, message: "Plan saved." };
}

/**
 * Adds or edits one entitlement line. Studio time is entered in hours and
 * stored in minutes, so the form reads the way a plan is actually sold.
 */
export async function savePlanEntitlement(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireCapability(canManageClients);

  const id = text(formData, "id");
  const kind = text(formData, "entitlementKind");
  const raw = Number(text(formData, "amount") || 0);
  const parsed = planEntitlementSchema.safeParse({
    id: id || undefined,
    planId: text(formData, "planId"),
    entitlementKind: kind,
    bookingType: kind === "studio_hours" ? "" : text(formData, "bookingType"),
    amount: kind === "studio_hours" ? Math.round(raw * 60) : Math.round(raw),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const values = {
    planId: parsed.data.planId,
    entitlementKind: parsed.data.entitlementKind,
    bookingType: parsed.data.bookingType || null,
    amount: parsed.data.amount,
  };

  if (parsed.data.id) {
    await db
      .update(membershipPlanEntitlements)
      .set(values)
      .where(eq(membershipPlanEntitlements.id, parsed.data.id));
  } else {
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${membershipPlanEntitlements.sortOrder}), 0) + 1` })
      .from(membershipPlanEntitlements)
      .where(eq(membershipPlanEntitlements.planId, parsed.data.planId));
    await db.insert(membershipPlanEntitlements).values({ ...values, sortOrder: next });
  }

  revalidateSettings();
  return { ok: true, message: "Plan updated." };
}

/** Used directly as a form action, so removing a line needs no client component. */
export async function removePlanEntitlement(formData: FormData): Promise<void> {
  await requireCapability(canManageClients);
  const id = text(formData, "id");
  if (!id) return;
  await db.delete(membershipPlanEntitlements).where(eq(membershipPlanEntitlements.id, id));
  revalidateSettings();
}

/* ---------------------------------------------------------------------------
 * A client's membership
 * ------------------------------------------------------------------------ */

export async function saveClientMembership(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireCapability(canManageClients);

  const id = text(formData, "id");
  const parsed = clientMembershipSchema.safeParse({
    id: id || undefined,
    clientId: text(formData, "clientId"),
    planId: text(formData, "planId"),
    status: text(formData, "status") || "active",
    startedOn: text(formData, "startedOn"),
    endedOn: text(formData, "endedOn"),
    notes: text(formData, "notes"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const values = {
    clientId: parsed.data.clientId,
    planId: parsed.data.planId,
    status: parsed.data.status,
    startedOn: parsed.data.startedOn,
    endedOn: parsed.data.endedOn || null,
    notes: parsed.data.notes ?? null,
    updatedAt: new Date(),
  };

  try {
    if (parsed.data.id) {
      await db.update(clientMemberships).set(values).where(eq(clientMemberships.id, parsed.data.id));
    } else {
      await db.insert(clientMemberships).values(values);
    }
  } catch (error) {
    // The database allows only one active membership per client.
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        message: "That client already has an active membership. End it before starting another.",
      };
    }
    throw error;
  }

  revalidateSettings();
  revalidatePath("/clients", "layout");
  return { ok: true, message: "Membership saved." };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

/* ---------------------------------------------------------------------------
 * The rate card
 * ------------------------------------------------------------------------ */

/** Saves the whole card in one submit, because that is how it is read. */
export async function saveRates(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireCapability(canManageClients);

  const rows = [];
  for (const type of BOOKING_TYPES) {
    const parsed = bookingTypeRateSchema.safeParse({
      bookingType: type,
      baseCents: money(formData, `base.${type}`),
      hourlyCents: money(formData, `hourly.${type}`),
    });
    if (!parsed.success) {
      const errors = fieldErrors(parsed.error);
      return {
        errors: {
          [`base.${type}`]: errors.baseCents ?? "",
          [`hourly.${type}`]: errors.hourlyCents ?? "",
        },
      };
    }
    rows.push(parsed.data);
  }

  for (const row of rows) {
    await db
      .insert(bookingTypeRates)
      .values({ ...row, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: bookingTypeRates.bookingType,
        set: { baseCents: row.baseCents, hourlyCents: row.hourlyCents, updatedAt: new Date() },
      });
  }

  revalidateSettings();
  return { ok: true, message: "Rates saved." };
}
