import { test } from "node:test";
import assert from "node:assert/strict";
import { hugShift } from "../src/components/club/hero-story.ts";

// Name 200 wide, centred at 500, with a 40 gap: arms rest with inner edges at 360 and 640.
const base = { gap: 40, slack: 20 };
const L = (edge, limit = -300) => hugShift({ ...base, side: "left", inner: 360, edge, limit });
const R = (edge, limit = 300) => hugShift({ ...base, side: "right", inner: 640, edge, limit });

test("a line as wide as the name leaves the arms where they rest", () => {
  assert.equal(L(400), 0);
  assert.equal(R(600), 0);
});

test("a slightly wider line does not move the arms", () => {
  assert.equal(L(385), 0);
  assert.equal(R(615), 0);
});

test("a narrower line never draws the arms in", () => {
  assert.equal(L(460), 0);
  assert.equal(R(540), 0);
});

test("a clearly wider line opens each arm to the gap plus the slack", () => {
  assert.equal(L(250), -170);
  assert.equal(R(750), 170);
});

test("an off-centre line moves each arm by its own side's edge", () => {
  assert.equal(L(300), -120);
  assert.equal(R(610), 0);
});

test("the arms never travel past the content width", () => {
  assert.equal(L(-500), -300);
  assert.equal(R(1500), 300);
});
