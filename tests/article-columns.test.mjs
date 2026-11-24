import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { test } from "node:test";
import assert from "node:assert/strict";

// Issue #50: events and news are read and saved through typed columns, not `data`.
function compile(context = {}) {
  const source = readFileSync("src/lib/club/public-api.ts", "utf8").replaceAll(
    "import.meta.env",
    "({ SSR: true })",
  );
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, URL, URLSearchParams, AbortSignal, Response, ...context });
  return exports;
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const api = compile();

const eventRow = {
  title: "فعالية",
  title_en: "Event",
  description: "وصف",
  description_en: "Description",
  summary: "ملخص",
  summary_en: "Summary",
  images: ["https://example.org/a.webp"],
  drive_image_urls: ["https://drive.google.com/thumbnail?id=abcdefghij&sz=w2000"],
  date: "2026-11-10",
  status: "upcoming",
  event_time: "18:30",
  duration_minutes: 90,
  event_type: "ورشة",
  event_type_en: "Workshop",
  registration_enabled: true,
  registration_name_enabled: true,
  registration_phone_enabled: false,
  registration_attendance_enabled: true,
};

const event = {
  title: "فعالية",
  title_en: "Event",
  description: "وصف",
  description_en: "Description",
  summary: "ملخص",
  summary_en: "Summary",
  images: ["https://example.org/a.webp"],
  driveImageUrls: ["https://drive.google.com/thumbnail?id=abcdefghij&sz=w2000"],
  date: "2026-11-10",
  status: "upcoming",
  eventTime: "18:30",
  durationMinutes: 90,
  eventType: "ورشة",
  eventType_en: "Workshop",
  eventRegistration: {
    enabled: true,
    nameEnabled: true,
    phoneEnabled: false,
    attendanceEnabled: true,
  },
};

const bare = {
  title: "خبر",
  title_en: "News",
  description: "وصف",
  description_en: "Description",
  date: "2026-11-10",
};

test("an event row becomes the app's event shape", () => {
  assert.deepEqual(plain(api.articleFromRow("events", eventRow)), event);
});

test("null columns stay unset on read, and news always has featured", () => {
  const nulls = {
    ...bare,
    summary: null,
    summary_en: null,
    images: [],
    drive_image_urls: null,
    featured: null,
  };
  const news = api.articleFromRow("news", nulls);
  assert.deepEqual(plain(news), { ...bare, images: [], featured: false });
  assert.ok(!("driveImageUrls" in news) && !("summary" in news));
  assert.equal(api.articleFromRow("news", { ...nulls, featured: true }).featured, true);

  const sparse = api.articleFromRow("events", {
    ...nulls,
    status: "past",
    event_time: null,
    duration_minutes: null,
    event_type: null,
    event_type_en: null,
    registration_enabled: null,
    registration_name_enabled: null,
    registration_phone_enabled: null,
    registration_attendance_enabled: null,
  });
  assert.deepEqual(plain(sparse), { ...bare, images: [], status: "past" });
  assert.ok(!("featured" in sparse) && !("eventRegistration" in sparse));
});

test("an event saves as columns and round-trips", () => {
  const row = api.articleToRow("events", {
    ...event,
    presenterName: "قديم",
    people: [],
    publicationStatus: "draft",
  });
  assert.deepEqual(plain(row), eventRow);
  assert.ok(!("data" in row) && !("presenterName" in row) && !("people" in row));
  assert.deepEqual(plain(api.articleFromRow("events", row)), event);
});

test("missing optional fields save as null, so an edit clears them", () => {
  assert.deepEqual(plain(api.articleToRow("news", bare)), {
    ...bare,
    summary: null,
    summary_en: null,
    images: [],
    drive_image_urls: null,
  });
  const row = api.articleToRow("events", { ...bare, status: "past" });
  for (const key of [
    "event_time",
    "duration_minutes",
    "event_type",
    "event_type_en",
    "registration_enabled",
    "registration_name_enabled",
    "registration_phone_enabled",
    "registration_attendance_enabled",
  ])
    assert.equal(row[key], null, key);
});

test("a news save never writes featured, so an edit keeps the flag", () => {
  assert.ok(!("featured" in api.articleToRow("news", { ...bare, featured: true })));
});

test("public reads select columns for events and news, not data", async () => {
  const calls = [];
  const fetcher = async (input) => {
    const url = new URL(input);
    calls.push(url);
    if (url.pathname.endsWith("club_news"))
      return Response.json([{ id: "n1", slug: "n", ...bare, images: [], featured: true }]);
    return Response.json([]);
  };
  const { data } = await compile({ fetch: fetcher }).loadPublic(fetcher);
  for (const table of ["club_events", "club_news"]) {
    const select = calls.find((url) => url.pathname.endsWith(table)).searchParams.get("select");
    assert.ok(!select.split(",").includes("data"), table);
    assert.ok(select.split(",").includes("title_en"), table);
  }
  assert.equal(data.news[0].title_en, "News");
  assert.equal(data.news[0].featured, true);
  assert.equal(data.news[0].slug, "n");
});
