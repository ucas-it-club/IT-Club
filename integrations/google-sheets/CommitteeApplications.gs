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
const COLUMN_WIDTHS = [60, 120, 90, 160, 100, 130, 210, 190, 70, 260, 260, 260, 190, 230, 170, 260,
  110, 190, 150, 260, 260, 260, 260, 260, 260, 260];
function label_(key, value) { return (LABELS[key] && LABELS[key][value]) || value; }

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
    sheet.getRange(1, 1, 1, APPLICATION_HEADERS.length).setValues([APPLICATION_HEADERS]);
    sheet.setRightToLeft(true);
    format_(sheet);
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
/** Layout only, never data. Run from setup(), not per request: it is slow. */
function format_(sheet) {
  const columns = APPLICATION_HEADERS.length;
  sheet.getRange(1, 1, 1, columns).setBackground("#1b3a5c").setFontColor("#ffffff").setFontWeight("bold")
    .setHorizontalAlignment("center").setVerticalAlignment("middle").setWrap(true);
  sheet.setRowHeight(1, 38);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(4);
  COLUMN_WIDTHS.forEach((width, index) => sheet.setColumnWidth(index + 1, width));
  // Plain text everywhere: otherwise Sheets turns "+970…" into a number and drops the plus.
  sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), columns)
    .setNumberFormat("@").setVerticalAlignment("top").setWrap(true);
  if (!sheet.getFilter()) sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 2), columns).createFilter();
  if (sheet.getBandings().length === 0)
    sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), columns)
      .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);
}
function setup() {
  Object.keys(APPLICATIONS.tabs).forEach((committee) => format_(sheet_(committee)));
  return { ready: true, spreadsheet: book_().getUrl() };
}
/** One-off: fixes rows saved before this version (lost "+" on WhatsApp, English committee ids). */
function repairRows() {
  Object.keys(APPLICATIONS.tabs).forEach((committee) => {
    const sheet = sheet_(committee);
    const count = sheet.getLastRow() - 1;
    if (count < 1) return;
    const committeeCells = sheet.getRange(2, 3, count, 1);
    committeeCells.setNumberFormat("@").setValues(committeeCells.getDisplayValues()
      .map((row) => [APPLICATIONS.tabs[row[0]] || row[0]]));
    const phoneCells = sheet.getRange(2, 6, count, 1);
    phoneCells.setNumberFormat("@").setValues(phoneCells.getDisplayValues()
      .map((row) => [/^\d{8,16}$/.test(row[0]) ? "+" + row[0] : row[0]]));
  });
}
function rowCount_(sheet) {
  if (sheet.getLastRow() < 2) return 0;
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues()
    .filter((row) => !!row[0]).length;
}
function status_() {
  const limit = 40;
  const count = Object.keys(APPLICATIONS.tabs)
    .map((committee) => rowCount_(sheet_(committee)))
    .reduce((total, value) => total + value, 0);
  return { open: count < limit, enabled: true, limit, count, remaining: Math.max(0, limit - count) };
}
function doGet() {
  try { return response_({ ok: true, registration: status_() }); }
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
  data.roles.forEach((role) => { if (typeof role !== "string" || role.length < 1 || role.length > 120) fail_("INVALID_INPUT"); });
  return [APPLICATIONS.tabs[committee], text_(data, "fullName", 2, 200), studentId, whatsapp, email, major, year,
    optional_(data, "why", 1000), optional_(data, "contribution", 1000), optional_(data, "skills", 1000),
    data.roles.join("، "), optional_(data, "experience", 1000), optional_(data, "portfolio", 300),
    optional_(data, "leadership", 1000),
    data.hasExperience === "yes" ? "نعم" : data.hasExperience === "no" ? "لا" : "",
    label_("commitment", optional_(data, "commitment", 50)), label_("hours", optional_(data, "hours", 50)), optional_(data, "lateTask", 1000),
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
  const range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, cells.length);
  range.setNumberFormat("@").setRichTextValues([cells]).setWrap(true).setVerticalAlignment("top");
}
function doPost(event) {
  try {
    if (!event || !event.postData || event.postData.contents.length > 20000) fail_("INVALID_INPUT");
    const body = JSON.parse(event.postData.contents);
    if (body.action !== "apply" || !UUID_PATTERN.test(body.requestId)) fail_("INVALID_INPUT");
    const row = validate_(body.data);
    const sheet = sheet_(body.data.committee);
    if (exists_(sheet, body.requestId, row[2])) return response_({ ok: true, duplicate: true });
    append_(sheet, [body.requestId, Utilities.formatDate(new Date(), "Asia/Gaza", "yyyy-MM-dd HH:mm")].concat(row));
    return response_({ ok: true });
  } catch (error) { return errorResponse_(error); }
}
