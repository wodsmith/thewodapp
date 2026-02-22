---
name: team-memory
description: Store, search, and manage team memory from AI coding sessions. Use /remember to save observations (conventions, gotchas, debugging tips, architecture decisions, workflows). Use /recall to search memories by semantic query. Use /feedback to rate memory quality (helpful/harmful/irrelevant). Triggers on any request to save, recall, search, or rate team knowledge.
---

# Team Memory

Manage a shared team memory system backed by a Cloudflare Worker with semantic search.

## Commands

### /remember — Store an observation

Save a new observation to team memory.

```bash
TEAM_MEMORY_URL=https://team-memory.zacjones93.workers.dev TEAM_MEMORY_TOKEN=$TEAM_MEMORY_TOKEN bun run .claude/skills/team-memory/scripts/remember.ts "<observation text>" [--category=<category>] [--priority=<priority>]
```

**Categories:** `convention`, `gotcha`, `debugging`, `architecture`, `workflow`
**Priorities:** `critical`, `moderate`, `ephemeral`

Defaults: category=convention, priority=moderate

Examples:
```bash
TEAM_MEMORY_URL=https://team-memory.zacjones93.workers.dev TEAM_MEMORY_TOKEN=$TEAM_MEMORY_TOKEN bun run .claude/skills/team-memory/scripts/remember.ts "PlanetScale returns strings for COUNT columns — always wrap with Number()" --category=gotcha --priority=critical
TEAM_MEMORY_URL=https://team-memory.zacjones93.workers.dev TEAM_MEMORY_TOKEN=$TEAM_MEMORY_TOKEN bun run .claude/skills/team-memory/scripts/remember.ts "Use ULID for ID generation, not CUID2" --category=convention
```

### /recall — Search memories

Search team memory by semantic query.

```bash
TEAM_MEMORY_URL=https://team-memory.zacjones93.workers.dev TEAM_MEMORY_TOKEN=$TEAM_MEMORY_TOKEN bun run .claude/skills/team-memory/scripts/recall.ts "<query>" [--limit=<n>] [--category=<category>] [--priority=<priority>]
```

Default limit: 5. Results are ranked by relevance.

Examples:
```bash
TEAM_MEMORY_URL=https://team-memory.zacjones93.workers.dev TEAM_MEMORY_TOKEN=$TEAM_MEMORY_TOKEN bun run .claude/skills/team-memory/scripts/recall.ts "database migration patterns"
TEAM_MEMORY_URL=https://team-memory.zacjones93.workers.dev TEAM_MEMORY_TOKEN=$TEAM_MEMORY_TOKEN bun run .claude/skills/team-memory/scripts/recall.ts "Stripe" --category=gotcha --limit=10
```

### /feedback — Rate a memory

Provide feedback on a memory's usefulness.

```bash
TEAM_MEMORY_URL=https://team-memory.zacjones93.workers.dev TEAM_MEMORY_TOKEN=$TEAM_MEMORY_TOKEN bun run .claude/skills/team-memory/scripts/feedback.ts <observation-id> <signal> [--note="<reason>"]
```

**Signals:** `helpful`, `harmful`, `irrelevant`

Examples:
```bash
TEAM_MEMORY_URL=https://team-memory.zacjones93.workers.dev TEAM_MEMORY_TOKEN=$TEAM_MEMORY_TOKEN bun run .claude/skills/team-memory/scripts/feedback.ts 01J5K3M2N7 helpful --note="Saved me from a production bug"
TEAM_MEMORY_URL=https://team-memory.zacjones93.workers.dev TEAM_MEMORY_TOKEN=$TEAM_MEMORY_TOKEN bun run .claude/skills/team-memory/scripts/feedback.ts 01J5K3M2N7 irrelevant
```

## Environment

Production URL: `https://team-memory.zacjones93.workers.dev`

### Required Environment Variables

- `TEAM_MEMORY_URL` - Worker URL (production: `https://team-memory.zacjones93.workers.dev`)
- `TEAM_MEMORY_TOKEN` - Bearer token for API authentication. Must match the `API_TOKEN` secret configured on the Cloudflare Worker.

Both env vars must be set for all commands. If they're already exported in your shell profile, the inline prefixes are optional.

### Setting the token

The API token is stored as a Cloudflare Workers secret. To set or rotate:

```bash
cd apps/team-memory
npx wrangler secret put API_TOKEN
```

Then set `TEAM_MEMORY_TOKEN` in your shell profile to the same value.

## Hooks

- **SessionStart**: Reminds the agent about the memory system and how to use /recall for task-relevant lookups
- **SessionEnd**: Reads transcript JSONL, extracts user/assistant messages, POSTs to `/sessions` (requires `TEAM_MEMORY_TOKEN`)
- **Export**: Syncs memories to MEMORY.md between `<!-- BEGIN TEAM-MEMORY -->` / `<!-- END TEAM-MEMORY -->` markers (requires `TEAM_MEMORY_TOKEN`)
