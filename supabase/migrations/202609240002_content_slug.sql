-- Readable URL names for news, events and partners (members keep their ids).
-- A slug is generated from title_en when an item is created, or when an editor
-- clears it; editing the title never changes it, so shared links keep working.
begin;

alter table public.club_content add column if not exists slug text;
alter table public.club_content drop constraint if exists club_content_slug_format;
alter table public.club_content add constraint club_content_slug_format
  check (slug is null or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80));
-- One namespace for every kind: news and events links resolve across the two.
create unique index if not exists club_content_slug_unique on public.club_content(slug) where slug is not null;

-- Lowercase ASCII words joined by hyphens, filler words dropped, at most 60 characters.
-- Apostrophes are dropped first, so "Prisoner's" becomes "prisoners", not "prisoner-s".
create or replace function club_private.slugify(t text) returns text language plpgsql immutable set search_path='' as $$
declare w text; result text := '';
begin
 foreach w in array regexp_split_to_array(trim(regexp_replace(regexp_replace(lower(coalesce(t,'')),'[''’]','','g'),'[^a-z0-9]+',' ','g')),' ') loop
  continue when w='' or w = any(array['a','an','the','of','for','its','it','is','are','was','in','on','at','to','and','or','with','from','by','as','that','this','our','their']);
  exit when result<>'' and length(result)+length(w)+1>60;
  result := case when result='' then w else result||'-'||w end;
 end loop;
 return nullif(left(result,60),'');
end;$$;

create or replace function club_private.fill_slug() returns trigger language plpgsql set search_path='' as $$
declare base text; candidate text; n int := 1;
begin
 if new.kind='members' then new.slug := null; return new; end if;
 if new.slug is not null then return new; end if;
 base := club_private.slugify(new.data->>'title_en');
 -- A title with no ASCII words gets no slug; the item keeps its id in URLs.
 if base is null then return new; end if;
 candidate := base;
 while exists(select 1 from public.club_content c where c.slug=candidate and c.id<>new.id) loop
  n := n+1;
  candidate := base||'-'||n;
 end loop;
 new.slug := candidate;
 return new;
end;$$;

drop trigger if exists club_content_slug on public.club_content;
create trigger club_content_slug before insert or update on public.club_content
  for each row execute function club_private.fill_slug();

-- Backfill without the audit trigger, so existing items keep their editor and
-- last-edited time. Least recently edited first gets the unsuffixed name.
alter table public.club_content disable trigger club_content_audit;
do $$
declare r record;
begin
 for r in select id from public.club_content where kind<>'members' and slug is null order by updated_at, id loop
  update public.club_content set slug=null where id=r.id;
 end loop;
end;$$;
alter table public.club_content enable trigger club_content_audit;

commit;
