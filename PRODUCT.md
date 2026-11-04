# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Visitor (primary).** A UCAS student — most often a first- or second-year in one of the four IT majors — arriving from an Instagram or Facebook post on a phone, on a Palestinian mobile connection. Job: work out what this club is, whether the people in it are like them, and whether joining is worth it. Secondary visitors: faculty and prospective partner organisations checking whether the club is real and active.
- **Club member.** Appears in the team listing. Membership grants no admin account.
- **Editor.** Signs in to manage members, events, news, partners and media.
- **Super admin.** Editor rights plus account management, settings and the registration cap.

## Product Purpose

The public face of UCAS IT Club: a bilingual (Arabic-default, English-toggle) site that introduces the club, shows who is in it, records what it has done, names its partners, and takes membership applications. Success is a student who lands from social media, understands the club within one screen, and either applies or follows it.

## Positioning

A student-run club site that is genuinely maintained by students — content, media library, permissions and all — rather than a brochure page a department published once. Arabic is the first-class language, not a translation layer.

## Operating Context

- Arabic (RTL) is the default; English (LTR) is a toggle. Every piece of content carries both, and direction flips with the language.
- Mobile-first in practice. Assume a mid-range Android on a constrained connection.
- Editors manage content through `/admin`, backed by Supabase Postgres with RLS, Auth and Storage. The media library compresses uploads and caps the long edge at 1600px.
- Membership applications go to Google Sheets through Google Apps Script, which also carries the open/closed flag and the registration cap. The endpoint currently answers in ~3 s.
- Registration is closed at the time of writing.
- A visit counter records a random `sessionStorage` id; it does not identify people.
- Hosting is Cloudflare, code on GitHub, project connected to Lovable (published history must not be rewritten).

## Capabilities and Constraints

- Content collections are exactly four: `members`, `events`, `news`, `partners`. **Projects and achievements were deliberately removed from scope in SRS v2.0 and stay out.** The club's body of work is represented through events, news and the team, not a portfolio.
- No payment, no student-information-system integration, no student login accounts, no automatic acceptance of applications.
- Contact is social cards plus an email address — the contact form was deliberately replaced.
- Committees: media, relations, activities. Majors: mobile apps, mobile games, web, multimedia.
- Join form validates a `@smail.ucas.edu.ps` address, a 9-digit student id and a Palestinian mobile number.
- Free-tier services with watchable quotas. No automatic paid upgrades.
- No email notification provider is connected; student data is not sent to one.
- Stack is fixed: React 19, TypeScript, TanStack Start/Router, Vite, Tailwind v4, Radix UI, Lucide.

## Brand Commitments

- Name: **UCAS IT CLUB** / النادي التكنولوجي — الكلية الجامعية للعلوم التطبيقية.
- Existing assets: `src/assets/ucas-logo.png` (blue/green arrow mark), `src/assets/club-mascot.png`.
- Current tagline in use: نتعلم نبتكر نتقدم — "Learn, innovate, advance".
- Vision, mission and goals are editor-authored in `club_settings`; the design must not hard-code or invent them.

## Evidence on Hand

- 36 members in the live database. **Only 1 has a photograph**; the other 35 render a logo placeholder. Any team design must survive being 97% photoless.
- 5 past events.
- 0 news items — the news section is empty in production.
- Partners: present in the schema; count unverified.
- Visit counter reads ~154.
- No testimonials, no press, no metrics, no case studies. None may be invented.

## Product Principles

1. **Arabic first, RTL first.** English is the mirror, never the source.
2. **Design for the empty case.** Missing photos, zero news and closed registration are the normal state, not an error.
3. **Cheap on the wire.** A mid-range phone on a slow connection is the target device, not the edge case.
4. **Student-run must look student-run and still look serious.** Warmth and evidence of real people beat corporate polish.
5. **Never fabricate proof.** No invented numbers, partners, quotes or outcomes.

## Accessibility & Inclusion

- Full RTL/LTR correctness in both languages.
- `prefers-reduced-motion` is already honoured globally and must stay honoured.
- Arabic body text needs generous line-height; the Cairo family is in use.
- Colour contrast must hold in both the light and dark themes.

## Privacy

Only `ucas-language` and `ucas-theme` preference cookies plus a `sessionStorage` visit id are stored. No analytics, no advertising, no third-party tracking. Decision on record: publish a plain privacy/cookies notice and a one-time dismissible strip — **not** a blocking consent gate, because nothing stored requires consent.
