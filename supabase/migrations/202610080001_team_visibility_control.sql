-- Let authorized editors change only the public visibility of the team section
-- without granting them write access to the rest of the site settings.
begin;

create or replace function club_private.set_team_visibility(is_visible boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not club_private.is_editor() then
    raise exception 'Not authorized';
  end if;
  if is_visible is null then
    raise exception 'Visibility is required';
  end if;

  insert into public.club_settings(id, data)
  values('public', jsonb_build_object('teamVisible', is_visible))
  on conflict (id) do update
  set data = public.club_settings.data || jsonb_build_object('teamVisible', is_visible);

  return is_visible;
end;
$$;

create or replace function public.club_set_team_visibility(is_visible boolean)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select club_private.set_team_visibility(is_visible);
$$;

revoke all on function club_private.set_team_visibility(boolean)
  from public, anon, authenticated;
revoke all on function public.club_set_team_visibility(boolean)
  from public, anon, authenticated;
grant execute on function club_private.set_team_visibility(boolean) to authenticated;
grant execute on function public.club_set_team_visibility(boolean) to authenticated;

commit;
