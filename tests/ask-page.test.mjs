import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("/ask is noindex, Arabic only, and left out of the sitemap and nav", () => {
  const route = read("src/lib/club/page-route.ts");
  const site = read("src/components/club/ClubSite.tsx");
  const sitemap = read("supabase/functions/sitemap/index.ts");

  assert.match(route, /key === "ask"/);
  assert.match(route, /page === "ask" && lang === "en"/);
  assert.doesNotMatch(sitemap, /"ask"/);
  assert.doesNotMatch(
    site.slice(site.indexOf("navigationItems"), site.indexOf("] as const")),
    /ask/,
  );
  // robots.txt must not hide it: crawlers have to reach the page to read noindex.
  assert.doesNotMatch(read("src/lib/club/seo.ts"), /Disallow: \/ask/);
});

test("/ask renders without site chrome and skips the boot screen", () => {
  const site = read("src/components/club/ClubSite.tsx");
  const bare = site.slice(site.indexOf("if (bare)"), site.indexOf("if (bare)") + 220);

  assert.doesNotMatch(bare, /SiteHeader|SiteFooter|FloatingJoin|PrivacyNotice/);
  assert.match(read("src/components/club/BootScreen.tsx"), /pathname==='\/ask'/);
});

test("the page offers no way out and counts nothing in test mode or on localhost", () => {
  const page = read("src/components/club/AskPage.tsx");
  const track = read("src/lib/club/ask-track.ts");

  assert.doesNotMatch(page, /<a[\s>]|<Link|href=|navigate\(/);
  assert.match(page, /popstate/);
  assert.match(track, /localhost/);
  assert.match(track, /gcTest/);
});
