import { useEffect, useMemo, useState } from "react";
import { Download, Pencil, Plus, Trophy } from "lucide-react";
import { BrandButton } from "../BrandButton";
import { DeleteButton } from "./DeleteButton";
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
  achievementTypes,
  loadAchievements,
  removeAchievement,
  saveAchievement,
  type Achievement,
  type AchievementCommittee,
  type AchievementType,
} from "@/lib/club/achievements";

const committeeLabels: Record<AchievementCommittee, [string, string]> = {
  club: ["إنجاز عام للنادي", "Club-wide"],
  media: ["الإعلام", "Media"],
  relations: ["العلاقات العامة", "Public relations"],
  activities: ["الأنشطة", "Activities"],
};

const typeLabels: Record<AchievementType, [string, string]> = {
  project: ["مشروع", "Project"],
  event: ["فعالية", "Event"],
  workshop: ["ورشة", "Workshop"],
  partnership: ["شراكة", "Partnership"],
  media: ["تغطية إعلامية", "Media coverage"],
  award: ["جائزة", "Award"],
  meeting: ["اجتماع", "Meeting"],
  decision: ["قرار", "Decision"],
  other: ["أخرى", "Other"],
};

const requirementLabels: Record<AchievementType, [string, string][]> = {
  project: [
    ["المسؤول", "Owner"],
    ["تاريخ البداية", "Start date"],
    ["تاريخ النهاية", "End date"],
    ["النتائج", "Outcomes"],
  ],
  event: [
    ["المكان", "Location"],
    ["عدد الحضور", "Attendance"],
    ["الفئة المستهدفة", "Target audience"],
    ["النتائج", "Outcomes"],
  ],
  workshop: [
    ["المدرب", "Trainer"],
    ["عدد المشاركين", "Participants count"],
    ["المخرجات", "Outputs"],
  ],
  partnership: [
    ["الجهة الشريكة", "Partner"],
    ["نوع التعاون", "Cooperation type"],
    ["مدة الشراكة", "Duration"],
    ["المخرجات", "Outputs"],
  ],
  media: [
    ["قناة النشر", "Publication channel"],
    ["رابط التغطية", "Coverage link"],
    ["الوصول أو المشاهدات", "Reach or views"],
  ],
  award: [
    ["الجهة المانحة", "Awarding body"],
    ["مستوى الجائزة", "Award level"],
    ["سبب الاستحقاق", "Reason"],
  ],
  meeting: [
    ["الحضور", "Attendees"],
    ["جدول الأعمال", "Agenda"],
    ["ملخص النقاش", "Discussion summary"],
    ["المخرجات والقرارات", "Outcomes and decisions"],
  ],
  decision: [
    ["نص القرار", "Decision text"],
    ["سبب القرار", "Reason"],
    ["الجهة المعتمدة", "Approving body"],
    ["المسؤول عن التنفيذ", "Implementation owner"],
    ["الموعد النهائي", "Deadline"],
    ["حالة التنفيذ", "Implementation status"],
  ],
  other: [["ملاحظات إضافية", "Additional notes"]],
};

function canManage(role: string, committee: AchievementCommittee) {
  if (role === "editor" || role === "super_admin") return true;
  if (role === "communications_editor") return committee === "media" || committee === "relations";
  return role === "events_editor" && committee === "activities";
}

function emptyAchievement(role: string): Achievement {
  const committee: AchievementCommittee =
    role === "events_editor" ? "activities" : role === "communications_editor" ? "media" : "club";
  return {
    id: "",
    title: "",
    title_en: "",
    type: "project",
    committee,
    date: new Date().toISOString().slice(0, 10),
    summary: "",
    summary_en: "",
    participants: "",
    participants_en: "",
    evidenceUrl: "",
    status: "draft",
    requirements: {},
    requirements_en: {},
  };
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char,
  );
}

