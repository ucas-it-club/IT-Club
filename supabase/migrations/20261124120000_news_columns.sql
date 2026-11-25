-- Issue #50, news step: typed columns, plus `featured` for #29.
--
-- Expand phase, same as events (20261123130000_event_columns.sql). `data` stays
-- and is kept in step both ways, so the live admin (which still writes only
-- `data`) and the sitemap keep working until they switch to the columns.
--   * A write that sets `data` fills the columns from it.
--   * A write that only sets columns rebuilds `data` from the columns.
-- `featured` lives only in its column: old `data` writes leave it as it is.
begin;

alter table public.club_news
  add column title text,
  add column title_en text,
  add column description text,
  add column description_en text,
  add column summary text,
  add column summary_en text,
  add column images text[] not null default '{}',
  add column drive_image_urls text[],
  add column date date,
  add column featured boolean not null default false;

-- `data` as the old readers expect it: absent keys stay absent, nothing is trimmed.
create function club_private.news_data(n public.club_news) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'title', n.title, 'title_en', n.title_en,
    'description', n.description, 'description_en', n.description_en,
    'summary', n.summary, 'summary_en', n.summary_en,
    'images', to_jsonb(n.images), 'driveImageUrls', to_jsonb(n.drive_image_urls),
    'date', to_char(n.date, 'YYYY-MM-DD')));
$$;

create function club_private.sync_news_columns() returns trigger
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
  else
    new.data := club_private.news_data(new);
  end if;
  return new;
end;$$;

-- Runs first among the BEFORE triggers (they fire in name order), so the slug
-- and image checks see filled columns.
create trigger aa_club_news_columns before insert or update on public.club_news
  for each row execute function club_private.sync_news_columns();

-- `data` is now only a copy; the columns carry the rules.
alter table public.club_news drop constraint club_news_data_check;

-- One-off backfill. Audit is paused so updated_at/updated_by stay as they were.
alter table public.club_news disable trigger club_news_audit;
update public.club_news set title = null;
alter table public.club_news enable trigger club_news_audit;

alter table public.club_news
  alter column title set not null,
  alter column title_en set not null,
  alter column description set not null,
  alter column description_en set not null,
  alter column date set not null,
  add constraint club_news_title check (length(trim(title)) between 2 and 200),
  add constraint club_news_title_en check (length(trim(title_en)) between 2 and 200),
  add constraint club_news_description check (length(trim(description)) between 2 and 20000),
  add constraint club_news_description_en check (length(trim(description_en)) between 2 and 20000),
  add constraint club_news_summary check (length(trim(summary)) between 1 and 300),
  add constraint club_news_summary_en check (length(trim(summary_en)) between 1 and 300),
  add constraint club_news_images check (cardinality(images) <= 20),
  add constraint club_news_drive_images check (club_private.valid_drive_urls(drive_image_urls));
create index club_news_date on public.club_news(date desc);

-- Image rules read the column. The triggers also fire on column-only saves.
create or replace function club_private.validate_news_assets() returns trigger
language plpgsql set search_path='' as $$
begin
 if not club_private.can_manage_news() then raise exception 'News access required' using errcode='42501'; end if;
 if exists(select 1 from unnest(new.images) image_url
  where not exists(select 1 from public.club_media m
   where club_private.media_url(m.path)=image_url and club_private.can_use_news_asset(m.id)))
 then raise exception 'Image is not available to the media committee' using errcode='42501'; end if;
 return new;
end;$$;
drop trigger if exists club_news_validate_assets on public.club_news;
create trigger club_news_validate_assets before insert or update of data, images on public.club_news
  for each row execute function club_private.validate_news_assets();
drop trigger if exists club_news_sync_media on public.club_news;
create trigger club_news_sync_media after insert or update of data, images on public.club_news
  for each row execute function club_private.sync_media();

grant insert(title, title_en, description, description_en, summary, summary_en, images,
    drive_image_urls, date, featured),
  update(title, title_en, description, description_en, summary, summary_en, images,
    drive_image_urls, date, featured)
  on public.club_news to authenticated;

revoke all on function club_private.news_data(public.club_news) from public;
grant execute on function club_private.news_data(public.club_news) to anon, authenticated;
revoke all on function club_private.sync_news_columns() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
