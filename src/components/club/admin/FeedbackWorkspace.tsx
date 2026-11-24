import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { BrandButton } from "../BrandButton";
import { DeleteButton } from "./DeleteButton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteFeedback, loadFeedback, updateFeedback } from "@/lib/club/supabase";
import {
  feedbackKinds,
  feedbackStatuses,
  filterFeedback,
  isGithubIssueUrl,
  type Feedback,
  type FeedbackKind,
  type FeedbackStatus,
} from "@/lib/club/feedback";

const feedbackKey = ["club-feedback"];
const all: [string, string] = ["الكل", "All"];

/** Site Feedback for super admins and editors: filter, set status, link a ticket, delete. */
export function FeedbackWorkspace({ ar }: { ar: boolean }) {
  const t = ([a, e]: readonly [string, string]) => (ar ? a : e);
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<FeedbackKind | "all">("all");
  const [status, setStatus] = useState<FeedbackStatus | "all">("all");
  const [failure, setFailure] = useState("");
  const { data, error, isPending } = useQuery({
    queryKey: feedbackKey,
    queryFn: loadFeedback,
  });
  const fresh = data?.filter((item) => item.status === "new").length ?? 0;
  const shown = data ? filterFeedback(data, kind, status) : undefined;

  async function run(action: () => Promise<void>) {
    setFailure("");
    try {
      await action();
    } catch {
      setFailure(
        t([
          "تعذر حفظ التغيير. تحقق من الصلاحية والاتصال.",
          "Could not save the change. Check access and connection.",
        ]),
      );
    } finally {
      await queryClient.invalidateQueries({ queryKey: feedbackKey });
    }
  }

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
      <div className="flex flex-wrap gap-3">
        <FilterSelect
          label={t(["النوع", "Kind"])}
          value={kind}
          onChange={setKind}
          options={feedbackKinds}
          t={t}
          ar={ar}
        />
        <FilterSelect
          label={t(["الحالة", "Status"])}
          value={status}
          onChange={setStatus}
          options={feedbackStatuses}
          t={t}
          ar={ar}
        />
      </div>
      {failure && (
        <p role="alert" className="text-primary">
          {failure}
        </p>
      )}
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
      {data && data.length > 0 && shown?.length === 0 && (
        <p className="text-muted-foreground">
          {t(["لا توجد ملاحظات بهذا التصفية.", "No feedback matches these filters."])}
        </p>
      )}
      <ul className="space-y-3">
        {shown?.map((item) => (
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
            <FeedbackActions item={item} ar={ar} t={t} run={run} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  t,
  ar,
}: {
  label: string;
  value: T | "all";
  onChange: (value: T | "all") => void;
  options: Record<T, [string, string]>;
  t: (pair: readonly [string, string]) => string;
  ar: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm font-bold">
      <span>{label}</span>
      <Select value={value} onValueChange={(next) => onChange(next as T | "all")}>
        <SelectTrigger className="w-44" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent dir={ar ? "rtl" : "ltr"}>
          <SelectItem value="all">{t(all)}</SelectItem>
          {(Object.keys(options) as T[]).map((key) => (
            <SelectItem key={key} value={key}>
              {t(options[key])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function FeedbackActions({
  item,
  ar,
  t,
  run,
}: {
  item: Feedback;
  ar: boolean;
  t: (pair: readonly [string, string]) => string;
  run: (action: () => Promise<void>) => Promise<void>;
}) {
  const [link, setLink] = useState(item.issue_url ?? "");
  const clean = link.trim();
  const linkInvalid = clean !== "" && !isGithubIssueUrl(clean);
  const statusLabel = t(["حالة الملاحظة", "Feedback status"]);
  const linkLabel = t(["رابط تذكرة GitHub", "GitHub issue link"]);

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-3">
      {item.issue_url && (
        <a
          href={item.issue_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-bold text-primary underline"
          dir="ltr"
        >
          <ExternalLink size={14} aria-hidden />
          {item.issue_url.replace("https://github.com/", "")}
        </a>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <Select
          value={item.status}
          onValueChange={(next) =>
            void run(() => updateFeedback(item.id, { status: next as FeedbackStatus }))
          }
        >
          <SelectTrigger className="w-36" aria-label={statusLabel}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent dir={ar ? "rtl" : "ltr"}>
            {(Object.keys(feedbackStatuses) as FeedbackStatus[]).map((key) => (
              <SelectItem key={key} value={key}>
                {t(feedbackStatuses[key])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <form
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (linkInvalid) return;
            // Saving a link marks the item Done; clearing it keeps the current status.
            void run(() =>
              updateFeedback(item.id, {
                issue_url: clean || null,
                status: clean ? "done" : item.status,
              }),
            );
          }}
        >
          <Input
            type="url"
            dir="ltr"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://github.com/ucas-it-club/IT-Club/issues/1"
            aria-label={linkLabel}
            aria-invalid={linkInvalid}
            className="min-w-0 flex-1 basis-64"
          />
          <BrandButton
            type="submit"
            size="sm"
            variant="outline"
            disabled={linkInvalid || clean === (item.issue_url ?? "")}
          >
            {t(["حفظ الرابط", "Save link"])}
          </BrandButton>
        </form>
        <DeleteButton
          label={t(["حذف الملاحظة", "Delete feedback"])}
          onDelete={() => run(() => deleteFeedback(item.id))}
        />
      </div>
      {linkInvalid && (
        <p className="text-xs text-primary">
          {t([
            "أدخل رابط تذكرة GitHub بالشكل https://github.com/owner/repo/issues/123",
            "Enter a GitHub issue link like https://github.com/owner/repo/issues/123",
          ])}
        </p>
      )}
    </div>
  );
}
