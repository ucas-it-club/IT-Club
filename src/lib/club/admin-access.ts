/** Explicit administrative assignments; a public team committee is never authority. */
export const canManageNews = (role: string) => role === "media_editor" || role === "super_admin";

export function loginEmail(identifier: string) {
  const value = identifier.trim().toLowerCase();
  return /^(media_girl|media_boy)$/.test(value) ? `${value}@accounts.itclub.invalid` : value;
}
