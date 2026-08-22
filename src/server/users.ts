import "server-only";

import { asc } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

/** Everyone with an account, admins first. Password hashes never leave here. */
export async function listUsers() {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.role), asc(users.name));
}
