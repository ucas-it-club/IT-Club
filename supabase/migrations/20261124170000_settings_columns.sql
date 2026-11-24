-- Issue #50, settings step: typed columns on the single `public` settings row.
--
-- Expand phase, same as news (20261124120000_news_columns.sql). `data` stays
-- and is kept in step both ways, so the live admin, the public payload and the
-- sitemap (which all still read or write only `data`) keep working.
--   * A write that sets `data` fills the columns from it.
--   * A write that only sets columns rebuilds `data` from the columns.
-- Every column is nullable: null means the key is absent from `data`, as today.
-- That also keeps club_set_team_visibility working: its upsert proposes a row
-- holding only `teamVisible`, and Postgres checks that row before the conflict.
-- `check(id='public')` from 202609090001_club.sql already pins the single row.
begin;

alter table public.club_settings
  add column registration_open boolean,
  add column team_visible boolean,
  add column vision text,
  add column vision_en text,
  add column mission text,
  add column mission_en text,
  add column goals text,
  add column goals_en text,
  add column email text,
  add column facebook text,
  add column instagram text,
  add column linkedin text,
  add column github text;

-- `data` as the old readers expect it: absent keys stay absent, '' stays ''.
create function club_private.settings_data(s public.club_settings) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'registrationOpen', s.registration_open, 'teamVisible', s.team_visible,
    'vision', s.vision, 'vision_en', s.vision_en,
    'mission', s.mission, 'mission_en', s.mission_en,
    'goals', s.goals, 'goals_en', s.goals_en,
    'email', s.email, 'facebook', s.facebook, 'instagram', s.instagram,
    'linkedin', s.linkedin, 'github', s.github));
$$;

create function club_private.sync_settings_columns() returns trigger
language plpgsql set search_path='' as $$
declare d jsonb := new.data;
begin
  -- An update that changes no column also refills from `data`: that is the
  -- one-off backfill below, and a no-op save changes nothing either way.
  if d is not null and (tg_op = 'INSERT' or d is distinct from old.data
      or to_jsonb(new) - 'data' = to_jsonb(old) - 'data') then
    new.registration_open := (d->>'registrationOpen')::boolean;
    new.team_visible := (d->>'teamVisible')::boolean;
    new.vision := d->>'vision';
    new.vision_en := d->>'vision_en';
    new.mission := d->>'mission';
    new.mission_en := d->>'mission_en';
    new.goals := d->>'goals';
    new.goals_en := d->>'goals_en';
    new.email := d->>'email';
    new.facebook := d->>'facebook';
    new.instagram := d->>'instagram';
    new.linkedin := d->>'linkedin';
    new.github := d->>'github';
  else
    new.data := club_private.settings_data(new);
  end if;
  return new;
end;$$;

create trigger aa_club_settings_columns before insert or update on public.club_settings
  for each row execute function club_private.sync_settings_columns();

-- One-off backfill (see the trigger comment).
update public.club_settings set data = data;

-- The old `data` check (object, under 100000 bytes) stays: the copy must still
-- fit. The columns add per-field rules; the admin form allows every field empty.
alter table public.club_settings
  add constraint club_settings_vision check (length(vision) <= 20000),
  add constraint club_settings_vision_en check (length(vision_en) <= 20000),
  add constraint club_settings_mission check (length(mission) <= 20000),
  add constraint club_settings_mission_en check (length(mission_en) <= 20000),
  add constraint club_settings_goals check (length(goals) <= 20000),
  add constraint club_settings_goals_en check (length(goals_en) <= 20000),
  add constraint club_settings_email check (email = ''
    or (length(email) <= 254 and email ~ '^[^@ ]+@[^@ ]+[.][^@ ]+$')),
  add constraint club_settings_facebook check (facebook = ''
    or (length(facebook) <= 2048 and facebook ~ '^https://[^[:space:]]+$')),
  add constraint club_settings_instagram check (instagram = ''
    or (length(instagram) <= 2048 and instagram ~ '^https://[^[:space:]]+$')),
  add constraint club_settings_linkedin check (linkedin = ''
    or (length(linkedin) <= 2048 and linkedin ~ '^https://[^[:space:]]+$')),
  add constraint club_settings_github check (github = ''
    or (length(github) <= 2048 and github ~ '^https://[^[:space:]]+$'));

-- Grants on club_settings are table-wide (select for anon and authenticated,
-- insert/update for authenticated), so they already cover the new columns.
revoke all on function club_private.settings_data(public.club_settings) from public;
grant execute on function club_private.settings_data(public.club_settings) to anon, authenticated;
revoke all on function club_private.sync_settings_columns() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
