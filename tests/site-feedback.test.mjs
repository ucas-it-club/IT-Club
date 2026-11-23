import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { before, after, beforeEach, test } from "node:test";

let db;
const owner = "00000000-0000-4000-8000-000000000001",
  editor = "00000000-0000-4000-8000-000000000002",
  media = "00000000-0000-4000-8000-000000000003",
  outsider = "00000000-0000-4000-8000-000000000004";

async function as(id, ip = "203.0.113.7") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || ""]);
  await db.query("select set_config('request.headers',$1,false)", [
    JSON.stringify({ "cf-connecting-ip": ip }),
  ]);
  await db.exec("set role " + (id ? "authenticated" : "anon"));
}

const send = (over = {}) =>
  db.query(
    "select public.club_send_feedback($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    Object.values({
      kind: "bug",
      message: "الزر لا يعمل في صفحة الفعاليات",
      name: null,
      contact: null,
      page: "/en/events",
      lang: "en",
      theme: "dark",
      device: "Mozilla/5.0 (iPhone)",
      website: "",
      ...over,
    }),
  );

before(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`,
  );
  await db.exec(readFileSync("supabase/migrations/202609090001_club.sql", "utf8"));
  await db.exec(
    "alter table public.club_admins drop constraint club_admins_role_check; alter table public.club_admins add constraint club_admins_role_check check(role in ('editor','super_admin','media_editor'))",
  );
  const file = readdirSync("supabase/migrations").find((f) => f.endsWith("_site_feedback.sql"));
  await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
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
beforeEach(async () => {
  await db.exec("reset role");
  await db.exec("delete from public.club_feedback; delete from club_private.feedback_rate");
});

test("a visitor sends feedback without signing in and it starts as New", async () => {
  await as(null);
  await send({ name: "سارة", contact: "sara@example.invalid" });
  await db.exec("reset role");
  const [row] = (await db.query("select * from public.club_feedback")).rows;
  assert.equal(row.kind, "bug");
  assert.equal(row.status, "new");
  assert.equal(row.name, "سارة");
  assert.equal(row.contact, "sara@example.invalid");
  assert.equal(row.page, "/en/events");
  assert.equal(row.lang, "en");
  assert.equal(row.theme, "dark");
  assert.equal(row.device, "Mozilla/5.0 (iPhone)");
  assert.ok(row.created_at);
});

test("visitors have no direct insert or read rights", async () => {
  await as(null);
  await assert.rejects(
    db.query("insert into public.club_feedback(kind,message) values('bug','x')"),
  );
  await assert.rejects(db.query("select * from public.club_feedback"));
  await assert.rejects(db.query("select * from club_private.feedback_rate"));
});

test("messages over 2000 characters, empty messages and honeypot hits are refused", async () => {
  await as(null);
  await assert.rejects(send({ message: "a".repeat(2001) }), /feedback_too_long/);
  await assert.rejects(send({ message: "   " }), /feedback_empty/);
  await assert.rejects(send({ website: "http://spam.example" }), /feedback_rejected/);
  await assert.rejects(send({ kind: "praise" }), /feedback_rejected/);
  await send({ message: "a".repeat(2000) });
});

test("a 6th submission within an hour from one visitor is refused, others still pass", async () => {
  await as(null);
  for (let i = 0; i < 5; i++) await send();
  await assert.rejects(send(), /feedback_rate_limited/);
  await as(null, "198.51.100.9");
  await send();
  await db.exec("reset role");
  assert.equal((await db.query("select count(*)::int n from public.club_feedback")).rows[0].n, 6);
});

test("only super admins and editors can read feedback", async () => {
  await as(null);
  await send();
  for (const [id, n] of [
    [owner, 1],
    [editor, 1],
    [media, 0],
    [outsider, 0],
  ]) {
    await as(id);
    assert.equal((await db.query("select * from public.club_feedback")).rows.length, n, id);
  }
  await as(editor);
  await assert.rejects(db.query("update public.club_feedback set status='done'"));
  await assert.rejects(db.query("delete from public.club_feedback"));
});

test("the stored IP hash is not the IP and admins cannot read it", async () => {
  await as(null);
  await send();
  await db.exec("reset role");
  const [{ ip_hash }] = (await db.query("select ip_hash from club_private.feedback_rate")).rows;
  assert.ok(ip_hash && !String(ip_hash).includes("203.0.113.7"));
  await as(owner);
  await assert.rejects(db.query("select * from club_private.feedback_rate"));
});
