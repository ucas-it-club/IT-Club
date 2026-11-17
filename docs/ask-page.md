# /ask: ice-breaker page for field events

An unlisted page titled "Break the Ice" (Arabic questions; English title) (`/ask`, `/en/ask` is 404). Visitors reach it by QR code or direct link; nothing on the
site links to it. The big button is a small game (no text on the cards while they spin; the category tag pops first, then the question; the card light and the button fill turn from neutral to the category colour on every landing): the cards spin past like a slot reel, the background speeds up and
breathes, and a random question lands with confetti and its category tag (تعليمي, ديني, تقني, عام). A swipe, a tap on a
side card or the arrow keys browse the row by hand. No category filter and no counter.

## Edit the questions

`src/lib/club/ice-questions.ts`: four arrays of plain strings, no database. Add, edit or delete lines and redeploy.
Keep each to one or two short lines. Ids come from position, so append new questions at the end of an array.

## Counting (GoatCounter)

Anonymous, no cookies, no script tag: `src/lib/club/ask-track.ts` sends the same beacon as GoatCounter's `count.js` to
`abdalrahmanpy.goatcounter.com` (the account the quote-card page uses).

| Name on the dashboard | Counted when |
|---|---|
| `/ask` | someone opens the page |
| `ask-edu`, `ask-faith`, `ask-tech`, `ask-life` | a card of that category is landed on (spin, swipe, tap or key; one event per landing) |

Open the page once with `?test` and that browser stops counting; `?test=off` counts again. localhost and preview hosts
never count. Ad blockers block GoatCounter, so real numbers are a bit higher. The privacy page names this exception.

## How it stays unlisted

- `noindex,nofollow`; not in the nav, footer, sitemap or `llms.txt`. `robots.txt` must not `Disallow` it, or crawlers
  never see the noindex tag.
- No site header, footer, join button or privacy banner, and no boot screen (`Shell` in `ClubSite.tsx`, `BootScreen.tsx`).
- Back button is held on the page (extra history entry re-added on `popstate`). Closing the tab or an edge swipe still leaves.

## Look

Reuses the site's animated `SiteBackground`, always on the dark palette. Reduced-motion visitors get no reel, confetti or
background speed-up: the button just moves to the next question. Colours per category: blue, green, teal, and
brand gray (no off-brand hues).
