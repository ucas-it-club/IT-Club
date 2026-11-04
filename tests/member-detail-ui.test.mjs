import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cards = readFileSync("src/components/ui/information-drawer.tsx", "utf8");
const pages = readFileSync("src/components/club/ClubPages.tsx", "utf8");
const admin = readFileSync("src/components/club/AdminPanel.tsx", "utf8");
const detailPage = pages.slice(pages.indexOf("export function DetailPage"));
const memberPage = detailPage.match(/kind === "members" \? \(([\s\S]*?)\n      \) : \(/)?.[1];

test("member cards open the profile page using the member slug", () => {
  assert.match(cards, /to=\{hrefOf\(lang, `members\/\$\{member\.slug \|\| member\.id\}`\)\}/);
});

test("member profiles keep a compact portrait beside their details", () => {
  assert.ok(memberPage, "member profile page should be rendered");
  assert.match(memberPage, /grid-cols-\[128px_minmax\(0,1fr\)\]/);
  assert.match(memberPage, /sm:grid-cols-\[184px_minmax\(0,1fr\)\]/);
  assert.match(memberPage, /lg:grid-cols-\[232px_minmax\(0,1fr\)\]/);
  assert.match(memberPage, /max-w-\[232px\]/);
});

test("member biography and social links stay in the profile text column", () => {
  assert.ok(memberPage, "member profile page should be rendered");
  const details = memberPage.match(/<div className="min-w-0">([\s\S]*?)<\/div>\s*<\/div>/)?.[1];

  assert.ok(details, "member text column should be found");
  assert.match(details, /<RichText\s+value=\{local\(item, "description", lang\)\}/);
  assert.match(details, /\["githubUrl", "GitHub", Github\]/);
  assert.match(details, /\["linkedinUrl", "LinkedIn", Linkedin\]/);
});

test("admins can edit a separate Arabic and English title saved to the member record", () => {
  assert.match(admin, /المسمّى الظاهر على بطاقة العضو/);
  assert.match(admin, /\["role", "بالعربية", "Arabic", "نائب الرئيس"\]/);
  assert.match(admin, /\["role_en", "بالإنجليزية", "English", "Vice President"\]/);
  assert.match(admin, /value\.role = values\["role"\] \|\| ""/);
  assert.match(admin, /value\.role_en = values\["role_en"\] \|\| ""/);
});
