import type { Content } from "@/lib/club/model";

export const adminDateOrderStorageKeys = {
  events: "club-admin-event-date-order",
  news: "club-admin-news-date-order",
} as const;

export type AdminDateOrder = Record<keyof typeof adminDateOrderStorageKeys, boolean>;

export function loadAdminDateOrder(): AdminDateOrder {
  try {
    return {
      events: localStorage.getItem(adminDateOrderStorageKeys.events) === "true",
      news: localStorage.getItem(adminDateOrderStorageKeys.news) === "true",
    };
  } catch {
    return { events: false, news: false };
  }
}

export function storeAdminDateOrder(
  kind: keyof typeof adminDateOrderStorageKeys,
  enabled: boolean,
) {
  try {
    localStorage.setItem(adminDateOrderStorageKeys[kind], String(enabled));
  } catch {
    // Storage is optional (for example, in privacy-restricted browsers).
  }
}

export function sortAdminContentByDate(items: Content[], byDate: boolean) {
  const created = (item: Content) =>
    Date.parse(item.createdAt || (typeof item.updatedAt === "string" ? item.updatedAt : "")) || 0;
  const itemDate = (item: Content) => Date.parse(item.date || "") || 0;

  return [...items].sort(
    (a, b) =>
      (byDate ? itemDate(b) - itemDate(a) : 0) ||
      created(b) - created(a) ||
      a.id.localeCompare(b.id),
  );
}
