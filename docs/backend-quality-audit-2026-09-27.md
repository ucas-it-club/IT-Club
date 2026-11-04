# Backend and code quality audit — 2026-09-27

## Scope and verification limits

Reviewed Supabase migrations, browser data access, SSR caching, registration/contact integration, media lifecycle, sitemap function, and quality tooling. This is a repository audit, not a certification of the production deployment. No application code, production data, or deployed functions were changed.

The repository configures `supabase-itclub` at the Supabase MCP endpoint. That endpoint is reachable (an unauthenticated request returns 401), but no authenticated Supabase management tools are exposed to this session and no Supabase CLI is installed on PATH. Live migrations, grants, advisors, function settings, cron jobs and logs remain unverified. Reconnect/authenticate the configured MCP server and reload its tools to complete that portion.

## Current architecture

- Supabase: Auth, content/settings, administrator roles, media Storage and metadata, visit RPC, sitemap Edge Function.
- Google Apps Script: contact and membership intake, registration limits and counts, Google Sheets persistence.
- Browser: anonymous PostgREST reads, authenticated RLS-protected administration, direct Apps Script requests, image resizing, TanStack Query cache.
- SSR: per-request QueryClient, shared public-data promise cache (60 seconds), optional Cloudflare subrequest caching.

## Findings, in priority order

### P1 — Retired anonymous submission writes remain enabled

`supabase/migrations/202609090001_club.sql:115` grants anonymous insertion into `club_submissions`; line 133 permits it through RLS. No later migration removes it. `supabase/delete-legacy-submissions.sql` deletes rows but does not revoke writes. This permits callers to continue creating unused submissions directly, bypassing the current registration limit and duplicate checks. These rows do not enter the active Sheets workflow. There is no rate limit on this legacy path.

Remedy: revoke public insert privileges and remove the obsolete insert policy in an additive migration. If intake moves back to Supabase, permit only the controlled intake path. Verify actual live grants before deployment; preserve historical data.

### P1 — Public intake has no server-side abuse control

`integrations/google-sheets/Code.gs:131` accepts anonymous valid requests. Locks prevent concurrent capacity overshoot and UUIDs deduplicate retries, but fresh UUIDs and student IDs can consume capacity and Apps Script quotas. Contact submissions have no overall limit. UUID deduplication is not rate limiting or proof of identity.

Remedy: move intake to Supabase Edge Functions with bounded request sizes, schema validation, server-verified bot protection and atomic rate limiting. Enforce capacity, student-ID uniqueness and request idempotency transactionally in Postgres. Prevent bypass through the old public Apps Script endpoints when switching over.

### P2 — Registration state can remain wrong indefinitely

`src/components/club/RegistrationAdmin.tsx:114` mirrors registration availability into public settings only when an administrator saves. `src/components/club/FloatingJoin.tsx:22` reads that mirror. When the final slot fills, Apps Script closes intake but the flag remains true until a later admin save. Refreshing the content cache cannot repair this. The join-page cache also is not updated when configuration succeeds.

Remedy: use one authoritative registration status, updated in the same database transaction as accepted applications. Update/invalidate the shared registration query after configuration and successful submission. Avoid a second independently written availability flag.

### P2 — Public data transport grows with the entire database

`src/lib/club/public-api.ts:75` pages through every content row with `select=*`; `ClubProvider.tsx` repeats the fetch every 60 seconds in active views. All bilingual bodies, media URLs and `updated_by` administrator UUIDs travel to every page and into SSR hydration. Fetching in 500-row batches bounds each request, not the total payload. Offset pagination over mutable ordering is also vulnerable to skipped/duplicate rows during edits. The URL encodes ordering as repeated `order` parameters rather than a single documented ordering list.

Remedy: explicit public projections, separate summary lists from item detail, bounded route-specific queries, stable composite ordering and cursor pagination where needed. Keep audit identity out of the public projection and enforce that restriction at the database/API boundary if it is intended to be private. Use a single `order=updated_at.desc,id.asc` parameter.

### P2 — Multiple cache layers have no shared invalidation

`src/lib/club/ssr-data.ts` caches both the in-flight/result promise and potentially the upstream HTTP response. `changed()` invalidates only the current browser's public query; it cannot purge worker isolates or HTTP caches. Multiple TTL layers can extend effective staleness. The SSR comment claiming mount always refetches is inconsistent with the client's 60-second stale time.

Remedy: define an explicit public freshness budget; avoid redundant TTL layers or use versioned public responses and documented invalidation. Cache only successful public responses. Pass AbortSignals through public reads and set upstream deadlines so an unavailable origin cannot indefinitely delay SSR. Continue isolating private/authenticated responses from shared caches.

### P2 — Media operations depend on the browser completing multiple writes

`src/lib/club/supabase.ts:306` uploads an object, then inserts metadata. Cleanup on metadata failure ignores cleanup errors; closing the tab between steps leaves an orphan. Deletion marks metadata as deleting, removes Storage content, then deletes metadata, so interruption can leave pending rows. Existing database checks correctly protect referenced images, but do not reconcile abandoned operations.

