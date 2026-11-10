# How uos.acm.org is built, and what it means for our site

Study date: 2026-11-05. Subject: https://uos.acm.org/ (University of Sharjah ACM chapter).

This is a study of how the site works, so we can learn the methods. Their code, text, shaders and
design belong to them. The code sketches below are rewritten to show the idea; do not copy their
source into our repository.

## Short answer

The scroll animation and the normal phone page are **the same HTML**. Only two things change at
1024px wide:

1. **CSS** decides the layout. One custom Tailwind variant, `stage:`, turns a section into a tall
   track with a sticky screen inside it. Below 1024px those classes do nothing, so the section is
   ordinary content.
2. **JavaScript** decides the motion. `gsap.matchMedia()` runs one branch at 1024px and up and a
   different, much lighter branch below it. GSAP undoes everything by itself when the width crosses
   the line, with no page reload.

There is no scroll library. Scrolling is always the browser's own. The site does not use `pin`, and
it does not use Lenis or ScrollSmoother. GSAP only reads the scroll position and moves things.

## 1. The desktop and phone switch

### Layer 1: the `stage:` CSS variant

Every `stage:` class compiles to this shape:

```css
@media (min-width: 1024px) {
  :root:not([data-stage="off"]) .stage\:sticky {
    position: sticky;
  }
}
```

So there are two conditions: the screen is at least 1024px wide, **and** `<html>` does not say
`data-stage="off"`. The second condition is a safety switch. If GSAP fails to load, their code sets
`data-stage="off"`, and the page falls back to the normal stacked layout instead of a tall empty
track. A desktop user with a failed script still gets a readable page.

In Tailwind v4 this is about one line, in our own words:

```css
@custom-variant stage {
  @media (min-width: 1024px) {
    :root:not([data-stage="off"]) & {
      @slot;
    }
  }
}
```

### Layer 2: tall track, sticky screen

Their markup for the opening, simplified:

```html
<div class="relative stage:h-[605svh]">
  <!-- the track: gives scroll distance -->
  <div class="relative stage:sticky stage:top-0 stage:h-svh stage:overflow-clip">
    <section class="relative stage:absolute stage:inset-0">...</section>
    <section class="relative py-16 stage:absolute stage:inset-0 stage:py-0">...</section>
  </div>
</div>
```

- At 1024px and up: the outer box is 605% of the screen height. The inner box sticks to the top.
  The sections inside are stacked on top of each other with `absolute inset-0`.
- Below 1024px: every `stage:` class is off, so the sections are plain blocks, one after another.

This is why the phone version needs no second copy of the content. Measured at 1440x900: the
track is 5445px with 2 sticky elements. At 1023x800: the same element is 3811px of ordinary content
and 0 sticky elements.

### Layer 3: `gsap.matchMedia()`

The opening component registers two branches:

```js
const mm = gsap.matchMedia();

mm.add("(min-width: 1024px)", () => {
  // Build the big timeline and connect it to the scroll position.
});

mm.add("not all and (min-width: 1024px)", () => {
  // No timeline. IntersectionObserver marks which month is on screen.
  // The month buttons use scrollIntoView instead of timeline maths.
});

return () => mm.revert();
```

Measured: with the page open at 1440px, resizing to 1023px with no reload turned off all sticky
elements and fired the media query change. The horizontal photo strips appeared and worked.

### Layer 4: the content changes form, not just size

- **Photo reel, wide:** GSAP places each photo on one stage using `x`, `y`, `z`, `width`, `height`,
  `rotation` and `clipPath`.
- **Photo reel, narrow:** the same photos sit in one strip per event, using CSS
  `scroll-snap-type: x mandatory`. You swipe sideways through a strip and scroll down between
  strips.
- **Pillars (Learn, Build, Connect), wide:** one sticky screen, one shared machine drawing, and
  scrolling changes the phase.
- **Pillars, narrow:** three normal blocks in a row, each with its own small demo. Wide-only parts
  use `hidden stage:flex`, and narrow-only parts use `stage:hidden`.

## 2. The opening scroll scene

- **Connection:** `ScrollTrigger.create({ trigger, start: "top top", end: "bottom bottom", animation:
timeline, scrub: 0.45, invalidateOnRefresh: true, onRefreshInit: measure })`.
- **`scrub: 0.45`:** the animation catches up with the scroll over 0.45s, so it glides, even though
  scrolling is native. This single number gives most of the "smooth" feeling. Our hero uses
  `scrub: true`, which follows the scroll exactly and feels harder.
- **A budget for chapters:** each scene gets a length in timeline units (`handoff: 1, prints: 1,
evening: 1.05, panels: 0.8, board: 0.85, end: 0.35`). The track height comes from the same
  numbers (`(1 + total) * 100` svh). Adding a chapter makes the track longer on its own.
- **Measure, do not hard-code:** before each refresh, `onRefreshInit` reads real sizes from the
  page (stage width, header height, headline box). Tween values are functions such as
  `x: () => layout().x`. With `invalidateOnRefresh`, a resize recalculates every position.
- **A 3D camera:** a list of keyframes holds rotation and depth values (`rx`, `ry`, `rz`, `z`) per
  moment in the timeline. The photos live on a plane that tilts in CSS 3D.
- **Scene jumps:** the month buttons work out the scroll position of a chapter and call
  `window.scrollTo({ behavior: "smooth" })`. Navigation always goes through the real scroll, so
  scroll and scene can never disagree. Clicking a photo in a different chapter does the same.
- **Second scene (Pillars):** track `310svh`, `scrub: 0.35`, and the timeline tweens a single
  number `t` from 0 to 1. `onUpdate` passes `t` to a canvas drawing. This is the simple pattern:
  **scroll to one number, number to drawing.**

