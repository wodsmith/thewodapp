# Team Memory — Agent Onboarding Guide

This guide gets a new teammate connected to the shared team-memory system. The Worker, D1 database, and Vectorize index are already deployed — you just need local tooling and hook configuration.

## What Is This?

Team Memory is a Cloudflare Worker that stores reusable knowledge from AI coding sessions — gotchas, conventions, debugging tips, architecture decisions. It uses:

- **Cloudflare D1** (SQLite) for structured storage
- **Cloudflare Vectorize** for semantic search (cosine similarity, 384-dim embeddings)
- **Workers AI** for generating embeddings and condensing observations into reflections
- **Hono** as the HTTP framework
- **Drizzle ORM** for database access

Observations flow through a lifecycle: raw input → dedup → store → daily reflection → weekly decay.

**Production URL:** `https://team-memory.zacjones93.workers.dev`

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 18+ | `node --version` |
| pnpm | latest | `pnpm --version` |
| Bun | latest | `bun --version` |
| Claude Code CLI | latest | `claude --version` |

Install any missing tools:

```bash
# pnpm
corepack enable && corepack prepare pnpm@latest --activate

# bun
curl -fsSL https://bun.sh/install | bash
```

## Step 1: Install Dependencies

```bash
# From the monorepo root
pnpm install

# Install skill script deps
cd .claude/skills/team-memory/scripts
bun install
cd -
```

## Step 2: Verify Connectivity

The Worker is already deployed. Confirm you can reach it:

```bash
curl https://team-memory.zacjones93.workers.dev/health
# → {"status":"ok"}
```

If this fails, check your network/VPN. The Worker is public.

## Step 3: Test the Skills

### Store a test observation

```bash
TEAM_MEMORY_URL=https://team-memory.zacjones93.workers.dev \
  bun run .claude/skills/team-memory/scripts/remember.ts \
  "Test observation from onboarding" --category=workflow --priority=ephemeral
```

### Search for it

```bash
TEAM_MEMORY_URL=https://team-memory.zacjones93.workers.dev \
  bun run .claude/skills/team-memory/scripts/recall.ts "onboarding test"
```

### Give feedback

```bash
TEAM_MEMORY_URL=https://team-memory.zacjones93.workers.dev \
  bun run .claude/skills/team-memory/scripts/feedback.ts <returned-id> helpful
```

If all three work, you're connected.

## Step 4: Confirm Claude Code Hooks

The hooks are already configured in `.claude/settings.json` (checked into the repo). They fire automatically:

| Hook | Trigger | What it does |
|------|---------|-------------|
| **SessionStart** | New Claude Code session | Injects context about the memory system, prompting the agent to `/recall` relevant memories |
| **SessionEnd** | Session closes | Reads transcript JSONL, POSTs messages to `/sessions`, spawns a background Sonnet agent to extract observations |

Start a new Claude Code session in this repo and confirm you see "Team Memory System" context in the session start output. That means the hooks are wired correctly.

> **Note:** The SessionEnd hook spawns `claude -p` as a child process to extract observations. Ensure `claude` is on your `$PATH`.

## Using the Memory System

### As a Claude Code Agent

The system works automatically via hooks + skills:

- **Session start** — you'll see injected context reminding you about `/recall` and `/remember`
- **`/recall "<query>"`** — search memories before starting a task
- **`/remember`** — save a gotcha, convention, or debugging insight you discovered
- **`/feedback <id> <signal>`** — rate a memory as `helpful`, `harmful`, or `irrelevant`
- **Session end** — transcript is automatically analyzed and observations are extracted

### When to Use

- **Before starting work:** `/recall` to check for relevant prior knowledge
- **After discovering a gotcha:** `/remember` to save it for future sessions
- **After solving a tricky bug:** `/remember` the solution pattern
- **When a recalled memory was wrong or outdated:** `/feedback <id> harmful`

### Direct API Access

You can also hit the API directly:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/health` | Health check |
| `POST` | `/observations` | Store observation. Body: `{content, category, priority, userId?, sessionId?}` |
| `GET` | `/search?q=<query>` | Semantic search. Params: `category`, `priority`, `limit` |
| `GET` | `/context` | Top memories by score. Params: `category`, `priority`, `limit` |
| `GET` | `/export?scoreThreshold=0.5` | Export as markdown |
| `POST` | `/feedback` | Rate memory. Body: `{id, signal, note?}` |
| `POST` | `/sessions` | Store session transcript. Body: `{userId?, messages: [{role, content}], metadata?}` |

Base URL: `https://team-memory.zacjones93.workers.dev`

## Key Concepts

### Observation Lifecycle

```
Raw observation → Dedup (Jaccard similarity) → Store in D1 + embed in Vectorize
                                                       ↓
                         Daily cron: condense into Reflections (via Workers AI)
                                                       ↓
                         Weekly cron: exponential decay + deprecate harmful
```