Remedy: make finalization/deletion idempotent server workflows and add reconciliation for old pending operations/orphan uploads. An Edge Function is appropriate for orchestration; Storage and PostgreSQL still do not share one transaction. Keep browser image compression and direct RLS-protected uploads when useful.

### P2 — Sitemap silently truncates as content grows

`supabase/functions/sitemap/index.ts:67` makes one unpaginated content request and therefore inherits the API row cap. Older items disappear once the cap is exceeded. The anonymous caller in `src/server.ts` also relies on deployment settings absent from this repository (`supabase/config.toml` is missing).

Remedy: paginate with stable ordering, add upstream timeout/error handling and multi-page tests, and commit the function's intended authentication configuration. Verify the deployed public endpoint. The sitemap is already correctly placed in an Edge Function.

### P2 — Quality gates omit backend coverage

`package.json` runs only `tests/supabase.test.mjs`, omitting three existing test files. That database suite explicitly loads selected migrations and omits the visit-counter and visit-guard migrations. `tsconfig.json` excludes Edge Functions; a passing application typecheck says nothing about Deno compilation. No generated Supabase Database type is supplied to `createClient`; casts in loaders assume JSON shapes are valid. Settings receive only a broad JSON-object/size database check, so malformed admin/API writes can reach rendering unchecked.

Remedy: include all test files in the default test command, validate the complete migration chain in a real local Supabase environment (including cron/extensions), add Deno checks and Edge Function tests, generate database types, and validate JSON boundaries. Add tests for registration state convergence, intake abuse controls, interrupted media operations and cache behavior.

### P3 — Maintainability and operational conventions need cleanup

- `AdminPanel.tsx` is 1,341 lines and `ClubSite.tsx` exceeds 1,000; split by feature boundaries and explicit types.
- README describes obsolete collections and a Supabase submission workflow that is no longer active.
- `public-api.ts` silently falls back to a production project when environment variables are absent; `configured` is consequently always true. Database media URLs and Apps Script project URLs are also hardcoded. Require explicit environment selection to avoid accidental production access from another environment.
- Visit limiting performs a count-then-insert without per-IP serialization, so concurrent requests can exceed the hourly allowance. Every request also computes an exact count over all stored visits. Verify trusted proxy headers in production, use atomic limit enforcement, and consider a maintained aggregate if volume warrants it.
- `loadMedia()` filters all link rows once for each asset; index links by media ID or query relations directly as the library grows.

## Recommended Supabase boundaries

| Operation | Recommended home |
| --- | --- |
| Contact and membership intake | Edge Functions for validation/abuse controls; Postgres transaction for persistence, uniqueness, capacity and idempotency |
| Registration configuration | Authenticated Edge Function or secured RPC with super-admin authorization enforced server-side |
| Google Sheets export, if retained | Server-side integration with durable retry/outbox; never forward the administrator's JWT to Google |
| Media deletion/finalization/reconciliation | Idempotent Edge Function plus database guards |
| Sitemap | Existing Edge Function, hardened and paginated |
| Public content reads and ordinary admin CRUD | Direct Data API under tested RLS; an extra function is not inherently faster or safer |
| Image compression and display preferences | Browser |
| Atomic capacity, constraints and relational integrity | PostgreSQL |

The current Apps Script does validate the admin JWT through Supabase Auth and verifies the stored super-admin role; this audit does not claim an authentication bypass. Moving that workflow removes an unnecessary third-party token boundary and consolidates backend ownership.

Migration should introduce the new authoritative intake transaction and tests, reconcile existing Sheets counts/IDs before cutover, switch clients, then disable obsolete write paths. Update the privacy notice to match where personal data is actually stored. Do not silently duplicate existing personal data during an audit.

## Good foundations

RLS is enabled on application tables in the checked migrations. Administrator authorization uses a database role table rather than editable user metadata. Most privileged helpers have an empty search path and live in a private schema. Content/media references are synchronized transactionally and protect in-use media. Storage uploads use unique immutable paths, reject overwrites and set a long cache lifetime. SSR QueryClients are created per router request. Apps Script uses a lock for capacity, retry IDs, and literal rich-text writes to prevent spreadsheet formula execution. Client and server form validation both exist.

## Checks run

- `npm run typecheck`: passed.
- `npm test`: passed (one test file).
- `node --test tests/*.test.mjs`: passed (all four test files).
- `npm run lint`: failed with 2,109 errors and 22 warnings; all reported errors are marked potentially autofixable. Output includes prototype/vendor/tooling files and first-party script/test formatting. Fix lint scope before considering a broad formatter run.
- `npm run build`: passed; warns about a 618 KB minified client chunk (193 KB gzip) and redundant tsconfig-paths plugin.
- No production submissions, writes, deployments, or privileged database queries were performed.

## Official guidance consulted

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Securing Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)

Supabase supports direct client access protected by RLS. Edge Functions should own server orchestration and integrations where needed, with caller authentication and database authorization preserved. Publishable keys identify the application; they are not user credentials or secrets.
