import { notFound, redirect } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import {
  collections,
  findItem,
  isUnavailableSection,
  kindsFor,
  type Content,
  type ContentCollection,
  type Lang,
} from "./model";
import { hrefOf, itemPage, pageOf } from "./paths";
import { contentExists } from "./public-api";
import { alternates, itemLd, itemSeo, ldJson, pages as copy, seo, type PageKey } from "./seo";
import { loadClubData, refreshClubData } from "./ssr-data";

/**
 * Loader and head for every page under a language: /$ (Arabic) and /en/$.
 *
 * The two route files differ only in their language, so the work lives here.
 */

/** Pages that take no id after them. */
const fixed = ["about", "join", "contact", "privacy", "admin"];

export const isCollection = (page: string): page is ContentCollection =>
  // SAFETY: the cast only satisfies includes' parameter type; the check itself
  // is a plain string comparison.
  collections.includes(page as ContentCollection);

/**
 * What a page path points at, or undefined when nothing lives there.
 *
 * ContentPage renders any unknown path as a "not found" heading, which would
 * go out as 200 and be indexed as a real page. Anything this rejects answers 404.
 */
function target(page: string): { kind?: ContentCollection; ref?: string | undefined } | undefined {
  const [first = "", ref, ...rest] = page.split("/");

  if (rest.length) return undefined;
  if (fixed.includes(first)) return ref === undefined ? {} : undefined;
  if (isCollection(first)) return { kind: first, ref };

  return undefined;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function loadPage(
  queryClient: QueryClient,
  lang: Lang,
  splat: string,
): Promise<{ item?: Content }> {
  // The root loader already warmed this; the call just hands back the data.
  const loaded = await loadClubData(queryClient);
  const page = pageOf(`/${splat}`);
  const found = target(page);

  if (!found) throw notFound();

  // One address per page: /members is /team. Items are checked below, once
  // their readable name is known.
  const requested = `${lang === "en" ? "/en" : ""}/${splat.replace(/\/+$/, "")}`;
  const moveTo = (canonical: string) => {
    if (hrefOf(lang, canonical) !== requested)
      throw redirect({ href: hrefOf(lang, canonical), statusCode: 301 });
  };

  const { kind, ref } = found;

  if (!ref) moveTo(page);

  // Without data (not configured, or Supabase down) nothing is known to be
  // missing; the page renders its own error state instead.
  if (!kind || !loaded) return {};

  if (!ref) {
    // ponytail: a first item added to an empty section can still 404 for up
    // to the one-minute cache. Refreshing here instead would re-fetch on
    // every visit while the section stays empty.
    if (isUnavailableSection(kind, loaded.data, loaded.settings)) throw notFound();

    return {};
  }

  let hit = findItem(loaded.data, kind, ref);

  if (!hit) {
    // Only ids and slugs can exist; anything else is missing without asking.
    if (!uuid.test(ref) && !slug.test(ref)) throw notFound();

    // The cached payload is up to a minute old, so ask about this one item
    // before calling it missing. A made-up link costs one tiny read; only an
    // item published in the last minute re-fetches the full payload.
    const exists = await contentExists(ref, kindsFor(kind)).catch(() => undefined);

    if (exists === false) throw notFound();

    // Unknown (the check failed): render and let the page show its own state.
    if (exists === undefined) return {};

    const fresh = await refreshClubData(queryClient);

    if (!fresh) return {};

    hit = findItem(fresh.data, kind, ref);

    if (!hit) throw notFound();
  }

  // Older members without this setting remain enabled. When explicitly
  // disabled, block both slug and legacy-id URLs before canonical redirects.
  if (hit.kind === "members" && hit.item.profileEnabled === false) throw notFound();

  // Old id links and the other kind's path move to the item's own address.
  moveTo(itemPage(hit.kind, hit.item, loaded.data));

  return { item: hit.item };
}

export function pageHead(
  lang: Lang,
  splat: string,
  missing: boolean,
  loaderData: { item?: Content } | undefined,
) {
  const page = pageOf(`/${splat}`);
  const first = page.split("/")[0] ?? "";
  const path = hrefOf(lang, page);

  if (!missing && loaderData?.item) {
    // Individual member pages stay out of search: they carry students' names and photos.
    const member = first === "members";

    return {
      meta: [
        ...itemSeo(loaderData.item, lang, path, member),
        ...(member ? [] : [ldJson(itemLd(loaderData.item, lang, path))]),
      ],
      links: member ? [] : alternates(lang, page),
    };
  }

  // SAFETY: hasOwn confirms first is one of copy's keys before the cast.
  const key: PageKey = missing || !Object.hasOwn(copy, first) ? "missing" : (first as PageKey);
  const noindex = key === "missing" || key === "admin";

  return {
    meta: seo({
      lang,
      title: copy[key][lang].title,
      description: copy[key][lang].description,
      path,
      noindex,
    }),
    links: noindex ? [] : alternates(lang, page),
  };
}

export function homeHead(lang: Lang) {
  return {
    meta: seo({
      lang,
      title: copy.home[lang].title,
      description: copy.home[lang].description,
      path: hrefOf(lang, ""),
    }),
    links: alternates(lang, ""),
  };
}
