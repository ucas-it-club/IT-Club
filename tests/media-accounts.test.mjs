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
test("provisioning fixes the role and username server-side and never returns the password", async () => {
  const calls = [];
  const result = await handleMediaAccount(
    request({ username: "media_boy", password: "long-private-password", role: "super_admin" }),
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
  assert.equal(JSON.parse(calls[2].init.body).email, "media_boy@accounts.itclub.invalid");
  assert.equal((await result.text()).includes("long-private-password"), false);
});
test("unknown usernames cannot be provisioned", async () => {
  let n = 0;
  const result = await handleMediaAccount(
    request({ username: "admin", password: "long-private-password" }),
    config,
    async () => (++n === 1 ? response({ id: "owner" }) : response([{ role: "super_admin" }])),
  );
  assert.equal(result.status, 400);
  assert.equal(n, 2);
});
