-- Issue #50, achievements step: typed columns.
--
-- Expand phase, same as events and news (20261124120000_news_columns.sql).
-- `data` stays and is kept in step both ways, so the live admin (which still
-- writes only `data`) keeps working until it switches to the columns.
--   * A write that sets `data` fills the columns from it.
--   * A write that only sets columns rebuilds `data` from the columns.
-- `requirements` / `requirements_en` stay jsonb objects: their keys depend on
-- the achievement type (owner, location, trainer, ...), so one column per key
-- would be mostly empty and would change whenever the admin form does.
begin;

alter table public.club_achievements
  add column title text,
  add column title_en text,
  add column type text,
  add column committee text,
  add column date date,
  add column summary text,
  add column summary_en text,
  add column participants text,
  add column participants_en text,
  add column evidence_url text,
  add column status text,
  add column requirements jsonb,
  add column requirements_en jsonb;

-- `data` as the old readers expect it: absent keys stay absent, nothing is
-- trimmed, and nulls inside the requirement objects are kept.
create function club_private.achievement_data(a public.club_achievements) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'title', a.title, 'title_en', a.title_en,
    'type', a.type, 'committee', a.committee,
    'date', to_char(a.date, 'YYYY-MM-DD'),
    'summary', a.summary, 'summary_en', a.summary_en,
    'participants', a.participants, 'participants_en', a.participants_en,
    'evidenceUrl', a.evidence_url, 'status', a.status))
  || jsonb_build_object('requirements', a.requirements, 'requirements_en', a.requirements_en);
$$;

create function club_private.sync_achievement_columns() returns trigger
language plpgsql set search_path='' as $$
declare d jsonb := new.data;
begin
  -- New title null only happens on the one-off backfill below.
  if d is not null and (tg_op = 'INSERT' or d is distinct from old.data or new.title is null) then
    new.title := d->>'title';
    new.title_en := d->>'title_en';
    new.type := d->>'type';
    new.committee := d->>'committee';
    new.date := (d->>'date')::date;
    new.summary := d->>'summary';
    new.summary_en := d->>'summary_en';
    new.participants := d->>'participants';
    new.participants_en := d->>'participants_en';
    new.evidence_url := d->>'evidenceUrl';
    new.status := d->>'status';
    new.requirements := d->'requirements';
    new.requirements_en := d->'requirements_en';
  else
    new.data := club_private.achievement_data(new);
  end if;
  return new;
end;$$;

-- Runs first among the BEFORE triggers (they fire in name order).
create trigger aa_club_achievements_columns before insert or update on public.club_achievements
  for each row execute function club_private.sync_achievement_columns();

-- `data` is now only a copy; the columns carry the rules.
alter table public.club_achievements drop constraint club_achievements_data_check;

-- One-off backfill. Audit is paused so updated_at/updated_by stay as they were.
alter table public.club_achievements disable trigger club_achievements_audit;
update public.club_achievements set title = null;
alter table public.club_achievements enable trigger club_achievements_audit;

alter table public.club_achievements
  alter column title set not null,
  alter column title_en set not null,
  alter column type set not null,
  alter column committee set not null,
  alter column date set not null,
  alter column summary set not null,
  alter column summary_en set not null,
  alter column participants set not null,
  alter column participants_en set not null,
  alter column status set not null,
  alter column requirements set not null,
  alter column requirements_en set not null,
  add constraint club_achievements_title check (length(trim(title)) between 2 and 200),
  add constraint club_achievements_title_en check (length(trim(title_en)) between 2 and 200),
  add constraint club_achievements_type check (type in
    ('project','event','workshop','partnership','media','award','meeting','decision','other')),
  add constraint club_achievements_committee check (committee in ('club','media','relations','activities')),
  add constraint club_achievements_summary check (length(trim(summary)) between 2 and 4000),
  add constraint club_achievements_summary_en check (length(trim(summary_en)) between 2 and 4000),
  add constraint club_achievements_status check (status in ('draft','approved')),
  add constraint club_achievements_requirements check (jsonb_typeof(requirements) = 'object'),
  add constraint club_achievements_requirements_en check (jsonb_typeof(requirements_en) = 'object');

drop index public.club_achievements_date, public.club_achievements_type,
  public.club_achievements_committee;
create index club_achievements_date on public.club_achievements(date desc);
create index club_achievements_type on public.club_achievements(type);
create index club_achievements_committee on public.club_achievements(committee);

-- Access reads the committee column. Same roles and committees as before.
drop policy club_achievements_read on public.club_achievements;
drop policy club_achievements_insert on public.club_achievements;
drop policy club_achievements_update on public.club_achievements;
drop policy club_achievements_delete on public.club_achievements;
drop function club_private.can_manage_achievement(jsonb);

create function club_private.can_manage_achievement(committee text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.club_admins a
    where a.id = auth.uid()
      and (
        a.role in ('editor','super_admin')
        or (a.role = 'communications_editor' and committee in ('media','relations'))
        or (a.role = 'events_editor' and committee = 'activities')
      )
  );
$$;
revoke all on function club_private.can_manage_achievement(text) from public;
grant execute on function club_private.can_manage_achievement(text) to authenticated;

create policy club_achievements_read on public.club_achievements
  for select to authenticated using (club_private.can_manage_achievement(committee));
create policy club_achievements_insert on public.club_achievements
  for insert to authenticated with check (club_private.can_manage_achievement(committee));
create policy club_achievements_update on public.club_achievements
  for update to authenticated
  using (club_private.can_manage_achievement(committee))
  with check (club_private.can_manage_achievement(committee));
create policy club_achievements_delete on public.club_achievements
  for delete to authenticated using (club_private.can_manage_achievement(committee));

-- authenticated already holds table-wide insert/update, which covers the new columns.

revoke all on function club_private.achievement_data(public.club_achievements) from public;
grant execute on function club_private.achievement_data(public.club_achievements) to authenticated;
revoke all on function club_private.sync_achievement_columns() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
