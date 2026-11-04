# UCAS IT Club Platform

A web-based content management and administration platform for the IT Club, built with TypeScript and Supabase.

## Overview

The platform combines a bilingual public club website, an administration dashboard, a centralized media library, and Google Sheets-backed registration workflows.

The current application exposes:

```text
/                -> Public IT Club website (Arabic)
/en              -> Public IT Club website (English)
/news/<slug>     -> A news item by its readable name (same under /en)
/admin           -> Administration dashboard
/club/...        -> Old addresses, permanently redirected to the ones above
```

Supabase provides authentication, PostgreSQL data management, Row Level Security, and media storage.

## Features

### Public Platform

- Club information and configurable content.
- Members, events, news, and partners.
- Public media.
- Membership and event registration through Google Sheets.
- Social contact channels without storing contact messages.

### Administration

- Authenticated administration.
- Editor and super administrator roles.
- Content creation and editing.
- Club settings management.
- Submission management.
- Member and project management.

### Media Library

- JPG, PNG, and WebP uploads.
- Maximum upload size of 5 MB.
- Image compression and resizing.
- Search and rename.
- Reuse existing media across content.
- Track media usage.
- Prevent deletion of referenced images.

## Architecture

```text
Web Application (TanStack Start)
├── Public website (SSR + React Query)
│   └── Public PostgREST reads
├── Administration dashboard
│   └── Supabase Auth, PostgreSQL, RLS, and Storage
└── Registration workflows
    └── Google Apps Script and Google Sheets
```

## Data Model

| Table                                                                            | Responsibility                            |
| -------------------------------------------------------------------------------- | ----------------------------------------- |
| `club_members`                                                                   | Club members                              |
| `club_events`                                                                    | Events and registration configuration     |
| `club_news`                                                                      | News articles                             |
| `club_partners`                                                                  | Club partners                             |
| `club_settings`                                                                  | Official club text and links              |
| `club_visits`                                                                    | Privacy-preserving session visit count    |
| `club_admins`                                                                    | Editor and super administrator roles      |
| `club_media`                                                                     | Media library records                     |
| `club_member_media`, `club_event_media`, `club_news_media`, `club_partner_media` | Media relationships for each content type |

`club_submissions` remains in the original migration for legacy compatibility, but new membership and event registrations are stored in Google Sheets. It is not part of the current public workflow.

## Authorization

The security boundary is enforced at the PostgreSQL/Supabase layer.

Roles include `editor` and `super_admin`.

UI restrictions are complemented by Row Level Security so authorization does not depend only on hidden or disabled interface controls.

Public media is available to the club website, while media-library management requires an authorized account.

## Technology Stack

| Area                      | Technology                  |
| ------------------------- | --------------------------- |
| Language                  | TypeScript                  |
| Build Tool                | Vite                        |
| Runtime / Package Manager | Bun                         |
| Backend                   | Supabase                    |
| Database                  | PostgreSQL                  |
| Authentication            | Supabase Auth               |
| Authorization             | PostgreSQL RLS              |
| Storage                   | Supabase Storage            |
| Testing                   | Node test runner and PGlite |
| Formatting                | Prettier                    |
| Linting                   | ESLint                      |

## Environment Configuration

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Never place service-role keys, database passwords, or other private credentials in `VITE_*` variables or source control.

## Development

```bash
bun install --frozen-lockfile
bun run dev
bun run typecheck
bun run test
bun run lint
bun run build
bun run build:static
```

Run `bun run check` before merging to execute type checking, tests, linting, and the production build in sequence.

See [docs/architecture.md](docs/architecture.md) for runtime paths, module boundaries, and the maintenance checklist.

## Database Setup

The repository includes Supabase SQL migrations for the required schema, policies, storage configuration, and related functions.

Administrative users are created through Supabase Authentication and then assigned their platform role through the provided SQL setup.

Production credentials should remain outside the repository.

## Testing

PGlite-based tests cover database-oriented behavior including visitor access, authenticated users, editor and administrator permissions, submission privacy, validation, role revocation, and media/content relationships.

Local database tests do not replace verification against a real Supabase deployment.

## Deployment

Before deployment:

1. Configure the required `VITE_SUPABASE_*` variables.
2. Apply every migration in `supabase/migrations` to the intended Supabase project, in filename order.
3. Configure administrative accounts.
4. Deploy and configure the current Google Apps Script integration.
5. Verify RLS policies.
6. Test authentication, media uploads, content editing, membership registration, and event registration.
7. Build the application for the selected hosting platform.

Do not commit `.env.local` or production secrets.

## What This Project Demonstrates

- TypeScript web application development.
- Supabase integration.
- PostgreSQL schema design.
- Row Level Security.
- Authentication and role-based authorization.
- Storage and media workflows.
- Database validation.
- Automated database-oriented testing.
- Administration dashboard development.
- Translating organizational requirements into a working system.

## Contributing

1. Fork the repository.
2. Create a focused branch.
3. Configure a local development environment.
4. Implement and test the change.
5. Run type checking, tests, and a production build.
6. Open a pull request describing the change and any database migration impact.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Author

Hala Dalloul

GitHub: https://github.com/hala-dalloul
