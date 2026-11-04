-- Optional short summary on news and events, used as the page's meta description
-- and link-preview text. Same function as 202609190001 plus the two keys.
begin;
create or replace function club_private.valid_content(k text,d jsonb) returns boolean language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(d)<>'object' or not club_private.valid_text(d,'title',2,200) or not club_private.valid_text(d,'title_en',2,200) or not club_private.valid_text(d,'description',2,20000) or not club_private.valid_text(d,'description_en',2,20000) then return false; end if;
 if jsonb_typeof(d->'images') is distinct from 'array' then return false; end if;
 if jsonb_array_length(d->'images')>20 then return false; end if;
 if exists(select 1 from jsonb_object_keys(d) a where a not in ('title','title_en','description','description_en','images','category','year','technologies','memberIds','role','role_en','committee','gender','displayOrder','isFounder','date','status','partnershipType','partnershipType_en','websiteUrl','githubUrl','linkedinUrl','demoUrl','apkUrl','summary','summary_en')) then return false; end if;
 if k='projects' then
  if coalesce(d->>'category','') not in ('web','mobile','games','multimedia') or jsonb_typeof(d->'year') is distinct from 'number' or (d->>'year')::numeric not between 2000 and 2100 or trunc((d->>'year')::numeric)<>(d->>'year')::numeric then return false; end if;
  if jsonb_typeof(d->'technologies') is distinct from 'array' or jsonb_typeof(d->'memberIds') is distinct from 'array' then return false; end if;
  if jsonb_array_length(d->'technologies')>50 or jsonb_array_length(d->'memberIds')>100 then return false;end if;
 end if;
 if d ? 'displayOrder' then
  if k <> 'members' or jsonb_typeof(d->'displayOrder') is distinct from 'number' then return false; end if;
  if (d->>'displayOrder')::numeric not between 1 and 9999 or trunc((d->>'displayOrder')::numeric) <> (d->>'displayOrder')::numeric then return false; end if;
 end if;
 if d ? 'gender' and (k <> 'members' or jsonb_typeof(d->'gender') is distinct from 'string' or d->>'gender' not in ('male','female')) then return false; end if;
 if k='members' and (coalesce(d->>'committee','') not in ('media','relations','activities','development','administrative') or jsonb_typeof(d->'isFounder') is distinct from 'boolean') then return false;end if;
 if k in ('events','news','achievements') and coalesce(d->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then return false;end if;
 if k='events' and coalesce(d->>'status','') not in ('upcoming','past') then return false;end if;
 if d ? 'summary' and (k not in ('events','news') or not club_private.valid_text(d,'summary',1,300)) then return false;end if;
 if d ? 'summary_en' and (k not in ('events','news') or not club_private.valid_text(d,'summary_en',1,300)) then return false;end if;
 return true;
end;$$;
commit;
