// One place that replays supabase/migrations into a PGlite database for tests.
// A new migration needs no test edits: tests name the migration they stop at.
import { readFileSync, readdirSync } from "node:fs";

const dir = "supabase/migrations";
// PGlite has no pgcrypto or pg_cron, which the visit counter needs.
const unsupported = /visits|visit_guard/;
const files = readdirSync(dir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

/** The one migration file whose name contains `name`. */
export function migrationFile(name) {
  const found = files.filter((file) => file.includes(name));
  if (found.length !== 1) throw new Error(`${found.length} migrations match "${name}"`);
  return found[0];
}

/** Runs one migration by part of its name. */
export async function applyMigration(db, name) {
  await db.exec(readFileSync(`${dir}/${migrationFile(name)}`, "utf8"));
}

/**
 * Runs migrations in filename order: from `from` (included) up to `before`
 * (left out). Either bound is part of a migration name; leave both out for all.
 */
export async function migrate(db, { from, before } = {}) {
  const start = from ? files.indexOf(migrationFile(from)) : 0;
  const end = before ? files.indexOf(migrationFile(before)) : files.length;
  for (const file of files.slice(start, end)) {
    if (!unsupported.test(file)) await db.exec(readFileSync(`${dir}/${file}`, "utf8"));
  }
}
