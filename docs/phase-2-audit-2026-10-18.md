# IT Club site — state audit and Hala's improvement list

Date: 2026-10-18. Repo pulled to `1cc428b` (45 new commits, all by Hala, merged via PRs #3–#8).

## 1. Hala's list, formatted

Source: WhatsApp, 18/10 2:31–2:48 pm. Goal stated: every item eases the user experience and widens the club's reach.

| # | Item | Status in code | Blocker / open question |
|---|------|----------------|-------------------------|
| 0 | **Preview mode** — editor previews content before publishing to catch mistakes | **Done** — merged today (`f4e1d77`, PR #8). "Preview final appearance" toggle in the admin editor. | Covers news, events and partners only. Members have no preview. |
| 1 | **Partners page: contact section** for prospective partners (example to come from the Island Haven site) | Not started | Live DB has **0 partners**, so `isUnavailableSection` hides `/partners` from navigation and answers 404. A partner CTA on that page is invisible today. `PRODUCT.md` also records that the contact form was removed on purpose. Island Haven reference not received yet. |
| 2 | **Share button** on news, events and team | Not started | News and event URLs are positional (`/news/3`, commit `f19462d`). Deleting an item shifts every later number, so shared links can point to the wrong item. Team is hidden (`teamVisible = false`). |
| 3 | **Join form tailored for recruitment** (corrected in chat from "contact us" to "join us") | Partial — join form exists: name, `@smail` email, phone, 9-digit ID, major, committee, message | No spec for "custom". Which new fields? Registration is **open** in live settings. |
| 4 | **Upcoming-event registration form** writing to one Google Sheet, one new tab per event | **Done** (`6032a8a`, `a656dac`, hardened in `bf1747f`) | — |
| 5 | **Team search** — small, modern, does not clutter the page | Not started | Team page hidden until photos are fixed. 42 members, 0 with photos. |

Context from the same chat:
- Relations team works on partnerships in parallel.
- New-student intake starts soon.
- Team page is hidden until member photos are edited.
- Member projects / skills / achievements: Hala places these **after** items 1–5.

## 2. Code health

- Typecheck clean. Tests: 99/99 pass.
- `npm run lint` fails with 2040 problems, **all inside `tools/oxlint/anti-slop`** (vendored rule sources). App code is clean, but `npm run check` cannot pass. Fix: add `tools/oxlint` to `ignores` in `eslint.config.js`.
- `AdminPanel.tsx` is 1630 lines and every feature lands in it. Next admin features will be slower and riskier to review.
- Positional public URLs for news/events (see item 2). Members already use stable slugs.
- Member profile pages are merged (`profileEnabled`, slug, title, description, GitHub, LinkedIn). **0 of 42** members have a profile enabled. No fields for skills, projects or achievements.
- `PRODUCT.md` is stale: says 36 members / 1 photo / 0 news / registration closed. Live: 42 members / 0 photos / 23 news / 6 events / 0 partners / registration open / 585 visits.
- Legacy `club_content` table is empty and still present.
- Remote branches: 6 `codex/*` branches fully merged (safe to delete on GitHub). `fix/root-error-component` has 1 unmerged commit from 2026-09-16 — decide or close.

## 3. Supabase advisors (security)

- WARN: `public.rls_auto_enable()` is `SECURITY DEFINER` and executable by `anon` and `authenticated`. Revoke `EXECUTE`.
- WARN: Leaked password protection is off for Auth. Turn it on (dashboard toggle).
- WARN: `club_prepare_media_delete` executable by `authenticated`. Confirm it checks admin role inside.
- INFO: `club_visits` has RLS with no policies, and `record_club_visit` is anon-callable. Intentional (writes go through the RPC).

## 4. Phase two conflict to settle

`PRODUCT.md` states: "Projects and achievements were deliberately removed from scope in SRS v2.0 and stay out." The proposal to add member projects, skills and achievements reverses that decision. The club's own goals in `club_settings` ("supporting students in developing their technical projects") argue for it. This needs an explicit decision and an SRS/`PRODUCT.md` update before any build.
