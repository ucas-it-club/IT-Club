import assert from "node:assert/strict";
import { test } from "node:test";
import { filterFeedback, isGithubIssueUrl } from "../src/lib/club/feedback.ts";

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
