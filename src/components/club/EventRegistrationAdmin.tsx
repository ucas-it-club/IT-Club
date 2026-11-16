import { useEffect, useState } from "react";
import { useClub } from "./club-context";
import type { EventRegistration } from "@/lib/club/model";
import { eventSheetStatus, sheetLinks } from "@/lib/club/sheets";

export function EventRegistrationAdmin({
  manageSheets = true,
  eventId,
  value,
  onChange,
}: {
  manageSheets?: boolean;
  eventId: string | undefined;
  value: EventRegistration;
  onChange: (value: EventRegistration) => void;
}) {
  const { lang } = useClub();
  const ar = lang === "ar";
  const [linkedSheet, setLinkedSheet] = useState<{ eventId: string; url: string }>();
  const linkedUrl =
    manageSheets && linkedSheet && linkedSheet.eventId === eventId ? linkedSheet.url : "";

  useEffect(() => {
    if (!eventId || !manageSheets) return;
    let active = true;
    void eventSheetStatus(eventId)
      .then((sheet) => {
        if (active) setLinkedSheet({ eventId, url: sheet.linked ? sheet.url : "" });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [eventId, manageSheets]);

  const toggle = (key: keyof EventRegistration) => onChange({ ...value, [key]: !value[key] });

  return (
    <fieldset className="space-y-4 rounded-2xl border border-border p-5">
      <legend className="px-2 font-bold">
        {ar ? "نموذج تسجيل الفعالية" : "Event registration form"}
      </legend>
      {(["enabled", "nameEnabled", "phoneEnabled", "attendanceEnabled"] as const).map((key) => {
        const labels = {
          enabled: ["إظهار نموذج التسجيل", "Show registration form"],
          nameEnabled: ["حقل الاسم", "Name field"],
          phoneEnabled: ["حقل رقم الهاتف", "Phone field"],
          attendanceEnabled: ["الالتزام بالحضور", "Attendance commitment"],
        } as const;
        return (
          <label key={key} className="flex items-center gap-3">
            <input type="checkbox" checked={value[key]} onChange={() => toggle(key)} />
            {labels[key][ar ? 0 : 1]}
          </label>
        );
      })}
      <a
        className="inline-flex min-h-11 items-center font-bold text-primary underline"
        href={linkedUrl || sheetLinks.join}
        target="_blank"
        rel="noopener noreferrer"
      >
        {linkedUrl
          ? ar
            ? "فتح تبويب تسجيلات الفعالية"
            : "Open the event registrations tab"
          : ar
            ? "فتح شيت نتائج تسجيل الفعاليات"
            : "Open event registration results sheet"}
      </a>
      {!manageSheets ? (
        <p className="text-sm text-muted-foreground">
          {ar
            ? "يمكنك تعديل إعدادات النموذج هنا. إنشاء وربط تبويب التسجيلات في الشيت يتولاه المدير العام قبل فتح التسجيل للطلاب."
            : "You can edit form settings here. A general administrator must create and link the spreadsheet tab before students can register."}
        </p>
      ) : !eventId ? (
        <p className="text-sm text-muted-foreground">
          {ar
            ? "عند حفظ فعالية قادمة سيُنشأ لها تبويب تلقائيًا داخل شيت انضم إلينا."
            : "Saving an upcoming event automatically creates its tab in the join spreadsheet."}
        </p>
      ) : (
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            {ar
              ? "يُنشئ النظام تبويب الفعالية تلقائيًا داخل شيت انضم إلينا عند الحفظ."
              : "The event tab is created automatically in the join spreadsheet when you save."}
          </p>
        </div>
      )}
    </fieldset>
  );
}
