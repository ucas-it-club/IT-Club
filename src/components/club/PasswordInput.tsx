import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function PasswordInput({
  ar,
  ...props
}: Omit<ComponentProps<typeof Input>, "type"> & { ar: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Input {...props} type={visible ? "text" : "password"} />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-end"
        disabled={props.disabled}
        aria-controls={props.id}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        {visible
          ? ar
            ? "إخفاء كلمة المرور"
            : "Hide password"
          : ar
            ? "إظهار كلمة المرور"
            : "Show password"}
      </Button>
    </div>
  );
}
