# Backend optimization progress — 2026-09-27

## Implemented locally

- Public content requests use an explicit column projection and a single `updated_at.desc,id.asc` ordering parameter. `updated_by` is retained because the admin screen currently shares this query; this is not a database privacy boundary.
- Public loading shares an eight-second deadline across content pages and settings. TanStack Query cancellation propagates to the browser requests. Other public API calls also receive an eight-second deadline.
- SSR retains request coalescing and the 60-second isolate cache, but disables upstream HTTP caching. Failures evict the cached promise. Hydrated clients can retain the snapshot for another 60 seconds; browser invalidation does not purge other clients or isolates.
- Sitemap reads successive pages until empty, advances by actual row count, orders by timestamp and ID, and returns an uncached 502 for upstream failures. One eight-second deadline covers all pages. The existing public JWT setting is now recorded in `supabase/config.toml`.
- `npm test` includes all five test files. New regression coverage exercises public ordering/cancellation, sitemap pagination/failures, and SSR coalescing/failure recovery/forced refresh.

## Evidence and limits

The new transport tests failed against the previous implementation and pass with these changes. A 501-item sitemap fixture now includes the last item across pages. The public-query test verifies a single composite ordering parameter and cancellation on both reads. The cache test verifies that simultaneous callers reuse one read, failures permit retries, and a forced refresh bypasses the isolate cache. These are correctness and bounded-wait improvements, not measured production latency gains.

Read-only Supabase inspection confirmed that `club_submissions_create` still grants an INSERT policy to `anon` and `authenticated`. Grants have not yet been checked. The deployed sitemap is version 1, active, with `verify_jwt=false`. No production changes were made.

## Remaining audit work

- Revoke obsolete submission writes with an additive, tested migration after checking grants and callers.
- Design and cut over authoritative intake, abuse controls, registration state, and Sheets reconciliation/export together.
- Separate admin/public projections and route-specific list/detail queries. Current public loading still fetches the full collection, and offset pagination can shift during concurrent edits.
- Add idempotent media workflows and reconciliation.
- Validate the full migration chain with extensions, generate database types, validate JSON boundaries, and correct repository-wide lint scope.
- Remove implicit production configuration only alongside explicit deployment configuration.
- Address visit limiting, media lookup complexity, and the large client bundle with measurements.
- Sitemap offset pagination is not a transactional snapshot; concurrent edits can move rows between pages. Very large sitemaps will also need sitemap indexes and protocol size limits.

## Verification

- `npm test`: passes, all five files.
- `npm run typecheck`: passes.
- Targeted ESLint: no errors, two existing Fast Refresh warnings in ClubProvider.
- `deno check supabase/functions/sitemap/index.ts`: passes.
- `npm run build`: passes; existing large-chunk and build-plugin warnings remain.
