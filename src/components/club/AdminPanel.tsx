import { cn } from "@/lib/utils";
import { RegistrationAdmin } from "./RegistrationAdmin";
import { EventRegistrationAdmin } from "./EventRegistrationAdmin";
import { ContentCard } from "./ClubContent";
import { EventDetail } from "./EventDetail";
import { NewsDetail } from "./NewsDetail";
import { ensureEventSheet, sheetLinks } from "@/lib/club/sheets";
import { MediaLibrary } from "./MediaLibrary";
import { RichTextEditor } from "./RichTextEditor";
import { ImageCropper } from "./ImageCropper";
import { DeleteButton } from "./admin/DeleteButton";
import { SettingsEditor } from "./admin/SettingsEditor";
import { AdminUsersEditor } from "./admin/AdminUsersEditor";
import { NewsWorkspace } from "./admin/NewsWorkspace";
import { canManageNews } from "@/lib/club/admin-access";
import {
  loadAdminDateOrder,
  sortAdminContentByDate,
  storeAdminDateOrder,
} from "./admin/content-order";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useClub, clubPublicKey } from "./club-context";
import {
  configured,
  observeAuth,
  signIn,
  signOut,
  loadRole,
  watchQuery,
  saveContent,
  removeContent,
  uploadImage,
  saveSettings,
  setTeamVisibility,
} from "@/lib/club/supabase";
import { loadPublic } from "@/lib/club/public-api";
import { matchesArticleSearch, normalizeAdminSearch } from "@/lib/club/admin-search";
import { googleDriveImageUrl } from "@/lib/club/google-drive";
import {
  collections,
  labels,
  committees,
  contentSchema,
  defaultEventRegistration,
  eventDetailsSchema,
  safeUrl,
  type Content,
  type ContentCollection,
} from "@/lib/club/model";
import { BrandButton } from "@/components/club/BrandButton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import {
  Plus,
  LogOut,
  Pencil,
  Upload,
  Users,
  CalendarDays,
  Newspaper,
  Handshake,
  Eye,
  EyeOff,
} from "lucide-react";

const blank: Omit<Content, "id"> = { title: "", title_en: "", description: "", description_en: "" };

export function AdminPanel() {
  const queryClient = useQueryClient();
  const { lang, setupRequired } = useClub();
  const ar = lang === "ar";
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState("");
  const [checking, setChecking] = useState(configured);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!configured) return;
    let stopRole = () => {};
    let currentUserId: string | null | undefined;

    const stopAuth = observeAuth((current) => {
      if (currentUserId === (current?.id ?? null)) return;
      currentUserId = current?.id ?? null;
      queryClient.removeQueries({ queryKey: ["club-media"] });
      stopRole();
      setUser(current);
      setRole("");

      if (!current) {
        setChecking(false);

        return;
      }

      setChecking(true);
      stopRole = watchQuery(
        () => loadRole(current.id),
        (value) => {
          setRole(value);
          setChecking(false);
        },
        () => {
          setRole("");
          setChecking(false);
        },
        30000,
      );
    });

    return () => {
      stopAuth();
      stopRole();
    };
  }, [queryClient]);

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const values = new FormData(e.currentTarget);

    try {
      await signIn(String(values.get("email")), String(values.get("password")));
    } catch {
      setError(
        ar
          ? "تعذر تسجيل الدخول. تحقق من بياناتك وحاول مجددًا."
          : "Sign-in failed. Check your details and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (setupRequired)
    return (
      <div className="rounded-3xl border border-border bg-card p-8">
        <h1 className="text-2xl font-black">
          {ar ? "تفعيل قاعدة بيانات النادي" : "Set up the club database"}
        </h1>
        <p className="mt-4">
          {ar
            ? "اتصال Supabase جاهز. شغّلي ملف إعداد قاعدة البيانات في SQL Editor، ثم أنشئي حساب المدير وفعّلي صلاحيته."
            : "Supabase is connected. Run the database setup SQL, then create and authorize the administrator account."}
        </p>
      </div>
    );

  if (!configured)
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-8">
        <h1 className="text-3xl font-black">{ar ? "لوحة الإدارة" : "Administration"}</h1>
        <p className="mt-4 text-muted-foreground">
          {ar
            ? "لوحة الإدارة غير متاحة حتى إتمام إعداد الخدمة."
            : "Administration is unavailable until service setup is complete."}
        </p>
      </div>
    );

  if (checking) return <p role="status">{ar ? "جارٍ التحقق من الصلاحيات…" : "Checking access…"}</p>;

  if (!user)
    return (
      <form
        onSubmit={login}
        className="mx-auto max-w-md space-y-5 rounded-3xl border border-border bg-card p-8 shadow-card"
      >
        <h1 className="text-3xl font-black">{ar ? "تسجيل دخول الإدارة" : "Admin sign-in"}</h1>
        <label className="block">
          <span className="mb-2 block">
            {ar ? "اسم المستخدم أو البريد الإلكتروني" : "Username or email"}
          </span>
          <Input name="email" type="text" autoComplete="username" dir="ltr" required />
        </label>
        <label className="block">
          <span className="mb-2 block">{ar ? "كلمة المرور" : "Password"}</span>
          <Input name="password" type="password" autoComplete="current-password" required />
        </label>
        {error && <p role="alert">{error}</p>}
        <BrandButton disabled={busy} type="submit">
          {busy ? (ar ? "جارٍ الدخول…" : "Signing in…") : ar ? "دخول" : "Sign in"}
        </BrandButton>
      </form>
    );

  if (!["editor", "super_admin", "media_editor", "partnerships_editor"].includes(role))
    return (
      <div>
        <p role="alert">
          {ar
            ? "هذا الحساب غير مخوّل بإدارة الموقع."
            : "This account does not have administrative access."}
        </p>
        <BrandButton className="mt-5" onClick={() => void signOut()}>
          {ar ? "تسجيل الخروج" : "Sign out"}
        </BrandButton>
      </div>
    );

  if (role === "media_editor") return <NewsWorkspace key={user.id} standalone />;
  return <AdminWorkspace key={user.id + role} role={role} user={user} />;
}

