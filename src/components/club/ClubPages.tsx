import {
  CalendarDays,
  Eye,
  ExternalLink,
  Gamepad2,
  Globe,
  Palette,
  Smartphone,
  Target,
  Users,
  Github,
  Linkedin,
} from "lucide-react";
import { HeroSection } from "@/components/ui/hero-section-4";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import logo from "@/assets/ucas-logo.webp";
import {
  categories,
  collegeUrl,
  committees,
  findItem,
  labels,
  local,
  memberGender,
  safeUrl,
  type Content,
  type ContentCollection,
} from "@/lib/club/model";
import { plainRichText, splitRichText } from "@/lib/club/rich-text";
import { eventDisplayStatus } from "@/lib/club/event-timing";
import { contentImageUrls } from "@/lib/club/google-drive";
import { siteName } from "@/lib/club/seo";
import { BracketHero } from "./BracketHero";
import { ClubLink, ContentGrid, Empty, Heading, linkClass } from "./ClubContent";
import { EventsPage } from "./EventsPage";
import { NewsPage } from "./NewsPage";
import { ContentImage } from "./ContentImage";
import { CountUp } from "./CountUp";
import { EventDetail } from "./EventDetail";
import { NewsDetail } from "./NewsDetail";
import { HomeNews, HomeStories, topEvents } from "./HomeNews";
import { Reveal } from "./Reveal";
import { RichText } from "./RichText";
import { useClub } from "./club-context";

export function HomePage() {
  const { lang, data, visitorCount } = useClub();
  const ar = lang === "ar";

  return (
    <>
      <BracketHero />

      <HomeStories
        kind="events"
        items={topEvents(data.events)}
        title={ar ? "فعاليات النادي" : "Club events"}
        allLabel={ar ? "كل الفعاليات" : "All events"}
        flip
      />

      <HomeNews />
    </>
  );
}

export function AboutPage() {
  const { lang, settings, data } = useClub();
  const ar = lang === "ar";
  const goals = splitRichText(settings[ar ? "goals" : "goals_en"] || "");

  return (
    <>
      <Heading ar="من نحن" en="About the club">
        {ar ? "نادٍ طلابي في " : "A student-run club at the "}
        <a
          href={collegeUrl[lang]}
          target="_blank"
          rel="noopener"
          className="club-sheen-text font-bold text-primary"
        >
          {ar ? "الكلية الجامعية للعلوم التطبيقية" : "University College of Applied Sciences"}
        </a>
        {ar
          ? "، يديره طلبته ويجمع المهتمين بالبرمجة والتصميم والألعاب والوسائط."
          : " for everyone working in code, design, games and media."}
      </Heading>

      <div className="grid gap-6 sm:grid-cols-2">
        {(["vision", "mission"] as const).map((key, index) => {
          const enKey = `${key}_en` as "vision_en" | "mission_en";
          const Icon = key === "vision" ? Eye : Target;
          const configured = settings[ar ? key : enKey] || "";
          const statement = plainRichText(configured).trim()
            ? configured
            : ar
              ? "سيُنشر النص الرسمي المعتمد قريبًا."
              : "The approved official statement will be published here.";
          return (
            <Reveal key={key} index={index}>
              <article className="club-card h-full rounded-3xl border border-border bg-card p-8 shadow-card">
                <span className="inline-flex rounded-2xl bg-brand-gradient-soft p-3 text-primary">
                  <Icon className="h-6 w-6" />
                </span>
                <h2 className="club-rule mt-5 text-2xl font-black text-primary">
                  {key === "vision"
                    ? ar
                      ? "رؤيتنا"
                      : "Our vision"
                    : ar
                      ? "رسالتنا"
                      : "Our mission"}
                </h2>
                <RichText
                  value={statement}
                  className="mt-5 text-base leading-loose text-muted-foreground"
                />
              </article>
            </Reveal>
          );
        })}
      </div>

      <Reveal as="h2" className="club-rule mt-14 mb-3 text-2xl font-black">
        {ar ? "كيف يعمل النادي" : "How the club works"}
      </Reveal>
      <p className="mb-6 max-w-2xl leading-loose text-muted-foreground">
        {ar
          ? "العمل موزّع على ثلاث لجان، وكل عضو ينتمي إلى واحدة منها."
          : "The work is split across three committees, and every member belongs to one."}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {committees.map(([key, arabic, english], index) => {
          const count = data.members.filter((member) => member.committee === key).length;
          const contents = (
            <>
              <span aria-hidden="true" className="h-1.5 w-12 rounded-full bg-brand-gradient" />
              <h3 className="mt-5 text-xl font-extrabold">{ar ? arabic : english}</h3>
              <p className="mt-2 text-sm font-bold text-muted-foreground">
                <CountUp value={count} />{" "}
                {ar ? (count === 1 ? "عضو" : "أعضاء") : count === 1 ? "member" : "members"}
              </p>
            </>
          );
          return (
            <Reveal key={key} index={index}>
              {settings.teamVisible !== false ? (
                <ClubLink
                  path="members"
                  className="club-card flex h-full flex-col rounded-3xl border border-border bg-card p-6 shadow-card"
                >
                  {contents}
                </ClubLink>
              ) : (
                <div className="club-card flex h-full flex-col rounded-3xl border border-border bg-card p-6 shadow-card">
                  {contents}
                </div>
              )}
            </Reveal>
          );
        })}
      </div>

      <Reveal as="h2" className="club-rule mt-14 mb-6 text-2xl font-black">
        {ar ? "أهدافنا" : "Our goals"}
      </Reveal>
      {goals.length ? (
        <ol className="grid gap-4 sm:grid-cols-2">
          {goals.map((goal, index) => (
            <Reveal key={index} as="li" index={index}>
              <div className="club-card flex h-full gap-4 rounded-3xl bg-brand-gradient-soft p-6">
                <strong
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-sm font-black text-white"
                >
                  {index + 1}
                </strong>
                <RichText value={goal} className="min-w-0 leading-loose" />
              </div>
            </Reveal>
          ))}
        </ol>
      ) : (
        <Empty />
      )}

      <Reveal as="h2" className="club-rule mt-14 mb-6 text-2xl font-black">
        {ar ? "مجالات عملنا" : "Our fields"}
      </Reveal>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map(([key, arabic, english], index) => {
          const Icon = [Smartphone, Globe, Gamepad2, Palette][index]!;
          return (
            <Reveal key={key} index={index}>
              <div className="club-card group h-full rounded-3xl border border-border bg-card p-6 shadow-card">
                <span className="inline-flex rounded-2xl bg-brand-gradient-soft p-3 text-primary transition-colors group-hover:bg-brand-gradient group-hover:text-white">
                  <Icon className="h-7 w-7" />
                </span>
                <h3 className="mt-4 font-extrabold">{ar ? arabic : english}</h3>
              </div>
            </Reveal>
          );
        })}
      </div>
    </>
  );
}

