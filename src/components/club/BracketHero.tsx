import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ChevronDown, Instagram } from "lucide-react";
import { brandButtonClass } from "./brand-button-styles";
import { useClub } from "./club-context";
import { hrefOf } from "@/lib/club/paths";
import { safeUrl } from "@/lib/club/model";
import bracketLeft from "@/assets/logo/bracket-left.webp";
import bracketRight from "@/assets/logo/bracket-right.webp";
import dotTop from "@/assets/logo/dot-top.webp";
import dotBottom from "@/assets/logo/dot-bottom.webp";
import { HeroOpening } from "./HeroOpening";

/**
 * Home hero: the club name between the logo's two brackets.
 *
 * The first screen is the name and nothing else. Scrolling holds the stage in
 * place, opens the brackets to the screen edges and passes three panels
 * between them, each saying one thing: who we are, the club in numbers, and
 * the motto with the way in.
 *
 * Three modes, decided on the client so the server render is always the plain
 * first screen:
 *   pending  server render / before JS: the name only.
 *   live     sticky stage, scrubbed by GSAP ScrollTrigger.
 *   static   reduced motion or a weak device: every panel stacked, no scroll story.
 * GSAP is imported on demand so it never touches the entry bundle.
 */

type Mode = "pending" | "live" | "static";

const committeeIds = ["administrative", "activities", "relations", "media"];

function useFacts() {
  const { lang, data, settings } = useClub();
  const ar = lang === "ar";

  return {
    ar,
    lang,
    members: data.members.length,
    committees: committeeIds.filter((id) => data.members.some((m) => m.committee === id)).length,
    events: data.events.length,
    open: Boolean(settings.registrationOpen),
    instagram: safeUrl(settings.instagram),
  };
}

function weakDevice() {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };

  return (
    (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) ||
    (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2) ||
    nav.connection?.saveData === true
  );
}

/**
 * One bracket of the club logo, cut pixel-for-pixel out of ucas-logo.webp
 * (src/assets/logo/). Nothing is redrawn. Its grey dot rides with it at the
 * same offset the logo has. `side` is visual and never flips with the language.
 */
function Arm({ side }: { side: "left" | "right" }) {
  const left = side === "left";

  return (
    <div className={`bh-arm bh-arm-${side}`} aria-hidden="true">
      <img
        src={left ? bracketLeft : bracketRight}
        alt=""
        width={left ? 151 : 148}
        height={left ? 265 : 254}
        className="bh-bracket"
        data-depth={left ? -22 : 22}
        decoding="async"
      />
      <img
        src={left ? dotBottom : dotTop}
        alt=""
        width={left ? 66 : 67}
        height={left ? 65 : 66}
        className="bh-dot"
        data-depth={left ? 36 : -36}
        decoding="async"
      />
    </div>
  );
}

function Actions() {
  const { ar, lang, open, instagram } = useFacts();
  const Arrow = ar ? ArrowLeft : ArrowRight;

  return (
    <div className="bh-actions">
      {open ? (
        <Link to={hrefOf(lang, "join")} className={brandButtonClass("primary", "lg")}>
          {ar ? "انضم إلى النادي" : "Join the club"}
          <Arrow size={20} aria-hidden="true" />
        </Link>
      ) : (
        instagram && (
          <a
            href={instagram}
            target="_blank"
            rel="noopener noreferrer"
            className={brandButtonClass("primary", "lg")}
          >
            <Instagram size={20} aria-hidden="true" />
            {ar ? "تابعنا على إنستغرام" : "Follow on Instagram"}
          </a>
        )
      )}
      <Link to={hrefOf(lang, "members")} className={brandButtonClass("outline", "lg")}>
        {ar ? "تعرّف على الفريق" : "Meet the team"}
      </Link>
    </div>
  );
}

