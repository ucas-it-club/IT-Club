import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { hrefOf } from "@/lib/club/paths";

const KEY = "ucas-privacy-seen";

/**
 * A notice, not a consent gate.
 *
 * The site stores two preference cookies and one random visit id, and runs no
 * analytics or third-party tracking. Nothing here needs consent under GDPR or
 * ePrivacy, so blocking the page behind an accept button would cost every
 * visitor a tap and buy nothing. This states what is stored, links to the full
 * notice, and goes away for good.
 *
 * It mounts after hydration so the document never ships a banner the visitor
 * already dismissed, and it is fixed-position so it shifts no layout.
 */
export function PrivacyNotice({ ar }: { ar: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      /* Storage is optional; a visitor who blocks it simply never sees this. */
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);

    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* Dismissal lasts for the session instead. */
    }
  };

  return (
    <div
      role="region"
      aria-label={ar ? "إشعار الخصوصية" : "Privacy notice"}
      className="club-notice fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md shadow-card"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-3.5 text-sm sm:flex-row sm:items-center sm:gap-5">
        <p className="flex-1 leading-relaxed text-muted-foreground">
          {ar
            ? "نحفظ تفضيل المظهر فقط، ورقم زيارة عشوائي لعدّ الزيارات. لا نستخدم أي تتبّع إعلاني أو تحليلات خارجية."
            : "We store only your theme preference, plus a random visit id used to count visits. No advertising trackers and no third-party analytics."}{" "}
          <Link
            to={hrefOf(ar ? "ar" : "en", "privacy")}
            className="font-bold text-primary underline underline-offset-4"
          >
            {ar ? "التفاصيل" : "Read more"}
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="club-action inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-brand-gradient px-5 py-2.5 font-bold text-white shadow-glow-blue transition-transform hover:-translate-y-0.5"
        >
          <X size={15} aria-hidden="true" />
          {ar ? "حسنًا" : "Got it"}
        </button>
      </div>
    </div>
  );
}
