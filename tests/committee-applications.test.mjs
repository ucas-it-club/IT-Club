import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { test } from "node:test";

const source = readFileSync("integrations/google-sheets/CommitteeApplications.gs", "utf8").replace(
  /spreadsheetId: "[^"]+"/,
  'spreadsheetId: "MOCK"',
);

function harness() {
  const tabs = new Map();
  const formats = [];
  const mkSheet = () => {
    const rows = [];
    const noop = new Proxy({}, { get: () => () => noop });
    const sheet = {
      rows,
      getLastRow: () => rows.length,
      getMaxRows: () => 1000,
      getLastColumn: () => Math.max(0, ...rows.map((row) => row.length)),
      getFilter: () => null,
      getBandings: () => [],
      setRightToLeft() {}, setFrozenRows() {}, setFrozenColumns() {}, setRowHeight() {}, setColumnWidth() {},
      getRange(row, col, n = 1, width = 1) {
        const range = new Proxy(
          {
            setValues(values) {
              values.forEach((v, i) => v.forEach((x, j) => ((rows[row - 1 + i] ??= [])[col - 1 + j] = x)));
              return range;
            },
            setRichTextValues: (values) => range.setValues(values.map((r) => r.map((v) => v.text))),
            setNumberFormat(format) { formats.push([row, col, format]); return range; },
            getDisplayValues: () =>
              Array.from({ length: n }, (_, i) => Array.from({ length: width }, (_, j) => String(rows[row - 1 + i]?.[col - 1 + j] ?? ""))),
            getValues: () => range.getDisplayValues(),
            createFilter() { return range; },
          },
          { get: (t, k) => t[k] ?? (() => range) },
        );
        return range;
      },
    };
    return sheet;
  };
  const context = vm.createContext({
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (t) => ({ setMimeType: () => JSON.parse(t) }) },
    Utilities: { formatDate: (_d, zone, pattern) => `${zone} ${pattern}` },
    SpreadsheetApp: {
      BandingTheme: { LIGHT_GREY: "grey" },
      openById: () => ({
        getSheetByName: (n) => tabs.get(n),
        insertSheet: (n) => (tabs.set(n, mkSheet()), tabs.get(n)),
        getUrl: () => "mock",
      }),
      newRichTextValue: () => { let t; return { setText(x) { t = x; return this; }, build: () => ({ text: t }) }; },
    },
  });
  vm.runInContext(source, context);
  return { tabs, formats, run: (code) => vm.runInContext(code, context), context };
}

const data = {
  committee: "activities", fullName: "اسم تجريبي", studentId: "220220001", major: "تصميم و برمجة صفحات الويب",
  studyYear: "2", whatsapp: "+972594890620", email: "a@smail.ucas.edu.ps", roles: ["x", "y"],
  hasExperience: "no", commitment: "full", hours: "2to4",
  ...Object.fromEntries(["why", "contribution", "skills", "lateTask", "outsidePreference", "eventIdea", "workshopPrep", "initiative", "teamIssue", "eventChange"].map((k) => [k, "إجابة طويلة كفاية"])),
};
const post = (h, body) => { h.context.__e = { postData: { contents: JSON.stringify(body) } }; return h.run("doPost(__e)"); };
const id = "00000000-0000-4000-8000-000000000001";

test("row is stored for people: Arabic committee and answers, Gaza time, plain text", () => {
  const h = harness();
  assert.deepEqual(post(h, { action: "apply", requestId: id, data }), { ok: true });
  const row = h.tabs.get("الأنشطة").rows[1];
  assert.equal(row[1], "Asia/Gaza yyyy-MM-dd HH:mm");
  assert.equal(row[2], "الأنشطة");
  assert.equal(row[5], "+972594890620");
  assert.equal(row[17], "أستطيع الالتزام بشكل كامل");
  assert.equal(row[18], "من ساعتين إلى 4 ساعات");
  assert.equal(row[12], "x، y");
  assert.ok(h.formats.some(([r, , f]) => r === 2 && f === "@"), "the row is plain text before it is written");
});

test("setup formats every tab without touching data; repairRows fixes old rows", () => {
  const h = harness();
  post(h, { action: "apply", requestId: id, data });
  h.run("setup()");
  const sheet = h.tabs.get("العلاقات العامة");
  sheet.rows.push(["id", "t", "relations", "n", "1", "972594890620"]);
  h.run("repairRows()");
  assert.equal(sheet.rows[1][2], "العلاقات العامة");
  assert.equal(sheet.rows[1][5], "+972594890620");
  assert.equal(h.tabs.get("الأنشطة").rows[1][5], "+972594890620", "already-correct rows are left alone");
});
