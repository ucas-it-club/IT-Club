import { test } from "node:test";
import assert from "node:assert/strict";
import { loginEmail } from "../src/lib/club/admin-access.ts";

test("all administrator-created usernames resolve consistently while existing email logins are preserved", () => {
  assert.equal(loginEmail("media_girl"), "media_girl@accounts.itclub.invalid");
  assert.equal(loginEmail("general_editor"), "general_editor@accounts.itclub.invalid");
  assert.equal(loginEmail(" TEAM_123 "), "team_123@accounts.itclub.invalid");
  assert.equal(loginEmail("itclub@ucas.edu.ps"), "itclub@ucas.edu.ps");
});
