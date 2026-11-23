-- Site Feedback (see GLOSSARY.md): any visitor sends a Bug report or a Suggestion,
-- super admins and editors read them. Visitors get no table rights; they write only
-- through club_send_feedback, which validates the input and allows each IP 5 items an hour.
begin;

create table public.club_feedback (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('bug','suggestion')),
 message text not null check(length(trim(message)) between 1 and 2000),
 name text check(length(name) <= 100),
 contact text check(length(contact) <= 200),
 page text check(length(page) <= 300),
 lang text check(lang in ('ar','en')),
 theme text check(theme in ('light','dark')),
 device text check(length(device) <= 300),
 status text not null default 'new' check(status in ('new','seen','done')),
 created_at timestamptz not null default now()
);
create index club_feedback_recent on public.club_feedback(created_at desc);
alter table public.club_feedback enable row level security;
revoke all on public.club_feedback from anon, authenticated;
grant select on public.club_feedback to authenticated;
create policy club_feedback_read on public.club_feedback for select to authenticated
 using(club_private.is_editor());

-- The rate guard keeps only a salted hash of the IP, for at most about two hours.
create table club_private.feedback_salt (salt text not null);
insert into club_private.feedback_salt(salt) values (gen_random_uuid()::text || gen_random_uuid()::text);
create table club_private.feedback_rate (
 ip_hash bytea not null,
 created_at timestamptz not null default now()
);
create index feedback_rate_recent on club_private.feedback_rate(ip_hash, created_at);
revoke all on club_private.feedback_salt, club_private.feedback_rate from public, anon, authenticated;

create function public.club_send_feedback(
 kind text, message text, name text default null, contact text default null,
 page text default null, lang text default null, theme text default null,
 device text default null, website text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  headers json := coalesce(current_setting('request.headers', true), '{}')::json;
  -- Cloudflare sits in front of Supabase and overwrites this header, so clients cannot forge it.
  ip text := coalesce(headers->>'cf-connecting-ip', split_part(headers->>'x-forwarded-for', ',', 1), '');
  ip_key bytea;
  clean_name text := nullif(trim(coalesce(name, '')), '');
  clean_contact text := nullif(trim(coalesce(contact, '')), '');
begin
  -- The honeypot is a field people never see; only bots fill it.
  if coalesce(website, '') <> '' or kind is null or kind not in ('bug','suggestion')
     or length(coalesce(clean_name, '')) > 100 or length(coalesce(clean_contact, '')) > 200 then
    raise exception 'feedback_rejected';
  end if;
  if length(trim(coalesce(message, ''))) = 0 then raise exception 'feedback_empty'; end if;
  if length(message) > 2000 then raise exception 'feedback_too_long'; end if;

  ip_key := sha256(convert_to((select salt from club_private.feedback_salt limit 1) || ip, 'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended(encode(ip_key, 'hex'), 0));
  delete from club_private.feedback_rate where created_at < now() - interval '1 hour';
  if (select count(*) from club_private.feedback_rate where ip_hash = ip_key) >= 5 then
    raise exception 'feedback_rate_limited';
  end if;

  insert into public.club_feedback(kind, message, name, contact, page, lang, theme, device)
  values (
    kind, trim(message), clean_name, clean_contact, left(page, 300),
    case when lang in ('ar','en') then lang end,
    case when theme in ('light','dark') then theme end,
    left(device, 300)
  );
  insert into club_private.feedback_rate(ip_hash) values (ip_key);
end;
$$;
revoke all on function public.club_send_feedback(text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.club_send_feedback(text,text,text,text,text,text,text,text,text) to anon, authenticated;

-- Without new submissions the in-function cleanup never runs, so sweep hourly too.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'club-feedback-forget-ip',
      '0 * * * *',
      $job$delete from club_private.feedback_rate where created_at < now() - interval '1 hour'$job$
    );
  end if;
end;
$$;

commit;
