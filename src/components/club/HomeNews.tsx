import { useEffect, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { dateParts, eventDisplayStatus } from "@/lib/club/event-timing";
import { contentImageUrls } from "@/lib/club/google-drive";
import { local, type Content } from "@/lib/club/model";
import { itemPage } from "@/lib/club/paths";
import { useClub } from "./club-context";
import { ClubLink } from "./ClubContent";
import { ContentImage } from "./ContentImage";
import { Reveal } from "./Reveal";

/** The news worth leading with: featured first, then newest. */
export function topNews(news: Content[]) {
  const featured = (item: Content) => (item as { featured?: boolean }).featured === true;
  return [...news]
    .sort(
      (a, b) =>
        Number(featured(b)) - Number(featured(a)) || (b.date || "").localeCompare(a.date || ""),
    )
    .slice(0, 5);
}

/** The events worth leading with: every upcoming one soonest first, then the latest run. */
export function topEvents(events: Content[]) {
  const now = new Date();
  const byDate = (a: Content, b: Content) => (a.date || "").localeCompare(b.date || "");
  const upcoming = events.filter((e) => eventDisplayStatus(e, now) !== "past").sort(byDate);
  const past = events
    .filter((e) => eventDisplayStatus(e, now) === "past")
    .sort(byDate)
    .reverse();
  return [...upcoming, ...past].slice(0, Math.max(5, upcoming.length));
}

export function HomeNews() {
  const { lang, data } = useClub();
  const ar = lang === "ar";

  return (
    <HomeStories
      kind="news"
      items={topNews(data.news)}
      title={ar ? "من أخبار النادي" : "Club news"}
      allLabel={ar ? "كل الأخبار" : "All news"}
      period={6}
    />
  );
}

// Two sections may tick at once; the page-change animation stays off until both finish.
let running = 0;

/**
 * A few stories that take turns. Each is a 16:9 photograph (club posts are 16:9; any other
 * ratio is trimmed to fit, so the two columns always line up) with
 * the title over a dark fade at the foot. Below 1024px one card shows at a time; from
 * 1024px a large card sits beside two small ones (`single` keeps one large card at every
 * width, for the top of the news and events pages; `flip` puts the large card on the
 * other side). The cards run as a strip: on a timer the next story slides in from off
 * screen into the large place, the large card moves down to the first small place, and
 * the last small card slides off the far side, animated with a view transition. The timer is the fill in the current dot: it pauses on hover, on
 * focus and off screen, and never runs with reduced motion.
 */
export function HomeStories({
  kind,
  items,
  title,
  allLabel,
  period = 5,
  single = false,
  flip = false,
}: {
  kind: "news" | "events";
  items: Content[];
  title: string;
  /** Without it there is no heading row: the page heading already names the list. */
  allLabel?: string;
  /** Seconds each story leads. */
  period?: number;
  single?: boolean;
  flip?: boolean;
}) {
  const { lang } = useClub();
  const ar = lang === "ar";
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const root = useRef<HTMLElement>(null);
  const [start, setStart] = useState(0);
  const [hold, setHold] = useState(false);
  const [inView, setInView] = useState(false);
  const [seen, setSeen] = useState(false);
  const n = items.length;

  useEffect(() => {
    const node = root.current;

    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      setInView(!!entry?.isIntersecting);
      if (entry?.isIntersecting) setSeen(true);
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  if (!n) return null;

  // Stories arrive from the large card's side: the left in Arabic unless flipped.
  const bigOnLeft = ar ? flip : !flip;
  const side = bigOnLeft ? "hs-from-left" : "hs-from-right";
  const [next, prev] = ar ? ["التالي", "السابق"] : ["Next", "Previous"];
  const go = (to: number, back = false) => {
    const update = () => flushSync(() => setStart(((to % n) + n) % n));
    const html = document.documentElement;

    if (
      !document.startViewTransition ||
      document.hidden ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return update();
    // The slide fades out at the same line as the cards at rest (.hs-stage), so the
    // fade never switches on or off.
    const stage = root.current?.querySelector<HTMLElement>(".hs-stage");
    if (stage) {
      const box = stage.getBoundingClientRect();
      const css = getComputedStyle(stage);
      const line = parseFloat(css.getPropertyValue("--hs-line")) || 0;
      html.style.setProperty("--hs-l", `${box.left + line}px`);
      html.style.setProperty("--hs-r", `${box.right - line}px`);
      html.style.setProperty("--hs-f", css.getPropertyValue("--hs-fade"));
    }
    running += 1;
    html.dataset["vt"] = "stories";
    html.dataset["vtDir"] = back ? "back" : "fwd";
    const transition = document.startViewTransition(update);
    // A skipped transition (hidden tab, a second one starting) rejects `ready`; the swap still happens.
    transition.ready.catch(() => {});
    void transition.finished.finally(() => {
      running -= 1;
      if (!running) delete html.dataset["vt"];
    });
  };
  // The large card leads; the small ones trail behind it with the stories shown before.
  const order = items.map((_, i) => items[(start - i + n) % n]!);

  return (
    <section
      ref={root}
      className={single ? "mx-auto mb-12 max-w-3xl" : "mt-16"}
      aria-labelledby={allLabel ? `home-${kind}` : undefined}
      aria-label={allLabel ? undefined : title}
      data-paused={hold || !inView ? "" : undefined}
      style={{ "--hs-period": `${period}s` } as CSSProperties}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
    >
      {allLabel && (
        <Reveal>
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
            <h2 id={`home-${kind}`} className="club-rule text-2xl font-black">
              {title}
            </h2>
            <ClubLink
              path={kind}
              className="inline-flex items-center gap-2 text-sm font-bold text-primary"
            >
              {allLabel}
              <Arrow size={16} aria-hidden="true" />
            </ClubLink>
          </div>
        </Reveal>
      )}
      <Reveal className="relative">
        <div
          className={`hs-stage grid items-start gap-4 ${single ? "md:[--hs-fade:40px] md:[--hs-line:-40px]" : "min-[85rem]:[--hs-fade:40px] min-[85rem]:[--hs-line:-40px]"} ${n > 1 && !single ? `lg:grid-rows-[auto_1fr] ${flip ? "lg:grid-cols-[calc((100%_-_2.78rem)/3)_1fr]" : "lg:grid-cols-[1fr_calc((100%_-_2.78rem)/3)]"}` : ""}`}
        >
          {/* Keyed by story, so React moves a card instead of rebuilding it. */}
          {order.map((item, i) => (
            <div
              key={item.id}
              className={
                i === 0
                  ? `lg:row-span-2 ${flip ? "lg:col-start-2 lg:row-start-1" : ""}`
                  : i < 3 && !single
                    ? `hidden lg:block ${flip ? "lg:col-start-1" : ""}`
                    : "hidden"
              }
              style={
                {
                  viewTransitionName: `hs-${kind}-${item.id.replace(/[^\w-]/g, "_")}`,
                  viewTransitionClass: `hs-card ${side}`,
                } as CSSProperties
              }
            >
              <Story item={item} kind={kind} lead={i === 0} hero={single} eager={seen} />
            </div>
          ))}
        </div>
        {n > 1 && (
          // Over the card's edges, or outside them where the page leaves room.
          <>
            {/* Each arrow brings the next card in from its own side: the one on the large
                card's side moves forward, the other goes back. */}
            <button
              type="button"
              className={`hs-btn hs-side left-3 ${single ? "hs-out-md md:-left-20" : "hs-out-xl min-[85rem]:-left-20"}`}
              style={{ "--hs-arrow": `hs-${kind}-left` } as CSSProperties}
              onClick={() => (bigOnLeft ? go(start + 1) : go(start - 1, true))}
              aria-label={bigOnLeft ? next : prev}
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`hs-btn hs-side right-3 ${single ? "hs-out-md md:-right-20" : "hs-out-xl min-[85rem]:-right-20"}`}
              style={{ "--hs-arrow": `hs-${kind}-right` } as CSSProperties}
              onClick={() => (bigOnLeft ? go(start - 1, true) : go(start + 1))}
              aria-label={bigOnLeft ? prev : next}
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </>
        )}
      </Reveal>
      {n > 1 && (
        <div className="mt-3 flex items-center justify-center" role="group" aria-label={title}>
          {items.map((item, k) => (
            <button
              key={item.id}
              type="button"
              className="hs-dot"
              data-on={k === start ? "" : undefined}
              aria-current={k === start}
              aria-label={local(item, "title", lang)}
              onClick={() => go(k, k < start)}
            >
              <span>
                {k === start && (
                  // Re-keyed per story so the fill starts over; its end moves the cards on.
                  <span key={start} className="hs-fill" onAnimationEnd={() => go(start + 1)} />
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function Story({
  item,
  lead = false,
  kind = "news",
  eager = false,
  hero = false,
}: {
  item: Content;
  lead?: boolean;
  /** The one large card atop a list page: bigger, easier-to-read type. */
  hero?: boolean;
  kind?: "news" | "events";
  /** Load now even while hidden, so a card is ready before it moves into view. */
  eager?: boolean;
}) {
  const { lang, data } = useClub();
  const ar = lang === "ar";
  const title = local(item, "title", lang);
  const date = dateParts(item.date, lang);
  const upcoming = kind === "events" && eventDisplayStatus(item, new Date()) === "upcoming";

  return (
    <ClubLink
      path={itemPage(kind, item, data)}
      className="group relative block overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <ContentImage
        src={contentImageUrls(item)[0]}
        alt={title}
        lang={lang}
        loading={eager ? "eager" : "lazy"}
        className="block aspect-video w-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out motion-safe:group-hover:scale-[1.03]"
      />
      {upcoming && (
        <span className="absolute top-2 start-2 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground">
          {ar ? "قادمة" : "Upcoming"}
        </span>
      )}
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t ${hero ? "h-2/3" : "h-1/2"} from-black/75 to-transparent`}
      />
      <span
        className={`absolute inset-x-0 bottom-0 block text-white ${hero ? "p-4 sm:p-6" : "p-3"} [text-shadow:0_1px_6px_rgb(0_0_0/0.6)]`}
      >
        {date && (
          <time
            dateTime={item.date}
            className={`block text-white/85 ${hero ? "text-sm" : "text-[11px]"}`}
          >
            {date.day} {date.month} {date.year}
          </time>
        )}
        <span
          className={`mt-1 block font-extrabold leading-snug ${hero ? "text-base md:text-xl" : lead ? "text-sm" : "text-xs"}`}
        >
          {title}
        </span>
      </span>
    </ClubLink>
  );
}
