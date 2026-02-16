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
bun run .claude/skills/team-memory/scripts/remember.ts "<observation text>" [--category=<category>] [--priority=<priority>]
```

**Categories:** `convention`, `gotcha`, `debugging`, `architecture`, `workflow`
**Priorities:** `critical`, `moderate`, `ephemeral`

Defaults: category=convention, priority=moderate

Examples:
```bash
bun run .claude/skills/team-memory/scripts/remember.ts "PlanetScale returns strings for COUNT columns — always wrap with Number()" --category=gotcha --priority=critical
bun run .claude/skills/team-memory/scripts/remember.ts "Use ULID for ID generation, not CUID2" --category=convention
```

### /recall — Search memories

Search team memory by semantic query.

```bash
bun run .claude/skills/team-memory/scripts/recall.ts "<query>" [--limit=<n>] [--category=<category>] [--priority=<priority>]
```

Default limit: 5. Results are ranked by relevance.

Examples:
```bash
bun run .claude/skills/team-memory/scripts/recall.ts "database migration patterns"
bun run .claude/skills/team-memory/scripts/recall.ts "Stripe" --category=gotcha --limit=10
```

### /feedback — Rate a memory

Provide feedback on a memory's usefulness.

```bash
bun run .claude/skills/team-memory/scripts/feedback.ts <observation-id> <signal> [--note="<reason>"]
```

**Signals:** `helpful`, `harmful`, `irrelevant`

Examples:
```bash
bun run .claude/skills/team-memory/scripts/feedback.ts 01J5K3M2N7 helpful --note="Saved me from a production bug"
bun run .claude/skills/team-memory/scripts/feedback.ts 01J5K3M2N7 irrelevant
```

## Environment

Set `TEAM_MEMORY_URL` to point to the team-memory Worker. Defaults to `http://localhost:8787`.

## Hooks

- **SessionStart**: Automatically loads top memories as context via `/context`
- **SessionEnd**: Stub (future: post session summaries)
- **Export**: Syncs memories to MEMORY.md between `<!-- BEGIN TEAM-MEMORY -->` / `<!-- END TEAM-MEMORY -->` markers
