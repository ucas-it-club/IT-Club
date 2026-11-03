import { test } from "node:test";
import assert from "node:assert/strict";
import { loginEmail } from "../src/lib/club/admin-access.ts";

test("login accepts normalized emails and rejects usernames or malformed emails", () => {
  assert.equal(loginEmail("  Admin@Example.com "), "admin@example.com");
  assert.equal(loginEmail("itclub@ucas.edu.ps"), "itclub@ucas.edu.ps");
  assert.equal(
    loginEmail("media_girl@accounts.itclub.invalid"),
    "media_girl@accounts.itclub.invalid",
  );
  for (const value of [
    "media_girl",
    "",
    "missing@",
    "a b@example.com",
    "a@@example.com",
    "a".repeat(244) + "@example.com",
  ]) {
    assert.throws(() => loginEmail(value), /valid email/);
  }
});
