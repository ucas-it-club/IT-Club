# Spec: "Unslop" design tips and animation tips

Source: two checklists (20 design tips, 20 animation tips). This spec turns each into a
rule for the UCAS IT Club site, says where it applies, and says how to check it.

Scope: public site (`src/components/club/**`, `src/styles.css`, `src/components/ui/**`).
Admin panel only gets the rules marked **(admin too)**.

Site facts that shape the rules:
- Bilingual, Arabic first, RTL. Every rule must hold in both directions.
- Tokens live in `src/styles.css`. Radius token is `--radius: 1rem`.
- Motion today: GSAP only in `BracketHero`/`HeroOpening`; everything else is CSS
  (`animation-timeline: view()`, `transition`, view transitions in `motion-proto.css`).
- Easing today is a mix: `--ease-arrive`, `--ease-leave`, `--ev-ease`, `--contact-ease`, and
  raw `cubic-bezier(0.16, 1, 0.3, 1)` repeated in several files.
- Reduced motion already switches animation off in the hero and the reel. Keep that true
  for everything new.

---

## Part A: Design (20 tips)

| # | Tip | Rule for this site | Where | Check |
|---|-----|--------------------|-------|-------|
| 1 | Delete filler badges | No badge or pill that repeats what the text beside it says. Keep a pill only when it carries data (status, date, category used to filter). | Event/news cards, hero `.bh-majors`, `.bh-reg` | Each pill answers: what does the visitor learn from it? If nothing, remove. |
| 2 | Drop redundant labels | No label that restates its field or section ("Name:" above a name, "Events" label above an events heading). | Cards, forms, footer, admin | Read each screen with labels covered. Nothing lost = delete. |
| 3 | Unitalicize random words | No italic for decoration. Italic is for foreign terms and titles only. Arabic has no italic: never fake it with `skew` or `font-style: italic` on Arabic runs. | Global | `grep -rn "italic" src` and justify each hit. |
| 4 | Mono only where needed | Monospace only for code, IDs, and numeric columns that must align. Not for labels, nav or headings. | Global | `grep -rn "font-mono" src` and justify each hit. |
| 5 | Use a design system | One source for color, radius, spacing, type, shadow and easing: tokens in `src/styles.css`. No raw hex, no one-off `px` radius or spacing in components. Repeated easing curves become tokens (see Part B). | Global | `grep` for `#[0-9a-f]{3,6}` and `border-radius: [0-9]` in `src/components/club`; each hit becomes a token or is justified. |
| 6 | Show the actual product | Use the club's real photos, events, members and numbers. No stock imagery, no abstract placeholder art. Empty states show real next steps, not an illustration. | Hero, reel, about, events | No image without a real source. |
| 7 | Enlarge the main feature | One primary thing per screen, visibly largest: hero name; next event on the events page; the join form on the join page. | Hero, `EventsPage`, join | Squint test: the primary item is the largest and highest contrast. |
| 8 | Group with spacing | Related items sit closer than unrelated ones. Use a spacing scale (4/8/12/16/24/32/48/64). Prefer gap over borders and boxes to separate groups. | Cards, lists, footer, forms | Gap inside a group is at most half the gap between groups. |
| 9 | Make headlines specific | A headline says what the section holds, with a fact when one exists. "Events the club has run" beats "Activities". Write both languages with equal care. | All headings | Each H1/H2 still makes sense with the page around it hidden. |
| 10 | Emphasize the CTA | One primary button per view, using `brandButtonClass("primary")`. Secondary actions use outline or link. Never two filled buttons side by side. | Hero, event detail, join, contact | Count filled buttons per viewport: at most one. |
| 11 | Add an accent colour | One accent for interaction and emphasis. The brand green/blue gradient is for the primary CTA and a few marks, not for body text, borders and icons at once. | Global | Accent covers under about 10% of any screen. |
| 12 | Keep icons consistent | One icon set (lucide), one stroke width, one size per context (16 inline, 20 in buttons, 24 standalone). Decorative icons get `aria-hidden`. | Global | `grep` for imports outside `lucide-react`. |
| 13 | Remove embellishments | No decorative glow, gradient text, glass blur, grid backgrounds or floating shapes unless they carry meaning. Review `FloatingBackground`, the page grid, header glow. | Global | Remove it. If no one misses it in the diff, it stays removed. |
| 14 | Inner radius = outer − padding | Nested rounded boxes: `inner radius = outer radius − padding`. Example: card radius 1rem with 0.5rem padding gives its image 0.5rem. Express it in CSS: `border-radius: calc(var(--radius) - var(--pad))`. | Cards with images, `ContentImage`, reel, buttons in cards | Corners look concentric at 400% zoom. |
| 15 | Improve text contrast | Body text 4.5:1 or better, large text 3:1, in light and dark. Muted text is not allowed under 4.5:1. Text on photos gets a scrim. | Global, muted text, hero over images | Run a contrast check on `--muted-foreground` against `--background` and `--card`, both themes. |
| 16 | Wrap headlines properly | `text-wrap: balance` on headings, `text-wrap: pretty` on paragraphs. No one-word last lines, no orphan Arabic particles. | Headings, hero, card titles | Check at 320, 375, 768, 1280 widths in both languages. |
| 17 | Align by eye, not pixels | Optically correct beats mathematically correct: icon+text baselines, play/arrow glyphs, Arabic cap height against Latin (the hero name already nudges `top: 0.17em`). | Buttons with icons, header, hero | Visual check, both directions. |
| 18 | Use tabular nums | Every changing or column-aligned number uses `font-variant-numeric: tabular-nums`: counts, dates, times, tables, admin. Numerals are English (0-9) site-wide in both languages, decided 2026-11-10. | Hero facts (done), `CountUp` (done), event dates/times, admin tables | `grep` for `toLocaleString("ar` and `ar-EG`; none left. |
| 19 | Add loading states | Every async surface has one: skeleton shaped like the final content (not a spinner), button pending state on submit, image placeholder at final aspect ratio. Never layout shift on load. | `ClubProvider` data load, `ContentImage`, forms, admin **(admin too)** | Throttle network to Slow 3G; no blank area, no jump. |
| 20 | Animate useful feedback | Motion answers an action: press, submit success, error, copy, save. It does not decorate. See Part B. | Buttons, forms, registration | Every interactive element has hover, focus-visible, active and disabled states. |

