import { committees, type Content } from "@/lib/club/model";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { BrandButton } from "../BrandButton";
import { DeleteButton } from "./DeleteButton";
import { Pencil } from "lucide-react";

export function MemberTable({
  ar,
  members,
  onEdit,
  onDelete,
}: {
  ar: boolean;
  members: Content[];
  onEdit: (member: Content) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-start">{ar ? "العضو" : "Member"}</TableHead>
          <TableHead className="text-start">{ar ? "اللجنة" : "Committee"}</TableHead>
          <TableHead className="text-start">{ar ? "المسمّى" : "Role"}</TableHead>
          <TableHead className="text-start">{ar ? "الإجراءات" : "Actions"}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-center">
              {ar ? "لا يوجد أعضاء ضمن هذه القائمة." : "No members in this list."}
            </TableCell>
          </TableRow>
        )}
        {members.map((member) => (
          <TableRow key={member.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                {member.images?.[0] && (
                  <img
                    src={member.images[0]}
                    alt=""
                    className="size-10 rounded-full object-cover"
                  />
                )}
                <span className="font-bold">
                  {ar ? member.title : member.title_en || member.title}
                </span>
              </div>
            </TableCell>
            <TableCell>
              {member.isFounder || member.committee === "administrative"
                ? ar
                  ? "الهيئة الإدارية"
                  : "Administrative board"
                : committees.find(([key]) => key === member.committee)?.[ar ? 1 : 2] || "—"}
            </TableCell>
            <TableCell>{(ar ? member.role : member.role_en) || "—"}</TableCell>
            <TableCell>
              <div className="flex gap-2">
                <BrandButton variant="outline" size="sm" onClick={() => onEdit(member)}>
                  <Pencil size={16} />
                  {ar ? "تعديل" : "Edit"}
                </BrandButton>
                <DeleteButton
                  label={ar ? member.title : member.title_en || member.title}
                  onDelete={() => onDelete(member.id)}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
