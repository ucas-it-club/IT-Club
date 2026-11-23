# Supabase production deploy

`.github/workflows/supabase-deploy.yml` deploys the database and Edge Functions to
production (`jxweaxenswbjpxxjmihb`) when a push to `master` changes anything under
`supabase/`. It can also be started by hand from the Actions tab ("Run workflow").

Steps, in order; any failure stops the rest:

1. Run every test that replays the migrations in PGlite.
2. `supabase link`, then `supabase db push --remote --dry-run` to log what will run.
3. `supabase db push --remote --yes` applies new migrations.
4. `supabase functions deploy` deploys all functions with the `verify_jwt` settings in `supabase/config.toml`.

Only one deploy runs at a time, and a running deploy is never cancelled.

## One-time setup

### 1. Secrets

In GitHub: Settings → Environments → New environment `production`, then add these
environment secrets:

| Secret                  | Where to get it                                                     |
| ----------------------- | ------------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens → Generate new token         |
| `SUPABASE_DB_PASSWORD`  | Supabase dashboard → Project Settings → Database (reset if unknown) |

Optional: add yourself as a required reviewer on the `production` environment, so
every deploy waits for a click.

### 2. Repair the migration history

Production's history table (`supabase_migrations.schema_migrations`) was filled by
applying migrations through the dashboard and MCP, so its version numbers do not
match the file names in `supabase/migrations`. Until they match, `db push` stops with
"Remote migration versions not found in local migrations directory" and changes nothing.

The repair only rewrites that history table; it runs no migration and changes no
schema. Run it once, from a machine with the Supabase CLI and the access token:

```bash
supabase link --project-ref jxweaxenswbjpxxjmihb
```

```bash
supabase migration repair --remote --yes --status reverted 20260923134700 20260924105717 20260924112603 20260924112651 20261006141945 20261007091146 20261007103437 20261008102251 20261010101711 20261013173425 20261103115721 20261103124258 20261103184109 20261104162527 20261104212829
```

```bash
supabase migration repair --remote --yes --status applied 202609090001 202609120001 202609150001 202609150002 202609170001 202609170002 202609190001 202609230001 202609240001 202609240002 202610030001 202610060001 202610070001 202610070002 202610080001 202610080002 20261013202822 20261103114340 20261103123130 20261103183333 20261104160428 20261104190000
```

```bash
supabase migration list --remote
```

Every local file up to `20261104190000_achievements.sql` should then show the same
version under LOCAL and REMOTE. Any migration added after that is applied by the
workflow.

Production also had `content_slug_apostrophes` (20260924112651), which has no file in
the repo. Marking it reverted only removes the history row; whatever it changed stays
in the database.

## Rules from here on

- Change production only through migration files merged to `master`. A change made in
  the dashboard or through MCP puts the history out of step again.
- A failed `db push` leaves earlier migrations in that run applied. Fix forward with a
  new migration; do not edit a file that has already run.