## 3. Animation catalogue

| Effect                            | Where                    | How it is done                                                                                                                                                         |
| --------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading splash                    | First visit              | SVG path drawn with `stroke-dashoffset`, real progress from `document.fonts.ready` and `window.load`. Wheel, touch and keys blocked until done.                        |
| Hold everything until splash ends | First visit              | `animation-play-state: paused` on all page elements while `data-splash="on"`.                                                                                          |
| Splash once only                  | Head script              | Runs before paint. Uses `sessionStorage`, skips on reload and for reduced motion, and has a 12s failsafe.                                                              |
| Headline lines rise               | Page entrance            | CSS keyframes (`line-rise`, `line-wipe`, `line-land`) chosen by CSS variables per line.                                                                                |
| Reveal on scroll                  | Most pages               | `.reveal` starts at `opacity: 0; translateY(32px)`. IntersectionObserver sets `data-visible="true"`, and a CSS transition does the rest.                               |
| No-JS safety                      | Reveal                   | `@media (scripting: none)` shows `.reveal` content at once.                                                                                                            |
| Timeline line fills as you scroll | Events page              | Pure CSS: `animation-timeline: view()` with `animation-range`, and `@supports not (animation-timeline: view())` hides it. No JS.                                       |
| Page change                       | All routes               | React view transitions: `view-transition-name: site-header` keeps the header still, and `::view-transition-old/new(.page)` animate the body. Guarded with `@supports`. |
| Sculpted headline                 | Home, wide, high quality | WebGL2 fragment shader that reads a signed distance field of the text. The field is computed in a Web Worker. Text stays real HTML underneath.                         |
| Moving background field           | Home, high quality       | WebGL 1 shader on a canvas, `antialias: false`, `powerPreference: "low-power"`.                                                                                        |
| Headline fits the width exactly   | Home                     | Variable font width axis (`wdth`) plus `font-size: calc(100cqw / var(--em))`, using a table of pre-measured widths per phrase.                                         |
| Custom cursor                     | Fine pointers only       | `(pointer: fine)` check, then a `rAF` loop that eases towards the mouse.                                                                                               |
| Magnetic buttons, card tilt       | Mouse only               | Checks `pointerType === "mouse"`. Buttons also check reduced motion.                                                                                                   |

Motion tokens keep this coherent. There are named easings (`--ease-out-expo`, `--ease-editorial`,
`--ease-snap`, and so on) and named durations (`--dur-press: .14s`, `--dur-ui: .32s`,
`--dur-scene: .72s`, and so on). GSAP has matching named eases in JavaScript. The whole site
therefore moves with the same "hand". There are 45 CSS keyframes against only 2 ScrollTrigger
scenes: **GSAP is kept for the two big scenes, and CSS does everything else.**

## 4. Performance rules they follow

- **GSAP is not in the first load.** A shared `useScene` hook imports it on demand, then configures
  it once: default ease `expo.out`, default duration `0.7`, and
  `ScrollTrigger.config({ ignoreMobileResize: true })`.
- **`useScene` is one shared hook** that does the import, wraps work in `gsap.context`, reverts on
  unmount, and calls one `ScrollTrigger.refresh()` after `document.fonts.ready`, because late fonts
  change layout heights.
- **Quality tier, decided once.** The result is `low` if any of these is true: Save-Data is on,
  `deviceMemory < 4`, `hardwareConcurrency <= 4` on a coarse pointer, or WebGL fails with
  `failIfMajorPerformanceCaveat`. The result is written to `<html data-quality>`.
- **Low quality means no shaders.** Measured at 375px with mobile emulation: `data-quality="low"`,
  `data-sculpt="off"`, and the shader canvases stayed at the unused default of 300x150. The
  headline is plain styled text.
- **Shaders start late** with `requestIdleCallback` and a 1200ms timeout.
- **Canvases stop when not needed:** an IntersectionObserver stops drawing offscreen, `document.hidden`
  stops drawing in hidden tabs, and `webglcontextlost` is handled.
- **Pixel ratio is capped** at 1.5 for heavy canvases and 2 for light ones.
- **Viewport units:** `svh` is used 22 times against `dvh` 4 and `lvh` 2. With `svh` and
  `ignoreMobileResize`, the phone address bar hiding does not change the layout.

## 5. What not to copy

- **Reduced motion.** The scroll stage has no reduced-motion check in the code I read, and the CSS
  has no `prefers-reduced-motion: reduce` block. Only the splash and magnetic buttons respect it.
  Our hero already goes to `static` mode here. Keep ours. (Code reading only; I could not emulate
  this setting.)
- **Width-only gate.** The switch checks width but not height. A 1024px-wide laptop with a very
  short window still gets the full stage. Tablets in landscape get it too.
- **The `wdth` fit trick for Arabic.** It depends on a variable font with a width axis and a
  pre-measured table per phrase. We need another method for Arabic text. Check whether our Arabic
  font has such an axis before planning anything around this.
- **Their look itself.** It is their identity. Our rule stays: use our logo and our real content.

## 6. Comparison with our site

Measured on `experiment/alive-redesign`. Ours at 375px: `data-mode="live"`, `.bh-stage` is sticky,
and the hero track is 3410px tall.

