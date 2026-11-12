import { ArrowLeft, ArrowRight } from "lucide-react";
import { dateParts } from "@/lib/club/event-timing";
import { contentImageUrls } from "@/lib/club/google-drive";
import { local, type Content } from "@/lib/club/model";
import { itemPage } from "@/lib/club/paths";
import { useClub } from "./club-context";
import { ClubLink } from "./ClubContent";
import { ContentImage } from "./ContentImage";
import { Reveal } from "./Reveal";

/**
 * Home news: a lead story and two more, newest first. Each is the whole photograph
 * (never cropped, at its own ratio) with the title over a dark fade at the foot.
 * Featured stories, once an admin can mark them, sort before the rest.
 */
export function HomeNews() {
  const { lang, data } = useClub();
  const ar = lang === "ar";
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const featured = (item: Content) => (item as { featured?: boolean }).featured === true;
  const [lead, ...rest] = [...data.news]
    .sort(
      (a, b) =>
        Number(featured(b)) - Number(featured(a)) || (b.date || "").localeCompare(a.date || ""),
    )
    .slice(0, 3);

  if (!lead) return null;

  return (
    <section className="mt-16" aria-labelledby="home-news">
      <Reveal>
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
          <h2 id="home-news" className="club-rule text-2xl font-black">
            {ar ? "من أخبار النادي" : "Club news"}
          </h2>
          <ClubLink
            path="news"
            className="inline-flex items-center gap-2 text-sm font-bold text-primary"
          >
            {ar ? "كل الأخبار" : "All news"}
            <Arrow size={16} aria-hidden="true" />
          </ClubLink>
        </div>
      </Reveal>
      <div className={`grid items-start gap-4 ${rest.length ? "lg:grid-cols-[1fr_calc((100%_-_2.78rem)/3)]" : ""}`}>
        <Reveal>
          <Story item={lead} lead />
        </Reveal>
        {rest.length > 0 && (
          <div className="flex flex-col gap-4">
            {rest.map((item, index) => (
              <Reveal key={item.id} index={index + 1}>
                <Story item={item} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Story({ item, lead = false }: { item: Content; lead?: boolean }) {
  const { lang, data } = useClub();
  const title = local(item, "title", lang);
  const date = dateParts(item.date, lang);

  return (
    <ClubLink
      path={itemPage("news", item, data)}
      className="group relative block overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <ContentImage
        src={contentImageUrls(item)[0]}
        alt={title}
        lang={lang}
        className="block h-auto w-full motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out motion-safe:group-hover:scale-[1.03]"
      />
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent"
      />
      <span className="absolute inset-x-0 bottom-0 block p-3 text-white [text-shadow:0_1px_6px_rgb(0_0_0/0.6)]">
        {date && (
          <time dateTime={item.date} className="block text-[11px] text-white/85">
            {date.day} {date.month} {date.year}
          </time>
        )}
        <span className={`mt-1 block font-extrabold leading-snug ${lead ? "text-sm" : "text-xs"}`}>
          {title}
        </span>
      </span>
    </ClubLink>
  );
}
