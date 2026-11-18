import { useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clapperboard,
  Handshake,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { BrandButton } from "./BrandButton";
import { useClub } from "./club-context";
import { DialCodeSelect } from "./DialCodeSelect";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aboutStep, committees, type Pair, type Question } from "@/lib/club/committee-forms";
import { applicationSchema, majors, majorEnglishLabels } from "@/lib/club/model";
import { useRegistration } from "@/lib/club/registration";
import { submissionError, submitApplication } from "@/lib/club/sheets";
import { cn } from "@/lib/utils";
import { ZodError } from "zod";

type Values = Record<string, string | string[]>;
type Panel = { id: string; title: Pair; questions: readonly Question[]; scope: string };
const fieldLabels: Record<string, Pair> = {
  fullName: ["الاسم الكامل", "Full name"],
  studentId: ["الرقم الجامعي", "Student ID"],
  study: ["التخصص والسنة الدراسية", "Major and study year"],
  whatsapp: ["رقم الواتساب", "WhatsApp number"],
  email: ["البريد الجامعي", "University email"],
  why: ["سبب الانضمام", "Why you want to join"],
  contribution: ["المساهمة", "Contribution"],
  skills: ["المهارات", "Skills"],
  roles: ["مجال العمل", "Preferred areas"],
  experience: ["الخبرة", "Experience"],
  leadership: ["القيادة", "Leadership"],
  commitment: ["الالتزام", "Commitment"],
  hours: ["الساعات الأسبوعية", "Weekly hours"],
  lateTask: ["التأخر عن التسليم", "Late task"],
  outsidePreference: ["المهمة خارج التفضيل", "Outside preferred area"],
  eventIdea: ["فكرة الفعالية", "Event idea"],
  workshopPrep: ["الاستعداد للورشة", "Workshop preparation"],
  initiative: ["المبادرة", "Initiative"],
  teamIssue: ["التعامل مع العضو غير الملتزم", "Team issue"],
  eventChange: ["التغيير المفاجئ", "Unexpected change"],
};

/** Which payload fields a question feeds: the study picker sets two. */
const fieldsOf = (q: Question) => (q.kind === "study" ? ["major", "studyYear"] : [q.name]);
/** What to tell the applicant when a field fails the same rules the sheet enforces. */
const hints: Record<string, Pair> = {
  fullName: ["اكتب الاسم من حرفين إلى 200 حرف.", "Enter your name (2 to 200 characters)."],
  studentId: ["الرقم الجامعي 9 أرقام بالضبط.", "The student ID is exactly 9 digits."],
  whatsapp: ["رمز الدولة ثم من 8 إلى 16 رقمًا.", "Country code, then 8 to 16 digits."],
  email: ["استخدم بريدك الجامعي smail.ucas.edu.ps.", "Use your smail.ucas.edu.ps university email."],
  portfolio: ["يجب أن يبدأ الرابط بـ https://", "The link must start with https://"],
};
const answerHint: Pair = ["اكتب 10 أحرف على الأقل.", "Write at least 10 characters."];

const icons: Record<string, LucideIcon> = { activities: Zap, media: Clapperboard, relations: Handshake };
const chooseTitle: Pair = ["أي لجنة تريد الانضمام إليها؟", "Which committee do you want to join?"];

/**
 * Join wizard: pick a committee first, then the same core questions for everyone, then that
 * committee's own questions. Flip between committees any time; each keeps its answers.
 * Saves to the Google Sheet through the Apps Script `apply` action.
 */
