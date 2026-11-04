import { useState, type ReactNode } from "react";
import { CalendarDays, Clock3, Hourglass, Tag, UserRound } from "lucide-react";
import type { Content, Lang } from "@/lib/club/model";
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
  const presenterName = localizedEventField(event, "presenterName", "presenterName_en", lang);
  const presenterBio = localizedEventField(event, "presenterBio", "presenterBio_en", lang);
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

            <section
              aria-labelledby={`event-presenter-${event.id}`}
              className="rounded-3xl bg-brand-gradient-soft p-5 sm:p-6"
            >
              <div className="flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-card text-primary shadow-sm">
                  <UserRound className="size-6" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2
                    id={`event-presenter-${event.id}`}
                    className="text-sm font-bold text-muted-foreground"
                  >
                    {ar ? "مقدم الفعالية" : "Event presenter"}
                  </h2>
                  <p className="mt-1 text-xl font-black text-primary">
                    {presenterName || (ar ? "سيُعلن عنه قريبًا" : "To be announced")}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {presenterBio ||
                      (ar
                        ? "ستُضاف نبذة عن مقدم الفعالية عند توفرها."
                        : "A short presenter bio will be added when available.")}
                  </p>
                </div>
              </div>
            </section>

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
            <h1 className="text-xl font-black text-gradient-brand sm:text-3xl">
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
                className="mt-4 text-base leading-loose text-[#172b4d]"
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
