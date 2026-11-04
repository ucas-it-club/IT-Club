import { CalendarDays, UserRound } from "lucide-react";
import { local, type Content, type Lang } from "@/lib/club/model";
import { contentImageUrls } from "@/lib/club/google-drive";
import { siteName } from "@/lib/club/seo";
import { ClubLink } from "./ClubContent";
import { ContentImage } from "./ContentImage";
import { RichText } from "./RichText";

function formattedNewsDate(date: string, lang: Lang) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat(lang === "ar" ? "ar-PS" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

export function NewsDetail({
  news,
  lang,
  previewImage,
}: {
  news: Content;
  lang: Lang;
  previewImage?: string;
}) {
  const ar = lang === "ar";
  const title = local(news, "title", lang);
  const validImages = [...(previewImage ? [previewImage] : []), ...contentImageUrls(news)];
  const cover = validImages[0];

  return (
    <article className="overflow-hidden rounded-[2rem] border border-border bg-card p-5 shadow-card sm:p-8 lg:p-10">
      <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-10">
        <figure className="overflow-hidden rounded-3xl border border-border bg-muted lg:col-start-2 lg:row-start-1">
          {cover ? (
            <img
              src={cover}
              alt={title}
              width={1200}
              height={675}
              className="aspect-video w-full object-cover"
            />
          ) : (
            <>
              <ContentImage alt={title} lang={lang} className="aspect-video w-full object-cover" />
              <figcaption className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                {ar
                  ? "صورة تعريفية للنادي — تُضاف صورة الخبر عند توفرها."
                  : "Club illustration — the news image will be added when available."}
              </figcaption>
            </>
          )}
        </figure>

        <header className="lg:col-start-1 lg:row-start-1">
          <h1 className="text-xl font-black text-gradient-brand sm:text-3xl">{title}</h1>

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm font-bold text-muted-foreground">
            {news.date && (
              <time dateTime={news.date} className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                {formattedNewsDate(news.date, lang)}
              </time>
            )}
            <p className="flex items-center gap-2">
              <UserRound className="size-4 text-primary" aria-hidden="true" />
              <span>{ar ? "بواسطة" : "By"}</span>
              <ClubLink path="about" className="text-primary underline underline-offset-4">
                {siteName[lang]}
              </ClubLink>
            </p>
          </div>
        </header>
      </div>

      <RichText
        value={local(news, "description", lang)}
        className="mt-8 border-t border-border pt-7 text-base leading-loose text-[#172b4d] lg:columns-2 lg:gap-12 lg:[column-fill:balance] [&_h2]:break-after-avoid-column [&_h2]:break-inside-avoid-column [&_h3]:break-after-avoid-column [&_h3]:break-inside-avoid-column"
      />

      {validImages.length > 1 && (
        <section
          className="mt-10 border-t border-border pt-8"
          aria-label={ar ? "صور الخبر" : "News photos"}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {validImages.slice(1).map((url, index) => (
              <img
                key={url}
                src={url}
                alt={`${title} — ${index + 2}`}
                width={800}
                height={450}
                loading="lazy"
                className="aspect-video w-full rounded-2xl object-cover"
              />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
