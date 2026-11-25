import assert from "node:assert/strict";
import test from "node:test";
import { askCategories, askQuestions, shuffle } from "../src/lib/club/ice-questions.ts";

// The interview set has 90 questions; the floor only catches an emptied or truncated pool.
test("pool has 80+ questions, every category filled, ids unique", () => {
  assert.ok(askQuestions.length >= 80);
  for (const { key } of askCategories)
    assert.ok(
      askQuestions.some((question) => question.category === key),
      key,
    );
  assert.equal(new Set(askQuestions.map((question) => question.id)).size, askQuestions.length);
});

test("shuffle keeps every question exactly once and leaves the input alone", () => {
  const before = askQuestions.map((question) => question.id);
  const out = shuffle(askQuestions);

  assert.deepEqual(
    askQuestions.map((question) => question.id),
    before,
  );
  assert.equal(out.length, askQuestions.length);
  assert.deepEqual(out.map((q) => q.id).sort(), [...before].sort());
});

test("shuffle uses the given random source", () => {
  assert.deepEqual(
    shuffle([1, 2, 3, 4], () => 0),
    [2, 3, 4, 1],
  );
  assert.deepEqual(
    shuffle([], () => 0.5),
    [],
  );
});
