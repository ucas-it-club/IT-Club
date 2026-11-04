import type { Content, Lang } from "./model";

const eventTimeZone = "Asia/Hebron";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function localParts(now: Date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: eventTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    date: `${values["year"]}-${values["month"]}-${values["day"]}`,
    minutes: Number(values["hour"]) * 60 + Number(values["minute"]),
  };
}

/** Format the stored 24-hour value for visitors using a 12-hour clock. */
export function formatEventTime(time: string | undefined, lang: Lang) {
  if (!time || !timePattern.test(time)) return "";
  const [hour = 0, minute = 0] = time.split(":").map(Number);

  return new Intl.DateTimeFormat(lang === "ar" ? "ar-PS" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

/** Format the stored minute count as hours for the public event details. */
export function formatEventDuration(durationMinutes: number | undefined, lang: Lang) {
  if (!Number.isInteger(durationMinutes) || (durationMinutes ?? 0) < 1) return "";

  const hours = durationMinutes! / 60;
  const value = new Intl.NumberFormat(lang === "ar" ? "ar-PS" : "en-US", {
    maximumFractionDigits: 2,
  }).format(hours);

  if (lang === "ar") return `${value} ساعة`;
  return `${value} ${hours === 1 ? "hour" : "hours"}`;
}

/** Whether the event has ended in the club's local Asia/Hebron time. */
export function eventHasEnded(event: Content, now = new Date()) {
  if (event.status === "past") return true;
  if (!event.date || !datePattern.test(event.date)) return false;

  const local = localParts(now);
  const eventTime = event.eventTime;
  const durationMinutes = event.durationMinutes;
  const hasDetailedTime =
    Boolean(eventTime && timePattern.test(eventTime)) &&
    Number.isInteger(durationMinutes) &&
    (durationMinutes ?? 0) >= 1;
  if (!hasDetailedTime) return event.date < local.date;

  const [hour = 0, minute = 0] = eventTime!.split(":").map(Number);
  const eventDay = Date.parse(`${event.date}T00:00:00Z`) / 86400000;
  const localDay = Date.parse(`${local.date}T00:00:00Z`) / 86400000;
  const elapsed = (localDay - eventDay) * 1440 + local.minutes - hour * 60 - minute;
  return elapsed >= durationMinutes!;
}

/** The status visitors should see, even before an editor updates the stored value. */
export function eventDisplayStatus(event: Content, now = new Date()) {
  if (event.status !== "upcoming" && event.status !== "past") return undefined;
  return eventHasEnded(event, now) ? "past" : event.status;
}

export function eventRegistrationIsAvailable(event: Content, now = new Date()) {
  return (
    event.status === "upcoming" &&
    event.eventRegistration?.enabled === true &&
    !eventHasEnded(event, now)
  );
}
