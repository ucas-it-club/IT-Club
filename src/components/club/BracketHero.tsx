import { useEffect, useRef, useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ChevronDown, Instagram } from "lucide-react";
import { brandButtonClass } from "./brand-button-styles";
import { useClub } from "./club-context";
import { hrefOf } from "@/lib/club/paths";
import { local, safeUrl } from "@/lib/club/model";
import { contentImageUrls } from "@/lib/club/google-drive";
import { dateParts, eventDisplayStatus } from "@/lib/club/event-timing";
import bracketLeft from "@/assets/logo/bracket-left.webp";
import bracketRight from "@/assets/logo/bracket-right.webp";
import dotTop from "@/assets/logo/dot-top.webp";
import dotBottom from "@/assets/logo/dot-bottom.webp";
import { HeroOpening } from "./HeroOpening";
import { weakDevice } from "@/lib/club/device";
import { CountUp } from "./CountUp";
import { buildScrub } from "./hero-story";

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
 *   live     1024px and up: sticky stage, scrubbed by GSAP ScrollTrigger.
 *   static   narrower, reduced motion, a weak device or GSAP failing to load: every
 *            panel stacked and the page scrolls normally.
 * The mode follows the width live, so a resize needs no reload.
 * GSAP is imported on demand so it never touches the entry bundle.
 */

type Mode = "pending" | "live" | "static";

const committeeIds = ["administrative", "activities", "relations", "media"];

function useFacts() {
  const { lang, data, settings } = useClub();
  const ar = lang === "ar";
  const now = new Date();
  const next = data.events
    .filter((item) => eventDisplayStatus(item, now) === "upcoming")
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))[0];

  return {
    ar,
    lang,
    members: data.members.length,
    committees: committeeIds.filter((id) => data.members.some((m) => m.committee === id)).length,
    events: data.events.length,
    open: Boolean(settings.registrationOpen),
    instagram: safeUrl(settings.instagram),
    // The club's own photographs, for the opening screen studies.
    photos: data.events.flatMap((item) => contentImageUrls(item)).slice(0, 6),
    next: next ? local(next, "title", lang) : "",
    nextDate: dateParts(next?.date, lang),
  };
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

/**
 * Prototype for the stacked layout: who the club is, in one sentence that carries its
 * own figures, finished by the four fields as a ruled row, then the motto and the way in.
 */
