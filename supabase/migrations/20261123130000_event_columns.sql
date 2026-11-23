-- Issue #50, events step: typed columns and club_event_people.
--
-- Expand phase. `data` stays and is kept in step both ways, so the live admin
-- (which still writes only `data`), the Google Sheets script and the sitemap
-- keep working until they switch to the columns. A later migration drops `data`.
--   * A write that sets `data` fills the columns (and the first presenter) from it.
--   * A write that only sets columns rebuilds `data` from the columns.
begin;

alter table public.club_events
  add column title text,
  add column title_en text,
  add column description text,
  add column description_en text,
  add column summary text,
  add column summary_en text,
  add column images text[] not null default '{}',
  add column drive_image_urls text[],
  add column date date,
  add column status text,
  add column event_time text,
  add column duration_minutes integer,
  add column event_type text,
  add column event_type_en text,
  add column registration_enabled boolean,
  add column registration_name_enabled boolean,
  add column registration_phone_enabled boolean,
  add column registration_attendance_enabled boolean;

create function club_private.valid_drive_urls(urls text[]) returns boolean
language sql immutable set search_path='' as $$
  select urls is null or (cardinality(urls) <= 20 and not exists(
    select 1 from unnest(urls) url
    where length(url) > 500
      or url !~ '^https://drive[.]google[.]com/thumbnail[?]id=[A-Za-z0-9_-]{10,}&sz=w2000$'));
$$;

-- Presenters and organizers. Name and bio are copied from a member when one is
-- picked, so later profile edits do not rewrite past events.
create table public.club_event_people (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.club_events(id) on delete cascade,
  member_id uuid references public.club_members(id) on delete set null,
  role text not null check (role in ('presenter', 'organizer')),
  name text check (length(trim(name)) between 2 and 200),
  name_en text check (length(trim(name_en)) between 2 and 200),
  bio text check (length(trim(bio)) between 2 and 500),
  bio_en text check (length(trim(bio_en)) between 2 and 500),
  -- 0..5 with one person per slot: at most six presenters and six organizers.
  display_order integer not null default 0 check (display_order between 0 and 5),
  constraint club_event_people_slot unique (event_id, role, display_order),
  constraint club_event_people_name check (name is not null or name_en is not null),
  constraint club_event_people_presenter_bio
    check (role <> 'presenter' or bio is not null or bio_en is not null)
);
create index club_event_people_member on public.club_event_people(member_id);

-- `data` as the old readers expect it: absent keys stay absent, nothing is trimmed.
create function club_private.event_data(e public.club_events) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'title', e.title, 'title_en', e.title_en,
    'description', e.description, 'description_en', e.description_en,
    'summary', e.summary, 'summary_en', e.summary_en,
    'images', to_jsonb(e.images), 'driveImageUrls', to_jsonb(e.drive_image_urls),
    'date', to_char(e.date, 'YYYY-MM-DD'), 'status', e.status,
    'eventTime', e.event_time, 'durationMinutes', e.duration_minutes,
    'eventType', e.event_type, 'eventType_en', e.event_type_en,
    'eventRegistration', case when e.registration_enabled is not null then jsonb_build_object(
      'enabled', e.registration_enabled, 'nameEnabled', e.registration_name_enabled,
      'phoneEnabled', e.registration_phone_enabled,
      'attendanceEnabled', e.registration_attendance_enabled) end,
    'presenterName', p.name, 'presenterName_en', p.name_en,
    'presenterBio', p.bio, 'presenterBio_en', p.bio_en))
  from (select 1) one
  left join public.club_event_people p
    on p.event_id = e.id and p.role = 'presenter' and p.display_order = 0;
$$;

create function club_private.sync_event_columns() returns trigger
language plpgsql set search_path='' as $$
declare d jsonb := new.data;
begin
  -- New title null only happens on the one-off backfill below.
  if d is not null and (tg_op = 'INSERT' or d is distinct from old.data or new.title is null) then
    new.title := d->>'title';
    new.title_en := d->>'title_en';
    new.description := d->>'description';
    new.description_en := d->>'description_en';
    new.summary := d->>'summary';
    new.summary_en := d->>'summary_en';
    new.images := coalesce(array(select jsonb_array_elements_text(d->'images')), '{}');
    new.drive_image_urls := case when d ? 'driveImageUrls'
      then array(select jsonb_array_elements_text(d->'driveImageUrls')) end;
    new.date := (d->>'date')::date;
    new.status := d->>'status';
    new.event_time := d->>'eventTime';
    new.duration_minutes := (d->>'durationMinutes')::integer;
    new.event_type := d->>'eventType';
    new.event_type_en := d->>'eventType_en';
    new.registration_enabled := (d->'eventRegistration'->>'enabled')::boolean;
    new.registration_name_enabled := (d->'eventRegistration'->>'nameEnabled')::boolean;
    new.registration_phone_enabled := (d->'eventRegistration'->>'phoneEnabled')::boolean;
    new.registration_attendance_enabled := (d->'eventRegistration'->>'attendanceEnabled')::boolean;
  else
    new.data := club_private.event_data(new);
  end if;
  return new;
