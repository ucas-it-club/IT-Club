import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { test } from "node:test";

function harness(role = "super_admin") {
  const books = new Map();
  const props = new Map([["SUPABASE_PUBLISHABLE_KEY", "test-publishable-key"]]);
  let locked = false;

  function makeSheet() {
    const rows = [];
    return {
      rows,
      getLastRow: () => rows.length,
      getLastColumn: () => Math.max(0, ...rows.map((row) => row.length)),
      getMaxRows: () => 1000,
      getFilter: () => null,
      getBandings: () => [],
      setFrozenRows() {},
      setFrozenColumns() {},
      setRowHeight() {},
      autoResizeRows() {},
      setColumnWidth() {},
      setRightToLeft() {},
      getRange(row, col, n, width) {
        // Layout calls (colours, widths, alignment) change nothing the tests read, so unknown methods chain.
        const range = new Proxy({
          setValues(values) {
            values.forEach((value, i) => {
              rows[row - 1 + i] ??= [];
              value.forEach((cell, j) => (rows[row - 1 + i][col - 1 + j] = cell));
            });
            return range;
          },
          setRichTextValues(values) {
            return range.setValues(values.map((line) => line.map((cell) => cell.text)));
          },
          setFontWeight() {
            return range;
          },
          setWrap() {
            return range;
          },
          getValues: () =>
            Array.from({ length: n }, (_, i) =>
              Array.from({ length: width }, (_, j) => rows[row - 1 + i]?.[col - 1 + j] ?? ""),
            ),
          // A formula cell like =+970… reports only its digits, as in Sheets.
          getDisplayValues: () =>
            range.getValues().map((line) => line.map((cell) => String(cell).replace(/^=\+?(\d+)$/, "$1"))),
          getFormulas: () =>
            range.getValues().map((line) => line.map((cell) => (String(cell).startsWith("=") ? String(cell) : ""))),
        }, { get: (target, key) => target[key] ?? (() => range) });
        return range;
      },
    };
  }

  const context = vm.createContext({
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (value) => ({ setMimeType: () => JSON.parse(value) }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => props.get(key),
        setProperty: (key, value) => props.set(key, value),
      }),
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => {
          assert.equal(locked, false);
          locked = true;
          return true;
        },
        releaseLock: () => {
          locked = false;
        },
      }),
    },
    Utilities: { formatDate: () => "2026-11-17 18:00" },
    SpreadsheetApp: {
      flush() {},
      BandingTheme: { LIGHT_GREY: "grey" },
      WrapStrategy: { WRAP: "wrap", CLIP: "clip" },
      openById(id) {
        if (!books.has(id)) books.set(id, new Map());
        const book = books.get(id);
        return {
          getUrl: () => `https://docs.google.com/spreadsheets/d/${id}/edit`,
          getSheetByName: (name) => book.get(name),
          insertSheet(name) {
            const sheet = makeSheet();
            book.set(name, sheet);
            return sheet;
          },
        };
      },
      newRichTextValue: () => ({ setText: (text) => ({ build: () => ({ text }) }) }),
    },
    UrlFetchApp: {
      fetch(url) {
        return url.includes("/auth/v1/user")
          ? {
              getResponseCode: () => 200,
              getContentText: () => JSON.stringify({ id: "admin-user" }),
            }
          : { getResponseCode: () => 200, getContentText: () => JSON.stringify([{ role }]) };
      },
    },
    encodeURIComponent,
    Date,
    JSON,
    Math,
  });
  vm.runInContext(
    readFileSync("integrations/google-sheets/CommitteeApplications.gs", "utf8"),
    context,
  );
  const post = (body) => context.doPost({ postData: { contents: JSON.stringify(body) } });
  const configure = (enabled, limit = 100) =>
    post({ action: "configure", accessToken: "valid-test-token-long-enough", enabled, limit });
  return { context, post, configure, books };
}

