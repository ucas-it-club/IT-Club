/** Explicit administrative assignments; a public team committee is never authority. */
export const canManageNews = (role: string) => role === "media_editor" || role === "super_admin";

export function loginEmail(identifier: string) {
  const value = identifier.trim().toLowerCase();
  return /^[a-z][a-z0-9_]{2,31}$/.test(value) ? `${value}@accounts.itclub.invalid` : value;
}
