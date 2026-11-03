import { Link, useLocation } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ArrowUpLeft, ArrowUpRight } from "lucide-react";
import { useClub } from "./club-context";
import { collegeUrl, isUnavailableSection, safeUrl } from "@/lib/club/model";
import { hrefOf, pageOf } from "@/lib/club/paths";
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
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["linkedin", "LinkedIn"],
  ["github", "GitHub"],
] as const;

/**
 * The footer is two bands, like the contact page: a blue one that invites
 * contact (skipped on the contact page itself), then the navy one that holds the site map, the club's accounts and the credits.
 */
export function SiteFooter() {
  const { lang, settings, data, error } = useClub();
  const page = pageOf(useLocation().pathname);
  const ar = lang === "ar";
  const email = settings.email?.trim();
  const links = socials.filter(([key]) => safeUrl(settings[key]));
  const Next = ar ? ArrowLeft : ArrowRight;
  const Out = ar ? ArrowUpLeft : ArrowUpRight;
  // No join prompt here on purpose: joining lives on its own page and the floating button.
  const prompt = page !== "contact";

  return (
    <footer className="club-footer">
      {prompt && (
        <Link to={hrefOf(lang, "contact")} className="club-footer-prompt">
          <span className="club-footer-inner club-footer-prompt-row">
            <span className="club-footer-prompt-title">
              {ar ? "عندك سؤال أو فكرة؟" : "A question or an idea?"}
            </span>
            <span className="club-footer-prompt-action">
              {ar ? "تواصل معنا" : "Get in touch"}
              <Next size={20} aria-hidden="true" />
            </span>
          </span>
        </Link>
      )}

      <div className="club-footer-main">
        <div className="club-footer-inner club-footer-grid">
          <div>
            <div className="club-footer-brand">
              <img src={logo} alt="" width={44} height={56} />
              <span>UCAS IT CLUB</span>
            </div>
            <p className="club-footer-about">
              {ar
                ? "النادي التكنولوجي في الكلية الجامعية للعلوم التطبيقية. مجتمع طلابي يديره طلبته."
                : "The technology club at the University College of Applied Sciences. A student community, run by its students."}
            </p>
          </div>

          <nav aria-label={ar ? "الأقسام" : "Sections"}>
            <h2 className="club-footer-label">{ar ? "الأقسام" : "Sections"}</h2>
            <ul className="club-footer-list">
              {/* Rendered only after loading; on a failed load every list is empty, so keep them. */}
              {sections
                .filter(([path]) => error || !isUnavailableSection(path, data, settings))
                .map(([path, a, e]) => (
                  <li key={path}>
                    <Link to={hrefOf(lang, path)}>{ar ? a : e}</Link>
                  </li>
                ))}
            </ul>
          </nav>

          <div>
            <h2 className="club-footer-label">{ar ? "حسابات النادي" : "Club accounts"}</h2>
            <ul className="club-footer-list">
              {links.map(([key, name]) => (
                <li key={key}>
                  <a
                    href={safeUrl(settings[key])}
                    target="_blank"
                    rel="noopener noreferrer me"
                    dir="ltr"
                  >
                    {name}
                    <Out size={16} aria-hidden="true" />
                  </a>
                </li>
              ))}
              {email && (
                <li>
                  <a href={`mailto:${email}`} dir="ltr" className="club-footer-email">
                    {email}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="club-footer-inner club-footer-base">
          <div className="club-footer-legal">
            <p>
              © {new Date().getFullYear()} UCAS IT CLUB —{" "}
              <a href={collegeUrl[lang]} target="_blank" rel="noopener">
                {ar ? "الكلية الجامعية للعلوم التطبيقية" : "University College of Applied Sciences"}
              </a>
            </p>
            <Link to={hrefOf(lang, "privacy")}>
              {ar ? "الخصوصية والكوكيز" : "Privacy & cookies"}
            </Link>
          </div>
          <p>
            {ar
              ? "تصميم وتطوير: هلا دلول وعبدالرحمن الشيخ خليل"
              : "Made with ❤️ by Hala Dalloul & Abdalrahman Elshaikh Khalil"}
          </p>
        </div>
      </div>
    </footer>
  );
}
