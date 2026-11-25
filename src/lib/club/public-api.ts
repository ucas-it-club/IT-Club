import type { Content, ContentCollection, EventPerson, Settings } from "./model";
import type { FeedbackKind } from "./feedback";

/**
 * The public read path, and the one anonymous write (Site Feedback), without the Supabase SDK.
 *
 * Everything a visitor sees is a small set of parallel PostgREST GETs and one RPC, all anonymous,
 * all guarded by RLS. Reaching them through `createClient` pulled the whole SDK
 * — auth, realtime, storage, functions — into the entry bundle: 58 KB gzipped,
 * measured against this exact version, on every page load, for features only
 * `/admin` uses. `fetch` covers it.
 *
 * The SDK is still the right tool behind the admin console, where sessions,
 * uploads and row-level writes actually need it, and it is code-split there.
 */

// Public browser configuration; RLS still controls all data access.
export const url = import.meta.env.VITE_SUPABASE_URL || "https://jxweaxenswbjpxxjmihb.supabase.co";

export const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_kHJik-SCyMiMQ7nn2SRHbQ_0FR6CpOZ";

export const configured = Boolean(url && key);

export class SetupRequiredError extends Error {
  constructor() {
    super("Supabase database setup is required. Run the supplied migration.");
  }
}

/** The migration has not been run yet; the admin screen explains what to do. */
const setupCodes = ["PGRST205", "42P01", "PGRST202"];

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type Row = Record<string, JsonValue>;

/** The server hands in a fetch that caches; the browser uses its own. */
export type Fetcher = typeof fetch;

/**
 * One PostgREST call.
 *
 * SAFETY: the caller names the row shape it selected. Every call site below
 * passes a `select` that matches the type it asks for, and the rows themselves
 * are only ever written through the validated admin path.
 */
