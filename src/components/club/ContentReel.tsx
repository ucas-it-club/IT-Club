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
  const count = (v: number) => v.toLocaleString("en-US");
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
      const caps = node.querySelectorAll<HTMLElement>(".er-cap");
      caps.forEach((el, i) => el.toggleAttribute("data-on", i === on));
      const onScreen = node.querySelector(".er-on-date");
      const date = caps[on]?.dataset["date"];

      if (onScreen && date && onScreen.textContent !== date) onScreen.textContent = date;
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

  // One tab per month of the year (Jan to Dec), lit while its month's items pass; a
  // month with nothing in it stays on the row, dimmed. Items run oldest first. More than
  // one year runs from the first month to the last instead.
  const stamp = items.map((item) =>
    /^\d{4}-\d{2}/.test(item.date ?? "") ? item.date!.slice(0, 7) : "",
  );
  const known = stamp.filter(Boolean).sort();
  const [y0, m0] = (known[0] ?? "").split("-").map(Number);
  const [y1, m1] = (known[known.length - 1] ?? "").split("-").map(Number);
  const oneYear = y0 === y1;
  const tabs: { key: string; label: string; from: number; to: number }[] = [];

  if (y0 && y1 && m0 && m1)
    for (let y = y0, m = oneYear ? 1 : m0; y < y1 || (y === y1 && m <= (oneYear ? 12 : m1));) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      const hits = stamp.flatMap((k, i) => (k === key ? [i] : []));
      const label =
        lang === "ar"
          ? (dateParts(`${key}-01`, lang)?.month ?? key)
          : new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(
              new Date(Date.UTC(y, m - 1, 1)),
            );

      tabs.push({
        key,
        label,
        from: hits.length ? hits[0]! : -1,
        to: hits.length ? hits[hits.length - 1]! : -1,
      });
      if (m === 12) [y, m] = [y + 1, 1];
      else m += 1;
    }

  const frames = items.reduce((sum, item) => sum + contentImageUrls(item).length, 0);
  const fullDate = (item: Content) => {
    const d = dateParts(item.date, lang);

    return d ? `${d.day} ${d.month} ${d.year}` : "";
  };
  const unit = (n: number) =>
    kind === "news"
      ? ar
        ? "خبر"
        : n === 1
          ? "story"
          : "stories"
      : ar
        ? "فعالية"
        : n === 1
          ? "event"
          : "events";
  const meta = [
    `${count(frames)} ${ar ? "صورة" : "photos"}`,
    `${count(items.length)} ${unit(items.length)}`,
    oneYear ? String(y0 ?? "") : y0 && y1 ? `${y0}–${y1}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

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
            <p className="er-meta">{meta}</p>
            <ClubLink path={kind} className="er-all">
              {allLabel}
              <Arrow size={18} aria-hidden="true" />
            </ClubLink>
          </header>

          <div
            className="er-nav"
            role="group"
            aria-label={title}
            style={{ "--er-months": tabs.length } as CSSProperties}
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                disabled={tab.from < 0}
                data-from={tab.from}
                data-to={tab.to}
                onClick={() => jump.current(tab.from)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <p className="er-status" aria-hidden="true">
            <span>
              {ar ? "على الشاشة" : "On screen"}{" "}
              <b className="er-on-date">{items[0] ? fullDate(items[0]) : ""}</b>
            </span>
            <span>{ar ? "اختر شهرًا للانتقال إليه" : "Choose a month to jump to it"}</span>
          </p>

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
                      ? ({
                          "--photo": `url(${JSON.stringify(contentImageUrls(item)[0])})`,
                        } as CSSProperties)
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

          {/* In `full` the details stay put and change as the photographs pass, so no title
              ever slides off the edge. The list above is the real, readable one; this copy is
              for the eye only. */}
          <div className="er-caps" aria-hidden="true">
            {items.map((item, index) => {
              const name = local(item, "title", lang);
              const n = contentImageUrls(item).length;

              return (
                <div
                  key={item.id}
                  className="er-cap"
                  data-on={index === 0 ? "" : undefined}
                  data-date={fullDate(item)}
                >
                  <div className="er-cap-main">
                    <ClubLink path={itemPage(kind, item, data)} className="er-title" tabIndex={-1}>
                      {name}
                    </ClubLink>
                    <p className="er-cap-meta">
                      {[
                        fullDate(item),
                        n ? `${count(n)} ${ar ? "صورة" : n === 1 ? "photo" : "photos"}` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <ClubLink path={itemPage(kind, item, data)} className="er-more" tabIndex={-1}>
                    {n > 1
                      ? ar
                        ? `كل الصور (${count(n)})`
                        : `All ${count(n)} photos`
                      : ar
                        ? "افتح"
                        : "Open"}
                    <Arrow size={18} aria-hidden="true" />
                  </ClubLink>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
