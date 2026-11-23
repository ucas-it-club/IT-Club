import { useQuery } from "@tanstack/react-query";
import { loadFeedback } from "@/lib/club/supabase";
import { feedbackKinds, feedbackStatuses } from "@/lib/club/feedback";

/** Read-only list of Site Feedback for super admins and editors. */
export function FeedbackWorkspace({ ar }: { ar: boolean }) {
  const t = ([a, e]: readonly [string, string]) => (ar ? a : e);
  const { data, error, isPending } = useQuery({
    queryKey: ["club-feedback"],
    queryFn: loadFeedback,
  });
  const fresh = data?.filter((item) => item.status === "new").length ?? 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-bold">{t(["ملاحظات على الموقع", "Site feedback"])}</h2>
        {data && (
          <p className="text-sm font-bold text-primary">
            {t(["جديدة: ", "New: "])}
            {fresh}
          </p>
        )}
      </div>
      {isPending && <p role="status">{t(["جارٍ التحميل…", "Loading…"])}</p>}
      {error && (
        <p role="alert" className="text-primary">
          {t([
            "تعذر تحميل الملاحظات. تحقق من الصلاحية والاتصال.",
            "Could not load feedback. Check access and connection.",
          ])}
        </p>
      )}
      {data?.length === 0 && (
        <p className="text-muted-foreground">{t(["لا توجد ملاحظات بعد.", "No feedback yet."])}</p>
      )}
      <ul className="space-y-3">
        {data?.map((item) => (
          <li key={item.id} className="rounded-2xl border border-border p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-secondary px-3 py-0.5 font-bold">
                {t(feedbackKinds[item.kind])}
              </span>
              <span
                className={`rounded-full px-3 py-0.5 ${item.status === "new" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {t(feedbackStatuses[item.status])}
              </span>
              <time dateTime={item.created_at} className="text-muted-foreground">
                {new Date(item.created_at).toLocaleString(ar ? "ar" : "en-GB")}
              </time>
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words leading-7" dir="auto">
              {item.message}
            </p>
            <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-[auto_1fr]">
              {(
                [
                  [["الاسم", "Name"], item.name],
                  [["للرد", "Reply to"], item.contact],
                  [["الصفحة", "Page"], item.page],
                  [
                    ["اللغة والوضع", "Language and theme"],
                    [item.lang, item.theme].filter(Boolean).join(" · "),
                  ],
                  [["الجهاز", "Device"], item.device],
                ] as const
              )
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label[1]} className="contents">
                    <dt className="font-bold">{t(label)}</dt>
                    <dd className="break-all" dir="auto">
                      {value}
                    </dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
