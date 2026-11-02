import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { before, after, test } from "node:test";

let db, newsId;
const owner = "00000000-0000-4000-8000-000000000001",
  editor = "00000000-0000-4000-8000-000000000002",
  media = "00000000-0000-4000-8000-000000000003",
  outsider = "00000000-0000-4000-8000-000000000004";
const payload = {
  title: "خبر تجريبي",
  title_en: "Demonstration news",
  description: "تفاصيل الخبر التجريبي",
  description_en: "Demonstration news details",
  images: [],
  date: "2026-11-02",
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
  for (const file of readdirSync("supabase/migrations").sort()) {
    if (
      file.includes("visits") ||
      file.includes("visit_guard") ||
      file.includes("media_news_access") ||
      file.includes("partnerships_committee_access")
    )
      continue;
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  }
  // Preserve a legacy published item through the additive change.
  newsId = (
    await db.query("insert into club_news(data) values($1) returning id", [JSON.stringify(payload)])
  ).rows[0].id;
  await db.exec(readFileSync("supabase/migrations/20261102191622_media_news_access.sql", "utf8"));
  for (const [id, role] of [
    [owner, "super_admin"],
    [editor, "editor"],
    [media, "media_editor"],
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

test("legacy news remains public; new news defaults to private until the media committee publishes", async () => {
  await as(null);
  assert.equal(
    (await db.query("select publication_status from club_news where id=$1", [newsId])).rows[0]
      .publication_status,
    "published",
  );
  await as(media);
  const draft = (
    await db.query(
      "insert into club_news(data,publication_status) values($1,'draft') returning id,publication_status",
      [JSON.stringify(payload)],
    )
  ).rows[0];
  assert.equal(draft.publication_status, "draft");
  await as(null);
  assert.equal((await db.query("select id from club_news where id=$1", [draft.id])).rows.length, 0);
  await as(editor);
  assert.equal((await db.query("select id from club_news where id=$1", [draft.id])).rows.length, 0);
  await as(media);
  assert.equal(
    (
      await db.query(
        "update club_news set publication_status='published' where id=$1 returning id",
        [draft.id],
      )
    ).rows.length,
    1,
  );
  await as(null);
  assert.equal((await db.query("select id from club_news where id=$1", [draft.id])).rows.length, 1);
  await as(media);
  await db.query("update club_news set publication_status='draft' where id=$1", [draft.id]);
  await as(null);
  assert.equal((await db.query("select id from club_news where id=$1", [draft.id])).rows.length, 0);
});
test("general editors, outsiders and visitors cannot create or edit news or call the conversion RPC", async () => {
  for (const id of [editor, outsider, null]) {
    await as(id);
    await assert.rejects(() =>
      db.query("insert into club_news(data) values($1)", [JSON.stringify(payload)]),
    );
    if (id)
      assert.equal(
        (
          await db.query("update club_news set data=$1 where id=$2 returning id", [
            JSON.stringify(payload),
            newsId,
          ])
        ).rows.length,
        0,
      );
    await assert.rejects(() =>
      db.query("select club_move_article('news','events',$1,$2,null)", [
        newsId,
        JSON.stringify(payload),
      ]),
    );
  }
});
test("media role cannot write events, read submissions, change settings or assign accounts", async () => {
  await as(media);
  await assert.rejects(() =>
    db.query("insert into club_events(data) values($1)", [
      JSON.stringify({ ...payload, date: "2026-11-02", status: "past" }),
    ]),
  );
  assert.equal((await db.query("select * from club_submissions")).rows.length, 0);
  await assert.rejects(() => db.query("insert into club_settings values('public','{}')"));
  assert.equal(
    (await db.query("update club_admins set role='super_admin' where id=$1 returning id", [media]))
      .rows.length,
    0,
  );
  assert.equal(
    (await db.query("delete from club_news where id=$1 returning id", [newsId])).rows.length,
    0,
  );
});
test("media uploads are owner-scoped and cannot attach another committee private asset by URL", async () => {
  const ownAsset = "00000000-0000-4000-8000-000000000010",
    otherAsset = "00000000-0000-4000-8000-000000000011";
  await as(owner);
  const otherPath = editor + "/" + otherAsset + ".webp";
  await db.exec("reset role");
  await db.query("insert into storage.objects(bucket_id,name) values('club-media',$1)", [
    otherPath,
  ]);
  await db.query(
    "insert into club_media(id,name,path,size,mime,created_by) values($1,'Other image',$2,100,'image/webp',$3)",
    [otherAsset, otherPath, editor],
  );
  await as(media);
  const ownPath = media + "/" + ownAsset + ".webp";
  await db.query("insert into storage.objects(bucket_id,name) values('club-media',$1)", [ownPath]);
  const ownRecord = (
    await db.query(
      "insert into club_media(name,path,size,mime,created_by) values('Own image',$1,100,'image/webp',$2) returning id",
      [ownPath, media],
    )
  ).rows[0].id;
  assert.equal(
    (await db.query("select id from club_media where id=$1", [otherAsset])).rows.length,
    0,
  );
  const url = (p) =>
    "https://jxweaxenswbjpxxjmihb.supabase.co/storage/v1/object/public/club-media/" + p;
  await assert.rejects(() =>
    db.query("insert into club_news(data) values($1)", [
      JSON.stringify({ ...payload, images: [url(otherPath)] }),
    ]),
  );
  const news = (
    await db.query("insert into club_news(data) values($1) returning id", [
      JSON.stringify({ ...payload, images: [url(ownPath)] }),
    ])
  ).rows[0];
  assert.ok(news.id);
  await assert.rejects(() => db.query("select club_prepare_media_delete($1)", [ownRecord]));
  await assert.rejects(() => db.query("select club_prepare_media_delete($1)", [otherAsset]));
});
test("revocation takes effect on the next request without waiting for a new JWT", async () => {
  await as(owner);
  await db.query("delete from club_admins where id=$1", [media]);
  await as(media);
  await assert.rejects(() =>
    db.query("insert into club_news(data) values($1)", [JSON.stringify(payload)]),
  );
  assert.equal(
    (await db.query("select id from club_news where publication_status='draft'")).rows.length,
    0,
  );
});

test("a general administrator can change an existing account type and news access follows the assignment immediately", async () => {
  await as(owner);
  assert.equal(
    (
      await db.query("update club_admins set role='media_editor' where id=$1 returning id", [
        editor,
      ])
    ).rows.length,
    1,
  );
  await as(editor);
  assert.equal(
    (await db.query("select club_private.can_manage_news() as allowed")).rows[0].allowed,
    true,
  );
  await as(owner);
  await db.query("update club_admins set role='editor' where id=$1", [editor]);
  await as(editor);
  assert.equal(
    (await db.query("select club_private.can_manage_news() as allowed")).rows[0].allowed,
    false,
  );
});
