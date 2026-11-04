import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

const detail = readFileSync("src/components/club/NewsDetail.tsx", "utf8");
const pages = readFileSync("src/components/club/ClubPages.tsx", "utf8");

test("news details use a dedicated maintainable component", () => {
  assert.match(pages, /import \{ NewsDetail \} from "\.\/NewsDetail"/);
  assert.match(pages, /kind === "news"[\s\S]*<NewsDetail news=\{item\} lang=\{lang\}/);
});

test("news body balances automatically across two newspaper columns on desktop", () => {
  assert.match(detail, /lg:columns-2/);
  assert.match(detail, /lg:\[column-fill:balance\]/);
  assert.match(detail, /lg:gap-12/);
  assert.match(detail, /break-after-avoid-column/);
  assert.doesNotMatch(detail, /splitRichTextAtHalf/);
});

test("news keeps the image and headline side by side above the two-column body", () => {
  assert.match(detail, /<figure[\s\S]*lg:col-start-2 lg:row-start-1/);
  assert.match(detail, /<header className="lg:col-start-1 lg:row-start-1"/);
  assert.match(detail, /lg:grid-cols-2/);
});

test("news images use horizontal frames", () => {
  const imageClasses = [...detail.matchAll(/className="([^"]*aspect-video[^"]*)"/g)];
  assert.ok(imageClasses.length >= 3, "cover, fallback and gallery images must be horizontal");
  for (const [, className] of imageClasses) assert.match(className, /object-cover/);
});

test("news content includes its headline, date, author and localized body", () => {
  assert.match(detail, /<h1/);
  assert.match(detail, /formattedNewsDate/);
  assert.match(detail, /siteName\[lang\]/);
  assert.match(detail, /local\(news, "description", lang\)/);
});

test("news design retains theme-aware semantic colors", () => {
  for (const token of ["bg-card", "bg-muted", "border-border", "text-muted-foreground"]) {
    assert.match(detail, new RegExp(`\\b${token}\\b`));
  }
});
