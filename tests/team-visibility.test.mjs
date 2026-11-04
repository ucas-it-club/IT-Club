import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { isUnavailableSection } from "../src/lib/club/model.ts";

const data = {
  members: [{ id: "member-1" }],
  events: [{ id: "event-1" }],
  news: [],
  partners: [],
};

test("team visibility hides populated team routes while remaining visible by default", () => {
  assert.equal(isUnavailableSection("members", data, { teamVisible: false }), true);
  assert.equal(isUnavailableSection("members", data, { teamVisible: true }), false);
  assert.equal(isUnavailableSection("members", data, {}), false);
  assert.equal(isUnavailableSection("events", data, { teamVisible: false }), false);
  assert.equal(isUnavailableSection("news", data, { teamVisible: false }), true);
});

test("admin, navigation, footer and route loader share the persisted visibility setting", () => {
  const admin = readFileSync("src/components/club/AdminPanel.tsx", "utf8");
  const site = readFileSync("src/components/club/ClubSite.tsx", "utf8");
  const footer = readFileSync("src/components/club/SiteFooter.tsx", "utf8");
  const route = readFileSync("src/lib/club/page-route.ts", "utf8");

  assert.match(admin, /setTeamVisibility\(nextVisible\)/);
  assert.match(admin, /إخفاء تبويبة الفريق/);
  assert.match(admin, /إظهار تبويبة الفريق/);
  assert.match(site, /isUnavailableSection\(path, data, settings\)/);
  assert.match(footer, /isUnavailableSection\(path, data, settings\)/);
  assert.match(route, /isUnavailableSection\(kind, loaded\.data, loaded\.settings\)/);
});
