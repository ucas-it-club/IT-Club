import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { before, after, test } from "node:test";

const target = readdirSync("supabase/migrations").find((file) => file.includes("settings_columns"));
let db;
const owner = "00000000-0000-4000-8000-000000000001",
  editor = "00000000-0000-4000-8000-000000000002",
  media = "00000000-0000-4000-8000-000000000003",
  outsider = "00000000-0000-4000-8000-000000000004";

// The live row's shape: every key the admin writes, with an empty github.
const live = {
  email: "itclub@example.test",
  facebook: "https://www.facebook.com/example/",
  github: "",
  goals: "::club-rich-text-v1::• هدف",
  goals_en: "::club-rich-text-v1::• Goal",
  instagram: "https://www.instagram.com/example/",
  linkedin: "https://www.linkedin.com/company/example/",
  mission: "رسالة",
  mission_en: "Mission",
  registrationOpen: true,
  teamVisible: false,
  vision: "رؤية",
  vision_en: "Vision",
};
let legacy;

async function as(id) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || ""]);
  await db.exec("set role " + (id ? "authenticated" : "anon"));
}
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const row = () => one("select s.*, club_private.settings_data(s) rebuilt from club_settings s");

before(async () => {
  assert.ok(target, "the settings_columns migration exists");
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
  // Written the way the live admin writes it today: data only.
  await db.query("insert into club_settings values('public',$1)", [JSON.stringify(live)]);
  legacy = (await one("select data from club_settings")).data;
  await db.exec(readFileSync("supabase/migrations/" + target, "utf8"));
});
after(async () => db?.close());

test("the existing row keeps identical data, now also in typed columns", async () => {
  const now = await row();
  assert.deepEqual(now.data, legacy, "data is untouched");
  assert.deepEqual(now.rebuilt, legacy, "columns rebuild the exact same data");
  assert.equal(now.registration_open, true);
  assert.equal(now.team_visible, false);
  assert.equal(now.github, "", "empty string stays empty, not absent");
  for (const key of ["vision", "vision_en", "mission", "mission_en", "goals", "goals_en"])
    assert.equal(now[key], live[key]);
  for (const key of ["email", "facebook", "instagram", "linkedin"])
    assert.equal(now[key], live[key]);
});

test("a save from the live admin (data only) fills the columns", async () => {
  await as(owner);
  const next = { ...live, vision: "رؤية جديدة", github: "https://github.com/example" };
  delete next.registrationOpen;
  // The same upsert saveSettings sends.
  await db.query(
    "insert into club_settings(id,data) values('public',$1) on conflict(id) do update set data=excluded.data",
    [JSON.stringify(next)],
  );
  const now = await row();
  assert.deepEqual(now.data, next);
  assert.deepEqual(now.rebuilt, next);
  assert.equal(now.vision, "رؤية جديدة");
  assert.equal(now.github, "https://github.com/example");
  assert.equal(now.registration_open, null, "a key dropped from data clears its column");
});

test("a save of columns only rebuilds data", async () => {
  await as(owner);
  await db.query("update club_settings set mission_en=$1, registration_open=false", [
    "New mission",
  ]);
  const now = await row();
  assert.equal(now.data.mission_en, "New mission");
  assert.equal(now.data.registrationOpen, false);
  assert.deepEqual(now.data, now.rebuilt);
  await db.query("update club_settings set github=null");
  const cleared = await row();
  assert.equal("github" in cleared.data, false, "a null column drops its key");
  assert.equal(cleared.github, null);
});

test("checks reject bad values", async () => {
  await as(owner);
  for (const [column, value] of [
    ["email", "not-an-email"],
    ["facebook", "http://facebook.com/x"],
    ["linkedin", "https://bad url"],
    ["vision", "x".repeat(20001)],
  ])
    await assert.rejects(
      () => db.query(`update club_settings set ${column}=$1`, [value]),
      /check constraint/,
      column,
    );
  await assert.rejects(() =>
    db.query("update club_settings set data=$1", [JSON.stringify({ ...live, email: "bad" })]),
  );
  await assert.rejects(() =>
    db.query("update club_settings set data=$1", [
      JSON.stringify({ ...live, teamVisible: "maybe" }),
    ]),
  );
  await assert.rejects(() => db.query("insert into club_settings(id,vision) values('other','x')"));
  assert.equal((await one("select count(*)::int n from club_settings")).n, 1);
});

test("only the super admin writes settings; editors only toggle the team", async () => {
  for (const id of [editor, media, outsider]) {
    await as(id);
    assert.equal(
      (await db.query("update club_settings set vision='x' returning id")).rows.length,
      0,
      id,
    );
    assert.equal(
      (await db.query("update club_settings set data='{}' returning id")).rows.length,
      0,
      id,
    );
  }
  await as(null);
  await assert.rejects(() => db.query("update club_settings set vision='x'"));

  await as(owner);
  const before = (await row()).data;
  await as(editor);
  await db.query("select public.club_set_team_visibility(true)");
  await as(owner);
  const now = await row();
  assert.equal(now.team_visible, true);
  assert.deepEqual(now.data, { ...before, teamVisible: true }, "nothing else changes");
  assert.deepEqual(now.rebuilt, now.data);
  for (const id of [media, outsider]) {
    await as(id);
    await assert.rejects(() => db.query("select public.club_set_team_visibility(false)"));
  }
});

test("anon still reads the same data", async () => {
  await as(owner);
  const expected = (await row()).data;
  await as(null);
  const read = await one("select data from club_settings where id='public'");
  assert.deepEqual(read.data, expected);
  assert.equal((await one("select team_visible from club_settings")).team_visible, true);
});
