import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import { applyMigration, migrate } from "./helpers/migrations.mjs";
import { before, after, test } from "node:test";

let db, ownerUrl;
const owner = "00000000-0000-4000-8000-000000000001",
  partner = "00000000-0000-4000-8000-000000000002",
  comms = "00000000-0000-4000-8000-000000000003",
  editor = "00000000-0000-4000-8000-000000000004",
  media = "00000000-0000-4000-8000-000000000005",
  events = "00000000-0000-4000-8000-000000000006",
  outsider = "00000000-0000-4000-8000-000000000007";
const legacy = [];

const partnership = (extra = {}) => ({
  title: "شراكة تجريبية",
  title_en: "Demo partnership",
  description: "::club-rich-text-v1::وصف الشراكة",
  description_en: "::club-rich-text-v1::Partnership details",
  images: [],
  partnershipType: "تدريب",
  partnershipType_en: "Training",
  ...extra,
});

async function as(id) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || ""]);
  await db.exec("set role " + (id ? "authenticated" : "anon"));
}
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
async function upload(by, file) {
  await db.exec("reset role");
  const path = `${by}/${file}.webp`;
  await db.query(
    "insert into club_media(name,path,size,mime,created_by) values('photo',$1,10,'image/webp',$2)",
    [path, by],
  );
  return (await one("select club_private.media_url($1) url", [path])).url;
}

