import { useEffect, useState } from "react";

import { BrandButton } from "@/components/club/BrandButton";
import { useClub } from "@/components/club/club-context";
import { RichTextEditor } from "@/components/club/RichTextEditor";
import { Input } from "@/components/ui/input";
import type { Settings } from "@/lib/club/model";

type TextSetting = Exclude<keyof Settings, "registrationOpen" | "teamVisible">;

const settingFields: Record<TextSetting, [string, string]> = {
  vision: ["الرؤية بالعربية", "Vision in Arabic"],
  vision_en: ["الرؤية بالإنجليزية", "Vision in English"],
  mission: ["الرسالة بالعربية", "Mission in Arabic"],
  mission_en: ["الرسالة بالإنجليزية", "Mission in English"],
  goals: ["الأهداف بالعربية (كل هدف بسطر)", "Goals in Arabic (one per line)"],
  goals_en: ["الأهداف بالإنجليزية (كل هدف بسطر)", "Goals in English (one per line)"],
  email: ["بريد التواصل", "Contact email"],
  facebook: ["Facebook", "Facebook"],
  instagram: ["Instagram", "Instagram"],
  linkedin: ["LinkedIn", "LinkedIn"],
  github: ["GitHub", "GitHub"],
};

type SettingsEditorProps = {
  initial: Settings;
  onSave: (value: Settings) => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
};

export function SettingsEditor({ initial, onSave, onDirtyChange }: SettingsEditorProps) {
  const { lang } = useClub();
  const ar = lang === "ar";
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <form
      className="grid gap-5 rounded-3xl border border-border bg-card p-6 sm:grid-cols-2"
      onChange={() => setDirty(true)}
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<
          TextSetting,
          string
        >;

        try {
          await onSave({ ...initial, ...values });
          setDirty(false);
        } finally {
          setBusy(false);
        }
      }}
    >
      {Object.entries(settingFields).map(([key, pair]) => (
        <label key={key} className="block">
          <span className="mb-2 block text-sm font-bold">{pair[ar ? 0 : 1]}</span>
          {["vision", "mission", "goals"].some((prefix) => key.startsWith(prefix)) ? (
            <RichTextEditor
              name={key}
              defaultValue={initial[key as TextSetting]}
              dir={key.endsWith("_en") ? "ltr" : "rtl"}
              onDirty={() => setDirty(true)}
            />
          ) : (
            <Input
              name={key}
              type={key === "email" ? "email" : "url"}
              pattern={key === "email" ? undefined : "https://.*"}
              defaultValue={initial[key as TextSetting]}
            />
          )}
        </label>
      ))}
      <BrandButton type="submit" disabled={busy}>
        {ar ? "حفظ الإعدادات" : "Save settings"}
      </BrandButton>
    </form>
  );
}
