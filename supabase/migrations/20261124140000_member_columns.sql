-- Issue #50, members step: typed columns, plus student_id, email, show_on_team
-- and member_status.
--
-- Expand phase, same as events (20261123130000_event_columns.sql) and news
-- (20261124120000_news_columns.sql). `data` stays and is kept in step both
-- ways, so the live admin (which still writes only `data`) and the sitemap keep
-- working until they switch to the columns.
--   * A write that sets `data` fills the columns from it.
--   * A write that only sets columns rebuilds `data` from the columns.
-- student_id, email, show_on_team and member_status live only in their columns:
-- old `data` writes leave them as they are.
--
-- student_id and email are personal data. Visitors (anon) lose read access to
-- those two columns; signed-in admins keep it.
begin;

alter table public.club_members
  add column title text,
  add column title_en text,
  add column description text,
  add column description_en text,
  add column images text[] not null default '{}',
  add column role text,
  add column role_en text,
  add column committee text,
  add column is_founder boolean,
  add column gender text,
  add column display_order integer,
  add column github_url text,
  add column linkedin_url text,
  add column profile_enabled boolean,
  add column student_id text,
  add column email text,
  -- No per-member flag exists today (teamVisible hides the whole section), so
  -- every current member stays listed.
  add column show_on_team boolean not null default true,
  add column member_status text not null default 'active';

-- `data` as the old readers expect it: absent keys stay absent, nothing is trimmed.
create function club_private.member_data(m public.club_members) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'title', m.title, 'title_en', m.title_en,
    'description', m.description, 'description_en', m.description_en,
    'images', to_jsonb(m.images), 'role', m.role, 'role_en', m.role_en,
    'committee', m.committee, 'isFounder', m.is_founder, 'gender', m.gender,
    'displayOrder', m.display_order, 'githubUrl', m.github_url,
    'linkedinUrl', m.linkedin_url, 'profileEnabled', m.profile_enabled));
$$;

create function club_private.sync_member_columns() returns trigger
language plpgsql set search_path='' as $$
declare d jsonb := new.data;
begin
  -- New title null only happens on the one-off backfill below.
  if d is not null and (tg_op = 'INSERT' or d is distinct from old.data or new.title is null) then
    new.title := d->>'title';
    new.title_en := d->>'title_en';
    new.description := d->>'description';
    new.description_en := d->>'description_en';
    new.images := coalesce(array(select jsonb_array_elements_text(d->'images')), '{}');
    new.role := d->>'role';
    new.role_en := d->>'role_en';
    new.committee := d->>'committee';
    new.is_founder := (d->>'isFounder')::boolean;
    new.gender := d->>'gender';
    new.display_order := (d->>'displayOrder')::integer;
    new.github_url := d->>'githubUrl';
    new.linkedin_url := d->>'linkedinUrl';
    new.profile_enabled := (d->>'profileEnabled')::boolean;
  else
    new.data := club_private.member_data(new);
  end if;
  return new;
end;$$;

-- Runs first among the BEFORE triggers (they fire in name order), so the slug
-- and image checks see filled columns.
create trigger aa_club_members_columns before insert or update on public.club_members
  for each row execute function club_private.sync_member_columns();

-- `data` is now only a copy; the columns carry the rules.
alter table public.club_members drop constraint club_members_data_check;

-- One-off backfill. Audit is paused so updated_at/updated_by stay as they were.
alter table public.club_members disable trigger club_members_audit;
update public.club_members set title = null;
alter table public.club_members enable trigger club_members_audit;

alter table public.club_members
  alter column title set not null,
  alter column title_en set not null,
  alter column description set not null,
  alter column description_en set not null,
  alter column committee set not null,
  alter column is_founder set not null,
  -- A key the columns do not hold would be lost on the next column save, so
  -- `data` is refused instead.
  add constraint club_members_data_keys check (data - array['title', 'title_en', 'description',
    'description_en', 'images', 'role', 'role_en', 'committee', 'isFounder', 'gender',
    'displayOrder', 'githubUrl', 'linkedinUrl', 'profileEnabled'] = '{}'::jsonb),
  add constraint club_members_title check (length(trim(title)) between 2 and 200),
  add constraint club_members_title_en check (length(trim(title_en)) between 2 and 200),
  add constraint club_members_description check (length(trim(description)) between 2 and 20000),
  add constraint club_members_description_en
    check (length(trim(description_en)) between 2 and 20000),
  add constraint club_members_images check (cardinality(images) <= 20),
  add constraint club_members_committee
    check (committee in ('media', 'relations', 'activities', 'development', 'administrative')),
  add constraint club_members_gender check (gender in ('male', 'female')),
  add constraint club_members_display_order check (display_order between 1 and 9999),
  add constraint club_members_github_url
    check (github_url ~ '^https://' and length(github_url) <= 500),
  add constraint club_members_linkedin_url
    check (linkedin_url ~ '^https://' and length(linkedin_url) <= 500),
  add constraint club_members_student_id check (student_id ~ '^[12][0-9]{8}$'),
  add constraint club_members_student_id_unique unique (student_id),
  add constraint club_members_email
    check (length(email) <= 254 and email ~ '^[^@ ]+@[^@ ]+[.][^@ ]+$'),
  add constraint club_members_member_status check (member_status in ('active', 'alumni'));