async function request<T>(path: string, init: RequestInit, f: Fetcher): Promise<T> {
  const response = await f(`${url}/rest/v1/${path}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(8000),
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...init.headers },
  });

  if (response.ok) {
    // A void RPC answers 204 with no body.
    // SAFETY: only void calls such as sendFeedback ask for T = null.
    if (response.status === 204) return null as T;
    // SAFETY: T names the shape this path's `select` returns; see above.
    return (await response.json()) as T;
  }

  // PostgREST reports failures as JSON; a proxy or outage may not.
  let code = "";
  let message = `Request failed (${response.status})`;

  try {
    // SAFETY: PostgREST's error envelope; any other body falls to the catch.
    const body = (await response.json()) as { code?: string; message?: string };
    code = body.code || "";
    message = body.message || message;
  } catch {
    /* Keep the status-derived message. */
  }

  if (setupCodes.includes(code)) throw new SetupRequiredError();
  throw new Error(message);
}

async function rows(
  table: string,
  order: string,
  f: Fetcher,
  signal: AbortSignal,
  fields = "id,slug,data,created_at,updated_at,updated_by",
) {
  const result: Row[] = [];

  for (let offset = 0; ; offset += 500) {
    const page = await request<Row[]>(
      `${table}?select=${fields}&order=${order}.desc,id.asc&offset=${offset}&limit=500`,
      { method: "GET", signal },
      f,
    );

    result.push(...page);

    if (page.length < 500) break;
  }

  return result;
}

const contentTables: Record<ContentCollection, string> = {
  members: "club_members",
  events: "club_events",
  news: "club_news",
  partners: "club_partners",
};

type Article = "events" | "news";

const articleColumns =
  "title,title_en,description,description_en,summary,summary_en,images,drive_image_urls,date";

/** The typed columns events and news are read from (issue #50). */
export const articleFields: Record<Article, string> = {
  events: `${articleColumns},status,event_time,duration_minutes,event_type,event_type_en,registration_enabled,registration_name_enabled,registration_phone_enabled,registration_attendance_enabled`,
  news: `${articleColumns},featured`,
};

const defined = <T extends object>(value: { [K in keyof T]: T[K] | undefined }) =>
  // SAFETY: only drops keys whose value is undefined, so every kept key keeps its type.
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

/** An event or news row as the app's Content fields. Null columns stay unset, as absent keys did in `data`. */
export function articleFromRow(kind: Article, row: Row): Omit<Content, "id"> {
  const text = (key: string) => (typeof row[key] === "string" ? String(row[key]) : undefined);
  const list = (key: string) => {
    const value = row[key];
    return Array.isArray(value) ? value.map(String) : undefined;
  };
  const content = {
    title: text("title") ?? "",
    title_en: text("title_en") ?? "",
    description: text("description") ?? "",
    description_en: text("description_en") ?? "",
    summary: text("summary"),
    summary_en: text("summary_en"),
    images: list("images") ?? [],
    driveImageUrls: list("drive_image_urls"),
    date: text("date"),
  };

  if (kind === "news")
    return defined<Omit<Content, "id">>({ ...content, featured: row["featured"] === true });

  return defined<Omit<Content, "id">>({
    ...content,
    status: text("status"),
    eventTime: text("event_time"),
    durationMinutes:
      typeof row["duration_minutes"] === "number" ? row["duration_minutes"] : undefined,
    eventType: text("event_type"),
    eventType_en: text("event_type_en"),
    eventRegistration:
      typeof row["registration_enabled"] === "boolean"
        ? {
            enabled: row["registration_enabled"],
            nameEnabled: row["registration_name_enabled"] === true,
            phoneEnabled: row["registration_phone_enabled"] === true,
            attendanceEnabled: row["registration_attendance_enabled"] === true,
          }
        : undefined,
  });
}

/**
 * The columns an event or news save writes. Every column is sent, absent ones as
 * null, so an edit clears what the editor removed, as the old whole-`data` write did.
 * `featured` is never sent: editing must not reset it. Presenters save separately.
 */
export function articleToRow(kind: Article, value: Omit<Content, "id">) {
  const row = {
    title: value.title,
    title_en: value.title_en,
    description: value.description,
    description_en: value.description_en,
    summary: value.summary ?? null,
    summary_en: value.summary_en ?? null,
    images: value.images ?? [],
    drive_image_urls: value.driveImageUrls ?? null,
    date: value.date ?? null,
  };

  if (kind === "news") return row;

  const registration = value.eventRegistration;

  return {
    ...row,
    status: value.status ?? null,
    event_time: value.eventTime ?? null,
    duration_minutes: value.durationMinutes ?? null,
    event_type: value.eventType ?? null,
    event_type_en: value.eventType_en ?? null,
    registration_enabled: registration?.enabled ?? null,
    registration_name_enabled: registration?.nameEnabled ?? null,
    registration_phone_enabled: registration?.phoneEnabled ?? null,
    registration_attendance_enabled: registration?.attendanceEnabled ?? null,
  };
}

/**
 * Whether one item exists right now, by id or slug, asked of the database directly.
 *
 * Costs a two-byte response instead of the whole payload, so a link to a
 * deleted or made-up item can be answered 404 without re-downloading every
 * row. Callers pass a validated UUID or slug; it goes into the query string as-is.
 */
export async function contentExists(ref: string, kinds: ContentCollection[]) {
  // An id that isn't a UUID would make Postgres reject the whole query.
  const column = /^[0-9a-f-]{36}$/i.test(ref) ? "id" : "slug";
  const results = await Promise.all(
    kinds.map((kind) => {
      return request<{ id: string }[]>(
        `${contentTables[kind]}?select=id&${column}=eq.${ref}&limit=1`,
        { method: "GET" },
        fetch,
      );
    }),
  );

  return results.some((found) => found.length > 0);
}

/** Every public row the site renders, in one shape the provider can hold. */
export async function loadPublic(f: Fetcher = fetch, callerSignal?: AbortSignal) {
  const deadline = AbortSignal.timeout(8000);
  const signal = callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline;
  const meta = "id,slug,created_at,updated_at,updated_by";
  const [members, events, news, partners, settings, people] = await Promise.all([
    rows(contentTables.members, "updated_at", f, signal),
    rows(contentTables.events, "updated_at", f, signal, `${meta},${articleFields.events}`),
    rows(contentTables.news, "updated_at", f, signal, `${meta},${articleFields.news}`),
    rows(contentTables.partners, "updated_at", f, signal),
    request<{ data?: Settings }[]>(
      "club_settings?select=data&id=eq.public&limit=1",
      { method: "GET", signal },
      f,
    ),
    // Presenters live only here now. A failed read fails the load like any other
    // table, so the admin never opens an event with its people missing and saves that.
    rows(
      "club_event_people",
      "display_order",
      f,
      signal,
      "id,event_id,member_id,role,name,name_en,bio,bio_en,linkedin_url,github_url,display_order",
    ),
  ]);

  const peopleByEvent = new Map<string, EventPerson[]>();

  for (const row of [...people].sort(
    (a, b) => Number(a["display_order"]) - Number(b["display_order"]),
  )) {
    const text = (key: string) => (typeof row[key] === "string" ? String(row[key]) : undefined);
    const list = peopleByEvent.get(String(row["event_id"])) ?? [];
    list.push({
      role: row["role"] === "organizer" ? "organizer" : "presenter",
      memberId: text("member_id"),
      name: text("name"),
      name_en: text("name_en"),
      bio: text("bio"),
      bio_en: text("bio_en"),
      linkedinUrl: text("linkedin_url"),
      githubUrl: text("github_url"),
    });
    peopleByEvent.set(String(row["event_id"]), list);
  }

  const data: Record<ContentCollection, Content[]> = {
    members: [],
    events: [],
    news: [],
    partners: [],
  };

  const grouped: [ContentCollection, Row[]][] = [
    ["members", members],
    ["events", events],
    ["news", news],
    ["partners", partners],
  ];

  for (const [kind, content] of grouped) {
    for (const row of content)
      data[kind].push({
        ...(kind === "events" || kind === "news"
          ? articleFromRow(kind, row)
          : // SAFETY: content data is only written by saveContent, which validates
            // the value against contentSchema before insert.
            (row["data"] as Omit<Content, "id">)),
        id: String(row["id"]),
        ...(typeof row["slug"] === "string" ? { slug: row["slug"] } : {}),
        createdAt: String(row["created_at"] ?? ""),
        updatedAt: String(row["updated_at"] ?? ""),
        updatedBy: String(row["updated_by"] || ""),
        ...(kind === "events" ? { people: peopleByEvent.get(String(row["id"])) ?? [] } : {}),
      });
  }

  return { data, settings: settings[0]?.data };
}

/** Records this session's visit and returns the running total. */
export async function recordClubVisit(visitId: string) {
  const value = await request<number>(
    "rpc/record_club_visit",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visit_id: visitId }),
    },
    fetch,
  );

  const count = Number(value);

  if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid visit count");

  return count;
}

export type FeedbackInput = {
  kind: FeedbackKind;
  message: string;
  name: string;
  contact: string;
  page: string;
  lang: string;
  theme: string;
  device: string;
  website: string;
};

/** Sends one piece of Site Feedback; the RPC validates and rate-limits it. */
export async function sendFeedback(input: FeedbackInput) {
  await request<null>(
    "rpc/club_send_feedback",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    fetch,
  );
}
