import { useEffect, useState } from "react";
import { dateParts, eventDisplayStatus } from "@/lib/club/event-timing";
import { local } from "@/lib/club/model";
import { useClub } from "./club-context";

/**
 * A status line hanging under the header, after the strip across the top of uos.acm.org:
 * where the club is, what time it is there, how many have visited, what is next.
 * Four labelled cells, no fill; lines on three sides, joined to the navbar above. Figures are English numerals in both languages.
 */
export function SiteStatus() {
  const { lang, data, visitorCount } = useClub();
  const ar = lang === "ar";
  // Null until mounted: the server cannot know the visitor's clock, and a time
  // rendered there would be wrong and mismatch on hydration.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);

    return () => window.clearInterval(timer);
  }, []);

  const time = now
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Gaza",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(now)
    : "--:--:--";
  const next = data.events
    .filter((item) => eventDisplayStatus(item, new Date()) === "upcoming")
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))[0];
  const nextDate = dateParts(next?.date, lang);

  const cells: [string, React.ReactNode][] = [
    [
      ar ? "الكلية" : "College",
      ar ? "الكلية الجامعية للعلوم التطبيقية" : "University College of Applied Sciences",
    ],
    [ar ? "الوقت في غزة" : "Time in Gaza", <span className="club-status-num">{time}</span>],
    [
      ar ? "زوار الموقع" : "Site visitors",
      <span className="club-status-num">
        {visitorCount === null ? "—" : visitorCount.toLocaleString("en-US")}
      </span>,
    ],
    [
      ar ? "الفعالية القادمة" : "Next event",
      next
        ? `${local(next, "title", lang)}${nextDate ? ` · ${nextDate.day} ${nextDate.month}` : ""}`
        : ar
          ? "ستُعلن قريبًا"
          : "Announced soon",
    ],
  ];

  return (
    <dl className="club-status" dir={ar ? "rtl" : "ltr"}>
      {cells.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
