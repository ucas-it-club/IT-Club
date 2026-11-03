begin;
alter table public.club_admins drop constraint club_admins_role_check;
alter table public.club_admins add constraint club_admins_role_check
 check(role in ('editor','super_admin','media_editor','partnerships_editor','communications_editor','events_editor'));

create function club_private.can_manage_events() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.club_admins
  where id=auth.uid() and role in ('editor','super_admin','events_editor'));
$$;
revoke all on function club_private.can_manage_events() from public;
grant execute on function club_private.can_manage_events() to authenticated;

drop policy club_events_insert on public.club_events;
drop policy club_events_update on public.club_events;
drop policy club_events_delete on public.club_events;
drop policy club_event_media_read on public.club_event_media;
create policy club_events_insert on public.club_events for insert to authenticated with check(club_private.can_manage_events());
create policy club_events_update on public.club_events for update to authenticated
 using(club_private.can_manage_events()) with check(club_private.can_manage_events());
create policy club_events_delete on public.club_events for delete to authenticated using(club_private.can_manage_events());
create policy club_event_media_read on public.club_event_media for select to authenticated using(club_private.can_manage_events());

create function club_private.can_use_event_asset(asset_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select club_private.can_manage_events() and exists(select 1 from public.club_media m
 where m.id=asset_id and not m.deleting and (
  club_private.is_editor() or m.created_by=auth.uid()
  or exists(select 1 from public.club_event_media l where l.media_id=m.id)));
$$;
revoke all on function club_private.can_use_event_asset(uuid) from public;
grant execute on function club_private.can_use_event_asset(uuid) to authenticated;

create function club_private.validate_event_assets() returns trigger
language plpgsql set search_path='' as $$
begin
 if not club_private.can_manage_events() then raise exception 'Event access required' using errcode='42501'; end if;
 if exists(select 1 from jsonb_array_elements_text(new.data->'images') image_url
  where not exists(select 1 from public.club_media m
   where club_private.media_url(m.path)=image_url and club_private.can_use_event_asset(m.id)))
 then raise exception 'Image is not available to this committee' using errcode='42501'; end if;
 return new;
end;$$;
revoke all on function club_private.validate_event_assets() from public;
create trigger club_events_validate_assets before insert or update of data on public.club_events
 for each row execute function club_private.validate_event_assets();

create policy club_media_events_read on public.club_media for select to authenticated
 using(club_private.can_manage_events() and (created_by=auth.uid() or club_private.can_use_event_asset(id)));
create policy club_media_events_add on public.club_media for insert to authenticated with check(
 club_private.can_manage_events() and created_by=auth.uid() and split_part(path,'/',1)=auth.uid()::text
 and not deleting and not club_private.file_absent(path));
create policy club_media_events_rename on public.club_media for update to authenticated
 using(club_private.can_use_event_asset(id)) with check(club_private.can_use_event_asset(id));
create policy club_media_events_delete on public.club_media for delete to authenticated using(
 club_private.can_manage_events() and created_by=auth.uid() and deleting and club_private.file_absent(path));
create policy club_files_events_upload on storage.objects for insert to authenticated with check(
 bucket_id='club-media' and club_private.can_manage_events() and (storage.foldername(name))[1]=auth.uid()::text);
create policy club_files_events_read on storage.objects for select to authenticated using(
 bucket_id='club-media' and club_private.can_manage_events() and (
 split_part(name,'/',1)=auth.uid()::text or exists(select 1 from public.club_media m
  where m.path=name and club_private.can_use_event_asset(m.id))));

create or replace function club_private.can_delete_file(p text)
returns boolean language sql stable security definer set search_path='' as $$
 select (club_private.is_editor() or ((club_private.can_manage_news() or club_private.can_manage_partners() or club_private.can_manage_events())
  and split_part(p,'/',1)=auth.uid()::text)) and (
 exists(select 1 from public.club_media m where m.path=p and m.deleting
  and not exists(select 1 from public.club_member_media where media_id=m.id)
  and not exists(select 1 from public.club_event_media where media_id=m.id)
  and not exists(select 1 from public.club_news_media where media_id=m.id)
  and not exists(select 1 from public.club_partner_media where media_id=m.id))
 or (split_part(p,'/',1)=auth.uid()::text and not exists(select 1 from public.club_media where path=p)));
$$;
-- Keep privileged lookup/deletion preparation outside the exposed API schema.
create or replace function club_private.prepare_scoped_media_delete(asset_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare p text; creator uuid;
begin
 if auth.uid() is null then raise exception 'Not authorized'; end if;
 select path,created_by into p,creator from public.club_media where id=asset_id for update;
 if not found then raise exception 'Image not found'; end if;
 if not (club_private.is_editor() or ((club_private.can_manage_news() or club_private.can_manage_partners() or club_private.can_manage_events()) and creator=auth.uid()))
 then raise exception 'Not authorized'; end if;
 if exists(select 1 from public.club_member_media where media_id=asset_id)
 or exists(select 1 from public.club_event_media where media_id=asset_id)
 or exists(select 1 from public.club_news_media where media_id=asset_id)
 or exists(select 1 from public.club_partner_media where media_id=asset_id)
 then raise exception 'Image is used by content'; end if;
 update public.club_media set deleting=true where id=asset_id; return p;
end;$$;
revoke all on function club_private.prepare_scoped_media_delete(uuid) from public;
grant execute on function club_private.prepare_scoped_media_delete(uuid) to authenticated;
create or replace function public.club_prepare_media_delete(asset_id uuid)
returns text language sql security invoker set search_path='' as $$
 select club_private.prepare_scoped_media_delete(asset_id);
$$;
revoke all on function public.club_prepare_media_delete(uuid) from public,anon;
grant execute on function public.club_prepare_media_delete(uuid) to authenticated;

drop policy club_admins_add on public.club_admins;
drop policy club_admins_change on public.club_admins;
drop policy club_admins_delete on public.club_admins;
create policy club_admins_add on public.club_admins for insert to authenticated with check(
 club_private.is_super() and role in ('editor','media_editor','partnerships_editor','communications_editor','events_editor') and id<>auth.uid());
create policy club_admins_change on public.club_admins for update to authenticated using(
 club_private.is_super() and role in ('editor','media_editor','partnerships_editor','communications_editor','events_editor') and id<>auth.uid()) with check(
 club_private.is_super() and role in ('editor','media_editor','partnerships_editor','communications_editor','events_editor') and id<>auth.uid());
create policy club_admins_delete on public.club_admins for delete to authenticated using(
 club_private.is_super() and role in ('editor','media_editor','partnerships_editor','communications_editor','events_editor') and id<>auth.uid());
commit;