### Part A priorities

1. **Do first (cheap, visible):** 18 (finish numerals), 15, 16, 10, 14, 1, 2, 13.
2. **Then:** 5 (token audit), 8, 9, 11, 12, 7.
3. **Needs design decisions:** 19 (skeleton designs), 6 (image gaps), 13 (what to remove).

---

## Part B: Animation (20 tips)

### Shared tokens (add once, replace the duplicates)

Add to `src/styles.css` `:root`:

```css
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);   /* entrances (tip 1) */
--ease-in-out: cubic-bezier(0.76, 0, 0.24, 1);  /* moves (tip 9) */
--ease-in:     cubic-bezier(0.4, 0, 1, 1);      /* exits only */
--dur-press:   120ms;
--dur-pop:     180ms;     /* dropdowns, popovers: 150-250ms (tip 2) */
--dur-enter:   400ms;
--dur-exit:    320ms;     /* about 20% under enter (tip 15) */
--stagger:     30ms;      /* list rows (tip 3) */
--press-scale: 0.97;      /* tip 4 */
```

Map the existing curves to these (`--ease-arrive` becomes `--ease-out`, `--ease-leave`
becomes `--ease-in`, `--ev-ease` and `--contact-ease` are removed). GSAP code reads the
same tokens through `getComputedStyle` or a small `ease` map in `BracketHero.tsx`.

Reduced motion: under `prefers-reduced-motion: reduce`, durations collapse to 0.01ms and
transforms are removed; opacity changes may stay at 150ms. Already the pattern in the hero.

