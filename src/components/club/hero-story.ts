/**
 * The home hero's scroll story. Every line is tied to the scroll position (scrubbed),
 * so there is no timeline to cut short: at any speed, the screen is a pure function of
 * where you are, and no panel can be skipped or left half hidden.
 */

type G = typeof import("gsap").gsap;

type Step = "name" | "who" | "numbers" | "join";

const lines: Record<Step, string> = {
  name: ".bh-word",
  who: ".bh-who .bh-title, .bh-who .bh-text, .bh-who .bh-majors li",
  numbers: ".bh-numbers .bh-facts > div, .bh-numbers .bh-reg",
  join: ".bh-motto span, .bh-actions",
};
const box: Record<Step, string> = {
  name: ".bh-name",
  who: ".bh-who",
  numbers: ".bh-numbers",
  join: ".bh-join",
};
// Lines rise from behind their own bottom edge, as the name's words do.
const below = { yPercent: 100, clipPath: "inset(-30% -5% 130% -5%)" };
const shown = { yPercent: 0, clipPath: "inset(-30% -5% -30% -5%)" };
const above = { yPercent: -100, clipPath: "inset(130% -5% -30% -5%)" };

/** Counts every [data-count] inside `node` up from 0, at `at` on timeline `t`. */
function counts(
  gsap: G,
  node: HTMLElement,
  t: gsap.core.Timeline,
  at: number | string,
  dur: number,
) {
  node.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
    const p = { v: 0 };
    t.fromTo(
      p,
      { v: 0 },
      {
        v: Number(el.dataset["count"]),
        duration: dur,
        ease: "power2.out",
        onUpdate: () => {
          el.textContent = Math.round(p.v).toLocaleString("en-US");
        },
      },
      at,
    );
  });
}

/** Extends the scrubbed master timeline `tl` (the arms already open over 0-1). */
export function buildScrub(gsap: G, node: HTMLElement, tl: gsap.core.Timeline) {
  tl.to(lines.name, { yPercent: -115, duration: 0.5, stagger: 0.08, ease: "power2.in" }, 0.4);

  const seg = (step: Exclude<Step, "name">, enter: number, exit?: number) => {
    tl.set(box[step], { autoAlpha: 1 }, enter).fromTo(
      lines[step],
      below,
      { ...shown, duration: 0.6, stagger: 0.1, ease: "power3.out" },
      enter,
    );
    if (step === "numbers") counts(gsap, node, tl, enter, 0.9);
    if (exit !== undefined)
      tl.to(lines[step], { ...above, duration: 0.5, stagger: 0.05, ease: "power2.in" }, exit).set(
        box[step],
        { autoAlpha: 0 },
        exit + 0.85,
      );
  };

  seg("who", 1.1, 3.2);
  seg("numbers", 3.5, 5.2);
  seg("join", 5.5);
  // Hold on the last panel.
  tl.to({}, { duration: 0 }, 7.2);
}
