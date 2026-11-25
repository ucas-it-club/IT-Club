import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { flipFrom, pastEdge } from "../src/lib/club/card-slide.ts";

test("a card that stays animates from its old box to its new one", () => {
  const was = { left: 100, top: 50, width: 400, height: 225 };
  const now = { left: 600, top: 50, width: 200, height: 112.5 };
  assert.equal(flipFrom(was, now), "translate(-500px, 0px) scale(2, 2)");
});

test("a card that has not moved gets no offset", () => {
  const box = { left: 10, top: 20, width: 300, height: 200 };
  assert.equal(flipFrom(box, box), "translate(0px, 0px) scale(1, 1)");
});

test("a card enters and leaves across the stage's own edges, not the screen's", () => {
  const stage = { left: 100, width: 1080 };
  const big = { left: 100, width: 700 };
  const small = { left: 830, width: 350 };
  // Its right edge lands on the stage's left edge.
  assert.equal(pastEdge("left", big, stage), "translateX(-700px)");
  // Its left edge lands on the stage's right edge.
  assert.equal(pastEdge("right", small, stage), "translateX(350px)");
});

// The slide used View Transitions, whose snapshots sat above the sticky header and stayed
// pinned while the page scrolled (#61). The cards now move in the page itself.
test("home stories animate in the page, not with a view transition", () => {
  const source = readFileSync("src/components/club/HomeNews.tsx", "utf8");
  assert.doesNotMatch(source, /startViewTransition|viewTransitionName/);
  assert.match(source, /slideCards\(/);
});
