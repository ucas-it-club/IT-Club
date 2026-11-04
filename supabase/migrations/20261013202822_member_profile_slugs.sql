-- Give each club member a stable, editable lowercase URL name.
-- Keep member URLs in the shared registry so they cannot collide with articles or partners.
begin;

alter table club_private.content_slugs
  drop constraint content_slugs_kind_check;
alter table club_private.content_slugs
  add constraint content_slugs_kind_check
  check (kind in ('projects', 'achievements', 'partners', 'events', 'news', 'members'));

alter table public.club_members add column slug text;
alter table public.club_members add constraint club_members_slug_format
  check (slug is null or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80));

create or replace function club_private.fill_slug()
returns trigger language plpgsql security definer set search_path = '' as $$
declare content_kind text; base text; candidate text; n int := 1;
begin
  if tg_table_name = 'club_members' then
    content_kind := 'members';
  elsif tg_table_name = 'club_events' then
    content_kind := 'events';
  elsif tg_table_name = 'club_news' then
    content_kind := 'news';
  elsif tg_table_name = 'club_partners' then
    content_kind := 'partners';
  else
    content_kind := new.kind;
  end if;

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
  if tg_table_name = 'club_members' then
    content_kind := 'members';
  elsif tg_table_name = 'club_events' then
    content_kind := 'events';
  elsif tg_table_name = 'club_news' then
    content_kind := 'news';
  elsif tg_table_name = 'club_partners' then
    content_kind := 'partners';
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

create trigger club_members_slug before insert or update on public.club_members
for each row execute function club_private.fill_slug();
create trigger club_members_slug_registry after insert or update of slug on public.club_members
for each row execute function club_private.sync_slug_registry();
create trigger club_members_slug_registry_delete after delete on public.club_members
for each row execute function club_private.remove_slug_registry();

revoke all on public.club_members from anon, authenticated;
grant select on public.club_members to anon, authenticated;
grant insert(data, slug), update(data, slug), delete on public.club_members to authenticated;

-- Backfill through the same trigger used by new members. Preserve audit metadata.
alter table public.club_members disable trigger club_members_audit;
update public.club_members set slug = null where slug is null;
alter table public.club_members enable trigger club_members_audit;

revoke all on function club_private.fill_slug() from public, anon, authenticated;
revoke all on function club_private.sync_slug_registry() from public, anon, authenticated;
commit;
