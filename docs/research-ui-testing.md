# Research: how to test the UI (#37)

Status: recommendation for the supervisor to decide. Nothing here changes CI yet.

## The problem

Today every test is `node --test tests/*.test.mjs`. These tests cover:

- SQL and RLS rules, run in PGlite;
- pure helpers from `src/lib` (Node 24 strips the types from `.ts` imports);
- "source-string" checks. They read a component file and match a regex, for example `tests/card-slide.test.mjs` asserts that `HomeNews.tsx` no longer calls `startViewTransition`.

No test renders a page. No test runs a browser. So nothing checks layout, stacking, RTL mirroring, or animation. Bug #61 is the clear case: the home story cards slid over the sticky header. A regex can stop that one exact code path from coming back. It cannot see the next overlap.

Versions checked in `package.json` (2026-11-23): React `^19.2.0`, Vite `^8.2.0`, `@tanstack/react-start` `^1.168.32`, Tailwind `^4.2.1`. Latest on npm: `@playwright/test` 1.65.1, `vitest` 5.1.1, `@vitest/browser-playwright` 5.1.1, `happy-dom` 21.0.4, `@testing-library/react` 16.3.3. Vitest 5.1.1 accepts `vite ^6.4 || ^7 || ^8` as a peer, so all options work with this Vite version. Docs were read from Context7 (`/microsoft/playwright`, `/vitest-dev/vitest`).

## Options compared

### A. Current approach: `node --test`, PGlite, source-string checks

- **Arabic/English and RTL:** only through strings. A test can assert that a component holds both Arabic and English text, or that `__root.tsx` sets `dir`. It cannot check that a page renders RTL or that anything mirrors.
- **CI runtime:** measured locally at about 33 s for 164 tests (`npm test`). No downloads.
- **Setup cost:** none. It exists already.
- **Upkeep and flakiness:** no flakiness. Source-string checks break on harmless refactors and can pass while the real UI is broken. They check how the code is written, not what the user sees.
- **Fit with TanStack Start + Vite:** fine for `src/lib` logic. It cannot load components: `.tsx`, the `@/` alias, CSS imports and Vite's `import.meta.env` all need Vite.

### B. Component tests: Vitest + Testing Library (happy-dom or jsdom), or Vitest browser mode

- **Arabic/English and RTL:** can render a component with `lang` set to `ar` or `en` and check the text. In happy-dom and jsdom, `dir="rtl"` is only an attribute. These environments have **no layout engine**: `getBoundingClientRect()` returns zeros and CSS is not applied, so mirroring, overlap and animation cannot be checked. Vitest browser mode (`@vitest/browser-playwright`) runs in real Chromium and does have layout.
- **CI runtime:** happy-dom is fast (seconds), with no browser download. Browser mode needs the same Chromium download as Playwright (see C).
- **Setup cost:** high for this codebase. Most club components read `useClub()` and render TanStack Router `<Link>`. Each test needs a harness with a club data provider, a memory router and a query client. That harness has to follow every change to `ClubProvider` and the router. Also a new `vitest.config.ts` that reuses the Lovable Vite config without its build-only plugins (nitro, Cloudflare).
- **Upkeep and flakiness:** happy-dom and jsdom are stable but differ from browsers in small ways. The harness is extra code to maintain.
- **Fit with TanStack Start + Vite:** good for isolated components (Vitest is Vite-native). Weak for full pages: routes, loaders, SSR and `head()` are outside a component render.
- **Would it have caught #61?** happy-dom/jsdom: no. Browser mode: only if the test mounted the header and the cards together and scrolled, which is a page test in all but name.

### C. Browser end-to-end tests: Playwright against the dev or preview server

- **Arabic/English and RTL:** full coverage. The test loads `/contact` and `/en/contact` as a user would. It checks `html[lang][dir]` from SSR, real text, and real positions (for example, the call to action sits on the left in Arabic and on the right in English).
- **CI runtime:** measured locally:
  - The 2 proof-of-concept tests, including the dev server start: 15 s with a warm Vite cache, 44 s on a cold first compile.
  - The Chromium headless shell download is 126 MiB. It took about 3 minutes on a home connection. GitHub-hosted runners download much faster, and `actions/cache` on `~/.cache/ms-playwright` removes most of the cost. In CI, use `npx playwright install --with-deps --only-shell chromium` (only the headless shell, with its system packages).
  - Expected cost for a small suite: about 1 to 2 minutes extra per CI run, in its own job.
- **Setup cost:** low. One dev dependency, one `playwright.config.ts`, and a `webServer` entry that starts Vite. No harness: the real app, routes and providers run as they are.
- **Upkeep and flakiness:** Playwright auto-waits and retries web-first assertions, which removes most timing flakiness. Known risks for this site:
  - The **boot screen** covers the page on the first visit in each tab. Tests set `sessionStorage['ucas-boot']` before load to skip it (see `e2e/contact.spec.ts`).
  - **GSAP and hero animations**: tests should wait for an end state, or use `reducedMotion: 'reduce'` where the site honours it. They must never use fixed sleeps.
  - **Live data**: with no Supabase env, the site renders its empty state. That is what CI has. A local `.env` would point tests at the live database, so tests must not depend on content.
- **Fit with TanStack Start + Vite:** good. It tests the real SSR output and hydration. `webServer` can run `vite dev` (no build needed) or `vite preview` after the build that `npm run check` already does.
- **Would it have caught #61?** Yes, if a test scrolls the home page during a card switch and checks that the header stays on top (`document.elementFromPoint` at the header returns the header). The proof of concept uses the same check on the contact heading.

