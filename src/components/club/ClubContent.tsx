import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CalendarDays, ExternalLink } from "lucide-react";
import InformationDrawer from "@/components/ui/information-drawer";
import logo from "@/assets/ucas-logo.webp";
import { hrefOf, itemPage } from "@/lib/club/paths";
import { local, safeUrl, type Content, type ContentCollection } from "@/lib/club/model";
import { eventDisplayStatus } from "@/lib/club/event-timing";
import { contentImageUrls } from "@/lib/club/google-drive";
import { plainRichText } from "@/lib/club/rich-text";
import { useClub } from "./club-context";
import { ContentImage } from "./ContentImage";
import { Reveal } from "./Reveal";

export const linkClass =
  "club-action inline-flex items-center justify-center gap-2 rounded-full border-2 border-primary/30 bg-card px-6 py-3 text-base font-bold text-primary transition-colors hover:bg-primary/5";

/** A link to a page path ("", "about", "news/<slug>") in the current language. */
export function ClubLink({
  path = "",
  children,
  className = linkClass,
  navigation = false,
  title,
  tabIndex,
}: {
  path?: string;
  children: ReactNode;
  className?: string;
  navigation?: boolean;
  title?: string;
  tabIndex?: number;
}) {
  const { lang } = useClub();

  return (
    <Link
      to={hrefOf(lang, path)}
      title={title}
      tabIndex={tabIndex}
      className={className}
      activeOptions={{ exact: !path, includeSearch: false, includeHash: false }}
      data-club-navigation={navigation || undefined}
    >
      {children}
    </Link>
  );
}

export function Heading({ ar, en, children }: { ar: string; en: string; children?: ReactNode }) {
  const { lang } = useClub();

  return (
    <div className="mb-10 text-center">
      <p className="text-sm font-bold text-primary">UCAS IT CLUB</p>
      <h1 className="mt-3 text-3xl font-black sm:text-5xl text-gradient-brand">
        {lang === "ar" ? ar : en}
      </h1>
      {children && (
        <div className="mx-auto mt-5 max-w-2xl text-base leading-loose text-muted-foreground">
          {children}
        </div>
      )}
    </div>
  );
}

export function Empty() {
  const { lang } = useClub();

  return (
    <p className="rounded-3xl border border-border bg-card p-10 text-center text-muted-foreground">
      {lang === "ar"
        ? "لم يُنشر محتوى في هذا القسم بعد."
        : "No content has been published here yet."}
    </p>
  );
}

export function ContentCard({
  item,
  kind,
  compact = false,
  preview = false,
  imagePreview,
}: {
  item: Content;
  kind: Exclude<ContentCollection, "members">;
  compact?: boolean;
  preview?: boolean;
  imagePreview?: string;
}) {
  const { lang, data } = useClub();
  const title = local(item, "title", lang);
  const image = imagePreview || contentImageUrls(item)[0];
  const partner = kind === "partners";
  const status = kind === "events" ? eventDisplayStatus(item) : undefined;

  return (
    <article className="club-card flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      <div className="relative aspect-video w-full overflow-hidden">
        {!partner ? (
          <ContentImage
            src={image}
            alt={title}
            lang={lang}
            className="club-card-media h-full w-full object-cover"
          />
        ) : image ? (
          <img
            src={image}
            alt={title}
            loading="lazy"
            width={640}
            height={360}
            className="club-card-media club-partner-media h-full w-full object-contain p-6"
          />
        ) : (
          <div className="club-card-media flex h-full w-full items-center justify-center bg-brand-gradient">
            <img
              src={logo}
              alt=""
              aria-hidden="true"
              className="h-16 w-14 object-contain opacity-90 brightness-0 invert"
            />
          </div>
        )}
        {status && (
          <span className="absolute end-3 top-3 rounded-full bg-background/85 px-3 py-1 text-xs font-bold text-primary shadow-card backdrop-blur-sm">
            {status === "upcoming"
              ? lang === "ar"
                ? "قادمة"
                : "Upcoming"
              : lang === "ar"
                ? "سابقة"
                : "Past"}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-6">
        {item.date && (
          <time
            dateTime={item.date}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
          >
            <CalendarDays size={14} aria-hidden="true" />
            {item.date}
          </time>
        )}
        <h2 className="mt-2 text-xl font-extrabold">{title}</h2>
        <p
          className={`mt-3 text-base leading-relaxed text-muted-foreground ${compact ? "line-clamp-2" : "line-clamp-3"}`}
        >
          {plainRichText(local(item, "description", lang))}
        </p>
        {partner ? (
          <div className="mt-auto pt-5">
            {item.partnershipType && (
              <p className="mb-3 inline-flex rounded-full bg-brand-gradient-soft px-3 py-1 text-sm font-bold text-primary">
                {local(item, "partnershipType", lang)}
              </p>
            )}
            {safeUrl(item.websiteUrl) && (
              <a
                href={safeUrl(item.websiteUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 font-bold text-primary"
              >
                {lang === "ar" ? "موقع الشريك" : "Visit partner"}
                <ExternalLink size={16} />
              </a>
            )}
          </div>
        ) : preview ? (
          <span className="club-card-cta mt-auto inline-flex items-center gap-2 pt-5 font-bold text-primary">
            {lang === "ar" ? "التفاصيل" : "View details"}
            {lang === "ar" ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
          </span>
        ) : (
          <ClubLink
            path={itemPage(kind, item, data)}
            className="club-card-cta mt-auto inline-flex items-center gap-2 pt-5 font-bold text-primary"
          >
            {lang === "ar" ? "التفاصيل" : "View details"}
            {lang === "ar" ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
          </ClubLink>
        )}
      </div>
    </article>
  );
}

export function ContentGrid({
  items,
  kind,
  compact = false,
}: {
  items: Content[];
  kind: ContentCollection;
  compact?: boolean;
}) {
  const { lang } = useClub();

  if (kind === "members")
    return items.length ? <InformationDrawer teams={items} lang={lang} /> : <Empty />;

  return items.length ? (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => (
        <Reveal key={item.id} delay={(index % 3) * 110}>
          <ContentCard item={item} kind={kind} compact={compact} />
        </Reveal>
      ))}
    </div>
  ) : (
    <Empty />
  );
}
