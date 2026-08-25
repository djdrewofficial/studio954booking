import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cache } from "react";

import bcrypt from "bcryptjs";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import type { UserRole } from "./domain";

const COOKIE_NAME = "s954_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

/* ---------------------------------------------------------------------------
 * Passwords
 * ------------------------------------------------------------------------ */

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/* ---------------------------------------------------------------------------
 * Sessions
 *
 * The cookie holds a random opaque token; only its SHA-256 digest is stored,
 * so a leaked database dump cannot be replayed as a login.
 * ------------------------------------------------------------------------ */

function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({ userId, tokenHash: digest(token), expiresAt });

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, digest(token)));
  }
  jar.delete(COOKIE_NAME);
}

/**
 * Resolves the signed-in user for the current request. Wrapped in `cache` so
 * a page that checks permissions in several places still makes one query.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, digest(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const user = rows[0];
  if (!user || !user.isActive) return null;

  return { id: user.id, name: user.name, email: user.email, role: user.role as UserRole };
});

/** Guards a page or server action. Redirects to the login screen when absent. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Guards admin-only surfaces (studio settings, sets, add-ons, people). */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/today");
  return user;
}

/**
 * Guards an action behind one of the rules in `lib/domain`.
 *
 * Server actions are reachable by anyone signed in, whatever the interface
 * chooses to render, so every write goes through a check here rather than
 * relying on a hidden button.
 */
export async function requireCapability(
  allowed: (role: UserRole) => boolean,
): Promise<SessionUser> {
  const user = await requireUser();
  if (!allowed(user.role)) redirect("/today");
  return user;
}

/** Housekeeping — drops expired rows. Cheap enough to call on sign-in. */
export async function pruneExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

/**
 * Compares two secrets without leaking length or content through timing.
 * Used for the cron shared secret, not for passwords.
 */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
