import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { before, after, test } from "node:test";

const target = readdirSync("supabase/migrations").find((file) => file.includes("news_columns"));
let db, mediaUrl;
const owner = "00000000-0000-4000-8000-000000000001",
  media = "00000000-0000-4000-8000-000000000002",
  events = "00000000-0000-4000-8000-000000000003",
  outsider = "00000000-0000-4000-8000-000000000004";
const legacy = [];

const news = (extra = {}) => ({
  title: "خبر تجريبي",
  title_en: "Demo news",
  description: "::club-rich-text-v1::تفاصيل الخبر",
  description_en: "::club-rich-text-v1::News details",
  images: [],
  date: "2026-11-10",
  ...extra,
});

async function as(id) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || ""]);
  await db.exec("set role " + (id ? "authenticated" : "anon"));
}
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];

before(async () => {
  assert.ok(target, "the news_columns migration exists");
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`,
  );
  for (const file of readdirSync("supabase/migrations").sort()) {
    if (file.includes("visits") || file.includes("visit_guard") || file === target) continue;
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  }
  for (const [id, role] of [
    [owner, "super_admin"],
    [media, "media_editor"],
    [events, "events_editor"],
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
  // Legacy rows are written the way the live admin writes them today: data only.
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
  const path = `${owner}/00000000-0000-4000-8000-0000000000aa.webp`;
  await db.query(
    "insert into club_media(name,path,size,mime,created_by) values('photo',$1,10,'image/webp',$2)",
    [path, owner],
  );
  mediaUrl = (await one("select club_private.media_url($1) url", [path])).url;
  for (const [data, status] of [
    [
      news({
        images: [mediaUrl],
        summary: "ملخص",
        summary_en: " Summary",
        driveImageUrls: ["https://drive.google.com/thumbnail?id=1PWmBispWLlXHzsiwzbZabc&sz=w2000"],
      }),
      "published",
    ],
    [news({ title_en: "Draft news", date: "2026-10-01" }), "draft"],
  ])
    await db.query("insert into club_news(data,publication_status) values($1,$2)", [
      JSON.stringify(data),
      status,
    ]);
  legacy.push(
    ...(
      await db.query(
        "select id,slug,data,publication_status,created_at,updated_at,updated_by from club_news order by created_at,id",
      )
    ).rows,
  );
  await db.exec(readFileSync("supabase/migrations/" + target, "utf8"));
});
after(async () => db?.close());

test("every legacy news item keeps identical values, now in typed columns", async () => {
  for (const row of legacy) {
    const now = await one(
      `select n.*, to_char(n.date,'YYYY-MM-DD') day_text, club_private.news_data(n) rebuilt
       from club_news n where id=$1`,
      [row.id],
    );
    const d = row.data;
    assert.deepEqual(now.data, d, "data is untouched");
    assert.deepEqual(now.rebuilt, d, "columns rebuild the exact same data");
    assert.equal(now.slug, row.slug);
    assert.equal(now.publication_status, row.publication_status);
    assert.equal(now.created_at.getTime(), row.created_at.getTime());
    assert.equal(now.updated_at.getTime(), row.updated_at.getTime());
    assert.equal(now.updated_by, row.updated_by);
    assert.equal(now.title, d.title);
    assert.equal(now.title_en, d.title_en);
    assert.equal(now.description, d.description);
    assert.equal(now.description_en, d.description_en);
    assert.equal(now.summary, d.summary ?? null);
    assert.equal(now.summary_en, d.summary_en ?? null, "summary is not trimmed");
    assert.deepEqual(now.images, d.images);
    assert.deepEqual(now.drive_image_urls, d.driveImageUrls ?? null);
    assert.equal(now.day_text, d.date);
    assert.equal(now.featured, false, "existing news is not featured");
  }
  assert.equal((await one("select count(*)::int n from club_news_media")).n, 1);
});

test("a save from the live admin (data only) fills the columns and keeps featured", async () => {
  const id = legacy[0].id;
  await as(owner);
  await db.query("update club_news set featured=true where id=$1", [id]);
  await as(media);
  await db.query("update club_news set data=$1 where id=$2", [
    JSON.stringify(news({ title_en: "Renamed by old admin", date: "2026-11-15" })),
    id,
  ]);
  const row = await one(
    "select title_en,to_char(date,'YYYY-MM-DD') day_text,images,featured,data from club_news where id=$1",
    [id],
  );
  assert.equal(row.title_en, "Renamed by old admin");
  assert.equal(row.day_text, "2026-11-15");
  assert.deepEqual(row.images, []);
  assert.equal(row.featured, true, "old admin save does not unfeature");
  assert.equal(row.data.featured, undefined, "featured stays out of data");
  const links = await one("select count(*)::int n from club_news_media where news_id=$1", [id]);
  assert.equal(links.n, 0, "image link follows data");
  await as(null);
});

test("a column save keeps data in step and gets a slug", async () => {
  await as(media);
  const created = await one(
    `insert into club_news(title,title_en,description,description_en,date,featured)
     values('عنوان','New column news','وصف','Description','2026-12-01',true) returning id,slug,data,featured`,
  );
  assert.equal(created.slug, "new-column-news");
  assert.equal(created.featured, true);
  assert.deepEqual(created.data, {
    title: "عنوان",
    title_en: "New column news",
    description: "وصف",
    description_en: "Description",
    images: [],
    date: "2026-12-01",
  });
  await db.query("update club_news set summary_en='Short' where id=$1", [created.id]);
  const updated = await one("select data from club_news where id=$1", [created.id]);
  assert.equal(updated.data.summary_en, "Short");
  await assert.rejects(
    db.query("update club_news set title_en=' ' where id=$1", [created.id]),
    /club_news_title_en/,
  );
  await assert.rejects(
    db.query("update club_news set drive_image_urls=array['https://evil.example'] where id=$1", [
      created.id,
    ]),
    /club_news_drive_images/,
  );
  await as(null);
});

test("column saves follow the news access and image rules", async () => {
  const id = legacy[1].id;
  for (const who of [outsider, events]) {
    await as(who);
    const hijack = await db.query("update club_news set featured=true where id=$1", [id]);
    assert.equal(hijack.affectedRows, 0, "no access to news");
  }
  await as(null);
  assert.equal(
    (await db.query("select id from club_news where id=$1", [id])).rows.length,
    0,
    "draft stays hidden from visitors",
  );
  assert.equal(
    (await db.query("select featured from club_news where featured")).rows.length,
    2,
    "visitors can read featured on published news",
  );

  await db.exec("reset role");
  const otherPath = `${events}/00000000-0000-4000-8000-0000000000bb.webp`;
  await db.query(
    "insert into club_media(name,path,size,mime,created_by) values('event photo',$1,10,'image/webp',$2)",
    [otherPath, events],
  );
  const otherUrl = (await one("select club_private.media_url($1) url", [otherPath])).url;
  await as(media);
  await assert.rejects(
    db.query("update club_news set images=array[$1] where id=$2", [otherUrl, id]),
    /not available to the media committee/,
  );
  await as(owner);
  await db.query("update club_news set images=array[$1] where id=$2", [mediaUrl, id]);
  const linked = await one("select count(*)::int n from club_news_media where news_id=$1", [id]);
  assert.equal(linked.n, 1);
  const row = await one("select data from club_news where id=$1", [id]);
  assert.deepEqual(row.data.images, [mediaUrl]);
  await as(null);
});
