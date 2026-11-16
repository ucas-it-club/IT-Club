begin;
-- Read live events at the URL used by the already-deployed Google Apps Script.
-- Preserve the previous partner compatibility projection when it exists.
create or replace view public.club_content with (security_invoker=true) as
 select id,'partners'::text as kind,data,updated_at,updated_by,created_at,slug from public.club_partners
 union all
 select id,'events'::text as kind,data,updated_at,updated_by,created_at,slug from public.club_events;
grant select on public.club_content to anon,authenticated;

-- Existing installations may retain partner-write grants and their old trigger.
-- Event writes must always use club_events and its RLS policies.
create function club_private.guard_legacy_event_writes() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if (TG_OP <> 'INSERT' and old.kind='events') or
    (TG_OP <> 'DELETE' and new.kind='events') then
  raise exception 'Events are read-only through the legacy endpoint' using errcode='42501';
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end;$$;
revoke all on function club_private.guard_legacy_event_writes() from public,anon,authenticated;
create trigger aaa_legacy_event_read_only instead of insert or update or delete on public.club_content
 for each row execute function club_private.guard_legacy_event_writes();
notify pgrst,'reload schema';
commit;
