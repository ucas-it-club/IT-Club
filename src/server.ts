import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { url as supabaseUrl } from "./lib/club/public-api";
import { robotsTxt, siteUrl } from "./lib/club/seo";

type ServerEntry = {
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- opaque platform env/context, forwarded untouched
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

const htmlFreshFor = 60;
const htmlStaleFor = 5 * 60;
const htmlCacheVersion = "v1";

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then((m) => {
      // SAFETY: this module's default (or namespace) export is the framework's
      // fetch handler, matching ServerEntry's shape.
      return (m.default ?? m) as ServerEntry;
    });
  }

  return serverEntryPromise;
}

function executionContext(value: unknown): ExecutionContext | undefined {
  if (
    value &&
    typeof value === "object" &&
    "waitUntil" in value &&
    typeof value.waitUntil === "function"
  ) {
    return value as ExecutionContext;
  }

  return undefined;
}

function defaultCache(): Cache | undefined {
  return (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
}

/**
 * Cache only anonymous public documents. The theme is part of the key because
 * SSR puts it on <html>; admin pages stay uncached even though authentication
 * itself happens in the browser.
 */
function htmlCacheKey(request: Request): Request | undefined {
  if (request.method !== "GET") return undefined;
  const source = new URL(request.url);
  if (source.search || /(^|\/)admin(?:\/|$)/.test(source.pathname)) return undefined;
  const accept = request.headers.get("accept") ?? "";
  if (accept && !accept.includes("text/html") && !accept.includes("*/*")) return undefined;

  const dark = /(?:^|;\s*)ucas-theme=dark(?:;|$)/.test(request.headers.get("cookie") ?? "");
  const key = new URL(request.url);
  key.pathname = `/.club-cache/${htmlCacheVersion}/${dark ? "dark" : "light"}${source.pathname}`;
  key.search = "";

  return new Request(key, { method: "GET" });
}

function cacheableHtml(response: Response) {
  return (
    response.status === 200 &&
    response.headers.get("content-type")?.includes("text/html") &&
    !response.headers.has("set-cookie")
  );
}

async function storeHtml(cache: Cache, key: Request, response: Response) {
  const headers = new Headers(response.headers);
  headers.set("cache-control", `public, max-age=${htmlFreshFor + htmlStaleFor}`);
  headers.set("x-club-cached-at", String(Date.now()));
  await cache.put(
    key,
    new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
  );
}

function serveHtml(response: Response, state: "HIT" | "STALE") {
  const headers = new Headers(response.headers);
  // The browser must ask the Worker each time: the Worker's cache key also
  // includes the theme cookie, while a browser cache key does not.
  headers.set("cache-control", "private, no-store");
  headers.set("server-timing", `club-edge-cache;desc=${state}`);
  headers.delete("x-club-cached-at");
  headers.delete("content-length");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();

  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));

  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    // SAFETY: only the shape of the two fields checked below matters; anything else
    // in the parsed JSON is ignored.
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };

    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/** The site's first address, kept alive only to forward old links. */
const retiredHost = "ucas.itclub-143.workers.dev";

/**
 * Permanent (301) moves the router can't make itself:
 *
 * - /about/ → /about. The router corrects this too, but always as a temporary
 *   307, which tells search engines to keep the slashed URL around.
 * - The old workers.dev address → the same path on the site's own domain,
 *   once VITE_SITE_URL names one. Until then siteUrl is that address and
 *   nothing moves. Only this exact host: Cloudflare's per-version preview URLs
 *   also end in .workers.dev and must keep working for testing.
 *
 * Both happen in one hop.
 */
function permanentMove(request: Request): Response | undefined {
  if (request.method !== "GET" && request.method !== "HEAD") return undefined;

  const from = new URL(request.url);
  const to = new URL(from);
  const site = new URL(siteUrl);

  if (from.hostname === retiredHost && site.hostname !== retiredHost) {
    to.protocol = site.protocol;
    to.host = site.host;
  }

  to.pathname = to.pathname.replace(/\/+$/, "") || "/";

  return to.href === from.href ? undefined : Response.redirect(to.href, 301);
}

const text = (body: BodyInit | null, type: string) =>
  new Response(body, {
    headers: { "content-type": `${type}; charset=utf-8`, "cache-control": "public, max-age=3600" },
  });

/**
 * The sitemap is built by the `sitemap` Supabase Edge Function from live
 * content; this only forwards it. The site's own address goes along so the
 * domain is set in one place, and the XML type is restored here because
 * Supabase's gateway serves function responses as text/plain.
 */
async function sitemap() {
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/sitemap?site=${encodeURIComponent(siteUrl)}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) return new Response("Sitemap unavailable", { status: 502 });
    // Consume the body inside the deadline/error boundary, before caching a 200.
    return text(await response.text(), "application/xml");
  } catch {
    return new Response("Sitemap unavailable", { status: 502 });
  }
}

async function renderSsr(request: Request, env: unknown, ctx: unknown) {
  const handler = await getServerEntry();
  const response = await handler.fetch(request, env, ctx);

  return normalizeCatastrophicSsrResponse(response);
}

async function publicDocument(request: Request, env: unknown, ctx: unknown) {
  const cache = defaultCache();
  const key = cache && htmlCacheKey(request);

  if (!cache || !key) return renderSsr(request, env, ctx);

  const cached = await cache.match(key);

  if (cached) {
    const cachedAt = Number(cached.headers.get("x-club-cached-at"));
    const age = Date.now() - cachedAt;

    if (Number.isFinite(age) && age >= 0 && age <= htmlFreshFor * 1000) {
      return serveHtml(cached, "HIT");
    }

    if (Number.isFinite(age) && age >= 0 && age <= (htmlFreshFor + htmlStaleFor) * 1000) {
      const refresh = renderSsr(request, env, ctx)
        .then((response) =>
          cacheableHtml(response) ? storeHtml(cache, key, response) : Promise.resolve(),
        )
        .catch((error) => console.error("Background HTML refresh failed", error));
      const context = executionContext(ctx);

      if (context) context.waitUntil(refresh);
      else void refresh;

      return serveHtml(cached, "STALE");
    }
  }

  const response = await renderSsr(request, env, ctx);

  if (cacheableHtml(response)) {
    const write = storeHtml(cache, key, response.clone()).catch((error) =>
      console.error("HTML cache write failed", error),
    );
    const context = executionContext(ctx);

    if (context) context.waitUntil(write);
    else void write;
  }

  return response;
}

// Export the pure cache guards so deployment-sensitive behavior is covered by
// the Node test suite without emulating the whole Cloudflare runtime.
export { cacheableHtml, htmlCacheKey };

export default {
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- opaque platform env/context, forwarded untouched
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const moved = permanentMove(request);

    if (moved) return moved;

    const { pathname } = new URL(request.url);

    if (pathname === "/robots.txt") return text(robotsTxt(), "text/plain");
    if (pathname === "/sitemap.xml") return sitemap();

    try {
      return await publicDocument(request, env, ctx);
    } catch (error) {
      console.error(error);

      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
