import { useEffect, useState } from "react";
import { useClub } from "./club-context";
import { BrandButton } from "@/components/club/BrandButton";
import { Input } from "@/components/ui/input";
import {
  configureRegistration,
  isOpen,
  loadApplications,
  loadRegistration,
  sheetLinks,
  submissionError,
  type Registration,
  type CommitteeApplicationPage,
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
  const [applications, setApplications] = useState<CommitteeApplicationPage | null>(null);
  const [applicationsOffset, setApplicationsOffset] = useState(0);
  const [applicationsBusy, setApplicationsBusy] = useState(false);
  const [applicationsError, setApplicationsError] = useState("");

  async function refreshApplications(offset = applicationsOffset) {
    setApplicationsBusy(true);
    setApplicationsError("");
    try {
      setApplications(await loadApplications(offset));
      setApplicationsOffset(offset);
    } catch {
      setApplicationsError(
        ar
          ? "تعذر تحميل الطلبات. تحققي من صلاحية المدير والاتصال."
          : "Could not load applications. Check admin access and connection.",
      );
    } finally {
      setApplicationsBusy(false);
    }
  }
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
      {canEdit && (
        <section
          className="space-y-4 border-t border-border pt-5"
          aria-labelledby="committee-applications-heading"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 id="committee-applications-heading" className="text-xl font-black">
                {ar ? "طلبات اللجان" : "Committee applications"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {ar
                  ? "تظهر بيانات المتقدمين هنا للمشرف العام فقط."
                  : "Applicant details are available to super admins only."}
              </p>
            </div>
            <BrandButton
              type="button"
              variant="outline"
              disabled={applicationsBusy}
              onClick={() => void refreshApplications()}
            >
              {applicationsBusy
                ? ar
                  ? "جارٍ التحميل…"
                  : "Loading…"
                : applications
                  ? ar
                    ? "تحديث الطلبات"
                    : "Refresh applications"
                  : ar
                    ? "عرض الطلبات"
                    : "Load applications"}
            </BrandButton>
          </div>
          {applicationsError && <p role="alert">{applicationsError}</p>}
          {applications &&
            (applications.total ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {ar
                    ? `إجمالي الطلبات: ${applications.total}`
                    : `Total applications: ${applications.total}`}
                </p>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[760px] text-start text-sm">
                    <thead className="bg-muted/60">
                      <tr>
                        {[
                          ar ? "المتقدم" : "Applicant",
                          ar ? "اللجنة" : "Committee",
                          ar ? "الرقم الجامعي" : "Student ID",
                          ar ? "التواصل" : "Contact",
                          ar ? "التخصص والسنة" : "Major and year",
                          ar ? "الإجابات" : "Answers",
                        ].map((label) => (
                          <th key={label} className="p-3 font-bold">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {applications.applications.map((application) => (
                        <tr key={application.id} className="border-t border-border align-top">
                          <td className="p-3">
                            <strong>{application.fullName}</strong>
                            <div className="text-xs text-muted-foreground">
                              {new Date(application.submittedAt).toLocaleString(
                                ar ? "ar-PS" : "en-GB",
                              )}
                            </div>
                          </td>
                          <td className="p-3">{application.committeeName}</td>
                          <td className="p-3" dir="ltr">
                            {application.studentId}
                          </td>
                          <td className="p-3">
                            <a className="underline" href={`mailto:${application.email}`}>
                              {application.email}
                            </a>
                            <div dir="ltr">
                              <a
                                className="underline"
                                href={`https://wa.me/${application.whatsapp.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {application.whatsapp}
                              </a>
                            </div>
                          </td>
                          <td className="p-3">
                            {application.major}
                            <div>
                              {ar
                                ? `السنة ${application.studyYear}`
                                : `Year ${application.studyYear}`}
                            </div>
                          </td>
                          <td className="p-3">
                            <details>
                              <summary className="cursor-pointer font-bold">
                                {ar ? "عرض الإجابات" : "View answers"}
                              </summary>
                              <dl className="mt-3 min-w-64 space-y-3">
                                {Object.entries(application.answers)
                                  .filter(([, answer]) => answer)
                                  .map(([question, answer]) => (
                                    <div key={question}>
                                      <dt className="font-bold">{question}</dt>
                                      <dd className="whitespace-pre-wrap">{answer}</dd>
                                    </div>
                                  ))}
                              </dl>
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <BrandButton
                    type="button"
                    variant="outline"
                    disabled={applicationsBusy || applicationsOffset === 0}
                    onClick={() => void refreshApplications(Math.max(0, applicationsOffset - 50))}
                  >
                    {ar ? "السابق" : "Previous"}
                  </BrandButton>
                  <span className="text-sm text-muted-foreground">
                    {ar
                      ? `عرض ${applicationsOffset + 1}–${Math.min(applicationsOffset + applications.applications.length, applications.total)} من ${applications.total}`
                      : `Showing ${applicationsOffset + 1}–${Math.min(applicationsOffset + applications.applications.length, applications.total)} of ${applications.total}`}
                  </span>
                  <BrandButton
                    type="button"
                    variant="outline"
                    disabled={applicationsBusy || applicationsOffset + 50 >= applications.total}
                    onClick={() => void refreshApplications(applicationsOffset + 50)}
                  >
                    {ar ? "التالي" : "Next"}
                  </BrandButton>
                </div>
              </>
            ) : (
              <p role="status">{ar ? "لا توجد طلبات حتى الآن." : "No applications yet."}</p>
            ))}
        </section>
      )}
      {canEdit && (
        <a
          className="inline-block font-bold text-primary underline"
          href={sheetLinks.applications}
          target="_blank"
          rel="noopener noreferrer"
        >
          {ar ? "فتح شيتات الطلبات" : "Open application sheets"}
        </a>
      )}
    </section>
  );
}
