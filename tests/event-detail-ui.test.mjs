import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

const detail = readFileSync("src/components/club/EventDetail.tsx", "utf8");
const pages = readFileSync("src/components/club/ClubPages.tsx", "utf8");
const content = readFileSync("src/components/club/ClubContent.tsx", "utf8");
const admin = readFileSync("src/components/club/AdminPanel.tsx", "utf8");

test("event details use a dedicated maintainable component", () => {
  assert.match(pages, /import \{ EventDetail \} from "\.\/EventDetail"/);
  assert.match(pages, /kind === "events"[\s\S]*<EventDetail event=\{item\} lang=\{lang\}/);
  assert.doesNotMatch(pages, /<EventRegistrationForm event=\{item\}/);
});

test("event layout keeps the image, presenter and information together on the desktop right", () => {
  assert.match(
    detail,
    /space-y-5 lg:col-start-2 lg:row-start-1[\s\S]*<figure[\s\S]*event-presenter-[\s\S]*event-information-/,
  );
  assert.match(detail, /space-y-8 lg:col-start-1 lg:row-start-1/);
  assert.match(detail, /lg:grid-cols-2/);
});

test("every event image is rendered in a horizontal 16:9 frame", () => {
  const imageClasses = [...detail.matchAll(/className="([^"]*aspect-video[^"]*)"/g)];
  assert.ok(imageClasses.length >= 3, "cover, fallback and gallery images must be horizontal");
  for (const [, className] of imageClasses) assert.match(className, /object-cover/);
  assert.doesNotMatch(detail, /aspect-\[(?:3\/4|4\/5|2\/3)\]/);
});

test("information section includes date, time, duration and event type", () => {
  for (const field of ["eventTime", "durationMinutes", "eventType", "eventType_en"]) {
    assert.match(detail, new RegExp(`\\b${field}\\b`));
  }
  assert.match(detail, /معلومات الفعالية/);
  assert.match(detail, /Event information/);
  assert.match(detail, /formatEventTime\(event\.eventTime, lang\)/);
  assert.match(detail, /formatEventDuration\(event\.durationMinutes, lang\)/);
});

test("admin enters event duration in hours while storage remains in minutes", () => {
  assert.match(admin, /مدة الفعالية بالساعات/);
  assert.match(admin, /Duration in hours/);
  assert.match(admin, /name="durationHours"/);
  assert.match(admin, /durationMinutes: Number\(values\["durationHours"\]\) \* 60/);
  assert.match(admin, /item\.durationMinutes \/ 60/);
});

test("news and events use Google Drive image links instead of uploads", () => {
  assert.match(admin, /صور Google Drive/);
  assert.match(admin, /name="durationHours"/);
  assert.match(admin, /googleDriveImageUrl\(driveImageLink\)/);
  assert.match(admin, /if \(isArticle\) value\.driveImageUrls = driveImageUrls/);
  assert.match(admin, /\{!isArticle && \([\s\S]*type="file"/);
});

test("presenter section supports localized name and one-line bio", () => {
  for (const field of ["presenterName", "presenterName_en", "presenterBio", "presenterBio_en"]) {
    assert.match(detail, new RegExp(`\\b${field}\\b`));
  }
  assert.match(detail, /مقدم الفعالية/);
  assert.match(detail, /Event presenter/);
});

test("registration uses the shared time-aware availability guard and opens on demand", () => {
  assert.match(detail, /eventRegistrationIsAvailable\(event\)/);
  assert.match(detail, /registrationAvailable && registrationOpen && <EventRegistrationForm/);
  assert.match(detail, /onClick=\{\(\) => setRegistrationOpen\(\(open\) => !open\)\}/);
  assert.match(detail, /eventHasEnded\(event\)/);
  assert.match(detail, /انتهت هذه الفعالية/);
});

test("expired upcoming events are presented and filtered as past events", () => {
  assert.match(content, /kind === "events" \? eventDisplayStatus\(item\)/);
  assert.match(pages, /eventDisplayStatus\(item, now\) === "past"/);
  assert.match(detail, /const displayStatus = eventDisplayStatus\(event\)/);
  assert.match(detail, /displayStatus === "past"/);
});

test("event sections retain theme-aware semantic color tokens", () => {
  for (const token of ["bg-card", "bg-background", "border-border", "text-muted-foreground"]) {
    assert.match(detail, new RegExp(`\\b${token}\\b`));
  }
});