| # | Tip | Rule for this site | Where | Check |
|---|-----|--------------------|-------|-------|
| 1 | Ease-out for entrances | Everything that appears uses `--ease-out`. | Reveal, cards, dialogs, drawer, toasts | No `ease`, `linear` or `ease-in` on an entrance. |
| 2 | Dropdowns at 150-250ms | Menus, selects, popovers, tooltips: `--dur-pop`. Never over 250ms. | Language and theme menus, mobile nav, shadcn `DropdownMenu`, `Popover`, `Select` | Measure in DevTools. |
| 3 | Stagger list rows by 30ms | Lists and grids reveal rows with `--stagger` steps via `transition-delay: calc(var(--i) * var(--stagger))`. Cap at 8 steps (240ms), the rest arrive together. The hero's 80ms word stagger stays: it is a headline, not a list. | Event/news grids, members, reel, mobile nav links | Last visible row arrives within 300ms of the first. |
| 4 | Scale to 0.97 on press | `:active` on buttons, cards that link, chips, icon buttons: `transform: scale(var(--press-scale))` over `--dur-press`. | `brand-button-styles`, `ui/button`, linked cards | Press and hold: shrinks at once, releases smoothly. |
| 5 | Stretch moving knobs 12% | Toggle thumbs and sliders stretch about 12% along travel while moving. Applies to the theme switch and any `Switch` or `Slider`. | Theme toggle, language toggle, `ui/switch` | Thumb is wider mid-travel, normal at rest. |
| 6 | Stagger as details settle | Inside one card or panel, the pieces land in order: image, title, meta, action. Use the same `--stagger`. | Event detail, news detail, hero panels | Pieces never all move at the same instant. |
| 7 | Arcs for object movement | Anything that travels between two points on screen (card to detail, FAB to form) follows a curved path: split into x and y with different easings. Not used for plain fades or slides. | Only if a travelling-object transition is added; skip otherwise | N/A until used. |
| 8 | Pulse to confirm success | Submit success (join, registration, contact, copy link) plays one short scale pulse (1 to 1.06 to 1, 300ms) on the confirmation element. No confetti. | `PublicForm`, `EventRegistrationForm`, copy actions | Pulse plays once, not on re-render. |
| 9 | Ease-in-out for moves | Elements that move on screen and stay on screen (reordering, sliding tabs and underline indicators, accordion height) use `--ease-in-out`. | Tab indicator, accordion, reel track, admin reorder | Not `--ease-out` for on-screen moves. |
| 10 | Start popovers at 0.95 | Popovers, menus, dialogs begin at `scale(0.95)` and `opacity: 0`. Not from 0. | `ui/popover`, `dropdown-menu`, `dialog`, `hover-card`, `tooltip` | Override shadcn `zoom-in-95` utilities to match. |
| 11 | Enter from the trigger | Set `transform-origin` to the trigger so a popover grows out of its button. Radix exposes `--radix-popover-content-transform-origin`; use it. In RTL the origin mirrors automatically. | All Radix popovers and menus | Menu grows from the button, not from its own centre. |
| 12 | Exit to the trigger | Same origin on close; exit runs shorter than enter (tip 15). | Same | Close animation shrinks toward the button. |
| 13 | No bounce on everyday UI | No spring overshoot on buttons, menus, cards, forms, nav. Overshoot only on rare delight (tip 5 knob stretch is not a bounce). | Global | `grep` for `back.out`, `elastic`, and cubic-bezier with y above 1. |
| 14 | Don't tween while held | While a pointer is down on a drag target (reel scrub, slider, cropper, admin reorder), the element follows the pointer 1:1 with no easing or `scrub` lag. Tween only after release. The hero's `scrub: 0.45` is page scroll, not a held drag, so it stays. | `ContentReel` drag, `ImageCropper`, sliders, admin drag | Dragged item never trails the pointer. |
| 15 | Make exits 20% shorter | Every exit is about 0.8x its enter duration: 400ms in, 320ms out (`--dur-enter`, `--dur-exit`). | Dialogs, drawer, toasts, mobile nav, hero step swap (enter 1s, exit 0.4s already shorter) | Compare paired durations. |
| 16 | Overlap old and new states | Outgoing and incoming content overlap by about a third of the exit instead of waiting. Page change: start `mp-arrive` while `mp-leave` finishes (already 60ms delay; raise overlap if it feels sequential). Tab and step content crossfade, never blank in between. | View transitions, tabs, hero step swap, language change | No frame with an empty container. |
| 17 | Masks for reveals and colour | Reveals use a mask or clip (text rises from its own bottom edge, as the hero name does). Colour changes (theme switch) spread by mask or clip-path circle from the toggle, not by a global fade. Use the View Transitions API for theme: `document.startViewTransition` with a `clip-path` circle from the toggle's position. Fall back to no animation. | Heading reveals (`mp-line`), theme toggle | Theme switch grows from the toggle. |
| 18 | Crossfade icons + blur | Icon swaps (menu to close, sun to moon, copy to check) crossfade with scale 0.8 to 1 and blur 4px to 0 over 200ms. Both icons stay mounted during the swap. | Header menu button, theme toggle, copy button | No hard icon pop. |
| 19 | Rubber band past bounds | Draggable things resist beyond their limit (reel ends, cropper edge, drawer pull-down): movement past the bound is damped, for example `overshoot * 0.35`, then springs back on release. | `ContentReel`, `ImageCropper`, `ui/drawer` (vaul does it) | Drag past the end: resists, then returns. |
| 20 | Reuse the same layoutId | The same element in two states keeps one identity: card to detail, tab underline, active nav pill. In plain CSS use `view-transition-name` (unique per element, set on the item being left and entered, as `page-title` does now). Add for event card image to event detail image and news card image to news detail image. | `EventsPage` to `EventDetail`, `NewsPage` to `NewsDetail`, header active pill | Image travels from card to detail on navigation. |

