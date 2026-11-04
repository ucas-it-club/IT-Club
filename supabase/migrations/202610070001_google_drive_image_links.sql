-- News and events now store public Google Drive image links separately from
-- legacy Supabase Storage media. Existing image arrays remain valid so the
-- transition does not break published content.
begin;
create or replace function club_private.valid_content(k text,d jsonb) returns boolean language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(d)<>'object' or not club_private.valid_text(d,'title',2,200) or not club_private.valid_text(d,'title_en',2,200) or not club_private.valid_text(d,'description',2,20000) or not club_private.valid_text(d,'description_en',2,20000) then return false; end if;
 if jsonb_typeof(d->'images') is distinct from 'array' then return false; end if;
 if jsonb_array_length(d->'images')>20 then return false; end if;
 if exists(select 1 from jsonb_object_keys(d) a where a not in ('title','title_en','description','description_en','images','driveImageUrls','category','year','technologies','memberIds','role','role_en','committee','gender','displayOrder','isFounder','date','status','eventTime','durationMinutes','eventType','eventType_en','presenterName','presenterName_en','presenterBio','presenterBio_en','eventRegistration','partnershipType','partnershipType_en','websiteUrl','githubUrl','linkedinUrl','demoUrl','apkUrl','summary','summary_en')) then return false; end if;
 if d ? 'driveImageUrls' then
  if k not in ('events','news') or jsonb_typeof(d->'driveImageUrls') is distinct from 'array' or jsonb_array_length(d->'driveImageUrls') > 20 then return false; end if;
  if exists(
   select 1 from jsonb_array_elements(d->'driveImageUrls') image(value)
   where jsonb_typeof(image.value) <> 'string'
    or length(image.value #>> '{}') > 500
    or (image.value #>> '{}') !~ '^https://drive[.]google[.]com/thumbnail[?]id=[A-Za-z0-9_-]{10,}&sz=w2000$'
  ) then return false; end if;
 end if;
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
 if d ?| array['eventTime','durationMinutes','eventType','eventType_en','presenterName','presenterName_en','presenterBio','presenterBio_en'] then
  if k <> 'events' then return false; end if;
  if jsonb_typeof(d->'eventTime') is distinct from 'string' or coalesce(d->>'eventTime','') !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then return false; end if;
  if jsonb_typeof(d->'durationMinutes') is distinct from 'number' or (d->>'durationMinutes')::numeric not between 1 and 1440 or trunc((d->>'durationMinutes')::numeric) <> (d->>'durationMinutes')::numeric then return false; end if;
  if not club_private.valid_text(d,'eventType',2,100) or not club_private.valid_text(d,'eventType_en',2,100) then return false; end if;
  if not club_private.valid_text(d,'presenterName',2,200) or not club_private.valid_text(d,'presenterName_en',2,200) then return false; end if;
  if not club_private.valid_text(d,'presenterBio',2,500) or not club_private.valid_text(d,'presenterBio_en',2,500) then return false; end if;
 end if;
 if d ? 'eventRegistration' then
  if k <> 'events' or jsonb_typeof(d->'eventRegistration') is distinct from 'object' then return false; end if;
  if exists(select 1 from jsonb_object_keys(d->'eventRegistration') a where a not in ('enabled','nameEnabled','phoneEnabled','attendanceEnabled')) then return false; end if;
  if jsonb_typeof(d->'eventRegistration'->'enabled') is distinct from 'boolean' or jsonb_typeof(d->'eventRegistration'->'nameEnabled') is distinct from 'boolean' or jsonb_typeof(d->'eventRegistration'->'phoneEnabled') is distinct from 'boolean' or jsonb_typeof(d->'eventRegistration'->'attendanceEnabled') is distinct from 'boolean' then return false; end if;
 end if;
 if d ? 'summary' and (k not in ('events','news') or not club_private.valid_text(d,'summary',1,300)) then return false;end if;
 if d ? 'summary_en' and (k not in ('events','news') or not club_private.valid_text(d,'summary_en',1,300)) then return false;end if;
 return true;
end;$$;
commit;
