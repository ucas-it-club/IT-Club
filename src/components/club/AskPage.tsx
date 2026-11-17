import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import logo from "@/assets/ucas-logo.webp";
import mascot from "@/assets/club-mascot.webp";
import { isTestMode, track } from "@/lib/club/ask-track";
import { askCategories, askQuestions, shuffle, type AskQuestion } from "@/lib/club/ice-questions";
import { SiteBackground } from "./SiteBackground";

const GAP = 20; // wider than the page margin, so a resting card never shows a sliver of its neighbour
const INTRO = -1; // the welcome card sits just before the first question
const labelOf = (key: string) => askCategories.find((c) => c.key === key)?.label ?? "";
const mod = (n: number, m: number) => ((n % m) + m) % m;
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
const confetti = ["#78b7f3", "#86cd62", "#35c9c1", "#cdd8e6"]; // the four category colours

/** idle; spin: the reel is running; land: the card just stopped (one-off flash, then idle). */
type Phase = "idle" | "spin" | "land";

type Go = { ms?: number; ease?: (p: number) => number; done?: () => void };

/**
 * /ask: unlisted ice-breaker page for the field event. One screen, no site chrome (see Shell),
 * no way out and no way back. The big button spins the cards like a slot reel, the background
 * speeds up, and a random question lands with its category tag. A swipe browses the row by hand,
 * as on the quote-card page.
 */
