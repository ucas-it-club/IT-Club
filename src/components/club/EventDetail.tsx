import { useState, type ReactNode } from "react";
import { CalendarDays, Clock3, Github, Hourglass, Linkedin, Tag, UserRound } from "lucide-react";
import {
  eventPeople,
  personField,
  safeUrl,
  type Content,
  type EventPerson,
  type Lang,
} from "@/lib/club/model";
import { itemPage } from "@/lib/club/paths";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { contentImageUrls } from "@/lib/club/google-drive";
import {
  eventDisplayStatus,
  eventHasEnded,
  eventRegistrationIsAvailable,
  formatEventDuration,
  formatEventTime,
} from "@/lib/club/event-timing";
import { BrandButton } from "./BrandButton";
import { ContentImage } from "./ContentImage";
import { EventRegistrationForm } from "./EventRegistrationForm";
import { RichText } from "./RichText";
import { ClubLink } from "./ClubContent";
import { useClub } from "./club-context";

function localizedEventField(
  event: Content,
  arabicKey: keyof Content,
  englishKey: keyof Content,
  lang: Lang,
) {
  const preferred = lang === "en" ? event[englishKey] : event[arabicKey];
  const fallback = event[arabicKey];
  return typeof preferred === "string"
    ? preferred.trim()
    : typeof fallback === "string"
      ? fallback.trim()
      : "";
}

function formattedEventDate(date: string | undefined, lang: Lang) {
  if (!date) return "";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat(lang === "ar" ? "ar-PS" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function EventFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4">
      <dt className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
        <Icon className="size-4 text-primary" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-2 font-extrabold text-foreground">{value}</dd>
    </div>
  );
}

/** The member a person was picked from, if they still exist. */
function useMember(person: EventPerson) {
  const { data } = useClub();
  const member = person.memberId
    ? data.members.find((item) => item.id === person.memberId)
    : undefined;
  const profile =
    member && member.profileEnabled !== false ? itemPage("members", member, data) : undefined;

  return { photo: member?.images?.map(safeUrl).find(Boolean), profile };
}

function PersonAvatar({ photo, large }: { photo?: string | undefined; large?: boolean }) {
  const size = large ? "size-12" : "size-9";

  return photo ? (
    <img
      src={photo}
      alt=""
      width={96}
      height={96}
      loading="lazy"
      className={`${size} shrink-0 rounded-2xl object-cover object-top`}
    />
  ) : (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-2xl bg-card text-primary shadow-sm`}
    >
      <UserRound className={large ? "size-6" : "size-5"} aria-hidden="true" />
    </span>
  );
}

function PersonLinks({ person }: { person: EventPerson }) {
  const links = (
    [
      ["linkedinUrl", "LinkedIn", Linkedin],
      ["githubUrl", "GitHub", Github],
    ] as const
  ).filter(([key]) => safeUrl(person[key]));
  if (!links.length) return null;

  return (
    <div className="mt-3 flex gap-3">
      {links.map(([key, label, Icon]) => (
        <a
          key={key}
          href={safeUrl(person[key])}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${label}: ${person.name_en || person.name}`}
          className="inline-flex size-9 items-center justify-center rounded-xl bg-card text-primary shadow-sm hover:bg-primary hover:text-primary-foreground"
        >
          <Icon className="size-5" aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}

function PresenterItem({
  person,
  index,
  lang,
}: {
  person: EventPerson;
  index: number;
  lang: Lang;
}) {
  const { photo, profile } = useMember(person);
  const name = personField(person, "name", lang);

  return (
    <AccordionItem value={String(index)} className="border-border/60 last:border-b-0">
      <AccordionTrigger className="gap-3 py-3 text-start text-base font-black text-primary hover:no-underline">
        <span className="flex min-w-0 items-center gap-3">
          <PersonAvatar photo={photo} />
          <span className="min-w-0 break-words">{name}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="ps-12">
        <p className="leading-relaxed text-muted-foreground">{personField(person, "bio", lang)}</p>
        {profile && (
          <ClubLink path={profile} className="mt-2 inline-block font-bold text-primary underline">
            {lang === "ar" ? "الملف الشخصي" : "Profile"}
          </ClubLink>
        )}
        <PersonLinks person={person} />
      </AccordionContent>
    </AccordionItem>
  );
}

