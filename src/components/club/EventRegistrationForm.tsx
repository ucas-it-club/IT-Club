import { useRef, useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { BrandButton } from "./BrandButton";
import { Input } from "@/components/ui/input";
import { useClub } from "./club-context";
import type { Content } from "@/lib/club/model";
import { submitEventSignup, submissionError } from "@/lib/club/sheets";
import { eventRegistrationIsAvailable } from "@/lib/club/event-timing";

export function EventRegistrationForm({ event }: { event: Content }) {
  const { lang } = useClub();
  const ar = lang === "ar";
  const config = event.eventRegistration;
  const [countryCode, setCountryCode] = useState("970");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");
  const requestId = useRef<string | undefined>(undefined);

  if (!config || !eventRegistrationIsAvailable(event)) return null;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>;
    values["countryCode"] = countryCode;
    if (config?.nameEnabled && (values["name"] || "").trim().length < 2) {
      setMessage(ar ? "أدخل الاسم الكامل." : "Enter your full name.");
      return;
    }
    if (config?.phoneEnabled && !/^\d{7,10}$/.test(values["phone"] || "")) {
      setMessage(ar ? "أدخل رقم هاتف صحيحًا." : "Enter a valid phone number.");
      return;
    }
    if (config?.attendanceEnabled && values["attendance"] !== "yes") {
      setMessage(ar ? "يجب تأكيد الالتزام بالحضور." : "Please confirm attendance.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      requestId.current ??= crypto.randomUUID();
      await submitEventSignup(event.id, values, requestId.current);
      setSuccess(true);
      form.reset();
    } catch (error) {
      setMessage(submissionError(error, ar));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-12" aria-labelledby={`event-registration-${event.id}`}>
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-border bg-card p-6 shadow-card sm:p-10">
        <div className="text-center">
          <span className="inline-flex rounded-full bg-brand-gradient-soft px-4 py-1.5 text-sm font-bold text-primary">
            {ar ? "فعالية قادمة" : "Upcoming event"}
          </span>
          <h2
            id={`event-registration-${event.id}`}
            className="mt-4 text-3xl font-black text-primary"
          >
            {ar ? "سجّل في الفعالية القادمة" : "Register for the upcoming event"}
          </h2>
          <p className="text-muted-foreground">
            {ar ? "احجز مكانك وشاركنا التجربة" : "Reserve your place and join the experience"}
          </p>
        </div>
        {success ? (
          <p
            role="status"
            className="mt-8 rounded-2xl bg-brand-gradient-soft p-6 text-center font-bold text-primary"
          >
            <Check className="mx-auto mb-2" aria-hidden="true" />
            {ar ? "تم تأكيد تسجيلك بنجاح." : "Your registration is confirmed."}
          </p>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={submit} noValidate aria-busy={busy}>
            {config.nameEnabled && (
              <label className="block text-sm font-bold">
                <span className="mb-2 block">{ar ? "الاسم الكامل" : "Full name"}</span>
                <Input name="name" required minLength={2} maxLength={200} autoComplete="name" />
              </label>
            )}
            {config.phoneEnabled && (
              <label className="block text-sm font-bold">
                <span className="mb-2 block">{ar ? "رقم الهاتف" : "Phone number"}</span>
                <div className="flex gap-2" dir="ltr">
                  <div className="flex shrink-0 overflow-hidden rounded-xl border border-border bg-background">
                    {["970", "972"].map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setCountryCode(code)}
                        aria-pressed={countryCode === code}
                        className={`px-4 font-bold ${countryCode === code ? "bg-brand-gradient text-white" : "text-muted-foreground"}`}
                      >
                        +{code}
                      </button>
                    ))}
                  </div>
                  <Input
                    name="phone"
                    required
                    inputMode="numeric"
                    pattern="[0-9]{7,10}"
                    maxLength={10}
                    placeholder="59 000 0000"
                    autoComplete="tel-national"
                    onInput={(e) => {
                      e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 10);
                    }}
                  />
                </div>
              </label>
            )}
            {config.attendanceEnabled && (
              <label className="flex items-center gap-3 text-sm font-bold">
                <input
                  name="attendance"
                  value="yes"
                  type="checkbox"
                  required
                  className="h-5 w-5 accent-primary"
                />
                {ar ? "ألتزم بالحضور في موعد الفعالية" : "I commit to attending the event"}
              </label>
            )}
            {message && (
              <p
                role="alert"
                className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-primary"
              >
                {message}
              </p>
            )}
            <BrandButton type="submit" className="w-full" disabled={busy}>
              {busy
                ? ar
                  ? "جارٍ التسجيل…"
                  : "Registering…"
                : ar
                  ? "تأكيد التسجيل"
                  : "Confirm registration"}
            </BrandButton>
            <p className="text-center text-sm text-muted-foreground">
              {ar
                ? "ستُستخدم بياناتك للتواصل بخصوص هذه الفعالية فقط"
                : "Your details will only be used for this event."}
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