const requestId = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const committees = ["media", "relations", "activities"];
const makeApplication = (committee, n) => ({
  committee,
  fullName: `Student ${n}`,
  studentId: String(n).padStart(9, "0"),
  major: "تصميم و برمجة تطبيقات الموبايل",
  studyYear: "2",
  whatsapp: "+970591234567",
  email: `student${n}@smail.ucas.edu.ps`,
  why: "أرغب في تطوير مهاراتي والمساهمة في عمل النادي",
  skills: "أمتلك مهارات مناسبة وأستطيع التعاون مع الفريق",
  roles: [
    committee === "media" ? "التصميم الجرافيكي" : committee === "relations" ? "التفاوض" : "الأفكار",
  ],
  experience: committee === "activities" ? "" : "لا توجد خبرة سابقة",
  ...(committee === "activities"
    ? {
        contribution: "أستطيع المساعدة في التخطيط والتنظيم",
        hasExperience: "no",
        commitment: "organised",
        hours: "2to4",
        lateTask: "سأبلغ الفريق مبكرًا وأتفق معهم على خطة واضحة",
        outsidePreference: "سأساعد الفريق لأن نجاح العمل مسؤولية مشتركة",
        eventIdea: "ورشة عملية تعرف الطلاب بأدوات تقنية مفيدة",
        workshopPrep: "تأكيد المكان والمدرب والأجهزة والتسجيل والوقت",
        initiative: "سأنبه الفريق للمشكلة وأساعد في حلها",
        teamIssue: "سأتحدث مع العضو وأتعاون مع المسؤول لإيجاد حل",
        eventChange: "سأبلغ الفريق وأتبع الخطة البديلة المناسبة",
      }
    : {}),
});

test("committee application endpoint enforces admin settings and accepts 100 applications across all three committees", () => {
  const app = harness();
  app.context.setup();
  assert.equal(app.context.doGet().registration.open, false);
  assert.equal(app.configure(true, 100).registration.open, true);
  for (let i = 1; i <= 100; i++) {
    const committee = committees[(i - 1) % committees.length];
    const result = app.post({
      action: "apply",
      requestId: requestId(i),
      data: makeApplication(committee, i),
    });
    assert.equal(result.ok, true, `application ${i} for ${committee}: ${JSON.stringify(result)}`);
    assert.equal(result.registration.count, i);
  }
  assert.equal(app.context.doGet().registration.open, false);
  assert.equal(
    app.post({ action: "apply", requestId: requestId(101), data: makeApplication("media", 101) })
      .code,
    "JOIN_CLOSED",
  );
  const page = app.post({
    action: "listApplications",
    accessToken: "valid-test-token-long-enough",
    offset: 50,
    limit: 25,
  });
  assert.equal(page.total, 100);
  assert.equal(page.applications.length, 25);
  assert.ok(page.applications.every((application) => application.studentId.length === 9));
  const firstPage = app.post({
    action: "listApplications",
    accessToken: "valid-test-token-long-enough",
    offset: 0,
    limit: 25,
  });
  assert.equal(
    new Set([...page.applications, ...firstPage.applications].map((application) => application.id))
      .size,
    50,
  );
});

test("committee endpoint preserves retry and student-per-committee duplicate protection", () => {
  const app = harness();
  app.context.setup();
  app.configure(true, 10);
  const payload = { action: "apply", requestId: requestId(1), data: makeApplication("media", 1) };
  assert.equal(app.post(payload).ok, true);
  assert.equal(app.post(payload).duplicate, true);
  assert.equal(app.post({ ...payload, requestId: requestId(2) }).code, "ALREADY_REGISTERED");
  assert.equal(
    app.post({
      ...payload,
      requestId: requestId(3),
      data: { ...payload.data, committee: "relations" },
    }).ok,
    true,
  );
});

test("only super admins can configure registration or review applicant details", () => {
  const app = harness("admin");
  app.context.setup();
  assert.equal(app.configure(true, 10).code, "UNAUTHORIZED");
  assert.equal(
    app.post({ action: "listApplications", accessToken: "valid-test-token-long-enough" }).code,
    "UNAUTHORIZED",
  );
});

test("every committee validates its required answers on the server", () => {
  const app = harness();
  app.context.setup();
  app.configure(true, 20);
  for (const [index, committee] of committees.entries()) {
    const data = makeApplication(committee, index + 1);
    const missing = committee === "activities" ? "workshopPrep" : "why";
    delete data[missing];
    assert.equal(
      app.post({ action: "apply", requestId: requestId(index + 1), data }).code,
      "INVALID_INPUT",
      committee,
    );
  }
});

