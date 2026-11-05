import { useEffect, useRef, useState, type CSSProperties } from "react";
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
 * events sideways past it, each photo the full screen width. Below that, or with
 * reduced motion, a weak device or GSAP failing to load, the same list is a
 * strip you swipe, one full-width photo at a time. The CSS picks the
 * layout from the first paint; `data-mode="static"` is the JavaScript's way out.
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
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const count = (v: number) => v.toLocaleString(ar ? "ar-EG" : "en-US");
  const root = useRef<HTMLElement>(null);
  const jump = useRef<(index: number) => void>(() => {});
  const [live, setLive] = useState<boolean>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wide = window.matchMedia("(min-width: 1024px)");
    const pick = () => setLive(!failed && !reduced && !weakDevice() && wide.matches);
    pick();
    wide.addEventListener("change", pick);

    return () => wide.removeEventListener("change", pick);
  }, [failed]);

  useEffect(() => {
    const node = root.current;

    if (!node || !live) return;
    let cancelled = false;
    let dispose = () => {};

    void (async () => {
      const loaded = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).catch(
        () => null,
      );

      if (cancelled) return;
      if (!loaded) {
        setFailed(true);
        return;
      }
      const [{ gsap }, { ScrollTrigger }] = loaded;
      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        const stage = node.querySelector<HTMLElement>(".er-stage")!;
        const strip = node.querySelector<HTMLElement>(".er-strip")!;
        const tabs = gsap.utils.toArray<HTMLElement>(".er-nav button", node);
        const last = tabs.length - 1;
        // The strip overflows towards the reading direction's end, so RTL moves it right.
        const sign = ar ? 1 : -1;
        // Each photo holds still for part of the scroll, whole and full width, then slides on.
        const hold = 0.6;
        const mark = (on: number) =>
          tabs.forEach((el, i) => el.toggleAttribute("data-on", i === on));

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          onUpdate: () => mark(Math.round((tl.time() - hold / 2) / (1 + hold))),
          scrollTrigger: {
            trigger: ".er-track",
            start: () => `top ${parseFloat(getComputedStyle(stage).top)}px`,
            end: "bottom bottom",
            scrub: 0.45,
            invalidateOnRefresh: true,
          },
        });

        for (let i = 1; i <= last; i++)
          tl.to(
            strip,
            { x: () => sign * stage.clientWidth * i, duration: 1, ease: "power2.inOut" },
            hold + (i - 1) * (1 + hold),
          );
        tl.to({}, { duration: hold });
        mark(0);

        // Through the real scroll position, so the page and the stage never disagree.
        jump.current = (index) => {
          const st = tl.scrollTrigger!;
          const time = hold / 2 + index * (1 + hold);
          window.scrollTo({ top: st.start + (time / tl.duration()) * (st.end - st.start) });
        };
      }, node);

      dispose = () => {
        jump.current = () => {};
        ctx.revert();
      };
    })();

    return () => {
      cancelled = true;
      dispose();
    };
  }, [live, ar]);

  return (
    <section
      ref={root}
      className="er"
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
                // Tabbing to an event off to the side brings it onto the stage.
                <li key={item.id} className="er-event" onFocus={() => jump.current(index)}>
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

          <div className="er-nav" role="group" aria-label={title}>
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-label={local(item, "title", lang)}
                onClick={() => jump.current(index)}
              >
                {dateParts(item.date, lang)?.month}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
