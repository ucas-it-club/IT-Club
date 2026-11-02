import { useEffect, useState, type FormEvent } from "react";
import { BrandButton } from "@/components/club/BrandButton";
import { Input } from "@/components/ui/input";
import {
  loadAdmins,
  removeAdmin,
  saveAdmin,
  watchQuery,
  createMediaAccount,
} from "@/lib/club/supabase";
import { DeleteButton } from "./DeleteButton";

type AdminRow = { id: string; name: string; email: string; role: string };

type AdminUsersEditorProps = {
  ar: boolean;
  currentUserId: string;
  onLoadError: () => void;
  run: (action: () => Promise<void>) => Promise<void>;
};

export function AdminUsersEditor({ ar, currentUserId, onLoadError, run }: AdminUsersEditorProps) {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [accountNotice, setAccountNotice] = useState("");
  useEffect(() => watchQuery(loadAdmins, setAdmins, onLoadError), [onLoadError]);

  function addEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const uid = String(values.get("uid")).trim();

    if (uid === currentUserId || uid.includes("/") || !uid) return;

    void run(async () => {
      await saveAdmin(
        uid,
        String(values.get("name")).trim(),
        String(values.get("email")).trim(),
        values.get("role") === "media_editor" ? "media_editor" : "editor",
      );
      form.reset();
    });
  }

  return (
    <>
      <section className="mb-8 flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-bold">
          {ar ? "حسابات لجنة الإعلام" : "Media committee accounts"}
        </h2>
        <p>
          {ar
            ? "لكل حساب دخول خاص وإدارة الأخبار حتى النشر. لا يمنح الوصول للفعاليات أو التسجيلات أو إعدادات الموقع. احفظ كلمة المرور وشاركها مع صاحب الحساب بشكل خاص."
            : "Each account can manage and publish news only. Store the password and share it privately with the account holder."}
        </p>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (creating) return;
            const form = event.currentTarget;
            const values = new FormData(form);
            setCreating(true);
            setAccountNotice("");
            try {
              await createMediaAccount(
                String(values.get("username")),
                String(values.get("password")),
              );
              form.reset();
              setAccountNotice(
                ar ? "تم إنشاء الحساب بصلاحية لجنة الإعلام." : "Media account created.",
              );
            } catch {
              setAccountNotice(
                ar
                  ? "تعذر تأكيد إنشاء الحساب. تحقق من القائمة؛ إذا كان موجودًا لا تعِد إنشاءه."
                  : "Account creation could not be confirmed. Check the list before retrying.",
              );
            } finally {
              setCreating(false);
            }
          }}
        >
          <label>
            {ar ? "اسم المستخدم" : "Username"}
            <select
              name="username"
              className="block rounded-md border border-input bg-background p-2"
              required
            >
              {["media_girl", "media_boy"].map((name) => (
                <option
                  key={name}
                  value={name}
                  disabled={admins.some((a) => a.email === `${name}@accounts.itclub.invalid`)}
                >
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {ar ? "كلمة مرور جديدة (14 حرفًا على الأقل)" : "New password (at least 14 characters)"}
            <Input
              name="password"
              type="password"
              minLength={14}
              maxLength={128}
              autoComplete="new-password"
              required
              dir="ltr"
            />
          </label>
          <BrandButton type="submit" disabled={creating}>
            {creating
              ? ar
                ? "جارٍ الإنشاء…"
                : "Creating…"
              : ar
                ? "إنشاء حساب إعلام"
                : "Create media account"}
          </BrandButton>
        </form>
        {accountNotice && <p role="status">{accountNotice}</p>}
      </section>
      <p className="mb-5 text-muted-foreground">
        {ar
          ? "أضف حساب المحرر الموجود في Supabase Authentication باستخدام معرّفه UID. إزالة المحرر هنا تلغي صلاحياته على الموقع."
          : "Add an existing Supabase Authentication account by its UID. Removing an editor here revokes their website access."}
      </p>
      <form
        className="mb-8 grid gap-4 rounded-3xl border border-border bg-card p-6 sm:grid-cols-2"
        onSubmit={addEditor}
      >
        {[
          ["uid", "UID"],
          ["name", ar ? "اسم المحرر" : "Editor name"],
          ["email", ar ? "البريد الإلكتروني" : "Email"],
        ].map(([key, label]) => (
          <label key={key} className="block">
            <span className="mb-2 block text-sm font-bold">{label}</span>
            <Input name={key} type={key === "email" ? "email" : "text"} required maxLength={254} />
          </label>
        ))}
        <label>
          {ar ? "الصلاحية" : "Role"}
          <select name="role" className="block rounded-md border border-input bg-background p-2">
            <option value="editor">
              {ar ? "محرر عام — دون إدارة الأخبار" : "General editor — no news management"}
            </option>
            <option value="media_editor">
              {ar
                ? "لجنة الإعلام — إدارة ونشر الأخبار"
                : "Media committee — manage and publish news"}
            </option>
          </select>
        </label>
        <BrandButton type="submit">
          {ar ? "تعيين صلاحية الحساب" : "Assign account access"}
        </BrandButton>
      </form>
      <div className="space-y-3">
        {admins.map((admin) => (
          <div
            key={admin.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5"
          >
            <span>
              {admin.name} · {admin.email} · {admin.role}
            </span>
            {admin.id !== currentUserId && ["editor", "media_editor"].includes(admin.role) && (
              <DeleteButton label={admin.name} onDelete={() => run(() => removeAdmin(admin.id))} />
            )}
          </div>
        ))}
      </div>
    </>
  );
}