| Area                      | uos.acm.org                                                                          | Our site now                                                                     | Gap                                                            |
| ------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Scroll story on phones    | Off below 1024px                                                                     | **On at all widths** (`420svh` even at 375px)                                    | **Biggest gap.** This is exactly what you noticed.             |
| Mode choice               | CSS variant plus `gsap.matchMedia`, live on resize                                   | `live` or `static` chosen once on load, from reduced motion and weak device only | Width not considered. No change on resize.                     |
| Failure fallback          | `data-stage="off"` restores normal layout                                            | Not present                                                                      | If GSAP fails, our track stays tall.                           |
| Scrub feel                | `0.45` and `0.35`                                                                    | `true`                                                                           | One-line change, worth testing.                                |
| GSAP setup                | One shared `useScene`                                                                | Inside `BracketHero`                                                             | Fine for one scene, needed before a second.                    |
| Refresh after fonts       | Yes                                                                                  | Not present                                                                      | Small fix. Arabic fonts load late too.                         |
| Loading screen            | Real progress, once per session                                                      | Simulated progress to 90%, once per session                                      | Ours is close already.                                         |
| Intro holding scroll      | Only during splash                                                                   | Splash, opening and reel (about 12s)                                             | Their hold is shorter. You chose to keep ours.                 |
| Motion tokens             | Named easings and durations                                                          | Mostly per-component values                                                      | Add before more animation.                                     |
| Text reveals              | Line rises via CSS                                                                   | Hero only                                                                        | Reuse on headings.                                             |
| Reveal on scroll          | `.reveal` plus observer                                                              | Our `Reveal` exists                                                              | Similar. Add a `scripting: none` guard if missing.             |
| Page transitions          | View transitions, header stays                                                       | None                                                                             | Good effect for low cost.                                      |
| CSS scroll-driven effects | Events timeline line                                                                 | None                                                                             | Good fit for an events timeline.                               |
| Photo reel                | Big scene on wide, snap strips on narrow                                             | None                                                                             | Needs real event photos. Highest visual effect, highest cost.  |
| Shaders                   | Headline and field                                                                   | None                                                                             | Do last. Mid-range Android gets the plain version anyway.      |
| Quality tiers             | `quality()` with a `data-quality` attribute                                          | `weakDevice()`, stricter limits (`<= 2`)                                         | Move to a shared helper. Their limits are safer for Android.   |
| Cursor and magnetic hover | Yes, mouse only                                                                      | Parallax on brackets only                                                        | Optional polish.                                               |
| Home sections             | Masthead, reel, statement, pillars, programme, people, reading, closing              | Hero, then two content sections                                                  | Ours is much shorter. Only add what we have real content for.  |
| Inner pages               | Events record, media contact sheet, team yearbook, resources index, contact with FAQ | Events, news, members, join, contact, about                                      | Each of theirs has one strong idea. Ours are more plain lists. |

## 7. Recommended order for our site

Status 2026-11-05: step 1 and the GSAP failure fallback from step 2 are built on
`experiment/alive-redesign`. It uses our `data-mode` attribute and one `matchMedia` listener instead
of a Tailwind `stage:` variant, because the hero already switches layout by mode.
Also built: `scrub: 0.45`, page transitions with `defaultViewTransition`, motion tokens for page
changes, and a CSS scroll rise on stacked hero panels. The refresh after fonts was skipped: our only
trigger sits at the top of the page, so late fonts cannot move it.
Steps 6 and 7 are built too: a CSS scroll timeline on the events page, and an event reel on home
(`ContentReel`), used for both past events and news, with one real photo per item. Photos fill the
screen width. The reel is a sticky stage from 1024px and a swipe strip below.

1. **Add the 1024px switch.** Add the `stage` variant and put `gsap.matchMedia` in the hero. Below
   1024px, use the layout our `static` mode already has. This is the change you asked about, and it
   is small because `static` mode exists. It replaces the phone behaviour where brackets park in
   the corners, so that needs your yes.
2. **Add the safety layer:** `data-stage="off"` on GSAP failure, and refresh after fonts.
3. **Try `scrub: 0.45`** on the hero and judge the feel.
4. **Add motion tokens,** then a shared `useScene` hook, before adding a second scene.
5. **Add view transitions** between pages with the router's `defaultViewTransition`, keeping the
   header still.
6. **Add a CSS scroll-driven timeline** to the events page.
7. **Build a second scene** on the home page. A "scroll to one number, number to drawing" scene is
   the cheapest big effect. A photo reel needs real photos from the club.
8. **Add shaders last,** high quality tier only, and only if the rest feels right.

## 8. Learning material

Checked on 2026-11-05 against first-party docs and source. Each fact links to its source. **My note**
means advice, not a sourced fact. Code sketches here were not run.

What these sources change for our plan:

- **Page transitions:** we have React 19.2.8 and `@tanstack/react-router` 1.170.18. React's stable
  `<ViewTransition>` needs 19.3, so use the router's `defaultViewTransition` option, which is in our
  installed version. Pick one owner for transitions, not both.
- **`scroll-behavior: smooth`:** GSAP's docs warn it can give wrong positions after a resize. We set
  it in `src/styles.css`, and uos sets it too. Test this when adding the 1024px switch.
- **`ignoreMobileResize`:** the source turns this on by itself for touch-only devices, so we do not
  need to set it.
- **RTL:** no first-party source covers it. A vertical scroll that drives a transform, the uos
  pattern, should work, but the `x` sign flips in RTL. Avoid `horizontal: true` on a real RTL
  scroller, which may stick at progress 0 based on a source reading.
- **`navigator.deviceMemory`:** Chromium only, and the spec is now a Discontinued Draft. Treat it as
  a hint only.
- **Licence:** GSAP with all plugins is free for commercial use, but it is not open source.

### 1. Desktop-only scroll animation, normal scrolling on small screens

**Start here:** https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/

