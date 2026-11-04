import { Link } from "@tanstack/react-router";
import { useClub } from "./club-context";
import { hrefOf } from "@/lib/club/paths";
import { useRegistration } from "@/lib/club/registration";
import mascot from "@/assets/club-mascot.webp";

/**
 * Shown only while the club is advertising membership.
 *
 * The cheap settings flag prevents unnecessary checks while registration is
 * advertised as closed. When it is open, the shared registration query checks
 * the real sheet-backed count so the whole control disappears at the limit.
 */
export function FloatingJoin({ ar }: { ar: boolean }) {
  const { settings } = useClub();
  const registration = useRegistration(settings.registrationOpen === true);

  if (!settings.registrationOpen || registration.open !== true) return null;

  return (
    <Link
      to={hrefOf(ar ? "ar" : "en", "join")}
      aria-label={ar ? "انضم إلينا" : "Join us"}
      className="fixed bottom-4 start-3 z-30 flex w-20 flex-col items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:start-5 sm:w-24"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <span className="club-join-bubble" dir={ar ? "rtl" : "ltr"}>
        {ar ? "انضم إلينا" : "Join us"}
      </span>
      <img
        src={mascot}
        alt=""
        width={301}
        height={472}
        className="h-24 w-auto object-contain sm:h-28"
        style={{ transform: ar ? "none" : "scaleX(-1)" }}
      />
    </Link>
  );
}
