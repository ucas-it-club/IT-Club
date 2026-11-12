import type { ComponentType } from "react";
import { ArrowUpLeft, ArrowUpRight, Facebook, Instagram, Linkedin, Mail } from "lucide-react";
import { useClub } from "./club-context";

type Channel = {
  key: string;
  name: string;
  Icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  href: string;
  action: [string, string];
  note: [string, string];
};

const channels: Channel[] = [
  {
    key: "instagram",
    name: "Instagram",
    Icon: Instagram,
    href: "https://ig.me/m/ucas.it.club",
    action: ["راسلنا", "Message us"],
    note: ["قرّب من أجواء النادي", "Get closer to club life"],
  },
  {
    key: "facebook",
    name: "Facebook",
    Icon: Facebook,
    href: "https://m.me/61586651370844",
    action: ["راسلنا", "Message us"],
    note: ["خلّينا نسمع منك", "We would love to hear from you"],
  },
  {
    key: "linkedin",
    name: "LinkedIn",
    Icon: Linkedin,
    href: "https://www.linkedin.com/company/ucas-it-club/",
    action: ["افتح الصفحة", "Open our page"],
    note: ["نتواصل ونشارك الفرص", "Connect and share opportunities"],
  },
];

/** Each channel is a full-width band of flat brand colour; the whole band is the link. */
export function ContactPage() {
  const { lang, settings } = useClub();
  const ar = lang === "ar";
  const email = settings.email?.trim();
  const Arrow = ar ? ArrowUpLeft : ArrowUpRight;
  const bands: Channel[] = email
    ? [
        ...channels,
        {
          key: "email",
          name: email,
          Icon: Mail,
          href: `mailto:${email}`,
          action: ["اكتب لنا", "Write to us"],
          note: ["لأي سؤال أو فكرة", "For any question or idea"],
        },
      ]
    : channels;

  return (
    <section className="contact" aria-labelledby="contact-heading">
      <header className="contact-head">
        <h1 id="contact-heading">{ar ? "خلّينا على تواصل" : "Let’s stay in touch"}</h1>
      </header>
      <ul className="contact-bands">
        {bands.map(({ key, name, Icon, href, action, note }) => (
          <li key={key} className={`contact-band contact-band-${key}`}>
            <a
              href={href}
              {...(key === "email" ? {} : { target: "_blank", rel: "noopener noreferrer" })}
              className="contact-band-link"
            >
              <span className="contact-band-inner">
                <Icon size={40} aria-hidden />
                <span className="contact-band-text">
                  <span className="contact-band-name" dir="ltr">
                    {name}
                  </span>
                  <span className="contact-band-note">{ar ? note[0] : note[1]}</span>
                </span>
                <span className="contact-band-action">
                  {ar ? action[0] : action[1]}
                  <Arrow size={20} aria-hidden />
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
