import { Link } from "@tanstack/react-router";
import { Mail, Facebook, Instagram, Linkedin, Github } from "lucide-react";
import { useClub } from "./club-context";
import { Reveal } from "./Reveal";
import { collegeUrl, isUnavailableSection, safeUrl } from "@/lib/club/model";
import { hrefOf } from "@/lib/club/paths";
import logo from "@/assets/ucas-logo.webp";

const sections: [string, string, string][] = [
  ["about", "من نحن", "About"],
  ["members", "الفريق", "Team"],
  ["events", "الفعاليات", "Events"],
  ["news", "الأخبار", "News"],
  ["partners", "الشراكات", "Partners"],
  ["contact", "تواصل معنا", "Contact"],
];

const socials = [
  ["facebook", Facebook],
  ["instagram", Instagram],
  ["linkedin", Linkedin],
  ["github", Github],
] as const;

const itemClass =
  "inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-primary";

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-black text-foreground">{title}</h2>
      <div className="mt-4 flex flex-col items-start gap-3 text-sm">{children}</div>
    </div>
  );
}

export function SiteFooter() {
  const { lang, settings, data, error } = useClub();
  const ar = lang === "ar";
  const email = settings.email?.trim();
  const links = socials.filter(([key]) => safeUrl(settings[key]));

  return (
    <footer className="mt-20 border-t border-border bg-brand-gradient-soft">
      <Reveal as="div" className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1.1fr]">
          <div>
            <div className="flex items-center gap-3">
              <img src={logo} alt="" width={44} height={56} className="h-11 w-9 object-contain" />
              <span className="text-lg font-black">UCAS IT CLUB</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-loose text-muted-foreground">
              {ar
                ? "النادي التكنولوجي في الكلية الجامعية للعلوم التطبيقية. مجتمع طلابي يديره طلبته."
                : "The technology club at the University College of Applied Sciences. A student community, run by its students."}
            </p>
            {links.length > 0 && (
              <div className="mt-6 flex gap-2">
                {links.map(([key, Icon]) => (
                  <a
                    key={key}
                    href={safeUrl(settings[key])}
                    target="_blank"
                    rel="noopener noreferrer me"
                    aria-label={key}
                    className="rounded-full border border-border bg-card p-2.5 text-primary shadow-card transition-transform hover:-translate-y-0.5 hover:border-primary/50"
                  >
                    <Icon size={18} />
                  </a>
                ))}
              </div>
            )}
          </div>

          <Column title={ar ? "الأقسام" : "Sections"}>
            {/* Rendered only after loading; on a failed load every list is empty, so keep them. */}
            {sections
              .filter(([path]) => error || !isUnavailableSection(path, data, settings))
              .map(([path, a, e]) => (
                <Link key={path} to={hrefOf(lang, path)} className={itemClass}>
                  {ar ? a : e}
                </Link>
              ))}
          </Column>

          <Column title={ar ? "تواصل معنا" : "Get in touch"}>
            {email && (
              <a href={`mailto:${email}`} className={itemClass}>
                <Mail size={16} aria-hidden="true" />
                {email}
              </a>
            )}
            <Link to={hrefOf(lang, "contact")} className={itemClass}>
              {ar ? "صفحة التواصل" : "Contact page"}
            </Link>
          </Column>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} UCAS IT CLUB —{" "}
            <a
              href={collegeUrl[lang]}
              target="_blank"
              rel="noopener"
              className="underline-offset-4 transition-colors hover:text-primary hover:underline"
            >
              {ar ? "الكلية الجامعية للعلوم التطبيقية" : "University College of Applied Sciences"}
            </a>
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link to={hrefOf(lang, "privacy")} className={itemClass}>
              {ar ? "الخصوصية والكوكيز" : "Privacy & cookies"}
            </Link>
          </div>
        </div>
      </Reveal>
    </footer>
  );
}
