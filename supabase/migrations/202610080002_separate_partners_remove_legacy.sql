-- Finish the content split by moving partners to their own table and removing
-- the legacy polymorphic content tables. Existing partner data and media links
-- are copied and verified before either legacy table is dropped.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public.club_partners (
  id uuid primary key default gen_random_uuid(),
  slug text constraint club_partners_slug_format
    check (slug is null or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80)),
  data jsonb not null constraint club_partners_data_check
    check (club_private.valid_content('partners', data)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index club_partners_updated on public.club_partners(updated_at desc);
create index club_partners_updated_by on public.club_partners(updated_by);

create table public.club_partner_media (
  partner_id uuid not null references public.club_partners(id) on delete cascade,
  media_id uuid not null references public.club_media(id) on delete restrict,
  primary key(partner_id, media_id)
);
create index club_partner_media_asset on public.club_partner_media(media_id);

insert into public.club_partners(id, slug, data, created_at, updated_at, updated_by)
select id, slug, data, created_at, updated_at, updated_by
from public.club_content
where kind = 'partners';

insert into public.club_partner_media(partner_id, media_id)
select link.content_id, link.media_id
from public.club_content_media link
join public.club_content content on content.id = link.content_id
where content.kind = 'partners';

do $$
begin
  if exists(
    select id from public.club_content where kind = 'partners'
    except
    select id from public.club_partners
  ) then
    raise exception 'Partner migration verification failed';
  end if;
  if exists(
    select link.content_id, link.media_id
    from public.club_content_media link
    join public.club_content content on content.id = link.content_id
    where content.kind = 'partners'
    except
    select partner_id, media_id from public.club_partner_media
  ) then
    raise exception 'Partner media migration verification failed';
  end if;
end;
$$;

-- Preserve only legacy-only rows that are absent from every authoritative
-- dedicated table. This protects deleted or retired content from irreversible
-- loss without keeping the old public polymorphic table alive.
create table club_private.legacy_content_archive (
  id uuid primary key,
  kind text not null,
  slug text,
  data jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  updated_by uuid,
  archived_at timestamptz not null default now()
);

insert into club_private.legacy_content_archive(
  id, kind, slug, data, created_at, updated_at, updated_by
)
select content.id, content.kind, content.slug, content.data,
  content.created_at, content.updated_at, content.updated_by
from public.club_content content
where
  (content.kind = 'members' and not exists(
    select 1 from public.club_members current where current.id = content.id
  ))
  or (content.kind = 'events' and not exists(
    select 1 from public.club_events current where current.id = content.id
  ))
  or (content.kind = 'news' and not exists(
    select 1 from public.club_news current where current.id = content.id
  ))
  or (content.kind = 'partners' and not exists(
    select 1 from public.club_partners current where current.id = content.id
  ))
  or content.kind not in ('members', 'events', 'news', 'partners');

create table club_private.legacy_content_media_archive (
  content_id uuid not null references club_private.legacy_content_archive(id) on delete cascade,
  media_id uuid not null,
  primary key(content_id, media_id)
);

insert into club_private.legacy_content_media_archive(content_id, media_id)
select link.content_id, link.media_id
from public.club_content_media link
join club_private.legacy_content_archive archived on archived.id = link.content_id;

revoke all on club_private.legacy_content_archive,
  club_private.legacy_content_media_archive from public, anon, authenticated;

-- The slug registry remains the single uniqueness boundary across all public
-- article-like tables, including the new partners table.
delete from club_private.content_slugs
where kind not in ('events', 'news', 'partners');
alter table club_private.content_slugs drop constraint content_slugs_kind_check;
alter table club_private.content_slugs add constraint content_slugs_kind_check
  check (kind in ('events', 'news', 'partners'));

create or replace function club_private.fill_slug()
returns trigger language plpgsql security definer set search_path = '' as $$
declare content_kind text; base text; candidate text; n int := 1;
begin
  if TG_TABLE_NAME = 'club_events' then
    content_kind := 'events';
  elsif TG_TABLE_NAME = 'club_news' then
    content_kind := 'news';
  elsif TG_TABLE_NAME = 'club_partners' then
    content_kind := 'partners';
  else
    content_kind := 'members';
  end if;
  if content_kind = 'members' then return new; end if;
  if new.slug is not null then return new; end if;
  base := club_private.slugify(new.data->>'title_en');
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

create or replace function club_private.sync_slug_registry()
returns trigger language plpgsql security definer set search_path = '' as $$
declare content_kind text;
begin
  if TG_TABLE_NAME = 'club_events' then
    content_kind := 'events';
  elsif TG_TABLE_NAME = 'club_news' then
    content_kind := 'news';
  elsif TG_TABLE_NAME = 'club_partners' then
    content_kind := 'partners';
  else
    return new;
  end if;
  delete from club_private.content_slugs where content_id = new.id;
  if new.slug is not null then
    insert into club_private.content_slugs(slug, content_id, kind)
    values(new.slug, new.id, content_kind);
  end if;
  return new;
end;
$$;

create or replace function club_private.sync_media()
returns trigger language plpgsql security definer set search_path = '' as $$
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

  for url in select jsonb_array_elements_text(new.data->'images') loop
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

create trigger club_partners_slug before insert or update on public.club_partners
for each row execute function club_private.fill_slug();
create trigger club_partners_slug_registry after insert or update of slug on public.club_partners
for each row execute function club_private.sync_slug_registry();
create trigger club_partners_slug_registry_delete after delete on public.club_partners
for each row execute function club_private.remove_slug_registry();
create trigger club_partners_audit before insert or update on public.club_partners
for each row execute function club_private.audit_content();
create trigger preserve_partner_created_at before insert or update on public.club_partners
for each row execute function club_private.preserve_split_created_at();
create trigger club_partners_sync_media after insert or update of data on public.club_partners
for each row execute function club_private.sync_media();

create or replace function club_private.can_delete_file(p text)
returns boolean language sql stable security definer set search_path = '' as $$
  select club_private.is_editor() and (
    exists(
      select 1 from public.club_media
      where path = p and deleting
        and not exists(select 1 from public.club_member_media where media_id = club_media.id)
        and not exists(select 1 from public.club_event_media where media_id = club_media.id)
        and not exists(select 1 from public.club_news_media where media_id = club_media.id)
        and not exists(select 1 from public.club_partner_media where media_id = club_media.id)
    )
    or (split_part(p, '/', 1) = (select auth.uid())::text
      and not exists(select 1 from public.club_media where path = p))
  );
$$;

create or replace function public.club_prepare_media_delete(asset_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare p text;
begin
  if not club_private.is_editor() then raise exception 'Not authorized'; end if;
  select path into p from public.club_media where id = asset_id for update;
  if not found then raise exception 'Image not found'; end if;
  if exists(select 1 from public.club_member_media where media_id = asset_id)
    or exists(select 1 from public.club_event_media where media_id = asset_id)
    or exists(select 1 from public.club_news_media where media_id = asset_id)
    or exists(select 1 from public.club_partner_media where media_id = asset_id)
  then raise exception 'Image is used by published content'; end if;
  update public.club_media set deleting = true where id = asset_id;
  return p;
end;
$$;

alter table public.club_partners enable row level security;
alter table public.club_partner_media enable row level security;
revoke all on public.club_partners, public.club_partner_media from anon, authenticated;
grant select on public.club_partners to anon, authenticated;
grant insert(data, slug), update(data, slug), delete on public.club_partners to authenticated;
grant select on public.club_partner_media to authenticated;

create policy club_partners_read on public.club_partners for select to anon, authenticated
  using (true);
create policy club_partners_insert on public.club_partners for insert to authenticated
  with check (club_private.is_editor());
create policy club_partners_update on public.club_partners for update to authenticated
  using (club_private.is_editor()) with check (club_private.is_editor());
create policy club_partners_delete on public.club_partners for delete to authenticated
  using (club_private.is_editor());
create policy club_partner_media_read on public.club_partner_media for select to authenticated
  using (club_private.is_editor());

-- Dropping without CASCADE is intentional: deployment must fail if an
-- unexpected dependency still relies on either legacy table.
drop table public.club_content_media;
drop table public.club_content;
drop function club_private.preserve_content_created_at();

-- Small compatibility views keep already-open clients working during release.
-- They contain no legacy copy: every row comes from the partners tables.
create view public.club_content
with (security_invoker = true)
as
select id, 'partners'::text as kind, data, updated_at, updated_by, created_at, slug
from public.club_partners;

create view public.club_content_media
with (security_invoker = true)
as
select partner_id as content_id, media_id
from public.club_partner_media;

create function club_private.compat_partner_content()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    if new.kind is distinct from 'partners' then
      raise exception 'Only partners remain available through this compatibility view';
    end if;
    insert into public.club_partners(data, slug)
    values(new.data, new.slug)
    returning id, slug, data, created_at, updated_at, updated_by
      into new.id, new.slug, new.data, new.created_at, new.updated_at, new.updated_by;
    new.kind := 'partners';
    return new;
  elsif TG_OP = 'UPDATE' then
    update public.club_partners
    set data = new.data, slug = new.slug
    where id = old.id
    returning id, slug, data, created_at, updated_at, updated_by
      into new.id, new.slug, new.data, new.created_at, new.updated_at, new.updated_by;
    new.kind := 'partners';
    return new;
  else
    delete from public.club_partners where id = old.id;
    return old;
  end if;
end;
$$;

create trigger club_content_compat_write
instead of insert or update or delete on public.club_content
for each row execute function club_private.compat_partner_content();

revoke all on public.club_content, public.club_content_media from anon, authenticated;
grant select on public.club_content to anon, authenticated;
grant insert(kind, data, slug), update(data, slug), delete on public.club_content to authenticated;
grant select on public.club_content_media to authenticated;

revoke all on function club_private.fill_slug() from public, anon, authenticated;
revoke all on function club_private.sync_slug_registry() from public, anon, authenticated;
revoke all on function club_private.sync_media() from public, anon, authenticated;
revoke all on function club_private.can_delete_file(text) from public, anon, authenticated;
revoke all on function club_private.compat_partner_content() from public, anon, authenticated;
grant execute on function club_private.can_delete_file(text) to authenticated;
revoke all on function public.club_prepare_media_delete(uuid) from public, anon, authenticated;
grant execute on function public.club_prepare_media_delete(uuid) to authenticated;

commit;
