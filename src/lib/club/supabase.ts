import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { url, key, configured, SetupRequiredError } from "./public-api";
import { prepareImage } from "./images";
import { contentSchema, type Content, type ContentCollection, type Settings } from "./model";
import { loginEmail } from "./admin-access";

export { url, key, configured, SetupRequiredError } from "./public-api";

let client: SupabaseClient | undefined;

export function supabase() {
  if (!configured) throw new Error("Supabase is not configured");
  client ??= createClient(url, key, {
    auth: {
      persistSession: typeof window !== "undefined",
      autoRefreshToken: typeof window !== "undefined",
      detectSessionInUrl: false,
    },
  });

  return client;
}

function check(error: { message: string; code?: string | undefined } | null) {
  if (!error) return;

  if (["PGRST205", "42P01", "PGRST202"].includes(error.code || "")) throw new SetupRequiredError();
  throw new Error(error.message);
}

export const changed = () => window.dispatchEvent(new Event("club-data-changed"));

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type Row = Record<string, JsonValue>;

const contentTables: Record<ContentCollection, string> = {
  members: "club_members",
  events: "club_events",
  news: "club_news",
  partners: "club_partners",
};

async function rows(table: string, order = "id", tie = "id") {
  const result: Row[] = [];

  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase()
      .from(table)
      .select("*")
      .order(order, { ascending: false })
      .order(tie)
      .range(offset, offset + 499);

    check(error);
    result.push(...(data || []));

    if (!data || data.length < 500) break;
  }

  return result;
}

/** Poll only visible tabs; mutations refresh immediately without Realtime setup. */
export function watchQuery<T>(
  load: () => Promise<T>,
  next: (value: T) => void,
  fail: (error: Error) => void,
  interval = 60000,
) {
  let active = true,
    running = false,
    again = false;

  async function refresh() {
    if (!active) return;

    if (running) {
      again = true;

      return;
    }

    running = true;

    try {
      const value = await load();

      if (active) next(value);
    } catch (error) {
      if (active) fail(error instanceof Error ? error : new Error("Request failed"));
    } finally {
      running = false;

      if (again) {
        again = false;
        void refresh();
      }
    }
  }

  const visible = () => {
    if (document.visibilityState === "visible") void refresh();
  };

  const changedHandler = () => void refresh();
  void refresh();
  const timer = window.setInterval(visible, interval);
  window.addEventListener("club-data-changed", changedHandler);
  document.addEventListener("visibilitychange", visible);

  return () => {
    active = false;
    window.clearInterval(timer);
    window.removeEventListener("club-data-changed", changedHandler);
    document.removeEventListener("visibilitychange", visible);
  };
}

/**
 * `slug` is the item's URL name: a string sets it, null asks the database to
 * generate one from title_en, and undefined leaves the column alone.
 */
export async function saveContent(
  kind: ContentCollection,
  value: Omit<Content, "id">,
  id?: string,
  originalKind: ContentCollection = kind,
  slug?: string | null,
) {
  if (kind !== originalKind && ![kind, originalKind].every((x) => x === "events" || x === "news")) {
    throw new Error("Invalid content type change");
  }
  const { publicationStatus, ...content } = value;
  contentSchema.parse(content);

  if (id && kind !== originalKind) {
    const moved = await supabase().rpc("club_move_article", {
      source_kind: originalKind,
      target_kind: kind,
      article_id: id,
      new_data: value,
      new_slug: slug ?? null,
    });
    check(moved.error);
    if (!moved.data) throw new Error("The moved article was not returned");
    changed();
    return String(moved.data);
  }

  const table = contentTables[kind];
  const values = {
    data: content,
    ...(kind === "news" ? { publication_status: publicationStatus ?? "draft" } : {}),
    ...(slug === undefined ? {} : { slug }),
  };
  const query = id
    ? supabase().from(table).update(values).eq("id", id)
    : supabase().from(table).insert(values);
  const result = await query.select("id").single();

  check(result.error);
  if (!result.data) throw new Error("The saved content was not returned");
  changed();
  return String(result.data.id);
}