- `gsap.matchMedia(scope?)` was added in 3.11.0. Call `mm.add(query, handler, scope?)`. `query` is a media query string or an object of named queries. Everything GSAP creates inside the handler is recorded and reverted when the query stops matching, and the handler runs again when it matches again. You may return a cleanup function, but do not call `context.revert()` in it. https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/
- Conditions object: for example `{ isDesktop: "(min-width: 800px)", reduce: "(prefers-reduced-motion: reduce)" }`. The handler runs if any condition matches and reruns when any of them changes. It does not run if none match. Read `context.conditions.isDesktop` inside it. `gsap.matchMediaRefresh()` reverts and reruns all matching handlers, which is useful for an on-page "reduce motion" switch. https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/
- `ScrollTrigger.matchMedia()` is marked deprecated. Use `gsap.matchMedia()`. https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- `pin` takes an element, selector text, or `true` (pins the trigger). Only one pinned element per ScrollTrigger, and do not animate the pinned element itself, because that breaks the measurements. Animate something inside it. Nested pinning is not supported. https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- `pinSpacing` adds padding so later content catches up. `false` turns this off and `"margin"` uses margin. It defaults to off when the pinned element's parent is `display: flex` ([source line](https://github.com/greensock/GSAP/blob/master/src/ScrollTrigger.js)). A parent with `transform` or `will-change` breaks `position: fixed` pinning. https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- `scrub: true` links progress directly to scroll. `scrub: 1` means the playhead takes 1 second to catch up. `anticipatePin` defaults to 0, and the docs say 1 is typically fine. It starts the pin a little early so fast scrolling does not show a flash of unpinned content. https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- If sizes depend on the window, use function values for `start`, `end` and the tween values, and set `invalidateOnRefresh: true`. `ScrollTrigger.refresh(safe)` recalculates all positions. It runs by itself on resize. Call it yourself after layout changes such as images or fonts loading or content expanding. `safe = true` waits for at least one animation frame first. It is more work than `update()`, so use it only when needed. https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.refresh()/ and https://gsap.com/resources/st-mistakes/
- Mobile address bar. Showing or hiding the bar resizes the viewport and shifts trigger positions.
  - `ScrollTrigger.normalizeScroll(true)` moves scrolling onto the JS thread, which stops the bar moving on most devices. Portrait iPhones can still show it. The docs call it experimental and say it is often not needed. Turn it off with `normalizeScroll(false)`. https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.normalizeScroll()/
  - `ScrollTrigger.config({ ignoreMobileResize: true })` (since 3.10.0) skips refresh on touch-only devices when the height change is within 25% of the viewport height. The trade-off is that start and end may be slightly off. https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.config()/
  - The docs do not state a default, but the 3.15.1 source sets it to true on touch-only devices (`_ignoreMobileResize = Observer.isTouch === 1`). https://github.com/greensock/GSAP/blob/master/src/ScrollTrigger.js
- Order matters. Create ScrollTriggers top to bottom, or later triggers get wrong positions. Also avoid `scroll-behavior: smooth`, which gives wrong positions after resize. https://gsap.com/resources/st-mistakes/

**My note:** if phones get no pin at all, most of the address-bar problems above never apply, and you should not need `normalizeScroll`. Width alone may still catch a large tablet in landscape, so test those or add `(pointer: fine)` to the query.

```ts
const mm = gsap.matchMedia();
mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
  const distance = () => track.scrollWidth - window.innerWidth;
  gsap.to(track, {
    x: () => -distance(), // RTL: flip the sign, see topic 7
    ease: "none",
    scrollTrigger: {
      trigger: section,
      pin: true,
      scrub: 1,
      anticipatePin: 1,
      end: () => "+=" + distance(),
      invalidateOnRefresh: true,
    },
  });
});
// Below 1024px nothing is created, so the page scrolls normally.
```

### 2. GSAP with React

**Start here:** https://gsap.com/resources/React/

