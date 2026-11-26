import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { migrate } from "./helpers/migrations.mjs";

// Issue #50: members, partners, settings and achievements are read and saved
// through typed columns. A column save must leave `data` exactly as the old
// whole-`data` save did, so the old readers see no change.
const source = readFileSync("src/lib/club/public-api.ts", "utf8").replaceAll(
  "import.meta.env",
  "({ SSR: true })",
);
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const api = {};
vm.runInNewContext(js, { exports: api, URL, URLSearchParams, AbortSignal, Response });

const plain = (value) => JSON.parse(JSON.stringify(value));

// Realistic `data` objects as the old admin wrote them.
const values = {
  members: {
    title: "عضو تجريبي",
    title_en: "Demo member",
    description: "وصف العضو",
    description_en: "Member description",
    images: [],
    role: "منسق",
    role_en: "Coordinator",
    committee: "administrative",
    isFounder: true,
    gender: "female",
    displayOrder: 3,
    githubUrl: "https://github.com/example",
    linkedinUrl: "https://www.linkedin.com/in/example",
    profileEnabled: false,
  },
  partners: {
    title: "شريك تقني",
    title_en: "Tech partner",
    description: "وصف الشريك",
    description_en: "Partner description",
    images: [],
    partnershipType: "رعاية",
    partnershipType_en: "Sponsor",
    websiteUrl: "https://example.org",
  },
  settings: {
    registrationOpen: true,
    teamVisible: false,
    vision: "رؤية",
    vision_en: "Vision",
    mission: "رسالة",
    mission_en: "Mission",
    goals: "",
    goals_en: "",
    email: "club@example.org",
    facebook: "",
    instagram: "",
    linkedin: "",
    github: "",
  },
  achievements: {
    title: "إنجاز",
    title_en: "Achievement",
    type: "workshop",
    committee: "activities",
    date: "2026-11-10",
    summary: "ملخص الإنجاز",
    summary_en: "Achievement summary",
    participants: "الفريق",
    participants_en: "The team",
    evidenceUrl: "https://example.org/evidence",
    status: "approved",
    requirements: { venue: "قاعة" },
    requirements_en: { venue: "Hall" },
  },
};

const tables = {
  members: "club_members",
  partners: "club_partners",
  settings: "club_settings",
  achievements: "club_achievements",
};

test("each kind round-trips through its columns, absent keys still absent", () => {
  for (const [kind, value] of Object.entries(values)) {
    const row = api.toColumns(kind, value);
    assert.ok(!("data" in row), kind);
    assert.deepEqual(plain(api.fromColumns(kind, row)), value, kind);
  }
  // Optional member fields left out of the form come back absent, not null.
  const { gender, displayOrder, githubUrl, linkedinUrl, profileEnabled, ...bare } = values.members;
  const row = api.toColumns("members", bare);
  assert.equal(row.gender, null);
  assert.deepEqual(plain(api.fromColumns("members", row)), bare);
  // A missing image list saves as an empty array: the column is not null.
  const { images, ...noImages } = values.partners;
  assert.deepEqual(plain(api.toColumns("partners", noImages).images), []);
});

test("member saves never touch the personal and team-page columns", () => {
  const row = api.toColumns("members", values.members);
  for (const column of ["student_id", "email", "show_on_team", "member_status"])
    assert.ok(!(column in row), column);
  assert.doesNotMatch(api.columnList("members"), /student_id|email|show_on_team|member_status/);
});

test("settings read keeps '' and drops null, so defaults still apply", () => {
  const read = api.fromColumns("settings", {
    registration_open: null,
    team_visible: null,
    vision: "",
    vision_en: null,
  });
  assert.deepEqual(plain(read), { vision: "" });
});

let db;
const owner = "00000000-0000-4000-8000-000000000001";
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];

before(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`,
  );
  await migrate(db);
  await db.query("insert into auth.users values($1,$2)", [owner, "owner@example.invalid"]);
  await db.query(
    "insert into club_admins values($1,'Owner','owner@example.invalid','super_admin')",
    [owner],
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
  await db.exec("set role authenticated");
});

after(() => db?.close());

/** Writes a JS row as columns, the way PostgREST would. */
async function write(table, row, id) {
  const keys = Object.keys(row);
  const params = keys.map((k) =>
    row[k] !== null && typeof row[k] === "object" && !Array.isArray(row[k])
      ? JSON.stringify(row[k])
      : row[k],
  );
  const sql = id
    ? `update ${table} set ${keys.map((k, i) => `${k}=$${i + 1}`).join(",")} where id=$${keys.length + 1} returning id`
    : `insert into ${table}(${keys.join(",")}) values(${keys.map((_, i) => `$${i + 1}`).join(",")}) returning id`;
  return (await one(sql, id ? [...params, id] : params)).id;
}

test("a column save leaves data exactly as the old data save did", async () => {
  for (const kind of ["members", "partners", "achievements"]) {
    const id = await write(tables[kind], api.toColumns(kind, values[kind]));
    // to_jsonb gives the row as PostgREST sends it (dates as text).
    const saved = await one(`select data, to_jsonb(t) r from ${tables[kind]} t where id=$1`, [id]);
    assert.deepEqual(saved.data, values[kind], kind);
    assert.deepEqual(plain(api.fromColumns(kind, saved.r)), values[kind], kind);

    // An edit that clears an optional field clears it in data too.
    const edited = { ...values[kind] };
    delete edited[kind === "achievements" ? "evidenceUrl" : "linkedinUrl"];
    await write(tables[kind], api.toColumns(kind, edited), id);
    const after = await one(`select data from ${tables[kind]} where id=$1`, [id]);
    assert.deepEqual(after.data, edited, kind);
  }

  // saveSettings upserts: PostgREST runs insert ... on conflict (id) do update.
  const upsert = async (value) => {
    const row = { id: "public", ...api.toColumns("settings", value) };
    const keys = Object.keys(row);
    await db.query(
      `insert into club_settings(${keys.join(",")}) values(${keys.map((_, i) => `$${i + 1}`).join(",")})
       on conflict (id) do update set ${keys.map((k) => `${k}=excluded.${k}`).join(",")}`,
      Object.values(row),
    );
  };
  await upsert({ teamVisible: true, vision: "قديم" });
  await upsert(values.settings);
  const settings = await one("select data, to_jsonb(t) r from club_settings t where id='public'");
  assert.deepEqual(settings.data, values.settings);
  assert.deepEqual(plain(api.fromColumns("settings", settings.r)), values.settings);
});

test("visitors can read every column the public load selects", async () => {
  await db.exec("reset role; set role anon");
  for (const kind of ["members", "partners", "settings"])
    await db.query(`select id, ${api.columnList(kind)} from ${tables[kind]} limit 1`);
  await db.exec("reset role; set role authenticated");
});
