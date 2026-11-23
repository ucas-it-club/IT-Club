import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { flipFrom, offScreen } from "../src/lib/club/card-slide.ts";

test("a card that stays animates from its old box to its new one", () => {
  const was = { left: 100, top: 50, width: 400, height: 225 };
  const now = { left: 600, top: 50, width: 200, height: 112.5 };
  assert.equal(flipFrom(was, now), "translate(-500px, 0px) scale(2, 2)");
});

test("a card that has not moved gets no offset", () => {
  const box = { left: 10, top: 20, width: 300, height: 200 };
  assert.equal(flipFrom(box, box), "translate(0px, 0px) scale(1, 1)");
});

test("off screen means fully past the viewport edge, not just past the card's own box", () => {
  const box = { left: 300, width: 700 };
  // Its right edge lands on the viewport's left edge.
  assert.equal(offScreen("left", box, 1280), "translateX(-1000px)");
  // Its left edge lands on the viewport's right edge.
  assert.equal(offScreen("right", box, 1280), "translateX(980px)");
});

// The slide used View Transitions, whose snapshots sat above the sticky header and stayed
// pinned while the page scrolled (#61). The cards now move in the page itself.
test("home stories animate in the page, not with a view transition", () => {
  const source = readFileSync("src/components/club/HomeNews.tsx", "utf8");
  assert.doesNotMatch(source, /startViewTransition|viewTransitionName/);
  assert.match(source, /slideCards\(/);
});