test("committee admin reads legacy shared-sheet rows without changing their columns", () => {
  const app = harness();
  app.context.setup();
  const media = app.context.sheet_("media");
  const legacyHeaders = [
    "معرّف الطلب",
    "التاريخ",
    "اللجنة",
    "الاسم الكامل",
    "الرقم الجامعي",
    "الواتساب",
    "البريد الإلكتروني",
    "لماذا الانضمام",
    "المهارات",
    "المجالات",
    "الخبرة",
    "رابط الأعمال",
    "القيادة",
    "التعهد",
    "التخصص والسنة الدراسية",
    "مساهمة المتقدم",
    "سبق المشاركة التطوعية",
    "الالتزام الأسبوعي",
    "الساعات الأسبوعية",
    "التأخر عن موعد التسليم",
    "مهمة خارج مجال التفضيل",
    "فكرة الفعالية والفائدة",
    "الاستعداد للورشة",
    "المبادرة عند ملاحظة نقص",
    "التعامل مع عدم التزام عضو",
    "التعامل مع تغيير مفاجئ",
    "التخصص المحدد",
    "السنة الدراسية المحددة",
  ];
  const values = Array.from({ length: legacyHeaders.length }, () => "");
  Object.assign(values, {
    0: requestId(900),
    1: "2026-11-17T10:00:00.000Z",
    2: "الإعلام",
    3: "Legacy Student",
    4: "012345678",
    7: "أريد دعم الفريق",
    8: "أجيد التصميم",
    9: "التصميم",
    10: "لا",
    14: "تصميم و برمجة تطبيقات الموبايل - 2",
    26: "تصميم و برمجة تطبيقات الموبايل",
    27: "2",
  });
  media.getRange(1, 1, 1, legacyHeaders.length).setValues([legacyHeaders]);
  media.getRange(2, 1, 1, values.length).setValues([values]);
  const response = app.post({
    action: "listApplications",
    accessToken: "valid-test-token-long-enough",
  });
  assert.equal(response.total, 1);
  assert.equal(response.applications[0].major, "تصميم و برمجة تطبيقات الموبايل");
  assert.equal(response.applications[0].studyYear, "2");
  assert.equal(response.applications[0].answers["المهارات"], "أجيد التصميم");
  assert.deepEqual(media.getRange(1, 1, 1, legacyHeaders.length).getValues()[0], legacyHeaders);
});

test("rows are stored for people: Arabic names and answers, plain-text phone, Gaza time", () => {
  const app = harness();
  app.context.setup();
  app.configure(true, 10);
  assert.equal(
    app.post({ action: "apply", requestId: requestId(1), data: makeApplication("activities", 1) }).ok,
    true,
  );
  const [record] = app.post({ action: "listApplications", accessToken: "valid-test-token-long-enough" })
    .applications;
  assert.equal(record.committeeName, "الأنشطة");
  assert.equal(record.whatsapp, "+970591234567");
  assert.equal(record.submittedAt, "2026-11-17 18:00");
  assert.equal(record.answers["الالتزام الأسبوعي"], "أستطيع الالتزام مع تنظيم وقتي");
  assert.equal(record.answers["الساعات الأسبوعية"], "من ساعتين إلى 4 ساعات");
});

test("repairRows restores the plus and the Arabic committee name on old rows only", () => {
  const app = harness();
  app.context.setup();
  const book = app.books.values().next().value;
  book.get("العلاقات العامة").rows.push(["id-1", "t", "relations", "n", "220220642", "972594890620"]);
  book.get("الإعلام").rows.push(["id-2", "t", "الإعلام", "n", "220220643", "+970567344834"]);
  app.context.repairRows();
  assert.deepEqual(book.get("العلاقات العامة").rows[1].slice(2, 6), ["العلاقات العامة", "n", "220220642", "+972594890620"]);
  assert.deepEqual(book.get("الإعلام").rows[1].slice(2, 6), ["الإعلام", "n", "220220643", "+970567344834"]);
});

test("repairRows also fixes phone cells that Sheets stored as a formula (=+970…)", () => {
  const app = harness();
  app.context.setup();
  const book = app.books.values().next().value;
  book.get("الأنشطة").rows.push(["id-3", "t", "activities", "n", "229000003", "=+970591234567"]);
  app.context.repairRows();
  assert.deepEqual(book.get("الأنشطة").rows[1].slice(2, 6), ["الأنشطة", "n", "229000003", "+970591234567"]);
});

test("repairRows turns old UTC timestamps into the sheet's Gaza-time format", () => {
  const app = harness();
  app.context.setup();
  const book = app.books.values().next().value;
  book.get("الإعلام").rows.push(["id-4", "2026-11-17T16:11:45.036Z", "الإعلام", "n", "1", "+970567344834"]);
  book.get("الإعلام").rows.push(["id-5", "2026-11-17 18:10", "الإعلام", "n", "2", "+970567344835"]);
  app.context.repairRows();
  assert.equal(book.get("الإعلام").rows[1][1], "2026-11-17 18:00");
  assert.equal(book.get("الإعلام").rows[2][1], "2026-11-17 18:10", "already-new dates are left alone");
});
