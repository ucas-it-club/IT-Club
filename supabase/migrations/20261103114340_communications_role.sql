begin;
alter table public.club_admins drop constraint club_admins_role_check;
alter table public.club_admins add constraint club_admins_role_check
 check(role in ('editor','super_admin','media_editor','partnerships_editor','communications_editor'));

-- Extend the existing private authorization helpers; their callers retain their scopes.
create or replace function club_private.can_manage_news() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.club_admins
 where id=auth.uid() and role in ('media_editor','communications_editor','super_admin'));
$$;
create or replace function club_private.can_manage_partners() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.club_admins
 where id=auth.uid() and role in ('editor','super_admin','partnerships_editor','communications_editor'));
$$;

drop policy club_admins_add on public.club_admins;
drop policy club_admins_change on public.club_admins;
drop policy club_admins_delete on public.club_admins;
create policy club_admins_add on public.club_admins for insert to authenticated with check(
 club_private.is_super() and role in ('editor','media_editor','partnerships_editor','communications_editor') and id<>auth.uid());
create policy club_admins_change on public.club_admins for update to authenticated using(
 club_private.is_super() and role in ('editor','media_editor','partnerships_editor','communications_editor') and id<>auth.uid()) with check(
 club_private.is_super() and role in ('editor','media_editor','partnerships_editor','communications_editor') and id<>auth.uid());
create policy club_admins_delete on public.club_admins for delete to authenticated using(
 club_private.is_super() and role in ('editor','media_editor','partnerships_editor','communications_editor') and id<>auth.uid());
commit;