### Part B priorities

1. **Foundation:** add tokens, replace the duplicate curves. Nothing visual changes yet.
2. **Everyday feel (biggest gain):** 4, 1, 2, 10, 11, 12, 15, 18. All reachable by editing shared components (`ui/button`, `ui/popover`, `ui/dropdown-menu`, `ui/dialog`, `brand-button-styles`) once.
3. **Lists and detail pages:** 3, 6, 16, 20.
4. **Feedback:** 8 with 19 (design) loading states.
5. **Drag polish:** 14, 19.
6. **Optional:** 5, 7, 17 (theme circle reveal is the most visible of the three).

---

## Implementation plan

Each step is a separate, reviewable change. Ship in this order.

1. **Tokens and numerals.** Add motion tokens; swap duplicate easing; remove `ar-EG` from
   remaining components (hero done). *Done when:* `grep ar-EG` is empty and no raw
   `cubic-bezier` remains outside `styles.css`.
2. **Shared interactive components.** Press scale, popover origin and scale, durations,
   exits, icon crossfade. *Done when:* A20, B2, B4, B10-B13, B15, B18 pass their checks.
3. **Type and contrast pass.** `text-wrap`, muted-text contrast, `tabular-nums` audit,
   badge and label removal, embellishment review. *Done when:* A1-A4, A13, A15, A16, A18 pass.
4. **Radius, spacing, accent, icons.** Concentric radii, spacing scale, one accent, icon sizes.
   *Done when:* A5, A8, A11, A12, A14 pass.
5. **Lists, detail and page transitions.** Stagger, settle order, overlap, shared-element
   image transitions. *Done when:* B3, B6, B16, B20 pass.
6. **Loading and feedback.** Skeletons, pending buttons, success pulse. *Done when:* A19, B8 pass.
7. **Drag polish and optional items.** B14, B19, then B5, B7, B17 if wanted.

## Rules for every step

- Both languages and both directions, light and dark.
- Check at 320, 375, 768, 1280 px.
- `prefers-reduced-motion: reduce` removes movement; state changes still read.
- Only animate `transform`, `opacity`, `filter`, `clip-path`. Never layout properties
  (`width`, `height`, `top`) except the accordion, which keeps its existing method.
- No new animation library. CSS first; GSAP stays in the hero.
- Keep the first paint unchanged: nothing on the server render waits for JavaScript.

## Open questions

- Theme switch circle reveal (B17): wanted, or keep the current instant switch?
- Skeletons (A19): shape per content type is a design decision; match existing card layouts?
- Admin panel: apply the same rules, or public site only for now?
