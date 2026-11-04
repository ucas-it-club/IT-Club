# Architecture and maintenance boundaries

This document is the short operational map for changing the application safely.
Product scope and business rules remain in `PRODUCT.md` and
`docs/srs-implementation.md`.

## Runtime paths

### Public website

1. TanStack Router resolves the Arabic or English URL.
2. Route loaders warm the shared React Query entry through `ssr-data.ts`.
3. `public-api.ts` reads public rows through PostgREST without loading the
   Supabase SDK into the public entry bundle.
4. The server entry caches eligible HTML at the Cloudflare edge. Admin pages,
   query-string URLs, failures, redirects, and responses that set cookies are
   never cached as public HTML.
5. `ClubProvider` owns browser refreshes and language/theme-facing state.

### Administration

The admin route loads the administration UI and Supabase SDK only when needed.
The browser UI is not the authorization boundary: PostgreSQL grants, RLS
policies, constraints, and security-definer functions enforce permissions.

### Registration

Membership and event registrations go to the join Google Apps Script
deployment. Administrative configuration requests include the current
Supabase access token, which the script verifies. The legacy contact deployment
is kept separate and must not gain registration or configuration actions.

## Module boundaries

| Area | Owns | Must not own |
| --- | --- | --- |
| `src/routes` | URL parsing, loaders, page metadata | Business forms or database mutations |
| `src/lib/club/model.ts` | Shared domain types, schemas, pure rules | Network calls or React state |
| `src/lib/club/public-api.ts` | Anonymous public reads | Authenticated administration |
| `src/lib/club/supabase.ts` | Authenticated CRUD, auth, and storage | Page rendering |
| `src/lib/club/sheets.ts` | Apps Script transport and response validation | UI messages beyond error mapping |
| `src/components/club` | Rendering and interaction orchestration | Authorization guarantees |
| `supabase/migrations` | Database invariants and authorization | Presentation behavior |

Prefer a small domain component or pure helper when a page component starts to
own unrelated state, validation, formatting, and rendering. Keep network calls
in `src/lib/club`, and keep route files thin.

## Change checklist

Before merging a change:

1. Preserve Arabic-first RTL and English LTR behavior.
2. Preserve empty states, missing member photos, and closed registration.
3. Add a new timestamped migration; never rewrite a migration already applied.
4. Keep service-role keys and passwords out of source and all `VITE_*` values.
5. Update both browser-side validation and database constraints when changing
   persisted content.
6. Update Apps Script contract tests when its deployment or response changes.
7. Run `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build`.

## Generated and local artifacts

Do not edit `src/routeTree.gen.ts` manually. Build output, report previews,
temporary PDF renders, and exported spreadsheets are local artifacts and must
remain outside source control unless a specific deliverable is intentionally
being published.
