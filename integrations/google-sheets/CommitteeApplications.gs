/**
 * Standalone Apps Script for the committee recruitment spreadsheet.
 * Set FORM_KIND=applications in Script Properties before deploying.
 */
const APPLICATIONS = {
  spreadsheetId: "1z-4RrH38b2WfFvdgLXzpVbOqf68Jb2-r4JljWbVnj00",
  tabs: { media: "الإعلام", relations: "العلاقات العامة", activities: "الأنشطة" },
};

const APPLICATION_HEADERS = [
  "معرّف الطلب", "التاريخ", "اللجنة", "الاسم الكامل", "الرقم الجامعي",
  "الواتساب", "البريد الإلكتروني", "التخصص", "السنة الدراسية", "لماذا الانضمام",
  "المساهمة", "المهارات", "المجالات", "الخبرة", "رابط الأعمال", "القيادة",
  "سبق المشاركة التطوعية", "الالتزام الأسبوعي", "الساعات الأسبوعية",
  "التأخر عن موعد التسليم", "مهمة خارج مجال التفضيل", "فكرة الفعالية والفائدة",
  "الاستعداد للورشة", "المبادرة عند ملاحظة نقص", "التعامل مع عدم التزام عضو",
  "التعامل مع تغيير مفاجئ",
];
const LEGACY_APPLICATION_HEADERS = [
  "معرّف الطلب", "التاريخ", "اللجنة", "الاسم الكامل", "الرقم الجامعي", "الواتساب", "البريد الإلكتروني",
  "لماذا الانضمام", "المهارات", "المجالات", "الخبرة", "رابط الأعمال", "القيادة", "التعهد",
  "التخصص والسنة الدراسية", "مساهمة المتقدم", "سبق المشاركة التطوعية", "الالتزام الأسبوعي", "الساعات الأسبوعية",
  "التأخر عن موعد التسليم", "مهمة خارج مجال التفضيل", "فكرة الفعالية والفائدة", "الاستعداد للورشة",
  "المبادرة عند ملاحظة نقص", "التعامل مع عدم التزام عضو", "التعامل مع تغيير مفاجئ", "التخصص المحدد", "السنة الدراسية المحددة",
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAJORS = [
  "تصميم و برمجة تطبيقات الموبايل", "تصميم و برمجة الألعاب الموبايل",
  "تصميم و برمجة صفحات الويب", "تكنولوجيا الوسائط المتعددة",
];
const SETTINGS_KEY = "APPLICATION_SETTINGS";
// The form sends short codes for these two answers; the sheet is read by people, so store the words.
const LABELS = {
  commitment: {
    full: "أستطيع الالتزام بشكل كامل", organised: "أستطيع الالتزام مع تنظيم وقتي",
    difficulty: "قد أواجه صعوبة في بعض الفترات", unsure: "لست متأكدًا من قدرتي على الالتزام",
  },
  hours: {
    lt2: "أقل من ساعتين", "2to4": "من ساعتين إلى 4 ساعات", "4to6": "من 4 إلى 6 ساعات",
    gt6: "أكثر من 6 ساعات", variable: "حسب طبيعة المهام والفعاليات",
  },
};
// A-D are frozen, so they stay narrow. Single-line columns (id, date, student id, phone, email)
// are clipped, never wrapped: a wrapped UUID or phone would stretch the whole row.
const COLUMN_WIDTHS = [100, 130, 110, 180, 110, 140, 250, 200, 70, 300, 300, 300, 200, 260, 180, 300,
  120, 200, 160, 300, 300, 300, 300, 300, 300, 300];
const SINGLE_LINE_COLUMNS = [1, 2, 5, 6, 7];
function label_(key, value) { return (LABELS[key] && LABELS[key][value]) || value; }

function response_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function fail_(code) { throw new Error(code); }
function errorResponse_(error) {
  const known = ["INVALID_INPUT", "ALREADY_REGISTERED", "BUSY", "NOT_CONFIGURED", "UNAUTHORIZED", "JOIN_CLOSED", "SHEET_HEADERS_CHANGED"];
  return response_({ ok: false, code: known.indexOf(error.message) >= 0 ? error.message : "SERVER_ERROR" });
}
function book_() {
  if (!APPLICATIONS.spreadsheetId || APPLICATIONS.spreadsheetId.indexOf("PASTE_") === 0)
    fail_("NOT_CONFIGURED");
  return SpreadsheetApp.openById(APPLICATIONS.spreadsheetId);
}
function sheet_(committee) {
  const tab = APPLICATIONS.tabs[committee];
  if (!tab) fail_("INVALID_INPUT");
  const book = book_();
  let sheet = book.getSheetByName(tab);
  if (!sheet) sheet = book.insertSheet(tab);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, APPLICATION_HEADERS.length).setValues([APPLICATION_HEADERS]);
    sheet.setRightToLeft(true);
    format_(sheet);
  } else {
    const lastColumn = sheet.getLastColumn();
    const actual = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    if (JSON.stringify(actual) === JSON.stringify(LEGACY_APPLICATION_HEADERS) ||
        (lastColumn < LEGACY_APPLICATION_HEADERS.length &&
          JSON.stringify(actual) === JSON.stringify(LEGACY_APPLICATION_HEADERS.slice(0, lastColumn)))) return sheet;
    if (actual[16] === "التعهد") {
      sheet.deleteColumn(17);
      actual.splice(16, 1);
    }
    if (JSON.stringify(actual) !== JSON.stringify(APPLICATION_HEADERS)) fail_("SHEET_HEADERS_CHANGED");
  }
  return sheet;
}
/** Layout only, never data. Run from setup(), not per request: it is slow. */
function format_(sheet) {
  const columns = APPLICATION_HEADERS.length;
  const rows = Math.max(sheet.getMaxRows() - 1, 1);
  sheet.getRange(1, 1, 1, columns).setBackground("#1b3a5c").setFontColor("#ffffff").setFontWeight("bold")
    .setHorizontalAlignment("center").setVerticalAlignment("middle").setWrap(true);
  sheet.setRowHeight(1, 48);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(4);
  COLUMN_WIDTHS.forEach((width, index) => sheet.setColumnWidth(index + 1, width));
  // Plain text everywhere: otherwise Sheets turns "+970…" into a number and drops the plus.
  const body = sheet.getRange(2, 1, rows, columns);
  body.setNumberFormat("@").setVerticalAlignment("top").setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  SINGLE_LINE_COLUMNS.forEach((column) =>
    sheet.getRange(2, column, rows, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP));
  if (!sheet.getFilter()) sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 2), columns).createFilter();
  if (sheet.getBandings().length === 0)
    body.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);
  // Rows saved earlier may carry a fixed height that cuts their text.
  if (sheet.getLastRow() > 1) sheet.autoResizeRows(2, sheet.getLastRow() - 1);
}
/** One-off: fixes rows saved before this version (lost "+" on WhatsApp, English committee ids). */
function repairRows() {
  return locked_(function () {
    Object.keys(APPLICATIONS.tabs).forEach(function (committee) {
      const sheet = sheet_(committee);
      const count = sheet.getLastRow() - 1;
      if (count < 1) return;
      // Read before changing the format: switching a cell to plain text changes what it reports.
      const committeeCells = sheet.getRange(2, 3, count, 1);
      const committeeNames = committeeCells.getDisplayValues()
        .map(function (row) { return [APPLICATIONS.tabs[row[0]] || row[0]]; });
      const phoneCells = sheet.getRange(2, 6, count, 1);
      const shown = phoneCells.getDisplayValues();
      const formulas = phoneCells.getFormulas();
      // "+970…" typed into an automatic cell becomes the formula =+970…, which shows only the digits.
      const phones = shown.map(function (row, index) {
        const formula = /^=\+?(\d{8,16})$/.exec(formulas[index][0]);
        const digits = formula ? formula[1] : row[0];
        return [/^\d{8,16}$/.test(digits) ? "+" + digits : digits];
      });
      committeeCells.setNumberFormat("@").setValues(committeeNames);
      phoneCells.setNumberFormat("@").setValues(phones);
    });
    return { repaired: true };
  });
}
function setup() {
  return locked_(function () {
    Object.keys(APPLICATIONS.tabs).forEach(function (committee) { format_(sheet_(committee)); });
    if (!PropertiesService.getScriptProperties().getProperty(SETTINGS_KEY))
      PropertiesService.getScriptProperties().setProperty(SETTINGS_KEY, JSON.stringify({ enabled: false, limit: 40 }));
    return { ready: true, spreadsheet: book_().getUrl(), registration: status_() };
  });
}
function locked_(operation) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) fail_("BUSY");
  try { return operation(); } finally { lock.releaseLock(); }
}
function settings_() {
  const raw = PropertiesService.getScriptProperties().getProperty(SETTINGS_KEY);
  if (!raw) return { enabled: false, limit: 40 };
  const value = JSON.parse(raw);
  if (typeof value.enabled !== "boolean" || !Number.isInteger(value.limit) || value.limit < 1 || value.limit > 100000)
    fail_("NOT_CONFIGURED");
  return value;
}
function rowCount_(sheet) {
  if (sheet.getLastRow() < 2) return 0;
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues()
    .filter((row) => !!row[0]).length;
}
function status_() {
  const config = settings_();
  const count = Object.keys(APPLICATIONS.tabs)
    .map((committee) => rowCount_(sheet_(committee)))
    .reduce((total, value) => total + value, 0);
  return { open: config.enabled && count < config.limit, enabled: config.enabled, limit: config.limit, count, remaining: Math.max(0, config.limit - count) };
}
function doGet() {
  try { return response_({ ok: true, registration: locked_(status_) }); }
  catch (error) { return errorResponse_(error); }
}
function text_(data, key, min, max) {
  if (typeof data[key] !== "string") fail_("INVALID_INPUT");
  const value = data[key].trim();
  if (value.length < min || value.length > max) fail_("INVALID_INPUT");
  return value;
}
function optional_(data, key, max) {
  if (data[key] === undefined || data[key] === null) return "";
  return text_(data, key, 0, max);
}
function validate_(data) {
  if (!data || typeof data !== "object" || !APPLICATIONS.tabs[data.committee]) fail_("INVALID_INPUT");
  const committee = data.committee;
  const studentId = text_(data, "studentId", 9, 9);
  const email = text_(data, "email", 3, 254);
  const major = text_(data, "major", 2, 200);
  const year = text_(data, "studyYear", 1, 1);
  const whatsapp = text_(data, "whatsapp", 9, 17);
  if (!/^\d{9}$/.test(studentId) || MAJORS.indexOf(major) < 0 || !/^[1-4]$/.test(year) ||
      !/^\+[0-9]{8,16}$/.test(whatsapp) || !/^[^\s@]+@smail\.ucas\.edu\.ps$/.test(email) ||
      !Array.isArray(data.roles) || data.roles.length < 1 || data.roles.length > 12)
    fail_("INVALID_INPUT");
  data.roles.forEach((role) => { if (typeof role !== "string" || role.trim().length < 1 || role.length > 120) fail_("INVALID_INPUT"); });
  const required = committee === "activities"
    ? ["why", "contribution", "skills", "commitment", "hours", "lateTask", "outsidePreference", "eventIdea", "workshopPrep", "initiative", "teamIssue", "eventChange"]
    : ["why", "skills", "experience"];
  required.forEach((key) => text_(data, key, ["experience", "commitment", "hours"].indexOf(key) >= 0 ? 1 : 10, 1000));
  if (committee === "activities") {
    if (["yes", "no"].indexOf(data.hasExperience) < 0) fail_("INVALID_INPUT");
    if (data.hasExperience === "yes") text_(data, "experience", 10, 1000);
    if (["full", "organised", "difficulty", "unsure"].indexOf(data.commitment) < 0) fail_("INVALID_INPUT");
    if (["lt2", "2to4", "4to6", "gt6", "variable"].indexOf(data.hours) < 0) fail_("INVALID_INPUT");
  }
  if (data.hasExperience !== undefined && ["yes", "no"].indexOf(data.hasExperience) < 0) fail_("INVALID_INPUT");
  if (data.portfolio && (!/^https:\/\//i.test(data.portfolio) || data.portfolio.length > 300)) fail_("INVALID_INPUT");
  if (data.leadership !== undefined && (typeof data.leadership !== "string" || data.leadership.length > 1000)) fail_("INVALID_INPUT");
  return [APPLICATIONS.tabs[committee], text_(data, "fullName", 2, 200), studentId, whatsapp, email, major, year,
    optional_(data, "why", 1000), optional_(data, "contribution", 1000), optional_(data, "skills", 1000),
    data.roles.join("، "), optional_(data, "experience", 1000), optional_(data, "portfolio", 300),
    optional_(data, "leadership", 1000),
    data.hasExperience === "yes" ? "نعم" : data.hasExperience === "no" ? "لا" : "",
    label_("commitment", optional_(data, "commitment", 50)), label_("hours", optional_(data, "hours", 50)), optional_(data, "lateTask", 1000),
    optional_(data, "outsidePreference", 1000), optional_(data, "eventIdea", 1000), optional_(data, "workshopPrep", 1000),
    optional_(data, "initiative", 1000), optional_(data, "teamIssue", 1000), optional_(data, "eventChange", 1000)];
}
function exists_(sheet, requestId) {
  if (sheet.getLastRow() < 2) return false;
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues().some((row) => row[0] === requestId);
}
function studentExists_(sheet, studentId) {
  return sheet.getLastRow() > 1 && sheet.getRange(2, 5, sheet.getLastRow() - 1, 1)
    .getDisplayValues().some((row) => row[0] === studentId);
}
function append_(sheet, values) {
  const cells = values.map((value) => SpreadsheetApp.newRichTextValue().setText(String(value)).build());
  const range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, cells.length);
  range.setNumberFormat("@").setRichTextValues([cells]).setWrap(true).setVerticalAlignment("top");
  sheet.autoResizeRows(range.getRow(), 1);
}
function requireAdmin_(token) {
  if (typeof token !== "string" || token.length < 20 || token.length > 10000) fail_("UNAUTHORIZED");
  const key = PropertiesService.getScriptProperties().getProperty("SUPABASE_PUBLISHABLE_KEY");
  if (!key) fail_("NOT_CONFIGURED");
  const options = { headers: { apikey: key, Authorization: "Bearer " + token }, muteHttpExceptions: true };
  const auth = UrlFetchApp.fetch("https://jxweaxenswbjpxxjmihb.supabase.co/auth/v1/user", options);
  if (auth.getResponseCode() !== 200) fail_("UNAUTHORIZED");
  const user = JSON.parse(auth.getContentText());
  if (!user.id) fail_("UNAUTHORIZED");
  const result = UrlFetchApp.fetch("https://jxweaxenswbjpxxjmihb.supabase.co/rest/v1/club_admins?select=role&id=eq." + encodeURIComponent(user.id), options);
  if (result.getResponseCode() !== 200) fail_("UNAUTHORIZED");
  const rows = JSON.parse(result.getContentText());
  if (!rows.length || rows[0].role !== "super_admin") fail_("UNAUTHORIZED");
}
function listApplications_(offset, limit) {
  const applications = [];
  Object.keys(APPLICATIONS.tabs).forEach(function (committee) {
    const sheet = sheet_(committee);
    if (sheet.getLastRow() < 2) return;
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const legacy = JSON.stringify(existingHeaders) === JSON.stringify(LEGACY_APPLICATION_HEADERS) ||
      (existingHeaders.length < LEGACY_APPLICATION_HEADERS.length && JSON.stringify(existingHeaders) === JSON.stringify(LEGACY_APPLICATION_HEADERS.slice(0, existingHeaders.length)));
    const width = existingHeaders.length;
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getDisplayValues();
    rows.forEach(function (row) {
      if (row[0]) {
        const answers = {};
        let applicant;
        if (legacy) {
          const labels = { "لماذا الانضمام": 7, "المساهمة": 15, "المهارات": 8, "المجالات": 9, "الخبرة": 10, "رابط الأعمال": 11, "القيادة": 12, "سبق المشاركة التطوعية": 16, "الالتزام الأسبوعي": 17, "الساعات الأسبوعية": 18, "التأخر عن موعد التسليم": 19, "مهمة خارج مجال التفضيل": 20, "فكرة الفعالية والفائدة": 21, "الاستعداد للورشة": 22, "المبادرة عند ملاحظة نقص": 23, "التعامل مع عدم التزام عضو": 24, "التعامل مع تغيير مفاجئ": 25 };
          Object.keys(labels).forEach(function (label) { answers[label] = row[labels[label]] || ""; });
          const study = String(row[14] || "").split(" - ");
          applicant = { major: row[26] || study[0] || "", studyYear: row[27] || study[1] || "" };
        } else {
          APPLICATION_HEADERS.slice(9).forEach(function (label, index) { answers[label] = row[index + 9] || ""; });
          applicant = { major: row[7], studyYear: row[8] };
        }
        applications.push({ id: row[0], submittedAt: row[1], committee: committee, committeeName: row[2], fullName: row[3], studentId: row[4], whatsapp: row[5], email: row[6], major: applicant.major, studyYear: applicant.studyYear, answers: answers });
      }
    });
  });
  applications.sort(function (a, b) { return b.submittedAt.localeCompare(a.submittedAt); });
  return { applications: applications.slice(offset, offset + limit), total: applications.length };
}
function doPost(event) {
  try {
    if (!event || !event.postData || event.postData.contents.length > 20000) fail_("INVALID_INPUT");
    const body = JSON.parse(event.postData.contents);
    if (!body || typeof body !== "object") fail_("INVALID_INPUT");
    if (body.action === "configure" || body.action === "listApplications") {
      requireAdmin_(body.accessToken);
      if (body.action === "configure") {
        if (typeof body.enabled !== "boolean" || !Number.isInteger(body.limit) || body.limit < 1 || body.limit > 100000) fail_("INVALID_INPUT");
        return response_(locked_(function () {
          PropertiesService.getScriptProperties().setProperty(SETTINGS_KEY, JSON.stringify({ enabled: body.enabled, limit: body.limit }));
          return { ok: true, registration: status_() };
        }));
      }
      const offset = body.offset === undefined ? 0 : body.offset;
      const limit = body.limit === undefined ? 50 : body.limit;
      if (!Number.isInteger(offset) || offset < 0 || offset > 100000 || !Number.isInteger(limit) || limit < 1 || limit > 100) fail_("INVALID_INPUT");
      return response_(Object.assign({ ok: true }, locked_(function () { return listApplications_(offset, limit); })));
    }
    if (body.action !== "apply" || typeof body.requestId !== "string" || !UUID_PATTERN.test(body.requestId)) fail_("INVALID_INPUT");
    const row = validate_(body.data);
    return response_(locked_(function () {
      const sheet = sheet_(body.data.committee);
      if (exists_(sheet, body.requestId)) return { ok: true, duplicate: true, registration: status_() };
      if (!status_().open) fail_("JOIN_CLOSED");
      if (studentExists_(sheet, row[2])) fail_("ALREADY_REGISTERED");
      append_(sheet, [body.requestId, Utilities.formatDate(new Date(), "Asia/Gaza", "yyyy-MM-dd HH:mm")].concat(row));
      return { ok: true, registration: status_() };
    }));
  } catch (error) { return errorResponse_(error); }
}
