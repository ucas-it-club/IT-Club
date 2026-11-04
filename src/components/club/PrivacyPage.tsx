import { useClub } from "./club-context";

/**
 * What the site stores, in plain language.
 *
 * Every row here is checked against the code: the theme cookie written by
 * prefs.ts, the visit id in visits.ts and the dismissal flag in PrivacyNotice.tsx.
 * Language needs no storage: it is part of the address (/en for English).
 * Nothing else is set, so nothing else is listed.
 */
const rows: [string, string, string, string, string, string][] = [
  [
    "ucas-theme",
    "كوكي",
    "cookie",
    "الوضع الفاتح أو الداكن، لتفادي وميض التبديل عند فتح الصفحة.",
    "Light or dark, so the page does not flash the wrong theme on load.",
    "سنة",
  ],
  [
    "club-visit-session",
    "تخزين الجلسة",
    "sessionStorage",
    "رقم عشوائي يمنع احتساب الزيارة الواحدة مرتين. لا يرتبط بك ولا بجهازك.",
    "A random id that stops one visit being counted twice. It is tied to neither you nor your device.",
    "الجلسة",
  ],
  [
    "ucas-privacy-seen",
    "تخزين محلي",
    "localStorage",
    "أنك أغلقت إشعار الخصوصية، حتى لا يظهر مجددًا.",
    "That you dismissed the privacy notice, so it does not return.",
    "دائم",
  ],
];

export function PrivacyPage() {
  const { lang, settings } = useClub();
  const ar = lang === "ar";
  const email = settings.email?.trim();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-4xl font-black sm:text-5xl text-gradient-brand">
        {ar ? "الخصوصية والكوكيز" : "Privacy & cookies"}
      </h1>

      <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
        {ar
          ? "هذا الموقع لا يستخدم إعلانات ولا تتبّعًا ولا تحليلات خارجية. لا نبيع بياناتك ولا نشاركها مع أي جهة تسويقية، ولا نحتاج موافقتك على الكوكيز لأن ما نحفظه هو تفضيلاتك أنت فقط."
          : "This site runs no advertising, no trackers and no third-party analytics. We do not sell or share your data, and we do not ask for cookie consent because everything stored is your own preference."}
      </p>

      <h2 className="mt-12 text-2xl font-black">{ar ? "ما الذي يُحفظ" : "What is stored"}</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {rows.map(([name, kindAr, kindEn, whyAr, whyEn, keep]) => (
          <div key={name} className="rounded-3xl border border-border bg-card p-5 shadow-card">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <code className="rounded-full bg-brand-gradient-soft px-3 py-1 text-xs font-bold text-primary">
                {name}
              </code>
              <span className="text-xs text-muted-foreground">{ar ? kindAr : kindEn}</span>
              <span className="text-xs text-muted-foreground">
                ·{" "}
                {ar
                  ? `يُحفظ ${keep}`
                  : keep === "الجلسة"
                    ? "kept for the session"
                    : keep === "سنة"
                      ? "kept a year"
                      : "kept until cleared"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {ar ? whyAr : whyEn}
            </p>
          </div>
        ))}
      </div>

      <h2 className="mt-12 text-2xl font-black">{ar ? "بيانات النماذج" : "Form data"}</h2>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        {ar
          ? "طلب الانضمام يُرسل إلى جدول Google Sheets يملكه النادي، ويحتوي ما كتبتَه أنت: الاسم والبريد الجامعي ورقم الطالب والتخصص واللجنة المفضلة ورسالتك. تطّلع عليه إدارة النادي فقط، ولا يُرسل إلى أي مزوّد بريد أو تسويق."
          : "A membership application goes to a Google Sheet owned by the club and contains what you typed: your name, university email, student id, major, preferred committee and message. Only the club's administrators read it, and it is sent to no mail or marketing provider."}
      </p>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        {ar
          ? "محتوى الموقع وصوره مستضاف على Supabase. صور الأعضاء والفعاليات عامة لأنها معروضة على الموقع."
          : "Site content and images are hosted on Supabase. Member and event images are public because they are displayed on the site."}
      </p>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        {ar
          ? "لمنع التلاعب بعدّاد الزيارات، يحفظ الخادم بصمة مشفّرة لعنوان IP مع كل زيارة، ولا يحفظ العنوان نفسه. تُحذف البصمة بعد يوم."
          : "To stop the visit counter being gamed, the server keeps a salted hash of your IP address with each visit, never the address itself. The hash is deleted after a day."}
      </p>

      <h2 className="mt-12 text-2xl font-black">{ar ? "التحكم والحذف" : "Control and removal"}</h2>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        {ar
          ? "يمكنك مسح ما يحفظه الموقع في أي وقت من إعدادات المتصفح؛ لن يتعطّل شيء، وستعود الصفحة إلى اللغة والمظهر الافتراضيَّين. لطلب حذف طلب انضمام أو صورة عضو، راسل النادي."
          : "You can clear everything this site stores from your browser settings at any time; nothing breaks, and the page returns to its default language and theme. To have an application or a member photo removed, write to the club."}
      </p>
      {email && (
        <a
          href={`mailto:${email}`}
          className="club-action mt-6 inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3 font-bold text-white shadow-glow-blue transition-transform hover:-translate-y-0.5"
        >
          {email}
        </a>
      )}
    </div>
  );
}