function AdminWorkspace({ role, user }: { role: string; user: User }) {
  const { lang, data, settings } = useClub();
  const ar = lang === "ar";
  const queryClient = useQueryClient();
  const partnershipsOnly = role === "partnerships_editor";

  async function deleteContent(kind: ContentCollection, id: string) {
    await removeContent(kind, id);
    queryClient.setQueryData<Awaited<ReturnType<typeof loadPublic>>>(
      clubPublicKey,
      (old) =>
        old && { ...old, data: { ...old.data, [kind]: old.data[kind].filter((c) => c.id !== id) } },
    );
  }

  const [tab, setTab] = useState(partnershipsOnly ? "partners" : "dashboard");
  const [memberSearch, setMemberSearch] = useState("");
  const [articleSearch, setArticleSearch] = useState({ events: "", news: "" });
  const memberItems = data.members
    .filter((item) =>
      [item.title, item.title_en].some((name) =>
        normalizeAdminSearch(name || "").includes(normalizeAdminSearch(memberSearch)),
      ),
    )
    .sort((a, b) => {
      const aBoard = Boolean(a.isFounder || a.committee === "administrative");
      const bBoard = Boolean(b.isFounder || b.committee === "administrative");
      if (aBoard !== bBoard) return aBoard ? -1 : 1;
      return aBoard ? (a.displayOrder ?? 10000) - (b.displayOrder ?? 10000) : 0;
    });
  // Admin-list ordering only: remembered in this browser, never sent to the
  // database, so it cannot change what the public site shows.
  const [dateOrder, setDateOrder] = useState({ events: false, news: false });
  useEffect(() => {
    setDateOrder(loadAdminDateOrder());
  }, []);
  const eventItems = sortAdminContentByDate(data.events, dateOrder.events).filter((item) =>
    matchesArticleSearch(item, articleSearch.events),
  );
  const newsItems = sortAdminContentByDate(data.news, dateOrder.news).filter((item) =>
    matchesArticleSearch(item, articleSearch.news),
  );

  // SAFETY: the ternary itself performs the ContentCollection membership check;
  // the cast only satisfies Array<ContentCollection>.includes's parameter type.
  const activeCollection = collections.includes(tab as ContentCollection)
    ? (tab as ContentCollection)
    : null;

  const [editing, setEditing] = useState<Content | null | undefined>(undefined);
  const [dirty, setDirty] = useState(false);
  const confirmDiscard = () =>
    !dirty ||
    window.confirm(
      ar
        ? "لديك تعديلات غير محفوظة. تجاهل التعديلات والمتابعة؟"
        : "You have unsaved changes. Discard them and continue?",
    );
  const [notice, setNotice] = useState("");
  const [teamVisibilityBusy, setTeamVisibilityBusy] = useState(false);
  const teamVisible = settings.teamVisible !== false;
  const adminLoadError = useCallback(
    () =>
      setNotice(
        ar
          ? "تعذر تحميل بيانات الإدارة. تحقق من إعداد Supabase."
          : "Could not load admin data. Check Supabase setup.",
      ),
    [ar],
  );

  async function run(action: () => Promise<void>) {
    setNotice("");

    try {
      await action();
      setNotice(ar ? "تم الحفظ بنجاح." : "Saved successfully.");
    } catch {
      setNotice(
        ar
          ? "لم يتم الحفظ. تحقق من الاتصال والصلاحيات وحاول مجددًا."
          : "Changes were not saved. Check your connection and access, then try again.",
      );
    }
  }

  const tabs = partnershipsOnly
    ? [
        ["partners", ar ? "الشراكات" : "Partnerships"],
        ["media", ar ? "صور الشراكات" : "Partnership media"],
      ]
    : [
        ["dashboard", ar ? "نظرة عامة" : "Overview"],
        ["media", ar ? "مكتبة الصور" : "Media library"],
        ...collections
          .filter((x) => x !== "news" || canManageNews(role))
          .map((x) => [x, labels[x][ar ? 0 : 1]]),
        ["joinRequests", ar ? "طلبات الانضمام" : "Applications"],
        ["contactMessages", ar ? "الرسائل" : "Messages"],
        ...(role === "super_admin"
          ? [
              ["settings", ar ? "إعدادات الموقع" : "Site settings"],
              ["admins", ar ? "المحررون" : "Editors"],
            ]
          : []),
      ];

  return (
    <>
      <div className="club-admin-banner mb-5 flex flex-wrap items-center justify-between gap-4 rounded-[2rem] bg-brand-gradient p-6 text-white sm:p-8">
        <div>
          <h1 className="text-3xl font-black">
            {partnershipsOnly
              ? ar
                ? "لوحة لجنة الشراكات"
                : "Partnerships committee"
              : ar
                ? "لوحة إدارة النادي"
                : "Club administration"}
          </h1>
          <p className="mt-2 break-all text-sm text-white/85">
            {user.email} ·{" "}
            {role === "super_admin"
              ? ar
                ? "مدير عام"
                : "Super admin"
              : partnershipsOnly
                ? ar
                  ? "لجنة الشراكات"
                  : "Partnerships committee"
                : ar
                  ? "محرر"
                  : "Editor"}
          </p>
        </div>
        <BrandButton
          variant="outline"
          className="border-white/30 bg-white/15 text-white hover:bg-white/25 hover:text-white"
          onClick={() => {
            if (!confirmDiscard()) return;
            void signOut();
          }}
        >
          <LogOut size={18} />
          {ar ? "خروج" : "Sign out"}
        </BrandButton>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {[
          { count: data.members.length, label: ar ? "أعضاء الفريق" : "Team members", Icon: Users },
          { count: data.events.length, label: ar ? "الفعاليات" : "Events", Icon: CalendarDays },
          { count: data.news.length, label: ar ? "الأخبار" : "News", Icon: Newspaper },
          { count: data.partners.length, label: ar ? "الشراكات" : "Partners", Icon: Handshake },
        ]
          .filter((item) => !partnershipsOnly || item.Icon === Handshake)
          .map(({ count, label, Icon }) => (
            <div key={label} className="rounded-3xl border border-border bg-card p-5 sm:p-6">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-primary">
                <Icon size={21} />
              </span>
              <strong className="block text-3xl font-black text-primary">{count}</strong>
              <span className="mt-1 block text-sm text-muted-foreground">{label}</span>
            </div>
          ))}
      </div>
      <nav
        aria-label={ar ? "أقسام الإدارة" : "Administration sections"}
        className="mb-5 flex flex-wrap gap-2"
      >
        {tabs.map(([key, label]) => (
          <BrandButton
            key={key}
            size="sm"
            variant={tab === key ? "primary" : "outline"}
            aria-pressed={tab === key}
            onClick={() => {
              if (!confirmDiscard()) return;
              setTab(key!);
              setEditing(undefined);
              setDirty(false);
              setNotice("");
            }}
          >
            {label}
          </BrandButton>
        ))}
      </nav>
      <div className="rounded-[2rem] border border-border bg-card p-4 sm:p-6">
        {activeCollection === "events" &&
          (() => {
            const kind = activeCollection;
            const isNews = false;
            const byDate = dateOrder[kind];
            return (
              <section
                aria-label={
                  isNews
                    ? ar
                      ? "ترتيب الأخبار"
                      : "News ordering"
                    : ar
                      ? "ترتيب الفعاليات"
                      : "Event ordering"
                }
                className="mb-6 rounded-2xl border border-border bg-card p-5"
              >
                <h2 className="mb-3 font-bold">
                  {isNews
                    ? ar
                      ? "ترتيب الأخبار في لوحة الإدارة"
                      : "News ordering in the admin panel"
                    : ar
                      ? "ترتيب الفعاليات في لوحة الإدارة"
                      : "Event ordering in the admin panel"}
                </h2>
                <div className="flex flex-wrap items-center gap-3">
                  <BrandButton
                    variant={byDate ? "primary" : "outline"}
                    className={cn("w-full sm:w-auto", byDate && "border-2 border-transparent")}
                    type="button"
                    role="switch"
                    aria-checked={byDate}
                    onClick={() => {
                      const enabled = !byDate;
                      setDateOrder((prev) => ({ ...prev, [kind]: enabled }));
                      storeAdminDateOrder(kind, enabled);
                    }}
                  >
                    {isNews
                      ? ar
                        ? "الترتيب حسب تاريخ الخبر"
                        : "Sort by news date"
                      : ar
                        ? "الترتيب حسب موعد الفعالية"
                        : "Sort by event date"}
                    <span className="min-w-16 rounded-full bg-background/20 px-2 py-0.5 text-center text-xs">
                      {byDate ? (ar ? "مفعّل" : "On") : ar ? "متوقف" : "Off"}
                    </span>
                  </BrandButton>
                  {data[kind].some((item) => !item.createdAt) && (
                    <p role="status" className="text-sm text-muted-foreground">
                      {ar
                        ? "يلزم تحديث قاعدة البيانات لحفظ تاريخ الإضافة؛ يُستخدم آخر تعديل مؤقتًا."
                        : "Apply the database migration to track creation dates; using last update temporarily."}
                    </p>
                  )}
                  <span className="min-h-5 basis-full text-sm text-muted-foreground sm:min-w-48 sm:basis-auto">
                    {byDate
                      ? isNews
                        ? ar
                          ? "تاريخ الخبر: الأحدث أولًا"
                          : "News date: newest first"
                        : ar
                          ? "موعد الفعالية: الأحدث أولًا"
                          : "Event date: newest first"
                      : ar
                        ? "تاريخ الإضافة: الأحدث أولًا"
                        : "Date added: newest first"}
                  </span>
                </div>
              </section>
            );
          })()}

        {notice && (
          <p role="status" className="mb-6 rounded-2xl bg-brand-gradient-soft p-4">
            {notice}
          </p>
        )}
        {tab === "media" && <MediaLibrary />}
        {tab === "dashboard" && (
          <div className="py-4">
            <h2 className="text-2xl font-black">{ar ? "نظرة عامة" : "Overview"}</h2>
            <p className="mt-3 text-muted-foreground">
              {ar
                ? "اختر أحد الأقسام أعلاه لإدارة محتوى النادي."
                : "Choose a section above to manage club content."}
            </p>
          </div>
        )}
        {activeCollection === "news" && canManageNews(role) && <NewsWorkspace />}
        {activeCollection &&
          activeCollection !== "news" &&
          (editing !== undefined ? (
            <ContentEditor
              key={tab + (editing?.id || "new")}
              kind={activeCollection}
              item={editing}
              onDirtyChange={setDirty}
              onCancel={() => {
                setEditing(undefined);
                setDirty(false);
              }}
              onSaved={() => {
                setEditing(undefined);
                setDirty(false);
                setNotice(ar ? "تم نشر المحتوى." : "Content published.");
              }}
            />
          ) : (
            <>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-black">{labels[activeCollection][ar ? 0 : 1]}</h2>
                <div className="flex flex-wrap gap-2">
                  {activeCollection === "members" && (
                    <BrandButton
                      size="sm"
                      variant={teamVisible ? "outline" : "primary"}
                      disabled={teamVisibilityBusy}
                      aria-pressed={teamVisible}
                      onClick={() => {
                        const nextVisible = !teamVisible;
                        setTeamVisibilityBusy(true);
                        void run(async () => {
                          try {
                            await setTeamVisibility(nextVisible);
                            queryClient.setQueryData<Awaited<ReturnType<typeof loadPublic>>>(
                              clubPublicKey,
                              (old) =>
                                old && {
                                  ...old,
                                  settings: { ...settings, teamVisible: nextVisible },
                                },
                            );
                          } finally {
                            setTeamVisibilityBusy(false);
                          }
                        });
                      }}
                    >
                      {teamVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                      {teamVisible
                        ? ar
                          ? "إخفاء تبويبة الفريق"
                          : "Hide team tab"
                        : ar
                          ? "إظهار تبويبة الفريق"
                          : "Show team tab"}
                    </BrandButton>
                  )}
                  <BrandButton
                    size="sm"
                    onClick={() => {
                      if (!confirmDiscard()) return;
                      setEditing(null);
                      setDirty(false);
                    }}
                  >
                    <Plus size={18} />
                    {ar ? "إضافة جديد" : "Add new"}
                  </BrandButton>
                </div>
              </div>
              {activeCollection === "members" && (
                <label className="mb-6 block">
                  <span className="mb-2 block text-sm font-bold">
                    {ar ? "البحث باسم العضو" : "Search members by name"}
                  </span>
                  <Input
                    type="search"
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                    placeholder={
                      ar ? "اكتب الاسم بالعربية أو الإنجليزية" : "Enter an Arabic or English name"
                    }
                  />
                  {memberItems.length === 0 && data.members.length > 0 && (
                    <p role="status" className="mt-2 text-sm text-muted-foreground">
                      {ar ? "لا يوجد أعضاء بهذا الاسم." : "No members match this name."}
                    </p>
                  )}
                </label>
              )}
              {activeCollection === "events" && (
                <label className="mb-6 block">
                  <span className="mb-2 block text-sm font-bold">
                    {activeCollection === "events"
                      ? ar
                        ? "البحث في الفعاليات"
                        : "Search events"
                      : ar
                        ? "البحث في الأخبار"
                        : "Search news"}
                  </span>
                  <Input
                    type="search"
                    value={articleSearch[activeCollection]}
                    onChange={(event) =>
                      setArticleSearch((current) => ({
                        ...current,
                        [activeCollection]: event.target.value,
                      }))
                    }
                    placeholder={
                      ar
                        ? "ابحث بالعنوان أو الوصف أو التاريخ"
                        : "Search by title, description, or date"
                    }
                  />
                  {(activeCollection === "events" ? eventItems : newsItems).length === 0 &&
                    data[activeCollection].length > 0 && (
                      <p role="status" className="mt-2 text-sm text-muted-foreground">
                        {ar ? "لا توجد نتائج مطابقة للبحث." : "No items match your search."}
                      </p>
                    )}
                </label>
              )}
              <div className="space-y-3">
                {data[activeCollection].length === 0 && (
                  <p>{ar ? "لا توجد عناصر بعد." : "No items yet."}</p>
                )}
                {(activeCollection === "events"
                  ? eventItems
                  : activeCollection === "members"
                    ? memberItems
                    : data[activeCollection]
                ).map((item) => (
                  <article
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/50 px-5 py-4"
                  >
                    <div>
                      <h3 className="break-words font-extrabold">
                        {ar ? item.title : item.title_en}
                      </h3>
                      {item.date && (
                        <p className="mt-1 text-xs text-muted-foreground">{item.date}</p>
                      )}
                      {activeCollection === "members" &&
                        (item.isFounder || item.committee === "administrative") && (
                          <p className="mt-1 text-sm font-bold text-primary">
                            {ar ? "ترتيب الهيئة الإدارية" : "Board order"}:{" "}
                            {item.displayOrder ?? (ar ? "غير محدد" : "Not set")}
                          </p>
                        )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ar ? "آخر تعديل بواسطة" : "Last edited by"}: {item.updatedBy || "—"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <BrandButton variant="outline" size="sm" onClick={() => setEditing(item)}>
                        <Pencil size={16} />
                        {ar ? "تعديل" : "Edit"}
                      </BrandButton>
                      <DeleteButton
                        label={item.title}
                        onDelete={() => run(() => deleteContent(activeCollection, item.id))}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </>
          ))}
        {tab === "joinRequests" && <RegistrationAdmin canEdit={role === "super_admin"} />}
        {tab === "contactMessages" && (
          <section className="rounded-3xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-2xl font-bold">{ar ? "رسائل التواصل" : "Contact messages"}</h2>
            <p>
              {ar
                ? "الرسائل الجديدة تُحفظ في Google Sheets فقط."
                : "New messages are stored only in Google Sheets."}
            </p>
            <a
              href={sheetLinks.contact}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-primary underline"
            >
              {ar ? "فتح شيت رسائل التواصل" : "Open contact spreadsheet"}
            </a>
          </section>
        )}
        {tab === "settings" && role === "super_admin" && (
          <SettingsEditor
            key={tab}
            initial={settings}
            onDirtyChange={setDirty}
            onSave={(value) => run(() => saveSettings(value))}
          />
        )}
        {tab === "admins" && role === "super_admin" && (
          <AdminUsersEditor
            ar={ar}
            currentUserId={user.id}
            onLoadError={adminLoadError}
            run={run}
          />
        )}
      </div>
    </>
  );
}

export function ContentEditor({
  kind,
  item,
  onCancel,
  onSaved,
  onDirtyChange,
}: {
  kind: ContentCollection;
  item: Content | null;
  onCancel: () => void;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { lang } = useClub();
  const ar = lang === "ar";
  const queryClient = useQueryClient();
  const [dirty, setDirty] = useState(false);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const [images, setImages] = useState(item?.images || []);
  const [driveImageUrls, setDriveImageUrls] = useState(item?.driveImageUrls || []);
  const [driveImageLink, setDriveImageLink] = useState("");
  const isArticle = kind === "events" || kind === "news";
  const [articleKind] = useState<"events" | "news">(kind === "news" ? "news" : "events");
  const targetKind: ContentCollection = isArticle ? articleKind : kind;
  const [showFinalPreview, setShowFinalPreview] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const values = Object.fromEntries(
      Object.entries(item ?? {}).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
    if (item?.durationMinutes) values["durationHours"] = String(item.durationMinutes / 60);
    return values;
  });

  const [committee, setCommittee] = useState(
    item?.isFounder || item?.committee === "administrative"
      ? "administrative"
      : item?.committee && committees.some(([key]) => key === item.committee)
        ? item.committee
        : committees[0][0],
  );

  const [gender, setGender] = useState(item?.gender === "female" ? "female" : "male");
  const [status, setStatus] = useState(item?.status || "upcoming");
  const [publicationStatus, setPublicationStatus] = useState<"draft" | "published">(
    item?.publicationStatus || "draft",
  );
  const [eventRegistration, setEventRegistration] = useState(
    item?.eventRegistration || defaultEventRegistration,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [cropSource, setCropSource] = useState<File | null>(null);
  useEffect(() => {
    if (!file) {
      setPreview("");

      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (busy || file) return;
    // SAFETY: this form has no file inputs, so every FormData entry value is a string.
    const values = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const parsed = contentSchema.safeParse(values);

    if (!parsed.success) {
      setError(
        ar ? "أدخل العنوان والوصف باللغتين." : "Enter the title and description in both languages.",
      );

      return;
    }

    const value: Omit<Content, "id"> = {
      ...blank,
      title: values["title"]!.trim(),
      title_en: values["title_en"]!.trim(),
      description: values["description"]!.trim(),
      description_en: values["description_en"]!.trim(),
      images,
    };

    if (isArticle) value.driveImageUrls = driveImageUrls;
    if (targetKind === "news") value.publicationStatus = publicationStatus;

    if (kind === "members") {
      value.role = values["role"] || "";
      value.role_en = values["role_en"] || "";
      value.profileEnabled = values["profileEnabled"] === "on";
      value.committee = committee;
      value.gender = gender === "female" ? "female" : "male";
      value.isFounder = committee === "administrative";
      if (value.isFounder && values["boardOrder"]?.trim()) {
        const order = Number(values["boardOrder"]);
        if (!Number.isInteger(order) || order < 1 || order > 9999) {
          setError(
            ar
              ? "ترتيب العرض يجب أن يكون رقمًا صحيحًا من 1 إلى 9999."
              : "Display order must be an integer from 1 to 9999.",
          );
          return;
        }
        value.displayOrder = order;
      }
    }

    if (isArticle) {
      value.date = values["date"] || "";

      // Optional; left out entirely when blank so clearing it removes it.
      for (const key of ["summary", "summary_en"] as const) {
        const summary = values[key]?.trim();

        if (summary) value[key] = summary;
      }
    }

    if (targetKind === "events") {
      const eventDetails = eventDetailsSchema.safeParse({
        eventTime: values["eventTime"],
        durationMinutes: Number(values["durationHours"]) * 60,
        eventType: values["eventType"],
        eventType_en: values["eventType_en"],
        presenterName: values["presenterName"],
        presenterName_en: values["presenterName_en"],
        presenterBio: values["presenterBio"],
        presenterBio_en: values["presenterBio_en"],
      });

      if (!eventDetails.success) {
        setError(
          ar
            ? "أكمل معلومات الفعالية والمقدم. يجب أن تكون المدة بين ربع ساعة و24 ساعة."
            : "Complete the event and presenter details. Duration must be between 0.25 and 24 hours.",
        );
        return;
      }

      Object.assign(value, eventDetails.data);
      value.status = status;
      value.eventRegistration = eventRegistration;
    }

    if (kind === "partners") {
      value.partnershipType = values["partnershipType"] || "";
      value.partnershipType_en = values["partnershipType_en"] || "";
    }

    for (const key of ["websiteUrl", "githubUrl", "linkedinUrl"] as const) {
      const url = values[key]?.trim();

      if (url) {
        if (!safeUrl(url)) {
          setError(ar ? "استخدم روابط HTTPS صحيحة." : "Use valid HTTPS links.");

          return;
        }

        value[key] = url;
      }
    }

    const typedSlug = values["slug"]?.trim().toLowerCase() ?? item?.slug ?? "";

    if (typedSlug && (typedSlug.length > 80 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(typedSlug))) {
      setError(
        ar
          ? "اسم الرابط: حروف إنجليزية صغيرة وأرقام وشرطات فقط، مثل club-launch-2026."
          : "Link name: lowercase English letters, numbers and hyphens only, like club-launch-2026.",
      );

      return;
    }

    setBusy(true);
    setError("");

    try {
      const savedId = await saveContent(targetKind, value, item?.id, kind, typedSlug || null);

      if (targetKind === "events" && status === "upcoming" && eventRegistration.enabled) {
        await ensureEventSheet(savedId, value.title);
      }

      if (item?.id && targetKind !== "news") {
        queryClient.setQueryData<Awaited<ReturnType<typeof loadPublic>>>(clubPublicKey, (old) => {
          if (!old) return old;
          const updated = { ...item, ...value };
          if (value.displayOrder === undefined) delete updated.displayOrder;
          const nextData = { ...old.data };
          nextData[kind] = old.data[kind].filter((c) => c.id !== item.id);
          nextData[targetKind] = [updated, ...nextData[targetKind].filter((c) => c.id !== item.id)];
          return { ...old, data: nextData };
        });
      }
      void queryClient.invalidateQueries({ queryKey: clubPublicKey });

      onSaved();
    } catch (error) {
      if (error instanceof Error && error.message.includes("content_slugs_pkey")) {
        setError(
          ar
            ? "اسم الرابط مستخدم لمحتوى آخر. اختر اسمًا مختلفًا أو اتركه فارغًا ليُنشأ تلقائيًا."
            : "That link name is already used. Pick another, or leave it empty to generate one.",
        );
        return;
      }
      const rejectedBoard =
        kind === "members" &&
        error instanceof Error &&
        error.message.includes("club_members_data_check");
      setError(
        rejectedBoard
          ? ar
            ? "قاعدة البيانات ترفض بيانات العضو. تأكد من تشغيل تحديث ترتيب الهيئة الإدارية في Supabase."
            : "The database rejected member data. Check that the board order migration has been applied in Supabase."
          : ar
            ? "تعذر حفظ المحتوى. تحقق من الصلاحيات والاتصال."
            : "Content could not be saved. Check permissions and connection.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError("");

    try {
      const url = await uploadImage(file);
      setImages((prev) => [...prev, url]);
      setDirty(true);
      setFile(null);
    } catch {
      setError(
        ar
          ? "تعذر رفع الصورة. استخدم JPG أو PNG أو WebP حتى 5 ميغابايت وتحقق من إعداد التخزين."
          : "Upload failed. Use JPG, PNG or WebP up to 5 MB and check storage setup.",
      );
    } finally {
      setBusy(false);
    }
  }

  function addDriveImage() {
    const url = googleDriveImageUrl(driveImageLink);

    if (!url) {
      setError(
        ar
          ? "ألصق رابط ملف صورة صحيحًا من Google Drive."
          : "Paste a valid Google Drive image file link.",
      );
      return;
    }
    if (driveImageUrls.length >= 20) {
      setError(ar ? "الحد الأقصى 20 صورة." : "You can add up to 20 images.");
      return;
    }

    setDriveImageUrls((current) => (current.includes(url) ? current : [...current, url]));
    setDriveImageLink("");
    setError("");
    setDirty(true);
  }

  function captureDraft(form: HTMLFormElement) {
    const entries = Object.fromEntries(new FormData(form)) as Record<string, FormDataEntryValue>;
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(entries)) {
      if (typeof value === "string") values[key] = value;
    }
    setDraft((current) => ({ ...current, ...values }));
  }

  const extraFields: [keyof Content, string, string, string][] =
    kind === "members"
      ? [
          ["githubUrl", "رابط GitHub", "GitHub URL", "url"],
          ["linkedinUrl", "رابط LinkedIn", "LinkedIn URL", "url"],
        ]
      : kind === "partners"
        ? [
            ["partnershipType", "نوع الشراكة بالعربية", "Partnership type in Arabic", "text"],
            [
              "partnershipType_en",
              "نوع الشراكة بالإنجليزية",
              "Partnership type in English",
              "text",
            ],
            ["websiteUrl", "موقع الشريك", "Partner website", "url"],
          ]
        : [
            [
              "date",
              targetKind === "news" ? "تاريخ الخبر" : "موعد الفعالية",
              targetKind === "news" ? "News date" : "Event date",
              "date",
            ],
          ];

  const previewItem: Content = {
    id: item?.id || "admin-preview",
    title: draft["title"] ?? item?.title ?? "",
    title_en: draft["title_en"] ?? item?.title_en ?? "",
    description: draft["description"] ?? item?.description ?? "",
    description_en: draft["description_en"] ?? item?.description_en ?? "",
    images: preview ? [preview, ...images] : images,
    driveImageUrls,
    date: draft["date"] ?? item?.date ?? "",
    status,
    eventTime: draft["eventTime"] ?? item?.eventTime ?? "",
    ...(draft["durationHours"]
      ? { durationMinutes: Number(draft["durationHours"]) * 60 }
      : item?.durationMinutes
        ? { durationMinutes: item.durationMinutes }
        : {}),
    eventType: draft["eventType"] ?? item?.eventType ?? "",
    eventType_en: draft["eventType_en"] ?? item?.eventType_en ?? "",
    presenterName: draft["presenterName"] ?? item?.presenterName ?? "",
    presenterName_en: draft["presenterName_en"] ?? item?.presenterName_en ?? "",
    presenterBio: draft["presenterBio"] ?? item?.presenterBio ?? "",
    presenterBio_en: draft["presenterBio_en"] ?? item?.presenterBio_en ?? "",
    partnershipType: draft["partnershipType"] ?? item?.partnershipType ?? "",
    partnershipType_en: draft["partnershipType_en"] ?? item?.partnershipType_en ?? "",
    websiteUrl: draft["websiteUrl"] ?? item?.websiteUrl ?? "",
    eventRegistration,
  };

  return (
    <form
      onSubmit={save}
      onChange={(event) => {
        setDirty(true);
        captureDraft(event.currentTarget);
      }}
      className="space-y-6 rounded-[2rem] border border-border bg-card p-6 shadow-card sm:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-black">
          {item ? (ar ? "تعديل المحتوى" : "Edit content") : ar ? "إضافة محتوى" : "Add content"}
        </h2>
        {(kind === "partners" || isArticle) && (
          <BrandButton
            type="button"
            variant={showFinalPreview ? "primary" : "outline"}
            aria-expanded={showFinalPreview}
            onClick={() => setShowFinalPreview((shown) => !shown)}
          >
            {showFinalPreview ? <EyeOff size={16} /> : <Eye size={16} />}
            {showFinalPreview
              ? ar
                ? "إخفاء المعاينة"
                : "Hide preview"
              : ar
                ? "معاينة الشكل النهائي"
                : "Preview final appearance"}
          </BrandButton>
        )}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {(
          [
            ["title", "العنوان بالعربية", "Title in Arabic"],
            ["title_en", "العنوان بالإنجليزية", "Title in English"],
            ["description", "الوصف بالعربية", "Description in Arabic"],
            ["description_en", "الوصف بالإنجليزية", "Description in English"],
          ] as const
        ).map(([key, a, en]) => (
          <label key={key} className="block text-sm font-bold">
            <span className="mb-2 block">{ar ? a : en}</span>
            {key.startsWith("description") ? (
              <RichTextEditor
                name={key}
                required
                defaultValue={item?.[key] || ""}
                dir={key.endsWith("_en") ? "ltr" : "rtl"}
                onDirty={() => setDirty(true)}
                onValueChange={(value) => setDraft((current) => ({ ...current, [key]: value }))}
              />
            ) : (
              <Input
                name={key}
                required
                minLength={2}
                maxLength={200}
                defaultValue={item?.[key] || ""}
                dir={key.endsWith("_en") ? "ltr" : "rtl"}
              />
            )}
          </label>
        ))}
        {extraFields.map(([key, a, en, type]) => (
          <label key={key} className="block text-sm font-bold">
            <span className="mb-2 block">{ar ? a : en}</span>
            <Input
              name={key}
              type={type}
              required={type === "date" || type === "number"}
              min={type === "number" ? 2000 : undefined}
              max={type === "number" ? 2100 : undefined}
              defaultValue={String(item?.[key] || (key === "year" ? new Date().getFullYear() : ""))}
            />
          </label>
        ))}
      </div>
      {kind === "members" && (
        <fieldset className="rounded-2xl border border-primary/30 bg-brand-gradient-soft/30 p-5">
          <legend className="px-2 font-bold">
            {ar ? "المسمّى الظاهر على بطاقة العضو" : "Member title shown on the card"}
          </legend>
          <p className="mb-4 text-sm font-normal text-muted-foreground">
            {ar
              ? "اكتب الصفة التي تظهر أسفل اسم العضو، مثل: نائب الرئيس. ولكل عضو مسمّى خاص به."
              : "Enter the position shown below the member’s name, such as Vice President. Each member has their own title."}
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            {(
              [
                ["role", "بالعربية", "Arabic", "نائب الرئيس"],
                ["role_en", "بالإنجليزية", "English", "Vice President"],
              ] as const
            ).map(([key, a, en, placeholder]) => (
              <label key={key} className="block text-sm font-bold">
                <span className="mb-2 block">{ar ? `المسمّى ${a}` : `${en} title`}</span>
                <Input
                  name={key}
                  maxLength={200}
                  defaultValue={item?.[key] || ""}
                  placeholder={placeholder}
                  dir={key.endsWith("_en") ? "ltr" : "rtl"}
                />
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {kind === "members" && (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4">
          <input
            type="checkbox"
            name="profileEnabled"
            defaultChecked={item?.profileEnabled !== false}
            className="mt-1 size-4 accent-primary"
          />
          <span>
            <span className="block font-bold">
              {ar ? "السماح بفتح صفحة العضو" : "Allow visitors to open this member’s page"}
            </span>
            <span className="mt-1 block text-sm font-normal text-muted-foreground">
              {ar
                ? "عند إيقاف الخيار تبقى البطاقة ظاهرة، لكن لا يمكن فتح صفحة العضو."
                : "When turned off, the member card stays visible but the profile page cannot be opened."}
            </span>
          </span>
        </label>
      )}
      {kind === "members" && (
        <label className="block text-sm font-bold">
          <span className="mb-2 block">
            {ar ? "اسم رابط صفحة العضو (بالإنجليزية)" : "Member page URL name (English)"}
          </span>
          <Input
            name="slug"
            maxLength={80}
            defaultValue={item?.slug || ""}
            dir="ltr"
            placeholder="member-name"
            aria-describedby="member-slug-help"
            onChange={() => setDirty(true)}
          />
          <span id="member-slug-help" className="mt-2 block font-normal text-muted-foreground">
            {ar
              ? "أحرف إنجليزية صغيرة وأرقام وشرطات فقط. اتركه فارغًا لإنشائه من الاسم الإنجليزي."
              : "Use lowercase English letters, numbers, and hyphens. Leave blank to generate it from the English name."}
          </span>
        </label>
      )}
      {isArticle && (
        <div className="grid gap-5 sm:grid-cols-2">
          {(
            [
              ["summary", "ملخص قصير بالعربية (اختياري)", "Short summary in Arabic (optional)"],
              [
                "summary_en",
                "ملخص قصير بالإنجليزية (اختياري)",
                "Short summary in English (optional)",
              ],
            ] as const
          ).map(([key, a, en]) => (
            <label key={key} className="block text-sm font-bold">
              <span className="mb-2 block">{ar ? a : en}</span>
              <Textarea
                name={key}
                maxLength={300}
                rows={2}
                defaultValue={item?.[key] || ""}
                dir={key.endsWith("_en") ? "ltr" : "rtl"}
              />
            </label>
          ))}
          <p className="text-sm text-muted-foreground sm:col-span-2">
            {ar
              ? "يظهر في نتائج البحث وعند مشاركة الرابط، ويُفضّل ألا يتجاوز 155 حرفًا. إن تُرك فارغًا يُستخدم أول الوصف."
              : "Shown in search results and link previews; about 155 characters reads best. If empty, the start of the description is used."}
          </p>
        </div>
      )}
      {kind === "members" && (
        <>
          {committee === "administrative" && (
            <label className="block">
              <span className="mb-2 block">
                {ar ? "ترتيب العرض في الهيئة الإدارية" : "Administrative board display order"}
              </span>
              <Input
                name="boardOrder"
                type="number"
                min={1}
                max={9999}
                step={1}
                defaultValue={item?.displayOrder ?? ""}
                placeholder="1"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {ar
                  ? "الرقم الأصغر أولًا: 1 ثم 2 ثم 3. اتركه فارغًا ليظهر بعد الأعضاء المرتّبين."
                  : "Lower numbers appear first: 1, 2, 3. Leave blank to appear after ranked members."}
              </p>
            </label>
          )}
          <label className="block">
            <span className="mb-2 block">{ar ? "تصنيف العضو" : "Member group"}</span>
            <Select dir={ar ? "rtl" : "ltr"} value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{ar ? "الطلاب" : "Male students"}</SelectItem>
                <SelectItem value="female">{ar ? "الطالبات" : "Female students"}</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">
              {ar
                ? "الأعضاء الحاليون ضمن الطلاب افتراضيًا. الهيئة الإدارية تُعرض دون تقسيم."
                : "Existing members default to male students. The administrative board remains ungrouped."}
            </p>
          </label>
          <label className="block">
            <span className="mb-2 block">{ar ? "اللجنة" : "Committee"}</span>
            <Select
              dir={ar ? "rtl" : "ltr"}
              value={committee}
              onValueChange={(v) => {
                setCommittee(v);
                setDirty(true);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="administrative">
                  {ar ? "الهيئة الإدارية" : "Administrative board"}
                </SelectItem>
                {committees.map(([key, a, en]) => (
                  <SelectItem key={key} value={key}>
                    {ar ? a : en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </>
      )}
      {targetKind === "events" && (
        <>
          <fieldset className="space-y-5 rounded-2xl border border-border p-5">
            <legend className="px-2 font-bold">
              {ar ? "معلومات الفعالية والمقدم" : "Event and presenter details"}
            </legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-bold">
                <span className="mb-2 block">{ar ? "وقت الفعالية" : "Event time"}</span>
                <Input name="eventTime" type="time" required defaultValue={item?.eventTime || ""} />
              </label>
              <label className="block text-sm font-bold">
                <span className="mb-2 block">
                  {ar ? "مدة الفعالية بالساعات" : "Duration in hours"}
                </span>
                <Input
                  name="durationHours"
                  type="number"
                  required
                  min={0.25}
                  max={24}
                  step={0.25}
                  defaultValue={item?.durationMinutes ? item.durationMinutes / 60 : ""}
                />
              </label>
              {(
                [
                  ["eventType", "نوع الفعالية بالعربية", "Event type in Arabic", 100],
                  ["eventType_en", "نوع الفعالية بالإنجليزية", "Event type in English", 100],
                  ["presenterName", "اسم مقدم الفعالية بالعربية", "Presenter name in Arabic", 200],
                  [
                    "presenterName_en",
                    "اسم مقدم الفعالية بالإنجليزية",
                    "Presenter name in English",
                    200,
                  ],
                ] as const
              ).map(([key, a, en, maxLength]) => (
                <label key={key} className="block text-sm font-bold">
                  <span className="mb-2 block">{ar ? a : en}</span>
                  <Input
                    name={key}
                    required
                    minLength={2}
                    maxLength={maxLength}
                    defaultValue={item?.[key] || ""}
                    dir={key.endsWith("_en") ? "ltr" : "rtl"}
                  />
                </label>
              ))}
              {(
                [
                  ["presenterBio", "سطر عن المقدم بالعربية", "Presenter bio in Arabic"],
                  ["presenterBio_en", "سطر عن المقدم بالإنجليزية", "Presenter bio in English"],
                ] as const
              ).map(([key, a, en]) => (
                <label key={key} className="block text-sm font-bold">
                  <span className="mb-2 block">{ar ? a : en}</span>
                  <Textarea
                    name={key}
                    required
                    minLength={2}
                    maxLength={500}
                    rows={3}
                    defaultValue={item?.[key] || ""}
                    dir={key.endsWith("_en") ? "ltr" : "rtl"}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="mb-2 block">{ar ? "الحالة" : "Status"}</span>
            <Select
              dir={ar ? "rtl" : "ltr"}
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setDraft((current) => ({ ...current, status: v }));
                setDirty(true);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">{ar ? "قادمة" : "Upcoming"}</SelectItem>
                <SelectItem value="past">{ar ? "سابقة" : "Past"}</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <EventRegistrationAdmin
            eventId={item?.id}
            value={eventRegistration}
            onChange={(next) => {
              setEventRegistration(next);
              setDirty(true);
            }}
          />
        </>
      )}
      {isArticle && (
        <fieldset className="rounded-2xl border border-border p-5">
          <legend className="px-2 font-bold">
            {ar ? "صور Google Drive" : "Google Drive images"}
          </legend>
          <p className="mb-4 text-sm text-muted-foreground">
            {ar
              ? "اجعل صلاحية الملف «أي شخص لديه الرابط»، ثم ألصق رابط الصورة. أول صورة هي صورة الغلاف."
              : 'Set the file access to "Anyone with the link", then paste its image link. The first image is the cover.'}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="url"
              dir="ltr"
              value={driveImageLink}
              placeholder="https://drive.google.com/file/d/.../view"
              aria-label={ar ? "رابط الصورة من Google Drive" : "Google Drive image link"}
              onChange={(event) => setDriveImageLink(event.target.value)}
            />
            <BrandButton type="button" variant="outline" onClick={addDriveImage}>
              {ar ? "إضافة الصورة" : "Add image"}
            </BrandButton>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {driveImageUrls.map((url, index) => (
              <div key={url}>
                <img
                  src={url}
                  alt={`${ar ? "صورة Drive" : "Drive image"} ${index + 1}`}
                  className="aspect-video w-full rounded-xl object-cover"
                />
                <BrandButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDriveImageUrls((current) => current.filter((image) => image !== url));
                    setDirty(true);
                  }}
                >
                  {ar ? "إزالة" : "Remove"}
                </BrandButton>
              </div>
            ))}
          </div>
          {images.length > 0 && (
            <div className="mt-6 border-t border-border pt-5">
              <p className="mb-3 text-sm font-bold">
                {ar ? "صور قديمة من التخزين الحالي" : "Legacy images from current storage"}
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {images.map((url) => (
                  <div key={url}>
                    <img
                      src={url}
                      alt={ar ? "صورة قديمة" : "Legacy image"}
                      className="aspect-video w-full rounded-xl object-cover"
                    />
                    <BrandButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setImages((current) => current.filter((image) => image !== url));
                        setDirty(true);
                      }}
                    >
                      {ar ? "إزالة" : "Remove"}
                    </BrandButton>
                  </div>
                ))}
              </div>
            </div>
          )}
        </fieldset>
      )}
      {!isArticle && (
        <details
          className="rounded-2xl border border-border p-5"
          onToggle={(e) => setMediaPickerOpen(e.currentTarget.open)}
        >
          <summary className="cursor-pointer font-bold">
            {ar ? "اختيار من مكتبة الصور" : "Choose from media library"}
          </summary>
          {mediaPickerOpen && (
            <MediaLibrary
              onSelect={(url) => {
                setImages((prev) => (prev.includes(url) ? prev : [...prev, url]));
                setDirty(true);
              }}
            />
          )}
        </details>
      )}
      {!isArticle && (
        <fieldset className="rounded-2xl border border-border p-5">
          <legend className="px-2 font-bold">{ar ? "الصور" : "Images"}</legend>
          <p className="mb-4 text-sm text-muted-foreground">
            {ar
              ? "اختاري الصور من المكتبة أو ارفعي صورة، ثم اضغطي حفظ ونشر لإظهارها في الموقع. أول صورة هي صورة الغلاف."
              : "Choose images from the library or upload one, then Save and publish. The first image is the cover."}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {images.map((url) => (
              <div key={url}>
                <img
                  src={url}
                  alt={ar ? "صورة المحتوى" : "Content image"}
                  className="h-28 w-full rounded-xl object-contain"
                />
                <BrandButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setImages((prev) => prev.filter((x) => x !== url));
                    setDirty(true);
                  }}
                >
                  {ar ? "إزالة" : "Remove"}
                </BrandButton>
              </div>
            ))}
          </div>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm">
              {ar ? "JPG / PNG / WebP، حتى 5 ميغابايت" : "JPG / PNG / WebP, up to 5 MB"}
            </span>
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(e) => {
                const selected = e.target.files?.[0] || null;
                setFile(null);
                setCropSource(selected);
                e.target.value = "";
              }}
            />
          </label>
          {cropSource && (
            <ImageCropper
              file={cropSource}
              ar={ar}
              onConfirm={(cropped) => {
                setFile(cropped);
                setCropSource(null);
                setDirty(true);
              }}
              onCancel={() => setCropSource(null)}
            />
          )}
          {preview && (
            <div className="mt-4">
              <img
                src={preview}
                alt={ar ? "معاينة قبل الرفع" : "Preview before upload"}
                className="aspect-video w-full max-w-xl rounded-xl object-cover"
              />
              <div className="mt-3 flex gap-3">
                <BrandButton type="button" disabled={busy} onClick={() => void upload()}>
                  <Upload size={16} />
                  {ar ? "رفع الصورة" : "Upload image"}
                </BrandButton>
                <BrandButton type="button" variant="ghost" onClick={() => setFile(null)}>
                  {ar ? "إلغاء الصورة" : "Discard image"}
                </BrandButton>
              </div>
            </div>
          )}
        </fieldset>
      )}
      {showFinalPreview && (
        <section className="space-y-5 rounded-[2rem] border border-primary/30 bg-brand-gradient-soft/20 p-4 sm:p-6">
          <div>
            <h3 className="text-xl font-black">
              {ar ? "معاينة الشكل النهائي" : "Final appearance preview"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {ar
                ? "المعاينة تتحدث تلقائيًا مع تعديل البيانات، قبل حفظ المحتوى."
                : "This preview updates as you edit, before the content is saved."}
            </p>
          </div>
          <div inert className="space-y-6">
            {kind === "partners" && (
              <div>
                <h4 className="mb-3 font-bold">{ar ? "بطاقة الشراكة" : "Partnership card"}</h4>
                <div className="max-w-xl">
                  <ContentCard item={previewItem} kind="partners" preview imagePreview={preview} />
                </div>
              </div>
            )}
            {isArticle && (
              <>
                <div>
                  <h4 className="mb-3 font-bold">{ar ? "بطاقة العرض" : "Listing card"}</h4>
                  <div className="max-w-xl">
                    <ContentCard
                      item={previewItem}
                      kind={articleKind}
                      preview
                      imagePreview={preview}
                    />
                  </div>
                </div>
                <div>
                  <h4 className="mb-3 font-bold">{ar ? "صفحة التفاصيل" : "Details page"}</h4>
                  {articleKind === "events" ? (
                    <EventDetail event={previewItem} lang={lang} previewImage={preview} />
                  ) : (
                    <NewsDetail news={previewItem} lang={lang} previewImage={preview} />
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      {kind === "news" && (
        <label className="block">
          <span className="mb-2 block">{ar ? "حالة النشر" : "Publication status"}</span>
          <Select
            value={publicationStatus}
            onValueChange={(value) => {
              if (value === "draft" || value === "published") {
                setPublicationStatus(value);
                setDirty(true);
              }
            }}
            dir={ar ? "rtl" : "ltr"}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="draft">
                  {ar ? "مسودة — غير ظاهرة للزوار" : "Draft — private"}
                </SelectItem>
                <SelectItem value="published">
                  {ar ? "منشور — ظاهر للزوار" : "Published — public"}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </label>
      )}
      <div className="flex flex-wrap gap-3">
        <BrandButton type="submit" disabled={busy || !!file || !!cropSource}>
          {busy
            ? ar
              ? "جارٍ الحفظ…"
              : "Saving…"
            : kind === "news" && publicationStatus === "draft"
              ? ar
                ? "حفظ المسودة"
                : "Save draft"
              : ar
                ? "حفظ ونشر"
                : "Save and publish"}
        </BrandButton>
        <BrandButton type="button" variant="outline" disabled={busy} onClick={onCancel}>
          {ar ? "إلغاء" : "Cancel"}
        </BrandButton>
      </div>
    </form>
  );
}
