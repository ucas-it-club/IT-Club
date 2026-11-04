import assert from "node:assert/strict";
import { test } from "node:test";
import {
  eventDisplayStatus,
  eventHasEnded,
  eventRegistrationIsAvailable,
  formatEventDuration,
  formatEventTime,
} from "../src/lib/club/event-timing.ts";

const base = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "فعالية",
  title_en: "Event",
  description: "وصف الفعالية",
  description_en: "Event description",
  images: [],
  date: "2026-10-06",
  eventTime: "13:00",
  durationMinutes: 120,
  status: "upcoming",
  eventRegistration: {
    enabled: true,
    nameEnabled: true,
    phoneEnabled: true,
    attendanceEnabled: true,
  },
};

test("event timing uses Asia/Hebron and closes at the configured end time", () => {
  assert.equal(eventHasEnded(base, new Date("2026-10-06T10:59:00Z")), false);
  assert.equal(eventHasEnded(base, new Date("2026-10-06T12:00:00Z")), true);
  assert.equal(eventDisplayStatus(base, new Date("2026-10-06T10:59:00Z")), "upcoming");
  assert.equal(eventDisplayStatus(base, new Date("2026-10-06T12:00:00Z")), "past");
});

test("events that cross midnight remain upcoming until their duration ends", () => {
  const overnight = { ...base, eventTime: "23:30", durationMinutes: 120 };
  assert.equal(eventDisplayStatus(overnight, new Date("2026-10-06T21:59:00Z")), "upcoming");
  assert.equal(eventDisplayStatus(overnight, new Date("2026-10-06T22:30:00Z")), "past");
});

test("past status and past dates close registration", () => {
  assert.equal(eventRegistrationIsAvailable({ ...base, status: "past" }), false);
  assert.equal(
    eventHasEnded({ ...base, date: "2026-10-05" }, new Date("2026-10-06T08:00:00Z")),
    true,
  );
});

test("future enabled events stay open while disabled events remain closed", () => {
  const now = new Date("2026-10-06T08:00:00Z");
  assert.equal(eventRegistrationIsAvailable({ ...base, date: "2026-10-07" }, now), true);
  assert.equal(
    eventRegistrationIsAvailable(
      { ...base, eventRegistration: { ...base.eventRegistration, enabled: false } },
      now,
    ),
    false,
  );
});

test("legacy upcoming events without detailed timing keep their status-based behavior", () => {
  assert.equal(
    eventRegistrationIsAvailable({
      ...base,
      date: undefined,
      eventTime: undefined,
      durationMinutes: undefined,
    }),
    true,
  );
});

test("event times are displayed using a localized 12-hour clock", () => {
  assert.equal(formatEventTime("00:05", "en"), "12:05 AM");
  assert.equal(formatEventTime("13:30", "en"), "1:30 PM");
  assert.match(formatEventTime("13:30", "ar"), /١:٣٠\s*م/);
  assert.equal(formatEventTime("24:00", "ar"), "");
});

test("event durations are displayed in localized hours", () => {
  assert.equal(formatEventDuration(60, "en"), "1 hour");
  assert.equal(formatEventDuration(120, "en"), "2 hours");
  assert.equal(formatEventDuration(90, "en"), "1.5 hours");
  assert.match(formatEventDuration(90, "ar"), /١٫٥ ساعة/);
  assert.equal(formatEventDuration(0, "ar"), "");
});
