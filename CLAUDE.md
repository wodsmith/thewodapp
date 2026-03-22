# Before starting work

- Run `lat search` to find sections relevant to your task. Read them to understand the design intent before writing code.
- Run `lat expand` on user prompts to expand any `[[refs]]` — this resolves section names to file locations and provides context.

# Post-task checklist (REQUIRED — do not skip)

After EVERY task, before responding to the user:

- [ ] Update `lat.md/` if you added or changed any functionality, architecture, tests, or behavior
- [ ] Run `lat check` — all wiki links and code refs must pass
- [ ] Do not skip these steps. Do not consider your task done until both are complete.

---

# What is lat.md?

This project uses [lat.md](https://www.npmjs.com/package/lat.md) to maintain a structured knowledge graph of its architecture, design decisions, and test specs in the `lat.md/` directory. It is a set of cross-linked markdown files that describe **what** this project does and **why** — the domain concepts, key design decisions, business logic, and test specifications. Use it to ground your work in the actual architecture rather than guessing.

## Development Commands (wodsmith-start)

Run these from `apps/wodsmith-start/`:

### Build and Development

- `pnpm dev` - Start development server
- `pnpm build` - Build TanStack Start application
- `pnpm preview` - Preview production build with Cloudflare

### Code Quality

- `pnpm lint` - Run Biome linter
- `pnpm format` - Format code with Biome
- `pnpm check` - Run Biome check (lint + format)
- `pnpm type-check` - Run TypeScript type checking

### Database Operations

- `pnpm db:push` - Push schema changes to PlanetScale dev branch (use during development)
- `pnpm db:generate --name=X` - Generate migration (only before merging to main)
- `pnpm db:studio` - Open Drizzle Studio
- `pnpm db:migrate:local` - Apply migrations locally

### Testing

- `pnpm test` - Run all tests with Vitest (single run mode)
- Test files are located in `test/` directory

### Cloudflare

- `pnpm cf-typegen` - Generate Cloudflare types (run after wrangler.jsonc changes)
- `npx alchemy deploy` - Deploy using Alchemy IaC
- `pnpm alchemy:dev` - Deploy local dev environment with Alchemy (required after changing env vars in `.dev.vars`)

## Architecture Overview (wodsmith-start)

### Tech Stack

- **Framework**: TanStack Start (React 19, TypeScript, Vinxi/Vite)
- **Database**: PlanetScale (MySQL) with Drizzle ORM via Hyperdrive
- **Authentication**: Custom auth with KV sessions
- **Deployment**: Cloudflare Workers via Alchemy IaC
- **UI**: Tailwind CSS, Shadcn UI, Radix primitives
- **State**: Zustand (client), TanStack Router loaders (server)
- **API**: TanStack Start server functions (`createServerFn`)

### Project Structure (wodsmith-start)

```
apps/wodsmith-start/src/
├── routes/                 # TanStack Router file-based routes
│   ├── api/               # API routes (server handlers)
│   └── compete/           # Competition features
├── components/            # React components
├── db/                    # Database schema and migrations
│   ├── schema.ts          # Main schema exports
│   └── migrations/        # Auto-generated migrations
├── server/                # Server-only business logic
├── server-fns/            # Server functions (createServerFn)
├── lib/                   # Shared utilities
│   ├── env.ts             # Server-only env access (getAppUrl, etc.)
│   └── stripe.ts          # Server-only Stripe client
├── utils/                 # Shared utilities
├── state/                 # Client state (Zustand)
└── schemas/               # Zod validation schemas
```

### Multi-Tenancy

- Team-based data isolation with `teamId` filtering
- Role-based permissions (admin, member roles)
- Team switching via team-switcher component
- All database operations must include team context

### Series Event Templates

Series event templates let organizers define events once for a competition series, then sync them to all child competitions.

**Capabilities:**

- Template creation (copy from existing competition or start from scratch)
- Full CRUD on template events with drag-and-drop reorder
- Parent/child sub-event hierarchy
- Division-specific scaling descriptions per event
- Movement selection per event
- Event resources (links/URLs) and judging sheets (PDF uploads)
- Sync to competitions with preview dialog showing diffs
- Event matching (mapping competition events to template events for leaderboard scoring)
- Selective event syncing when creating new competitions
- Leaderboard warnings for unmatched competitions

**Key files:**

- `src/server-fns/series-event-template-fns.ts` — Server functions for CRUD, sync, matching, preview
- `src/components/series/event-template-creator.tsx` — "Copy from competition" / "Start from scratch" flow
- `src/components/series/series-template-event-editor.tsx` — Drag-and-drop event list with inline division editing
- `src/components/series/series-event-sync-dialog.tsx` — Two-step sync dialog (select competitions, preview, confirm)
- `src/components/series-event-mapper.tsx` — Event matching matrix (competition events to template events)
- `src/routes/compete/organizer/_dashboard/series/$groupId/events/` — Events list + layout route
- `src/routes/compete/organizer/_dashboard/series/$groupId/events/$eventId.tsx` — Full event edit page (standalone + parent/child)
- `src/routes/compete/organizer/_dashboard/series/$groupId/event-mappings.tsx` — Event matching page

**What syncs:**

When "Sync to Competitions" is triggered, the following are synced for each mapped template event:

- Workout fields: name, description, scheme, scoreType, timeCap, repsPerRound, tiebreakScheme
- Track workout fields: pointsMultiplier, notes, trackOrder, parentEventId
- Division descriptions (via `series_division_mappings`)
- Movements (delete all + re-insert)
- Event resources (additive, deduplicated by title match)
- Judging sheets (additive, deduplicated by title match)

**Database tables:**

- `programming_tracks` — Template track (type: `"series-template"`)
- `track_workouts` — Template events on the template track
- `workouts` — Workout data for each template event
- `series_event_mappings` — Maps template events to competition events
- `workout_scaling_descriptions` — Per-division descriptions
- `workout_movements` — Movement associations
- `event_resources` — Event resource links
- `event_judging_sheets` — Judging sheet PDFs

**Key patterns:**

- Template track ID stored in `competition_groups.settings` JSON as `templateTrackId`
- Sync is additive for resources/sheets (deduplicated by title match)
- Sync replaces movements (delete all + re-insert)
- Division descriptions sync through `series_division_mappings` (template div to competition div)
- `templateEventIds` filter on sync allows selective event syncing
- Auto-includes parent events when child events are selected for sync

### Database Schema

Database is modularly structured in `src/db/schemas/`:

- `users.ts` - User accounts and authentication
- `teams.ts` - Team/organization management
- `workouts.ts` - Workout management system
- `programming.ts` - Programming tracks and scheduling
- `billing.ts` - Credit billing system
- `scaling.ts` - Workout scaling options
- `scheduling.ts` - Schedule templates and scheduling
- Main schema exports from `src/db/schema.ts`

## Development Guidelines

### Code Style

- Use TypeScript everywhere, prefer interfaces over types
- Functional components, avoid classes
- Server Components by default, `use client` only when necessary
- Add `import "server-only"` to server-only files (except page.tsx)
- Use semantic commit messages: `feat:`, `fix:`, `chore:`
- Use `pnpm` as package manager

### Database

- **Local development**: Use `pnpm db:push` to apply schema changes directly (no migration files)
- **Before merging**: Generate migrations with `pnpm db:generate --name=feature-name`
- **Never write SQL migrations manually** - always use drizzle-kit
- Use `db.transaction()` when multiple writes need to be atomic (PlanetScale supports transactions)
- Never pass `id` when inserting (auto-generated with CUID2)
- Always filter by `teamId` for multi-tenant data
- Use helper functions in `src/server/` for business logic
- Use standard Drizzle queries with `inArray()` directly — PlanetScale has no restrictive parameter limits

### Authentication & Authorization

- Session handling: `getSessionFromCookie()` for server components
- Client session: `useSession()` from `src/utils/auth-client.ts`
- Team authorization utilities in `src/utils/team-auth.ts`
- Protect routes with team context validation
- When checking roles use available roles from `src/db/schemas/teams.ts`

### State Management

- Server state: React Server Components
- Client state: Zustand stores in `src/state/`
- URL state: NUQS for search parameters
- Forms: React Hook Form with Zod validation

### API Patterns

- Server functions with TanStack Start: `createServerFn` (see below)
- Named object parameters for functions with >1 parameter
- Consistent error handling with proper HTTP status codes
- Rate limiting on auth endpoints

### TanStack Start Server Functions (wodsmith-start)

#### Environment Variables

**ALWAYS** use `env` from `cloudflare:workers` - never use `process.env`:

```typescript
import {env} from 'cloudflare:workers'

env.HYPERDRIVE // PlanetScale via Hyperdrive
env.KV_SESSION // KV namespace binding
env.APP_URL // Environment variable
env.STRIPE_SECRET_KEY // Secret
```

**TypeScript not recognizing env vars?** If you've added new bindings in `alchemy.run.ts` and deployed with `pnpm alchemy:dev`, but TypeScript doesn't see them, run:

```bash
lat locate "Section Name"      # find a section by name (exact, fuzzy)
lat refs "file#Section"        # find what references a section
lat search "natural language"  # semantic search across all sections
lat expand "user prompt text"  # expand [[refs]] to resolved locations
lat check                      # validate all links and code refs
```

Run `lat --help` when in doubt about available commands or options.

If `lat search` fails because no API key is configured, explain to the user that semantic search requires a key provided via `LAT_LLM_KEY` (direct value), `LAT_LLM_KEY_FILE` (path to key file), or `LAT_LLM_KEY_HELPER` (command that prints the key). Supported key prefixes: `sk-...` (OpenAI) or `vck_...` (Vercel). If the user doesn't want to set it up, use `lat locate` for direct lookups instead.

# Syntax primer

- **Section ids**: `lat.md/path/to/file#Heading#SubHeading` — full form uses project-root-relative path (e.g. `lat.md/tests/search#RAG Replay Tests`). Short form uses bare file name when unique (e.g. `search#RAG Replay Tests`, `cli#search#Indexing`).
- **Wiki links**: `[[target]]` or `[[target|alias]]` — cross-references between sections. Can also reference source code: `[[src/foo.ts#myFunction]]`.
- **Source code links**: Wiki links in `lat.md/` files can reference functions, classes, constants, and methods in TypeScript/JavaScript/Python/Rust/Go/C files. Use the full path: `[[src/config.ts#getConfigDir]]`, `[[src/server.ts#App#listen]]` (class method), `[[lib/utils.py#parse_args]]`, `[[src/lib.rs#Greeter#greet]]` (Rust impl method), `[[src/app.go#Greeter#Greet]]` (Go method), `[[src/app.h#Greeter]]` (C struct). `lat check` validates these exist.
- **Code refs**: `// @lat: [[section-id]]` (JS/TS/Rust/Go/C) or `# @lat: [[section-id]]` (Python) — ties source code to concepts

# Test specs

Key tests can be described as sections in `lat.md/` files (e.g. `tests.md`). Add frontmatter to require that every leaf section is referenced by a `// @lat:` or `# @lat:` comment in test code:

```markdown
---
lat:
  require-code-mention: true
---
# Tests

Authentication and authorization test specifications.

## User login

Verify credential validation and error handling for the login endpoint.

### Rejects expired tokens
Tokens past their expiry timestamp are rejected with 401, even if otherwise valid.

### Handles missing password
Login request without a password field returns 400 with a descriptive error.
```

Every section MUST have a description — at least one sentence explaining what the test verifies and why. Empty sections with just a heading are not acceptable. (This is a specific case of the general leading paragraph rule below.)

Each test in code should reference its spec with exactly one comment placed next to the relevant test — not at the top of the file:

```python
# @lat: [[tests#User login#Rejects expired tokens]]
def test_rejects_expired_tokens():
    ...

# @lat: [[tests#User login#Handles missing password]]
def test_handles_missing_password():
    ...
```

Do not duplicate refs. One `@lat:` comment per spec section, placed at the test that covers it. `lat check` will flag any spec section not covered by a code reference, and any code reference pointing to a nonexistent section.

# Section structure

Every section in `lat.md/` **must** have a leading paragraph — at least one sentence immediately after the heading, before any child headings or other block content. The first paragraph must be ≤250 characters (excluding `[[wiki link]]` content). This paragraph serves as the section's overview and is used in search results, command output, and RAG context — keeping it concise guarantees the section's essence is always captured.

```markdown
# Good Section

Brief overview of what this section documents and why it matters.

More detail can go in subsequent paragraphs, code blocks, or lists.

## Child heading

Details about this child topic.
```

```markdown
# Bad Section

## Child heading

Details about this child topic.
```

The second example is invalid because `Bad Section` has no leading paragraph. `lat check` validates this rule and reports errors for missing or overly long leading paragraphs.
