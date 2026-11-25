-- Issue #50, partners step: typed columns.
--
-- Expand phase, same as events (20261123130000_event_columns.sql) and news
-- (20261124120000_news_columns.sql). `data` stays and is kept in step both ways,
-- so the live admin (which still writes only `data`) and the club_content
-- compatibility view keep working until they switch to the columns.
--   * A write that sets `data` fills the columns from it.
--   * A write that only sets columns rebuilds `data` from the columns.
-- One column per key the admin writes. A `data` write that the columns cannot
-- hold exactly (another key, or a value of another type) is refused, so `data`
-- and the columns can never disagree.
begin;

alter table public.club_partners
  add column title text,
  add column title_en text,
  add column description text,
  add column description_en text,
  add column images text[] not null default '{}',
  add column partnership_type text,
  add column partnership_type_en text,
  add column website_url text,
  add column github_url text,
  add column linkedin_url text;

-- `data` as the old readers expect it: absent keys stay absent, nothing is trimmed.
create function club_private.partner_data(p public.club_partners) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'title', p.title, 'title_en', p.title_en,
    'description', p.description, 'description_en', p.description_en,
    'images', to_jsonb(p.images),
    'partnershipType', p.partnership_type, 'partnershipType_en', p.partnership_type_en,
    'websiteUrl', p.website_url, 'githubUrl', p.github_url, 'linkedinUrl', p.linkedin_url));
$$;

create function club_private.sync_partner_columns() returns trigger
language plpgsql set search_path='' as $$
declare d jsonb := new.data;
begin
  -- New title null only happens on the one-off backfill below.
  if d is not null and (tg_op = 'INSERT' or d is distinct from old.data or new.title is null) then
    new.title := d->>'title';
    new.title_en := d->>'title_en';
    new.description := d->>'description';
    new.description_en := d->>'description_en';
    new.images := coalesce(array(select jsonb_array_elements_text(
      case when jsonb_typeof(d->'images') = 'array' then d->'images' end)), '{}');
    new.partnership_type := d->>'partnershipType';
    new.partnership_type_en := d->>'partnershipType_en';
    new.website_url := d->>'websiteUrl';
    new.github_url := d->>'githubUrl';
    new.linkedin_url := d->>'linkedinUrl';
    if club_private.partner_data(new) is distinct from d then
      raise exception 'Partner data has a key or value type the partner columns cannot hold'
        using errcode = '23514';
    end if;
  else
    new.data := club_private.partner_data(new);
  end if;
  return new;
end;$$;

-- Runs first among the BEFORE triggers (they fire in name order), so the slug
-- and image checks see filled columns.
create trigger aa_club_partners_columns before insert or update on public.club_partners
  for each row execute function club_private.sync_partner_columns();

-- `data` is now only a copy; the columns carry the rules.
alter table public.club_partners drop constraint club_partners_data_check;

-- One-off backfill. Audit is paused so updated_at/updated_by stay as they were.
alter table public.club_partners disable trigger club_partners_audit;
update public.club_partners set title = null;
alter table public.club_partners enable trigger club_partners_audit;

-- Same limits as club_private.valid_content('partners', data). It set none on the
-- partnership type or the links, so neither do the columns.
alter table public.club_partners
  alter column title set not null,
  alter column title_en set not null,
  alter column description set not null,
  alter column description_en set not null,
  add constraint club_partners_title check (length(trim(title)) between 2 and 200),
  add constraint club_partners_title_en check (length(trim(title_en)) between 2 and 200),
  add constraint club_partners_description check (length(trim(description)) between 2 and 20000),
  add constraint club_partners_description_en
    check (length(trim(description_en)) between 2 and 20000),
  add constraint club_partners_images check (cardinality(images) <= 20);

-- Image rules read the column. The triggers also fire on column-only saves.
create or replace function club_private.validate_partner_assets() returns trigger
language plpgsql set search_path='' as $$
begin
 if not club_private.can_manage_partners() then raise exception 'Partnership access required' using errcode='42501'; end if;
 if exists(select 1 from unnest(new.images) image_url
  where not exists(select 1 from public.club_media m
   where club_private.media_url(m.path)=image_url and club_private.can_use_partner_asset(m.id)))
 then raise exception 'Image is not available to this committee' using errcode='42501'; end if;
 return new;
end;$$;
drop trigger if exists club_partners_validate_assets on public.club_partners;
create trigger club_partners_validate_assets before insert or update of data, images on public.club_partners
  for each row execute function club_private.validate_partner_assets();
drop trigger if exists club_partners_sync_media on public.club_partners;
create trigger club_partners_sync_media after insert or update of data, images on public.club_partners
  for each row execute function club_private.sync_media();

grant insert(title, title_en, description, description_en, images, partnership_type,
    partnership_type_en, website_url, github_url, linkedin_url),
  update(title, title_en, description, description_en, images, partnership_type,
    partnership_type_en, website_url, github_url, linkedin_url)
  on public.club_partners to authenticated;

revoke all on function club_private.partner_data(public.club_partners) from public;
grant execute on function club_private.partner_data(public.club_partners) to anon, authenticated;
revoke all on function club_private.sync_partner_columns() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
