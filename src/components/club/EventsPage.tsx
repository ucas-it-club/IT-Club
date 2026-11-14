import { contentImageUrls } from "@/lib/club/google-drive";
import { local } from "@/lib/club/model";
import { dateParts, eventDisplayStatus } from "@/lib/club/event-timing";
import { itemPage } from "@/lib/club/paths";
import { useClub } from "./club-context";
import { ClubLink } from "./ClubContent";
import { ContentImage } from "./ContentImage";
import { HomeStories, topEvents } from "./HomeNews";

function useEvents() {
  const { lang, data } = useClub();
  const ar = lang === "ar";
  const both = (a?: string, e?: string) => (ar ? a : e) || a || "";
  const now = new Date();
  const events = [...data.events]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .map((item) => ({
      item,
      title: local(item, "title", lang),
      type: both(item.eventType, item.eventType_en),
      by: both(item.presenterName, item.presenterName_en),
      date: dateParts(item.date, lang),
      src: contentImageUrls(item)[0],
      past: eventDisplayStatus(item, now) === "past",
      path: itemPage("events", item, data),
    }));
  // Upcoming and running events lead in the large card above; the record is the past.
  const past = events.filter((e) => e.past);
  return { ar, lang, past };
}

function Head({ ar }: { ar: boolean }) {
  return (
    <header className="ev-head">
      <h1 id="ev-heading">{ar ? "الفعاليات" : "Events"}</h1>
    </header>
  );
}

/** The top events taking turns in one large card, the past as a written record by year. */
export function EventsPage() {
  const { ar, lang, past } = useEvents();
  const top = topEvents(useClub().data.events);
  // Year, then month: the month stays with you while you scroll, the year is a plain
  // divider above its months.
  const years: { year: string; months: { month: string; events: typeof past }[] }[] = [];
  for (const e of past) {
    const year = e.date?.year ?? "—";
    const month = e.date?.month ?? "—";
    let y = years.find((group) => group.year === year);

    if (!y) years.push((y = { year, months: [] }));
    const last = y.months[y.months.length - 1];

    if (last?.month === month) last.events.push(e);
    else y.months.push({ month, events: [e] });
  }

  return (
    <section className="ev-chronicle" aria-labelledby="ev-heading">
      <Head ar={ar} />
      {/* Every upcoming event, then the latest run, one large card at a time. */}
      <HomeStories
        kind="events"
        items={top}
        title={ar ? "أبرز الفعاليات" : "Top events"}
        single
        flip
      />
      {years.map(({ year, months }) => (
        <div key={year} className="nw-year" role="group" aria-label={year}>
          <p className="nw-year-num" aria-hidden="true">
            {year}
          </p>
          {months.map(({ month, events }) => (
            <section key={month} className="ev-year nw-month" aria-label={`${month} ${year}`}>
              <h2 className="ev-year-num">{month}</h2>
              <ol className="ev-record">
                {events.map((e) => (
                  <li key={e.item.id}>
                    <ClubLink path={e.path} className="ev-entry">
                      <span className="ev-entry-photo">
                        <ContentImage src={e.src} alt={e.title} lang={lang} />
                      </span>
                      <span className="ev-entry-body">
                        {e.date && (
                          <time dateTime={e.item.date} className="ev-entry-date">
                            {e.date.day} {e.date.month}
                          </time>
                        )}
                        <span className="ev-entry-title">{e.title}</span>
                        {(e.type || e.by) && (
                          <span className="ev-entry-meta">
                            {[e.type, e.by].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </span>
                    </ClubLink>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      ))}
    </section>
  );
}
