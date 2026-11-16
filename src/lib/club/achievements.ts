import { supabase } from "./supabase";

export const achievementTypes = [
  "project",
  "event",
  "workshop",
  "partnership",
  "media",
  "award",
  "meeting",
  "decision",
  "other",
] as const;

export type AchievementType = (typeof achievementTypes)[number];
export type AchievementCommittee = "club" | "media" | "relations" | "activities";
export type AchievementStatus = "draft" | "approved";

export type Achievement = {
  id: string;
  title: string;
  title_en: string;
  type: AchievementType;
  committee: AchievementCommittee;
  date: string;
  summary: string;
  summary_en: string;
  participants: string;
  participants_en: string;
  evidenceUrl: string;
  status: AchievementStatus;
  requirements: Record<string, string>;
  requirements_en: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
};

type AchievementInput = Omit<Achievement, "id" | "createdAt" | "updatedAt">;

function check(error: { message: string; code?: string } | null) {
  if (error) throw new Error(error.message);
}

export async function loadAchievements() {
  const result = await supabase()
    .from("club_achievements")
    .select("id,data,created_at,updated_at")
    .order("created_at", { ascending: false });
  check(result.error);

  return (result.data || []).map((row) => ({
    ...(row.data as Omit<Achievement, "id">),
    id: String(row.id),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  })) as Achievement[];
}

export async function saveAchievement(value: AchievementInput, id?: string) {
  const query = id
    ? supabase().from("club_achievements").update({ data: value }).eq("id", id)
    : supabase().from("club_achievements").insert({ data: value });
  const result = await query.select("id").single();
  check(result.error);
  if (!result.data) throw new Error("Achievement was not returned");
  window.dispatchEvent(new Event("club-data-changed"));
  return String(result.data.id);
}

export async function removeAchievement(id: string) {
  const result = await supabase()
    .from("club_achievements")
    .delete()
    .eq("id", id)
    .select("id")
    .single();
  check(result.error);
  window.dispatchEvent(new Event("club-data-changed"));
}
