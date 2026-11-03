/** Explicit administrative assignments; a public team committee is never authority. */
export const canManageNews = (role: string) => role === "media_editor" || role === "super_admin";

export function loginEmail(identifier: string) {
  const value = identifier.trim().toLowerCase();
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    throw new Error("A valid email address is required");
  return value;
}
