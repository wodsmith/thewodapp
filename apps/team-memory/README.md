# Team Memory

A shared team memory system for AI coding sessions, built on Cloudflare Workers with D1 (SQLite), Vectorize (semantic search), and Workers AI (embeddings + reflection).

Observations from coding sessions are stored, deduplicated, and searchable by semantic similarity. A daily cron condenses raw observations into reflections; a weekly cron decays stale memories and deprecates harmful ones.

## Prerequisites

- Cloudflare account with Workers, D1, Vectorize, and Workers AI enabled
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) v4+
- Node.js 18+ and pnpm
- bun (for running Claude Code skill scripts)

## Setup

1. **Create the D1 database:**

   ```bash
   wrangler d1 create team-memory-db
   ```

   Copy the returned `database_id` into `wrangler.jsonc` under `d1_databases[0].database_id`.

2. **Create the Vectorize index:**

   ```bash
   wrangler vectorize create team-memory-embeddings --dimensions=384 --metric=cosine
   ```

   The index name must match `vectorize[0].index_name` in `wrangler.jsonc`.

3. **Install dependencies:**

   ```bash
   pnpm install
   ```

4. **Push the database schema:**

   ```bash
   pnpm db:push
   ```

   This creates 4 tables: `observations`, `reflections`, `sessions`, `session_messages`.

## Development

```bash
pnpm dev
```

Starts a local dev server at `http://localhost:8787`. D1 uses a local SQLite file; Vectorize and AI bindings require `--remote` flag or deployed resources.

## Deployment

```bash
pnpm deploy
```

Runs `wrangler deploy --minify`. Ensure `database_id` in `wrangler.jsonc` is set to your production D1 database.

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check. Returns `{"status": "ok"}`. |
| `POST` | `/observations` | Store an observation. Body: `{content, category, priority, userId?, sessionId?}`. Deduplicates via Jaccard similarity. Returns 201 or 409 if duplicate. |
| `GET` | `/search?q=<query>` | Semantic search. Optional params: `category`, `priority`, `limit` (default 10). Returns ranked results. |
| `GET` | `/context` | Top memories by score. Optional params: `category`, `priority`, `limit`. Used by session-start hook. |
| `GET` | `/export?scoreThreshold=0.5` | Export core memories as Markdown. Filters by minimum score (default 0.5). |
| `POST` | `/feedback` | Rate a memory. Body: `{id, signal, note?}`. Signals: `helpful`, `harmful`, `irrelevant`. Updates score and checks maturity promotion. |
| `POST` | `/sessions` | Store session messages. Body: `{userId?, messages: [{role, content}], metadata?}`. Returns 201. |

**Categories:** `convention`, `gotcha`, `debugging`, `architecture`, `workflow`
**Priorities:** `critical`, `moderate`, `ephemeral`

## Cron Jobs

Configured in `wrangler.jsonc` under `triggers.crons`:

| Schedule | Description |
|----------|-------------|
| `0 6 * * *` | **Daily reflection** -- Condenses uncondensed observations into reflections using Workers AI, deduplicates, and stores with embeddings. |
| `0 7 * * 0` | **Weekly decay** -- Applies exponential score decay to all memories and deprecates those with net-harmful feedback. |

## Claude Code Integration

### Environment

Set `TEAM_MEMORY_URL` to point to the deployed Worker. Defaults to `http://localhost:8787`.

### Skills

Defined in `.claude/skills/team-memory/SKILL.md`:

- `/remember` -- Store an observation: `bun run .claude/skills/team-memory/scripts/remember.ts "<text>" --category=<cat> --priority=<pri>`
- `/recall` -- Search memories: `bun run .claude/skills/team-memory/scripts/recall.ts "<query>" --limit=5`
- `/feedback` -- Rate a memory: `bun run .claude/skills/team-memory/scripts/feedback.ts <id> <signal>`

### Hooks

- **SessionStart** -- Loads top memories via `GET /context` and injects as context
- **SessionEnd** -- Stub for future session summary posting
- **Export** -- Syncs memories to `MEMORY.md` between `<!-- BEGIN TEAM-MEMORY -->` / `<!-- END TEAM-MEMORY -->` markers

## Architecture

```
Observation (raw input)
    |
    v
Dedup (Jaccard) --> Store in D1 + embed in Vectorize
    |
    v
Daily cron: Condense observations --> Reflections (via Workers AI)
    |
    v
Weekly cron: Exponential decay + deprecate harmful
```

**Tables:** `observations` (raw memories), `reflections` (condensed insights), `sessions` (coding session records), `session_messages` (per-message logs).

**Maturity lifecycle:** candidate --> established --> proven --> deprecated. Promotion is driven by feedback signals.

**Scoring:** Starts at 1.0. Boosted by `helpful` feedback, reduced by `harmful`/`irrelevant`. Weekly exponential decay lowers scores over time. Retrieval count is tracked per memory.
