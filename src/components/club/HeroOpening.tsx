import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import bracketLeft from "@/assets/logo/bracket-left.webp";
import bracketRight from "@/assets/logo/bracket-right.webp";
import dotTop from "@/assets/logo/dot-top.webp";
import dotBottom from "@/assets/logo/dot-bottom.webp";

/**
 * The hand-over from the loading screen to the home hero, after uos.acm.org.
 *
 * The logo stays exactly where the loading screen left it, on its navy splash.
 * A diamond fills in behind it with the page's own background and grows until
 * it covers the screen, opening the page in either theme; then each logo
 * piece flies into its bracket around the club name and the name rises. Runs only on a visit that showed the
 * loading screen, and only in BracketHero's live mode.
 */

// Same placement as the loading screen, so the hand-over is seamless.
const pieces = [
  [
    "left",
    bracketLeft,
    { left: "12.24%", top: "5.99%", width: "39.32%" },
    ".bh-arm-left .bh-bracket",
  ],
  [
    "right",
    bracketRight,
    { left: "49.48%", top: "30.47%", width: "38.54%" },
    ".bh-arm-right .bh-bracket",
  ],
  ["dot-top", dotTop, { left: "66.15%", top: "21.35%", width: "17.45%" }, ".bh-arm-right .bh-dot"],
  [
    "dot-bottom",
    dotBottom,
    { left: "15.89%", top: "65.36%", width: "17.19%" },
    ".bh-arm-left .bh-dot",
  ],
] as const;

function bootGone(html: HTMLElement) {
  return new Promise<void>((resolve) => {
    if (html.classList.contains("booted")) return resolve();
    const mo = new MutationObserver(() => {
      if (html.classList.contains("booted")) {
        mo.disconnect();
        resolve();
      }
    });
    mo.observe(html, { attributes: true, attributeFilter: ["class"] });
  });
}

export function HeroOpening() {
  const root = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const node = root.current;

    if (!node) return;
    const html = document.documentElement;
    html.classList.add("hero-opening");
    html.style.overflow = "hidden";
    const heroPieces = [...document.querySelectorAll<HTMLElement>(".bh-arm img")];
    heroPieces.forEach((el) => (el.style.visibility = "hidden"));
    let cancelled = false;

    const restore = () => {
      heroPieces.forEach((el) => (el.style.visibility = ""));
      html.classList.remove("hero-opening");
      html.style.overflow = "";
    };

    void (async () => {
      // Sit exactly where the loading screen's logo is, before it fades.
      const logo = node.querySelector<HTMLElement>(".ho-logo")!;
      const r = document.querySelector("#boot .boot-logo")?.getBoundingClientRect();
      const size = r?.width || Math.min(224, Math.max(144, innerWidth * 0.28));
      logo.style.width = `${size}px`;
      logo.style.left = `${r?.width ? r.left : (innerWidth - size) / 2}px`;
      logo.style.top = `${r?.width ? r.top : (innerHeight - size) / 2}px`;

      // The opening is in place: the loading screen may finish now.
      window.__bootDone?.();
      await bootGone(html);
      const { gsap } = await import("gsap");

      if (cancelled) return;
      const cx = parseFloat(logo.style.left) + size / 2;
      const cy = parseFloat(logo.style.top) + size / 2;
      const shape = node.querySelector<HTMLElement>(".ho-shape")!;
      const side = size * 1.25;
      Object.assign(shape.style, {
        width: `${side}px`,
        height: `${side}px`,
        left: `${cx - side / 2}px`,
        top: `${cy - side / 2}px`,
      });
      // A diamond |x|+|y| <= R covers the screen once R reaches half its width plus half its height.
      const cover = ((innerWidth + innerHeight) / 2 / (side / Math.SQRT2)) * 1.08;
      const atTop = window.scrollY < 10;
      const tl = gsap.timeline({
        onComplete: () => {
          restore();
          setDone(true);
        },
      });

      // Rotation through GSAP: it clears the CSS `rotate` property when it animates.
      tl.fromTo(
        shape,
        { rotation: 45, scale: 0.7, opacity: 0 },
        { rotation: 45, scale: 1, opacity: 1, duration: 0.5, ease: "power2.out" },
      )
        // It fills with the page's own background, so growing it opens the page in either theme.
        .to(shape, { backgroundColor: "var(--background)", duration: 0.4 }, 0.35)
        .to(shape, { scale: cover, duration: 0.9, ease: "power3.inOut" }, 0.8)
        .set(".ho-cover", { opacity: 0 }, 1.7);

      // Each logo piece flies into its place in the hero.
      for (const [name, , , target] of pieces) {
        const el = node.querySelector<HTMLElement>(`.ho-piece-${name}`)!;
        const to = document.querySelector<HTMLElement>(target)?.getBoundingClientRect();
        const from = el.getBoundingClientRect();
        if (!to || !atTop) {
          tl.to(el, { opacity: 0, duration: 0.4 }, 1.7);
          continue;
        }
        tl.to(
          el,
          {
            x: to.left - from.left,
            y: to.top - from.top,
            scale: to.width / from.width,
            transformOrigin: "0 0",
            duration: 1.1,
            ease: "expo.inOut",
          },
          1.7,
        );
      }
      tl.to(shape, { opacity: 0, duration: 0.6 }, 2.05).fromTo(
        ".bh-word",
        { yPercent: 115 },
        { yPercent: 0, duration: 1, stagger: 0.08, ease: "expo.out" },
        2.25,
      );
    })();

    // Cleanup only restores the page: React re-runs effects in dev, and the
    // overlay must survive that.
    return () => {
      cancelled = true;
      restore();
    };
  }, []);

  if (done) return null;

  // Portalled: <main> keeps a transform from its entrance animation, which
  // would pin `position: fixed` to <main> instead of the screen.
  return createPortal(
    <div ref={root} className="ho" aria-hidden="true">
      <div className="ho-cover" />
      <div className="ho-shape" />
      <div className="ho-logo">
        {pieces.map(([name, src, position]) => (
          <img
            key={name}
            src={src}
            alt=""
            className={`ho-piece ho-piece-${name}`}
            style={position}
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}
