import { ArrowLeft, ArrowRight } from "lucide-react";
import { dateParts } from "@/lib/club/event-timing";
import { contentImageUrls } from "@/lib/club/google-drive";
import { local } from "@/lib/club/model";
import { itemPage } from "@/lib/club/paths";
import { useClub } from "./club-context";
import { ClubLink } from "./ClubContent";
import { ContentImage } from "./ContentImage";
import "./events-page.css";

/**
 * News reads like the events page: the newest story as a full-width band, the
 * rest as a written record grouped by year, every entry with its own photo.
 */
export function NewsPage() {
  const { lang, data } = useClub();
  const ar = lang === "ar";
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const news = [...data.news]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .map((item) => ({
      item,
      title: local(item, "title", lang),
      meta: item.category ?? "",
      date: dateParts(item.date, lang),
      src: contentImageUrls(item)[0],
      path: itemPage("news", item, data),
    }));
  const [lead, ...rest] = news;
  // Year, then month: the month is what stays with you while you scroll, the year is a
  // plain divider above its months.
  const years: { year: string; months: { month: string; stories: typeof rest }[] }[] = [];
  for (const story of rest) {
    const year = story.date?.year ?? "—";
    const month = story.date?.month ?? "—";
    let y = years.find((group) => group.year === year);

    if (!y) years.push((y = { year, months: [] }));
    const last = y.months[y.months.length - 1];

    if (last?.month === month) last.stories.push(story);
    else y.months.push({ month, stories: [story] });
  }

  return (
    <section className="ev-chronicle" aria-labelledby="nw-heading">
      <header className="ev-head">
        <h1 id="nw-heading">{ar ? "الأخبار" : "News"}</h1>
        <p>
          {ar
            ? "ما ينشره النادي من أخبار وإعلانات، الأحدث أولًا."
            : "What the club has to report, newest first."}
        </p>
      </header>

      {lead && (
        <div className="ev-next">
          <ClubLink path={lead.path} className="ev-next-link">
            <span className="ev-next-inner">
              <span className="ev-next-text">
                <span className="ev-next-title">{lead.title}</span>
                <span className="ev-next-facts">
                  {[lead.date && `${lead.date.day} ${lead.date.month} ${lead.date.year}`, lead.meta]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="ev-more">
                  {ar ? "اقرأ الخبر" : "Read the story"}
                  <Arrow size={18} aria-hidden="true" />
                </span>
              </span>
              <span className="ev-next-photo">
                <ContentImage src={lead.src} alt={lead.title} lang={lang} />
              </span>
            </span>
          </ClubLink>
        </div>
      )}

      {years.map(({ year, months }) => (
        <div key={year} className="nw-year" role="group" aria-label={year}>
          <p className="nw-year-num" aria-hidden="true">
            {year}
          </p>
          {months.map(({ month, stories }) => (
            <section key={month} className="ev-year nw-month" aria-label={`${month} ${year}`}>
              <h2 className="ev-year-num">{month}</h2>
              <ol className="ev-record">
                {stories.map((story) => (
                  <li key={story.item.id}>
                    <ClubLink path={story.path} className="ev-entry">
                      <span className="ev-entry-photo">
                        <ContentImage src={story.src} alt={story.title} lang={lang} />
                      </span>
                      <span className="ev-entry-body">
                        {story.date && (
                          <time dateTime={story.item.date} className="ev-entry-date">
                            {story.date.day} {story.date.month}
                          </time>
                        )}
                        <span className="ev-entry-title">{story.title}</span>
                        {story.meta && <span className="ev-entry-meta">{story.meta}</span>}
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
