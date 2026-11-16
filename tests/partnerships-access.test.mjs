import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";

let db;
const owner = "00000000-0000-4000-8000-000000000001",
  partner = "00000000-0000-4000-8000-000000000002",
  media = "00000000-0000-4000-8000-000000000003",
  editor = "00000000-0000-4000-8000-000000000004",
  outsider = "00000000-0000-4000-8000-000000000005";
const payload = {
  title: "شراكة تجريبية",
  title_en: "Test partnership",
  description: "وصف الشراكة التجريبية",
  description_en: "Description of a test partnership",
  images: [],
  partnershipType: "تدريب",
  partnershipType_en: "Training",
};
async function as(id) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || ""]);
  await db.exec("set role " + (id ? "authenticated" : "anon"));
}
before(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`,
  );
  const migrations = readdirSync("supabase/migrations").sort();
  for (const file of migrations) {
    if (
      file.includes("visits") ||
      file.includes("visit_guard") ||
      file.includes("partnerships_committee_access") ||
      file.includes("communications_role") ||
      file.includes("events_committee_role") || file.includes("legacy_event_reader")
    )
      continue;
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  }
  const migrated = migrations.find(
    (file) =>
      file.includes("partnerships_committee_access") ||
      file.includes("communications_role") ||
      file.includes("events_committee_role"),
  );
  await db.exec(
    readFileSync(
      migrated ? "supabase/migrations/" + migrated : "docs/partnerships-access.sql",
      "utf8",
    ),
  );
  await db.exec(readFileSync("supabase/migrations/20261103114340_communications_role.sql", "utf8"));
  await db.exec(
    readFileSync("supabase/migrations/20261103123130_events_committee_role.sql", "utf8"),
  );
  await db.exec(readFileSync("supabase/migrations/20261103183333_legacy_event_reader.sql","utf8"));
  for (const [id, role] of [
    [owner, "super_admin"],
    [partner, "partnerships_editor"],
    [media, "media_editor"],
    [editor, "editor"],
    [outsider, null],
  ]) {
    await db.query("insert into auth.users values($1,$2)", [id, id + "@example.invalid"]);
    if (role)
      await db.query("insert into club_admins values($1,$2,$3,$4)", [
        id,
        role,
        id + "@example.invalid",
        role,
      ]);
  }
});
after(async () => db?.close());

test("events committee manages event content and registration settings without unrelated access", async () => {
  await as(owner);
  await db.query("insert into club_admins values($1,'Events',$2,'events_editor')", [
    outsider,
    "events@example.com",
  ]);
  await as(outsider);
  const eventData = {
    ...payload,
    date: "2026-11-03",
    status: "upcoming",
    eventRegistration: {
      enabled: true,
      nameEnabled: true,
      phoneEnabled: true,
      attendanceEnabled: true,
    },
  };
  const saved = (
    await db.query("insert into club_events(data) values($1) returning id", [
      JSON.stringify(eventData),
    ])
  ).rows[0];
  assert.equal(
    (
      await db.query("update club_events set data=$1 where id=$2 returning id", [
        JSON.stringify({
          ...eventData,
          eventRegistration: { ...eventData.eventRegistration, enabled: false },
        }),
        saved.id,
      ])
    ).rows.length,
    1,
  );
  await assert.rejects(() =>
    db.query("insert into club_news(data) values($1)", [
      JSON.stringify({ ...payload, date: "2026-11-03" }),
    ]),
  );
  await assert.rejects(() =>
    db.query("insert into club_partners(data) values($1)", [JSON.stringify(payload)]),
  );
  await assert.rejects(() =>
    db.query("insert into club_members(data) values($1)", [
      JSON.stringify({ ...payload, committee: "relations", isFounder: false }),
    ]),
  );
  assert.equal((await db.query("select * from club_submissions")).rows.length, 0);
  assert.equal(
    (
      await db.query("update club_admins set role='super_admin' where id=$1 returning id", [
        outsider,
      ])
    ).rows.length,
    0,
  );
  assert.equal((await db.query("update club_settings set data='{}' returning id")).rows.length, 0);
  assert.equal(
    (await db.query("delete from club_events where id=$1 returning id", [saved.id])).rows.length,
    1,
  );
  await as(owner);
  await db.query("update club_admins set role='media_editor' where id=$1", [outsider]);
  await as(outsider);
  assert.equal(
    (await db.query("select club_private.can_manage_events() as allowed")).rows[0].allowed,
    false,
  );
  await as(owner);
  await db.query("delete from club_admins where id=$1", [outsider]);
});

test("communications accounts manage news and partners but cannot access unrelated administration", async () => {
  await as(owner);
  await db.query("insert into club_admins values($1,'Communications',$2,'communications_editor')", [
    outsider,
    "communications@example.com",
  ]);
  await as(outsider);
  const partnerRow = (
    await db.query("insert into club_partners(data) values($1) returning id", [
      JSON.stringify(payload),
    ])
  ).rows[0];
  const newsRow = (
    await db.query(
      "insert into club_news(data,publication_status) values($1,'draft') returning id",
      [JSON.stringify({ ...payload, date: "2026-11-03" })],
    )
  ).rows[0];
  assert.equal(
    (await db.query("select id from club_news where id=$1", [newsRow.id])).rows.length,
    1,
  );
  assert.equal(
    (
      await db.query(
        "update club_news set publication_status='published' where id=$1 returning id",
        [newsRow.id],
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await db.query("update club_news set publication_status='draft' where id=$1 returning id", [
        newsRow.id,
      ])
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await db.query("update club_partners set data=$1 where id=$2 returning id", [
        JSON.stringify({ ...payload, title: "Updated partner" }),
        partnerRow.id,
      ])
    ).rows.length,
    1,
  );
  assert.equal(
    (await db.query("delete from club_partners where id=$1 returning id", [partnerRow.id])).rows
      .length,
    1,
  );
  await assert.rejects(() =>
    db.query("insert into club_events(data) values($1)", [
      JSON.stringify({ ...payload, date: "2026-11-03", status: "past" }),
    ]),
  );
  await assert.rejects(() =>
    db.query("insert into club_members(data) values($1)", [
      JSON.stringify({ ...payload, committee: "administrative", isFounder: true }),
    ]),
  );
  assert.equal((await db.query("select * from club_submissions")).rows.length, 0);
  assert.equal((await db.query("update club_settings set data='{}' returning id")).rows.length, 0);
  assert.equal(
    (
      await db.query("update club_admins set role='super_admin' where id=$1 returning id", [
        outsider,
      ])
    ).rows.length,
    0,
  );
  await as(owner);
  await db.query("update club_admins set role='partnerships_editor' where id=$1", [outsider]);
  await as(outsider);
  assert.equal(
    (await db.query("select club_private.can_manage_news() as allowed")).rows[0].allowed,
    false,
  );
  assert.equal(
    (await db.query("select id from club_news where id=$1", [newsRow.id])).rows.length,
    0,
  );
  await as(owner);
  await db.query("delete from club_admins where id=$1", [outsider]);
});

test("partnership members can create, edit, publish through the current public collection and delete partnerships", async () => {
  await as(partner);
  const saved = (
    await db.query("insert into club_partners(data) values($1) returning id,slug,updated_by", [
      JSON.stringify(payload),
    ])
  ).rows[0];
  assert.equal(saved.updated_by, partner);
  assert.ok(saved.slug);
  await db.query("update club_partners set data=$1 where id=$2", [
    JSON.stringify({ ...payload, title: "شراكة معدلة" }),
    saved.id,
  ]);
  await as(null);
  assert.equal(
    (await db.query("select data from club_partners where id=$1", [saved.id])).rows[0].data.title,
    "شراكة معدلة",
  );
  await as(partner);
  assert.equal(
    (await db.query("delete from club_partners where id=$1 returning id", [saved.id])).rows.length,
    1,
  );
});

test("partnership access cannot manage news, events, members, settings, registrations or accounts", async () => {
  await as(partner);
  await assert.rejects(() =>
    db.query("insert into club_news(data) values($1)", [
      JSON.stringify({ ...payload, date: "2026-11-03" }),
    ]),
  );
  await assert.rejects(() =>
    db.query("insert into club_events(data) values($1)", [
      JSON.stringify({ ...payload, date: "2026-11-03", status: "past" }),
    ]),
  );
  await assert.rejects(() =>
    db.query("insert into club_members(data) values($1)", [
      JSON.stringify({ ...payload, committee: "relations", isFounder: false }),
    ]),
  );
  await assert.rejects(() => db.query("insert into club_settings values('public','{}')"));
  assert.equal((await db.query("select * from club_submissions")).rows.length, 0);
  assert.equal((await db.query("select * from club_admins")).rows.length, 1);
  assert.equal(
    (
      await db.query("update club_admins set role='super_admin' where id=$1 returning id", [
        partner,
      ])
    ).rows.length,
    0,
  );
  await assert.rejects(() =>
    db.query("select club_move_article('events','news',gen_random_uuid(),$1,null)", [
      JSON.stringify(payload),
    ]),
  );
});

test("the media committee and outsiders cannot write partnerships, including through the compatibility view", async () => {
  for (const id of [media, outsider, null]) {
    await as(id);
    await assert.rejects(() =>
      db.query("insert into club_partners(data) values($1)", [JSON.stringify(payload)]),
    );
    await assert.rejects(() =>
      db.query("insert into club_content(kind,data) values('partners',$1)", [
        JSON.stringify(payload),
      ]),
    );
  }
});

test("partnership uploads can be linked, renamed and deleted after unlinking, while other committee assets stay protected", async () => {
  const ownPath = partner + "/00000000-0000-4000-8000-000000000010.webp";
  const otherPath = media + "/00000000-0000-4000-8000-000000000011.webp";
  const url = (p) =>
    "https://jxweaxenswbjpxxjmihb.supabase.co/storage/v1/object/public/club-media/" + p;
  await db.exec("reset role");
  await db.query("insert into storage.objects(bucket_id,name) values('club-media',$1)", [
    otherPath,
  ]);
  const other = (
    await db.query(
      "insert into club_media(name,path,size,mime,created_by) values('Other image',$1,100,'image/webp',$2) returning id",
      [otherPath, media],
    )
  ).rows[0].id;
  await as(partner);
  await assert.rejects(() =>
    db.query("insert into storage.objects(bucket_id,name) values('club-media',$1)", [otherPath]),
  );
  await db.query("insert into storage.objects(bucket_id,name) values('club-media',$1)", [ownPath]);
  const asset = (
    await db.query(
      "insert into club_media(name,path,size,mime,created_by) values('Logo',$1,100,'image/webp',$2) returning id",
      [ownPath, partner],
    )
  ).rows[0].id;
  assert.equal((await db.query("select id from club_media where id=$1", [other])).rows.length, 0);
  await assert.rejects(() =>
    db.query("insert into club_partners(data) values($1)", [
      JSON.stringify({ ...payload, images: [url(otherPath)] }),
    ]),
  );
  const record = (
    await db.query("insert into club_partners(data) values($1) returning id", [
      JSON.stringify({ ...payload, images: [url(ownPath)] }),
    ])
  ).rows[0].id;
  await db.query("update club_media set name='Renamed logo' where id=$1", [asset]);
  assert.equal(
    (await db.query("select name from club_media where id=$1", [asset])).rows[0].name,
    "Renamed logo",
  );
  await assert.rejects(() => db.query("select club_prepare_media_delete($1)", [asset]));
  await assert.rejects(() => db.query("select club_prepare_media_delete($1)", [other]));
  await db.query("update club_partners set data=$1 where id=$2", [JSON.stringify(payload), record]);
  assert.equal(
    (await db.query("select club_prepare_media_delete($1) as path", [asset])).rows[0].path,
    ownPath,
  );
  await db.query("delete from storage.objects where bucket_id='club-media' and name=$1", [ownPath]);
  assert.equal(
    (await db.query("delete from club_media where id=$1 returning id", [asset])).rows.length,
    1,
  );
});

test("general editor permissions and media news permissions are preserved", async () => {
  await as(editor);
  assert.ok(
    (
      await db.query("insert into club_partners(data) values($1) returning id", [
        JSON.stringify(payload),
      ])
    ).rows[0].id,
  );
  await as(media);
  assert.equal(
    (await db.query("select club_private.can_manage_news() as allowed")).rows[0].allowed,
    true,
  );
});

test("only the general administrator can assign the partnerships role and revocation is immediate", async () => {
  await as(owner);
  assert.equal(
    (
      await db.query("update club_admins set role='partnerships_editor' where id=$1 returning id", [
        editor,
      ])
    ).rows.length,
    1,
  );
  await as(editor);
  assert.equal(
    (await db.query("select club_private.can_manage_partners() as allowed")).rows[0].allowed,
    true,
  );
  await as(owner);
  await db.query("update club_admins set role='media_editor' where id=$1", [editor]);
  await as(editor);
  await assert.rejects(() =>
    db.query("insert into club_partners(data) values($1)", [JSON.stringify(payload)]),
  );
  await as(owner);
  await db.query("delete from club_admins where id=$1", [partner]);
  await as(partner);
  await assert.rejects(() =>
    db.query("insert into club_partners(data) values($1)", [JSON.stringify(payload)]),
  );
});

test("event uploads can be linked, renamed and deleted after unlinking, while other committee assets stay protected", async () => {
  await as(owner);
  await db.query("insert into club_admins values($1,'Events',$2,'events_editor')",[outsider,'events@example.com']);
  const ownPath = outsider + "/00000000-0000-4000-8000-000000000020.webp";
  const otherPath = media + "/00000000-0000-4000-8000-000000000021.webp";
  const url = (p) =>
    "https://jxweaxenswbjpxxjmihb.supabase.co/storage/v1/object/public/club-media/" + p;
  await db.exec("reset role");
  await db.query("insert into storage.objects(bucket_id,name) values('club-media',$1)", [
    otherPath,
  ]);
  const other = (
    await db.query(
      "insert into club_media(name,path,size,mime,created_by) values('Other image',$1,100,'image/webp',$2) returning id",
      [otherPath, media],
    )
  ).rows[0].id;
  await as(outsider);
  await assert.rejects(() =>
    db.query("insert into storage.objects(bucket_id,name) values('club-media',$1)", [otherPath]),
  );
  await db.query("insert into storage.objects(bucket_id,name) values('club-media',$1)", [ownPath]);
  const asset = (
    await db.query(
      "insert into club_media(name,path,size,mime,created_by) values('Logo',$1,100,'image/webp',$2) returning id",
      [ownPath, outsider],
    )
  ).rows[0].id;
  assert.equal((await db.query("select id from club_media where id=$1", [other])).rows.length, 0);
  await assert.rejects(() =>
    db.query("insert into club_events(data) values($1)", [
      JSON.stringify({ ...payload, date:"2026-11-03",status:"past", images: [url(otherPath)] }),
    ]),
  );
  const record = (
    await db.query("insert into club_events(data) values($1) returning id", [
      JSON.stringify({ ...payload, date:"2026-11-03",status:"past", images: [url(ownPath)] }),
    ])
  ).rows[0].id;
  await db.query("update club_media set name='Renamed logo' where id=$1", [asset]);
  assert.equal(
    (await db.query("select name from club_media where id=$1", [asset])).rows[0].name,
    "Renamed logo",
  );
  await assert.rejects(() => db.query("select club_prepare_media_delete($1)", [asset]));
  await assert.rejects(() => db.query("select club_prepare_media_delete($1)", [other]));
  await db.query("update club_events set data=$1 where id=$2", [JSON.stringify({...payload,date:"2026-11-03",status:"past"}), record]);
  assert.equal(
    (await db.query("select club_prepare_media_delete($1) as path", [asset])).rows[0].path,
    ownPath,
  );
  await db.query("delete from storage.objects where bucket_id='club-media' and name=$1", [ownPath]);
  assert.equal(
    (await db.query("delete from club_media where id=$1 returning id", [asset])).rows.length,
    1,
  );
  await as(owner);
  await db.query("delete from club_admins where id=$1",[outsider]);
});

test("legacy Google event reads resolve current events and cannot write them",async()=>{
 await as(owner);
 const data={title:"Legacy read event",title_en:"Legacy read event",description:"Test description",description_en:"Test description",images:[],date:"2099-01-01",status:"upcoming"};
 const row=(await db.query("insert into club_events(data) values($1) returning id",[JSON.stringify(data)])).rows[0];
 await as(null);
 const found=await db.query("select id,data from club_content where id=$1 and kind='events' limit 1",[row.id]);
 assert.equal(found.rows[0].data.title,data.title);
 await assert.rejects(()=>db.query("update club_content set data=$1 where id=$2",[JSON.stringify(data),row.id]));
 await as(owner);
 await assert.rejects(()=>db.query("delete from club_content where id=$1",[row.id]));
 await db.query("update club_events set data=$1 where id=$2",[JSON.stringify({...data,title:"Updated live"}),row.id]);
 await as(null);
 assert.equal((await db.query("select data from club_content where id=$1",[row.id])).rows[0].data.title,"Updated live");
 await as(owner);
 await db.query("delete from club_events where id=$1",[row.id]);
});