function downloadWord(items: Achievement[], ar: boolean) {
  const title = ar ? "سجل إنجازات نادي تكنولوجيا المعلومات" : "IT Club Achievements Register";
  const sections = items
    .map((item) => {
      const labels = ar ? typeLabels[item.type][0] : typeLabels[item.type][1];
      const committee = ar
        ? committeeLabels[item.committee][0]
        : committeeLabels[item.committee][1];
      const name = ar ? item.title : item.title_en;
      const requirements = Object.entries(ar ? item.requirements || {} : item.requirements_en || {})
        .filter(([, value]) => value.trim())
        .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`)
        .join("");
      return `<section><h2>${escapeHtml(name)}</h2><p><b>${ar ? "النوع" : "Type"}:</b> ${labels} &nbsp; <b>${ar ? "اللجنة" : "Committee"}:</b> ${committee} &nbsp; <b>${ar ? "التاريخ" : "Date"}:</b> ${escapeHtml(item.date)}</p><p>${escapeHtml(ar ? item.summary : item.summary_en)}</p><p><b>${ar ? "المشاركون" : "Participants"}:</b> ${escapeHtml(ar ? item.participants || "—" : item.participants_en || "—")}</p>${requirements ? `<table>${requirements}</table>` : ""}</section>`;
    })
    .join("");
  const html = `<!doctype html><html dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;line-height:1.8;margin:2cm;color:#172033}h1{text-align:center;color:#4338ca}h2{border-bottom:2px solid #e0e7ff;padding-bottom:6px;color:#312e81}section{page-break-inside:avoid;margin-bottom:28px}table{border-collapse:collapse;width:100%;margin-top:10px}th,td{border:1px solid #cbd5e1;padding:7px;text-align:${ar ? "right" : "left"}}th{background:#eef2ff}</style></head><body><h1>${title}</h1><p>${ar ? "تقرير شامل بالإنجازات المسجلة" : "Complete report of recorded achievements"}</p>${sections}</body></html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = ar ? "club-achievements-ar.doc" : "club-achievements-en.doc";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AchievementWorkspace({ role, ar }: { role: string; ar: boolean }) {
  const [items, setItems] = useState<Achievement[]>([]);
  // `undefined` means the editor is closed; `null` means the add form is open.
  const [editing, setEditing] = useState<Achievement | null | undefined>(undefined);
  const [form, setForm] = useState<Achievement>(() => emptyAchievement(role));
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void loadAchievements()
      .then((value) => active && setItems(value))
      .catch(
        () => active && setNotice(ar ? "تعذر تحميل الإنجازات." : "Could not load achievements."),
      );
    return () => {
      active = false;
    };
  }, [ar]);

  const visible = useMemo(
    () => items.filter((item) => canManage(role, item.committee)),
    [items, role],
  );
  const filtered = visible.filter((item) =>
    `${item.title} ${item.title_en} ${item.participants}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const openEditor = (item: Achievement | null) => {
    setEditing(item);
    setForm(
      item
        ? {
            ...item,
            requirements: { ...item.requirements },
            requirements_en: { ...item.requirements_en },
          }
        : emptyAchievement(role),
    );
    setNotice("");
  };
  const setRequirement = (key: string, value: string, english = false) =>
    setForm((current) => ({
      ...current,
      [english ? "requirements_en" : "requirements"]: {
        ...(english ? current.requirements_en : current.requirements),
        [key]: value,
      },
    }));
  const save = async () => {
    if (
      !form.title.trim() ||
      !form.title_en.trim() ||
      !form.summary.trim() ||
      !form.summary_en.trim() ||
      !canManage(role, form.committee)
    )
      return;
    try {
      const { id: _id, ...payload } = form;
      await saveAchievement(payload);
      setItems(await loadAchievements());
      setEditing(null);
      setNotice(ar ? "تم حفظ الإنجاز." : "Achievement saved.");
    } catch {
      setNotice(ar ? "تعذر حفظ الإنجاز." : "Could not save achievement.");
    }
  };
  const update = async () => {
    if (!form.id || !canManage(role, form.committee)) return;
    try {
      const { id: _id, ...payload } = form;
      await saveAchievement(payload, form.id);
      setItems(await loadAchievements());
      setEditing(null);
      setNotice(ar ? "تم تحديث الإنجاز." : "Achievement updated.");
    } catch {
      setNotice(ar ? "تعذر تحديث الإنجاز." : "Could not update achievement.");
    }
  };

  if (editing !== undefined)
    return (
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black">
            {ar
              ? form.id
                ? "تحرير إنجاز"
                : "إضافة إنجاز"
              : form.id
                ? "Edit achievement"
                : "Add achievement"}
          </h2>
          <BrandButton variant="outline" onClick={() => setEditing(null)}>
            {ar ? "إلغاء" : "Cancel"}
          </BrandButton>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label>
            <span>{ar ? "اسم الإنجاز بالعربية" : "Arabic title"}</span>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            <span>{ar ? "اسم الإنجاز بالإنجليزية" : "English title"}</span>
            <Input
              value={form.title_en}
              onChange={(e) => setForm({ ...form, title_en: e.target.value })}
            />
          </label>
          <label>
            <span>{ar ? "نوع الإنجاز" : "Achievement type"}</span>
            <Select
              value={form.type}
              onValueChange={(value: AchievementType) =>
                setForm({ ...form, type: value, requirements: {} })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {achievementTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {ar ? typeLabels[type][0] : typeLabels[type][1]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label>
            <span>{ar ? "اللجنة" : "Committee"}</span>
            <Select
              value={form.committee}
              onValueChange={(value: AchievementCommittee) =>
                setForm({ ...form, committee: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(committeeLabels) as AchievementCommittee[])
                  .filter((committee) => canManage(role, committee))
                  .map((committee) => (
                    <SelectItem key={committee} value={committee}>
                      {ar ? committeeLabels[committee][0] : committeeLabels[committee][1]}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </label>
          <label>
            <span>{ar ? "التاريخ" : "Date"}</span>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </label>
          <label>
            <span>{ar ? "الحالة" : "Status"}</span>
            <Select
              value={form.status}
              onValueChange={(value: "draft" | "approved") => setForm({ ...form, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{ar ? "مسودة" : "Draft"}</SelectItem>
                <SelectItem value="approved">{ar ? "معتمد" : "Approved"}</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="sm:col-span-2">
            <span>{ar ? "الوصف المختصر" : "Short description"}</span>
            <Textarea
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </label>
          <label className="sm:col-span-2">
            <span>{ar ? "الوصف المختصر بالإنجليزية" : "English short description"}</span>
            <Textarea
              value={form.summary_en}
              onChange={(e) => setForm({ ...form, summary_en: e.target.value })}
            />
          </label>
          <label>
            <span>{ar ? "المشاركون" : "Participants"}</span>
            <Input
              value={form.participants}
              onChange={(e) => setForm({ ...form, participants: e.target.value })}
            />
          </label>
          <label>
            <span>{ar ? "المشاركون بالإنجليزية" : "Participants in English"}</span>
            <Input
              value={form.participants_en}
              onChange={(e) => setForm({ ...form, participants_en: e.target.value })}
            />
          </label>
          <label>
            <span>{ar ? "رابط الدليل" : "Evidence link"}</span>
            <Input
              type="url"
              value={form.evidenceUrl}
              onChange={(e) => setForm({ ...form, evidenceUrl: e.target.value })}
            />
          </label>
        </div>
        <div className="rounded-2xl border border-border p-5">
          <h3 className="mb-4 font-bold">
            {ar
              ? `متطلبات ${typeLabels[form.type][0]}`
              : `${typeLabels[form.type][1]} requirements`}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {requirementLabels[form.type].map(([labelAr, labelEn]) => {
              const key = labelEn.toLowerCase().replaceAll(" ", "_");
              return (
                <div key={key} className="space-y-3">
                  <label>
                    <span>{labelAr}</span>
                    <Textarea
                      value={form.requirements[key] || ""}
                      onChange={(e) => setRequirement(key, e.target.value)}
                    />
                  </label>
                  <label>
                    <span>{labelEn}</span>
                    <Textarea
                      value={form.requirements_en[key] || ""}
                      onChange={(e) => setRequirement(key, e.target.value, true)}
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </div>
        <BrandButton onClick={() => void (form.id ? update() : save())}>
          {ar ? "حفظ الإنجاز" : "Save achievement"}
        </BrandButton>
      </section>
    );

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">{ar ? "إنجازات النادي" : "Club achievements"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ar
              ? "سجل واحد لكل أنواع الإنجازات والاجتماعات والقرارات."
              : "One register for achievements, meetings, and decisions."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BrandButton variant="outline" onClick={() => downloadWord(visible, true)}>
            <Download size={16} />
            {ar ? "Word عربي" : "Arabic Word"}
          </BrandButton>
          <BrandButton variant="outline" onClick={() => downloadWord(visible, false)}>
            <Download size={16} />
            {ar ? "Word إنجليزي" : "English Word"}
          </BrandButton>
          <BrandButton onClick={() => openEditor(null)}>
            <Plus size={17} />
            {ar ? "إضافة إنجاز" : "Add achievement"}
          </BrandButton>
        </div>
      </div>
      {notice && (
        <p role="status" className="rounded-2xl bg-brand-gradient-soft p-4">
          {notice}
        </p>
      )}
      <Input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={ar ? "ابحث بالإنجاز أو المشاركين" : "Search achievements or participants"}
      />
      <div className="grid gap-4">
        {filtered.map((item) => (
          <article key={item.id} className="rounded-2xl border border-border bg-muted/30 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="rounded-xl bg-primary/10 p-3 text-primary">
                  <Trophy size={22} />
                </div>
                <div>
                  <h3 className="font-black">{ar ? item.title : item.title_en}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {ar ? typeLabels[item.type][0] : typeLabels[item.type][1]} ·{" "}
                    {ar ? committeeLabels[item.committee][0] : committeeLabels[item.committee][1]} ·{" "}
                    {item.date}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-background px-3 py-1 text-xs font-bold">
                {item.status === "approved" ? (ar ? "معتمد" : "Approved") : ar ? "مسودة" : "Draft"}
              </span>
            </div>
            <p className="mt-4 text-sm">{ar ? item.summary : item.summary_en}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              {ar ? "المشاركون" : "Participants"}:{" "}
              {ar ? item.participants || "—" : item.participants_en || "—"}
            </p>
            <div className="mt-4 flex gap-2">
              <BrandButton size="sm" variant="outline" onClick={() => openEditor(item)}>
                <Pencil size={15} />
                {ar ? "تعديل" : "Edit"}
              </BrandButton>
              <DeleteButton
                label={ar ? item.title : item.title_en}
                onDelete={async () => {
                  await removeAchievement(item.id);
                  setItems((current) => current.filter((entry) => entry.id !== item.id));
                }}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