export async function removeContent(kind: ContentCollection, id: string) {
  const { error } = await supabase()
    .from(contentTables[kind])
    .delete()
    .eq("id", id)
    .select("id")
    .single();

  check(error);
  changed();
}

export async function saveSettings(data: Settings) {
  const { error } = await supabase().from("club_settings").upsert({ id: "public", data });
  check(error);
  changed();
}

export async function setTeamVisibility(visible: boolean) {
  const result = await supabase().rpc("club_set_team_visibility", { is_visible: visible });
  check(result.error);
  if (result.data !== visible) throw new Error("The saved team visibility was not returned");
  changed();
  return visible;
}

export function observeAuth(next: (user: User | null) => void) {
  let active = true;

  const { data } = supabase().auth.onAuthStateChange((_event, session) => {
    queueMicrotask(() => {
      if (active) next(session?.user || null);
    });
  });

  return () => {
    active = false;
    data.subscription.unsubscribe();
  };
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase().auth.signInWithPassword({
    email: loginEmail(email),
    password,
  });
  check(error);
}

export async function signOut() {
  const { error } = await supabase().auth.signOut();
  check(error);
  changed();
}

export async function loadRole(id: string) {
  const { data, error } = await supabase()
    .from("club_admins")
    .select("role")
    .eq("id", id)
    .maybeSingle();

  check(error);

  return String(data?.role || "");
}

export type InboxRow = {
  id: string;
  name?: string;
  fullName?: string;
  email: string;
  phone?: string;
  studentId?: string;
  major?: string;
  preferredCommittee?: string;
  message: string;
  status?: string;
  isRead?: boolean;
  submittedAt?: string;
};

export type AdminRow = { id: string; name: string; email: string; role: string };

export async function loadInbox() {
  // SAFETY: club_submissions.data is written by the join/contact intake pipeline, whose
  // fields (name, email, message, ...) are all plain strings; the mapped object below
  // fills every other InboxRow field explicitly, so the result matches InboxRow & { kind: string }.
  return (await rows("club_submissions", "submitted_at")).map((row) => ({
    ...(row["data"] as Record<string, string>),
    id: String(row["id"]),
    kind: String(row["kind"]),
    status: String(row["status"]),
    isRead: Boolean(row["is_read"]),
    submittedAt: String(row["submitted_at"]),
  })) as (InboxRow & { kind: string })[];
}

export async function updateSubmission(id: string, patch: { status?: string; isRead?: boolean }) {
  const { error } = await supabase()
    .from("club_submissions")
    .update(patch.status ? { status: patch.status } : { is_read: patch.isRead })
    .eq("id", id)
    .select("id")
    .single();

  check(error);
  changed();
}

export async function loadAdmins() {
  // SAFETY: club_admins rows are only ever written by saveAdmin, which always sets
  // id, name, email, and role as strings.
  return (await rows("club_admins")) as AdminRow[];
}

export async function loadNews(): Promise<Content[]> {
  return (await rows("club_news", "updated_at")).map((row) => ({
    ...(row["data"] as Omit<Content, "id">),
    id: String(row["id"]),
    slug: String(row["slug"] || ""),
    publicationStatus: row["publication_status"] === "published" ? "published" : "draft",
    createdAt: String(row["created_at"]),
    updatedAt: String(row["updated_at"]),
  }));
}

export async function createAdminAccount(
  email: string,
  password: string,
  role: "editor" | "media_editor" | "partnerships_editor" | "communications_editor",
  name: string,
) {
  const { data, error } = await supabase().functions.invoke("media-accounts", {
    body: { email, password, role, name },
  });
  check(error);
  if (!data?.created) throw new Error(data?.error || "Account creation failed");
  changed();
}

export async function saveAdmin(
  id: string,
  name: string,
  email: string,
  role: "editor" | "media_editor" | "partnerships_editor" | "communications_editor" = "editor",
) {
  const { error } = await supabase().from("club_admins").upsert({ id, name, email, role });

  check(error);
  changed();
}

