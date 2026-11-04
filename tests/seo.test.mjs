import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import { test } from "node:test";

const require = createRequire(import.meta.url);
function loadSeo(env = {}) {
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const exports = {};
    cache.set(path, exports);
    const source = readFileSync(path, "utf8").replaceAll("import.meta.env", "testEnv");
    const js = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(js, {
      exports,
      URL,
      testEnv: env,
      require: (name) => {
        if (name.endsWith(".webp")) return { default: "/assets/logo.webp" };
        if (name.startsWith("./")) return load(`src/lib/club/${name.slice(2)}.ts`);
        return require(name);
      },
    });
    return exports;
  }
  return load("src/lib/club/seo.ts");
}
const api = loadSeo();
const value = (tags, key) => tags.find((tag) => tag.name === key || tag.property === key)?.content;
const item = {
  id: "1",
  title: "عنوان",
  title_en: "An article",
  description: "وصف",
  description_en: "Article body",
  date: "2026-09-01",
  updatedAt: "2026-09-02T10:00:00Z",
  images: [],
};

test("noindex pages remain crawlable and public pages permit large image previews", () => {
  assert.doesNotMatch(api.robotsTxt(), /Disallow:.*admin/);
  const tags = api.seo({ lang: "en", title: "Home", description: "Home", path: "/en" });
  assert.match(value(tags, "robots"), /max-image-preview:large/);
  assert.equal(
    value(
      api.seo({
        lang: "en",
        title: "Admin",
        description: "Admin",
        path: "/en/admin",
        noindex: true,
      }),
      "robots",
    ),
    "noindex,nofollow",
  );
});

test("event dates are not article publication dates", () => {
  const tags = api.itemSeo(item, "en", "/en/events/example", false);
  assert.equal(value(tags, "og:type"), "website");
  assert.equal(value(tags, "article:published_time"), undefined);
});

test("news markup keeps full headlines, names its author, and omits unrelated fallback images", () => {
  const article = api
    .itemLd({ ...item, title_en: "A useful headline ".repeat(10) }, "en", "/en/news/example")
    ["@graph"].find((node) => node["@type"] === "NewsArticle");
  assert.equal(article.headline, "A useful headline ".repeat(10));
  assert.equal(article.author.name, api.siteName.en);
  assert.equal(article.author["@type"], "Organization");
  assert.equal(article.author.url, `${api.siteUrl}/en/about`);
  assert.equal(article.image, undefined);
  const crumbs = api
    .itemLd(item, "ar", "/news/example")
    ["@graph"].find((node) => node["@type"] === "BreadcrumbList").itemListElement;
  assert.equal(crumbs[1].name, "الأخبار");
  const tags = api.itemSeo(
    { ...item, images: ["https://example.com/photo.jpg"] },
    "en",
    "/en/news/example",
    false,
  );
  assert.equal(value(tags, "og:type"), "article");
  assert.equal(value(tags, "article:modified_time"), item.updatedAt);
  assert.equal(value(tags, "og:image:alt"), item.title_en);
});

test("article markup includes only real, safe content images", () => {
  const article = api
    .itemLd(
      {
        ...item,
        images: [
          "https://example.com/photo.jpg",
          "javascript:alert(1)",
          "https://example.com/second.jpg",
        ],
      },
      "en",
      "/en/news/example",
    )
    ["@graph"].find((node) => node["@type"] === "NewsArticle");
  assert.deepEqual(Array.from(article.image), [
    "https://example.com/photo.jpg",
    "https://example.com/second.jpg",
  ]);
});

test("the site entity has one root URL across languages and reciprocal page alternates", () => {
  for (const lang of ["ar", "en"]) {
    const website = api
      .organizationLd(lang, { profiles: [] })
      ["@graph"].find((node) => node["@type"] === "WebSite");
    assert.equal(website.url, `${api.siteUrl}/`);
    const links = api.alternates(lang, "members");
    assert.equal(
      links.find((link) => link.rel === "canonical").href,
      `${api.siteUrl}${lang === "en" ? "/en" : ""}/team`,
    );
    assert.equal(links.filter((link) => link.rel === "alternate").length, 3);
  }
});

test("verification tags are emitted only for configured ownership tokens", () => {
  assert.equal(api.verificationMeta().length, 0);
  const configured = loadSeo({
    VITE_GOOGLE_SITE_VERIFICATION: " google-token ",
    VITE_BING_SITE_VERIFICATION: "bing-token",
  });
  assert.equal(value(configured.verificationMeta(), "google-site-verification"), "google-token");
  assert.equal(value(configured.verificationMeta(), "msvalidate.01"), "bing-token");
});

test("sitemap proxy bounds requests and never caches origin or body failures", async () => {
  const source = readFileSync("src/server.ts", "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const mode of ["success", "status", "network", "body"]) {
    const exports = {};
    vm.runInNewContext(js, {
      exports,
      URL,
      Response,
      AbortSignal,
      require: (name) => {
        if (name.endsWith("seo")) return api;
        if (name.endsWith("public-api")) return { url: "https://example.supabase.co" };
        return {};
      },
      fetch: async (_url, init) => {
        assert.ok(init.signal);
        if (mode === "network") throw new Error("offline");
        return {
          ok: mode !== "status",
          text: async () => {
            if (mode === "body") throw new Error("interrupted body");
            return "<urlset/>";
          },
        };
      },
    });
    const response = await exports.default.fetch(new Request(`${api.siteUrl}/sitemap.xml`));
    assert.equal(response.status, mode === "success" ? 200 : 502);
    assert.equal(
      response.headers.get("cache-control"),
      mode === "success" ? "public, max-age=3600" : null,
    );
  }
});

test("HTML edge caching varies by theme and excludes private or unbounded URLs", () => {
  const source = readFileSync("src/server.ts", "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(js, {
    exports,
    URL,
    Request,
    Response,
    Headers,
    AbortSignal,
    require: (name) => {
      if (name.endsWith("seo")) return api;
      if (name.endsWith("public-api")) return { url: "https://example.supabase.co" };
      return {};
    },
  });

  const light = exports.htmlCacheKey(
    new Request(`${api.siteUrl}/about`, { headers: { accept: "text/html" } }),
  );
  const dark = exports.htmlCacheKey(
    new Request(`${api.siteUrl}/about`, {
      headers: { accept: "text/html", cookie: "ucas-theme=dark" },
    }),
  );
  assert.notEqual(light.url, dark.url);
  assert.equal(exports.htmlCacheKey(new Request(`${api.siteUrl}/admin`)), undefined);
  assert.equal(exports.htmlCacheKey(new Request(`${api.siteUrl}/about?preview=1`)), undefined);
  assert.equal(exports.cacheableHtml(Response.json({ ok: true })), false);
  assert.equal(
    exports.cacheableHtml(
      new Response("<html></html>", { headers: { "content-type": "text/html" } }),
    ),
    true,
  );
});
