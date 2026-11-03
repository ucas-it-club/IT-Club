import { useEffect, useState, type FormEvent } from "react";
import { BrandButton } from "@/components/club/BrandButton";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "../PasswordInput";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import {
  loadAdmins,
  removeAdmin,
  saveAdmin,
  watchQuery,
  createAdminAccount,
} from "@/lib/club/supabase";
import { DeleteButton } from "./DeleteButton";

type AccountRole = "editor" | "media_editor" | "partnerships_editor" | "communications_editor";
type AdminRow = { id: string; name: string; email: string; role: string };
type Props = {
  ar: boolean;
  currentUserId: string;
  onLoadError: () => void;
  run: (action: () => Promise<void>) => Promise<void>;
};

function RoleSelect({
  ar,
  value,
  onChange,
  disabled = false,
  label,
}: {
  ar: boolean;
  value: AccountRole;
  onChange: (value: AccountRole) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span>{label}</span>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(value) => {
          if (
            value === "editor" ||
            value === "media_editor" ||
            value === "partnerships_editor" ||
            value === "communications_editor"
          )
            onChange(value);
        }}
        dir={ar ? "rtl" : "ltr"}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent dir={ar ? "rtl" : "ltr"}>
          <SelectGroup>
            <SelectItem value="editor">{ar ? "محرر عام" : "General editor"}</SelectItem>
            <SelectItem value="media_editor">{ar ? "لجنة الإعلام" : "Media committee"}</SelectItem>
            <SelectItem value="partnerships_editor">
              {ar ? "لجنة الشراكات" : "Partnerships committee"}
            </SelectItem>
            <SelectItem value="communications_editor">
              {ar ? "العلاقات العامة والإعلام" : "Public relations and media"}
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </label>
  );
}

export function AdminUsersEditor({ ar, currentUserId, onLoadError, run }: Props) {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [role, setRole] = useState<AccountRole>("editor");
  const [busy, setBusy] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => watchQuery(loadAdmins, setAdmins, onLoadError), [onLoadError]);

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget,
      values = new FormData(form);
    setBusy(true);
    setNotice("");
    try {
      await createAdminAccount(
        String(values.get("email")),
        String(values.get("password")),
        role,
        String(values.get("name")),
      );
      form.reset();
      setRole("editor");
      setNotice(ar ? "تم إنشاء الحساب بالنوع المحدد." : "Account created with the selected role.");
    } catch {
      setNotice(
        ar
          ? "تعذر تأكيد إنشاء الحساب. تحقق من قائمة الحسابات قبل إعادة المحاولة."
          : "Account creation could not be confirmed. Check the account list before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(admin: AdminRow, nextRole: AccountRole) {
    if (
      changingId ||
      admin.id === currentUserId ||
      admin.role === "super_admin" ||
      nextRole === admin.role
    )
      return;
    setChangingId(admin.id);
    try {
      await run(() => saveAdmin(admin.id, admin.name, admin.email, nextRole));
    } finally {
      setChangingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold">{ar ? "إدارة الحسابات" : "Account management"}</h2>
        <p className="text-muted-foreground">
          {ar
            ? "أضف الحساب وحدد نوعه من القائمة. لجنة الإعلام تدير الأخبار وتنشرها مباشرة، وحساب لجنة الشراكات يدير الشراكات فقط، والمحرر العام يحتفظ بصلاحياته الحالية."
            : "Add an account and choose its role. Media committee accounts manage and publish news directly; partnerships accounts manage partnerships only, and general editors retain their existing access."}
        </p>
      </div>
      <form
        onSubmit={createAccount}
        className="grid gap-4 rounded-3xl border border-border bg-card p-6 sm:grid-cols-2"
      >
        <label className="flex flex-col gap-2">
          <span>{ar ? "الاسم" : "Name"}</span>
          <Input
            name="name"
            required
            minLength={2}
            maxLength={200}
            disabled={busy}
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span>{ar ? "البريد الإلكتروني" : "Email"}</span>
          <Input
            name="email"
            type="email"
            required
            maxLength={254}
            disabled={busy}
            autoComplete="off"
            dir="ltr"
            placeholder="name@example.com"
          />
          <span className="text-sm text-muted-foreground">
            {ar
              ? "أدخل البريد الإلكتروني الذي سيُستخدم لتسجيل الدخول."
              : "Enter the email address used to sign in."}
          </span>
        </label>
        <div className="flex flex-col gap-2">
          <label htmlFor="account-password">{ar ? "كلمة المرور" : "Password"}</label>
          <PasswordInput
            ar={ar}
            id="account-password"
            name="password"
            required
            minLength={14}
            maxLength={128}
            disabled={busy}
            autoComplete="new-password"
            dir="ltr"
          />
          <span className="text-sm text-muted-foreground">
            {ar
              ? "14 حرفًا على الأقل. شاركها مع صاحب الحساب بشكل خاص."
              : "At least 14 characters. Share it privately with the account holder."}
          </span>
        </div>
        <RoleSelect
          ar={ar}
          value={role}
          onChange={setRole}
          disabled={busy}
          label={ar ? "نوع الحساب" : "Account type"}
        />
        <BrandButton type="submit" disabled={busy}>
          {busy ? (ar ? "جارٍ الإنشاء…" : "Creating…") : ar ? "إضافة حساب" : "Add account"}
        </BrandButton>
      </form>
      {notice && <p role="status">{notice}</p>}
      <div className="flex flex-col gap-3">
        {admins.map((admin) => (
          <div
            key={admin.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5"
          >
            <div>
              <p className="font-bold">{admin.name}</p>
              <p className="text-sm text-muted-foreground" dir="ltr">
                {admin.email}
              </p>
            </div>
            {admin.role === "super_admin" ? (
              <span>{ar ? "مدير عام" : "General administrator"}</span>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <RoleSelect
                  ar={ar}
                  value={
                    admin.role === "communications_editor"
                      ? "communications_editor"
                      : admin.role === "partnerships_editor"
                        ? "partnerships_editor"
                        : admin.role === "media_editor"
                          ? "media_editor"
                          : "editor"
                  }
                  onChange={(value) => void changeRole(admin, value)}
                  disabled={admin.id === currentUserId || changingId !== null}
                  label={ar ? `نوع حساب ${admin.name}` : `Role for ${admin.name}`}
                />
                {admin.id !== currentUserId && (
                  <DeleteButton
                    label={admin.name}
                    onDelete={() => run(() => removeAdmin(admin.id))}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
