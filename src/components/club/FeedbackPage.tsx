import { useState, type FormEvent } from "react";
import { useClub } from "./club-context";
import { BrandButton } from "./BrandButton";
import { SuccessPulse } from "./SuccessPulse";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sendFeedback } from "@/lib/club/public-api";
import {
  feedbackError,
  feedbackKinds,
  feedbackMaxLength,
  takeFeedbackSource,
  type FeedbackKind,
} from "@/lib/club/feedback";

/** Site Feedback: any visitor reports a problem on the site or suggests an improvement. */
export function FeedbackPage() {
  const { lang } = useClub();
  const ar = lang === "ar";
  const t = ([a, e]: readonly [string, string]) => (ar ? a : e);
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [from] = useState(() => (typeof window === "undefined" ? "" : takeFeedbackSource()));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await sendFeedback({
        kind,
        message,
        name: String(form.get("name") || ""),
        contact: String(form.get("contact") || ""),
        page: from || location.pathname,
        lang,
        theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
        device: navigator.userAgent.slice(0, 300),
        website: String(form.get("website") || ""),
      });
      setSent(true);
    } catch (caught) {
      setError(feedbackError(caught, ar));
    } finally {
      setBusy(false);
    }
  }

  const optional = (
    <span className="ms-1 font-normal text-muted-foreground">{t(["(اختياري)", "(optional)"])}</span>
  );

  return (
    <section className="mx-auto max-w-2xl py-8 sm:py-12" aria-labelledby="feedback-heading">
      <h1 id="feedback-heading" className="text-3xl font-black sm:text-4xl">
        {t(["ملاحظات على الموقع", "Site feedback"])}
      </h1>
      <p className="mt-3 leading-8 text-muted-foreground">
        {t([
          "واجهت مشكلة في الموقع أو عندك فكرة لتحسينه؟ أخبرنا. لا حاجة لتسجيل الدخول، ورسالتك بلا اسم ما لم تضفه.",
          "Hit a problem on the site, or have an idea to make it better? Tell us. No sign-in needed, and your note stays anonymous unless you add your name.",
        ])}
      </p>

      {sent ? (
        <SuccessPulse on={sent}>
          <div role="status" className="mt-8 rounded-2xl border border-border bg-card p-6">
            <p className="text-lg font-bold">
              {t(["وصلتنا ملاحظتك، شكرًا لك!", "Got it, thank you!"])}
            </p>
            <BrandButton
              className="mt-4"
              variant="outline"
              onClick={() => {
                setSent(false);
                setMessage("");
              }}
            >
              {t(["إرسال ملاحظة أخرى", "Send another note"])}
            </BrandButton>
          </div>
        </SuccessPulse>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="mt-8 space-y-6">
          <fieldset>
            <legend className="mb-3 text-sm font-bold">{t(["نوع الملاحظة", "Kind"])}</legend>
            <div role="radiogroup" className="flex flex-wrap gap-2">
              {(Object.keys(feedbackKinds) as FeedbackKind[]).map((key) => (
                <BrandButton
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={kind === key}
                  variant={kind === key ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setKind(key)}
                >
                  {t(feedbackKinds[key])}
                </BrandButton>
              ))}
            </div>
          </fieldset>

          <label className="block text-sm font-bold">
            <span className="mb-2 block">
              {kind === "bug"
                ? t(["ما المشكلة؟ وأين ظهرت؟", "What went wrong, and where?"])
                : t(["ما فكرتك؟", "What is your idea?"])}
            </span>
            <Textarea
              name="message"
              required
              rows={6}
              maxLength={feedbackMaxLength}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="resize-y font-normal leading-7"
            />
            <span
              className="mt-1 block text-end text-xs font-normal text-muted-foreground"
              dir="ltr"
            >
              {message.length} / {feedbackMaxLength}
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold">
              <span className="mb-2 block">
                {t(["الاسم", "Name"])}
                {optional}
              </span>
              <Input name="name" maxLength={100} autoComplete="name" />
            </label>
            <label className="block text-sm font-bold">
              <span className="mb-2 block">
                {t(["بريد أو هاتف للرد", "Email or phone for a reply"])}
                {optional}
              </span>
              <Input name="contact" maxLength={200} autoComplete="email" dir="ltr" />
            </label>
          </div>

          {/* Honeypot: hidden from people and assistive tech; bots fill it in. */}
          <div aria-hidden="true" className="absolute -start-[9999px] h-px w-px overflow-hidden">
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-primary"
            >
              {error}
            </p>
          )}

          <BrandButton type="submit" disabled={busy || !message.trim()}>
            {busy ? t(["جارٍ الإرسال…", "Sending…"]) : t(["إرسال", "Send"])}
          </BrandButton>
        </form>
      )}
    </section>
  );
}