function Organizer({ person, lang }: { person: EventPerson; lang: Lang }) {
  const { photo, profile } = useMember(person);
  const chip = (
    <>
      {photo ? (
        <img
          src={photo}
          alt=""
          width={48}
          height={48}
          loading="lazy"
          className="size-6 rounded-full object-cover object-top"
        />
      ) : (
        <UserRound className="size-4" aria-hidden="true" />
      )}
      {personField(person, "name", lang)}
    </>
  );
  const className =
    "inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-sm font-bold text-foreground shadow-sm";

  return (
    <li>
      {profile ? (
        <ClubLink path={profile} className={`${className} hover:text-primary`}>
          {chip}
        </ClubLink>
      ) : (
        <span className={className}>{chip}</span>
      )}
    </li>
  );
}

/** One presenter gets the full card; several get a list that opens one at a time. */
function EventPeople({ event, lang }: { event: Content; lang: Lang }) {
  const ar = lang === "ar";
  const presenters = eventPeople(event, "presenter");
  const organizers = eventPeople(event, "organizer");
  const single = presenters.length === 1 ? presenters[0] : undefined;
  const { photo, profile } = useMember(single ?? { role: "presenter" });
  const headingId = `event-presenter-${event.id}`;
  const singleName = single ? personField(single, "name", lang) : "";

  return (
    <section aria-labelledby={headingId} className="rounded-3xl bg-brand-gradient-soft p-5 sm:p-6">
      {presenters.length > 1 ? (
        <>
          <h2 id={headingId} className="text-sm font-bold text-muted-foreground">
            {ar ? "مقدمو الفعالية" : "Event presenters"}
          </h2>
          <Accordion type="single" collapsible className="mt-1">
            {presenters.map((person, index) => (
              <PresenterItem key={index} person={person} index={index} lang={lang} />
            ))}
          </Accordion>
        </>
      ) : (
        <div className="flex items-start gap-4">
          <PersonAvatar photo={photo} large />
          <div className="min-w-0">
            <h2 id={headingId} className="text-sm font-bold text-muted-foreground">
              {ar ? "مقدم الفعالية" : "Event presenter"}
            </h2>
            <p className="mt-1 break-words text-xl font-black text-primary">
              {!singleName ? (
                ar ? (
                  "سيُعلن عنه قريبًا"
                ) : (
                  "To be announced"
                )
              ) : profile ? (
                <ClubLink path={profile} className="hover:underline">
                  {singleName}
                </ClubLink>
              ) : (
                singleName
              )}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {(single && personField(single, "bio", lang)) ||
                (ar
                  ? "ستُضاف نبذة عن مقدم الفعالية عند توفرها."
                  : "A short presenter bio will be added when available.")}
            </p>
            {single && <PersonLinks person={single} />}
          </div>
        </div>
      )}
      {organizers.length > 0 && (
        <div className="mt-4 border-t border-border/60 pt-4">
          <h3 className="text-sm font-bold text-muted-foreground">
            {ar ? "تنظيم" : "Organized by"}
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {organizers.map((person, index) => (
              <Organizer key={index} person={person} lang={lang} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function EventDetail({
  event,
  lang,
  previewImage,
}: {
  event: Content;
  lang: Lang;
  previewImage?: string;
}) {
  const ar = lang === "ar";
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const validImages = [...(previewImage ? [previewImage] : []), ...contentImageUrls(event)];
  const cover = validImages[0];
  const registrationAvailable = eventRegistrationIsAvailable(event);
  const ended = eventHasEnded(event);
  const displayStatus = eventDisplayStatus(event);
  const eventType = localizedEventField(event, "eventType", "eventType_en", lang);
  const unavailable = ar ? "يُحدّد لاحقًا" : "To be announced";

  const facts = [
    {
      icon: CalendarDays,
      label: ar ? "التاريخ" : "Date",
      value: event.date ? (
        <time dateTime={event.date}>{formattedEventDate(event.date, lang)}</time>
      ) : (
        unavailable
      ),
    },
    {
      icon: Clock3,
      label: ar ? "الموعد" : "Time",
      value: formatEventTime(event.eventTime, lang) || unavailable,
    },
    {
      icon: Hourglass,
      label: ar ? "المدة" : "Duration",
      value: formatEventDuration(event.durationMinutes, lang) || unavailable,
    },
    {
      icon: Tag,
      label: ar ? "نوع الفعالية" : "Event type",
      value: eventType || unavailable,
    },
  ];

  return (
    <>
      <article className="overflow-hidden rounded-[2rem] border border-border bg-card p-5 shadow-card sm:p-8 lg:p-10">
        <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-10">
          <div className="space-y-5 lg:col-start-2 lg:row-start-1">
            <figure className="overflow-hidden rounded-3xl border border-border bg-muted">
              {cover ? (
                <img
                  src={cover}
                  alt={event.title_en && lang === "en" ? event.title_en : event.title}
                  width={1200}
                  height={675}
                  className="aspect-video w-full object-cover"
                />
              ) : (
                <>
                  <ContentImage
                    alt={event.title_en && lang === "en" ? event.title_en : event.title}
                    lang={lang}
                    className="aspect-video w-full object-cover"
                  />
                  <figcaption className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                    {ar
                      ? "صورة تعريفية للنادي — تُضاف صورة الفعالية عند توفرها."
                      : "Club illustration — the event image will be added when available."}
                  </figcaption>
                </>
              )}
            </figure>

            <EventPeople event={event} lang={lang} />

            <section aria-labelledby={`event-information-${event.id}`}>
              <h2 id={`event-information-${event.id}`} className="club-rule text-2xl font-black">
                {ar ? "معلومات الفعالية" : "Event information"}
              </h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {facts.map((fact) => (
                  <EventFact key={fact.label} {...fact} />
                ))}
              </dl>
            </section>
          </div>

          <div className="space-y-8 lg:col-start-1 lg:row-start-1">
            {displayStatus && (
              <span className="inline-flex rounded-full bg-brand-gradient-soft px-4 py-1.5 text-sm font-bold text-primary">
                {displayStatus === "past" ? (ar ? "سابقة" : "Past") : ar ? "قادمة" : "Upcoming"}
              </span>
            )}
            <h1 className="text-xl font-black text-primary sm:text-3xl">
              {lang === "en" ? event.title_en || event.title : event.title}
            </h1>
            <section aria-labelledby={`event-about-${event.id}`}>
              <h2 id={`event-about-${event.id}`} className="club-rule text-2xl font-black">
                {ar ? "عن الفعالية" : "About the event"}
              </h2>
              <RichText
                value={
                  lang === "en" ? event.description_en || event.description : event.description
                }
                className="mt-4 text-base leading-loose text-foreground"
              />
            </section>

            {registrationAvailable ? (
              <BrandButton
                type="button"
                className="w-full sm:w-auto"
                aria-expanded={registrationOpen}
                aria-controls={`event-registration-${event.id}`}
                onClick={() => setRegistrationOpen((open) => !open)}
              >
                {registrationOpen
                  ? ar
                    ? "إخفاء نموذج التسجيل"
                    : "Hide registration form"
                  : ar
                    ? "سجّل في الفعالية"
                    : "Register for the event"}
              </BrandButton>
            ) : ended ? (
              <p className="w-fit rounded-full border border-border bg-muted px-4 py-2 text-sm font-bold text-muted-foreground">
                {ar ? "انتهت هذه الفعالية" : "This event has ended"}
              </p>
            ) : null}
          </div>
        </div>

        {validImages.length > 1 && (
          <section
            className="mt-10 border-t border-border pt-8"
            aria-label={ar ? "صور الفعالية" : "Event photos"}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {validImages.slice(1).map((url, index) => (
                <img
                  key={url}
                  src={url}
                  alt={`${event.title_en && lang === "en" ? event.title_en : event.title} — ${index + 2}`}
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

      {registrationAvailable && registrationOpen && <EventRegistrationForm event={event} />}
    </>
  );
}
