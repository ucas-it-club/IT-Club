# Applying changes to Supabase production

There is no deploy pipeline. The supervisor applies database migrations and Edge
Functions to production (`jxweaxenswbjpxxjmihb`) from a laptop with the Supabase CLI,
after the change is merged to `master`.

## One-time setup on a laptop

```bash
npx supabase@latest login
```

```bash
npx supabase@latest link --project-ref jxweaxenswbjpxxjmihb
```

## After a PR with a migration merges

From an up-to-date `master` checkout, preview the pending migrations:

```bash
npx supabase@latest db push --remote --dry-run
```

Check that it lists only the new files, then apply them:

```bash
npx supabase@latest db push --remote --yes
```

Confirm that every version shows under both LOCAL and REMOTE:

```bash
npx supabase@latest migration list --remote
```

Merge a PR whose site code needs a new table or function only after its migration
is live; otherwise the live site asks for something that does not exist yet.

## After a PR that changes an Edge Function merges

```bash
npx supabase@latest functions deploy <name>
```

The `verify_jwt` setting for each function comes from `supabase/config.toml`.

## Rules

- Change production only through migration files in `supabase/migrations`, merged to
  `master`, then pushed as above. A change made in the dashboard, the SQL editor or
  through an MCP connection puts the migration history out of step with the repo
  and breaks the next `db push`. This rule is also in `AGENTS.md`.
- Name new migrations with a unique 14-digit timestamp later than the last file.
- Never edit a migration that has already run. A failed push leaves the migrations
  before it applied; fix forward with a new migration.

## History

On 2026-11-23 the history table was repaired so that its versions match the files
in this folder. Before that, migrations had been applied through the dashboard and
MCP under other version numbers. Production also had `content_slug_apostrophes`
(20260924112651), which has no file here; marking it reverted removed only its
history row, and its effect stays in the database.