export function ListingPage({ kind }: { kind: ContentCollection }) {
  const { lang, data } = useClub();
  const ar = lang === "ar";
  if (kind === "events") return <EventsPage />;
  if (kind === "news") return <NewsPage />;
  const items = data[kind];

  return (
    <>
      <Heading ar={labels[kind][0]} en={labels[kind][1]} />
      {kind === "members" ? (
        <>
          <h2 className="mb-6 text-2xl font-black">
            {ar ? "الهيئة الإدارية" : "Administrative board"}
          </h2>
          <ContentGrid
            kind={kind}
            items={items
              .filter((item) => item.isFounder || item.committee === "administrative")
              .sort((a, b) => (a.displayOrder ?? 10000) - (b.displayOrder ?? 10000))}
          />
          {committees.map(([key, arabic, english]) => (
            <section key={key} className="mt-10">
              <Tabs defaultValue="male" dir={ar ? "rtl" : "ltr"}>
                <div className="mb-5 flex flex-wrap items-center gap-4">
                  <h2 className="text-xl font-black text-primary">{ar ? arabic : english}</h2>
                  <TabsList
                    aria-label={ar ? `أعضاء لجنة ${arabic}` : `${english} members`}
                    className="h-auto rounded-full border border-primary/20 bg-card p-1"
                  >
                    <TabsTrigger
                      value="male"
                      className="rounded-full px-5 py-2 text-primary data-[state=active]:bg-brand-gradient data-[state=active]:text-primary-foreground"
                    >
                      {ar ? "الطلاب" : "Male students"}
                    </TabsTrigger>
                    <TabsTrigger
                      value="female"
                      className="rounded-full px-5 py-2 text-primary data-[state=active]:bg-brand-gradient data-[state=active]:text-primary-foreground"
                    >
                      {ar ? "الطالبات" : "Female students"}
                    </TabsTrigger>
                  </TabsList>
                </div>
                {(["male", "female"] as const).map((gender) => (
                  <TabsContent key={gender} value={gender}>
                    <ContentGrid
                      kind={kind}
                      items={items.filter(
                        (item) =>
                          !item.isFounder &&
                          item.committee === key &&
                          memberGender(item) === gender,
                      )}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </section>
          ))}
        </>
      ) : (
        <ContentGrid items={items} kind={kind} />
      )}
    </>
  );
}

export function DetailPage({ kind, id }: { kind: ContentCollection; id: string }) {
  const { data, lang } = useClub();
  const item = findItem(data, kind, id)?.item;
  const ar = lang === "ar";
  if (!item)
    return (
      <>
        <Heading ar="المحتوى غير موجود" en="Content not found" />
        <ClubLink path={kind}>{ar ? "العودة للقائمة" : "Back to list"}</ClubLink>
      </>
    );

  return (
    <>
      <nav
        aria-label={ar ? "مسار التنقل" : "Breadcrumb"}
        className="mb-6 text-sm text-muted-foreground"
      >
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <ClubLink path="" className="club-sheen-text">
              {siteName[lang]}
            </ClubLink>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <ClubLink path={kind} className="club-sheen-text">
              {labels[kind][ar ? 0 : 1]}
            </ClubLink>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">
            {local(item, "title", lang)}
          </li>
        </ol>
      </nav>
      {kind !== "events" && kind !== "news" && kind !== "members" && (
        <Heading ar={item.title} en={item.title_en} />
      )}
      {kind === "events" ? (
        <EventDetail event={item} lang={lang} />
      ) : kind === "news" ? (
        <NewsDetail news={item} lang={lang} />
      ) : kind === "members" ? (
        <article className="rounded-[2rem] border border-border bg-card p-6 shadow-card sm:p-10">
          <div className="grid grid-cols-[128px_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[184px_minmax(0,1fr)] sm:gap-6 lg:grid-cols-[232px_minmax(0,1fr)]">
            <img
              src={item.images?.map(safeUrl).find(Boolean) || logo}
              alt={local(item, "title", lang)}
              width={450}
              height={600}
              className={`aspect-[3/4] w-full max-w-[232px] rounded-2xl ${item.images?.some((image) => safeUrl(image)) ? "object-cover object-top" : "object-contain bg-brand-gradient-soft p-4"}`}
            />
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-black leading-relaxed sm:text-3xl">
                {local(item, "title", lang)}
              </h1>
              <p className="mt-3 text-base text-muted-foreground">
                {local(item, "role", lang) ||
                  (ar ? "عضو النادي التكنولوجي" : "UCAS IT Club member")}
              </p>
              <RichText
                value={local(item, "description", lang)}
                className="mt-5 text-base leading-loose"
              />
              <div className="mt-6 flex flex-wrap items-center gap-5">
                {(
                  [
                    ["githubUrl", "GitHub", Github],
                    ["linkedinUrl", "LinkedIn", Linkedin],
                  ] as const
                ).map(([key, label, Icon]) =>
                  safeUrl(item[key]) ? (
                    <a
                      key={key}
                      href={safeUrl(item[key])}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 font-bold text-primary"
                    >
                      <Icon size={20} /> {label}
                    </a>
                  ) : null,
                )}
              </div>
            </div>
          </div>
          {item.images
            ?.slice(1)
            .map(safeUrl)
            .filter(Boolean)
            .map((src, i) => (
              <img
                key={`${src}-${i}`}
                src={src}
                alt={local(item, "title", lang)}
                loading="lazy"
                className="mt-8 max-h-[70vh] w-full rounded-2xl object-contain"
              />
            ))}
        </article>
      ) : (
        <article className="rounded-[2rem] border border-border bg-card p-6 shadow-card sm:p-10">
          {item.date && (
            <time dateTime={item.date} className="text-primary font-bold">
              {item.date}
            </time>
          )}
          {item.role && <p className="font-bold text-primary">{local(item, "role", lang)}</p>}
          <RichText
            value={local(item, "description", lang)}
            className="mt-5 text-base leading-loose text-muted-foreground"
          />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {item.images
              ?.filter((image) => safeUrl(image))
              .map((url, index) => (
                <img
                  key={url}
                  src={url}
                  alt={`${local(item, "title", lang)} — ${index + 1}`}
                  width={800}
                  height={600}
                  loading="lazy"
                  className={`${index === 0 ? "aspect-video sm:col-span-2" : "aspect-video"} w-full rounded-2xl object-cover`}
                />
              ))}
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            {(
              [
                ["githubUrl", "GitHub"],
                ["linkedinUrl", "LinkedIn"],
              ] as const
            ).map(
              ([key, label]) =>
                safeUrl(item[key]) && (
                  <a
                    key={key}
                    href={safeUrl(item[key])}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    {label}
                    <ExternalLink size={16} />
                  </a>
                ),
            )}
          </div>
        </article>
      )}
      <div className="mt-8">
        <ClubLink path={kind}>{ar ? "العودة للقائمة" : "Back to list"}</ClubLink>
      </div>
    </>
  );
}
