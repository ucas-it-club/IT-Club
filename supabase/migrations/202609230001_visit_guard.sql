-- Harden the visit counter without changing its API: same RPC, same argument,
-- so cached bundles keep working. The count stays "sessions" and keeps its rows.
-- Bots are recognised by User-Agent, and each IP may add at most 30 new
-- sessions an hour. The IP is stored only as a salted hash, cleared by a daily job.
alter table public.club_visits add column if not exists created_at timestamptz;
alter table public.club_visits alter column created_at set default now();
alter table public.club_visits add column if not exists ip_hash bytea;
create index if not exists club_visits_ip_recent on public.club_visits(ip_hash, created_at) where ip_hash is not null;

create table if not exists club_private.visit_salt (salt bytea not null default extensions.gen_random_bytes(32));
revoke all on club_private.visit_salt from anon, authenticated;
insert into club_private.visit_salt(salt) select extensions.gen_random_bytes(32) where not exists (select 1 from club_private.visit_salt);

create or replace function public.record_club_visit(visit_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  headers json := coalesce(current_setting('request.headers', true), '{}')::json;
  ua text := lower(coalesce(headers->>'user-agent', ''));
  -- Cloudflare sits in front of Supabase and overwrites this header, so clients cannot forge it.
  ip text := coalesce(headers->>'cf-connecting-ip', split_part(headers->>'x-forwarded-for', ',', 1), '');
  ip_key bytea;
begin
  if visit_id is null then raise exception 'Missing visit ID'; end if;

  -- The nil id is the site asking for the count without being a visit (admin, dev, previews).
  if visit_id = '00000000-0000-0000-0000-000000000000' or ua = '' or ua ~ '(bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|whatsapp|curl|wget|python|okhttp|axios|node-fetch|undici|go-http|java/|uptime|monitor)' then
    return (select count(*) from public.club_visits);
  end if;

  if ip <> '' then
    ip_key := extensions.hmac(convert_to(ip, 'UTF8'), (select salt from club_private.visit_salt limit 1), 'sha256');
    if (select count(*) from public.club_visits where ip_hash = ip_key and created_at > now() - interval '1 hour') >= 30 then
      return (select count(*) from public.club_visits);
    end if;
  end if;

  insert into public.club_visits(id, created_at, ip_hash) values (visit_id, now(), ip_key) on conflict do nothing;
  return (select count(*) from public.club_visits);
end;
$$;
revoke all on function public.record_club_visit(uuid) from public;
grant execute on function public.record_club_visit(uuid) to anon, authenticated;

-- Clears every hash once a day, so none outlives a day, as the privacy page
-- promises. The cost is that each IP's hourly allowance also resets at 03:00 UTC.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'club-visits-forget-ip',
  '0 3 * * *',
  $$update public.club_visits set ip_hash = null where ip_hash is not null$$
);
