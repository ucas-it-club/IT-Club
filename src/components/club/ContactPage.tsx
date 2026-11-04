import { Facebook, Instagram, Linkedin, MessageCircle, ExternalLink } from "lucide-react";
import { useClub } from "./club-context";

const channels = [
  {
    name: "LinkedIn",
    Icon: Linkedin,
    description: "نتواصل ونشارك الفرص",
    descriptionEn: "Connect and share opportunities",
    profile: "https://www.linkedin.com/company/ucas-it-club/",
    message: "https://www.linkedin.com/company/ucas-it-club/",
    direct: false,
  },
  {
    name: "Instagram",
    Icon: Instagram,
    description: "قرّب من أجواء النادي",
    descriptionEn: "Get closer to club life",
    profile: "https://www.instagram.com/ucas.it.club/",
    message: "https://ig.me/m/ucas.it.club",
    direct: true,
  },
  {
    name: "Facebook",
    Icon: Facebook,
    description: "خلّينا نسمع منك",
    descriptionEn: "We would love to hear from you",
    profile: "https://www.facebook.com/people/Ucas-IT-Club/61586651370844/",
    message: "https://m.me/61586651370844",
    direct: true,
  },
];

export function ContactPage() {
  const { lang } = useClub();
  const ar = lang === "ar";

  return (
    <section className="text-center" aria-labelledby="contact-heading">
      <p className="text-sm font-bold tracking-widest text-primary">UCAS IT CLUB</p>
      <h1 id="contact-heading" className="mt-3 text-3xl font-black text-gradient-brand sm:text-5xl">
        {ar ? "خلّينا على تواصل" : "Let’s stay in touch"}
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg leading-loose text-muted-foreground">
        {ar
          ? "عندك سؤال أو فكرة؟ يسعدنا نسمع منك"
          : "Have a question or an idea? We would love to hear from you."}
      </p>
      <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3 sm:mt-16">
        {channels.map(({ name, Icon, description, descriptionEn, profile, message, direct }, i) => (
          <article
            key={name}
            className="club-social-card rounded-3xl border border-border bg-card p-8 shadow-card"
            style={{ animationDelay: `${i * -1.4}s` }}
          >
            <a
              href={message}
              target="_blank"
              rel="noopener noreferrer"
              className="club-social-action flex flex-col items-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4"
              aria-label={`${name} — ${direct ? (ar ? "راسلنا" : "Message us") : ar ? "افتح صفحة النادي" : "Visit our page"}`}
            >
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-gradient-soft text-primary">
                <Icon size={36} aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-xl font-extrabold" dir="ltr">
                {name}
              </h2>
              <p className="mt-3 text-base leading-loose text-muted-foreground">
                {ar ? description : descriptionEn}
              </p>
              <span className="club-action mt-6 inline-flex items-center justify-center gap-2 rounded-full border-2 border-primary/30 px-6 py-3 font-bold text-primary">
                <MessageCircle size={18} aria-hidden="true" />
                {direct
                  ? ar
                    ? "راسلنا"
                    : "Message us"
                  : ar
                    ? "تواصل عبر الصفحة"
                    : "Contact via our page"}
              </span>
            </a>
            <a
              href={profile}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-primary"
            >
              {ar ? "زيارة حساب النادي" : "Visit club profile"}
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          </article>
        ))}
      </div>
      <p className="mt-12 text-sm leading-loose text-muted-foreground">
        {ar ? "فريق النادي موجود لمساعدتك" : "Our club team is here to help."}
      </p>
      <p className="mt-2 text-xs leading-loose text-muted-foreground">
        {ar
          ? "على لينكدإن، افتح صفحة النادي ثم اختر Message. قد تطلب منك المنصة تسجيل الدخول."
          : "On LinkedIn, open our page and choose Message. The platform may ask you to sign in."}
      </p>
    </section>
  );
}