end;$$;

-- Runs first among the BEFORE triggers (they fire in name order), so the slug
-- and image checks see filled columns.
create trigger aa_club_events_columns before insert or update on public.club_events
  for each row execute function club_private.sync_event_columns();

-- A `data` write from the old admin carries the single presenter.
create function club_private.sync_event_presenter() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if pg_trigger_depth() > 1 then return null; end if;
  if tg_op = 'UPDATE' and new.data->'presenterName' is not distinct from old.data->'presenterName'
    and new.data->'presenterName_en' is not distinct from old.data->'presenterName_en'
    and new.data->'presenterBio' is not distinct from old.data->'presenterBio'
    and new.data->'presenterBio_en' is not distinct from old.data->'presenterBio_en' then
    return null;
  end if;
  if new.data ?| array['presenterName', 'presenterName_en'] then
    insert into public.club_event_people(event_id, role, display_order, name, name_en, bio, bio_en)
    values(new.id, 'presenter', 0, new.data->>'presenterName', new.data->>'presenterName_en',
      new.data->>'presenterBio', new.data->>'presenterBio_en')
    on conflict (event_id, role, display_order) do update
      set name = excluded.name, name_en = excluded.name_en,
        bio = excluded.bio, bio_en = excluded.bio_en;
  else
    delete from public.club_event_people
    where event_id = new.id and role = 'presenter' and display_order = 0;
  end if;
  return null;
end;$$;
create trigger club_events_presenter after insert or update of data on public.club_events
  for each row execute function club_private.sync_event_presenter();

-- A direct presenter edit refreshes the event's `data` copy.
create function club_private.refresh_event_data() returns trigger
language plpgsql set search_path='' as $$
begin
  if pg_trigger_depth() > 1 then return null; end if;
  update public.club_events set data = null
  where id = coalesce(new.event_id, old.event_id);
  return null;
end;$$;

-- `data` is now only a copy; the columns carry the rules.
alter table public.club_events drop constraint club_events_data_check;

-- One-off backfill. Audit is paused so updated_at/updated_by stay as they were.
alter table public.club_events disable trigger club_events_audit;
update public.club_events set title = null;
alter table public.club_events enable trigger club_events_audit;

insert into public.club_event_people(event_id, role, display_order, name, name_en, bio, bio_en)
select id, 'presenter', 0, data->>'presenterName', data->>'presenterName_en',
  data->>'presenterBio', data->>'presenterBio_en'
from public.club_events
where data ?| array['presenterName', 'presenterName_en'];

create trigger club_event_people_refresh after insert or update or delete
  on public.club_event_people for each row execute function club_private.refresh_event_data();

