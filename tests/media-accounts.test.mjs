import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMediaAccount } from "../supabase/functions/media-accounts/index.ts";
const config = { url: "https://test.invalid", key: "public", secret: "server-only" };
const response = (value, status = 200) => Response.json(value, { status });
const request = (body = {}, token = "session") =>
  new Request("https://test.invalid", {
    method: "POST",
    headers: token ? { authorization: "Bearer " + token } : {},
    body: JSON.stringify(body),
  });
test("provisioning rejects visitors and non-super users before creating identities", async () => {
  assert.equal(
    (
      await handleMediaAccount(request({}, ""), config, () => {
        throw Error("must not call");
      })
    ).status,
    401,
  );
  let calls = 0;
  const denied = await handleMediaAccount(
    request({ username: "media_girl", password: "long-private-password" }),
    config,
    async () => (++calls === 1 ? response({ id: "user" }) : response([{ role: "media_editor" }])),
  );
  assert.equal(denied.status, 403);
  assert.equal(calls, 2);
});
test("the administrator can create a media account with the selected type without returning its password", async () => {
  const calls = [];
  const result = await handleMediaAccount(
    request({
      username: "media_boy",
      password: "long-private-password",
      role: "media_editor",
      name: "Media team",
    }),
    config,
    async (url, init) => {
      calls.push({ url, init });
      return calls.length === 1
        ? response({ id: "owner" })
        : calls.length === 2
          ? response([{ role: "super_admin" }])
          : calls.length === 3
            ? response({ id: "new-user" })
            : response(null, 201);
    },
  );
  assert.equal(result.status, 201);
  assert.equal(JSON.parse(calls[3].init.body).role, "media_editor");
  assert.equal(JSON.parse(calls[3].init.body).name, "Media team");
  assert.equal(JSON.parse(calls[2].init.body).email, "media_boy@accounts.itclub.invalid");
  assert.equal((await result.text()).includes("long-private-password"), false);
});
test("invalid usernames and elevated account types are rejected before creating identities", async () => {
  for (const body of [
    { username: "../admin", role: "editor" },
    { username: "new_editor", role: "super_admin" },
    { username: "new_editor", role: "owner" },
    { username: "new_editor", role: null },
  ]) {
    let n = 0;
    const result = await handleMediaAccount(
      request({ ...body, password: "long-private-password" }),
      config,
      async () => (++n === 1 ? response({ id: "owner" }) : response([{ role: "super_admin" }])),
    );
    assert.equal(result.status, 400);
    assert.equal(n, 2);
  }
});

test("the administrator can create a general editor using a normal username", async () => {
  const calls = [];
  const result = await handleMediaAccount(
    request({
      username: "general_editor",
      name: "General editor",
      role: "editor",
      password: "long-private-password",
    }),
    config,
    async (url, init) => {
      calls.push({ url, init });
      return calls.length === 1
        ? response({ id: "owner" })
        : calls.length === 2
          ? response([{ role: "super_admin" }])
          : calls.length === 3
            ? response({ id: "new-user" })
            : response(null, 201);
    },
  );
  assert.equal(result.status, 201);
  assert.equal(JSON.parse(calls[3].init.body).role, "editor");
  assert.equal(JSON.parse(calls[2].init.body).email, "general_editor@accounts.itclub.invalid");
});

test("existing website clients can still create their named media accounts during rollout", async () => {
  const calls = [];
  const result = await handleMediaAccount(
    request({ username: "media_girl", password: "long-private-password" }),
    config,
    async (url, init) => {
      calls.push({ url, init });
      return calls.length === 1
        ? response({ id: "owner" })
        : calls.length === 2
          ? response([{ role: "super_admin" }])
          : calls.length === 3
            ? response({ id: "new-user" })
            : response(null, 201);
    },
  );
  assert.equal(result.status, 201);
  assert.equal(JSON.parse(calls[3].init.body).role, "media_editor");
});

test("the administrator can create an account explicitly assigned to partnerships", async () => {
  const calls = [];
  const result = await handleMediaAccount(
    request({
      username: "partnerships_team",
      name: "Partnerships team",
      role: "partnerships_editor",
      password: "long-private-password",
    }),
    config,
    async (url, init) => {
      calls.push({ url, init });
      return calls.length === 1
        ? response({ id: "owner" })
        : calls.length === 2
          ? response([{ role: "super_admin" }])
          : calls.length === 3
            ? response({ id: "new-user" })
            : response(null, 201);
    },
  );
  assert.equal(result.status, 201);
  assert.equal(JSON.parse(calls[3].init.body).role, "partnerships_editor");
});
