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
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAJORS = [
  "تصميم و برمجة تطبيقات الموبايل", "تصميم و برمجة الألعاب الموبايل",
  "تصميم و برمجة صفحات الويب", "تكنولوجيا الوسائط المتعددة",
];

function response_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function fail_(code) { throw new Error(code); }
function errorResponse_(error) {
  const known = ["INVALID_INPUT", "ALREADY_REGISTERED", "BUSY", "NOT_CONFIGURED"];
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
    sheet.getRange(1, 1, 1, APPLICATION_HEADERS.length).setValues([APPLICATION_HEADERS]).setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.setRightToLeft(true);
  } else {
    const actual = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (actual[16] === "التعهد") {
      sheet.deleteColumn(17);
      actual.splice(16, 1);
    }
    if (JSON.stringify(actual) !== JSON.stringify(APPLICATION_HEADERS)) fail_("SHEET_HEADERS_CHANGED");
  }
  return sheet;
}
function setup() {
  Object.keys(APPLICATIONS.tabs).forEach(sheet_);
  return { ready: true, spreadsheet: book_().getUrl() };
}
function doGet() { try { return response_({ ok: true, ready: true }); } catch (error) { return errorResponse_(error); } }
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
  data.roles.forEach((role) => { if (typeof role !== "string" || role.length < 1 || role.length > 120) fail_("INVALID_INPUT"); });
  return [committee, text_(data, "fullName", 2, 200), studentId, whatsapp, email, major, year,
    optional_(data, "why", 1000), optional_(data, "contribution", 1000), optional_(data, "skills", 1000),
    data.roles.join("، "), optional_(data, "experience", 1000), optional_(data, "portfolio", 300),
    optional_(data, "leadership", 1000),
    data.hasExperience === "yes" ? "نعم" : data.hasExperience === "no" ? "لا" : "",
    optional_(data, "commitment", 50), optional_(data, "hours", 50), optional_(data, "lateTask", 1000),
    optional_(data, "outsidePreference", 1000), optional_(data, "eventIdea", 1000), optional_(data, "workshopPrep", 1000),
    optional_(data, "initiative", 1000), optional_(data, "teamIssue", 1000), optional_(data, "eventChange", 1000)];
}
function exists_(sheet, requestId, studentId) {
  if (sheet.getLastRow() < 2) return false;
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues().some((row) => row[0] === requestId) ||
    sheet.getRange(2, 5, sheet.getLastRow() - 1, 1).getDisplayValues().some((row) => row[0] === studentId);
}
function append_(sheet, values) {
  const cells = values.map((value) => SpreadsheetApp.newRichTextValue().setText(String(value)).build());
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, cells.length).setRichTextValues([cells]).setWrap(true);
}
function doPost(event) {
  try {
    if (!event || !event.postData || event.postData.contents.length > 20000) fail_("INVALID_INPUT");
    const body = JSON.parse(event.postData.contents);
    if (body.action !== "apply" || !UUID_PATTERN.test(body.requestId)) fail_("INVALID_INPUT");
    const row = validate_(body.data);
    const sheet = sheet_(body.data.committee);
    if (exists_(sheet, body.requestId, row[2])) return response_({ ok: true, duplicate: true });
    append_(sheet, [body.requestId, new Date().toISOString()].concat(row));
    return response_({ ok: true });
  } catch (error) { return errorResponse_(error); }
}