export function CommitteeForm() {
  const { lang } = useClub();
  const ar = lang === "ar";
  const t = ([a, en]: Pair) => (ar ? a : en);
  const [cid, setCid] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [study, setStudy] = useState({ major: "", year: "" });
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [dial, setDial] = useState("+970");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // Same request id on every retry, so a flaky connection cannot create two rows.
  const requestId = useRef<string | undefined>(undefined);
  const registration = useRegistration();

  const committee = committees.find((c) => c.id === cid);
  const panelsOf = (c: (typeof committees)[number]): Panel[] =>
    c.steps.map((s, i) => ({ id: `${c.id}:${i}`, scope: c.id, ...s }));
  // Flow for the current choice; before a choice the length is only used to size the progress bar.
  const flow: Panel[] = [
    { id: "choose", title: chooseTitle, questions: [], scope: "" },
    { id: "about", scope: "", ...aboutStep },
    ...panelsOf(committee ?? committees[0]!),
  ];
  const current = flow[step]!;
  const last = step === flow.length - 1;
  const Forward = ar ? ArrowLeft : ArrowRight;
  const Back = ar ? ArrowRight : ArrowLeft;
  const progress: Pair = [
    `الخطوة ${step + 1} من ${flow.length}`,
    `Step ${step + 1} of ${flow.length}`,
  ];
  const key = (q: Question, scope: string) => (scope ? `${scope}:${q.name}` : q.name);

  function go(to: number) {
    setError("");
    setStep(to);
    requestAnimationFrame(() => {
      heading.current?.focus();
      form.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  /** The payload exactly as the sheet receives it, from whatever has been answered so far. */
  function collect(el: HTMLFormElement): Values {
    const values: Values = {
      committee: committee!.id,
      portfolio: "",
      leadership: "",
      experience: "",
      major: study.major,
      studyYear: study.year,
    };
    // SAFETY: no file inputs, so every entry is a string.
    for (const [k, v] of new FormData(el) as unknown as Iterable<[string, string]>) {
      const [scope, name] = k.includes("__") ? k.split("__") : ["", k];
      if (!scope || scope === cid) values[name!] = v;
    }
    values["whatsapp"] = dial + String(values["whatsapp"] ?? "").replace(/^0+/, "");
    for (const [k, v] of Object.entries(picked))
      if (k.startsWith(`${cid}:`)) values[k.slice(cid!.length + 1)] = v;
    // The sheet is read in Arabic, so send the Arabic role names.
    const labels = new Map(
      committee!.steps.flatMap((x) =>
        x.questions.flatMap((q) =>
          q.kind === "chips" ? q.options.map((o) => [o[0], o[1]] as const) : [],
        ),
      ),
    );
    values["roles"] = ((values["roles"] as string[] | undefined) ?? []).map(
      (r) => labels.get(r) ?? r,
    );
    return values;
  }

  /** Native validation for this step's fields only; every panel stays mounted so Back keeps answers. */
  function stepValid() {
    setError("");
    if (!committee) {
      setError(t(["اختر لجنة للمتابعة.", "Choose a committee to continue."]));
      return false;
    }
    const inputs = form.current?.querySelectorAll<HTMLInputElement>(
      `[data-step="${current.id}"] :is(input,textarea)`,
    );
    for (const el of inputs ?? []) if (!el.reportValidity()) return false;
    for (const q of current.questions) {
      if (q.showWhen && answers[`${current.scope}:${q.showWhen[0]}`] !== q.showWhen[1]) continue;
      if (q.optional) continue;
      if (q.kind === "chips" && !picked[key(q, current.scope)]?.length) {
        setError(t(["اختر خياراً واحداً على الأقل.", "Pick at least one option."]));
        return false;
      }
      if (q.kind === "check" && !checked[key(q, current.scope)]) {
        setError(t(["أكملي الحقول المطلوبة.", "Complete the required fields."]));
        return false;
      }
      if (q.kind === "radio" && !answers[key(q, current.scope)]) {
        setError(t(["اختر إجابة للمتابعة.", "Choose an answer to continue."]));
        return false;
      }
      if (q.kind === "study" && (!study.major || !study.year)) {
        setError(t(["اختر التخصص والسنة الدراسية للمتابعة.", "Select your major and study year to continue."]));
        return false;
      }
    }
    return schemaValid();
  }

  /**
   * Hold the applicant on this step until its answers pass the sheet's own rules (the same
   * schema `submitApplication` parses), so a wrong answer is caught where it is typed.
   */
  function schemaValid() {
    const values = collect(form.current!);
    // Later steps are still empty; a missing required field would stop the schema before it checks answers.
    const roles = values["roles"] as string[];
    const result = applicationSchema.safeParse({ ...values, roles: roles.length ? roles : ["-"] });
    if (result.success) return true;
    const wanted = new Set(
      current.questions
        .filter((q) => !q.showWhen || answers[`${current.scope}:${q.showWhen[0]}`] === q.showWhen[1])
        .flatMap(fieldsOf),
    );
    const bad = [...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? "")))].filter(
      (name) => wanted.has(name),
    );
    if (!bad.length) return true;
    const field = (name: string) =>
      form.current!.querySelector<HTMLInputElement>(
        `[data-step="${current.id}"] [name="${current.scope ? `${current.scope}__` : ""}${name}"]`,
      );
    const input = bad.map(field).find(Boolean);
    if (input) {
      // The browser's own bubble points at the field and names the rule.
      input.setCustomValidity(t(hints[bad[0]!] ?? answerHint));
      input.reportValidity();
      input.addEventListener("input", () => input.setCustomValidity(""), { once: true });
    } else {
      const names = bad.map((name) => fieldLabels[name]?.[ar ? 0 : 1] ?? name);
      setError(ar ? `تحقق من: ${names.join("، ")}.` : `Check: ${names.join(", ")}.`);
    }
    return false;
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!stepValid()) return;
    if (!last) return go(step + 1);
    setBusy(true);
    try {
      const values = collect(e.currentTarget);
      requestId.current ??= crypto.randomUUID();
      await submitApplication(values, requestId.current);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ZodError
          ? (() => {
              const names = [...new Set(err.issues.map((issue) => String(issue.path[0] ?? "")))]
                .map((name) => fieldLabels[name]?.[ar ? 0 : 1] ?? name)
                .filter(Boolean);
              return ar
                ? `تحققي من: ${names.join("، ") || "الحقول المطلوبة"}.`
                : `Check: ${names.join(", ") || "the required fields"}.`;
            })()
          : submissionError(err, ar),
      );
      if (err instanceof Error && err.message === "JOIN_CLOSED") registration.markClosed();
    } finally {
      setBusy(false);
    }
  }

  const optionalTag = (
    <span className="ms-2 font-normal text-muted-foreground">{t(["(اختياري)", "(optional)"])}</span>
  );

  function render(q: Question, scope: string) {
    const k = key(q, scope);
    const inputName = scope ? `${scope}__${q.name}` : q.name;
    if (q.showWhen && answers[`${scope}:${q.showWhen[0]}`] !== q.showWhen[1]) return null;
    if (q.kind === "study")
      return (
        <fieldset key={k} className="sm:col-span-2">
          <legend className="mb-2 text-sm font-bold">{t(q.label)}</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">
              <span className="mb-1.5 block">{t(["التخصص", "Major"])}</span>
              <Select name="major" value={study.major} onValueChange={(major) => setStudy((prev) => ({ ...prev, major }))} required>
                <SelectTrigger aria-label={t(["التخصص", "Major"])}><SelectValue placeholder={t(["اختر التخصص", "Select major"])} /></SelectTrigger>
                <SelectContent>
                  {majors.map((major) => <SelectItem key={major} value={major}>{ar ? major : majorEnglishLabels[major]}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className="text-sm font-medium">
              <span className="mb-1.5 block">{t(["السنة الدراسية", "Study year"])}</span>
              <Select name="studyYear" value={study.year} onValueChange={(year) => setStudy((prev) => ({ ...prev, year }))} required>
                <SelectTrigger aria-label={t(["السنة الدراسية", "Study year"])}><SelectValue placeholder={t(["اختر السنة", "Select year"])} /></SelectTrigger>
                <SelectContent>
                  {[["1", "السنة الأولى", "First year"], ["2", "السنة الثانية", "Second year"], ["3", "السنة الثالثة", "Third year"], ["4", "السنة الرابعة", "Fourth year"]].map(([value, arLabel, enLabel]) => <SelectItem key={value} value={value!}>{t([arLabel!, enLabel!])}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
          </div>
        </fieldset>
      );
    if (q.kind === "chips") {
      const on = picked[k] ?? [];
      return (
        <div key={k} className="sm:col-span-2">
          <p className="mb-3 text-sm font-bold">{t(q.label)}</p>
          <div role="group" className="flex flex-wrap gap-2">
            {q.options.map(([opt, a, en]) => (
              <button
                key={opt}
                type="button"
                aria-pressed={on.includes(opt)}
                onClick={() =>
                  setPicked((p) => {
                    const now = p[k] ?? [];
                    return { ...p, [k]: now.includes(opt) ? now.filter((x) => x !== opt) : [...now, opt] };
                  })
                }
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on.includes(opt)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary/50",
                )}
              >
                {t([a, en])}
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (q.kind === "check")
      return (
        <label
          key={k}
          className="flex items-start gap-3 rounded-2xl bg-muted/50 p-4 text-sm font-bold sm:col-span-2"
        >
          <Checkbox
            checked={!!checked[k]}
            onCheckedChange={(v) => setChecked((c) => ({ ...c, [k]: v === true }))}
            className="mt-0.5"
          />
          {t(q.label)}
        </label>
      );
    if (q.kind === "radio")
      return (
        <fieldset key={k} className="sm:col-span-2">
          <legend className="mb-3 text-sm font-bold">{t(q.label)}</legend>
          <input type="hidden" name={inputName} value={answers[k] ?? ""} required />
          <div role="radiogroup" aria-label={t(q.label)} className="flex flex-wrap gap-2">
            {q.options.map(([value, arLabel, enLabel]) => (
              <button key={value} type="button" role="radio" aria-checked={answers[k] === value}
                onClick={() => setAnswers((prev) => ({ ...prev, [k]: value }))}
                className={cn("rounded-full border px-4 py-2 text-sm font-bold", answers[k] === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/50")}
              >{t([arLabel, enLabel])}</button>
            ))}
          </div>
        </fieldset>
      );
    if (q.kind === "phone")
      return (
        <div key={k} className="sm:col-span-2">
          <label htmlFor={inputName} className="mb-2 block text-sm font-bold">
            {t(q.label)}
          </label>
          <div dir="ltr" className="flex gap-2">
            <DialCodeSelect value={dial} onChange={setDial} ar={ar} />
            <Input
              id={inputName}
              name={inputName}
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              required
              pattern="[0-9]{6,12}"
              maxLength={12}
              placeholder={dial === "+970" ? "59XXXXXXX" : ""}
              title={t(["أرقام فقط بدون رمز الدولة", "Digits only, without the country code"])}
              onInput={(e) => (e.currentTarget.value = e.currentTarget.value.replace(/\D/g, ""))}
            />
          </div>
        </div>
      );
    return (
      <label key={k} className="block text-sm font-bold sm:col-span-2">
        <span className="mb-2 block">
          {t(q.label)}
          {q.optional && optionalTag}
        </span>
        {q.kind === "area" ? (
          <Textarea
            name={inputName}
            required={!q.optional}
            placeholder={q.hint}
            maxLength={1000}
            rows={q.rows ?? 4}
            className="resize-y leading-7"
          />
        ) : (
          <Input
            name={inputName}
            required={!q.optional}
            placeholder={q.hint}
            {...q.props}
            // People paste "github.com/name"; add the scheme so the link is accepted.
            onBlur={
              q.props?.["type"] === "url"
                ? (e) => {
                    const v = e.currentTarget.value.trim();
                    if (v && !/^[a-z][a-z0-9+.-]*:/i.test(v)) e.currentTarget.value = `https://${v}`;
                  }
                : undefined
            }
          />
        )}
      </label>
    );
  }

  const card =
    "mx-auto mt-6 max-w-3xl scroll-mt-24 rounded-[2rem] border border-border bg-card shadow-card sm:mt-8";

  if (done)
    return (
      <div className={cn(card, "p-10 text-center sm:p-14")}>
        <h2 role="status" className="text-2xl font-extrabold text-primary">
          {t(["وصل طلبك. شكراً لك!", "Application received. Thank you!"])}
        </h2>
        <p className="mt-3 text-muted-foreground">
          {ar
            ? `سنراجع طلبك للانضمام إلى لجنة ${committee!.name[0]} ونراسلك على الواتساب أو البريد.`
            : `We'll review your application to the ${committee!.name[1]} committee and contact you by WhatsApp or email.`}
        </p>
      </div>
    );

  if (registration.open !== true)
    return (
      <p role="status" className={cn(card, "p-8 text-center font-bold text-primary")}>
        {registration.failed
          ? t([
              "استقبال الطلبات غير متاح حالياً. حاول لاحقاً.",
              "Applications are currently unavailable. Please try later.",
            ])
          : registration.loading
            ? t(["جارٍ التحقق من استقبال الطلبات…", "Checking registration availability…"])
            : t(["تم وقف استقبال الأعضاء الجدد", "New membership applications are closed."])}
      </p>
    );

  const panels: Panel[] = [
    { id: "about", scope: "", ...aboutStep },
    ...committees.flatMap(panelsOf),
  ];
  const panelClass =
    "grid gap-5 sm:grid-cols-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2";

  return (
    <form
      ref={form}
      noValidate
      onSubmit={submit}
      aria-busy={busy}
      className={cn(card, "p-5 pt-8 sm:p-8 sm:pt-10")}
    >
      <header className="mb-6">
        <p className="text-sm font-bold text-muted-foreground">
          {committee && step > 0
            ? ar
              ? `لجنة ${committee.name[0]}`
              : `${committee.name[1]} committee`
            : t(["الانضمام إلى النادي", "Join the club"])}
        </p>
        <h2 ref={heading} tabIndex={-1} className="mt-2 text-3xl font-extrabold outline-none">
          {t(current.title)}
        </h2>
        {step > 0 && <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={flow.length}
          aria-valuenow={step + 1}
          aria-label={t(progress)}
          className="mt-5 flex gap-2"
        >
          {flow.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-300",
                i <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>}
        {step > 0 && <p className="mt-2 text-xs text-muted-foreground">{t(progress)}</p>}
        {step > 1 && <p className="mt-1 text-xs text-muted-foreground">اكتب إجاباتك بالعربية.</p>}
      </header>

      <div data-step="choose" hidden={step !== 0} className={panelClass}>
        <div
          role="radiogroup"
          aria-label={t(chooseTitle)}
          className="flex flex-wrap justify-center gap-4 sm:col-span-2"
        >
          {committees.map((c) => {
            const Icon = icons[c.id] ?? Handshake;
            const on = c.id === cid;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setCid(c.id);
                  setError("");
                }}
                className={cn(
                  "relative flex min-w-[11.5rem] max-w-[14rem] flex-1 basis-[11.5rem] flex-col items-center gap-3 rounded-2xl border-2 p-5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover-gradient-outline",
                )}
              >
                <span className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="size-6" aria-hidden />
                </span>
                <span className="text-xl font-extrabold">{t(c.name)}</span>
                <span className="text-sm text-muted-foreground">{t(c.blurb)}</span>
                <span
                  aria-hidden
                  className={cn(
                    "absolute end-4 top-4 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity",
                    on ? "opacity-100" : "opacity-0",
                  )}
                >
                  <Check className="size-4" />
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-center text-sm text-muted-foreground sm:col-span-2">
          {t([
            "تستطيع الرجوع وتغيير اللجنة في أي وقت.",
            "You can come back and switch committee any time.",
          ])}
        </p>
      </div>

      {panels.map((p) => (
        <div key={p.id} data-step={p.id} hidden={current.id !== p.id} className={panelClass}>
          {p.questions.map((q) => render(q, p.scope))}
        </div>
      ))}

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4 text-primary"
        >
          {error}
        </p>
      )}

      <aside className="mt-6 rounded-2xl bg-muted/60 p-4 text-sm leading-7 text-muted-foreground sm:col-span-2">
        {t([
          "طبيعة العمل التطوعي: العمل ضمن لجنة الأنشطة هو عمل تطوعي لا يُقدَّم مقابل أجر مادي، بل يقوم على التعاون والعطاء وتحمل المسؤولية، والمساهمة في تطوير البيئة الجامعية وتقديم أنشطة نافعة للطلاب.",
          "Volunteer work: Activities Committee work is unpaid. It is based on cooperation, giving, responsibility, and contributing to a better university environment through useful activities for students.",
        ])}
      </aside>

      <div className="mt-8 flex items-center justify-between gap-3">
        {step > 0 ? (
          <BrandButton type="button" variant="ghost" onClick={() => go(step - 1)}>
            <Back className="size-4" aria-hidden /> {t(["السابق", "Back"])}
          </BrandButton>
        ) : (
          <span />
        )}
        <BrandButton type="submit" disabled={busy}>
          {last
            ? busy
              ? t(["جارٍ الإرسال…", "Sending…"])
              : t(["إرسال الطلب", "Submit"])
            : t(["التالي", "Next"])}
          {!last && <Forward className="size-4" aria-hidden />}
        </BrandButton>
      </div>
    </form>
  );
}
