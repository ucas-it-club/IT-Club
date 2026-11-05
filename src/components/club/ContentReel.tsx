import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useSearch } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { weakDevice } from "@/lib/club/device";
import { dateParts } from "@/lib/club/event-timing";
import { contentImageUrls } from "@/lib/club/google-drive";
import { local, type Content } from "@/lib/club/model";
import { itemPage } from "@/lib/club/paths";
import { useClub } from "./club-context";
import { ClubLink } from "./ClubContent";
import { ContentImage } from "./ContentImage";

/**
 * Home: past events or news, one photo each.
 *
 * From 1024px, a tall track holds a sticky stage and scrolling down slides the
 * strip to the left past it — in both languages, so the strip moves the way the
 * page scrolls. Below that, or with reduced motion, a weak device or GSAP
 * failing to load, the same list is a strip you swipe.
 *
 * Four designs, picked with ?reel=cards | window | rail (the default is full):
 *   full   one photograph at a time across nearly the whole screen, each held
 *          still while you read it, then slid on; caption bar under it.
 *   cards  photographs as cards, a few in view, caption under each.
 *   window one larger photograph at a time.
 *   rail   a larger photograph above a rail of month thumbnails.
 */
export function ContentReel({
  kind,
  items,
  title,
  allLabel,
}: {
  kind: "events" | "news";
  items: Content[];
  title: string;
  allLabel: string;
}) {
  const { lang, data } = useClub();
  const ar = lang === "ar";
  const count = (v: number) => v.toLocaleString(ar ? "ar-EG" : "en-US");
  const root = useRef<HTMLElement>(null);
  const jump = useRef<(index: number) => void>(() => {});
  const [live, setLive] = useState<boolean>();
  const { reel } = useSearch({ strict: false }) as { reel?: unknown };
  const design =
    reel === "cards" || reel === "window" || reel === "rail" ? reel : ("full" as const);
  // In `full` the stage runs left to right in both languages, so the arrow points right.
  const Arrow = ar && !(design === "full" && live) ? ArrowLeft : ArrowRight;

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wide = window.matchMedia("(min-width: 1024px)");
    const pick = () => setLive(!reduced && !weakDevice() && wide.matches);
    pick();
    wide.addEventListener("change", pick);

    return () => wide.removeEventListener("change", pick);
  }, []);

  useEffect(() => {
    const node = root.current;

    if (!node || !live) return;
    const stage = node.querySelector<HTMLElement>(".er-stage")!;
    const strip = node.querySelector<HTMLElement>(".er-strip")!;
    const track = node.querySelector<HTMLElement>(".er-track")!;
    const last = () => node.querySelectorAll(".er-event").length - 1;
    // Looked up each time: the items are drawn again when fresh data arrives.
    const mark = (on: number) => {
      node.querySelectorAll<HTMLElement>(".er-nav button").forEach((el) => {
        const [from, to] = [Number(el.dataset["from"]), Number(el.dataset["to"])];
        el.toggleAttribute("data-on", on >= from && on <= to);
      });
      node
        .querySelectorAll<HTMLElement>(".er-cap")
        .forEach((el, i) => el.toggleAttribute("data-on", i === on));
    };

    // The stretch of page the strip travels over: from the moment the stage sticks
    // (its top reaching the viewport) to the moment the track's end reaches the bottom.
    const measure = () => {
      const top = track.getBoundingClientRect().top + window.scrollY;
      const sticky = parseFloat(getComputedStyle(stage).top) || 0;
      return { start: top - sticky, span: Math.max(1, track.offsetHeight - innerHeight + sticky) };
    };
    let box = measure();
    let frame = 0;

    // The first item sits at the left edge; scrolling carries the strip to the right,
    // so the sequence advances the way the page reads. Distance is measured every
    // frame, so a wider window or a different design can never overshoot its content.
    // In `full`, each photo holds still for the middle of its stretch and slides on
    // only in the short gap between two: [0.3, 0.7] of the way from one to the next.
    const settle = (f: number) => {
      const g = Math.min(1, Math.max(0, (f - 0.3) / 0.4));
      return g * g * (3 - 2 * g);
    };
    const apply = () => {
      frame = 0;
      // Measured every frame: content above or inside the reel changes height as images
      // and fresh data load, and a measure taken once would start the strip too early.
      box = measure();
      let p = Math.min(1, Math.max(0, (window.scrollY - box.start) / box.span));
      const last_ = last();
      const travel = Math.max(0, strip.scrollWidth - stage.clientWidth);

      if (design === "full" && last_ > 0) {
        const u = p * last_;
        const i = Math.min(last_ - 1, Math.floor(u));
        p = (i + settle(u - i)) / last_;
      }
      strip.style.transform = `translate3d(${-travel * p}px, 0, 0)`;
      mark(last_ > 0 ? Math.round(p * last_) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onResize = () => {
      box = measure();
      apply();
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    jump.current = (index) => {
      const n = last();
      const p = n > 0 ? Math.min(1, Math.max(0, index / n)) : 0;
      window.scrollTo({ top: box.start + p * box.span });
    };

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frame);
      jump.current = () => {};
      strip.style.transform = "";
    };
  }, [live, ar, design]);

  // One tab per month, not per item: the tab stays lit while its month's items pass.
  const months: { key: string; label: string; from: number; to: number }[] = [];
  items.forEach((item, index) => {
    const parts = dateParts(item.date, lang);
    const key = parts ? `${parts.month} ${parts.year}` : "";
    const prev = months[months.length - 1];

    if (prev && prev.key === key) prev.to = index;
    else months.push({ key, label: parts?.month ?? "", from: index, to: index });
  });

  return (
    <section
      ref={root}
      className="er"
      data-design={design}
      data-mode={live === false ? "static" : undefined}
      style={{ "--er-n": items.length } as CSSProperties}
      aria-labelledby={`er-${kind}`}
    >
      <div className="er-track">
        <div className="er-stage">
          <header className="er-head">
            <h2 id={`er-${kind}`}>{title}</h2>
            <ClubLink path={kind} className="er-all">
              {allLabel}
              <Arrow size={18} aria-hidden="true" />
            </ClubLink>
          </header>

          <ol className="er-strip">
            {items.map((item, index) => {
              const name = local(item, "title", lang);
              const date = dateParts(item.date, lang);

              return (
                // Tabbing to an item off to the side brings it onto the stage.
                <li
                  key={item.id}
                  className="er-event"
                  style={
                    contentImageUrls(item)[0]
                      ? ({ "--photo": `url(${JSON.stringify(contentImageUrls(item)[0])})` } as CSSProperties)
                      : undefined
                  }
                  onFocus={() => jump.current(index)}
                >
                  <div className="er-photo">
                    <ContentImage src={contentImageUrls(item)[0]} alt={name} lang={lang} />
                  </div>
                  <div className="er-text">
                    {date && (
                      <time dateTime={item.date} className="er-date">
                        {count(index + 1)} / {count(items.length)} · {date.day} {date.month}{" "}
                        {date.year}
                      </time>
                    )}
                    <ClubLink path={itemPage(kind, item, data)} className="er-title">
                      {name}
                    </ClubLink>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* In `full` the captions stay put and change as the photographs pass, so no title
              ever slides off the edge or under the tabs. The list above is the real, readable
              one; this copy is for the eye only. */}
          <div className="er-caps" aria-hidden="true">
            {items.map((item, index) => {
              const name = local(item, "title", lang);
              const date = dateParts(item.date, lang);
              const src = contentImageUrls(item)[0];

              return (
                <div
                  key={item.id}
                  className="er-cap"
                  data-on={index === 0 ? "" : undefined}
                  style={src ? ({ "--photo": `url(${JSON.stringify(src)})` } as CSSProperties) : undefined}
                >
                  {date && (
                    <time dateTime={item.date} className="er-date">
                      {count(index + 1)} / {count(items.length)} · {date.day} {date.month}{" "}
                      {date.year}
                    </time>
                  )}
                  <ClubLink path={itemPage(kind, item, data)} className="er-title" tabIndex={-1}>
                    {name}
                  </ClubLink>
                </div>
              );
            })}
          </div>

          <div className="er-nav" role="group" aria-label={title}>
            {months.map((group) => {
              const item = items[group.from]!;

              return (
                <button
                  key={group.from}
                  type="button"
                  aria-label={group.label}
                  data-from={group.from}
                  data-to={group.to}
                  onClick={() => jump.current(group.from)}
                >
                  <img
                    className="er-nav-thumb"
                    src={contentImageUrls(item)[0]}
                    alt=""
                    loading="lazy"
                  />
                  <span className="er-nav-month">{group.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
