/**
 * Applies every SQL file in ./drizzle in order, tracking what has already run
 * in a `_studio954_migrations` table. Safe to re-run: applied files are
 * skipped, so existing studio data is never rebuilt.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import postgres from "postgres";

const MIGRATIONS_DIR = join(process.cwd(), "drizzle");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env.local first.");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, prepare: false });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS _studio954_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`;

    const applied = new Set(
      (await sql<{ name: string }[]>`SELECT name FROM _studio954_migrations`).map((r) => r.name),
    );

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql") && f !== "seed.sql")
      .sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) continue;

      const contents = await readFile(join(MIGRATIONS_DIR, file), "utf8");
      // `--> statement-breakpoint` is Drizzle's separator; postgres.js runs the
      // whole file in one simple query, so the markers are just comments.
      await sql.unsafe(contents);
      await sql`INSERT INTO _studio954_migrations (name) VALUES (${file})`;
      console.log(`applied ${file}`);
      ran += 1;
    }

    console.log(ran === 0 ? "Database already up to date." : `Applied ${ran} migration(s).`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