- Install `@gsap/react`, then call `gsap.registerPlugin(useGSAP)`. The hook replaces `useEffect` / `useLayoutEffect` and cleans up for you through `gsap.context()`. Animations, ScrollTriggers, Draggables and SplitText made during the hook are reverted on unmount. https://gsap.com/resources/React/
- Config: `dependencies` (default `[]`), `scope` (a ref that limits selector text to that container), `revertOnUpdate` (default `false`). Without `revertOnUpdate`, a dependency change does not revert anything or run your cleanup. https://gsap.com/resources/React/
- Code that runs later (click handlers, `setTimeout`) is not tracked or scoped. Wrap it in `contextSafe()`, which comes from the hook's return value or the callback's second argument. If you add listeners by hand, remove them in a returned cleanup function. https://gsap.com/resources/React/
- `gsap.context(func, scope)` records what is created in `func`. `ctx.revert()` undoes and kills it all. Events fire after the function has finished, so their animations are not recorded unless they go through `ctx.add()`. A context is for cleanup and scoping, not for playback control; use a timeline for that. https://gsap.com/docs/v3/GSAP/gsap.context()/
- SSR: the hook picks `useLayoutEffect` when `document` exists and `useEffect` otherwise ([source](https://github.com/greensock/react/blob/main/src/index.js)). `ScrollTrigger.register` checks that `window` exists before enabling ([source](https://github.com/greensock/GSAP/blob/master/src/ScrollTrigger.js)). The `"use client"` line in the GSAP docs is for the Next.js App Router, not TanStack Start.
- `gsap.matchMedia()` inside `useGSAP` is safe: a MatchMedia created inside a context adds itself to that context, so it is reverted with it. The React docs do not spell this out; I read it in the [source](https://github.com/greensock/GSAP/blob/master/src/gsap-core.js).
- Elements that start hidden: set `visibility: hidden` in CSS, reveal with GSAP's `autoAlpha`, and undo the hiding in `<noscript>`. This stops a flash of unstyled content, which matters with SSR because the HTML paints before JS runs. https://gsap.com/resources/fouc/
- React Strict Mode runs effects twice in development, which can cause duplicates or `from()` problems unless things are reverted. In single-page apps, kill triggers on unmount and recreate them on mount. `useGSAP` handles this. https://gsap.com/resources/React/ and https://gsap.com/resources/st-mistakes/

```tsx
const root = useRef<HTMLDivElement>(null);
useGSAP(
  () => {
    const mm = gsap.matchMedia();
    mm.add("(min-width: 1024px)", () => {
      /* pin and scrub here */
    });
  },
  { scope: root, dependencies: [dir], revertOnUpdate: true },
);
```

### 3. Native CSS scroll-driven animations

**Start here:** https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations

- `animation-timeline` values: `auto` (initial), `none`, `scroll()`, `view()`, or a `--named` timeline. `scroll()` takes a scroller (`root`, `nearest`, `self`) and an axis (`block`, `inline`, `x`, `y`). `view()` takes an axis and an inset. https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timeline
- The `animation` shorthand resets `animation-timeline` to `auto`, and you cannot set it through the shorthand. Always write `animation-timeline` after `animation`. https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timeline
- `animation-range` sets where the animation runs, for example `entry 10% exit -25%`. MDN examples use the names `cover`, `contain`, `entry`, `exit` and `normal`. Outside the range the element jumps back to its default styles, so MDN recommends `animation-fill-mode: both` for most cases. https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-range
- Support, as of 2 Nov 2026: Chrome, Edge and Chrome Android 115, Samsung Internet 23, Safari and iOS Safari 26, Firefox and Firefox Android 159. None of these entries is behind a flag or marked partial. https://github.com/mdn/browser-compat-data
- Baseline: Newly available since October 2026. MDN's banner says this, and `web-features` gives 2026-10-27, the day Firefox 159 shipped. It is not "widely available", so older browsers still need a fallback. https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timeline and https://github.com/web-platform-dx/web-features/blob/main/features/scroll-driven-animations.yml
- Fallback: MDN's own examples use `@supports not (animation-timeline: scroll())`. The positive form `@supports (animation-timeline: scroll())` lets you add the effect only where it works. https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timeline
- These animations can run off the main thread, unlike scroll-event JS. Chrome's article recommends `transform` over `width` so this can happen. https://developer.chrome.com/docs/css-ui/scroll-driven-animations
- Demos and visual tools for ranges, plus a free video course, by Bramus (Chrome DevRel). It is his own project, not an official Chrome product. It has a stacking cards demo and a horizontal scroll section demo. https://scroll-driven-animations.style/

**My note:** use CSS for simple reveals and progress effects on all screen sizes, because it adds no JS and suits mid-range phones. Keep GSAP for the desktop pinned sequence.

```css
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .reveal {
      animation: fade-up linear both;
      animation-timeline: view();
      animation-range: entry 0% entry 60%;
    }
  }
}
```

### 4. View Transitions API

**Start here:** https://developer.chrome.com/docs/web-platform/view-transitions (overview), then https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using

- Same-document (the single-page app case, and what a TanStack client navigation uses): `document.startViewTransition(callback)`. Support: Chrome and Chrome Android 111, Edge 111, Firefox 144, Safari 18, Samsung Internet 22. Baseline Newly available since 2025-10-14. https://developer.chrome.com/docs/web-platform/view-transitions and https://github.com/web-platform-dx/web-features/blob/main/features/view-transitions.yml
- Cross-document (real page loads): both pages opt in with `@view-transition { navigation: auto; }`, same origin only. Support: Chrome 126, Safari 18.2, Samsung Internet 28. No Firefox, so not Baseline. https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using and https://developer.chrome.com/docs/web-platform/view-transitions
- Feature-detect with `if (!document.startViewTransition)` and do the DOM update directly. The returned object has `updateCallbackDone`, `ready` and `finished` promises. `view-transition-name` must be unique among rendered elements, or `ready` rejects and the transition is skipped. https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using
- Only one transition runs at a time. A new one makes the old one skip to the end. `skipTransition()` skips the animation but still runs the DOM update. Reduced motion: turn off or soften the `::view-transition-*` animations in an `@media (prefers-reduced-motion)` block. The article notes that this preference does not mean the user wants no motion at all. https://developer.chrome.com/docs/web-platform/view-transitions/same-document
- TanStack Router: `defaultViewTransition` on `createRouter`, or `viewTransition` on a `Link` or `navigate`. Each takes `boolean | ViewTransitionOptions`, and `true` runs navigation through `document.startViewTransition()`. The per-navigation option is off by default, and both are ignored if the browser has no support. https://tanstack.com/router/v1/docs/framework/react/api/router/RouterOptionsType and https://tanstack.com/router/v1/docs/api/router/NavigateOptionsType. Example: https://tanstack.com/router/latest/docs/framework/react/examples/view-transitions
- React: `<ViewTransition>` is stable since 19.3 (post dated 2026-09-09), imported from `react`. It only animates updates from `startTransition`, a `<Suspense>` reveal, or `useDeferredValue`. https://react.dev/blog/2026/09/09/react-19-3
- React calls `startViewTransition` itself and interrupts transitions started by anything else, so do not call it yourself. Back-button popstate navigations skip the animation, and React does not handle reduced motion for you. https://react.dev/reference/react/ViewTransition

**My note:** pick one owner. React says it interrupts outside transitions, so I would not turn on TanStack's `defaultViewTransition` and also use `<ViewTransition>` until you have tested the two together. Neither project's docs cover the combination.

### 5. Hand-written WebGL shaders for page backgrounds

**Start here:** https://webgl2fundamentals.org/webgl/lessons/webgl-fundamentals.html, then https://thebookofshaders.com/

- Learning order:
  - WebGL2 Fundamentals for the API: clip space, buffers, and the rule that `#version 300 es` must be the very first line of the shader. https://webgl2fundamentals.org/webgl/lessons/webgl-fundamentals.html
  - The Book of Shaders for the maths, by Patricio Gonzalez Vivo and Jen Lowe. Noise is [chapter 11](https://thebookofshaders.com/11/), fractal Brownian motion is [chapter 13](https://thebookofshaders.com/13/). The contents page links only the early chapters; later ones (image processing, simulation, 3D) are listed without links. https://thebookofshaders.com/
  - The MDN tutorial is WebGL 1 (`getContext("webgl")`), so treat it as a reference and not as your base. https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Getting_started_with_WebGL
- WebGL2 is Baseline widely available (Chrome Android 58, iOS Safari 15). https://github.com/web-platform-dx/web-features/blob/main/features/webgl2.yml
- Cost is per pixel. Fragment shaders usually run many more times than vertex shaders, so move work to the vertex shader where you can. https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
- Be careful copying from Shadertoy. The WebGL2 Fundamentals lesson warns these shaders are not best practice for performance. Its sample ran at about 19 fps at 640x360 and 2 to 3 fps full screen on the author's machine. https://webgl2fundamentals.org/webgl/lessons/webgl-shadertoy.html
- `devicePixelRatio`: a ratio of 3 means 9 times the pixels, and 4 means 16 times. https://webgl2fundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html. MDN suggests a smaller `canvas.width` / `height` with the CSS size unchanged, letting the browser upscale. https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices. No standard states a cap. React Three Fiber's default `dpr` range is `[1, 2]`, which is a library default and not a rule. https://r3f.docs.pmnd.rs/api/canvas
- Sizing: let CSS set the display size, read it with a `ResizeObserver` (`device-pixel-content-box` with a `content-box` fallback), and change `canvas.width` only when it really changes, because changing it clears the canvas. Do not use the window `resize` event or `innerWidth` for this. https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices and https://webgl2fundamentals.org/webgl/lessons/webgl-anti-patterns.html
- Precision and context options:
  - Unconditional `highp` in fragment shaders can fail on older mobile hardware. Use the `GL_FRAGMENT_PRECISION_HIGH` check. `mediump` can corrupt output on mobile, so test it on a real phone.
  - `alpha: false` can be expensive on some platforms; write alpha `1.0` instead.
  - Avoid `getError` and `readPixels` per frame. https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
  - `powerPreference` is a hint (`default`, `high-performance`, `low-power`). `failIfMajorPerformanceCaveat: true` returns no context when performance would be low, which is a clean way to fall back to a static image. https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext
- Pausing:
  - `requestAnimationFrame` pauses in background tabs and hidden iframes, but not just because a canvas has scrolled out of view. It fires at the display rate, so use the timestamp, or 120Hz phones run the animation twice as fast. https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
  - For offscreen, use `IntersectionObserver`; MDN lists skipping animation work the user cannot see as a use for it. https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
  - `contentvisibilityautostatechange` is another option. MDN names pausing canvas drawing as a use. https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/content-visibility
- Context loss: call `preventDefault()` on `webglcontextlost`, or `webglcontextrestored` will not be delivered. Stop the loop, and on restore recreate programs and buffers. https://registry.khronos.org/webgl/specs/latest/1.0/ and https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextrestored_event

**My note:** I found no primary source with a DPR number for mid-range Android. Start at about 1 to 1.5 for a background and measure on a real device.

```ts
const gl = canvas.getContext("webgl2", {
  antialias: false,
  depth: false,
  powerPreference: "low-power",
  failIfMajorPerformanceCaveat: true,
});
if (!gl) return; // keep the CSS background or poster image

let raf = 0,
  visible = false;
const frame = (t: number) => {
  draw(t / 1000);
  raf = requestAnimationFrame(frame);
};
new IntersectionObserver(([e]) => {
  if (e.isIntersecting === visible) return;
  visible = e.isIntersecting;
  cancelAnimationFrame(raf);
  if (visible && !reducedMotion) raf = requestAnimationFrame(frame);
}).observe(canvas);
// Reduced motion: call draw() once for a still frame, do not start the loop.
```

### 6. Responsive and performance rules

**Start here:** https://web.dev/articles/animations-guide

- `prefers-reduced-motion`: values `no-preference` and `reduce`. Baseline widely available. On Android 9+ users set it at Settings > Accessibility > Remove animations, so test with that. Scaling and panning large objects are common triggers. https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion
- GSAP's accessibility guide says to decide per animation: remove decorative motion, simplify functional motion. System settings are not bulletproof, so it recommends an on-page toggle too. https://gsap.com/resources/a11y/
- `(hover: hover)` and `(pointer: fine)` test the primary input only. `any-pointer` tests any device. Both are widely available since December 2018. Use them to gate hover effects and custom cursors. https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/hover and https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/pointer
- Viewport units: `svh` assumes browser UI is expanded, `lvh` assumes it is retracted, `dvh` moves between them. `dvh` updates are throttled and not 60fps, and some browsers skip them on some gestures. Baseline widely available. https://web.dev/blog/viewport-units
- On Chrome Android, `vh` is sized as if the URL bar is hidden, so `100vh` can be taller than the visible area. https://developer.chrome.com/blog/url-bar-resizing
- `content-visibility: auto` skips rendering offscreen content but keeps it in the accessibility tree and find-in-page. Pair it with `contain-intrinsic-size: auto 500px` to reserve space. web.dev's example went from 232ms to 30ms of rendering on load. https://web.dev/articles/content-visibility and https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/content-visibility. Status: the MDN banner says Baseline 2024 (with an asterisk), while `web-features` dates the whole feature 2025-09-15. Treat it as safe to add, since browsers that skip it just render normally.
- `will-change`: MDN calls it a last resort for existing problems, not a way to prevent future ones. Do not put it on many elements or large sections. Add it just before the change with script and remove it after. It can create a stacking context. https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/will-change
- Cheap to animate: `transform` and `opacity`, the only two properties these pages name. Avoid animating `top`, `left` and `width`. Each extra layer costs memory and GPU upload, which can hurt low-memory phones. Check with Paint Flashing and the Performance panel. https://web.dev/articles/animations-overview, https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count and https://web.dev/articles/animations-guide
- `navigator.deviceMemory` is a coarse GiB value, HTTPS only, with browser-defined limits. Only Chromium browsers have it (no Firefox or Safari), so it is `undefined` for many users. The W3C spec became a Discontinued Draft on 20 Oct 2026, and MDN now says it is not in any specification. Use it only as a hint. https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory and https://www.w3.org/TR/device-memory-1/
- `navigator.hardwareConcurrency` is widely available but may report lower than the real count. https://developer.mozilla.org/en-US/docs/Web/API/Navigator/hardwareConcurrency. web.dev's adaptive loading talk lists throttling animation frame rate and avoiding costly work on low-end devices. It gives no numeric thresholds. https://web.dev/articles/adaptive-loading-cds-2019

**My note:** a lower quality setting should be the default when these signals are missing or low. Measuring real frame times for the first second or two is more trustworthy than either signal. That is my advice, and I did not find a source for it.

### 7. RTL for horizontal scroll and pin animation

**Plain answer: no first-party GSAP source covers RTL.** The ScrollTrigger docs do not mention `dir` or right-to-left. The source has no RTL handling. The only "direction" in it is the x/y axis. An RTL request in the forum (May 2021) ended with a moderator asking GreenSock to comment, and no staff reply appears on the page.

**Start here:** https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Logical_properties_and_values and the forum thread https://gsap.com/community/forums/topic/28089-right-to-left-horizontal-scroll-support/

- In RTL, `scrollLeft` is 0 at the rightmost position and goes negative as you scroll. https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollLeft. Chrome adopted this in version 86; before that it used positive values. https://github.com/mdn/browser-compat-data
- ScrollTrigger's math assumes positive scroll: `_maxScroll` is clamped to at least 0, and progress is `(scroll - start) / change`, clamped to 0 when below zero. https://github.com/greensock/GSAP/blob/master/src/ScrollTrigger.js. **My reading, not run:** `horizontal: true` on a real RTL scroller will likely stay at progress 0. Avoid that setup or test it first.
- The uos-style case is safe by design: the page scrolls vertically, and ScrollTrigger drives a transform. Vertical `scrollTop` does not change in RTL. **My reading, not run:** normal pinning should work on an RTL page, but test it.
- Under `dir="rtl"`, a flex `row` runs right to left, with the first item at the right edge. https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/flex-direction. Coordinates stay physical: x increases rightwards. https://drafts.csswg.org/cssom-view/. So overflow sits to the left, and the track must move in the positive x direction. Use `x: () => dir === "rtl" ? distance() : -distance()`. MDN's `translateX` page does not discuss writing direction, so test this.
- Moderator answers in the forum (2021, not docs) say to think of start and end in reverse. One accepted technique reverses the panels, sets `xPercent` to the end position, and tweens to 0. https://gsap.com/community/forums/topic/27439-scrolltrigger-horizontal-scroll-to-the-right/
- CSS scroll-driven animations do handle this. 0% is the startmost scroll position, in the scroller's writing mode, and `inline` / `block` are logical axes. https://drafts.csswg.org/scroll-animations-1/
- Use logical properties for layout (`margin-inline-start`, `inset-inline-start`, `text-align: start`). They are Baseline widely available. Set direction with `dir="rtl"` on `<html>`, not with CSS `direction`. https://www.w3.org/International/questions/qa-html-dir
- Switching language changes the layout, so old measurements are wrong. Rebuild animations by putting `dir` in the `useGSAP` dependencies with `revertOnUpdate: true`, as in topic 2. This is my reasoning from the docs, not a documented RTL recipe. https://gsap.com/resources/React/
- SplitText: the docs say it handles foreign characters well, but say nothing about Arabic or RTL. https://gsap.com/docs/v3/Plugins/SplitText/. **Unverified:** splitting Arabic into characters may break letter joining. Split by `words` or `lines`, and check on real text.

### 8. GSAP licensing

**Start here:** https://gsap.com/licensing/

- Yes, GSAP with all plugins is free for commercial use. The official FAQ says: "Commercial usage is covered under the standard license." It includes former members-only plugins such as SplitText and MorphSVG. https://gsap.com/licensing/
- The 3.13 release post (29 April 2025) says the same and that the bonus plugins moved into the main `gsap` npm package. https://gsap.com/blog/3-13/
- The license is Webflow's standard "no charge" license, effective 30 April 2025 and last changed 30 May 2025. https://gsap.com/community/standard-license/
- It is not open source, and there is a limit: you need Webflow's written consent to use GSAP in no-code visual animation builders that compete with Webflow's. You also cannot remove its notices or reverse engineer it to build competing products. https://gsap.com/licensing/
- npm metadata for `gsap` 3.15.1 points to this standard license, and so does `@gsap/react` 2.1.2. https://www.npmjs.com/package/gsap

**My note:** a club website is not a no-code animation builder, so the limit should not apply. This is my reading of the terms, not legal advice.

### 9. Official learning paths

**Start here:** https://gsap.com/resources/get-started/

Suggested order:

1. Basics: [Get started](https://gsap.com/resources/get-started/), then [Easing](https://gsap.com/resources/getting-started/Easing), [Staggers](https://gsap.com/resources/getting-started/Staggers), [Timelines](https://gsap.com/resources/getting-started/timelines), [Control](https://gsap.com/resources/getting-started/control).
2. Quick lookup: [cheatsheet](https://gsap.com/cheatsheet/) and [general mistakes](https://gsap.com/resources/mistakes/).
3. Scroll: [ScrollTrigger docs](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) and the short [ScrollTrigger mistakes](https://gsap.com/resources/st-mistakes/) list, which is worth reading twice.
4. React: [GSAP in React](https://gsap.com/resources/React/) and the official [StackBlitz React starters](https://stackblitz.com/@GSAP-dev/collections/gsap-react-starters).
5. Then study demos.

Official demos and videos:

- GSAP's demo site: https://demos.gsap.com/
- Collections linked from the official [Scroll page](https://gsap.com/scroll/): [ScrollTrigger demos](https://codepen.io/collection/DkvGzg), [scroll animation demos](https://codepen.io/collection/bNPYOw), [Observer demos](https://codepen.io/collection/KpNYOd), [ScrollSmoother demos](https://codepen.io/collection/BNMEYN).
- Horizontal demo from the docs, the closest match to a pinned section: https://codepen.io/GreenSock/pen/WNjaxKp
- Official video lessons: https://www.youtube.com/@GreenSockLearning
- Showcase of real sites: https://gsap.com/showcase/
- Official AI skills for GSAP (MIT), including React and performance notes: https://github.com/greensock/gsap-skills

Case studies written by the people who built the site:

- Buzzworthy on Working Stiff Films: GSAP + ScrollTrigger, Next.js, and no WebGL by choice. Useful proof that a strong scroll site can skip shaders. https://www.awwwards.com/working-stiff-films-case-study.html
- Akaru on its own site: Three.js + GSAP, and they avoided ScrollTrigger for horizontal navigation. https://www.awwwards.com/new-akaru-identity-and-website.html
- Benjamin Righetti portfolio (designer and developer): GSAP + ScrollTrigger with a custom smooth scroll. https://www.awwwards.com/case-study-benjamin-righetti.html

None of these three go deep on mobile, and none cover RTL.

---

### Could not verify

- **RTL behaviour of ScrollTrigger.** Everything in topic 7 about ScrollTrigger comes from reading the source and old forum threads. I did not run it. There is no official statement.
- **SplitText with Arabic.** Letter joining after a character split is untested and not documented.
- **Transforms under `dir="rtl"`.** I found no MDN line saying this directly. The positive-x rule rests on CSSOM View coordinates and flex order. Test it.
- **DPR cap for mid-range Android.** No primary source gives a number. The 1 to 1.5 starting point is my suggestion.
- **`<ViewTransition>` with TanStack Router.** Neither project documents using both together. What React does when the View Transitions API is missing is also not on its reference page.
- **TanStack docs wording.** They say navigation falls back to `document.startTransition()` when transition types are not supported. I know of no such DOM method. It looks like a slip for `startViewTransition`, so check the router source if you rely on `types`.
- **Age of some web.dev pages.** Several web.dev and Chrome pages showed no date, and some read as old. They name only `transform` and `opacity`. I did not confirm whether other properties, such as `filter`, are composited today.
- **CodePen pages.** They returned 403 to my tools, so I could not open the collections or the horizontal pen. The links and labels come from GSAP's own docs pages, and the "ScrollTrigger", "Observer" and "ScrollSmoother" labels come from their position on the Scroll page.
- **Webflow announcement.** https://webflow.com/blog/gsap-becomes-free would not load (a client error). I saw it only in search results, so topic 8 relies on gsap.com pages.
- **Khronos wiki on context loss.** It returned 403. I used the WebGL spec and MDN instead.
- **Codrops case study, Brandon Yasin portfolio.** https://tympanus.net/codrops/2026/11/04/brandon-yasin-portfolio/ returned 403. It looks useful (GSAP with Lenis), but I only saw a search summary, so I did not list it above.
- **`entry-crossing` and `exit-crossing`** range names were not in the part of the MDN page I read.
- **React Three Fiber** is not part of this stack. I cite it only as an example of a real-world DPR default.

## 9. Evidence and limits

- **Sources:** the live site's HTML, CSS and JavaScript chunks, read on 2026-11-05, plus behaviour
  measured in a browser at 1440x900, 1023x800 and 375x812. Main files: home scenes in chunk
  `2s260z55hwyks.js`, `useScene` in `18_n9xwmdb8jm.js`, GSAP setup in `0ofw_-1fdt8wz.js` (GSAP
  3.15.0), quality check and shaders in `0a8zlzzz1afrx.js`, splash in `1bcjrea29sf2h.js`, and CSS in
  `35ta6z9uj197-.css`. Chunk names change when the site redeploys.
- **Minified code:** names such as `Z` and `W` are the build's. Descriptions of intent are my
  reading of the code.
- **Throttled browser:** the test pane slows timers, so I checked structure and end states, not
  frame rates. No performance numbers here are from a real phone.
- **Phone emulation:** the `low` quality result came from emulation. A real high-end phone may get
  `high`. Stage mode stays off below 1024px either way.
- **Not tested:** real touch devices, reduced-motion behaviour, tablets, and first-visit splash on
  their site (I was a returning visitor in most runs).
