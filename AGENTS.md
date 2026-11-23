<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Supabase production

Change the production database only through migration files in
`supabase/migrations`, merged to `master`. The `Deploy Supabase` workflow applies
them (see `docs/supabase-deploy.md`). Never change production schema, policies,
functions or Edge Functions from the Supabase dashboard, the SQL editor or an MCP
connection: that puts the migration history out of step with the repo and breaks
the next deploy. Never edit a migration file that has already run; fix forward
with a new one.
