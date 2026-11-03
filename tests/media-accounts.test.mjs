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
const editorId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";

function deletionHttp({ callerRole = "super_admin", targetRole = "editor", status = 200 } = {}) {
  const calls = [];
  return {
    calls,
    http: async (url, init) => {
      calls.push({ url, init });
      if (calls.length === 1) return response({ id: ownerId });
      if (calls.length === 2) return response([{ role: callerRole }]);
      if (calls.length === 3) return response(targetRole ? [{ role: targetRole }] : []);
      if (calls.length === 4) return response({ id: editorId }, status);
      throw Error("Unexpected request");
    },
  };
}

test("deletion removes the Auth identity so the assignment cascades, for every editor type", async () => {
  for (const targetRole of ["editor", "media_editor", "partnerships_editor"]) {
    const mock = deletionHttp({ targetRole });
    const result = await handleMediaAccount(
      request({ action: "delete", id: editorId }),
      config,
      mock.http,
    );
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { deleted: true, id: editorId });
    assert.equal(mock.calls.length, 4);
    assert.equal(mock.calls[3].url, `${config.url}/auth/v1/admin/users/${editorId}`);
    assert.equal(mock.calls[3].init.method, "DELETE");
    assert.equal(mock.calls[3].init.headers.authorization, "Bearer server-only");
    assert.deepEqual(JSON.parse(mock.calls[3].init.body), { should_soft_delete: false });
    assert.equal(
      mock.calls.some(({ url, init }) => url.includes("/rest/") && init.method === "DELETE"),
      false,
    );
  }
});

test("deletion rejects unauthorized callers, self deletion, protected and missing accounts", async () => {
  for (const entry of [
    { callerRole: "editor", id: editorId, status: 403, count: 2 },
    { callerRole: "media_editor", id: editorId, status: 403, count: 2 },
    { callerRole: "partnerships_editor", id: editorId, status: 403, count: 2 },
    { id: ownerId, status: 403, count: 2 },
    { id: "invalid", status: 400, count: 2 },
    { id: editorId, targetRole: "super_admin", status: 403, count: 3 },
    { id: editorId, targetRole: "unknown", status: 403, count: 3 },
    { id: editorId, targetRole: null, status: 404, count: 3 },
  ]) {
    const mock = deletionHttp(entry);
    const result = await handleMediaAccount(
      request({ action: "delete", id: entry.id }),
      config,
      mock.http,
    );
    assert.equal(result.status, entry.status);
    assert.equal(mock.calls.length, entry.count);
    assert.equal(
      mock.calls.some(({ init }) => init.method === "DELETE"),
      false,
    );
  }
});

test("failed Auth deletion preserves the assignment and never reports success", async () => {
  const mock = deletionHttp({ status: 500 });
  const result = await handleMediaAccount(
    request({ action: "delete", id: editorId }),
    config,
    mock.http,
  );
  assert.equal(result.status, 502);
  assert.equal((await result.json()).deleted, undefined);
  assert.equal(mock.calls.length, 4);
});

test("deletion fails closed when account lookup fails or the service key is absent", async () => {
  const mock = deletionHttp();
  const missingSecret = await handleMediaAccount(
    request({ action: "delete", id: editorId }),
    { ...config, secret: "" },
    mock.http,
  );
  assert.equal(missingSecret.status, 503);
  assert.equal(mock.calls.length, 2);
  let count = 0;
  const failedLookup = await handleMediaAccount(
    request({ action: "delete", id: editorId }),
    config,
    async () => {
      count++;
      return count === 1
        ? response({ id: ownerId })
        : count === 2
          ? response([{ role: "super_admin" }])
          : response({}, 500);
    },
  );
  assert.equal(failedLookup.status, 502);
  assert.equal(count, 3);
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
    request({ email: "media.girl@example.com", password: "long-private-password" }),
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
      email: " Media.Boy@Example.com ",
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
  assert.equal(JSON.parse(calls[2].init.body).email, "media.boy@example.com");
  assert.equal((await result.text()).includes("long-private-password"), false);
});
test("invalid emails and elevated account types are rejected before creating identities", async () => {
  for (const body of [
    { email: "../admin", role: "editor" },
    { username: "old_username", role: "editor" },
    { email: "missing-domain@", role: "editor" },
    { email: "a b@example.com", role: "editor" },
    { email: "a@@example.com", role: "editor" },
    { email: "a".repeat(244) + "@example.com", role: "editor" },
    { email: "editor@example.com", role: "super_admin" },
    { email: "editor@example.com", role: "owner" },
    { email: "editor@example.com", role: null },
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

test("the administrator can create a general editor using an email address", async () => {
  const calls = [];
  const result = await handleMediaAccount(
    request({
      email: "editor@example.com",
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
  assert.equal(JSON.parse(calls[2].init.body).email, "editor@example.com");
});

test("email accounts default to the media role when the role is omitted", async () => {
  const calls = [];
  const result = await handleMediaAccount(
    request({ email: "media.girl@example.com", password: "long-private-password" }),
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
      email: "partners@example.com",
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
