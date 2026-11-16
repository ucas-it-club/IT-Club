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
      file.includes("events_committee_role") ||
      file.includes("legacy_event_reader")
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
  await db.exec(readFileSync("supabase/migrations/20261103183333_legacy_event_reader.sql", "utf8"));
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

test("member CRUD is scoped, titles are independent, and revocation is immediate", async () => {
  await as(owner);
  await db.query("insert into club_admins values($1,'Communications',$2,'communications_editor')", [
    outsider,
    "communications@example.com",
  ]);
  const records = {};
  for (const committee of ["media", "relations", "activities", "administrative"]) {
    records[committee] = (
      await db.query("insert into club_members(data) values($1) returning id", [
        JSON.stringify({
          ...payload,
          committee,
          isFounder: committee === "administrative",
          role: "Title " + committee,
          role_en: "Title " + committee,
        }),
      ])
    ).rows[0].id;
  }
  const member = (committee, role) =>
    JSON.stringify({ ...payload, committee, isFounder: false, role, role_en: role });
  await as(outsider);
  for (const committee of ["media", "relations"]) {
    assert.equal(
      (
        await db.query("update club_members set data=$1 where id=$2 returning id", [
          member(committee, "New " + committee),
          records[committee],
        ])
      ).rows.length,
      1,
    );
    const added = (
      await db.query("insert into club_members(data) values($1) returning id", [
        member(committee, "Coordinator"),
      ])
    ).rows[0].id;
    assert.equal(
      (await db.query("delete from club_members where id=$1 returning id", [added])).rows.length,
      1,
    );
  }
  for (const committee of ["activities", "administrative"]) {
    await assert.rejects(() =>
      db.query("insert into club_members(data) values($1)", [member(committee, "Invalid")]),
    );
    assert.equal(
      (
        await db.query("update club_members set data=data where id=$1 returning id", [
          records[committee],
        ])
      ).rows.length,
      0,
    );
    assert.equal(
      (await db.query("delete from club_members where id=$1 returning id", [records[committee]]))
        .rows.length,
      0,
    );
  }
  await assert.rejects(() =>
    db.query("update club_members set data=$1 where id=$2", [
      member("activities", "Invalid transfer"),
      records.media,
    ]),
  );
  assert.equal(
    (await db.query("select data from club_members where id=$1", [records.media])).rows[0].data
      .role,
    "New media",
  );
  assert.equal(
    (await db.query("select data from club_members where id=$1", [records.relations])).rows[0].data
      .role,
    "New relations",
  );
  await as(owner);
  await db.query("update club_admins set role='events_editor' where id=$1", [outsider]);
  await as(outsider);
  assert.equal(
    (await db.query("update club_members set data=data where id=$1 returning id", [records.media]))
      .rows.length,
    0,
  );
  assert.equal(
    (
      await db.query("update club_members set data=$1 where id=$2 returning id", [
        member("activities", "Event coordinator"),
        records.activities,
      ])
    ).rows.length,
    1,
  );
  await assert.rejects(() =>
    db.query("update club_members set data=$1 where id=$2", [
      member("relations", "Invalid transfer"),
      records.activities,
    ]),
  );
  const added = (
    await db.query("insert into club_members(data) values($1) returning id", [
      member("activities", "Volunteer"),
    ])
  ).rows[0].id;
  assert.equal(
    (await db.query("delete from club_members where id=$1 returning id", [added])).rows.length,
    1,
  );
  await as(editor);
  assert.equal(
    (
      await db.query("update club_members set data=$1 where id=$2 returning id", [
        member("relations", "Transferred"),
        records.activities,
      ])
    ).rows.length,
    1,
  );
  await as(media);
  await assert.rejects(() =>
    db.query("insert into club_members(data) values($1)", [member("media", "Invalid")]),
  );
  await as(null);
  assert.equal((await db.query("select * from club_members")).rows.length, 4);
  await assert.rejects(() =>
    db.query("insert into club_members(data) values($1)", [member("media", "Invalid")]),
  );
});

test("committee member photos permit owned and linked assets and reject other committee assets", async () => {
  await as(editor);
  const assetPath = `${editor}/00000000-0000-4000-8000-000000000099.webp`;
  const image = `https://jxweaxenswbjpxxjmihb.supabase.co/storage/v1/object/public/club-media/${assetPath}`;
  await db.query("insert into storage.objects(bucket_id,name) values('club-media',$1)", [
    assetPath,
  ]);
  const asset = (
    await db.query(
      "insert into club_media(name,path,size,mime,created_by) values('photo',$1,100,'image/webp',$2) returning id",
      [assetPath, editor],
    )
  ).rows[0].id;
  await as(owner);
  const data = {
    ...payload,
    committee: "activities",
    isFounder: false,
    images: [image],
    role: "Photographer",
  };
  const member = (
    await db.query("insert into club_members(data) values($1) returning id", [JSON.stringify(data)])
  ).rows[0].id;
  await db.query("update club_admins set role='communications_editor' where id=$1", [outsider]);
  await as(outsider);
  await assert.rejects(() =>
    db.query("insert into club_members(data) values($1)", [
      JSON.stringify({ ...data, committee: "media" }),
    ]),
  );
  assert.equal(
    (await db.query("select * from club_member_media where media_id=$1", [asset])).rows.length,
    0,
  );
  await as(owner);
  await db.query("update club_admins set role='events_editor' where id=$1", [outsider]);
  await as(outsider);
  assert.equal((await db.query("select id from club_media where id=$1", [asset])).rows.length, 1);
  assert.equal(
    (await db.query("select * from club_member_media where media_id=$1", [asset])).rows.length,
    1,
  );
  assert.equal(
    (
      await db.query("update club_members set data=$1 where id=$2 returning id", [
        JSON.stringify({ ...data, role: "Media coordinator" }),
        member,
      ])
    ).rows.length,
    1,
  );
});
