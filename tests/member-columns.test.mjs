import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import { applyMigration, migrate } from "./helpers/migrations.mjs";
import { before, after, test } from "node:test";

let db, mediaUrl;
const owner = "00000000-0000-4000-8000-000000000001",
  editor = "00000000-0000-4000-8000-000000000002",
  comms = "00000000-0000-4000-8000-000000000003",
  events = "00000000-0000-4000-8000-000000000004",
  outsider = "00000000-0000-4000-8000-000000000005";
const legacy = [];
// RLS for column saves; the asset trigger answers first on inserts and data saves.
const denied = /row-level security|Member access required/;

const member = (extra = {}) => ({
  title: "عضو تجريبي",
  title_en: "Demo member",
  description: "وصف العضو",
  description_en: "Member description",
  images: [],
  role: "منسق",
  role_en: "Coordinator",
  committee: "media",
  isFounder: false,
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
  await migrate(db, { before: "member_columns" });
  for (const [id, role] of [
    [owner, "super_admin"],
    [editor, "editor"],
    [comms, "communications_editor"],
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
  for (const data of [
    member({
      title_en: "Board member",
      committee: "administrative",
      isFounder: true,
      displayOrder: 3,
      gender: "female",
      profileEnabled: false,
      images: [mediaUrl],
      githubUrl: "https://github.com/example",
      linkedinUrl: "https://www.linkedin.com/in/example",
    }),
    member({ title_en: "Media member", gender: "male", profileEnabled: true }),
    member({ title_en: "Activities member", committee: "activities", role: "", role_en: "" }),
  ])
    await db.query("insert into club_members(data) values($1)", [JSON.stringify(data)]);
  legacy.push(
    ...(
      await db.query(
        "select id,slug,data,created_at,updated_at,updated_by from club_members order by created_at,id",
      )
    ).rows,
  );
  await applyMigration(db, "member_columns");
});
after(async () => db?.close());

const byTitle = (title) => legacy.find((row) => row.data.title_en === title).id;

test("every legacy member keeps identical values, now in typed columns", async () => {
  for (const row of legacy) {
    const now = await one(
      "select m.*, club_private.member_data(m) rebuilt from club_members m where id=$1",
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
    assert.equal(now.description, d.description);
    assert.equal(now.description_en, d.description_en);
    assert.deepEqual(now.images, d.images);
    assert.equal(now.role, d.role);
    assert.equal(now.role_en, d.role_en);
    assert.equal(now.committee, d.committee);
    assert.equal(now.is_founder, d.isFounder);
    assert.equal(now.gender, d.gender ?? null);
    assert.equal(now.display_order, d.displayOrder ?? null);
    assert.equal(now.github_url, d.githubUrl ?? null);
    assert.equal(now.linkedin_url, d.linkedinUrl ?? null);
    assert.equal(now.profile_enabled, d.profileEnabled ?? null);
    assert.equal(now.student_id, null);
    assert.equal(now.email, null);
    assert.equal(now.show_on_team, true, "existing members stay on the team page");
    assert.equal(now.member_status, "active");
  }
  assert.equal((await one("select count(*)::int n from club_member_media")).n, 1);
});

test("a save from the live admin (data only) fills the columns and keeps the new fields", async () => {
  const id = byTitle("Media member");
  await as(owner);
  await db.query(
    "update club_members set student_id='120230001', email='member@example.com', show_on_team=false, member_status='alumni' where id=$1",
    [id],
  );
  await as(comms);
  await db.query("update club_members set data=$1 where id=$2", [
    JSON.stringify(member({ title_en: "Renamed by old admin", role_en: "Lead", gender: "male" })),
    id,
  ]);
  const row = await one("select * from club_members where id=$1", [id]);
  assert.equal(row.title_en, "Renamed by old admin");
  assert.equal(row.role_en, "Lead");
  assert.equal(row.profile_enabled, null, "a key the old admin left out is cleared");
  assert.equal(row.student_id, "120230001");
  assert.equal(row.email, "member@example.com");
  assert.equal(row.show_on_team, false);
  assert.equal(row.member_status, "alumni");
  for (const key of ["studentId", "student_id", "email", "show_on_team", "member_status"])
    assert.equal(row.data[key], undefined, `${key} stays out of data`);
  await as(null);
});

test("a column save keeps data in step and gets a slug", async () => {
  await as(comms);
  const created = await one(
    `insert into club_members(title,title_en,description,description_en,committee,is_founder,role_en,student_id,email)
     values('اسم','New column member','وصف','Description','relations',false,'Writer','220241234','New@Example.com')
     returning id,slug,data`,
  );
  assert.equal(created.slug, "new-column-member");
  assert.deepEqual(created.data, {
    title: "اسم",
    title_en: "New column member",
    description: "وصف",
    description_en: "Description",
    images: [],
    committee: "relations",
    isFounder: false,
    role_en: "Writer",
  });
  await db.query("update club_members set display_order=7, gender='female' where id=$1", [
    created.id,
  ]);
  const updated = await one("select data from club_members where id=$1", [created.id]);
  assert.equal(updated.data.displayOrder, 7);
  assert.equal(updated.data.gender, "female");
  await as(owner);
  await db.query("update club_members set images=array[$1] where id=$2", [mediaUrl, created.id]);
  const links = await one("select count(*)::int n from club_member_media where member_id=$1", [
    created.id,
  ]);
  assert.equal(links.n, 1, "a column image save links the media");
  await as(null);
});

test("checks reject bad values and unknown data keys", async () => {
  await as(owner);
  const id = byTitle("Activities member");
  for (const [sql, rule] of [
    ["student_id='320230001'", /club_members_student_id/],
    ["student_id='12023000'", /club_members_student_id/],
    ["student_id='1202300011'", /club_members_student_id/],
    ["student_id='12023000a'", /club_members_student_id/],
    ["email='not-an-email'", /club_members_email/],
    ["email='a b@example.com'", /club_members_email/],
    ["member_status='banned'", /club_members_member_status/],
    ["member_status=null", /member_status/],
    ["committee='sports'", /club_members_committee/],
    ["title_en=' '", /club_members_title_en/],
    ["display_order=0", /club_members_display_order/],
    ["github_url='http://github.com/x'", /club_members_github_url/],
    ["student_id='120230001'", /club_members_student_id_unique/],
    ["email='MEMBER@example.com'", /club_members_email_unique/],
  ])
    await assert.rejects(db.query(`update club_members set ${sql} where id=$1`, [id]), rule, sql);
  await assert.rejects(
    db.query("update club_members set data=$1 where id=$2", [
      JSON.stringify(member({ partnershipType: "تدريب" })),
      id,
    ]),
    /club_members_data_keys/,
  );
  await db.query("update club_members set student_id='220230002', email='x@y.co' where id=$1", [
    id,
  ]);
  await as(null);
});

test("permissions are unchanged for each role, for data and column saves", async () => {
  const ids = {
    media: byTitle("Media member"),
    activities: byTitle("Activities member"),
    founder: byTitle("Board member"),
  };
  const can = {
    [owner]: ["media", "activities", "founder"],
    [editor]: ["media", "activities", "founder"],
    [comms]: ["media"],
    [events]: ["activities"],
    [outsider]: [],
  };
  for (const [who, allowed] of Object.entries(can)) {
    await as(who);
    for (const [kind, id] of Object.entries(ids)) {
      const ok = allowed.includes(kind);
      const column = await db.query(
        "update club_members set role_en='Checked' where id=$1 returning id",
        [id],
      );
      assert.equal(column.rows.length, ok ? 1 : 0, `${who} column save on ${kind}`);
      const current = await one("select data from club_members where id=$1", [id]);
      const data = await db.query("update club_members set data=$1 where id=$2 returning id", [
        JSON.stringify({ ...current.data, role: "فحص" }),
        id,
      ]);
      assert.equal(data.rows.length, ok ? 1 : 0, `${who} data save on ${kind}`);
    }
  }

  // Moving a member out of an editor's committee is refused both ways.
  await as(comms);
  await assert.rejects(
    db.query("update club_members set committee='activities' where id=$1", [ids.media]),
    denied,
  );
  await assert.rejects(
    db.query("update club_members set is_founder=true where id=$1", [ids.media]),
    denied,
  );
  const current = await one("select data from club_members where id=$1", [ids.media]);
  await assert.rejects(
    db.query("update club_members set data=$1 where id=$2", [
      JSON.stringify({ ...current.data, committee: "activities" }),
      ids.media,
    ]),
    denied,
  );
  await assert.rejects(
    db.query(
      "insert into club_members(title,title_en,description,description_en,committee,is_founder) values('اسم','Not mine','وصف','Desc','activities',false)",
    ),
    denied,
  );
  await as(events);
  assert.equal(
    (await db.query("delete from club_members where id=$1 returning id", [ids.founder])).rows
      .length,
    0,
  );
  await as(owner);
  assert.equal(
    (await one("select committee from club_members where id=$1", [ids.media])).committee,
    "media",
  );
  await as(null);
});

test("visitors cannot read student IDs or emails; admins can", async () => {
  await as(null);
  const visible = await db.query(
    "select id,slug,data,title_en,committee,show_on_team,member_status from club_members",
  );
  assert.ok(visible.rows.length >= 3);
  await assert.rejects(db.query("select student_id from club_members"), /permission denied/);
  await assert.rejects(db.query("select email from club_members"), /permission denied/);
  await assert.rejects(db.query("select * from club_members"), /permission denied/);
  await as(owner);
  const admin = await db.query("select student_id,email from club_members where email is not null");
  assert.ok(admin.rows.length >= 1);
  await as(null);
});