alter table public.club_events
  alter column title set not null,
  alter column title_en set not null,
  alter column description set not null,
  alter column description_en set not null,
  alter column date set not null,
  alter column status set not null,
  add constraint club_events_title check (length(trim(title)) between 2 and 200),
  add constraint club_events_title_en check (length(trim(title_en)) between 2 and 200),
  add constraint club_events_description check (length(trim(description)) between 2 and 20000),
  add constraint club_events_description_en check (length(trim(description_en)) between 2 and 20000),
  add constraint club_events_summary check (length(trim(summary)) between 1 and 300),
  add constraint club_events_summary_en check (length(trim(summary_en)) between 1 and 300),
  add constraint club_events_images check (cardinality(images) <= 20),
  add constraint club_events_drive_images check (club_private.valid_drive_urls(drive_image_urls)),
  add constraint club_events_status check (status in ('upcoming', 'past')),
  add constraint club_events_event_time check (event_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  add constraint club_events_duration check (duration_minutes between 1 and 1440),
  add constraint club_events_event_type check (length(trim(event_type)) between 2 and 100),
  add constraint club_events_event_type_en check (length(trim(event_type_en)) between 2 and 100),
  add constraint club_events_details
    check (num_nulls(event_time, duration_minutes, event_type, event_type_en) in (0, 4)),
  add constraint club_events_registration check (num_nulls(registration_enabled,
    registration_name_enabled, registration_phone_enabled, registration_attendance_enabled) in (0, 4));
create index club_events_date on public.club_events(date desc);

-- Image rules read the column. The triggers also fire on column-only saves.
create or replace function club_private.validate_event_assets() returns trigger
language plpgsql set search_path='' as $$
begin
 if not club_private.can_manage_events() then raise exception 'Event access required' using errcode='42501'; end if;
 if exists(select 1 from unnest(new.images) image_url
  where not exists(select 1 from public.club_media m
   where club_private.media_url(m.path)=image_url and club_private.can_use_event_asset(m.id)))
 then raise exception 'Image is not available to this committee' using errcode='42501'; end if;
 return new;
end;$$;
drop trigger if exists club_events_validate_assets on public.club_events;
create trigger club_events_validate_assets before insert or update of data, images on public.club_events
  for each row execute function club_private.validate_event_assets();
drop trigger if exists club_events_sync_media on public.club_events;
create trigger club_events_sync_media after insert or update of data, images on public.club_events
  for each row execute function club_private.sync_media();

-- Shared triggers prefer a column when the table has one, `data` otherwise.
create or replace function club_private.sync_media() returns trigger
language plpgsql security definer set search_path='' as $$
declare url text; asset uuid;
begin
  if TG_TABLE_NAME = 'club_members' then
    delete from public.club_member_media where member_id = new.id;
  elsif TG_TABLE_NAME = 'club_events' then
    delete from public.club_event_media where event_id = new.id;
  elsif TG_TABLE_NAME = 'club_news' then
    delete from public.club_news_media where news_id = new.id;
  elsif TG_TABLE_NAME = 'club_partners' then
    delete from public.club_partner_media where partner_id = new.id;
  else
    raise exception 'Unsupported content table';
  end if;

  for url in select jsonb_array_elements_text(coalesce(to_jsonb(new)->'images', to_jsonb(new)->'data'->'images')) loop
    select id into asset from public.club_media
    where club_private.media_url(path) = url and not deleting for share;
    if not found then
      raise exception 'Image is missing or being deleted. Refresh the media library.';
    end if;
    if TG_TABLE_NAME = 'club_members' then
      insert into public.club_member_media(member_id, media_id) values(new.id, asset)
      on conflict do nothing;
    elsif TG_TABLE_NAME = 'club_events' then
      insert into public.club_event_media(event_id, media_id) values(new.id, asset)
      on conflict do nothing;
    elsif TG_TABLE_NAME = 'club_news' then
      insert into public.club_news_media(news_id, media_id) values(new.id, asset)
      on conflict do nothing;
    else
      insert into public.club_partner_media(partner_id, media_id) values(new.id, asset)
      on conflict do nothing;
    end if;
  end loop;
  return new;
end;
$$;

create or replace function club_private.fill_slug() returns trigger
language plpgsql security definer set search_path='' as $$
declare base text; candidate text; n int := 1;
begin
  if new.slug is not null then return new; end if;
  base := club_private.slugify(coalesce(to_jsonb(new)->>'title_en', to_jsonb(new)->'data'->>'title_en'));
  if base is null then return new; end if;
  candidate := base;
  while exists(
    select 1 from club_private.content_slugs registered
    where registered.slug = candidate and registered.content_id <> new.id
  ) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end;
$$;

alter table public.club_event_people enable row level security;
create policy club_event_people_read on public.club_event_people for select to anon, authenticated
  using (true);
create policy club_event_people_insert on public.club_event_people for insert to authenticated
  with check (club_private.can_manage_events());
create policy club_event_people_update on public.club_event_people for update to authenticated
  using (club_private.can_manage_events()) with check (club_private.can_manage_events());
create policy club_event_people_delete on public.club_event_people for delete to authenticated
  using (club_private.can_manage_events());

revoke all on public.club_event_people from anon, authenticated;
grant select on public.club_event_people to anon, authenticated;
grant insert, update, delete on public.club_event_people to authenticated;
grant insert(title, title_en, description, description_en, summary, summary_en, images,
    drive_image_urls, date, status, event_time, duration_minutes, event_type, event_type_en,
    registration_enabled, registration_name_enabled, registration_phone_enabled,
    registration_attendance_enabled),
  update(title, title_en, description, description_en, summary, summary_en, images,
    drive_image_urls, date, status, event_time, duration_minutes, event_type, event_type_en,
    registration_enabled, registration_name_enabled, registration_phone_enabled,
    registration_attendance_enabled)
  on public.club_events to authenticated;

revoke all on function club_private.valid_drive_urls(text[]) from public;
grant execute on function club_private.valid_drive_urls(text[]) to anon, authenticated;
revoke all on function club_private.event_data(public.club_events) from public;
grant execute on function club_private.event_data(public.club_events) to anon, authenticated;
revoke all on function club_private.sync_event_columns() from public, anon, authenticated;
revoke all on function club_private.sync_event_presenter() from public, anon, authenticated;
revoke all on function club_private.refresh_event_data() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