### Maturity Levels

| Level | Meaning | How it gets there |
|-------|---------|-------------------|
| `candidate` | New, unverified | Default for all new observations |
| `established` | Confirmed useful | Multiple `helpful` feedback signals |
| `proven` | Core knowledge | Sustained positive feedback over time |
| `deprecated` | Stale or harmful | Net-harmful feedback or score below threshold |

### Scoring

- Starts at **1.0**
- `helpful` feedback → score boost
- `harmful` / `irrelevant` → score reduction
- Weekly exponential decay lowers scores over time
- Retrieval count tracked per memory

### Categories & Priorities

**Categories:** `convention` · `gotcha` · `debugging` · `architecture` · `workflow`

**Priorities:** `critical` (cost real time/pain) · `moderate` (useful to know) · `ephemeral` (minor tip)

## Developing the Worker

Only needed if you're modifying the team-memory Worker itself (not just using it).

### Local Dev Environment

Ask the team lead for Cloudflare credentials, then create `apps/team-memory/.env`:

```
CLOUDFLARE_ACCOUNT_ID=<ask-team-lead>
CLOUDFLARE_API_TOKEN=<ask-team-lead>
```

> `.env` is gitignored — never commit secrets.

### Run Locally

```bash
cd apps/team-memory
pnpm dev
```

Starts `wrangler dev --remote` at `http://localhost:8787`. The `--remote` flag is required — Vectorize and AI bindings only work against deployed Cloudflare resources.

### Push Schema Changes

```bash
cd apps/team-memory
pnpm db:push
```

### Deploy

```bash
cd apps/team-memory
pnpm deploy
```

## Project Structure

```
apps/team-memory/
├── src/
│   ├── index.ts              # Hono app entrypoint + scheduled handler
│   ├── types.ts              # Env bindings (DB, VECTORIZE, AI)
│   ├── db/
│   │   ├── schema.ts         # Drizzle tables: observations, reflections, sessions, session_messages
│   │   └── index.ts          # getDb() helper
│   ├── routes/
│   │   ├── observations.ts   # POST /observations — store + dedup + embed
│   │   ├── search.ts         # GET /search — semantic search via Vectorize
│   │   ├── context.ts        # GET /context — top memories by score
│   │   ├── feedback.ts       # POST /feedback — rate memories
│   │   ├── sessions.ts       # POST /sessions — store session transcripts
│   │   ├── export.ts         # GET /export — markdown export of core memories
│   │   └── cron.ts           # Scheduled handler (daily reflection + weekly decay)
│   └── services/
│       ├── observation.ts    # CRUD for observations
│       ├── search.ts         # Vectorize query logic
│       ├── context.ts        # Top-N memory retrieval
│       ├── feedback.ts       # Score adjustments + maturity promotion
│       ├── session.ts        # Session + message storage
│       ├── export.ts         # Markdown export builder
│       ├── embedding.ts      # Workers AI embedding generation
│       ├── dedup.ts          # Jaccard similarity deduplication
│       ├── scoring.ts        # Score computation
│       ├── maturity.ts       # Maturity lifecycle
│       ├── reflection.ts     # Daily cron: condense observations via AI
│       └── decay.ts          # Weekly cron: exponential score decay
├── wrangler.jsonc            # Cloudflare bindings (D1, Vectorize, AI, crons)
├── drizzle.config.ts         # Drizzle Kit config (d1-http driver)
├── package.json
└── biome.json

.claude/skills/team-memory/
├── SKILL.md                  # Skill definition (triggers /remember, /recall, /feedback)
└── scripts/
    ├── remember.ts           # CLI: store observation
    ├── recall.ts             # CLI: semantic search
    ├── feedback.ts           # CLI: rate a memory
    ├── session-start-hook.ts # Hook: inject memory context on session start
    ├── session-end-hook.ts   # Hook: extract + store session observations
    ├── export-hook.ts        # Hook: sync memories to MEMORY.md
    └── package.json          # Script deps (@types/bun)
```

## Troubleshooting

### Skill scripts fail with "Cannot find module"

Run `bun install` inside `.claude/skills/team-memory/scripts/`.

### SessionEnd hook doesn't extract observations

The hook spawns `claude -p` as a child process. Ensure `claude` (Claude Code CLI) is on your `$PATH`. Check stderr — the hook logs to stderr, not stdout.

### Search returns no results right after storing

Embedding generation is async. Wait a few seconds, then retry.

### "Vectorize binding not found" during local dev

You must use `pnpm dev` (which runs `--remote`). Vectorize doesn't work with purely local Wrangler.

### `drizzle-kit push` fails with auth errors

Ensure `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are set in `apps/team-memory/.env`. The token needs "Edit Cloudflare Workers" permissions.
