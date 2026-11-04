import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { test } from "node:test";

function harness(kind = "join", options = {}) {
  const books = new Map(),
    props = new Map();
  let held = false;
  let nextSheetId = 100;

  function sheet() {
    const rows = [];
    const sheetId = nextSheetId++;
    return {
      getSheetId: () => sheetId,
      getLastRow: () => rows.length,
      setFrozenRows() {},
      setRightToLeft() {},
      getRange(row, col, n, width) {
        const range = {
          setValues(values) {
            values.forEach((v, i) => {
              rows[row - 1 + i] ??= [];
              v.forEach((x, j) => (rows[row - 1 + i][col - 1 + j] = x));
            });
            return range;
          },
          setRichTextValues(values) {
            return range.setValues(values.map((r) => r.map((v) => v.text)));
          },
          setFontWeight() {
            return range;
          },
          setWrap() {
            return range;
          },
          getValues() {
            return Array.from({ length: n }, (_, i) =>
              Array.from({ length: width }, (_, j) => rows[row - 1 + i]?.[col - 1 + j] ?? ""),
            );
          },
          getDisplayValues() {
            return range.getValues().map((r) => r.map(String));
          },
        };
        return range;
      },
    };
  }

  const context = vm.createContext({
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput(text) {
        return {
          setMimeType() {
            return JSON.parse(text);
          },
        };
      },
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty: (k) => props.get(k),
          setProperty(k, v) {
            props.set(k, v);
          },
        };
      },
    },
    LockService: {
      getScriptLock() {
        return {
          tryLock() {
            assert.equal(held, false);
            held = true;
            return true;
          },
          releaseLock() {
            held = false;
          },
        };
      },
    },
    SpreadsheetApp: {
      openById(id) {
        if (!books.has(id)) books.set(id, new Map());
        const b = books.get(id);
        return {
          getUrl: () => `https://docs.google.com/spreadsheets/d/${id}/edit`,
          getSheetByName: (n) => b.get(n),
          insertSheet(n) {
            const s = sheet();
            b.set(n, s);
            return s;
          },
        };
      },
      newRichTextValue() {
        return {
          setText(text) {
            return { build: () => ({ text }) };
          },
        };
      },
      flush() {},
    },
    Utilities: {
      formatDate(_date, timezone, format) {
        assert.equal(timezone, "Asia/Hebron");
        if (format === "yyyy-MM-dd") return options.today || "2026-10-06";
        if (format === "HH:mm") return options.time || "12:00";
        throw Error(`Unexpected date format: ${format}`);
      },
    },
    UrlFetchApp: {
      fetch(url) {
        if (url.includes("/auth/v1/user"))
          return mockFetchResponse(options.authenticated === false ? 401 : 200, {
            id: "admin-user",
          });
        if (url.includes("/rest/v1/club_admins"))
          return mockFetchResponse(200, [{ role: options.adminRole || "super_admin" }]);
        if (url.includes("/rest/v1/club_events")) {
          if (options.eventFetchStatus)
            return mockFetchResponse(options.eventFetchStatus, { message: "failed" });
          const event = options.event;
          return mockFetchResponse(200, event ? [{ id: options.eventId, data: event }] : []);
        }
        throw Error(`Unexpected fetch: ${url}`);
      },
    },
  });

  vm.runInContext(readFileSync("integrations/google-sheets/Code.gs", "utf8"), context);
  props.set("FORM_KIND", kind);
  context.setup();
  return {
    books,
    context,
    props,
    post: (b) => context.doPost({ postData: { contents: JSON.stringify(b) } }),
  };
}

function mockFetchResponse(status, value) {
  return {
    getResponseCode: () => status,
    getContentText: () => JSON.stringify(value),
  };
}

const data = {
  fullName: "Test Student",
  email: "test@smail.ucas.edu.ps",
  phone: "",
  studentId: "012345678",
  major: "تصميم و برمجة تطبيقات الموبايل",
  preferredCommittee: "media",
  message: '=HYPERLINK("test")',
};

const id = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const eventId = id(900);
const adminToken = "valid-admin-access-token-for-tests";

function eventHarness(eventPatch = {}, options = {}) {
  const event = {
    title: "Web Engineering Workshop",
    date: "2099-10-06",
    eventTime: "10:00",
    durationMinutes: 120,
    status: "upcoming",
    eventRegistration: {
      enabled: true,
      nameEnabled: true,
      phoneEnabled: true,
      attendanceEnabled: true,
    },
    ...eventPatch,
  };
  const result = harness("join", { eventId, event, ...options });
  result.props.set("SUPABASE_PUBLISHABLE_KEY", "public-key");
  return { ...result, event };
}

function linkEvent(post, title = "Untrusted browser title") {
  return post({
    action: "ensureEventSheet",
    accessToken: adminToken,
    eventId,
    title,
  });
}

function eventSignup(requestId = id(901), dataPatch = {}) {
  return {
    action: "eventRegister",
    eventId,
    requestId,
    data: {
      name: "Test Attendee",
      countryCode: "970",
      phone: "599123456",
      attendance: "yes",
      ...dataPatch,
    },
  };
}

