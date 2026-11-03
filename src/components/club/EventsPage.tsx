import { ArrowLeft, ArrowRight } from "lucide-react";
import { local } from "@/lib/club/model";
import { eventDisplayStatus, formatEventTime } from "@/lib/club/event-timing";
import { itemPage } from "@/lib/club/paths";
import { useClub } from "./club-context";
import { ClubLink } from "./ClubContent";
import "./events-page.css";

type Lang = "ar" | "en";

function dateParts(date: string | undefined, lang: Lang) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const month = new Intl.DateTimeFormat(lang === "ar" ? "ar-PS" : "en-US", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
  return { day: String(d), month, year: String(y) };
}

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
      time: formatEventTime(item.eventTime, lang),
      date: dateParts(item.date, lang),
      upcoming: eventDisplayStatus(item, now) === "upcoming",
      path: itemPage("events", item, data),
    }));
  // Upcoming events read soonest first; past ones newest first.
  const upcoming = events.filter((e) => e.upcoming).reverse();
  const past = events.filter((e) => !e.upcoming);
  return { ar, upcoming, past };
}

function Head({ ar }: { ar: boolean }) {
  return (
    <header className="ev-head">
      <h1 id="ev-heading">{ar ? "الفعاليات" : "Events"}</h1>
      <p>{ar ? "كل فعاليات النادي، القادمة والسابقة." : "Every club event, coming up and past."}</p>
    </header>
  );
}

/** The next events as full-width bands, the rest as a written record by year. */
export function EventsPage() {
  const { ar, upcoming, past } = useEvents();
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const years = [...new Set(past.map((e) => e.date?.year ?? "—"))];

  return (
    <section className="ev-chronicle" aria-labelledby="ev-heading">
      <Head ar={ar} />
      {upcoming.length ? (
        <ol className="ev-next">
          {upcoming.map((e) => (
            <li key={e.item.id}>
              <ClubLink path={e.path} className="ev-next-link">
                <span className="ev-next-inner">
                  <span className="ev-next-title">{e.title}</span>
                  <span className="ev-next-facts">
                    {[e.date && `${e.date.day} ${e.date.month}`, e.time, e.by]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="ev-more">
                    {ar ? "التفاصيل والتسجيل" : "Details and registration"}
                    <Arrow size={18} aria-hidden="true" />
                  </span>
                </span>
              </ClubLink>
            </li>
          ))}
        </ol>
      ) : (
        // The normal state: nothing scheduled. The band stays, saying so.
        <div className="ev-next">
          <ClubLink path="contact" className="ev-next-link">
            <span className="ev-next-inner">
              <span className="ev-next-title">
                {ar ? "لا فعاليات قادمة الآن" : "Nothing scheduled right now"}
              </span>
              <span className="ev-more">
                {ar ? "تابعنا لتعرف أولًا" : "Follow us to hear first"}
                <Arrow size={18} aria-hidden="true" />
              </span>
            </span>
          </ClubLink>
        </div>
      )}
      {years.map((year) => (
        <section key={year} className="ev-year" aria-label={year}>
          <h2 className="ev-year-num">{year}</h2>
          <ol className="ev-record">
            {past
              .filter((e) => (e.date?.year ?? "—") === year)
              .map((e) => (
                <li key={e.item.id}>
                  <ClubLink path={e.path} className="ev-entry">
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
                  </ClubLink>
                </li>
              ))}
          </ol>
        </section>
      ))}
    </section>
  );
}
