import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * The connection is opened on first query rather than at import time. Next.js
 * evaluates route modules while collecting page data during a build, and a
 * build machine has no reason to hold database credentials.
 *
 * A single postgres.js pool is reused across hot reloads in development so we
 * do not exhaust Supabase connection slots.
 */
const globalForDb = globalThis as unknown as {
  studio954Sql?: ReturnType<typeof postgres>;
  studio954Db?: PostgresJsDatabase<typeof schema>;
};

/** Tokens that survive from .env.example when the file has not been filled in. */
const PLACEHOLDERS = ["YOUR-PASSWORD", "PROJECT_REF"];

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url || PLACEHOLDERS.some((token) => url.includes(token))) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill in the Supabase connection string.",
    );
  }
  return postgres(url, {
    max: process.env.NODE_ENV === "production" ? 10 : 6,
    prepare: false, // required when using Supabase's transaction pooler
    // The pooler drops connections it considers idle. Recycling ours first
    // avoids handing a dead socket to a request, which presents as a hang
    // rather than an error.
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    // Fail loudly instead of stalling a page render indefinitely.
    connect_timeout: 15,
  });
}

export function getSql() {
  globalForDb.studio954Sql ??= connect();
  return globalForDb.studio954Sql;
}

function getDb(): PostgresJsDatabase<typeof schema> {
  globalForDb.studio954Db ??= drizzle(getSql(), { schema, casing: "snake_case" });
  return globalForDb.studio954Db;
}

/**
 * Behaves exactly like a Drizzle client, but defers connecting until the first
 * property is touched. Methods are bound to the real client so `this` inside
 * Drizzle never sees the proxy.
 */
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, property) {
    const real = getDb();
    const value = Reflect.get(real, property, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
