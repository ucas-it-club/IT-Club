import assert from "node:assert/strict";
import { test } from "node:test";
import { feedbackMarkdown, filterFeedback, isGithubIssueUrl } from "../src/lib/club/feedback.ts";

const item = (kind, status) => ({ id: kind + status, kind, status, message: "x" });
const items = [item("bug", "new"), item("bug", "done"), item("suggestion", "new")];

test("kind and status filters work together", () => {
  assert.equal(filterFeedback(items, "all", "all").length, 3);
  assert.deepEqual(
    filterFeedback(items, "bug", "new").map((i) => i.id),
    ["bugnew"],
  );
  assert.deepEqual(
    filterFeedback(items, "all", "new").map((i) => i.id),
    ["bugnew", "suggestionnew"],
  );
  assert.equal(filterFeedback(items, "suggestion", "done").length, 0);
});

test("only GitHub issue links are accepted", () => {
  assert.ok(isGithubIssueUrl("https://github.com/ucas-it-club/IT-Club/issues/69"));
  for (const url of [
    "http://github.com/ucas-it-club/IT-Club/issues/69",
    "https://github.com/ucas-it-club/IT-Club/pull/84",
    "https://github.com.evil.example/a/b/issues/1",
    "https://github.com/a/b/issues/1?x",
    "",
  ])
    assert.equal(isGithubIssueUrl(url), false, url);
});

const full = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "bug",
  message: "الزر لا يعمل\n\n# not a heading",
  name: "سارة",
  contact: "sara@example.invalid",
  page: "/en/events",
  lang: "ar",
  theme: "dark",
  device: "Mozilla/5.0 (iPhone)",
  status: "new",
  issue_url: null,
  created_at: "2026-11-24T10:00:00Z",
};

test("copied Markdown has the useful fields and never the visitor's name or contact", () => {
  const text = feedbackMarkdown([full, { ...full, id: "two", kind: "suggestion", page: null }]);
  for (const part of [
    "## Feedback 11111111-1111-4111-8111-111111111111",
    "- Kind: Bug report",
    "- Page: /en/events",
    "- Language: ar",
    "- Theme: dark",
    "- Device: Mozilla/5.0 (iPhone)",
    "- Date: 2026-11-24T10:00:00Z",
    "> الزر لا يعمل\n>\n> # not a heading",
    "## Feedback two",
    "- Kind: Suggestion",
  ])
    assert.ok(text.includes(part), part);
  assert.equal(text.split("---").length, 2, "items are separated");
  assert.equal(text.match(/- Page:/g).length, 1, "missing fields are left out");
  assert.ok(!text.includes("سارة") && !text.includes("sara@example.invalid"));
});
