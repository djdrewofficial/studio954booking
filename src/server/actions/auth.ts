"use server";

import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { users } from "@/db/schema";
import {
  createSession,
  destroySession,
  hashPassword,
  pruneExpiredSessions,
  verifyPassword,
} from "@/lib/auth";
import { fieldErrors, loginSchema } from "@/lib/validation";

export type AuthFormState = { errors?: Record<string, string> };

/** True while the database has no accounts — unlocks the first-run screen. */
export async function hasAnyUser(): Promise<boolean> {
  const [row] = await db.select({ n: count() }).from(users);
  return (row?.n ?? 0) > 0;
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  // Same message either way — never reveal which half was wrong.
  const invalid = { errors: { form: "That email and password do not match an account." } };
  if (!user || !user.isActive) return invalid;

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return invalid;

  await pruneExpiredSessions();
  await createSession(user.id);
  redirect("/today");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/**
 * Creates the very first administrator. Guarded by the empty-table check so it
 * cannot be replayed once the studio has accounts.
 */
export async function createFirstAdmin(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (await hasAnyUser()) {
    return { errors: { form: "An account already exists. Sign in instead." } };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Enter your name";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = "Enter a valid email";
  if (password.length < 10) errors.password = "Use at least 10 characters";
  if (Object.keys(errors).length) return { errors };

  const [user] = await db
    .insert(users)
    .values({ name, email, role: "admin", passwordHash: await hashPassword(password) })
    .returning({ id: users.id });

  await createSession(user.id);
  redirect("/today");
}
