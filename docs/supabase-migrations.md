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

## Test a migration locally before it merges

The PGlite tests (`npm test`) cover rules and triggers. To run a migration on
real Postgres with copies of live rows, and click through the admin against it,
use the local Supabase stack. It needs Docker.

**One stack per machine.** Every checkout and worktree shares `project_id`
`jxweaxenswbjpxxjmihb`, so a second `start` takes over the first one's
containers. Check `docker ps | grep jxweaxenswbjpxxjmihb` before starting, and
reuse a running stack. Use the same pinned CLI version every time: a different
version wants different images, pulls them (the first pull is about 20 minutes)
and restarts the stack.

1. Start the stack without the services the site doesn't use:

   ```bash
   npx supabase@2.121.0 start -x logflare,vector,realtime,imgproxy,edge-runtime,supavisor
   ```

   `npx supabase@2.121.0 status` prints the API URL, the publishable key and the
   secret key used below.

2. Reset to just before the new migration. `<ts>` is the timestamp of the last
   migration already in production:

   ```bash
   npx supabase@2.121.0 db reset --local --version <ts>
   ```

3. Load copies of the live rows the migration touches. Read them from production
   with a read-only `select json_agg(...)` query, then insert them locally with
   `jsonb_to_recordset`, wrapped in `set session_replication_role=replica;` so the
   triggers don't rewrite them. Keep a
   `<table>_before` copy to compare against afterwards. Run SQL locally with:

   ```bash
   docker exec -i supabase_db_jxweaxenswbjpxxjmihb psql -U postgres -v ON_ERROR_STOP=1
   ```

4. Apply the pending migrations, then compare every row with its copy:

   ```bash
   npx supabase@2.121.0 migration up --local
   ```

5. Create the local super admin: create `itclub@ucas.edu.ps` with
   `POST http://127.0.0.1:54321/auth/v1/admin/users` (secret key as `apikey` and
   bearer token, `"email_confirm": true`) or in Studio at http://127.0.0.1:54323,
   then pipe `supabase/bootstrap-admin.sql` into the `psql` command above.

6. Run the site against the local stack:

   ```bash
   VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key> npm run dev -- --port 8082
   ```

   Confirm in the browser's network requests that calls go to `127.0.0.1:54321`,
   not production.

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
