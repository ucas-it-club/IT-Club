import { useEffect, useRef, useState, type FormEvent } from "react";
import { BrandButton } from "./BrandButton";
import { PageHeading } from "./PageHeading";
import { useClub } from "./club-context";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  committees,
  contactSchema,
  joinSchema,
  majorEnglishLabels,
  majors,
} from "@/lib/club/model";
import { useRegistration } from "@/lib/club/registration";
import { submissionError, submitToSheet } from "@/lib/club/sheets";

export function PublicForm({ join }: { join: boolean }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const { lang, settings } = useClub();
  const ar = lang === "ar";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message) feedback.current?.focus();
  }, [message]);
  const requestId = useRef<string | undefined>(undefined);
  // Shared query, fetched once per session. This form used to ask Google Apps
  // Script — a ~3s call — on mount and then every fifteen seconds while open.
  const registration = useRegistration();

  const [major, setMajor] = useState("");
  const [committee, setCommittee] = useState<string>(committees[0][0]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (busy) return;
    const form = e.currentTarget;
    // SAFETY: this form has no file inputs, so every FormData entry value is a string.
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>;

    if (join) {
      values["preferredCommittee"] = committee;
      values["major"] = major;
    }

    const parsed = (join ? joinSchema : contactSchema).safeParse(values);

    if (!parsed.success) {
      const errors = {
        name: ["أدخلي الاسم من حرفين إلى 200 حرف.", "Enter a name of 2–200 characters."],
        fullName: [
          "أدخلي الاسم الكامل من حرفين إلى 200 حرف.",
          "Enter a full name of 2–200 characters.",
        ],
        email: [
          "أدخلي بريدًا جامعيًا ينتهي بـ @smail.ucas.edu.ps.",
          "Enter your @smail.ucas.edu.ps email address.",
        ],
        studentId: [
          "الرقم الجامعي يجب أن يتكوّن من 9 أرقام.",
          "Student ID must contain exactly 9 digits.",
        ],
        major: ["اختاري التخصص من القائمة.", "Select your major."],
        preferredCommittee: ["اختاري اللجنة المرغوبة.", "Select a committee."],
        phone: [
          "رقم الهاتف يجب أن يبدأ بـ 056 أو 059 ويتكوّن من 9 أو 10 أرقام.",
          "Phone must start with 056 or 059 and contain 9 or 10 digits.",
        ],
        message: [
          "النص يجب أن يكون بين 10 و4000 حرف.",
          "Your message must contain 10–4000 characters.",
        ],
      } satisfies Record<string, [string, string]>;

      const errorFor = (field: string) => {
        if (!Object.hasOwn(errors, field)) return undefined;

        // SAFETY: hasOwn above confirms field is one of errors' known keys.
        return errors[field as keyof typeof errors];
      };

      setMessage(
        [
          ...new Set(
            parsed.error.issues.map(
              (issue) =>
                errorFor(String(issue.path[0]))?.[ar ? 0 : 1] ||
                (ar ? "تحققي من الحقول." : "Check your fields."),
            ),
          ),
        ].join(" "),
      );

      return;
    }

    setBusy(true);
    setMessage("");

    try {
      requestId.current ??= crypto.randomUUID();
      await submitToSheet(join, parsed.data, requestId.current);
      setSuccess(true);
      form.reset();
    } catch (error) {
      setMessage(submissionError(error, ar));

      if (error instanceof Error && error.message === "JOIN_CLOSED") {
        registration.markClosed();
      }
    } finally {
      setBusy(false);
    }
  }

  const fields = join
    ? [
        ["fullName", "الاسم الكامل", "Full name", "text"],
        ["email", "البريد الإلكتروني", "Email", "email"],
        ["phone", "الهاتف (اختياري)", "Phone (optional)", "tel"],
        ["studentId", "الرقم الجامعي", "Student ID", "text"],
      ]
    : [
        ["name", "الاسم", "Name", "text"],
        ["email", "البريد الإلكتروني", "Email", "email"],
      ];

  return (
    <>
      <PageHeading
        ar={join ? "انضم إلينا" : "تواصل معنا"}
        en={join ? "Join the club" : "Contact us"}
      />
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-border bg-card p-6 shadow-card sm:p-10">
        {!ready ? (
          <p role="status">{ar ? "جارٍ تجهيز النموذج…" : "Preparing the form…"}</p>
        ) : success ? (
          <div
            role="status"
            className="rounded-2xl bg-brand-gradient-soft p-6 text-primary font-bold"
          >
            {ar
              ? "تهانينا على وصول طلب الإنضمام قريبا سيتم مراجعة طلبك و إرسالة رسالة القبول"
              : "Your submission has been saved successfully. Thank you."}
          </div>
        ) : join && !registration.open ? (
          <p
            role="status"
            className="rounded-2xl bg-brand-gradient-soft p-6 font-bold text-primary"
          >
            {registration.failed
              ? ar
                ? "استقبال الطلبات غير متاح حاليًا. يرجى المحاولة لاحقًا."
                : "Applications are currently unavailable. Please try later."
              : registration.loading
                ? ar
                  ? "جارٍ التحقق من استقبال الطلبات…"
                  : "Checking registration availability…"
                : ar
                  ? "تم وقف استقبال الأعضاء الجدد"
                  : "New membership applications are closed."}
          </p>
        ) : (
          <form noValidate onSubmit={submit} className="space-y-5" aria-busy={busy}>
            {fields.map(([name, a, en, type]) => (
              <label key={name} className="block text-sm font-bold">
                <span className="mb-2 block">{ar ? a : en}</span>
                <Input
                  name={name!}
                  type={type!}
                  required={name !== "phone"}
                  maxLength={
                    name === "studentId" ? 9 : name === "phone" ? 10 : name === "email" ? 254 : 200
                  }
                  minLength={name === "studentId" || name === "phone" ? 9 : undefined}
                  inputMode={name === "studentId" || name === "phone" ? "numeric" : undefined}
                  pattern={
                    name === "studentId"
                      ? "[0-9]{9}"
                      : name === "phone"
                        ? "05[69][0-9]{6,7}"
                        : name === "email" && join
                          ? "[^@]+@smail\\.ucas\\.edu\\.ps"
                          : undefined
                  }
                  title={
                    name === "studentId"
                      ? ar
                        ? "أدخل الرقم الجامعي المكوّن من 9 أرقام"
                        : "Enter a 9-digit student ID"
                      : undefined
                  }
                  onInput={
                    name === "studentId" || name === "phone"
                      ? (e) => {
                          e.currentTarget.value = e.currentTarget.value
                            .replace(/[^0-9]/g, "")
                            .slice(0, name === "phone" ? 10 : 9);
                        }
                      : undefined
                  }
                  autoComplete={
                    name === "email"
                      ? "email"
                      : name === "phone"
                        ? "tel"
                        : name === "name" || name === "fullName"
                          ? "name"
                          : "off"
                  }
                />
              </label>
            ))}
            {join && (
              <label className="block text-sm font-bold">
                <span className="mb-2 block">{ar ? "التخصص" : "Major"}</span>
                <Select dir={ar ? "rtl" : "ltr"} value={major} onValueChange={setMajor} required>
                  <SelectTrigger className="h-auto min-h-10 whitespace-normal text-start">
                    <SelectValue placeholder={ar ? "اختاري التخصص" : "Select a major"} />
                  </SelectTrigger>
                  <SelectContent>
                    {majors.map((name) => (
                      <SelectItem key={name} value={name}>
                        {ar ? name : majorEnglishLabels[name]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            )}
            {join && (
              <label className="block text-sm font-bold">
                <span className="mb-2 block">{ar ? "اللجنة المرغوبة" : "Preferred committee"}</span>
                <Select dir={ar ? "rtl" : "ltr"} value={committee} onValueChange={setCommittee}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {committees.map(([key, a, en]) => (
                      <SelectItem key={key} value={key}>
                        {ar ? a : en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            )}
            <label className="block text-sm font-bold">
              <span className="mb-2 block">
                {ar ? (join ? "عرّفنا بنفسك" : "الرسالة") : join ? "Introduce yourself" : "Message"}
              </span>
              <Textarea
                name="message"
                required
                minLength={10}
                maxLength={4000}
                rows={5}
                wrap="soft"
                className="resize-y whitespace-pre-wrap [overflow-wrap:anywhere] leading-7"
              />
            </label>
            <p className="text-sm text-muted-foreground">
              {ar
                ? "تُستخدم بياناتك للرد على رسالتك أو مراجعة طلب انضمامك من إدارة النادي."
                : "Club administrators use your details to respond to your message or review your membership request."}
            </p>
            {message && (
              <p
                ref={feedback}
                tabIndex={-1}
                role="alert"
                className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-primary"
              >
                {message}
              </p>
            )}
            {busy && (
              <p role="status" className="text-primary">
                {ar
                  ? "جارٍ إرسال الطلب إلى Google Sheets، انتظري تأكيد الحفظ…"
                  : "Sending to Google Sheets. Please wait for confirmation…"}
              </p>
            )}
            <BrandButton type="submit" disabled={busy || (join && !registration.open)}>
              {busy ? (ar ? "جارٍ الإرسال…" : "Sending…") : ar ? "إرسال" : "Submit"}
            </BrandButton>
          </form>
        )}
        {settings.email && (
          <a className="mt-6 block text-primary" href={`mailto:${settings.email}`}>
            {settings.email}
          </a>
        )}
      </div>
    </>
  );
}
