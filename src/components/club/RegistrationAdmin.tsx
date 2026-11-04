import { useEffect, useState } from "react";
import { useClub } from "./club-context";
import { BrandButton } from "@/components/club/BrandButton";
import { Input } from "@/components/ui/input";
import {
  configureRegistration,
  isOpen,
  loadRegistration,
  sheetLinks,
  submissionError,
  type Registration,
} from "@/lib/club/sheets";
import { saveSettings } from "@/lib/club/supabase";

export function RegistrationAdmin({ canEdit }: { canEdit: boolean }) {
  const { lang, settings } = useClub();
  const ar = lang === "ar";
  const [status, setStatus] = useState<Registration>();
  const [limit, setLimit] = useState("40");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true;

    const load = () =>
      loadRegistration()
        .then((value) => {
          if (active) {
            setStatus(value);
            setUnavailable(false);
          }
        })
        .catch(() => {
          if (active) setUnavailable(true);
        });

    void loadRegistration()
      .then((value) => {
        if (active) {
          setStatus(value);
          setLimit(String(value.limit));
          setEnabled(value.enabled);
        }
      })
      .catch(() => {
        if (active) setUnavailable(true);
      });

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <section className="space-y-5 rounded-3xl border border-border bg-card p-6">
      <h2 className="text-2xl font-black">
        {ar ? "استقبال الأعضاء الجدد" : "Membership registration"}
      </h2>
      {unavailable && (
        <p role="alert">
          {ar
            ? "تعذر الوصول إلى سكربت الانضمام. تحققي من إعداد النشر: Anyone، ومن إعداد FORM_KIND والمفتاح العام."
            : "Cannot reach the registration script. Check public deployment access and script properties."}
        </p>
      )}
      {!status && !unavailable && (
        <p role="status">{ar ? "جارٍ تحميل العداد…" : "Loading registration count…"}</p>
      )}
      {status && (
        <>
          <p className="text-xl font-bold text-primary">
            {ar
              ? `المسجلون: ${status.count} / ${status.limit} — المتبقي: ${status.remaining}`
              : `Registered: ${status.count} / ${status.limit} — Remaining: ${status.remaining}`}
          </p>
          <p>
            {status.open
              ? ar
                ? "التسجيل مفتوح"
                : "Registration is open"
              : ar
                ? "تم وقف استقبال الأعضاء الجدد"
                : "Registration is closed"}
          </p>
          {canEdit && (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();

                if (busy) return;
                setBusy(true);
                setNotice("");

                try {
                  const value = await configureRegistration(enabled, Number(limit));
                  setStatus(value);
                  setUnavailable(false);

                  // Mirror the resulting state into club_settings so public
                  // pages can decide whether to show the join prompt without
                  // each visitor paying for a call to Apps Script. A failure
                  // here must not look like the save failed: Apps Script is
                  // authoritative and has already accepted the change.
                  const open = isOpen(value);

                  if (open !== settings.registrationOpen) {
                    try {
                      await saveSettings({ ...settings, registrationOpen: open });
                    } catch {
                      setNotice(
                        ar
                          ? "حُفظت الإعدادات في السكربت، لكن تعذر تحديث حالة التسجيل المعروضة على الموقع."
                          : "Saved to the script, but the site's displayed registration state could not be updated.",
                      );

                      return;
                    }
                  }

                  setNotice(ar ? "تم حفظ إعدادات التسجيل." : "Registration settings saved.");
                } catch (error) {
                  setNotice(submissionError(error, ar));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="block font-bold">
                {ar ? "الحد الإجمالي للتسجيل" : "Total registration limit"}
                <Input
                  className="mt-2 max-w-xs"
                  type="number"
                  min={1}
                  max={100000}
                  step={1}
                  required
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                {ar
                  ? "فتح استقبال الطلبات حتى بلوغ الحد"
                  : "Accept applications until the limit is reached"}
              </label>
              <p className="text-sm text-muted-foreground">
                {ar
                  ? "يظهر زر الديناصور «انضم إلينا» عند فتح التسجيل ما دام العدد أقل من الحد، ويختفي عند بلوغه أو إغلاق التسجيل. العدد من الشيت؛ إعادة الفتح لا تصفّر العداد."
                  : "The floating mascot Join us button appears while registration is enabled and below the limit. It hides when full or closed. Counts come from the sheet; reopening does not reset them."}
              </p>
              <BrandButton type="submit" disabled={busy || unavailable}>
                {busy
                  ? ar
                    ? "جارٍ الحفظ…"
                    : "Saving…"
                  : ar
                    ? "حفظ التحكم بالتسجيل"
                    : "Save registration settings"}
              </BrandButton>
            </form>
          )}
        </>
      )}
      {notice && <p role="status">{notice}</p>}
      <a
        className="inline-block font-bold text-primary underline"
        href={sheetLinks.join}
        target="_blank"
        rel="noopener noreferrer"
      >
        {ar ? "فتح طلبات الانضمام في Google Sheets" : "Open applications in Google Sheets"}
      </a>
    </section>
  );
}
