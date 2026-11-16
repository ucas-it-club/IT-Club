begin;

create table public.club_achievements (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint club_achievements_data_check check (
    jsonb_typeof(data) = 'object'
    and jsonb_typeof(data->'title') = 'string'
    and length(trim(data->>'title')) between 2 and 200
    and jsonb_typeof(data->'title_en') = 'string'
    and length(trim(data->>'title_en')) between 2 and 200
    and data->>'type' in ('project','event','workshop','partnership','media','award','meeting','decision','other')
    and data->>'committee' in ('club','media','relations','activities')
    and jsonb_typeof(data->'date') = 'string'
    and length(trim(data->>'date')) = 10
    and jsonb_typeof(data->'summary') = 'string'
    and length(trim(data->>'summary')) between 2 and 4000
    and jsonb_typeof(data->'summary_en') = 'string'
    and length(trim(data->>'summary_en')) between 2 and 4000
    and jsonb_typeof(data->'participants') = 'string'
    and jsonb_typeof(data->'participants_en') = 'string'
    and jsonb_typeof(data->'requirements') = 'object'
    and jsonb_typeof(data->'requirements_en') = 'object'
    and data->>'status' in ('draft','approved')
  )
);

create index club_achievements_date on public.club_achievements ((data->>'date') desc);
create index club_achievements_type on public.club_achievements ((data->>'type'));
create index club_achievements_committee on public.club_achievements ((data->>'committee'));

create or replace function club_private.can_manage_achievement(d jsonb)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.club_admins a
    where a.id = auth.uid()
      and (
        a.role in ('editor','super_admin')
        or (a.role = 'communications_editor' and d->>'committee' in ('media','relations'))
        or (a.role = 'events_editor' and d->>'committee' = 'activities')
      )
  );
$$;

revoke all on function club_private.can_manage_achievement(jsonb) from public;
grant execute on function club_private.can_manage_achievement(jsonb) to authenticated;

alter table public.club_achievements enable row level security;
revoke all on public.club_achievements from anon, authenticated;
grant select, insert, update, delete on public.club_achievements to authenticated;

create policy club_achievements_read on public.club_achievements
  for select to authenticated using (club_private.can_manage_achievement(data));
create policy club_achievements_insert on public.club_achievements
  for insert to authenticated with check (club_private.can_manage_achievement(data));
create policy club_achievements_update on public.club_achievements
  for update to authenticated
  using (club_private.can_manage_achievement(data))
  with check (club_private.can_manage_achievement(data));
create policy club_achievements_delete on public.club_achievements
  for delete to authenticated using (club_private.can_manage_achievement(data));

create trigger club_achievements_audit
before insert or update on public.club_achievements
for each row execute function club_private.audit_content();

create trigger club_achievements_created_at
before insert or update on public.club_achievements
for each row execute function club_private.preserve_split_created_at();

commit;
