-- Issue #56: several presenters and organizers per event.
--
-- People get optional LinkedIn/GitHub links (copied from the member when one is
-- picked, editable per event), and the admin saves an event's whole list in one
-- call. Replacing the list is the only way to reorder: the slot constraint is not
-- deferrable, so swapping two display orders in place fails.
begin;

alter table public.club_event_people
  add column linkedin_url text check (linkedin_url ~ '^https://' and length(linkedin_url) <= 500),
  add column github_url text check (github_url ~ '^https://' and length(github_url) <= 500);

-- `people` is an array in display order; each role is numbered from 0 on its own.
create function public.club_save_event_people(target_event uuid, people jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not club_private.can_manage_events() then
    raise exception 'Event access required' using errcode='42501';
  end if;
  if jsonb_typeof(people) is distinct from 'array' then
    raise exception 'People must be an array' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(people) p
    group by p->>'role' having count(*) > 6) then
    raise exception 'At most 6 presenters and 6 organizers' using errcode='22023';
  end if;
  -- Organizers are club members. Not a table check: deleting a member nulls member_id.
  if exists(select 1 from jsonb_array_elements(people) p
    where p->>'role' = 'organizer' and nullif(p->>'member_id', '') is null) then
    raise exception 'Organizers must be club members' using errcode='22023';
  end if;

  delete from public.club_event_people where event_id = target_event;
  insert into public.club_event_people(event_id, member_id, role, display_order,
    name, name_en, bio, bio_en, linkedin_url, github_url)
  select target_event, nullif(p->>'member_id', '')::uuid, p->>'role',
    (row_number() over (partition by p->>'role' order by ord) - 1)::integer,
    nullif(trim(p->>'name'), ''), nullif(trim(p->>'name_en'), ''),
    nullif(trim(p->>'bio'), ''), nullif(trim(p->>'bio_en'), ''),
    nullif(trim(p->>'linkedin_url'), ''), nullif(trim(p->>'github_url'), '')
  from jsonb_array_elements(people) with ordinality as list(p, ord);
end;$$;

revoke all on function public.club_save_event_people(uuid, jsonb) from public, anon;
grant execute on function public.club_save_event_people(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
