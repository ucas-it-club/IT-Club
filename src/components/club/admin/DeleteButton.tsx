import { Trash2 } from "lucide-react";

import { BrandButton } from "@/components/club/BrandButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useClub } from "@/components/club/club-context";

type DeleteButtonProps = {
  label: string;
  onDelete: () => Promise<void>;
};

export function DeleteButton({ onDelete, label }: DeleteButtonProps) {
  const { lang } = useClub();
  const ar = lang === "ar";

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <BrandButton variant="ghost" size="sm" aria-label={label}>
          <Trash2 size={16} />
          {ar ? "حذف" : "Delete"}
        </BrandButton>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{ar ? "حذف هذا العنصر؟" : "Delete this item?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {ar
              ? "سيُحذف العنصر من الموقع. لا يمكن التراجع عن هذا الإجراء."
              : "The item will be removed from the website. This cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{ar ? "إلغاء" : "Cancel"}</AlertDialogCancel>
          <AlertDialogAction onClick={() => void onDelete()}>
            {ar ? "حذف" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