export function AskPage() {
  // Shuffled once the page is on screen (random order must not differ between server and browser).
  const [deck, setDeck] = useState<readonly AskQuestion[]>([]);
  const [index, setIndex] = useState(INTRO); // the card nearest the middle
  const [phase, setPhase] = useState<Phase>("idle");
  const [pop, setPop] = useState(0); // bumped when a spin lands, to replay the card's entrance
  const pos = useRef(INTRO); // where the row really is: fractional while dragging or settling
  const cards = useRef(new Map<number, HTMLElement>());
  const stage = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const busy = useRef(false); // a spin is running: ignore swipes and further presses
  const landTimer = useRef(0);
  const landed = useRef(INTRO);
  const touch = useRef<{ x0: number; t0: number; base: number; moved: boolean; dx: number } | null>(
    null,
  );
  const testMode = useRef(false);

  useEffect(() => {
    testMode.current = isTestMode();
    track("/ask", testMode.current);
    setDeck(shuffle(askQuestions));

    return () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(landTimer.current);
    };
  }, []);

  // Keep the visitor here: an extra history entry that is re-added on every back press, and no
  // browser back-swipe from a sideways drag on the cards.
  useEffect(() => {
    const hold = () => history.pushState(history.state, "", location.href);
    const root = document.documentElement;

    hold();
    window.addEventListener("popstate", hold);
    root.style.overscrollBehaviorX = "none";

    return () => {
      window.removeEventListener("popstate", hold);
      root.style.overscrollBehaviorX = "";
    };
  }, []);

  const questionAt = (i: number) => (i < 0 || !deck.length ? undefined : deck[mod(i, deck.length)]);

  // Cards sit flat in a row: offset 0 middle, -1 the next one on the left (the page is RTL).
  const place = () => {
    for (const [i, el] of cards.current) {
      const o = pos.current - i;
      const a = Math.abs(o);

      el.style.transform = `translateX(calc(${o} * (100% + ${GAP}px))) scale(${1 - Math.min(a, 1) * 0.08})`;
      el.style.opacity = String(Math.max(0, 1 - a * 0.35));
      el.style.zIndex = String(5 - Math.round(a * 2));
    }
  };
  useLayoutEffect(place);

  const sync = () => {
    const nearest = Math.max(INTRO, Math.round(pos.current));

    setIndex((current) => (current === nearest ? current : nearest));
  };

  const land = (i: number) => {
    const question = questionAt(i);

    if (!question || landed.current === i) return;
    landed.current = i;
    track(`ask-${question.category}`, testMode.current);
  };

  const go = (target: number, { ms = 320, ease = easeOutCubic, done }: Go = {}) => {
    const to = Math.max(INTRO, target);
    const from = pos.current;
    const start = performance.now();
    const time = reduceMotion() ? 0 : ms;
    let last = from;
    let lastAt = start;

    cancelAnimationFrame(raf.current);
    const step = (now: number) => {
      const p = time ? Math.min(1, (now - start) / time) : 1;

      pos.current = from + (to - from) * ease(p);
      // Cards blur in proportion to the reel's speed (cards per second).
      const speed = Math.abs(pos.current - last) / Math.max(1, now - lastAt);

      stage.current?.style.setProperty("--blur", `${Math.min(2.5, speed * 90).toFixed(2)}px`);
      last = pos.current;
      lastAt = now;
      place();
      sync();
      if (p < 1) raf.current = requestAnimationFrame(step);
      else {
        stage.current?.style.removeProperty("--blur");
        land(to);
        done?.();
      }
    };
    raf.current = requestAnimationFrame(step);
  };

  // The game: spin the reel past 9 to 16 cards and let it slow down onto a question.
  const spin = () => {
    if (busy.current || !deck.length) return;
    if (reduceMotion()) return go(Math.round(pos.current) + 1);
    const from = Math.round(pos.current);

    busy.current = true;
    clearTimeout(landTimer.current);
    setPhase("spin");
    navigator.vibrate?.(20);
    go(from + 9 + Math.floor(Math.random() * 8), {
      ms: 2000,
      done: () => {
        busy.current = false;
        setPhase("land");
        setPop((n) => n + 1);
        navigator.vibrate?.([30, 40, 30]);
        landTimer.current = window.setTimeout(() => setPhase("idle"), 1000);
      },
    });
  };

  // Swipe: the row follows the finger. Release past 22% of a card, or a flick, moves one more.
  const width = () => (cards.current.get(index)?.offsetWidth ?? 280) + GAP;
  const down = (e: PointerEvent<HTMLElement>) => {
    if (e.button > 0 || busy.current) return;
    cancelAnimationFrame(raf.current); // grab the row where it is
    touch.current = {
      x0: e.clientX,
      t0: performance.now(),
      base: pos.current,
      moved: false,
      dx: 0,
    };
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    const t = touch.current;

    if (!t) return;
    t.dx = e.clientX - t.x0;
    if (!t.moved && Math.abs(t.dx) < 8) return;
    if (!t.moved) {
      t.moved = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    pos.current = Math.max(INTRO, t.base + t.dx / width());
    place();
    sync();
  };
  const up = (e: PointerEvent<HTMLElement>) => {
    const t = touch.current;

    touch.current = null;
    if (!t) return;
    const nearest = Math.max(INTRO, Math.round(pos.current));

    if (!t.moved) {
      const hit = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
      const i = hit ? Number(hit.dataset["i"]) : nearest;

      // A tap on the middle card plays the game; a tap on a neighbour turns to it.
      if (e.type !== "pointerup") return go(nearest);

      return i === nearest ? spin() : go(i);
    }
    const dir = Math.sign(t.dx);
    const drag = pos.current - nearest;
    const fast = Math.abs(t.dx) > 20 && Math.abs(t.dx) / (performance.now() - t.t0) > 0.5; // px per ms

    go((fast && drag * dir > -0.2) || drag * dir > 0.22 ? nearest + dir : nearest);
  };

  const current = questionAt(index);
  const shown = [index - 2, index - 1, index, index + 1, index + 2].filter(
    (i) => i === INTRO || (i >= 0 && deck.length > 0),
  );
  // Confetti thrown from the middle when a spin lands; the angles are random per landing.
  const pieces = useMemo(
    () =>
      pop
        ? Array.from({ length: 16 }, (_, k) => {
            const angle = ((k + Math.random()) / 16) * Math.PI * 2;
            const dist = 110 + Math.random() * 110;

            return {
              dx: Math.round(Math.cos(angle) * dist),
              dy: Math.round(Math.sin(angle) * dist),
              size: 6 + Math.round(Math.random() * 7),
              color: confetti[k % confetti.length],
            };
          })
        : [],
    [pop],
  );

  return (
    <div
      className="ask"
      data-cat={phase === "spin" ? undefined : current?.category}
      data-intro={current ? undefined : ""}
      data-phase={phase}
    >
      <SiteBackground />
      <header className="ask-head" dir="ltr">
        <img src={logo} alt="" width={124} height={160} />
        <h1>Break the Ice</h1>
      </header>

      <div
        ref={stage}
        className="ask-stage"
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label="الأسئلة، اسحب لسؤال آخر"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={(e) => {
          if (busy.current) return;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            go(Math.round(pos.current) + 1);
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            go(Math.round(pos.current) - 1);
          }
        }}
      >
        {shown.map((i) => {
          const question = questionAt(i);

          return (
            <article
              key={i}
              ref={(el) => {
                if (el) cards.current.set(i, el);
                else cards.current.delete(i);
              }}
              data-i={i}
              data-cat={question?.category}
              className="ask-card"
              aria-hidden={i !== index}
            >
              {question && phase === "spin" ? (
                // No text while the reel runs: it could not keep up, and the reveal is the point.
                <div className="ask-back" aria-hidden="true">
                  ؟
                </div>
              ) : question ? (
                // The middle card remounts on every landing: tag first, then the question.
                <div key={i === index ? `${i}:${pop}` : i} className="ask-q">
                  <span className="ask-tag">{labelOf(question.category)}</span>
                  <p>{question.text}</p>
                </div>
              ) : (
                <div className="ask-intro">
                  <img src={mascot} alt="" width={160} height={160} draggable={false} />
                  <p>اضغط الزر وشوف شو بيطلع لك</p>
                </div>
              )}
            </article>
          );
        })}
        {pieces.length > 0 && (
          <div key={pop} className="ask-burst" aria-hidden="true">
            {pieces.map((p, k) => (
              <i
                key={k}
                style={
                  {
                    "--dx": `${p.dx}px`,
                    "--dy": `${p.dy}px`,
                    "--s": `${p.size}px`,
                    "--c": p.color,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {phase === "spin" ? "" : current?.text}
      </p>

      <button
        type="button"
        className="ask-go"
        disabled={!deck.length || phase === "spin"}
        onClick={spin}
      >
        {phase === "spin" ? "جارٍ الاختيار…" : current ? "سؤال جديد" : "جرّب حظك"}
      </button>
    </div>
  );
}
