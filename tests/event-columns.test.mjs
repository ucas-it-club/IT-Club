import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import { applyMigration, migrate } from "./helpers/migrations.mjs";
import { before, after, test } from "node:test";

let db, mediaUrl;
const owner = "00000000-0000-4000-8000-000000000001",
  events = "00000000-0000-4000-8000-000000000002",
  media = "00000000-0000-4000-8000-000000000003",
  outsider = "00000000-0000-4000-8000-000000000004";
const legacy = [];

const event = (extra = {}) => ({
  title: "فعالية تجريبية",
  title_en: "Demo event",
  description: "::club-rich-text-v1::تفاصيل الفعالية",
  description_en: "::club-rich-text-v1::Event details",
  images: [],
  driveImageUrls: [],
  date: "2026-11-10",
  status: "upcoming",
  eventTime: "00:00",
  durationMinutes: 120,
  eventType: "ورشة",
  eventType_en: "Workshop",
  presenterName: "مقدم",
  presenterName_en: "Presenter",
  presenterBio: "نبذة المقدم",
  presenterBio_en: " Presenter bio",
  eventRegistration: {
    enabled: true,
    nameEnabled: true,
    phoneEnabled: false,
    attendanceEnabled: true,
  },
  ...extra,
});

async function as(id) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || ""]);
  await db.exec("set role " + (id ? "authenticated" : "anon"));
}
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];