export async function removeAdmin(id: string) {
  const { data, error } = await supabase().functions.invoke("media-accounts", {
    body: { action: "delete", id },
  });
  check(error);
  if (!data?.deleted || data.id !== id) throw new Error(data?.error || "Account deletion failed");
  changed();
}

export type MediaAsset = {
  id: string;
  name: string;
  path: string;
  url: string;
  size: number;
  mime: string;
  deleting: boolean;
  usedBy: string[];
};

export async function loadMedia(): Promise<MediaAsset[]> {
  const { data: auth, error: authError } = await supabase().auth.getUser();
  check(authError);
  const role = auth.user ? await loadRole(auth.user.id) : "";
  const newsOnly = role === "media_editor";
  const partnersOnly = role === "partnerships_editor";
  const scoped = newsOnly || partnersOnly || role === "communications_editor";
  const [assets, memberLinks, eventLinks, newsLinks, partnerLinks] = await Promise.all([
    rows("club_media", "created_at"),
    scoped ? Promise.resolve([]) : rows("club_member_media", "member_id", "media_id"),
    scoped ? Promise.resolve([]) : rows("club_event_media", "event_id", "media_id"),
    partnersOnly ? Promise.resolve([]) : rows("club_news_media", "news_id", "media_id"),
    newsOnly ? Promise.resolve([]) : rows("club_partner_media", "partner_id", "media_id"),
  ]);
  const links = [
    ...memberLinks.map((link) => ({ mediaId: link["media_id"], ownerId: link["member_id"] })),
    ...eventLinks.map((link) => ({ mediaId: link["media_id"], ownerId: link["event_id"] })),
    ...newsLinks.map((link) => ({ mediaId: link["media_id"], ownerId: link["news_id"] })),
    ...partnerLinks.map((link) => ({ mediaId: link["media_id"], ownerId: link["partner_id"] })),
  ];

  return assets.map((a) => ({
    id: String(a["id"]),
    name: String(a["name"]),
    path: String(a["path"]),
    url: supabase().storage.from("club-media").getPublicUrl(String(a["path"])).data.publicUrl,
    size: Number(a["size"]),
    mime: String(a["mime"]),
    deleting: Boolean(a["deleting"]),
    usedBy: [
      ...new Set(
        links.filter((link) => link.mediaId === a["id"]).map((link) => String(link.ownerId)),
      ),
    ],
  }));
}

export async function uploadImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5242880)
    throw new Error("Use JPG, PNG or WebP up to 5 MB");
  const { data, error } = await supabase().auth.getUser();
  check(error);

  if (!data.user) throw new Error("Sign in required");
  const image = await prepareImage(file);
  const ext = image.type === "image/jpeg" ? "jpg" : image.type === "image/png" ? "png" : "webp";
  const path = `${data.user.id}/${crypto.randomUUID()}.${ext}`;
  const bucket = supabase().storage.from("club-media");

  const upload = await bucket.upload(path, image, {
    upsert: false,
    contentType: image.type,
    cacheControl: "31536000",
  });

  check(upload.error);

  const record = await supabase()
    .from("club_media")
    .insert({
      name: file.name.slice(0, 200),
      path,
      size: image.size,
      mime: image.type,
      created_by: data.user.id,
    });

  if (record.error) {
    await bucket.remove([path]);
    check(record.error);
  }

  changed();

  return bucket.getPublicUrl(path).data.publicUrl;
}

export async function renameMedia(id: string, name: string) {
  if (!name.trim() || name.trim().length > 200) throw new Error("Invalid name");

  const { error } = await supabase()
    .from("club_media")
    .update({ name: name.trim() })
    .eq("id", id)
    .select("id")
    .single();

  check(error);
  changed();
}

export async function deleteMedia(id: string) {
  try {
    const { data, error } = await supabase().functions.invoke("delete-media", {
      body: { assetId: id },
    });
    if (error) {
      let message = error.message;
      if ("context" in error && error.context instanceof Response) {
        const detail = await error.context.json().catch(() => null);
        if (detail && typeof detail.error === "string") message = detail.error;
      }
      throw new Error(message);
    }
    if (!data?.deleted) throw new Error("The image could not be deleted. Please retry.");
  } finally {
    changed();
  }
}
