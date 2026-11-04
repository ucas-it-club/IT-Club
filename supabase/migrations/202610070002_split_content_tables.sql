-- Store members, events and news in dedicated tables. Existing identifiers,
-- slugs, timestamps, editor attribution and media links are preserved.
begin;

create table public.club_members (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null constraint club_members_data_check
    check (club_private.valid_content('members', data)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table public.club_events (
  id uuid primary key default gen_random_uuid(),
  slug text constraint club_events_slug_format
    check (slug is null or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80)),
  data jsonb not null constraint club_events_data_check
    check (club_private.valid_content('events', data)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table public.club_news (
  id uuid primary key default gen_random_uuid(),
  slug text constraint club_news_slug_format
    check (slug is null or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80)),
  data jsonb not null constraint club_news_data_check
    check (club_private.valid_content('news', data)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index club_members_updated on public.club_members(updated_at desc);
create index club_events_updated on public.club_events(updated_at desc);
create index club_news_updated on public.club_news(updated_at desc);
create index club_members_updated_by on public.club_members(updated_by);
create index club_events_updated_by on public.club_events(updated_by);
create index club_news_updated_by on public.club_news(updated_by);

-- Separate usage tables retain real foreign keys instead of introducing an
-- unvalidated polymorphic content_id.
create table public.club_member_media (
  member_id uuid not null references public.club_members(id) on delete cascade,
  media_id uuid not null references public.club_media(id) on delete restrict,
  primary key(member_id, media_id)
);
create table public.club_event_media (
  event_id uuid not null references public.club_events(id) on delete cascade,
  media_id uuid not null references public.club_media(id) on delete restrict,
  primary key(event_id, media_id)
);
create table public.club_news_media (
  news_id uuid not null references public.club_news(id) on delete cascade,
  media_id uuid not null references public.club_media(id) on delete restrict,
  primary key(news_id, media_id)
);
create index club_member_media_asset on public.club_member_media(media_id);
create index club_event_media_asset on public.club_event_media(media_id);
create index club_news_media_asset on public.club_news_media(media_id);

-- Copy through the new constraints. The original rows remain as a read-only
-- archive so the migration never destroys the only copy of published data.
insert into public.club_members(id, data, created_at, updated_at, updated_by)
select id, data, created_at, updated_at, updated_by
from public.club_content where kind = 'members';

insert into public.club_events(id, slug, data, created_at, updated_at, updated_by)
select id, slug, data, created_at, updated_at, updated_by
from public.club_content where kind = 'events';

insert into public.club_news(id, slug, data, created_at, updated_at, updated_by)
select id, slug, data, created_at, updated_at, updated_by
from public.club_content where kind = 'news';

insert into public.club_member_media(member_id, media_id)
select link.content_id, link.media_id
from public.club_content_media link
join public.club_content content on content.id = link.content_id
where content.kind = 'members';

insert into public.club_event_media(event_id, media_id)
select link.content_id, link.media_id
from public.club_content_media link
join public.club_content content on content.id = link.content_id
where content.kind = 'events';

insert into public.club_news_media(news_id, media_id)
select link.content_id, link.media_id
from public.club_content_media link
join public.club_content content on content.id = link.content_id
where content.kind = 'news';

-- A private registry keeps readable links unique across events, news and the
-- remaining content table without exposing another writable API table.
create table club_private.content_slugs (
  slug text primary key,
  content_id uuid not null unique,
  kind text not null check (kind in ('projects', 'achievements', 'partners', 'events', 'news'))
);

insert into club_private.content_slugs(slug, content_id, kind)
select slug, id, kind from public.club_content
where slug is not null and kind not in ('members', 'events', 'news')
union all
select slug, id, 'events' from public.club_events where slug is not null
union all
select slug, id, 'news' from public.club_news where slug is not null;

create or replace function club_private.fill_slug()
returns trigger language plpgsql security definer set search_path = '' as $$
declare content_kind text; base text; candidate text; n int := 1;
begin
  if TG_TABLE_NAME = 'club_events' then
    content_kind := 'events';
  elsif TG_TABLE_NAME = 'club_news' then
    content_kind := 'news';
  else
    content_kind := new.kind;
  end if;
  if content_kind = 'members' then new.slug := null; return new; end if;
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
  else
    content_kind := new.kind;
  end if;
  delete from club_private.content_slugs where content_id = new.id;
  if new.slug is not null then
    insert into club_private.content_slugs(slug, content_id, kind)
    values(new.slug, new.id, content_kind);
  end if;
  return new;
end;
$$;

create or replace function club_private.remove_slug_registry()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from club_private.content_slugs where content_id = old.id;
  return old;
end;
$$;

drop trigger if exists club_content_slug on public.club_content;
create trigger club_content_slug before insert or update on public.club_content
for each row execute function club_private.fill_slug();
create trigger club_event_slug before insert or update on public.club_events
for each row execute function club_private.fill_slug();
create trigger club_news_slug before insert or update on public.club_news
for each row execute function club_private.fill_slug();

create trigger club_content_slug_registry after insert or update of slug on public.club_content
for each row execute function club_private.sync_slug_registry();
create trigger club_event_slug_registry after insert or update of slug on public.club_events
for each row execute function club_private.sync_slug_registry();
create trigger club_news_slug_registry after insert or update of slug on public.club_news
for each row execute function club_private.sync_slug_registry();
create trigger club_content_slug_registry_delete after delete on public.club_content
for each row execute function club_private.remove_slug_registry();
create trigger club_event_slug_registry_delete after delete on public.club_events
for each row execute function club_private.remove_slug_registry();
create trigger club_news_slug_registry_delete after delete on public.club_news
for each row execute function club_private.remove_slug_registry();

create trigger club_members_audit before insert or update on public.club_members
for each row execute function club_private.audit_content();
create trigger club_events_audit before insert or update on public.club_events
for each row execute function club_private.audit_content();
create trigger club_news_audit before insert or update on public.club_news
for each row execute function club_private.audit_content();
create or replace function club_private.preserve_split_created_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then new.created_at := old.created_at;
  else new.created_at := coalesce(new.created_at, now());
  end if;
  return new;
end;
$$;
create trigger preserve_member_created_at before insert or update on public.club_members
for each row execute function club_private.preserve_split_created_at();
create trigger preserve_event_created_at before insert or update on public.club_events
for each row execute function club_private.preserve_split_created_at();
create trigger preserve_news_created_at before insert or update on public.club_news
for each row execute function club_private.preserve_split_created_at();

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
  else
    delete from public.club_content_media where content_id = new.id;
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
      insert into public.club_content_media(content_id, media_id) values(new.id, asset)
      on conflict do nothing;
    end if;
  end loop;
  return new;
end;
$$;

create trigger club_members_sync_media after insert or update of data on public.club_members
for each row execute function club_private.sync_media();
create trigger club_events_sync_media after insert or update of data on public.club_events
for each row execute function club_private.sync_media();
create trigger club_news_sync_media after insert or update of data on public.club_news
for each row execute function club_private.sync_media();

create or replace function club_private.can_delete_file(p text)
returns boolean language sql stable security definer set search_path = '' as $$
  select club_private.is_editor() and (
    exists(
      select 1 from public.club_media
      where path = p and deleting
        and not exists(
          select 1 from public.club_content_media link
          join public.club_content content on content.id = link.content_id
          where link.media_id = club_media.id
            and content.kind not in ('members', 'events', 'news')
        )
        and not exists(select 1 from public.club_member_media where media_id = club_media.id)
        and not exists(select 1 from public.club_event_media where media_id = club_media.id)
        and not exists(select 1 from public.club_news_media where media_id = club_media.id)
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
  if exists(
      select 1 from public.club_content_media link
      join public.club_content content on content.id = link.content_id
      where link.media_id = asset_id and content.kind not in ('members', 'events', 'news')
    )
    or exists(select 1 from public.club_member_media where media_id = asset_id)
    or exists(select 1 from public.club_event_media where media_id = asset_id)
    or exists(select 1 from public.club_news_media where media_id = asset_id)
  then raise exception 'Image is used by published content'; end if;
  update public.club_media set deleting = true where id = asset_id;
  return p;
end;
$$;

-- Reclassifying an article now moves it atomically between its dedicated
-- tables while retaining its id, creation time and public link.
create or replace function club_private.move_article(
  source_kind text,
  target_kind text,
  article_id uuid,
  new_data jsonb,
  new_slug text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare original_created_at timestamptz;
begin
  if not club_private.is_editor() then raise exception 'Not authorized'; end if;
  if source_kind not in ('events', 'news') or target_kind not in ('events', 'news')
    or source_kind = target_kind then raise exception 'Invalid content type change'; end if;

  if source_kind = 'events' then
    select created_at into original_created_at from public.club_events where id = article_id for update;
    if not found then raise exception 'Article not found'; end if;
    delete from public.club_events where id = article_id;
  else
    select created_at into original_created_at from public.club_news where id = article_id for update;
    if not found then raise exception 'Article not found'; end if;
    delete from public.club_news where id = article_id;
  end if;

  if target_kind = 'events' then
    insert into public.club_events(id, slug, data, created_at)
    values(article_id, new_slug, new_data, original_created_at);
  else
    insert into public.club_news(id, slug, data, created_at)
    values(article_id, new_slug, new_data, original_created_at);
  end if;
  return article_id;
end;
$$;

create or replace function public.club_move_article(
  source_kind text,
  target_kind text,
  article_id uuid,
  new_data jsonb,
  new_slug text default null
) returns uuid language sql security invoker set search_path = '' as $$
  select club_private.move_article(source_kind, target_kind, article_id, new_data, new_slug);
$$;

alter table public.club_members enable row level security;
alter table public.club_events enable row level security;
alter table public.club_news enable row level security;
alter table public.club_member_media enable row level security;
alter table public.club_event_media enable row level security;
alter table public.club_news_media enable row level security;

revoke all on public.club_members, public.club_events, public.club_news,
  public.club_member_media, public.club_event_media, public.club_news_media
from anon, authenticated;
grant select on public.club_members, public.club_events, public.club_news to anon, authenticated;
grant insert(data), update(data), delete on public.club_members to authenticated;
grant insert(data, slug), update(data, slug), delete on public.club_events, public.club_news to authenticated;
grant select on public.club_member_media, public.club_event_media, public.club_news_media to authenticated;

create policy club_members_read on public.club_members for select to anon, authenticated using (true);
create policy club_members_insert on public.club_members for insert to authenticated
  with check (club_private.is_editor());
create policy club_members_update on public.club_members for update to authenticated
  using (club_private.is_editor()) with check (club_private.is_editor());
create policy club_members_delete on public.club_members for delete to authenticated
  using (club_private.is_editor());

create policy club_events_read on public.club_events for select to anon, authenticated using (true);
create policy club_events_insert on public.club_events for insert to authenticated
  with check (club_private.is_editor());
create policy club_events_update on public.club_events for update to authenticated
  using (club_private.is_editor()) with check (club_private.is_editor());
create policy club_events_delete on public.club_events for delete to authenticated
  using (club_private.is_editor());

create policy club_news_read on public.club_news for select to anon, authenticated using (true);
create policy club_news_insert on public.club_news for insert to authenticated
  with check (club_private.is_editor());
create policy club_news_update on public.club_news for update to authenticated
  using (club_private.is_editor()) with check (club_private.is_editor());
create policy club_news_delete on public.club_news for delete to authenticated
  using (club_private.is_editor());

create policy club_member_media_read on public.club_member_media for select to authenticated
  using (club_private.is_editor());
create policy club_event_media_read on public.club_event_media for select to authenticated
  using (club_private.is_editor());
create policy club_news_media_read on public.club_news_media for select to authenticated
  using (club_private.is_editor());

-- Editors use the dedicated tables from now on. Historical rows for the three
-- migrated kinds stay visible as an archive but cannot be changed through the API.
drop policy if exists club_content_write on public.club_content;
create policy club_content_insert on public.club_content for insert to authenticated
  with check (club_private.is_editor() and kind not in ('members', 'events', 'news'));
create policy club_content_update on public.club_content for update to authenticated
  using (club_private.is_editor() and kind not in ('members', 'events', 'news'))
  with check (club_private.is_editor() and kind not in ('members', 'events', 'news'));
create policy club_content_delete on public.club_content for delete to authenticated
  using (club_private.is_editor() and kind not in ('members', 'events', 'news'));

revoke all on function public.club_move_article(text, text, uuid, jsonb, text) from public;
grant execute on function public.club_move_article(text, text, uuid, jsonb, text) to authenticated;
revoke all on function club_private.fill_slug() from public, anon, authenticated;
revoke all on function club_private.sync_slug_registry() from public, anon, authenticated;
revoke all on function club_private.remove_slug_registry() from public, anon, authenticated;
revoke all on function club_private.preserve_split_created_at() from public, anon, authenticated;
revoke all on function club_private.sync_media() from public, anon, authenticated;
revoke all on function club_private.move_article(text, text, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function club_private.move_article(text, text, uuid, jsonb, text) to authenticated;
revoke all on function club_private.can_delete_file(text) from public, anon, authenticated;
grant execute on function club_private.can_delete_file(text) to authenticated;

commit;