test("closed by default; exactly 40 applications; duplicate retries do not count", () => {
  const { context, props, post } = harness();
  assert.equal(post({ action: "join", requestId: id(1), data }).code, "JOIN_CLOSED");
  props.set("JOIN_SETTINGS", JSON.stringify({ enabled: true, limit: 40 }));
  for (let n = 1; n <= 40; n++) {
    const result = post({
      action: "join",
      requestId: id(n),
      data: { ...data, studentId: String(n).padStart(9, "0") },
    });
    assert.equal(result.ok, true);
    assert.equal(result.registration.count, n);
  }
  assert.equal(post({ action: "join", requestId: id(41), data }).code, "JOIN_CLOSED");
  assert.equal(post({ action: "join", requestId: id(40), data }).duplicate, true);
  assert.equal(context.doGet().registration.count, 40);
  assert.equal(context.doGet().registration.open, false);
});

test("student duplicates rejected; contact independent; literal text preserved; unauthorized config rejected", () => {
  const { context, props, post } = harness();
  props.set("JOIN_SETTINGS", JSON.stringify({ enabled: true, limit: 40 }));
  assert.equal(post({ action: "join", requestId: id(1), data }).ok, true);
  assert.equal(post({ action: "join", requestId: id(2), data }).code, "ALREADY_REGISTERED");
  const stored = vm.runInContext("sheet_('join').getRange(2,1,1,9).getValues()[0]", context);
  assert.equal(stored[5], "012345678");
  assert.equal(stored[8], data.message);
  props.set("JOIN_SETTINGS", JSON.stringify({ enabled: false, limit: 40 }));
  assert.equal(
    harness("contact").post({
      action: "contact",
      requestId: id(3),
      data: { name: "Test Name", email: data.email, message: data.message },
    }).ok,
    true,
  );
  assert.equal(post({ action: "configure", enabled: true, limit: 99 }).code, "UNAUTHORIZED");
  assert.equal(context.doGet().registration.limit, 40);
  assert.equal(
    post({ action: "contact", requestId: id(4), data: { name: "x" } }).code,
    "INVALID_INPUT",
  );
});

test("separate contact deployment cannot accept join or configure registration", () => {
  const { post } = harness("contact");
  assert.equal(post({ action: "join", requestId: id(1), data }).code, "INVALID_INPUT");
  assert.equal(post({ action: "configure", enabled: true, limit: 100 }).code, "INVALID_INPUT");
});

test("join validates university email and numeric phone and student ID", () => {
  for (const patch of [
    { phone: "0571234567" },
    { phone: "05912345" },
    { phone: "05612345678" },
    { phone: "059abcdefg" },
    { email: "test@example.com" },
    { email: "test@smail.ucas.edu.ps.evil.com" },
    { studentId: "12345678" },
    { studentId: "12345678a" },
  ]) {
    const { props, post } = harness();
    props.set("JOIN_SETTINGS", JSON.stringify({ enabled: true, limit: 40 }));
    assert.equal(
      post({ action: "join", requestId: id(1), data: { ...data, ...patch } }).code,
      "INVALID_INPUT",
    );
  }
  for (const phone of ["056123456", "059123456", "0561234567", "0591234567", ""]) {
    const { props, post } = harness();
    props.set("JOIN_SETTINGS", JSON.stringify({ enabled: true, limit: 40 }));
    assert.equal(post({ action: "join", requestId: id(1), data: { ...data, phone } }).ok, true);
  }
});

