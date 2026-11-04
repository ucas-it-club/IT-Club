// The site's sitemap: every public page in Arabic and English, with each
// page's two language versions linked as alternates, and news, events and
// partners by their one-based public index. Built live from the dedicated public
// content tables, so a new item appears as soon as it is published.
//
// Called by the site's /sitemap.xml, which passes its own origin as ?site= so
// the domain is configured in one place (VITE_SITE_URL on the site's build).
// It only reads rows the public can already read, through the publishable key
// and Row Level Security, so it needs no caller authentication.
//
// URL rules mirror src/lib/club/paths.ts: Arabic at the root, English under
// /en, the members collection at /team. Keep the two in step.

const segment: Record<string, string> = { members: "team" };

// Fixed pages in the order they appear in the navigation.
const fixed = ["about", "join", "contact", "privacy"];

// Sections that disappear (and answer 404) while they have no entries.
const sections = ["members", "events", "news", "partners"];

// Kinds whose items have public, indexable pages. Member pages are noindex.
const itemKinds = ["events", "news", "partners"];

type Row = {
  id: string;
  kind: string;
  data: { date?: string } | null;
  created_at: string;
  updated_at: string;
};

type PublicSettings = { teamVisible?: boolean };

const href = (site: string, lang: "ar" | "en", page: string) => {
  const [first = "", ...rest] = page.split("/").filter(Boolean);
  const path = [segment[first] ?? first, ...rest].filter(Boolean).join("/");
  const prefix = lang === "en" ? "/en" : "";

  return `${site}${path ? `${prefix}/${path}` : prefix || "/"}`;
};

const day = (iso: string) => iso.slice(0, 10);

function entry(site: string, page: string, lastmod?: string) {
  const ar = href(site, "ar", page);
  const en = href(site, "en", page);
  const links =
    `    <xhtml:link rel="alternate" hreflang="ar" href="${ar}"/>\n` +
    `    <xhtml:link rel="alternate" hreflang="en" href="${en}"/>\n` +
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${ar}"/>\n`;
  const mod = lastmod ? `    <lastmod>${day(lastmod)}</lastmod>\n` : "";

  // Each language version is its own <url>, both carrying the same alternates.
  return [ar, en].map((loc) => `  <url>\n    <loc>${loc}</loc>\n${mod}${links}  </url>\n`).join("");
}

Deno.serve(async (req) => {
  const site = new URL(req.url).searchParams.get("site") ?? "";

  // Only a bare https origin; anything else would end up inside every <loc>.
  if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(site)) {
    return new Response("?site= must be an https origin, like https://example.org", {
      status: 400,
    });
  }

  const rows: Row[] = [];
  // One deadline covers every page and body read, including origin outages.
  const signal = AbortSignal.timeout(8000);
  try {
    const key = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}")["default"];
    if (!key) throw new Error("Missing publishable key");
    const headers = { apikey: key };
    const settingsResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/rest/v1/club_settings?select=data&id=eq.public&limit=1`,
      { headers, signal },
    );
    if (!settingsResponse.ok) throw new Error("Settings could not be read");
    const settingsRows: { data?: PublicSettings }[] = await settingsResponse.json();
    const teamVisible = settingsRows[0]?.data?.teamVisible !== false;
    const tables = (
      [
        ["club_members", "members", ""],
        ["club_events", "events", ""],
        ["club_news", "news", ""],
        ["club_partners", "partners", ""],
      ] as const
    ).filter(([, kind]) => kind !== "members" || teamVisible);
    for (const [table, kind, filter] of tables) {
      for (let offset = 0; ;) {
        const response = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/rest/v1/${table}?select=id,data,created_at,updated_at&order=updated_at.desc,id.asc${filter}&offset=${offset}&limit=500`,
          { headers, signal },
        );
        if (!response.ok) throw new Error("Content could not be read");
        const page: Omit<Row, "kind">[] = await response.json();
        if (page.length === 0) break;
        rows.push(...page.map((row) => ({ ...row, kind })));
        // Advance by actual rows so a lower project API cap does not truncate it.
        offset += page.length;
      }
    }
  } catch {
    return new Response("Content could not be read", { status: 502 });
  }
  const latest = (kind?: string) =>
    rows.find((row) => (kind ? row.kind === kind : itemKinds.includes(row.kind)))?.updated_at;

  let body = entry(site, "", latest());

  for (const page of fixed) body += entry(site, page);

  for (const kind of sections) {
    if (rows.some((row) => row.kind === kind)) body += entry(site, kind, latest(kind));
  }

  for (const kind of itemKinds) {
    const ordered = rows
      .filter((row) => row.kind === kind)
      .sort((a, b) => {
        const aOrder =
          kind === "events" || kind === "news"
            ? a.data?.date || a.created_at || a.id
            : a.created_at || a.id;
        const bOrder =
          kind === "events" || kind === "news"
            ? b.data?.date || b.created_at || b.id
            : b.created_at || b.id;
        return (
          aOrder.localeCompare(bOrder) ||
          (a.created_at || "").localeCompare(b.created_at || "") ||
          a.id.localeCompare(b.id)
        );
      });
    ordered.forEach((row, index) => {
      body += entry(site, `${kind}/${index + 1}`, row.updated_at);
    });
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    body +
    `</urlset>\n`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Crawlers fetch this rarely; an hour of staleness is invisible to them.
      "Cache-Control": "public, max-age=3600",
    },
  });
});
