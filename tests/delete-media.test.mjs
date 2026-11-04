import assert from "node:assert/strict";
import { test } from "node:test";
import { handleDeleteMedia } from "../supabase/functions/delete-media/index.ts";

const id = "2922a347-0c4a-4f03-b9b2-295b20387a3f";
const path = "editor/photo.webp";
const config = { url: "https://example.supabase.co", key: "sb_publishable_test" };

function request(assetId = id) {
  return new Request("https://example.supabase.co/functions/v1/delete-media", {
    method: "POST",
    headers: { authorization: "Bearer user-token", "content-type": "application/json" },
    body: JSON.stringify({ assetId }),
  });
}

test("media deletion reaches Storage on the server and removes the record last", async () => {
  const calls = [];
  const responses = [Response.json(path), Response.json([{ name: path }]), Response.json([{ id }])];
  const http = async (url, init) => {
    calls.push({ url, init });
    return responses.shift();
  };

  const result = await handleDeleteMedia(request(), config, http);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { deleted: true });
  assert.deepEqual(
    calls.map((call) => call.init.method),
    ["POST", "DELETE", "DELETE"],
  );
  assert.deepEqual(JSON.parse(calls[1].init.body), { prefixes: [path] });
  assert.equal(calls[1].init.headers.authorization, "Bearer user-token");
  assert.match(calls[2].url, /club_media\?id=eq\./);
});

test("unauthenticated and malformed requests never touch the database", async () => {
  let calls = 0;
  const http = async () => {
    calls++;
    throw new Error("unexpected network call");
  };
  const anonymous = new Request("https://example.supabase.co/functions/v1/delete-media", {
    method: "POST",
    body: JSON.stringify({ assetId: id }),
  });
  assert.equal((await handleDeleteMedia(anonymous, config, http)).status, 401);
  assert.equal((await handleDeleteMedia(request("bad-id"), config, http)).status, 400);
  assert.equal(calls, 0);
});

test("an in-use image is rejected before Storage is called", async () => {
  let calls = 0;
  const http = async () => {
    calls++;
    return Response.json({ message: "Image is used by published content" }, { status: 400 });
  };
  const result = await handleDeleteMedia(request(), config, http);
  assert.equal(result.status, 400);
  assert.deepEqual(await result.json(), { error: "Image is used by published content" });
  assert.equal(calls, 1);
});

test("a Storage failure leaves the image record intact for retry", async () => {
  const methods = [];
  const http = async (_url, init) => {
    methods.push(init.method);
    return methods.length === 1
      ? Response.json(path)
      : Response.json({ message: "Storage unavailable" }, { status: 503 });
  };
  const result = await handleDeleteMedia(request(), config, http);
  assert.equal(result.status, 502);
  assert.deepEqual(methods, ["POST", "DELETE"]);
});
