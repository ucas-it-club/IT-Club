import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { before, after, test } from "node:test";

// Issue #56: an event's ordered presenters and organizers, saved in one call.
let db, eventId, memberId;
const owner = "00000000-0000-4000-8000-000000000001",
  events = "00000000-0000-4000-8000-000000000002",
  media = "00000000-0000-4000-8000-000000000003",
  outsider = "00000000-0000-4000-8000-000000000004";

const eventData = (extra = {}) => ({
  title: "فعالية تجريبية",
  title_en: "Demo event",
  description: "تفاصيل الفعالية",
  description_en: "Event details",
  images: [],
  date: "2026-11-10",
  status: "upcoming",
  eventTime: "10:00",
  durationMinutes: 60,
  eventType: "ورشة",
  eventType_en: "Workshop",
  ...extra,
});
const outside = (n, extra = {}) => ({
  role: "presenter",
  name: "ضيف " + n,
  bio: "نبذة الضيف",
  ...extra,
});

async function as(id) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || ""]);
  await db.exec("set role " + (id ? "authenticated" : "anon"));
}
const save = (people, id = eventId) =>
  db.query("select club_save_event_people($1,$2)", [id, JSON.stringify(people)]);
const people = async () =>
  (
    await db.query(
      "select * from club_event_people where event_id=$1 order by role desc, display_order",
      [eventId],
    )
  ).rows;

before(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`,
  );
  for (const file of readdirSync("supabase/migrations").sort()) {
    if (file.includes("visits") || file.includes("visit_guard")) continue;
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  }
  for (const [id, role] of [
    [owner, "super_admin"],
    [events, "events_editor"],
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
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
  eventId = (
    await db.query("insert into club_events(data) values($1) returning id", [
      JSON.stringify(eventData({ presenterName: "قديم", presenterBio: "نبذة قديمة" })),
    ])
  ).rows[0].id;
  memberId = (
    await db.query("insert into club_members(data) values($1) returning id", [
      JSON.stringify({
        title: "عضو النادي",
        title_en: "Club Member",
        description: "وصف العضو",
        description_en: "Member description",
        images: [],
        committee: "media",
        isFounder: false,
      }),
    ])
  ).rows[0].id;
});
after(async () => db?.close());

test("only event managers can save people", async () => {
  for (const id of [null, outsider, media]) {
    await as(id);
    await assert.rejects(() => save([outside(1)]), id ? /Event access required/ : /permission/);
  }
  await as(events);
  await save([outside(1)]);
  assert.equal((await people()).length, 1);
});

test("saves members and outside people in order, with links and one-language bios", async () => {
  await as(events);
  await save([
    {
      role: "presenter",
      member_id: memberId,
      name: "عضو النادي",
      name_en: "Club Member",
      bio: "نبذة عن موضوع الورشة",
      linkedin_url: "https://www.linkedin.com/in/member",
      github_url: "https://github.com/member",
    },
    { role: "presenter", name_en: "Guest Speaker", bio_en: "Guest bio only in English" },
    { role: "organizer", member_id: memberId, name: "عضو النادي", name_en: "Club Member" },
  ]);
  const rows = await people();
  assert.deepEqual(
    rows.map((r) => [r.role, r.display_order, r.name_en, r.member_id]),
    [
      ["presenter", 0, "Club Member", memberId],
      ["presenter", 1, "Guest Speaker", null],
      ["organizer", 0, "Club Member", memberId],
    ],
  );
  assert.equal(rows[0].linkedin_url, "https://www.linkedin.com/in/member");
  assert.equal(rows[1].name, null);
  // The first presenter is mirrored into data for old readers.
  const { data } = (await db.query("select data from club_events where id=$1", [eventId])).rows[0];
  assert.equal(data.presenterName_en, "Club Member");
});

test("reorders by saving the list again", async () => {
  await as(events);
  await save([outside(1), outside(2), outside(3)]);
  await save([outside(3), outside(1), outside(2)]);
  assert.deepEqual(
    (await people()).map((r) => r.name),
    ["ضيف 3", "ضيف 1", "ضيف 2"],
  );
});

test("at most six presenters and six organizers", async () => {
  await as(events);
  const six = [1, 2, 3, 4, 5, 6].map((n) => outside(n));
  await save(six);
  await assert.rejects(() => save([...six, outside(7)]), /At most 6/);
  assert.equal((await people()).length, 6, "a rejected save changes nothing");
});

test("rejects bad rows", async () => {
  await as(events);
  for (const bad of [
    outside(1, { linkedin_url: "http://linkedin.com/in/x" }),
    outside(1, { github_url: "javascript:alert(1)" }),
    outside(1, { bio: null }),
    outside(1, { name: null }),
    outside(1, { role: "host" }),
    { role: "organizer", name: "منظم من الخارج" },
  ])
    await assert.rejects(() => save([bad]));
  await assert.rejects(() => save({ role: "presenter" }), /array/);
});

test("an event save without presenter keys, then the people save, keeps the full list", async () => {
  await as(events);
  await save([outside(1), outside(2)]);
  // The admin saves the event first (no presenter keys any more), then the people.
  await db.query("update club_events set data=$1 where id=$2", [
    JSON.stringify(eventData({ title_en: "Renamed event" })),
    eventId,
  ]);
  await save([outside(1), outside(2)]);
  assert.deepEqual(
    (await people()).map((r) => r.name),
    ["ضيف 1", "ضيف 2"],
  );
  const { data } = (await db.query("select data from club_events where id=$1", [eventId])).rows[0];
  assert.equal(data.presenterName, "ضيف 1");
  assert.equal(data.title_en, "Renamed event");
});

test("deleting a member keeps the event's copy of their name and bio", async () => {
  await as(events);
  await save([
    { role: "presenter", member_id: memberId, name: "عضو النادي", bio: "نبذة" },
    { role: "organizer", member_id: memberId, name: "عضو النادي" },
  ]);
  await as(owner);
  await db.query("delete from club_members where id=$1", [memberId]);
  const rows = await people();
  assert.deepEqual(
    rows.map((r) => [r.name, r.member_id]),
    [
      ["عضو النادي", null],
      ["عضو النادي", null],
    ],
  );
});
