/** Set FORM_KIND to contact or join in this Apps Script project properties. */
const CLUB = {
  contactSheet: "1-k2MvrFu2lvOq0ypMJCo-Zs_Q2lw3MD7_sTNAXUi6rc",
  joinSheet: "1v6RYlzZujoRSAHvOwsY_FQ7X5s3UOHW8E9b3SGxzcWg",
  supabaseUrl: "https://jxweaxenswbjpxxjmihb.supabase.co",
  contactTab: "رسائل الموقع",
  joinTab: "طلبات الموقع",
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAJORS = [
  "تصميم و برمجة تطبيقات الموبايل",
  "تصميم و برمجة الألعاب الموبايل",
  "تصميم و برمجة صفحات الويب",
  "تكنولوجيا الوسائط المتعددة",
];
const HEADERS = {
  contact: ["معرّف الطلب", "التاريخ", "الاسم", "البريد الإلكتروني", "الرسالة"],
  join: [
    "معرّف الطلب",
    "التاريخ",
    "الاسم الكامل",
    "البريد الإلكتروني",
    "الهاتف",
    "الرقم الجامعي",
    "التخصص",
    "اللجنة",
    "عرّفنا بنفسك",
  ],
};

function response_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
function fail_(code) {
  throw new Error(code);
}
function errorResponse_(error) {
  const known = [
    "INVALID_INPUT",
    "UNAUTHORIZED",
    "JOIN_CLOSED",
    "EVENT_CLOSED",
    "EVENT_SHEET_MISSING",
    "ALREADY_REGISTERED",
    "BUSY",
    "NOT_CONFIGURED",
    "SHEET_HEADERS_CHANGED",
  ];
  const code = known.indexOf(error.message) >= 0 ? error.message : "SERVER_ERROR";
  return response_({ ok: false, code: code });
}
function locked_(operation) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) fail_("BUSY");
  try {
    return operation();
  } finally {
    lock.releaseLock();
  }
}
function sheet_(kind) {
  const contact = kind === "contact";
  const book = SpreadsheetApp.openById(contact ? CLUB.contactSheet : CLUB.joinSheet);
  const name = contact ? CLUB.contactTab : CLUB.joinTab;
  let sheet = book.getSheetByName(name);
  if (!sheet) sheet = book.insertSheet(name);
  const headers = HEADERS[kind];
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.setRightToLeft(true);
  } else {
    const actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    if (JSON.stringify(actual) !== JSON.stringify(headers)) fail_("SHEET_HEADERS_CHANGED");
  }
  return sheet;
}
function formKind_() {
  const kind = PropertiesService.getScriptProperties().getProperty("FORM_KIND");
  if (kind !== "contact" && kind !== "join") fail_("NOT_CONFIGURED");
  return kind;
}
function settings_() {
  const raw = PropertiesService.getScriptProperties().getProperty("JOIN_SETTINGS");
  return raw ? JSON.parse(raw) : { enabled: false, limit: 40 };
}
function status_() {
  const config = settings_();
  const sheet = sheet_("join");
  const count =
    sheet.getLastRow() > 1
      ? sheet
          .getRange(2, 1, sheet.getLastRow() - 1, 1)
          .getValues()
          .filter(function (row) {
            return !!row[0];
          }).length
      : 0;
  return {
    open: config.enabled && count < config.limit,
    enabled: config.enabled,
    limit: config.limit,
    count: count,
    remaining: Math.max(0, config.limit - count),
  };
}
/** Run ONCE from the Apps Script editor to authorize access to both spreadsheets. */
function setup() {
  return locked_(function () {
    const kind = formKind_();
    sheet_(kind);
    if (kind === "contact") return { ready: true };
    if (!PropertiesService.getScriptProperties().getProperty("JOIN_SETTINGS")) {
      PropertiesService.getScriptProperties().setProperty(
        "JOIN_SETTINGS",
        JSON.stringify({ enabled: false, limit: 40 }),
      );
    }
    return status_();
  });
}
/** Public endpoint exposes only registration availability and counts, never personal data. */
function doGet() {
  try {
    return response_(
      formKind_() === "join"
        ? { ok: true, registration: locked_(status_) }
        : { ok: true, ready: true },
    );
  } catch (error) {
    return errorResponse_(error);
  }
}
function text_(data, key, min, max) {
  if (typeof data[key] !== "string") fail_("INVALID_INPUT");
  const value = data[key].trim();
  if (value.length < min || value.length > max) fail_("INVALID_INPUT");
  return value;
}
function validate_(kind, data) {
  const email = text_(data, "email", 3, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail_("INVALID_INPUT");
  const message = text_(data, "message", 10, 4000);
  if (kind === "contact") return [text_(data, "name", 2, 200), email, message];
  if (!/@smail\.ucas\.edu\.ps$/.test(email)) fail_("INVALID_INPUT");
  const phone = text_(data, "phone", 0, 10);
  if (phone && !/^05[69][0-9]{6,7}$/.test(phone)) fail_("INVALID_INPUT");
  const studentId = text_(data, "studentId", 9, 9);
  const major = text_(data, "major", 2, 200);
  const committee = text_(data, "preferredCommittee", 2, 30);
  if (
    !/^[0-9]{9}$/.test(studentId) ||
    MAJORS.indexOf(major) < 0 ||
    ["media", "relations", "activities"].indexOf(committee) < 0
  )
    fail_("INVALID_INPUT");
  return [text_(data, "fullName", 2, 200), email, phone, studentId, major, committee, message];
}
function exists_(sheet, column, value) {
  if (sheet.getLastRow() < 2) return false;
  return sheet
    .getRange(2, column, sheet.getLastRow() - 1, 1)
    .getDisplayValues()
    .some(function (row) {
      return row[0] === value;
    });
}
function append_(sheet, values) {
  // Rich text writes user input as literal text, not executable spreadsheet formulas.
  const cells = values.map(function (value) {
    return SpreadsheetApp.newRichTextValue().setText(String(value)).build();
  });
  sheet
    .getRange(sheet.getLastRow() + 1, 1, 1, cells.length)
    .setRichTextValues([cells])
    .setWrap(true);
  SpreadsheetApp.flush();
}

const EVENT_HEADERS = [
  "معرّف الطلب",
  "التاريخ",
  "معرّف الفعالية",
  "اسم الفعالية",
  "الاسم الكامل",
  "مقدمة الهاتف",
  "رقم الهاتف",
  "الالتزام بالحضور",
];
function validUuid_(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
function eventSheets_() {
  const raw = PropertiesService.getScriptProperties().getProperty("EVENT_SHEETS");
  return raw ? JSON.parse(raw) : {};
}
function eventTabName_(eventId, title) {
  const cleanTitle = String(title)
    .trim()
    .replace(/[\[\]:*?\/\\]/g, "-")
    .replace(/\s+/g, " ");
  const suffix = " - " + eventId;
  const prefix = "فعالية - ";
  return prefix + cleanTitle.slice(0, 100 - prefix.length - suffix.length) + suffix;
}
function eventSheetInfo_(eventId) {
  if (!validUuid_(eventId)) fail_("INVALID_INPUT");
  const info = eventSheets_()[eventId];
  if (!info || !info.tabName) return { linked: false };
  const book = SpreadsheetApp.openById(CLUB.joinSheet);
  const sheet = book.getSheetByName(info.tabName);
  return sheet
    ? { linked: true, url: book.getUrl() + "#gid=" + sheet.getSheetId() }
    : { linked: false };
}
function prepareEventSheet_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, EVENT_HEADERS.length).setValues([EVENT_HEADERS]).setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.setRightToLeft(true);
    return sheet;
  }
  const actual = sheet.getRange(1, 1, 1, EVENT_HEADERS.length).getValues()[0];
  if (JSON.stringify(actual) !== JSON.stringify(EVENT_HEADERS)) fail_("SHEET_HEADERS_CHANGED");
  return sheet;
}
function ensureEventSheet_(eventId, title) {
  if (!validUuid_(eventId) || typeof title !== "string" || title.trim().length < 2)
    fail_("INVALID_INPUT");
  const book = SpreadsheetApp.openById(CLUB.joinSheet);
  const map = eventSheets_();
  let tabName = map[eventId] && map[eventId].tabName;
  let needsMapping = false;
  if (!tabName) {
    tabName = eventTabName_(eventId, title);
    needsMapping = true;
  }
  let sheet = book.getSheetByName(tabName);
  if (!sheet) sheet = book.insertSheet(tabName);
  prepareEventSheet_(sheet);
  if (needsMapping) {
    map[eventId] = { tabName: tabName };
    PropertiesService.getScriptProperties().setProperty("EVENT_SHEETS", JSON.stringify(map));
  }
  return sheet;
}
function linkedEventSheet_(eventId) {
  if (!validUuid_(eventId)) fail_("INVALID_INPUT");
  const info = eventSheets_()[eventId];
  if (!info || typeof info.tabName !== "string" || !info.tabName) fail_("EVENT_SHEET_MISSING");
  const sheet = SpreadsheetApp.openById(CLUB.joinSheet).getSheetByName(info.tabName);
  if (!sheet) fail_("EVENT_SHEET_MISSING");
  return prepareEventSheet_(sheet);
}
function eventHasEnded_(item) {
  if (typeof item.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return true;
  function dayNumber(value) {
    const parts = value.split("-").map(Number);
    const stamp = Date.UTC(parts[0], parts[1] - 1, parts[2]);
    const parsed = new Date(stamp);
    if (
      parsed.getUTCFullYear() !== parts[0] ||
      parsed.getUTCMonth() !== parts[1] - 1 ||
      parsed.getUTCDate() !== parts[2]
    )
      return null;
    return Math.floor(stamp / 86400000);
  }
  const eventDay = dayNumber(item.date);
  if (eventDay === null) return true;
  const today = Utilities.formatDate(new Date(), "Asia/Hebron", "yyyy-MM-dd");
  if (
    typeof item.eventTime !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.eventTime) ||
    !Number.isInteger(item.durationMinutes) ||
    item.durationMinutes < 1 ||
    item.durationMinutes > 1440
  ) {
    return item.date < today;
  }
  const nowTime = Utilities.formatDate(new Date(), "Asia/Hebron", "HH:mm").split(":").map(Number);
  const eventTime = item.eventTime.split(":").map(Number);
  const elapsed =
    (dayNumber(today) - eventDay) * 1440 +
    nowTime[0] * 60 +
    nowTime[1] -
    eventTime[0] * 60 -
    eventTime[1];
  return elapsed >= item.durationMinutes;
}
function eventFromSupabase_(eventId) {
  if (!validUuid_(eventId)) fail_("INVALID_INPUT");
  const key = PropertiesService.getScriptProperties().getProperty("SUPABASE_PUBLISHABLE_KEY");
  if (!key) fail_("NOT_CONFIGURED");
  const url =
    CLUB.supabaseUrl +
    "/rest/v1/club_events?select=id,data&id=eq." +
    encodeURIComponent(eventId) +
    "&limit=1";
  const result = UrlFetchApp.fetch(url, {
    headers: { apikey: key, Authorization: "Bearer " + key },
    muteHttpExceptions: true,
  });
  if (result.getResponseCode() !== 200) fail_("SERVER_ERROR");
  let rows;
  try {
    rows = JSON.parse(result.getContentText());
  } catch (_) {
    fail_("SERVER_ERROR");
  }
  const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
  const item = row && row.data;
  if (
    !row ||
    String(row.id).toLowerCase() !== eventId.toLowerCase() ||
    !item ||
    item.status !== "upcoming" ||
    !item.eventRegistration ||
    item.eventRegistration.enabled !== true ||
    eventHasEnded_(item)
  )
    fail_("EVENT_CLOSED");
  return item;
}
function validateEvent_(data, config) {
  if (!data || typeof data !== "object") fail_("INVALID_INPUT");
  const name = config.nameEnabled ? text_(data, "name", 2, 200) : "";
  const code = config.phoneEnabled ? text_(data, "countryCode", 3, 3) : "";
  const phone = config.phoneEnabled ? text_(data, "phone", 7, 10) : "";
  if (config.phoneEnabled && (["970", "972"].indexOf(code) < 0 || !/^\d{7,10}$/.test(phone)))
    fail_("INVALID_INPUT");
  const attendance = config.attendanceEnabled ? text_(data, "attendance", 3, 3) : "";
  if (config.attendanceEnabled && attendance !== "yes") fail_("INVALID_INPUT");
  return [name, code, phone, attendance === "yes" ? "نعم" : ""];
}
function requireAdmin_(token, allowEvents) {
  if (typeof token !== "string" || token.length < 20 || token.length > 10000) fail_("UNAUTHORIZED");
  const key = PropertiesService.getScriptProperties().getProperty("SUPABASE_PUBLISHABLE_KEY");
  if (!key) fail_("NOT_CONFIGURED");
  const options = {
    headers: { apikey: key, Authorization: "Bearer " + token },
    muteHttpExceptions: true,
  };
  // Validate the session on Supabase; never trust a role or user ID supplied by the browser.
  const auth = UrlFetchApp.fetch(CLUB.supabaseUrl + "/auth/v1/user", options);
  if (auth.getResponseCode() !== 200) fail_("UNAUTHORIZED");
  const user = JSON.parse(auth.getContentText());
  if (!user.id) fail_("UNAUTHORIZED");
  const result = UrlFetchApp.fetch(
    CLUB.supabaseUrl + "/rest/v1/club_admins?select=role&id=eq." + encodeURIComponent(user.id),
    options,
  );
  if (result.getResponseCode() !== 200) fail_("UNAUTHORIZED");
  const rows = JSON.parse(result.getContentText());
  if (!rows.length || (rows[0].role !== "super_admin" && !(allowEvents && rows[0].role === "events_editor"))) fail_("UNAUTHORIZED");
}
/** POST JSON as text/plain. action: contact, join, or configure. */
function doPost(event) {
  try {
    if (!event || !event.postData || event.postData.contents.length > 20000) fail_("INVALID_INPUT");
    let body;
    try {
      body = JSON.parse(event.postData.contents);
    } catch (_) {
      fail_("INVALID_INPUT");
    }
    if (!body || typeof body !== "object") fail_("INVALID_INPUT");
    const kind = formKind_();
    const joinActions = [
      "join",
      "configure",
      "eventRegister",
      "eventSheetStatus",
      "ensureEventSheet",
      "configureEventSheet",
    ];
    if (
      (kind === "contact" && body.action !== "contact") ||
      (kind === "join" && joinActions.indexOf(body.action) < 0)
    )
      fail_("INVALID_INPUT");
    if (body.action === "eventSheetStatus") {
      requireAdmin_(body.accessToken, true);
      return response_({ ok: true, sheet: eventSheetInfo_(body.eventId) });
    }
    if (body.action === "ensureEventSheet" || body.action === "configureEventSheet") {
      requireAdmin_(body.accessToken, true);
      if (!validUuid_(body.eventId)) fail_("INVALID_INPUT");
      const item = eventFromSupabase_(body.eventId);
      return response_(
        locked_(function () {
          ensureEventSheet_(body.eventId, item.title);
          return { ok: true, sheet: eventSheetInfo_(body.eventId) };
        }),
      );
    }
    if (body.action === "configure") {
      requireAdmin_(body.accessToken);
      if (
        typeof body.enabled !== "boolean" ||
        !Number.isInteger(body.limit) ||
        body.limit < 1 ||
        body.limit > 100000
      )
        fail_("INVALID_INPUT");
      return response_(
        locked_(function () {
          PropertiesService.getScriptProperties().setProperty(
            "JOIN_SETTINGS",
            JSON.stringify({ enabled: body.enabled, limit: body.limit }),
          );
          return { ok: true, registration: status_() };
        }),
      );
    }
    if (body.action === "eventRegister") {
      if (!validUuid_(body.eventId) || !validUuid_(body.requestId)) fail_("INVALID_INPUT");
      const item = eventFromSupabase_(body.eventId);
      if (!eventSheetInfo_(body.eventId).linked) fail_("EVENT_SHEET_MISSING");
      const values = validateEvent_(body.data, item.eventRegistration);
      return response_(
        locked_(function () {
          const sheet = linkedEventSheet_(body.eventId);
          if (exists_(sheet, 1, body.requestId)) return { ok: true, duplicate: true };
          append_(
            sheet,
            [body.requestId, new Date().toISOString(), body.eventId, item.title].concat(values),
          );
          return { ok: true };
        }),
      );
    }
    if (body.action !== "contact" && body.action !== "join") fail_("INVALID_INPUT");
    if (
      typeof body.requestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId)
    )
      fail_("INVALID_INPUT");
    if (!body.data || typeof body.data !== "object") fail_("INVALID_INPUT");
    const values = validate_(body.action, body.data);
    return response_(
      locked_(function () {
        const sheet = sheet_(body.action);
        // Reusing the request UUID after a network failure cannot create another row.
        if (exists_(sheet, 1, body.requestId)) return { ok: true, duplicate: true };
        if (body.action === "join") {
          if (!status_().open) fail_("JOIN_CLOSED");
          if (exists_(sheet, 6, values[3])) fail_("ALREADY_REGISTERED");
        }
        append_(sheet, [body.requestId, new Date().toISOString()].concat(values));
        return { ok: true, registration: body.action === "join" ? status_() : undefined };
      }),
    );
  } catch (error) {
    return errorResponse_(error);
  }
}