export function BracketHero() {
  const { ar, members, committees, events, open } = useFacts();
  const [mode, setMode] = useState<Mode>("pending");
  // The hand-over plays only on a visit that showed the loading screen.
  const [opening, setOpening] = useState(false);
  useEffect(() => {
    setOpening(!document.documentElement.classList.contains("boot-seen"));
  }, []);
  const root = useRef<HTMLElement>(null);
  const n = (v: number) => v.toLocaleString(ar ? "ar-EG" : "en-US");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const still = reduced || weakDevice();
    const html = document.documentElement;
    const sbw = () => html.style.setProperty("--sbw", `${window.innerWidth - html.clientWidth}px`);
    // A ResizeObserver, not a resize listener: the scrollbar also comes and goes
    // when the opening locks scrolling, which fires no resize event.
    sbw();
    const ro = new ResizeObserver(sbw);
    ro.observe(html);

    setMode(still ? "static" : "live");
    // No opening will run, so the loading screen should not wait for one.
    if (still) window.__bootDone?.();

    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const node = root.current;

    if (!node || mode === "pending") return;

    let dispose = () => {};
    let cancelled = false;

    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);

      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      const q = <T extends Element>(sel: string) => gsap.utils.toArray<T>(sel, node);
      const ctx = gsap.context(() => {
        const intro = gsap.timeline({ defaults: { ease: "expo.out" } });

        // With the loading screen, HeroOpening brings the brackets and the name in.
        // Without it, the brackets start together in the middle as the logo and
        // part to their places. Percent offsets, because the parallax owns x/y.
        if (!opening) {
          const row = node.querySelector<HTMLElement>(".bh-row")!.getBoundingClientRect();
          const cx = row.left + row.width / 2;
          const cy = row.top + row.height / 2;
          for (const side of ["left", "right"] as const) {
            const bracket = node.querySelector<HTMLElement>(`.bh-arm-${side} .bh-bracket`)!;
            const b = bracket.getBoundingClientRect();
            // Where this bracket sits in the assembled logo, relative to the logo's centre.
            const sign = side === "left" ? -1 : 1;
            const dx = cx + sign * 0.47 * b.width - (b.left + b.width / 2);
            const dy = cy + sign * 0.3 * b.width - (b.top + b.height / 2);
            const parts = node.querySelectorAll<HTMLElement>(`.bh-arm-${side} img`);
            intro
              .fromTo(
                parts,
                {
                  xPercent: (_: number, el: HTMLElement) => (dx / el.offsetWidth) * 100,
                  yPercent: (_: number, el: HTMLElement) => (dy / el.offsetHeight) * 100,
                  opacity: 0,
                  scale: 0.85,
                },
                { opacity: 1, scale: 1, duration: 0.45, ease: "power2.out" },
                0,
              )
              .to(parts, { xPercent: 0, yPercent: 0, duration: 1.1, ease: "expo.inOut" }, 0.55);
          }
          intro.from(".bh-word", { yPercent: 115, duration: 1.1, stagger: 0.08 }, 1.05);
        }
        intro.from(".bh-cue", { opacity: 0, y: -8, duration: 0.8 }, opening ? 3 : 1.6);

        if (mode !== "live") return;

        q(".bh-dot").forEach((el, i) =>
          gsap.to(el, {
            // yPercent, so the drift never fights the parallax, which sets y.
            // It starts once the entrance, which also moves yPercent, is over.
            delay: opening ? 4 : 1.8,
            yPercent: i % 2 ? 14 : -14,
            duration: 2.8 + i * 0.4,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          }),
        );

        // Pointer parallax, fine pointers only. Moves the images inside each
        // arm so it never fights the scroll timeline, which moves the arms.
        if (window.matchMedia("(pointer: fine)").matches) {
          const layers = q<HTMLElement>("[data-depth]").map((el) => ({
            x: gsap.quickTo(el, "x", { duration: 0.9, ease: "power3.out" }),
            y: gsap.quickTo(el, "y", { duration: 0.9, ease: "power3.out" }),
            depth: Number(el.dataset["depth"]),
          }));
          const move = (e: PointerEvent) => {
            const dx = e.clientX / window.innerWidth - 0.5;
            const dy = e.clientY / window.innerHeight - 0.5;

            for (const l of layers) {
              l.x(dx * l.depth);
              l.y(dy * l.depth);
            }
          };

          window.addEventListener("pointermove", move);
          dispose = () => window.removeEventListener("pointermove", move);
        }

        const stage = node.querySelector<HTMLElement>(".bh-stage")!;
        const left = node.querySelector<HTMLElement>(".bh-arm-left")!;
        const right = node.querySelector<HTMLElement>(".bh-arm-right")!;
        // How far each arm may travel: to the stage's own side padding, never past it.
        // offsetLeft ignores transforms, so this measures the resting layout.
        const edge = () => parseFloat(getComputedStyle(stage).paddingInlineStart) || 16;
        const toLeft = () => -Math.max(0, left.offsetLeft - edge());
        const toRight = () =>
          Math.max(0, stage.clientWidth - right.offsetLeft - right.offsetWidth - edge());
        // Phones have no room beside the panels, so both brackets also rise to
        // the top corners, level with each other, and the panels take the width.
        const narrow = () => window.matchMedia("(max-width: 639px)").matches;
        const up = (arm: HTMLElement) => () =>
          narrow() ? -Math.max(0, arm.offsetTop - edge()) : 0;

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: ".bh-track",
            start: "top top",
            end: "bottom bottom",
            scrub: true,
            invalidateOnRefresh: true,
          },
        });
        const swap = (out: string, into: string, at: number) => {
          tl.to(out, { opacity: 0, y: -40, duration: 0.5, ease: "power2.in" }, at)
            .set(out, { visibility: "hidden" }, at + 0.5)
            .set(into, { visibility: "visible" }, at + 0.5)
            .fromTo(
              into,
              { opacity: 0, y: 40 },
              { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" },
              at + 0.5,
            );
        };

        tl.to(".bh-cue", { opacity: 0, duration: 0.2 }, 0)
          .to(left, { x: toLeft, y: up(left), duration: 1, ease: "power2.inOut" }, 0)
          .to(right, { x: toRight, y: up(right), duration: 1, ease: "power2.inOut" }, 0);
        swap(".bh-name", ".bh-who", 0.2);
        swap(".bh-who", ".bh-numbers", 1.4);
        swap(".bh-numbers", ".bh-join", 2.6);
        tl.to({}, { duration: 0.4 }, 3.6);

        q<HTMLElement>("[data-count]").forEach((el) => {
          const target = Number(el.dataset["count"]);
          const proxy = { v: 0 };

          tl.to(
            proxy,
            {
              v: target,
              duration: 0.7,
              ease: "power2.out",
              onUpdate: () => {
                el.textContent = Math.round(proxy.v).toLocaleString(ar ? "ar-EG" : "en-US");
              },
            },
            1.9,
          );
        });
      }, node);

      dispose = ((prev) => () => {
        prev();
        ctx.revert();
      })(dispose);
    })();

    return () => {
      cancelled = true;
      dispose();
    };
  }, [mode, opening, ar, members, committees, events]);

  const majors = ar
    ? ["تطبيقات الجوال", "ألعاب الجوال", "تطوير الويب", "الوسائط المتعددة"]
    : ["Mobile apps", "Mobile games", "Web", "Multimedia"];

  return (
    <section ref={root} className="bh" data-mode={mode}>
      <div className="bh-track">
        <div className="bh-stage" dir="ltr">
          <div className="bh-row">
            <Arm side="left" />
            <h1 className="bh-name" dir={ar ? "rtl" : "ltr"}>
              {(ar ? ["النادي", "التكنولوجي"] : ["UCAS", "IT", "Club"]).map((word) => (
                <span key={word} className="bh-mask">
                  <span className="bh-word">{word}</span>
                </span>
              ))}
            </h1>
            <Arm side="right" />
          </div>

          <div className="bh-panel bh-who" dir={ar ? "rtl" : "ltr"}>
            <h2 className="bh-title">{ar ? "من نحن" : "Who we are"}</h2>
            <p className="bh-text">
              {ar
                ? "نادٍ طلابي في الكلية الجامعية للعلوم التطبيقية، يديره طلبته ويجمع المهتمين بالبرمجة والتصميم والألعاب والوسائط."
                : "A student-run club at the University College of Applied Sciences for everyone working in code, design, games and media."}
            </p>
            <ul className="bh-majors">
              {majors.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>

          <div className="bh-panel bh-numbers" dir={ar ? "rtl" : "ltr"}>
            <h2 className="bh-title">{ar ? "النادي بالأرقام" : "The club in numbers"}</h2>
            <dl className="bh-facts">
              {(
                [
                  [members, ar ? "عضوًا" : "members"],
                  [committees, ar ? "لجان" : "committees"],
                  [events, ar ? "فعاليات" : "events"],
                ] as const
              ).map(([v, label]) => (
                <div key={label}>
                  <dt data-count={v}>{n(v)}</dt>
                  <dd>{label}</dd>
                </div>
              ))}
            </dl>
            <p className={`bh-reg ${open ? "is-open" : ""}`}>
              {open
                ? ar
                  ? "التسجيل مفتوح"
                  : "Registration open"
                : ar
                  ? "التسجيل مغلق حاليًا"
                  : "Registration closed"}
            </p>
          </div>

          <div className="bh-panel bh-join" dir={ar ? "rtl" : "ltr"}>
            <h2 className="bh-motto">
              {(ar ? ["نتعلم", "نبتكر", "نتقدم"] : ["Learn.", "Innovate.", "Advance."]).map(
                (w, i) => (
                  <span key={w} className={`bh-motto-${i}`}>
                    {w}
                  </span>
                ),
              )}
            </h2>
            <Actions />
          </div>

          <ChevronDown className="bh-cue" size={28} aria-hidden="true" />
        </div>
      </div>
      {opening && mode === "live" && <HeroOpening />}
    </section>
  );
}