test("event registration requires an admin-linked tab and stores the configured fields", () => {
  const { books, props, post } = eventHarness();
  assert.equal(post(eventSignup()).code, "EVENT_SHEET_MISSING");

  const linked = linkEvent(post);
  assert.equal(linked.ok, true);
  assert.equal(linked.sheet.linked, true);
  assert.match(linked.sheet.url, /^https:\/\/docs\.google\.com\/spreadsheets\//);

  const mapping = JSON.parse(props.get("EVENT_SHEETS"));
  assert.match(mapping[eventId].tabName, /Web Engineering Workshop/);
  assert.doesNotMatch(mapping[eventId].tabName, /Untrusted browser title/);
  const sheet = books
    .get("1v6RYlzZujoRSAHvOwsY_FQ7X5s3UOHW8E9b3SGxzcWg")
    .get(mapping[eventId].tabName);

  assert.equal(post(eventSignup()).ok, true);
  assert.deepEqual(
    sheet.getRange(2, 1, 1, 8).getValues()[0].map(String),
    [
      id(901),
      sheet.getRange(2, 2, 1, 1).getValues()[0][0],
      eventId,
      "Web Engineering Workshop",
      "Test Attendee",
      "970",
      "599123456",
      "نعم",
    ].map(String),
  );
});

test("event request IDs make network retries idempotent", () => {
  const { books, props, post } = eventHarness();
  assert.equal(linkEvent(post).ok, true);
  assert.equal(post(eventSignup(id(902))).ok, true);
  assert.equal(post(eventSignup(id(902))).duplicate, true);
  const mapping = JSON.parse(props.get("EVENT_SHEETS"));
  const sheet = books
    .get("1v6RYlzZujoRSAHvOwsY_FQ7X5s3UOHW8E9b3SGxzcWg")
    .get(mapping[eventId].tabName);
  assert.equal(sheet.getLastRow(), 2);
  assert.equal(post(eventSignup(id(903))).ok, true);
  assert.equal(sheet.getLastRow(), 3);
});

test("event registration validates real UUIDs and all enabled fields", () => {
  const { post } = eventHarness();
  assert.equal(linkEvent(post).ok, true);
  for (const body of [
    { ...eventSignup(), eventId: "------------------------------------" },
    { ...eventSignup(), eventId: "not-a-uuid" },
    { ...eventSignup(), requestId: "request-1" },
    eventSignup(id(904), { name: "x" }),
    eventSignup(id(905), { countryCode: "971" }),
    eventSignup(id(906), { phone: "59912" }),
    eventSignup(id(907), { phone: "59912abc" }),
    eventSignup(id(908), { attendance: "no" }),
  ]) {
    assert.equal(post(body).code, "INVALID_INPUT");
  }
});

test("disabled event fields are not required and are saved as empty cells", () => {
  const { books, props, post } = eventHarness({
    eventRegistration: {
      enabled: true,
      nameEnabled: false,
      phoneEnabled: false,
      attendanceEnabled: false,
    },
  });
  assert.equal(linkEvent(post).ok, true);
  assert.equal(post({ action: "eventRegister", eventId, requestId: id(909), data: {} }).ok, true);
  const mapping = JSON.parse(props.get("EVENT_SHEETS"));
  const sheet = books
    .get("1v6RYlzZujoRSAHvOwsY_FQ7X5s3UOHW8E9b3SGxzcWg")
    .get(mapping[eventId].tabName);
  assert.deepEqual(sheet.getRange(2, 5, 1, 4).getValues()[0], ["", "", "", ""]);
});

test("closed, disabled, missing and elapsed events reject registrations", () => {
  for (const eventPatch of [
    { status: "past" },
    { eventRegistration: { enabled: false } },
    { date: "2026-10-05" },
    { date: "2026-99-99" },
    { date: "2026-10-06", eventTime: "09:00", durationMinutes: 60 },
  ]) {
    const { post } = eventHarness(eventPatch);
    assert.equal(post(eventSignup()).code, "EVENT_CLOSED");
    assert.equal(linkEvent(post).code, "EVENT_CLOSED");
  }
  const { post } = eventHarness({}, { event: undefined });
  assert.equal(post(eventSignup()).code, "EVENT_CLOSED");
});

test("an upcoming event remains open before its local end time", () => {
  const { post } = eventHarness({
    date: "2026-10-06",
    eventTime: "13:00",
    durationMinutes: 60,
  });
  assert.equal(linkEvent(post).ok, true);
  assert.equal(post(eventSignup()).ok, true);
});

test("only validated event administrators can create or inspect event tabs", () => {
  for (const options of [
    { authenticated: false },
    { adminRole: "editor" },
    { adminRole: "media_editor" },
    { adminRole: "communications_editor" },
    { adminRole: "partnerships_editor" },
  ]) {
    const { post } = eventHarness({}, options);
    assert.equal(linkEvent(post).code, "UNAUTHORIZED");
    assert.equal(
      post({ action: "eventSheetStatus", accessToken: adminToken, eventId }).code,
      "UNAUTHORIZED",
    );
  }
  const { post } = eventHarness();
  assert.equal(
    post({ action: "eventSheetStatus", accessToken: adminToken, eventId: "x" }).code,
    "INVALID_INPUT",
  );
});

test("changed event headers stop writes instead of corrupting the tab", () => {
  const { books, props, post } = eventHarness();
  assert.equal(linkEvent(post).ok, true);
  const mapping = JSON.parse(props.get("EVENT_SHEETS"));
  const sheet = books
    .get("1v6RYlzZujoRSAHvOwsY_FQ7X5s3UOHW8E9b3SGxzcWg")
    .get(mapping[eventId].tabName);
  sheet.getRange(1, 1, 1, 1).setValues([["عنوان تم تغييره"]]);
  assert.equal(post(eventSignup()).code, "SHEET_HEADERS_CHANGED");
  assert.equal(sheet.getLastRow(), 1);
});

test("contact deployments reject every event action", () => {
  const { post } = harness("contact");
  for (const action of ["eventRegister", "eventSheetStatus", "ensureEventSheet"]) {
    assert.equal(post({ action, eventId, requestId: id(910), data: {} }).code, "INVALID_INPUT");
  }
});

test("events committee may create event tabs without controlling membership registration", () => {
  const { post } = eventHarness({}, { adminRole: "events_editor" });
  assert.equal(linkEvent(post).ok, true);
  assert.equal(post({ action: "eventSheetStatus", accessToken: adminToken, eventId }).ok, true);
  assert.equal(
    post({ action: "configure", accessToken: adminToken, enabled: true, limit: 50 }).code,
    "UNAUTHORIZED",
  );
});
