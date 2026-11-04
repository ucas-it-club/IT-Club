import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test, before, after } from "node:test";

let db;
let migratedRows;

const owner = "00000000-0000-4000-8000-000000000001",
  editor = "00000000-0000-4000-8000-000000000002",
  outsider = "00000000-0000-4000-8000-000000000003";

const media = "00000000-0000-4000-8000-000000000010";

const path = editor + "/" + media + ".webp";

const image =
  "https://jxweaxenswbjpxxjmihb.supabase.co/storage/v1/object/public/club-media/" + path;

before(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`,
  );
  await db.exec(readFileSync("supabase/migrations/202609090001_club.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/202609150001_content_created_at.sql", "utf8"));
  await db.exec(
    readFileSync("supabase/migrations/202609150002_administrative_committee.sql", "utf8"),
  );
  await db.exec(readFileSync("supabase/migrations/202609170001_member_gender.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/202609170002_board_order.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/202609190001_news_content.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/202609240001_content_summary.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/202609240002_content_slug.sql", "utf8"));
  await db.exec(
    readFileSync("supabase/migrations/202610030001_event_registration_config.sql", "utf8"),
  );
  await db.exec(readFileSync("supabase/migrations/202610060001_event_details.sql", "utf8"));
  await db.exec(
    readFileSync("supabase/migrations/202610070001_google_drive_image_links.sql", "utf8"),
  );
  const legacyBase = {
    title: "محتوى قديم",
    title_en: "Legacy content",
    description: "وصف المحتوى القديم",
    description_en: "Legacy content description",
    images: [],
  };
  const seeded = await Promise.all([
    db.query("insert into club_content(kind,data) values('members',$1) returning id,created_at", [
      JSON.stringify({ ...legacyBase, committee: "media", isFounder: false }),
    ]),
    db.query(
      "insert into club_content(kind,data) values('events',$1) returning id,slug,created_at",
      [JSON.stringify({ ...legacyBase, date: "2026-10-07", status: "past" })],
    ),
    db.query("insert into club_content(kind,data) values('news',$1) returning id,slug,created_at", [
      JSON.stringify({ ...legacyBase, date: "2026-10-07" }),
    ]),
    db.query(
      "insert into club_content(kind,data) values('partners',$1) returning id,slug,created_at",
      [JSON.stringify(legacyBase)],
    ),
  ]);
  migratedRows = seeded.map((result) => result.rows[0]);
  await db.exec(readFileSync("supabase/migrations/202610070002_split_content_tables.sql", "utf8"));
  await db.exec(
    readFileSync("supabase/migrations/202610080002_separate_partners_remove_legacy.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20261013202822_member_profile_slugs.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/202610080001_team_visibility_control.sql", "utf8"),
  );
  await db.query("insert into auth.users values($1,$2),($3,$4),($5,$6)", [
    owner,
    "owner@test.invalid",
    editor,
    "editor@test.invalid",
    outsider,
    "outsider@test.invalid",
  ]);
  await db.query("insert into public.club_admins values($1,$2,$3,$4),($5,$6,$7,$8)", [
    owner,
    "Owner",
    "owner@test.invalid",
    "super_admin",
    editor,
    "Editor",
    "editor@test.invalid",
    "editor",
  ]);
});

after(async () => db?.close());

async function as(id) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || ""]);
  await db.exec("set role " + (id ? "authenticated" : "anon"));
}

const payload = {
  title: "شريك تجريبي",
  title_en: "Test partner",
  description: "وصف الشريك التجريبي",
  description_en: "A partner description",
  images: [],
};

const addContent = (value = payload) =>
  db.query("insert into public.club_partners(data) values($1) returning id,updated_by", [
    JSON.stringify(value),
  ]);

test("legacy content copies to dedicated tables before the old tables are removed", async () => {
  await as(null);
  const [member, event, news, partner] = migratedRows;
  const migratedMember = (
    await db.query("select id,created_at from club_members where id=$1", [member.id])
  ).rows[0];
  const migratedEvent = (
    await db.query("select id,slug,created_at from club_events where id=$1", [event.id])
  ).rows[0];
  const migratedNews = (
    await db.query("select id,slug,created_at from club_news where id=$1", [news.id])
  ).rows[0];
  const migratedPartner = (
    await db.query("select id,slug,created_at from club_partners where id=$1", [partner.id])
  ).rows[0];

  assert.equal(migratedMember.id, member.id);
  assert.equal(String(migratedMember.created_at), String(member.created_at));
  assert.equal(migratedEvent.slug, event.slug);
  assert.equal(String(migratedEvent.created_at), String(event.created_at));
  assert.equal(migratedNews.slug, news.slug);
  assert.equal(String(migratedNews.created_at), String(news.created_at));
  assert.equal(migratedPartner.id, partner.id);
  assert.equal(migratedPartner.slug, partner.slug);
  assert.equal(String(migratedPartner.created_at), String(partner.created_at));
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from pg_tables where schemaname='public' and tablename in ('club_content','club_content_media')",
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from pg_views where schemaname='public' and viewname in ('club_content','club_content_media')",
      )
    ).rows[0].n,
    2,
  );
});

test("anonymous cannot write content, read applications or grant themselves admin", async () => {
  await as(null);
  await assert.rejects(() => addContent());
  await assert.rejects(() => db.query("select * from public.club_submissions"));
  await assert.rejects(() =>
    db.query("insert into public.club_admins values($1,$2,$3,$4)", [
      outsider,
      "Outsider",
      "out@test.invalid",
      "super_admin",
    ]),
  );
});

test("outsider has no content access to write and cannot escalate", async () => {
  await as(outsider);
  await assert.rejects(() => addContent());
  await assert.rejects(() =>
    db.query("insert into public.club_admins values($1,$2,$3,$4)", [
      outsider,
      "Outsider",
      "out@test.invalid",
      "editor",
    ]),
  );
});

test("editor writes valid content and server owns audit fields", async () => {
  await as(editor);
  const result = await addContent();
  assert.equal(result.rows[0].updated_by, editor);
  await assert.rejects(() => addContent({ ...payload, title: "x" }));
  await assert.rejects(() => addContent({ ...payload, unknown: true }));
  await as(null);
  assert.ok((await db.query("select * from public.club_partners")).rows.length > 0);
});

test("the temporary legacy view routes partner writes to the dedicated table", async () => {
  await as(editor);
  const inserted = await db.query(
    "insert into public.club_content(kind,data) values('partners',$1) returning id",
    [JSON.stringify(payload)],
  );
  assert.equal(
    (
      await db.query("select count(*)::int as n from club_partners where id=$1", [
        inserted.rows[0].id,
      ])
    ).rows[0].n,
    1,
  );
});

test("only editors can change team visibility without changing other settings", async () => {
  await as(owner);
  await db.query("insert into public.club_settings(id,data) values('public',$1)", [
    JSON.stringify({ email: "club@example.test" }),
  ]);
  await as(editor);
  assert.equal(
    (await db.query("select public.club_set_team_visibility(false) as visible")).rows[0].visible,
    false,
  );
  const saved = (await db.query("select data from public.club_settings where id='public'")).rows[0]
    .data;
  assert.equal(saved.teamVisible, false);
  assert.equal(saved.email, "club@example.test");
  await as(outsider);
  await assert.rejects(() => db.query("select public.club_set_team_visibility(true)"));
  await as(null);
  await assert.rejects(() => db.query("select public.club_set_team_visibility(true)"));
});

test("public submissions are valid only and cannot inject status", async () => {
  await as(null);

  const data = {
    name: "Test Sender",
    email: "sender@test.invalid",
    message: "This is a test message.",
  };

  await db.query("insert into public.club_submissions(kind,data) values($1,$2)", [
    "contactMessages",
    JSON.stringify(data),
  ]);
  await assert.rejects(() =>
    db.query(
      "insert into public.club_submissions(kind,data,status) values('contactMessages',$1,'accepted')",
      [JSON.stringify(data)],
    ),
  );
  await assert.rejects(() =>
    db.query("insert into public.club_submissions(kind,data) values('contactMessages',$1)", [
      JSON.stringify({ ...data, email: "bad" }),
    ]),
  );
});

test("editor changes flags but cannot alter submitted data or settings", async () => {
  await as(editor);
  await db.exec("update public.club_submissions set is_read=true");
  await assert.rejects(() => db.exec("update public.club_submissions set data='{}'"));
  await assert.rejects(() => db.exec("insert into public.club_settings values('public','{}')"));
});

test("super admin grants and revokes editors but cannot delete itself", async () => {
  await as(owner);
  await db.query("insert into public.club_admins values($1,$2,$3,$4)", [
    outsider,
    "New Editor",
    "out@test.invalid",
    "editor",
  ]);
  await as(outsider);
  await addContent();
  await as(owner);
  await db.query("delete from public.club_admins where id=$1", [outsider]);

  const removed = await db.query("delete from public.club_admins where id=$1 returning id", [
    owner,
  ]);

  assert.equal(removed.rows.length, 0);
  await as(outsider);
  await assert.rejects(() => addContent());
});

test("media library guards in-use files and updates links transactionally", async () => {
  await as(editor);
  await db.query("insert into storage.objects(bucket_id,name) values($1,$2)", ["club-media", path]);
  await db.query(
    "insert into public.club_media(name,path,size,mime,created_by) values($1,$2,$3,$4,$5)",
    ["test.webp", path, 200, "image/webp", editor],
  );

  const asset = (await db.query("select id from public.club_media where path=$1", [path])).rows[0]
    .id;

  const content = (await addContent({ ...payload, images: [image] })).rows[0].id;
  assert.equal(
    (await db.query("select * from public.club_partner_media where media_id=$1", [asset])).rows
      .length,
    1,
  );
  await assert.rejects(() => db.query("select public.club_prepare_media_delete($1)", [asset]));

  const deleted = await db.query("delete from storage.objects where name=$1 returning name", [
    path,
  ]);

  assert.equal(deleted.rows.length, 0);
  await db.query("update public.club_partners set data=$1 where id=$2", [
    JSON.stringify(payload),
    content,
  ]);
  await db.query("select public.club_prepare_media_delete($1)", [asset]);
  await assert.rejects(() =>
    db.query("update public.club_partners set data=$1 where id=$2", [
      JSON.stringify({ ...payload, images: [image] }),
      content,
    ]),
  );
  await db.query("delete from storage.objects where name=$1", [path]);
  await db.query("delete from public.club_media where id=$1", [asset]);
  assert.equal(
    (await db.query("select * from public.club_media where id=$1", [asset])).rows.length,
    0,
  );
});

test("editor cannot write into another uploader folder", async () => {
  await as(editor);
  await assert.rejects(() =>
    db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
      "club-media",
      owner + "/wrong.webp",
    ]),
  );
});

test("editor can move a member into and out of the administrative committee", async () => {
  await as(editor);
  const member = {
    title: "Test member",
    title_en: "Test member",
    description: "Member description",
    description_en: "Member description",
    images: [],
    committee: "media",
    isFounder: false,
  };
  const inserted = await db.query("insert into club_members(data) values($1) returning id", [
    JSON.stringify(member),
  ]);
  const id = inserted.rows[0].id;
  const board = { ...member, committee: "administrative", isFounder: true };
  await db.query("update club_members set data=$1 where id=$2", [JSON.stringify(board), id]);
  let saved = (await db.query("select data from club_members where id=$1", [id])).rows[0].data;
  assert.equal(saved.committee, "administrative");
  assert.equal(saved.isFounder, true);
  await db.query("update club_members set data=$1 where id=$2", [JSON.stringify(member), id]);
  saved = (await db.query("select data from club_members where id=$1", [id])).rows[0].data;
  assert.equal(saved.committee, "media");
  assert.equal(saved.isFounder, false);
  await assert.rejects(() =>
    db.query("update club_members set data=$1 where id=$2", [
      JSON.stringify({ ...member, committee: "invalid" }),
      id,
    ]),
  );
  await as(outsider);
  const denied = await db.query("update club_members set data=$1 where id=$2 returning id", [
    JSON.stringify(board),
    id,
  ]);
  assert.equal(denied.rows.length, 0);
});

test("member gender accepts both groups and legacy members while rejecting invalid values", async () => {
  await as(editor);
  const member = {
    title: "Test member",
    title_en: "Test member",
    description: "Member description",
    description_en: "Member description",
    images: [],
    committee: "media",
    isFounder: false,
  };
  for (const gender of [undefined, "male", "female"]) {
    const data = gender ? { ...member, gender } : member;
    const result = await db.query("insert into club_members(data) values($1) returning id,data", [
      JSON.stringify(data),
    ]);
    assert.equal(result.rows[0].data.gender, gender);
    const id = result.rows[0].id;
    await db.query("update club_members set data=$1 where id=$2", [
      JSON.stringify({ ...member, gender: "female" }),
      id,
    ]);
    assert.equal(
      (await db.query("select data from club_members where id=$1", [id])).rows[0].data.gender,
      "female",
    );
  }
  for (const gender of ["invalid", null, 12]) {
    await assert.rejects(() =>
      db.query("insert into club_members(data) values($1)", [
        JSON.stringify({ ...member, gender }),
      ]),
    );
  }
});

test("board order accepts optional positive integers and rejects invalid values", async () => {
  await as(editor);
  const member = {
    title: "Board member",
    title_en: "Board member",
    description: "Board description",
    description_en: "Board description",
    images: [],
    committee: "administrative",
    isFounder: true,
  };
  for (const displayOrder of [1, 2, 9999]) {
    const result = await db.query("insert into club_members(data) values($1) returning data", [
      JSON.stringify({ ...member, displayOrder }),
    ]);
    assert.equal(result.rows[0].data.displayOrder, displayOrder);
  }
  for (const displayOrder of [0, -1, 1.5, 10000, "1", null]) {
    await assert.rejects(() =>
      db.query("insert into club_members(data) values($1)", [
        JSON.stringify({ ...member, displayOrder }),
      ]),
    );
  }
});

test("news and events are separate and can be reclassified without changing identity", async () => {
  await as(editor);
  const data = {
    title: "Club update",
    title_en: "Club update",
    description: "Test description",
    description_en: "Test description",
    images: [],
    date: "2026-09-19",
  };
  const inserted = await db.query(
    "insert into club_news(data) values($1) returning id,slug,created_at",
    [JSON.stringify(data)],
  );
  const id = inserted.rows[0].id;
  const slug = inserted.rows[0].slug;
  const createdAt = inserted.rows[0].created_at.toISOString();
  assert.equal((await db.query("select id from club_events where id=$1", [id])).rows.length, 0);
  await db.query("select club_move_article('news','events',$1,$2,$3)", [
    id,
    JSON.stringify({ ...data, status: "upcoming" }),
    slug,
  ]);
  const moved = (await db.query("select id,slug,created_at from club_events where id=$1", [id]))
    .rows[0];
  assert.equal(moved.id, id);
  assert.equal(moved.slug, slug);
  assert.equal(moved.created_at.toISOString(), createdAt);
  assert.equal((await db.query("select id from club_news where id=$1", [id])).rows.length, 0);
  await db.query("select club_move_article('events','news',$1,$2,$3)", [
    id,
    JSON.stringify(data),
    slug,
  ]);
  await assert.rejects(() =>
    db.query("insert into club_news(data) values($1)", [
      JSON.stringify({ ...data, date: "invalid" }),
    ]),
  );
  await as(null);
  assert.equal((await db.query("select id from club_news where id=$1", [id])).rows.length, 1);
  await assert.rejects(() =>
    db.query("insert into club_news(data) values($1)", [JSON.stringify(data)]),
  );
});

test("news and events accept an optional summary; other kinds and bad lengths are rejected", async () => {
  await as(editor);
  const data = {
    title: "Club update",
    title_en: "Club update",
    description: "Test description",
    description_en: "Test description",
    images: [],
    date: "2026-09-24",
  };
  const insert = (kind, value) =>
    kind === "partners"
      ? db.query("insert into club_partners(data) values($1)", [JSON.stringify(value)])
      : db.query(`insert into club_${kind}(data) values($1)`, [JSON.stringify(value)]);

  await insert("news", { ...data, summary: "ملخص قصير", summary_en: "A short summary" });
  await insert("events", { ...data, status: "past", summary_en: "English only" });
  await insert("news", data);
  await assert.rejects(() => insert("news", { ...data, summary: "" }));
  await assert.rejects(() => insert("news", { ...data, summary_en: "x".repeat(301) }));
  await assert.rejects(() => insert("news", { ...data, summary: 42 }));
  await assert.rejects(() => insert("partners", { ...data, summary: "Not for partners" }));
});

test("news and events accept validated Google Drive image fields only", async () => {
  await as(editor);
  const data = {
    title: "Club update",
    title_en: "Club update",
    description: "Test description",
    description_en: "Test description",
    images: [],
    date: "2026-10-07",
  };
  const driveImage = "https://drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOpQrStUvWxYz&sz=w2000";
  const insert = (kind, value) =>
    kind === "partners"
      ? db.query("insert into club_partners(data) values($1)", [JSON.stringify(value)])
      : db.query(`insert into club_${kind}(data) values($1)`, [JSON.stringify(value)]);

  await insert("news", { ...data, driveImageUrls: [driveImage] });
  await insert("events", {
    ...data,
    status: "past",
    driveImageUrls: [driveImage],
  });
  await assert.rejects(() => insert("partners", { ...data, driveImageUrls: [driveImage] }));
  await assert.rejects(() =>
    insert("news", { ...data, driveImageUrls: ["https://example.com/image.jpg"] }),
  );
  await assert.rejects(() => insert("news", { ...data, driveImageUrls: [42] }));
  await assert.rejects(() =>
    insert("news", { ...data, driveImageUrls: Array.from({ length: 21 }, () => driveImage) }),
  );
});

test("event details accept complete valid data and reject other kinds or malformed values", async () => {
  await as(editor);
  const event = {
    title: "ورشة تطوير الويب",
    title_en: "Web development workshop",
    description: "وصف الفعالية التجريبية",
    description_en: "Test event description",
    images: [],
    date: "2026-10-06",
    status: "upcoming",
  };
  const details = {
    eventTime: "18:30",
    durationMinutes: 120,
    eventType: "ورشة عمل",
    eventType_en: "Workshop",
    presenterName: "أحمد محمد",
    presenterName_en: "Ahmed Mohammed",
    presenterBio: "مطور ويب ومدرب تقني",
    presenterBio_en: "Web developer and technical trainer",
  };
  const insert = (kind, value) =>
    db.query(`insert into club_${kind}(data) values($1) returning data`, [JSON.stringify(value)]);

  const saved = await insert("events", { ...event, ...details });
  assert.deepEqual(
    Object.fromEntries(Object.keys(details).map((key) => [key, saved.rows[0].data[key]])),
    details,
  );

  // Historical events without the new detail group remain valid.
  await insert("events", event);
  await assert.rejects(() => insert("news", { ...event, ...details }));
  await assert.rejects(() => insert("events", { ...event, eventTime: details.eventTime }));

  for (const eventTime of ["6:30", "24:00", "18:60", "not-a-time", 1830]) {
    await assert.rejects(() => insert("events", { ...event, ...details, eventTime }));
  }
  for (const durationMinutes of [0, 1441, 1.5, "120", null]) {
    await assert.rejects(() => insert("events", { ...event, ...details, durationMinutes }));
  }
  for (const [key, value] of [
    ["eventType", "x"],
    ["eventType_en", "x".repeat(101)],
    ["presenterName", "x"],
    ["presenterName_en", "x".repeat(201)],
    ["presenterBio", "x"],
    ["presenterBio_en", "x".repeat(501)],
  ]) {
    await assert.rejects(() => insert("events", { ...event, ...details, [key]: value }));
  }
});

test("slugs are generated once, unique, editable and shared with member profiles", async () => {
  await as(editor);
  const data = (title_en) => ({
    title: "خبر",
    title_en,
    description: "Test description",
    description_en: "Test description",
    images: [],
    date: "2026-09-24",
  });
  const add = async (kind, value, slug) => {
    if (kind === "members")
      return (
        await db.query("insert into club_members(data,slug) values($1,$2) returning id,slug", [
          JSON.stringify(value),
          slug ?? null,
        ])
      ).rows[0];
    return (
      await db.query(`insert into club_${kind}(data,slug) values($1,$2) returning id,slug`, [
        JSON.stringify(value),
        slug ?? null,
      ])
    ).rows[0];
  };

  const first = await add("news", data("The Club announces its Board of Directors for 2026"));
  assert.equal(first.slug, "club-announces-board-directors-2026");
  const second = await add("events", {
    ...data("The Club announces its Board of Directors for 2026"),
    status: "past",
  });
  assert.equal(second.slug, "club-announces-board-directors-2026-2");
  assert.equal((await add("news", data("Custom"), "my-link")).slug, "my-link");
  assert.equal((await add("news", data("Prisoner's Day"))).slug, "prisoners-day");
  assert.equal((await add("news", data("مرحبا بالعالم"))).slug, null);

  const long = await add("news", data("word ".repeat(40)));
  assert.ok(long.slug.length <= 60);

  await db.query("update club_news set data=$1 where id=$2", [
    JSON.stringify(data("A completely different title")),
    first.id,
  ]);
  assert.equal(
    (await db.query("select slug from club_news where id=$1", [first.id])).rows[0].slug,
    "club-announces-board-directors-2026",
  );
  await db.query("update club_news set slug=null where id=$1", [first.id]);
  assert.equal(
    (await db.query("select slug from club_news where id=$1", [first.id])).rows[0].slug,
    "completely-different-title",
  );

  await assert.rejects(() => add("news", data("Bad"), "Not A Slug"));
  await assert.rejects(() => add("news", data("Taken"), "my-link"));

  const member = await add(
    "members",
    { ...data("Member Name"), committee: "media", isFounder: false, gender: "male" },
    null,
  );
  assert.equal(member.slug, "member-name");
  await db.query("update club_members set slug=$1 where id=$2", ["dalloul-deputy", member.id]);
  assert.equal(
    (await db.query("select slug from club_members where id=$1", [member.id])).rows[0].slug,
    "dalloul-deputy",
  );
  await assert.rejects(() => add("news", data("Taken by a member"), "dalloul-deputy"));
});
