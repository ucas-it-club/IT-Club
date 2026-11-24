-- Issue #69: super admins and editors work through Site Feedback. They set the
-- Feedback status, record the GitHub issue an item became, and delete junk.
-- Same readers as before (club_private.is_editor); every other column stays read-only.
begin;

alter table public.club_feedback add column issue_url text
  check (issue_url ~ '^https://github[.]com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/issues/[0-9]+$');

grant update(status, issue_url), delete on public.club_feedback to authenticated;
create policy club_feedback_update on public.club_feedback for update to authenticated
 using(club_private.is_editor()) with check(club_private.is_editor());
create policy club_feedback_delete on public.club_feedback for delete to authenticated
 using(club_private.is_editor());

notify pgrst, 'reload schema';
commit;
