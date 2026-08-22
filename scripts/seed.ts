/**
 * Loads development seed data. Idempotent — every row carries a fixed id and
 * re-running only fills gaps, so it will not clobber real bookings.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env.local first.");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, prepare: false });
  try {
    const contents = await readFile(join(process.cwd(), "drizzle", "seed.sql"), "utf8");
    await sql.unsafe(contents);
    console.log("Seed data loaded.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