before(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`,
  );
  await migrate(db, { before: "event_columns" });
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
  // Legacy rows are written the way the live admin writes them today: data only.
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
  const path = `${owner}/00000000-0000-4000-8000-0000000000aa.webp`;
  await db.query(
    "insert into club_media(name,path,size,mime,created_by) values('poster',$1,10,'image/webp',$2)",
    [path, owner],
  );
  mediaUrl = (await one("select club_private.media_url($1) url", [path])).url;
  for (const data of [
    event({
      images: [mediaUrl],
      summary: "ملخص",
      summary_en: "Summary",
      driveImageUrls: ["https://drive.google.com/thumbnail?id=1PWmBispWLlXHzsiwzbZabc&sz=w2000"],
    }),
    event({ status: "past", eventRegistration: undefined }),
    event({ driveImageUrls: undefined, title_en: "Second demo event" }),
  ])
    await db.query("insert into club_events(data) values($1)", [JSON.stringify(data)]);
  legacy.push(
    ...(
      await db.query(
        "select id,slug,data,created_at,updated_at,updated_by from club_events order by created_at,id",
      )
    ).rows,
  );
  await applyMigration(db, "event_columns");
});
after(async () => db?.close());

test("every legacy event keeps identical values, now in typed columns", async () => {
  for (const row of legacy) {
    const now = await one(
      `select e.*, to_char(e.date,'YYYY-MM-DD') day_text, club_private.event_data(e) rebuilt
       from club_events e where id=$1`,
      [row.id],
    );
    const d = row.data;
    assert.deepEqual(now.data, d, "data is untouched");
    assert.deepEqual(now.rebuilt, d, "columns rebuild the exact same data");
    assert.equal(now.slug, row.slug);
    assert.equal(now.created_at.getTime(), row.created_at.getTime());
    assert.equal(now.updated_at.getTime(), row.updated_at.getTime());
    assert.equal(now.updated_by, row.updated_by);
    assert.equal(now.title, d.title);
    assert.equal(now.title_en, d.title_en);
    assert.equal(now.description_en, d.description_en);
    assert.equal(now.summary, d.summary ?? null);
    assert.deepEqual(now.images, d.images);
    assert.deepEqual(now.drive_image_urls, d.driveImageUrls ?? null);
    assert.equal(now.day_text, d.date);
    assert.equal(now.status, d.status);
    assert.equal(now.event_time, d.eventTime);
    assert.equal(now.duration_minutes, d.durationMinutes);
    assert.equal(now.event_type_en, d.eventType_en);
    assert.equal(now.registration_enabled, d.eventRegistration?.enabled ?? null);
    assert.equal(now.registration_phone_enabled, d.eventRegistration?.phoneEnabled ?? null);
    const people = (await db.query("select * from club_event_people where event_id=$1", [row.id]))
      .rows;
    assert.equal(people.length, 1);
    assert.equal(people[0].role, "presenter");
    assert.equal(people[0].member_id, null);
    assert.equal(people[0].display_order, 0);
    assert.equal(people[0].name, d.presenterName);
    assert.equal(people[0].name_en, d.presenterName_en);
    assert.equal(people[0].bio, d.presenterBio);
    assert.equal(people[0].bio_en, d.presenterBio_en, "bio is not trimmed");
  }
  assert.equal(
    (await one("select count(*)::int n from club_event_media")).n,
    1,
    "image links survive",
  );
});

test("a save from the live admin (data only) fills the columns and the presenter", async () => {
  const id = legacy[1].id;
  await as(events);
  await db.query("update club_events set data=$1 where id=$2", [
    JSON.stringify(event({ title_en: "Renamed by old admin", presenterName_en: "New presenter" })),
    id,
  ]);
  await as(null);
  const row = await one("select title_en,registration_enabled from club_events where id=$1", [id]);
  assert.equal(row.title_en, "Renamed by old admin");
  assert.equal(row.registration_enabled, true);
  const presenter = await one(
    "select name_en from club_event_people where event_id=$1 and role='presenter'",
    [id],
  );
  assert.equal(presenter.name_en, "New presenter");
});

test("a column save keeps data in step for readers that still use it", async () => {
  await as(events);
  const created = await one(
    `insert into club_events(title,title_en,description,description_en,date,status,event_time,
       duration_minutes,event_type,event_type_en,registration_enabled,registration_name_enabled,
       registration_phone_enabled,registration_attendance_enabled)
     values('عنوان جديد','New column event','وصف','Description','2026-12-01','upcoming','18:30',
       90,'محاضرة','Lecture',false,true,true,true) returning id,slug,data`,
  );
  assert.equal(created.slug, "new-column-event");
  assert.equal(created.data.title_en, "New column event");
  assert.equal(created.data.date, "2026-12-01");
  assert.deepEqual(created.data.images, []);
  assert.equal(created.data.presenterName, undefined);
  await db.query(
    `insert into club_event_people(event_id,role,name,name_en,bio,bio_en)
     values($1,'presenter','اسم','Name','نبذة','Bio')`,
    [created.id],
  );
  const refreshed = await one("select data from club_events where id=$1", [created.id]);
  assert.equal(refreshed.data.presenterName_en, "Name");
  assert.equal(refreshed.data.presenterBio, "نبذة");

  await db.query("update club_events set title_en='Column rename' where id=$1", [created.id]);
  const renamed = await one("select data from club_events where id=$1", [created.id]);
  assert.equal(renamed.data.title_en, "Column rename");
  assert.equal(renamed.data.presenterName_en, "Name", "presenter stays in data");
  await as(null);
});

test("club_event_people follows the event access rules and limits", async () => {
  const id = legacy[0].id;
  await as(null);
  assert.equal((await db.query("select * from club_event_people")).rows.length > 0, true);
  await assert.rejects(
    db.query("insert into club_event_people(event_id,role,name) values($1,'organizer','X Y')", [
      id,
    ]),
  );
  await as(media);
  await assert.rejects(
    db.query("insert into club_event_people(event_id,role,name) values($1,'organizer','X Y')", [
      id,
    ]),
  );
  await as(outsider);
  const hijack = await db.query("update club_events set title_en='Hijacked' where id=$1", [id]);
  assert.equal(hijack.affectedRows, 0);
  await as(events);
  await db.query(
    "insert into club_event_people(event_id,role,name_en,display_order) values($1,'organizer','Organizer only',0)",
    [id],
  );
  await assert.rejects(
    db.query(
      "insert into club_event_people(event_id,role,name) values($1,'presenter','بلا نبذة')",
      [id],
    ),
    /club_event_people_presenter_bio/,
  );
  await assert.rejects(
    db.query("insert into club_event_people(event_id,role,bio) values($1,'organizer','نبذة')", [
      id,
    ]),
    /club_event_people_name/,
  );
  for (let order = 1; order <= 5; order++)
    await db.query(
      "insert into club_event_people(event_id,role,name,display_order) values($1,'organizer',$2,$3)",
      [id, "Organizer " + order, order],
    );
  await assert.rejects(
    db.query(
      "insert into club_event_people(event_id,role,name,display_order) values($1,'organizer','Seventh',6)",
      [id],
    ),
    "at most six organizers",
  );
  await as(owner);
  await db.query("delete from club_events where id=$1", [id]);
  assert.equal(
    (await one("select count(*)::int n from club_event_people where event_id=$1", [id])).n,
    0,
  );
  await as(null);
});

test("column saves keep image links, image rules and slugs working", async () => {
  const id = legacy[1].id;
  await db.exec("reset role");
  const ownPath = `${events}/00000000-0000-4000-8000-0000000000cc.webp`;
  await db.query(
    "insert into club_media(name,path,size,mime,created_by) values('event photo',$1,10,'image/webp',$2)",
    [ownPath, events],
  );
  const ownUrl = (await one("select club_private.media_url($1) url", [ownPath])).url;
  await as(events);
  await db.query("update club_events set images=array[$1] where id=$2", [ownUrl, id]);
  const linked = await one("select count(*)::int n from club_event_media where event_id=$1", [id]);
  assert.equal(linked.n, 1);
  await db.query("update club_events set images='{}' where id=$1", [id]);
  const unlinked = await one("select count(*)::int n from club_event_media where event_id=$1", [
    id,
  ]);
  assert.equal(unlinked.n, 0);

  await as(null);
  await db.exec("reset role");
  const path = `${media}/00000000-0000-4000-8000-0000000000bb.webp`;
  await db.query(
    "insert into club_media(name,path,size,mime,created_by) values('news photo',$1,10,'image/webp',$2)",
    [path, media],
  );
  const otherUrl = (await one("select club_private.media_url($1) url", [path])).url;
  await as(events);
  await assert.rejects(
    db.query("update club_events set images=array[$1] where id=$2", [otherUrl, id]),
    /not available to this committee/,
  );

  await as(owner);
  const news = await one("insert into club_news(data) values($1) returning id,slug", [
    JSON.stringify({
      title: "خبر",
      title_en: "Shared trigger news",
      description: "تفاصيل الخبر",
      description_en: "News details",
      images: [mediaUrl],
      date: "2026-11-20",
    }),
  ]);
  assert.equal(news.slug, "shared-trigger-news");
  const newsLinks = await one("select count(*)::int n from club_news_media where news_id=$1", [
    news.id,
  ]);
  assert.equal(newsLinks.n, 1);
  await as(null);
});
