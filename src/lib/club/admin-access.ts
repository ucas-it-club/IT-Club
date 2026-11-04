/** Explicit administrative assignments; a public team committee is never authority. */
export const canManageNews = (role: string) =>
  role === "media_editor" || role === "communications_editor" || role === "super_admin";

export function loginEmail(identifier: string) {
  const value = identifier.trim().toLowerCase();
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    throw new Error("A valid email address is required");
  return value;
}

export function canManageMember(role: string, member: { committee?: string; isFounder?: boolean }) {
  if (role === "editor" || role === "super_admin") return true;
  if (member.isFounder) return false;
  return role === "communications_editor"
    ? member.committee === "media" || member.committee === "relations"
    : role === "events_editor" && member.committee === "activities";
}