before(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`,
  );
  await migrate(db, { before: "partner_columns" });
  for (const [id, role] of [
    [owner, "super_admin"],
    [partner, "partnerships_editor"],
    [comms, "communications_editor"],
    [editor, "editor"],
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
  ownerUrl = await upload(owner, "00000000-0000-4000-8000-0000000000aa");
  // Legacy rows are written the way the live admin writes them today: data only.
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
  for (const data of [
    partnership({
      images: [ownerUrl],
      websiteUrl: "https://example.org/partner",
      githubUrl: "https://github.com/example",
      linkedinUrl: "https://www.linkedin.com/company/example",
    }),
    partnership({ title_en: " Second partner ", partnershipType: "", partnershipType_en: "" }),
  ])
    await db.query("insert into club_partners(data) values($1)", [JSON.stringify(data)]);
  legacy.push(
    ...(
      await db.query(
        "select id,slug,data,created_at,updated_at,updated_by from club_partners order by created_at,id",
      )
    ).rows,
  );
  await applyMigration(db, "partner_columns");
});
after(async () => db?.close());

test("every legacy partner keeps identical values, now in typed columns", async () => {
  for (const row of legacy) {
    const now = await one(
      "select p.*, club_private.partner_data(p) rebuilt from club_partners p where id=$1",
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
    assert.equal(now.title_en, d.title_en, "title is not trimmed");
    assert.equal(now.description, d.description);
    assert.equal(now.description_en, d.description_en);
    assert.deepEqual(now.images, d.images);
    assert.equal(now.partnership_type, d.partnershipType);
    assert.equal(now.partnership_type_en, d.partnershipType_en);
    assert.equal(now.website_url, d.websiteUrl ?? null);
    assert.equal(now.github_url, d.githubUrl ?? null);
    assert.equal(now.linkedin_url, d.linkedinUrl ?? null);
  }
  assert.equal(legacy[0].slug, "demo-partnership");
  assert.equal((await one("select count(*)::int n from club_partner_media")).n, 1);
});

test("a save from the live admin (data only) fills the columns", async () => {
  const id = legacy[0].id;
  await as(partner);
  await db.query("update club_partners set data=$1 where id=$2", [
    JSON.stringify(
      partnership({ title_en: "Renamed by old admin", websiteUrl: "https://a.example" }),
    ),
    id,
  ]);
  const row = await one(
    "select title_en,images,website_url,github_url,slug,updated_by from club_partners where id=$1",
    [id],
  );
  assert.equal(row.title_en, "Renamed by old admin");
  assert.equal(row.website_url, "https://a.example");
  assert.equal(row.github_url, null, "a link left out of data is cleared");
  assert.deepEqual(row.images, []);
  assert.equal(row.slug, "demo-partnership", "slug stays");
  assert.equal(row.updated_by, partner);
  const links = await one("select count(*)::int n from club_partner_media where partner_id=$1", [
    id,
  ]);
  assert.equal(links.n, 0, "image link follows data");

  // Old-admin compatibility view writes go through the same path.
  const viaView = await one(
    "insert into club_content(kind,data) values('partners',$1) returning id",
    [JSON.stringify(partnership({ title_en: "Via view" }))],
  );
  const fromView = await one("select title_en,slug from club_partners where id=$1", [viaView.id]);
  assert.equal(fromView.title_en, "Via view");
  assert.equal(fromView.slug, "via-view");
  await as(null);
});

test("a column save keeps data in step and gets a slug", async () => {
  await as(comms);
  const created = await one(
    `insert into club_partners(title,title_en,description,description_en,partnership_type_en,website_url)
     values('عنوان','New column partner','وصف','Description','Hosting','https://b.example')
     returning id,slug,data`,
  );
  assert.equal(created.slug, "new-column-partner");
  assert.deepEqual(created.data, {
    title: "عنوان",
    title_en: "New column partner",
    description: "وصف",
    description_en: "Description",
    images: [],
    partnershipType_en: "Hosting",
    websiteUrl: "https://b.example",
  });
  await db.query("update club_partners set linkedin_url='https://l.example' where id=$1", [
    created.id,
  ]);
  const updated = await one("select data from club_partners where id=$1", [created.id]);
  assert.equal(updated.data.linkedinUrl, "https://l.example");
  await as(null);
});

test("checks reject bad values in columns and in data", async () => {
  await as(owner);
  const id = legacy[1].id;
  await assert.rejects(
    db.query("update club_partners set title_en=' ' where id=$1", [id]),
    /club_partners_title_en/,
  );
  await assert.rejects(
    db.query("update club_partners set description=repeat('x',20001) where id=$1", [id]),
    /club_partners_description/,
  );
  await assert.rejects(
    db.query("update club_partners set images=array_fill($1::text, array[21]) where id=$2", [
      ownerUrl,
      id,
    ]),
    /club_partners_images/,
  );
  await assert.rejects(
    db.query("update club_partners set data=$1 where id=$2", [
      JSON.stringify(partnership({ title: "x" })),
      id,
    ]),
    /club_partners_title/,
  );
  for (const bad of [
    { ...partnership(), images: undefined },
    partnership({ demoUrl: "https://c.example" }),
    partnership({ websiteUrl: 5 }),
    partnership({ images: [5] }),
  ])
    await assert.rejects(
      db.query("update club_partners set data=$1 where id=$2", [JSON.stringify(bad), id]),
      /partner columns cannot hold/,
    );
  const row = await one("select data from club_partners where id=$1", [id]);
  assert.deepEqual(row.data, legacy[1].data, "refused saves change nothing");
  await as(null);
});

test("partner access stays exactly as today", async () => {
  const id = legacy[1].id;
  for (const who of [owner, editor, partner, comms]) {
    await as(who);
    const saved = await db.query(
      "update club_partners set partnership_type='نوع' where id=$1 returning id",
      [id],
    );
    assert.equal(saved.rows.length, 1, `${who} can manage partners`);
  }
  for (const who of [media, events, outsider]) {
    await as(who);
    for (const sql of [
      "update club_partners set partnership_type='hijack' where id=$1",
      'update club_partners set data=data||\'{"title":"hijack"}\' where id=$1',
      "delete from club_partners where id=$1",
    ])
      assert.equal((await db.query(sql, [id])).affectedRows, 0, `${who} has no partner access`);
    await assert.rejects(
      db.query(
        "insert into club_partners(title,title_en,description,description_en) values('aa','bb','cc','dd')",
      ),
    );
  }
  await as(null);
  const visible = await one("select data,partnership_type from club_partners where id=$1", [id]);
  assert.equal(visible.partnership_type, "نوع", "visitors read the columns");
  assert.equal(visible.data.partnershipType, "نوع");
  await assert.rejects(db.query("update club_partners set title='hijack'"));
});

test("column saves follow the partner image rules", async () => {
  const id = legacy[1].id;
  const eventsUrl = await upload(events, "00000000-0000-4000-8000-0000000000bb");
  const ownUrl = await upload(partner, "00000000-0000-4000-8000-0000000000cc");
  await as(partner);
  await assert.rejects(
    db.query("update club_partners set images=array[$1] where id=$2", [eventsUrl, id]),
    /not available to this committee/,
  );
  await db.query("update club_partners set images=array[$1] where id=$2", [ownUrl, id]);
  const linked = await one("select count(*)::int n from club_partner_media where partner_id=$1", [
    id,
  ]);
  assert.equal(linked.n, 1);
  const row = await one("select data from club_partners where id=$1", [id]);
  assert.deepEqual(row.data.images, [ownUrl]);
  await as(owner);
  await db.query("update club_partners set images='{}' where id=$1", [id]);
  const unlinked = await one("select count(*)::int n from club_partner_media where partner_id=$1", [
    id,
  ]);
  assert.equal(unlinked.n, 0, "clearing the column unlinks the image");
  await as(null);
});
