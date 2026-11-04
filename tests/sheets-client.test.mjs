import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { test } from "node:test";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);

function harness(responder, auth = {}) {
  const calls = [];
  let authCalls = 0;

  function load(path) {
    const exports = {};
    const js = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(js, {
      exports,
      AbortSignal,
      fetch: async (url, options) => {
        calls.push({ url, options });
        return responder(url, options);
      },
      require(name) {
        if (name === "./model") return load("src/lib/club/model.ts");
        if (name === "./supabase")
          return {
            supabase() {
              authCalls++;
              return {
                auth: {
                  getSession: async () => ({
                    data: {
                      session:
                        auth.session === undefined
                          ? { access_token: "test-session" }
                          : auth.session,
                    },
                    error: auth.error || null,
                  }),
                },
              };
            },
          };
        return require(name);
      },
    });
    return exports;
  }

  return { api: load("src/lib/club/sheets.ts"), calls, authCalls: () => authCalls };
}

const json = (value) => ({
  ok: true,
  headers: { get: () => "application/json" },
  json: async () => value,
});

const contact = {
  name: "Test Name",
  email: "test@example.com",
  message: "A sufficiently long message",
};
const eventId = "00000000-0000-4000-8000-000000000900";
const requestId = "00000000-0000-4000-8000-000000000901";

test("contact targets its deployment and never accesses Supabase; retries preserve ID", async () => {
  const h = harness(() => json({ ok: true }));
  await h.api.submitToSheet(false, contact, "request-1");
  await h.api.submitToSheet(false, contact, "request-1");
  assert.equal(h.authCalls(), 0);
  assert.match(h.calls[0].url, /AKfycbxbRhHH/);
  assert.equal(JSON.parse(h.calls[1].options.body).requestId, "request-1");
  assert.equal(h.calls[0].options.credentials, "omit");
  assert.notEqual(h.calls[0].options.mode, "no-cors");
});

test("HTML login pages, script errors and network failures cannot report success", async () => {
  for (const responder of [
    () => ({ ok: true, headers: { get: () => "text/html" } }),
    () => json({ ok: false, code: "JOIN_CLOSED" }),
    () => {
      throw Error("network");
    },
  ]) {
    const h = harness(responder);
    await assert.rejects(() => h.api.submitToSheet(false, contact, "request-1"));
    assert.equal(h.authCalls(), 0);
  }
});

test("configuration uses join deployment and authenticated session", async () => {
  const registration = { open: true, enabled: true, limit: 40, count: 1, remaining: 39 };
  const h = harness(() => json({ ok: true, registration }));
  await h.api.configureRegistration(true, 40);
  assert.equal(h.authCalls(), 1);
  assert.match(h.calls[0].url, /AKfycbxV5GRTE/);
  const body = JSON.parse(h.calls[0].options.body);
  assert.equal(body.accessToken, "test-session");
  assert.equal(body.action, "configure");
});

test("event signup sends only validated event fields to the join deployment", async () => {
  const h = harness(() => json({ ok: true }));
  await h.api.submitEventSignup(
    eventId,
    {
      name: "  Test Attendee  ",
      countryCode: "970",
      phone: "599123456",
      attendance: "yes",
      ignored: "must not leave the browser",
    },
    requestId,
  );
  assert.equal(h.authCalls(), 0);
  assert.equal(h.calls.length, 1);
  assert.match(h.calls[0].url, /AKfycbxV5GRTE/);
  assert.equal(h.calls[0].options.headers["Content-Type"], "text/plain;charset=utf-8");
  assert.deepEqual(JSON.parse(h.calls[0].options.body), {
    action: "eventRegister",
    eventId,
    requestId,
    data: {
      name: "Test Attendee",
      countryCode: "970",
      phone: "599123456",
      attendance: "yes",
    },
  });
});

