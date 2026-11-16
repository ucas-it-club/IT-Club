import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ContentEditor } from "../AdminPanel";
import { useClub, clubPublicKey } from "../club-context";
import { BrandButton } from "../BrandButton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { loadNews, signOut, watchQuery } from "@/lib/club/supabase";
import { matchesArticleSearch } from "@/lib/club/admin-search";
import type { Content } from "@/lib/club/model";

export function NewsWorkspace({ standalone = false }: { standalone?: boolean }) {
  const { lang } = useClub();
  const ar = lang === "ar";
  const queryClient = useQueryClient();
  const [items, setItems] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<Content | null>();
  const [dirty, setDirty] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(
    () =>
      watchQuery(
        loadNews,
        (rows) => {
          setItems(rows);
          setLoading(false);
          setError(false);
        },
        () => {
          setError(true);
          setLoading(false);
        },
      ),
    [retry],
  );
  const onDirty = useCallback((value: boolean) => setDirty(value), []);
  const discard = () =>
    !dirty || window.confirm(ar ? "تجاهل التعديلات غير المحفوظة؟" : "Discard unsaved changes?");
  const visible = items.filter(
    (item) =>
      matchesArticleSearch(item, search) && (filter === "all" || item.publicationStatus === filter),
  );
  return (
    <section
      className="flex flex-col gap-5"
      aria-label={ar ? "لوحة لجنة الإعلام" : "Media committee workspace"}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">{ar ? "لوحة لجنة الإعلام" : "Media committee"}</h1>
          <p className="text-muted-foreground">
            {ar
              ? "إدارة الأخبار من المسودة حتى النشر، بصلاحيات لجنة الإعلام."
              : "Manage news from draft to publication."}
          </p>
        </div>
        {standalone && (
          <BrandButton
            variant="outline"
            onClick={() => {
              if (discard()) void signOut();
            }}
          >
            {ar ? "تسجيل الخروج" : "Sign out"}
          </BrandButton>
        )}
      </div>
      {notice && <p role="status">{notice}</p>}
      {editing !== undefined ? (
        <ContentEditor
          key={editing?.id || "new-news"}
          kind="news"
          item={editing}
          onDirtyChange={onDirty}
          onCancel={() => {
            if (discard()) {
              setEditing(undefined);
              setDirty(false);
            }
          }}
          onSaved={() => {
            setEditing(undefined);
            setDirty(false);
            setNotice(
              ar
                ? "تم حفظ الخبر بحالة النشر المحددة."
                : "News saved with the selected publication status.",
            );
            void queryClient.invalidateQueries({ queryKey: clubPublicKey });
          }}
        />
      ) : (
        <>
          {loading ? (
            <div role="status" aria-label={ar ? "جارٍ تحميل الأخبار" : "Loading news"}>
              <Skeleton className="h-24 w-full" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>
                {ar ? "تعذر تحميل الأخبار. أعد المحاولة." : "Could not load news. Please retry."}
                <BrandButton variant="outline" onClick={() => setRetry((n) => n + 1)}>
                  {ar ? "إعادة المحاولة" : "Retry"}
                </BrandButton>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                <Badge variant="secondary">
                  {ar ? "مسودات" : "Drafts"}:{" "}
                  {items.filter((i) => i.publicationStatus === "draft").length}
                </Badge>
                <Badge variant="secondary">
                  {ar ? "منشورة" : "Published"}:{" "}
                  {items.filter((i) => i.publicationStatus === "published").length}
                </Badge>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex-1">
                  <span>{ar ? "البحث في الأخبار" : "Search news"}</span>
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} />
                </label>
                <label>
                  <span>{ar ? "الحالة" : "Status"}</span>
                  <select
                    className="block rounded-md border border-input bg-background p-2"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">{ar ? "الكل" : "All"}</option>
                    <option value="draft">{ar ? "مسودة" : "Draft"}</option>
                    <option value="published">{ar ? "منشور" : "Published"}</option>
                  </select>
                </label>
                <BrandButton
                  onClick={() => {
                    setNotice("");
                    setEditing(null);
                  }}
                >
                  {ar ? "إضافة خبر" : "Add news"}
                </BrandButton>
              </div>
              {visible.length === 0 && (
                <p role="status">
                  {ar
                    ? "لا توجد أخبار مطابقة. يمكنك إضافة مسودة جديدة."
                    : "No matching news. You can add a new draft."}
                </p>
              )}
              <div className="flex flex-col gap-3">
                {visible.map((item) => (
                  <article
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-5"
                  >
                    <div>
                      <h2 className="font-bold">{ar ? item.title : item.title_en}</h2>
                      <Badge variant="outline">
                        {item.publicationStatus === "published"
                          ? ar
                            ? "منشور"
                            : "Published"
                          : ar
                            ? "مسودة"
                            : "Draft"}
                      </Badge>
                    </div>
                    <BrandButton variant="outline" onClick={() => setEditing(item)}>
                      {ar ? "تحرير ومعاينة" : "Edit and preview"}
                    </BrandButton>
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
