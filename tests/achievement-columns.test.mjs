import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import { applyMigration, migrate } from "./helpers/migrations.mjs";
import { before, after, test } from "node:test";

let db;
const owner = "00000000-0000-4000-8000-000000000001",
  comms = "00000000-0000-4000-8000-000000000002",
  events = "00000000-0000-4000-8000-000000000003",
  media = "00000000-0000-4000-8000-000000000004",
  outsider = "00000000-0000-4000-8000-000000000005";
const committees = ["club", "media", "relations", "activities"];
// Today's access, from 20261104190000_achievements.sql.
const allowed = {
  [owner]: committees,
  [comms]: ["media", "relations"],
  [events]: ["activities"],
  [media]: [],
  [outsider]: [],
};
const legacy = [];

const achievement = (extra = {}) => ({
  title: "إنجاز تجريبي",
  title_en: "Demo achievement",
  type: "event",
  committee: "activities",
  date: "2026-11-10",
  summary: "ملخص الإنجاز",
  summary_en: " Achievement summary",
  participants: "",
  participants_en: "",
  evidenceUrl: "",
  status: "draft",
  requirements: {},
  requirements_en: {},
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
  await migrate(db, { before: "achievement_columns" });
  for (const [id, role] of [
    [owner, "super_admin"],
    [comms, "communications_editor"],
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
  await as(owner);
  for (const data of [
    achievement({
      type: "project",
      committee: "club",
      status: "approved",
      participants: "أعضاء النادي",
      participants_en: "Club members",
      evidenceUrl: "https://example.org/proof",
      requirements: { owner: "فلان", outcomes: "" },
      requirements_en: { owner: "Someone", outcomes: "" },
    }),
    achievement({ committee: "media", title_en: "Media item" }),
    achievement(),
  ]) {
    if (!data.evidenceUrl) delete data.evidenceUrl; // older saves have no evidenceUrl
    await db.query("insert into club_achievements(data) values($1)", [JSON.stringify(data)]);
  }
  await db.exec("reset role");
  legacy.push(
    ...(
      await db.query(
        "select id,data,created_at,updated_at,updated_by from club_achievements order by created_at,id",
      )
    ).rows,
  );
  await applyMigration(db, "achievement_columns");
});
after(async () => db?.close());

test("every legacy achievement keeps identical values, now in typed columns", async () => {
  assert.equal(legacy.length, 3);
  for (const row of legacy) {
    const now = await one(
      `select a.*, to_char(a.date,'YYYY-MM-DD') day_text, club_private.achievement_data(a) rebuilt
       from club_achievements a where id=$1`,
      [row.id],
    );
    const d = row.data;
    assert.deepEqual(now.data, d, "data is untouched");
    assert.deepEqual(now.rebuilt, d, "columns rebuild the exact same data");
    assert.equal(now.created_at.getTime(), row.created_at.getTime());
    assert.equal(now.updated_at.getTime(), row.updated_at.getTime());
    assert.equal(now.updated_by, row.updated_by);
    assert.equal(now.title, d.title);
    assert.equal(now.title_en, d.title_en);
    assert.equal(now.type, d.type);
    assert.equal(now.committee, d.committee);
    assert.equal(now.day_text, d.date);
    assert.equal(now.summary, d.summary);
    assert.equal(now.summary_en, d.summary_en, "summary is not trimmed");
    assert.equal(now.participants, d.participants);
    assert.equal(now.participants_en, d.participants_en);
    assert.equal(now.evidence_url, d.evidenceUrl ?? null);
    assert.equal(now.status, d.status);
    assert.deepEqual(now.requirements, d.requirements);
    assert.deepEqual(now.requirements_en, d.requirements_en);
  }
});

test("a save from the live admin (data only) fills the columns", async () => {
  const id = legacy[2].id;
  await as(events);
  const data = achievement({
    title_en: "Renamed by old admin",
    date: "2026-11-15",
    status: "approved",
    requirements: { location: "القاعة" },
    requirements_en: { location: "Hall" },
  });
  await db.query("update club_achievements set data=$1 where id=$2", [JSON.stringify(data), id]);
  const row = await one(
    "select title_en,to_char(date,'YYYY-MM-DD') day_text,status,requirements_en,data,updated_by from club_achievements where id=$1",
    [id],
  );
  assert.equal(row.title_en, "Renamed by old admin");
  assert.equal(row.day_text, "2026-11-15");
  assert.equal(row.status, "approved");
  assert.deepEqual(row.requirements_en, { location: "Hall" });
  assert.deepEqual(row.data, data, "data is stored as sent");
  assert.equal(row.updated_by, events, "audit still runs");
  await as(null);
});

test("a column save keeps data in step", async () => {
  await as(comms);
  const created = await one(
    `insert into club_achievements(title,title_en,type,committee,date,summary,summary_en,
       participants,participants_en,status,requirements,requirements_en)
     values('عنوان','Column achievement','media','relations','2026-12-01','ملخص','Summary',
       '','','draft','{"platform":"x"}','{"platform":"X"}') returning id,data`,
  );
  assert.deepEqual(created.data, {
    title: "عنوان",
    title_en: "Column achievement",
    type: "media",
    committee: "relations",
    date: "2026-12-01",
    summary: "ملخص",
    summary_en: "Summary",
    participants: "",
    participants_en: "",
    status: "draft",
    requirements: { platform: "x" },
    requirements_en: { platform: "X" },
  });
  await db.query(
    "update club_achievements set evidence_url='https://example.org/e', status='approved' where id=$1",
    [created.id],
  );
  const updated = await one("select data from club_achievements where id=$1", [created.id]);
  assert.equal(updated.data.evidenceUrl, "https://example.org/e");
  assert.equal(updated.data.status, "approved");
  await as(null);
});

test("checks reject bad values, whether written as columns or as data", async () => {
  await as(owner);
  const id = legacy[0].id;
  for (const [sql, name] of [
    ["title_en=' '", "club_achievements_title_en"],
    ["title=repeat('x',201)", "club_achievements_title"],
    ["type='party'", "club_achievements_type"],
    ["committee='sports'", "club_achievements_committee"],
    ["summary='x'", "club_achievements_summary"],
    ["summary_en=repeat('x',4001)", "club_achievements_summary_en"],
    ["status='published'", "club_achievements_status"],
    [`requirements='[]'`, "club_achievements_requirements"],
    [`requirements_en='"x"'`, "club_achievements_requirements_en"],
  ])
    await assert.rejects(
      db.query(`update club_achievements set ${sql} where id=$1`, [id]),
      new RegExp(name),
    );
  await assert.rejects(
    db.query("update club_achievements set participants=null where id=$1", [id]),
    /participants/,
  );
  const bad = achievement({ type: "party" });
  await assert.rejects(
    db.query("insert into club_achievements(data) values($1)", [JSON.stringify(bad)]),
    /club_achievements_type/,
  );
  const missing = achievement();
  delete missing.summary;
  await assert.rejects(
    db.query("insert into club_achievements(data) values($1)", [JSON.stringify(missing)]),
    /summary/,
  );
  await as(null);
});

test("every role keeps exactly today's access", async () => {
  await db.exec("reset role");
  const ids = {};
  for (const committee of committees)
    ids[committee] = (
      await one("insert into club_achievements(data) values($1) returning id", [
        JSON.stringify(achievement({ committee, title_en: "Access " + committee })),
      ])
    ).id;
  for (const [who, mine] of Object.entries(allowed)) {
    for (const committee of committees) {
      const ok = mine.includes(committee);
      const id = ids[committee];
      await as(who);
      const seen = await db.query("select id from club_achievements where id=$1", [id]);
      assert.equal(seen.rows.length, ok ? 1 : 0, `${who} reads ${committee}`);
      const byData = await db.query("update club_achievements set data=data where id=$1", [id]);
      const byColumn = await db.query(
        "update club_achievements set status='approved' where id=$1",
        [id],
      );
      assert.equal(byData.affectedRows, ok ? 1 : 0, `${who} updates ${committee} data`);
      assert.equal(byColumn.affectedRows, ok ? 1 : 0, `${who} updates ${committee} column`);
      const insert = db.query("insert into club_achievements(data) values($1) returning id", [
        JSON.stringify(achievement({ committee })),
      ]);
      const insertColumns = db.query(
        `insert into club_achievements(title,title_en,type,committee,date,summary,summary_en,
           participants,participants_en,status,requirements,requirements_en)
         values('عنوان','Title','other',$1,'2026-12-01','ملخص','Summary','','','draft','{}','{}')`,
        [committee],
      );
      if (ok) {
        await insert;
        await insertColumns;
      } else {
        await assert.rejects(insert, /row-level security/, `${who} inserts ${committee} data`);
        await assert.rejects(
          insertColumns,
          /row-level security/,
          `${who} inserts ${committee} columns`,
        );
      }
      if (ok) {
        // Moving a row to a committee outside the role is refused.
        const outside = committees.find((c) => !mine.includes(c));
        if (outside)
          await assert.rejects(
            db.query("update club_achievements set committee=$1 where id=$2", [outside, id]),
            /row-level security/,
          );
      }
    }
  }
  // Least access first, so refused deletes meet rows that still exist.
  for (const [who, mine] of Object.entries(allowed).reverse()) {
    await as(who);
    for (const committee of committees) {
      const removed = await db.query("delete from club_achievements where id=$1", [ids[committee]]);
      if (!mine.includes(committee))
        assert.equal(removed.affectedRows, 0, `${who} deletes ${committee}`);
    }
  }
  await db.exec("reset role");
  assert.equal(
    (
      await one("select count(*)::int n from club_achievements where id=any($1)", [
        Object.values(ids),
      ])
    ).n,
    0,
    "every row was deleted by a role allowed to",
  );
  await as(null);
  await assert.rejects(db.query("select id from club_achievements"), /permission denied/);
});