test("event signup rejects invalid IDs and fields before making a request", async () => {
  const invalidCases = [
    ["not-a-uuid", {}, requestId],
    [eventId, {}, "request-1"],
    [eventId, { countryCode: "971" }, requestId],
    [eventId, { phone: "123" }, requestId],
    [eventId, { attendance: "no" }, requestId],
    [eventId, { name: "x".repeat(201) }, requestId],
  ];
  for (const args of invalidCases) {
    const h = harness(() => json({ ok: true }));
    await assert.rejects(() => h.api.submitEventSignup(...args));
    assert.equal(h.calls.length, 0);
    assert.equal(h.authCalls(), 0);
  }
});

test("event tab status and creation forward the current admin access token", async () => {
  const h = harness((_url, options) => {
    const body = JSON.parse(options.body);
    return json({
      ok: true,
      sheet: {
        linked: true,
        url: `https://docs.google.com/spreadsheets/d/test/edit#gid=${body.action === "eventSheetStatus" ? 1 : 2}`,
      },
    });
  });
  const status = await h.api.eventSheetStatus(eventId);
  const created = await h.api.ensureEventSheet(eventId, "Workshop");
  assert.equal(status.linked, true);
  assert.equal(created.linked, true);
  assert.equal(h.authCalls(), 2);
  assert.equal(h.calls.length, 2);
  const statusBody = JSON.parse(h.calls[0].options.body);
  const createBody = JSON.parse(h.calls[1].options.body);
  assert.deepEqual(statusBody, {
    action: "eventSheetStatus",
    eventId,
    accessToken: "test-session",
  });
  assert.deepEqual(createBody, {
    action: "ensureEventSheet",
    eventId,
    title: "Workshop",
    accessToken: "test-session",
  });
});

test("event tab calls reject invalid IDs before reading the admin session", async () => {
  const h = harness(() => json({ ok: true }));
  await assert.rejects(() => h.api.eventSheetStatus("------------------------------------"));
  await assert.rejects(() => h.api.ensureEventSheet("bad-id", "Workshop"));
  assert.equal(h.authCalls(), 0);
  assert.equal(h.calls.length, 0);
});

test("admin event calls require a current Supabase session", async () => {
  for (const auth of [{ session: null }, { error: new Error("expired") }]) {
    const h = harness(() => json({ ok: true }), auth);
    await assert.rejects(
      () => h.api.eventSheetStatus(eventId),
      (error) => error.message === "UNAUTHORIZED",
    );
    assert.equal(h.authCalls(), 1);
    assert.equal(h.calls.length, 0);
  }
});

test("event tab responses must match the linked-state contract", async () => {
  for (const sheet of [
    { linked: true },
    { linked: true, url: "not-a-url" },
    { linked: false, url: "https://example.com/unexpected" },
    { linked: "yes" },
  ]) {
    const h = harness(() => json({ ok: true, sheet }));
    await assert.rejects(() => h.api.eventSheetStatus(eventId));
  }
  const h = harness(() => json({ ok: true, sheet: { linked: false } }));
  assert.deepEqual(await h.api.eventSheetStatus(eventId), { linked: false });
});

test("event server failures never report a successful registration", async () => {
  for (const code of ["EVENT_CLOSED", "EVENT_SHEET_MISSING", "INVALID_INPUT", "BUSY"]) {
    const h = harness(() => json({ ok: false, code }));
    await assert.rejects(
      () => h.api.submitEventSignup(eventId, {}, requestId),
      (error) => error.message === code,
    );
  }
});

test("event registration errors have clear Arabic and English messages", () => {
  const closed = harness(() => json({})).api;
  assert.match(closed.submissionError(new closed.SheetsError("EVENT_CLOSED"), true), /غير متاح/);
  const missing = harness(() => json({})).api;
  assert.match(
    missing.submissionError(new missing.SheetsError("EVENT_SHEET_MISSING"), false),
    /No sheet is linked/,
  );
});

test("creating a tab cannot report success for an unlinked event", async () => {
  const h = harness(() => json({ ok: true, sheet: { linked: false } }));
  await assert.rejects(
    () => h.api.ensureEventSheet(eventId, "Workshop"),
    (e) => e.message === "EVENT_SHEET_MISSING",
  );
});