function Sentence({ majors }: { majors: string[] }) {
  const { ar, members, committees, events } = useFacts();
  const locale = "en-US";
  const N = ({ v }: { v: number }) => (
    <b className="bh-sent-n">
      <CountUp value={v} locale={locale} />
    </b>
  );

  return (
    <div className="bh-sent" dir={ar ? "rtl" : "ltr"}>
      <p className="bh-sent-lede">
        {ar ? (
          <>
            نادٍ طلابي في الكلية الجامعية للعلوم التطبيقية يديره طلبته: <N v={members} /> عضوًا في{" "}
            <N v={committees} /> لجان، و<N v={events} /> فعاليات حتى الآن، في أربعة مجالات:
          </>
        ) : (
          <>
            A student-run club at the University College of Applied Sciences: <N v={members} />{" "}
            members in <N v={committees} /> committees and <N v={events} /> events so far, across
            four fields:
          </>
        )}
      </p>
      <ul className="bh-sent-fields">
        {majors.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
      <div className="bh-sent-close">
        <p className="bh-sent-motto">
          {(ar ? ["نتعلم", "نبتكر", "نتقدم"] : ["Learn.", "Innovate.", "Advance."]).map((w, i) => (
            <span key={w} className={`bh-motto-${i}`}>
              {w}
            </span>
          ))}
        </p>
        <Actions />
      </div>
    </div>
  );
}

export function BracketHero() {
  const { ar, lang, members, committees, events, open, photos, next, nextDate } = useFacts();
  const [mode, setMode] = useState<Mode>("pending");
  // No scroll story at any width, and no opening either.
  const [plain, setPlain] = useState(false);
  // The hand-over plays only on a visit that showed the loading screen.
  const [opening, setOpening] = useState(false);
  useEffect(() => {
    setOpening(!document.documentElement.classList.contains("boot-seen"));
  }, []);
  const root = useRef<HTMLElement>(null);
  // Prototype (on by default, ?intro=0 for the old hero): name, motto, numbers, name play
  // on their own before any scrolling, and every scroll step rises in like the name.
  const {
    intro: introParam,
    hero: heroParam,
    after: afterParam,
  } = useSearch({ strict: false }) as {
    intro?: unknown;
    hero?: unknown;
    after?: unknown;
  };
  // Prototype (?after=sentence): below 1024px, one sentence replaces the stacked panels.
  const sentence = afterParam === "sentence" && mode === "static";
  const story = String(introParam) !== "0";
  // Opening-screen studies: ?hero=wall | masthead | split. Absent keeps today's hero.
  const variant =
    heroParam === "wall" ||
    heroParam === "shelf" ||
    heroParam === "masthead" ||
    heroParam === "split"
      ? heroParam
      : null;
  const n = (v: number) => v.toLocaleString("en-US");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const still = plain || variant !== null || reduced || weakDevice();
    const html = document.documentElement;
    // Writing the scrollbar width inside the observation would resize the full-bleed
    // bands that read it, so the observer would fire again on its own write. Only a
    // real change lands, and it lands after the round that asked for it has finished.
    let sbwValue = "";
    let sbwQueued = 0;
    const sbw = () => {
      cancelAnimationFrame(sbwQueued);
      sbwQueued = requestAnimationFrame(() => {
        const next = `${window.innerWidth - html.clientWidth}px`;

        if (next === sbwValue) return;
        sbwValue = next;
        html.style.setProperty("--sbw", next);
      });
    };
    // A ResizeObserver, not a resize listener: the scrollbar also comes and goes
    // when the opening locks scrolling, which fires no resize event.
    sbw();
    const ro = new ResizeObserver(sbw);
    ro.observe(html);

    const wide = window.matchMedia("(min-width: 1024px)");
    const pick = () => setMode(!still && wide.matches ? "live" : "static");
    pick();
    wide.addEventListener("change", pick);
    setPlain(still);
    // No opening will run, so the loading screen should not wait for one.
    if (still) window.__bootDone?.();

    return () => {
      cancelAnimationFrame(sbwQueued);
      ro.disconnect();
      wide.removeEventListener("change", pick);
    };
  }, [plain, variant]);

  useEffect(() => {
    const node = root.current;

    if (!node || mode === "pending") return;

    let dispose = () => {};
    let cancelled = false;

    void (async () => {
      const loaded = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]).catch(() => null);

      if (cancelled) return;
      if (!loaded) {
        // A failed script must not leave a tall empty track or a hidden name.
        node.dataset["ready"] = "";
        setPlain(true);
        return;
      }
      const [{ gsap }, { ScrollTrigger }] = loaded;
      gsap.registerPlugin(ScrollTrigger);
      // A reload starts the story over, like the opening does; the router would otherwise
      // put the visitor back deep inside it. Back and forward keep their place.
      const nav = performance.getEntriesByType("navigation")[0] as
        PerformanceNavigationTiming | undefined;

      if (nav?.type === "reload" && window.scrollY > 0)
        window.scrollTo({ top: 0, behavior: "instant" });

      const q = <T extends Element>(sel: string) => gsap.utils.toArray<T>(sel, node);
      // Reverting a rebuild drops the count tweens back to 0: show the real figures again.
      q<HTMLElement>("[data-count]").forEach((el) => {
        el.textContent = Number(el.dataset["count"]).toLocaleString("en-US");
      });
      const ctx = gsap.context((self) => {
        const intro = gsap.timeline({ defaults: { ease: "expo.out" } });

        // With the loading screen, HeroOpening brings the brackets and the name in.
        // Without it, the brackets start together in the middle as the logo and
        // part to their places. Percent offsets, because the parallax owns x/y.
        // Coming back mid-story (back button) the scroll story owns the name; no entrance.
        if (!opening && window.scrollY < 40) {
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
          // Once the brackets have all but parted (they settle at 1.65), so the name
          // never rises underneath them while they still cross the middle.
          // Hidden from the start, not when their tween begins: a `from` placed later in
          // the timeline leaves the name showing, under the brackets, until then.
          gsap.set(".bh-word", { yPercent: 115 });
          intro.to(".bh-word", { yPercent: 0, duration: 1.1, stagger: 0.08 }, 1.5);
        }
        intro.from(".bh-cue", { opacity: 0, y: -8, duration: 0.8 }, opening ? 3 : 1.6);

        // Nothing below belongs on the static layout.
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

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          // The story plays on a timer, after the entrance has settled. Without it
          // (?intro=0) the old scroll-scrubbed story stays.
          ...(story
            ? { delay: opening ? 5 : 4.2 }
            : {
                scrollTrigger: {
                  trigger: ".bh-track",
                  start: "top top",
                  end: "bottom bottom",
                  // Catches up over a moment instead of following the wheel exactly: the glide.
                  scrub: 1.1,
                  invalidateOnRefresh: true,
                },
              }),
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
          .to(left, { x: toLeft, duration: 1, ease: "power2.inOut" }, 0)
          .to(right, { x: toRight, duration: 1, ease: "power2.inOut" }, 0);

        // The panels change on their own clock, whatever the scroll does, and the
        // story loops. It pauses while the hero is off screen.
        if (story) {
          buildScrub(gsap, node, tl, true);
          // The arms close again as the last panel leaves.
          tl.to(left, { x: 0, duration: 1, ease: "power2.inOut" }, 8.5).to(
            right,
            { x: 0, duration: 1, ease: "power2.inOut" },
            8.5,
          );
          tl.repeat(-1).timeScale(0.65);
          ScrollTrigger.create({
            trigger: node,
            start: "top bottom",
            end: "bottom top",
            onToggle: (self) => (self.isActive ? tl.play() : tl.pause()),
          });
          return;
        }

        swap(".bh-name", ".bh-who", 0.2);
        swap(".bh-who", ".bh-numbers", 1.4);
        swap(".bh-numbers", ".bh-join", 2.6);
        tl.to({}, { duration: 0.4 }, 3.6);

        q<HTMLElement>("[data-count]").forEach((el) => {
          const proxy = { v: 0 };

          tl.to(
            proxy,
            {
              // Read when the tween first runs, so counts that load late are used.
              v: () => Number(el.dataset["count"]),
              duration: 0.7,
              ease: "power2.out",
              onUpdate: () => {
                el.textContent = Math.round(proxy.v).toLocaleString("en-US");
              },
            },
            1.9,
          );
        });
      }, node);

      // The entrance has set its starting state; the brackets and name may show.
      node.dataset["ready"] = "";

      dispose = ((prev) => () => {
        prev();
        ctx.revert();
      })(dispose);
    })();

    return () => {
      cancelled = true;
      dispose();
    };
    // Not the counts: rebuilding when they load would replay the entrance mid-way.
    // Both paths read them from data-count when they animate.
  }, [mode, opening, story, ar]);

  const majors = ar
    ? ["تطبيقات الجوال", "ألعاب الجوال", "تطوير الويب", "الوسائط المتعددة"]
    : ["Mobile apps", "Mobile games", "Web", "Multimedia"];

  return (
    <section
      ref={root}
      className="bh"
      data-mode={mode}
      data-timed={story ? "" : undefined}
      data-variant={variant ?? undefined}
    >
      <div className="bh-track">
        <div className="bh-stage" dir="ltr">
          {(variant === "wall" || variant === "shelf") && (
            <div
              className={variant === "wall" ? "bh-wall" : "bh-shelf"}
              data-empty={photos.length ? undefined : ""}
              aria-hidden="true"
            >
              {photos.map((src) => (
                <img key={src} src={src} alt="" loading="lazy" decoding="async" />
              ))}
            </div>
          )}

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

          {variant === "masthead" && (
            <>
              <p className="bh-dateline" dir={ar ? "rtl" : "ltr"}>
                <span>
                  {n(members)} {ar ? "عضوًا" : "members"}
                </span>
                <span>
                  {n(committees)} {ar ? "لجان" : "committees"}
                </span>
                <span>
                  {n(events)} {ar ? "فعاليات" : "events"}
                </span>
              </p>
              <p className="bh-motto bh-motto-line" dir={ar ? "rtl" : "ltr"}>
                {(ar ? ["نتعلم", "نبتكر", "نتقدم"] : ["Learn.", "Innovate.", "Advance."]).map(
                  (w, i) => (
                    <span key={w} className={`bh-motto-${i}`}>
                      {w}
                    </span>
                  ),
                )}
              </p>
            </>
          )}

          {variant === "split" && (
            <aside className="bh-rail" dir={ar ? "rtl" : "ltr"}>
              <p className="bh-rail-label">{ar ? "المسارات" : "Tracks"}</p>
              <ul className="bh-rail-list">
                {majors.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <div className="bh-rail-next">
                <p className="bh-rail-label">{ar ? "الفعالية القادمة" : "Next event"}</p>
                {next ? (
                  <p className="bh-rail-event">
                    {next}
                    {nextDate && (
                      <span>
                        {nextDate.day} {nextDate.month}
                      </span>
                    )}
                  </p>
                ) : (
                  <Link to={hrefOf(lang, "events")} className="bh-rail-event is-link">
                    {ar ? "كل الفعاليات" : "All events"}
                  </Link>
                )}
              </div>
            </aside>
          )}

          {sentence ? (
            <Sentence majors={majors} />
          ) : (
            <>
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
                {open && (
                  <p className="bh-reg is-open">{ar ? "التسجيل مفتوح" : "Registration open"}</p>
                )}
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
            </>
          )}

          <ChevronDown className="bh-cue" size={28} aria-hidden="true" />
        </div>
      </div>
      {opening && !plain && mode !== "pending" && <HeroOpening />}
    </section>
  );
}
