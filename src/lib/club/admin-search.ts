import type { Content } from "./model";
import { plainRichText } from "./rich-text";

export function normalizeAdminSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, "")
    .toLocaleLowerCase()
    .trim();
}

export function matchesArticleSearch(item: Content, query: string) {
  const normalized = normalizeAdminSearch(query);

  if (!normalized) return true;

  return [
    item.title,
    item.title_en,
    item.description,
    item.description_en,
    item.summary,
    item.summary_en,
    item.date,
    item.slug,
  ].some((value) => normalizeAdminSearch(plainRichText(value)).includes(normalized));
}
