import { z } from "zod";
import { contactSchema, eventSignupSchema, joinSchema } from "./model";

export const sheetLinks = {
  contact:
    "https://docs.google.com/spreadsheets/d/1-k2MvrFu2lvOq0ypMJCo-Zs_Q2lw3MD7_sTNAXUi6rc/edit",
  join: "https://docs.google.com/spreadsheets/d/1v6RYlzZujoRSAHvOwsY_FQ7X5s3UOHW8E9b3SGxzcWg/edit",
};

const endpoints = {
  contact:
    "https://script.google.com/a/macros/ucas.edu.ps/s/AKfycbxbRhHH3dTxdsvpAD0TSGFae6mtBmLwf3zUApDqe6VGiNvZrE-M4Ni164_0LDu-e1MTow/exec",
  join: "https://script.google.com/macros/s/AKfycbxV5GRTEe8Y2QEcEPHDFURBXZsZpg6JTZxkya40NJFTBL-sklDQSKrkwmJYmTSQBn1q/exec",
};

const registrationSchema = z.object({
  open: z.boolean(),
  enabled: z.boolean(),
  limit: z.number().int().positive(),
  count: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
});

export type Registration = z.infer<typeof registrationSchema>;

export class SheetsError extends Error {}

/** Applications are being accepted and there is room for one more. */
export const isOpen = (r: Registration) =>
  r.enabled && r.open && r.count < r.limit && r.remaining > 0;

type RequestBody = Record<string, string | number | boolean | Record<string, string | undefined>>;

function isStringCode(value: unknown): value is { code: string } {
  return (
    typeof value === "object" && value !== null && "code" in value && typeof value.code === "string"
  );
}

async function request(kind: keyof typeof endpoints, body?: RequestBody) {
  let result: Response;

  const init: RequestInit = {
    credentials: "omit",
    redirect: "follow",
    signal: AbortSignal.timeout(45000),
  };

  if (body) {
    init.method = "POST";
    init.headers = { "Content-Type": "text/plain;charset=utf-8" };
    init.body = JSON.stringify(body);
  } else {
    init.method = "GET";
  }

  try {
    result = await fetch(endpoints[kind], init);
  } catch {
    throw new SheetsError("UNAVAILABLE");
  }

  if (!result.ok || !result.headers.get("content-type")?.includes("application/json"))
    throw new SheetsError("UNAVAILABLE");
  let value;

  try {
    value = await result.json();
  } catch {
    throw new SheetsError("UNAVAILABLE");
  }

  if (value?.ok !== true) throw new SheetsError(isStringCode(value) ? value.code : "UNAVAILABLE");

  return value;
}

export async function loadRegistration(): Promise<Registration> {
  const value = await request("join");
  const parsed = registrationSchema.safeParse(value.registration);

  if (!parsed.success) throw new SheetsError("UNAVAILABLE");

  return parsed.data;
}

export async function configureRegistration(enabled: boolean, limit: number) {
  // Only the current Supabase session authenticates the admin. Form data never goes there.
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase().auth.getSession();

  if (error || !data.session) throw new SheetsError("UNAUTHORIZED");

  const value = await request("join", {
    action: "configure",
    accessToken: data.session.access_token,
    enabled,
    limit,
  });

  return registrationSchema.parse(value.registration);
}

export async function submitToSheet(
  join: boolean,
  values: Record<string, string>,
  requestId: string,
) {
  const data = (join ? joinSchema : contactSchema).parse(values);
  await request(join ? "join" : "contact", { action: join ? "join" : "contact", requestId, data });
}

const uuidSchema = z.string().uuid();
const eventSheetSchema = z.discriminatedUnion("linked", [
  z.object({ linked: z.literal(false) }).strict(),
  z.object({ linked: z.literal(true), url: z.string().url() }).strict(),
]);

async function adminEventRequest(body: RequestBody) {
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase().auth.getSession();
  if (error || !data.session) throw new SheetsError("UNAUTHORIZED");
  return request("join", { ...body, accessToken: data.session.access_token });
}

export async function eventSheetStatus(eventId: string) {
  const validEventId = uuidSchema.parse(eventId);
  const value = await adminEventRequest({ action: "eventSheetStatus", eventId: validEventId });
  return eventSheetSchema.parse(value.sheet);
}

export async function ensureEventSheet(eventId: string, title: string) {
  const validEventId = uuidSchema.parse(eventId);
  const value = await adminEventRequest({
    action: "ensureEventSheet",
    eventId: validEventId,
    title,
  });
  const sheet = eventSheetSchema.parse(value.sheet);
  if (!sheet.linked) throw new SheetsError("EVENT_SHEET_MISSING");
  return sheet;
}

export async function submitEventSignup(
  eventId: string,
  values: Record<string, string>,
  requestId: string,
) {
  const validEventId = uuidSchema.parse(eventId);
  const validRequestId = uuidSchema.parse(requestId);
  const data = eventSignupSchema.parse({
    name: values["name"] || undefined,
    countryCode: values["countryCode"] || undefined,
    phone: values["phone"] || undefined,
    attendance: values["attendance"] || undefined,
  });
  await request("join", {
    action: "eventRegister",
    eventId: validEventId,
    requestId: validRequestId,
    data,
  });
}

export function submissionError(cause: unknown, ar: boolean) {
  const code = cause instanceof Error ? cause.message : "";

  if (code === "JOIN_CLOSED")
    return ar ? "تم وقف استقبال الأعضاء الجدد" : "New membership applications are closed.";

  if (code === "ALREADY_REGISTERED")
    return ar
      ? "تم تسجيل طلب سابق بهذا الرقم الجامعي."
      : "An application with this student ID already exists.";

  if (code === "UNAUTHORIZED")
    return ar
      ? "تعذر التحقق من صلاحية المدير. سجّلي الدخول مجددًا."
      : "Admin authorization failed. Please sign in again.";

  if (code === "NOT_CONFIGURED")
    return ar
      ? "إعداد ربط Google Sheets غير مكتمل."
      : "Google Sheets integration setup is incomplete.";

  if (code === "EVENT_CLOSED")
    return ar ? "التسجيل لهذه الفعالية غير متاح حاليًا." : "Registration is unavailable.";

  if (code === "EVENT_SHEET_MISSING")
    return ar ? "لم يتم ربط شيت بهذه الفعالية بعد." : "No sheet is linked to this event.";

  return ar
    ? "تعذر تأكيد العملية. تحققي من الاتصال وحاولي مجددًا؛ إعادة الإرسال لن تكرر الطلب نفسه."
    : "The operation could not be confirmed. Check your connection and retry; the same request will not be duplicated.";
}
