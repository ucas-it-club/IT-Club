begin;
-- Authorization comes from the assigned admin role, never a member's public title.
create function club_private.can_manage_member(d jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
  select 1 from public.club_admins a where a.id=auth.uid() and (
   a.role in ('editor','super_admin') or (
    coalesce(d->>'isFounder','false')='false' and (
     (a.role='communications_editor' and d->>'committee' in ('media','relations')) or
     (a.role='events_editor' and d->>'committee'='activities')
    )
   )
  )
 );
$$;
revoke all on function club_private.can_manage_member(jsonb) from public;
grant execute on function club_private.can_manage_member(jsonb) to authenticated;

drop policy club_members_insert on public.club_members;
drop policy club_members_update on public.club_members;
drop policy club_members_delete on public.club_members;
create policy club_members_insert on public.club_members for insert to authenticated
 with check(club_private.can_manage_member(data));
create policy club_members_update on public.club_members for update to authenticated
 using(club_private.can_manage_member(data)) with check(club_private.can_manage_member(data));
create policy club_members_delete on public.club_members for delete to authenticated
 using(club_private.can_manage_member(data));

drop policy club_member_media_read on public.club_member_media;
create policy club_member_media_read on public.club_member_media for select to authenticated
 using(exists(select 1 from public.club_members m where m.id=member_id and club_private.can_manage_member(m.data)));

-- Private privileged lookup avoids recursive media/link policies.
create function club_private.can_use_member_asset(asset_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.club_media asset
 where asset.id=asset_id and not asset.deleting and (
  club_private.is_editor() or (
   exists(select 1 from public.club_admins a where a.id=auth.uid() and a.role in ('communications_editor','events_editor')) and (
    asset.created_by=auth.uid() or exists(select 1 from public.club_member_media l
     join public.club_members m on m.id=l.member_id
     where l.media_id=asset.id and club_private.can_manage_member(m.data))
   )
  )
 ));
$$;
revoke all on function club_private.can_use_member_asset(uuid) from public;
grant execute on function club_private.can_use_member_asset(uuid) to authenticated;
create policy club_media_member_read on public.club_media for select to authenticated
 using(club_private.can_use_member_asset(id));

create function club_private.validate_member_assets() returns trigger
language plpgsql set search_path='' as $$
begin
 if not club_private.can_manage_member(new.data) then
  raise exception 'Member access required' using errcode='42501';
 end if;
 if exists(select 1 from jsonb_array_elements_text(new.data->'images') image_url
  where not exists(select 1 from public.club_media m where club_private.media_url(m.path)=image_url
   and club_private.can_use_member_asset(m.id))) then
  raise exception 'Image is not available to this committee' using errcode='42501';
 end if;
 return new;
end;$$;
revoke all on function club_private.validate_member_assets() from public;
create trigger club_members_validate_assets before insert or update of data on public.club_members
 for each row execute function club_private.validate_member_assets();
commit;