create unique index club_members_email_unique on public.club_members(lower(email));

-- Permissions read the columns. A save from the old admin fills them before
-- the policy checks run, so both kinds of save get the same rules.
create function club_private.can_manage_member(member_committee text, founder boolean)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
  select 1 from public.club_admins a where a.id=auth.uid() and (
   a.role in ('editor','super_admin') or (
    not coalesce(founder, false) and (
     (a.role='communications_editor' and member_committee in ('media','relations')) or
     (a.role='events_editor' and member_committee='activities')
    )
   )
  )
 );
$$;
revoke all on function club_private.can_manage_member(text, boolean) from public;
grant execute on function club_private.can_manage_member(text, boolean) to authenticated;

drop policy club_members_insert on public.club_members;
drop policy club_members_update on public.club_members;
drop policy club_members_delete on public.club_members;
create policy club_members_insert on public.club_members for insert to authenticated
 with check(club_private.can_manage_member(committee, is_founder));
create policy club_members_update on public.club_members for update to authenticated
 using(club_private.can_manage_member(committee, is_founder))
 with check(club_private.can_manage_member(committee, is_founder));
create policy club_members_delete on public.club_members for delete to authenticated
 using(club_private.can_manage_member(committee, is_founder));

drop policy club_member_media_read on public.club_member_media;
create policy club_member_media_read on public.club_member_media for select to authenticated
 using(exists(select 1 from public.club_members m where m.id=member_id
  and club_private.can_manage_member(m.committee, m.is_founder)));

create or replace function club_private.can_use_member_asset(asset_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.club_media asset
 where asset.id=asset_id and not asset.deleting and (
  club_private.is_editor() or (
   exists(select 1 from public.club_admins a where a.id=auth.uid() and a.role in ('communications_editor','events_editor')) and (
    asset.created_by=auth.uid() or exists(select 1 from public.club_member_media l
     join public.club_members m on m.id=l.member_id
     where l.media_id=asset.id and club_private.can_manage_member(m.committee, m.is_founder))
   )
  )
 ));
$$;

-- Image rules read the column. The triggers also fire on column-only saves.
create or replace function club_private.validate_member_assets() returns trigger
language plpgsql set search_path='' as $$
begin
 if not club_private.can_manage_member(new.committee, new.is_founder) then
  raise exception 'Member access required' using errcode='42501';
 end if;
 if exists(select 1 from unnest(new.images) image_url
  where not exists(select 1 from public.club_media m where club_private.media_url(m.path)=image_url
   and club_private.can_use_member_asset(m.id))) then
  raise exception 'Image is not available to this committee' using errcode='42501';
 end if;
 return new;
end;$$;
drop trigger club_members_validate_assets on public.club_members;
create trigger club_members_validate_assets before insert or update of data, images
  on public.club_members for each row execute function club_private.validate_member_assets();
drop trigger club_members_sync_media on public.club_members;
create trigger club_members_sync_media after insert or update of data, images
  on public.club_members for each row execute function club_private.sync_media();

-- Nothing reads the `data` version any more; the drop fails if something does.
drop function club_private.can_manage_member(jsonb);

-- Visitors read every column except the personal ones. Columns added later
-- need their own anon grant.
revoke select on public.club_members from anon;
grant select(id, slug, data, created_at, updated_at, updated_by, title, title_en, description,
    description_en, images, role, role_en, committee, is_founder, gender, display_order,
    github_url, linkedin_url, profile_enabled, show_on_team, member_status)
  on public.club_members to anon;
grant insert(title, title_en, description, description_en, images, role, role_en, committee,
    is_founder, gender, display_order, github_url, linkedin_url, profile_enabled, student_id,
    email, show_on_team, member_status),
  update(title, title_en, description, description_en, images, role, role_en, committee,
    is_founder, gender, display_order, github_url, linkedin_url, profile_enabled, student_id,
    email, show_on_team, member_status)
  on public.club_members to authenticated;

revoke all on function club_private.member_data(public.club_members) from public;
grant execute on function club_private.member_data(public.club_members) to anon, authenticated;
revoke all on function club_private.sync_member_columns() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
