/**
 * The home stories slide, animated on the cards themselves.
 *
 * A view transition drew the cards as snapshots on a layer above the page: they
 * covered the sticky header and stayed put while the page scrolled (#61). Here the
 * real cards move (FLIP: measure, update, animate from the old box), so they scroll
 * with the page and stay under the header.
 */

type Box = Pick<DOMRect, "left" | "top" | "width" | "height">;
export type Side = "left" | "right";

const timing: KeyframeAnimationOptions = {
  duration: 800,
  easing: "cubic-bezier(0.65, 0, 0.35, 1)",
};

/** Transform that puts a card laid out at `now` back where it was drawn at `was`. */
export function flipFrom(was: Box, now: Box) {
  return `translate(${was.left - now.left}px, ${was.top - now.top}px) scale(${was.width / now.width}, ${was.height / now.height})`;
}

/** Moves a card drawn at `box` until it is fully past the viewport's `side` edge. */
export function offScreen(side: Side, box: Pick<Box, "left" | "width">, viewport: number) {
  const dx = side === "left" ? -(box.left + box.width) : viewport - box.left;
  return `translateX(${dx}px)`;
}

const shown = (el: HTMLElement) => el.getClientRects().length > 0;

/**
 * Runs `update` (which must render synchronously) and slides the stage's cards into
 * their new places. New cards come in from `from`; cards that leave slide off the
 * other side as copies that are removed when they are gone. Each card needs a
 * `data-key`. A slide that starts during another picks up from where cards are drawn.
 */
export function slideCards(stage: HTMLElement, update: () => void, from: Side) {
  const cards = () =>
    [...stage.children].filter((el): el is HTMLElement => !!(el as HTMLElement).dataset["key"]);
  const before = new Map<string, { box: DOMRect; copy: HTMLElement }>();

  for (const el of cards()) {
    if (!shown(el)) continue;
    // Measured before cancelling, so an interrupted slide continues from what is on screen.
    before.set(el.dataset["key"]!, {
      box: el.getBoundingClientRect(),
      copy: el.cloneNode(true) as HTMLElement,
    });
  }
  // Cards still leaving from an interrupted slide keep going; they remove themselves.
  for (const el of cards()) el.getAnimations().forEach((a) => a.cancel());

  update();

  const stageBox = stage.getBoundingClientRect();
  const viewport = document.documentElement.clientWidth;
  const done: Promise<unknown>[] = [];
  const to = from === "left" ? "right" : "left";

  for (const el of cards()) {
    if (!shown(el)) continue;
    const was = before.get(el.dataset["key"]!);
    const now = el.getBoundingClientRect();
    const frames = was
      ? [
          { transformOrigin: "0 0", transform: flipFrom(was.box, now) },
          { transformOrigin: "0 0", transform: "none" },
        ]
      : [{ transform: offScreen(from, now, viewport) }, { transform: "none" }];
    done.push(el.animate(frames, timing).finished);
  }

  for (const [key, { box, copy }] of before) {
    if (cards().some((el) => el.dataset["key"] === key && shown(el))) continue;
    copy.removeAttribute("data-key");
    copy.removeAttribute("class");
    copy.dataset["hsLeaving"] = "";
    copy.inert = true;
    copy.setAttribute("aria-hidden", "true");
    Object.assign(copy.style, {
      position: "absolute",
      left: `${box.left - stageBox.left}px`,
      top: `${box.top - stageBox.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      pointerEvents: "none",
    });
    stage.append(copy);
    const slide = copy.animate(
      [{ transform: "none" }, { transform: offScreen(to, box, viewport) }],
      timing,
    );
    done.push(slide.finished.finally(() => copy.remove()));
  }

  // While cards travel past the screen edges the page clips sideways (styles.css), so no scrollbar flashes.
  stage.dataset["sliding"] = "";
  void Promise.allSettled(done).then(() => {
    if (
      !stage.querySelector(":scope > [data-hs-leaving]") &&
      !cards().some((el) => el.getAnimations().length)
    )
      delete stage.dataset["sliding"];
  });
}