### Summary

|                          | A. `node --test` | B. Vitest + happy-dom | B'. Vitest browser mode | C. Playwright e2e |
| ------------------------ | ---------------- | --------------------- | ----------------------- | ----------------- |
| RTL layout and overlap   | no               | no                    | yes                     | yes               |
| Arabic/English text      | strings only     | yes                   | yes                     | yes               |
| SSR `lang`/`dir`, routes | no               | no                    | no                      | yes               |
| Browser download         | no               | no                    | yes                     | yes               |
| Extra CI time            | 0                | seconds               | ~1–2 min                | ~1–2 min          |
| Setup cost here          | none             | high (harness)        | high (harness)          | low               |
| Flakiness                | none             | low                   | low–medium              | low–medium        |

## Recommendation

Keep `node --test` for SQL, RLS and pure logic. **Add a small Playwright suite** for page-level checks in both languages. Skip component tests for now: the harness costs more than it returns, and the bugs we have had are layout bugs that happy-dom cannot see.

**It will catch:**

- a page that fails to render or throws during hydration, in `/…` or `/en/…`;
- a wrong `lang`/`dir`, or an element that does not mirror in RTL;
- an element covered by another one, such as the sticky header (#61);
- broken navigation between pages, and missing headings or links (by role and name, which also helps accessibility).

**It will not catch:**

- pure visual changes such as colour, font or spacing that move nothing out of place. Screenshot comparison (`toHaveScreenshot`) could, but Arabic font rendering differs between machines, so it should stay out of scope for now;
- Supabase data rules (stay in PGlite tests) and behaviour that needs a signed-in admin with real data;
- Safari- or Firefox-only bugs, unless WebKit and Firefox projects are added later;
- animation smoothness. A test can check the start and end states of an animation, not how it looks in between.

## Proof of concept

- `playwright.config.ts`: Chromium only, starts `vite dev` on port 5179 (its own port, so it never reuses another dev server by mistake).
- `e2e/contact.spec.ts`: loads `/contact` and `/en/contact` and checks:
  - `html` has `lang="ar" dir="rtl"`, or `lang="en" dir="ltr"`;
  - the `h1` shows in the right language and nothing covers it (`elementFromPoint`);
  - there are at least 3 contact bands;
  - in each band, the call to action sits at the reading end: to the left of the name in Arabic, to the right in English.
- To prove the check is real, `dir="ltr"` was forced on the band links for a moment. The Arabic test failed (`Expected: <= 144`, `Received: 1199`) and the English test still passed.

It is **not** in `npm test` or `npm run check`, so CI is unchanged.

### How to run it

```bash
bun install
```

```bash
npx playwright install chromium
```

```bash
npm run test:e2e
```

If a dev server already runs on port 5179, Playwright reuses it (except in CI). Failures leave a trace in `test-results/`; open it with `npx playwright show-trace <path>`.

## Draft follow-up tickets

These are drafts. No GitHub issues were created.

### 1. Run the Playwright suite in CI

- **What to build:** a separate `e2e` job in `.github/workflows/check.yml`. It installs with Bun, caches `~/.cache/ms-playwright`, runs `npx playwright install --with-deps --only-shell chromium`, then `npm run test:e2e`. It uploads `test-results/` as an artifact when the job fails.
- **Acceptance criteria:**
  - The job runs on pull requests to `master`, in parallel with `check`.
  - A cached run adds no more than 2 minutes.
  - A failing test fails the job and uploads the trace.
  - The job is a required check only after it has been green on 10 consecutive PRs.

### 2. Home story cards and the sticky header (#61 regression test)

- **What to build:** `e2e/home-stories.spec.ts`. It switches the home story cards while the page is scrolled. It checks that the header stays on top during and after the switch, and that the active card changes. Use test data or route mocking so the test does not depend on live content.
- **Acceptance criteria:**
  - The test runs in `/` and `/en`.
  - It fails when the View Transitions code from before #61 is restored.
  - It passes 20 times in a row locally (`--repeat-each=20`).

### 3. Smoke test every public page in both languages

- **What to build:** one table-driven spec over the public pages (home, about, team, events, news, join, contact, feedback, privacy). It checks status 200, `lang`/`dir`, one `h1`, and no console errors, in Arabic and English.
- **Acceptance criteria:**
  - All pages are covered in both languages, except the Arabic-only `/ask`.
  - A thrown render error or a console error fails the test.
  - The whole spec runs in under 60 s in CI.

### 4. Test data for e2e runs

- **What to build:** a way to give the browser tests known club data without the live database. For example, route mocking with `page.route()` on the Supabase REST calls, or a local Supabase seeded from `supabase/` migrations.
- **Acceptance criteria:**
  - Tests can render news, events and members with fixed content.
  - The tests never call the production project.
  - The approach is documented in this file.

### 5. Retire source-string checks that the browser tests replace

- **What to build:** once tickets 1 to 3 have landed, review the regex checks over `.tsx` files in `tests/`. Remove each one that a browser test now covers better.
- **Acceptance criteria:**
  - Each removed check names the e2e test that replaces it, in the PR.
  - `npm test` stays green.

## Open questions for the supervisor

- Should the e2e job block merges from the start, or only report until it is proven stable (ticket 1 assumes report-only first)?
- Is about 1 to 2 minutes of extra CI time per PR acceptable?
- Should tests also run on mobile viewports (a Pixel or iPhone profile)? Most visitors are probably on phones.
- Is WebKit (Safari) coverage wanted? It adds another browser download.
