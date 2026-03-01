# Session Context

## User Prompts

### Prompt 1

@apps/wodsmith-start/src/components/competition-workout-card.tsx we need to add submission cta for athletes that are signed in so instead of seeing 'details' button they should see "submit score" on the workout card

### Prompt 2

Base directory for this skill: /Users/zacjones/Documents/02.Areas/wodsmith/thewodapp-2/.claude/skills/team-memory

# Team Memory

Manage a shared team memory system backed by a Cloudflare Worker with semantic search.

## Commands

### /remember — Store an observation

Save a new observation to team memory.

```bash
TEAM_MEMORY_URL=https://team-memory.zacjones93.workers.dev bun run .claude/skills/team-memory/scripts/remember.ts "<observation text>" [--category=<category>] [--priority=<priority>...

### Prompt 3

this cta should be smart enough to see if a score is submitted and display a separate badge for 'edit submission' or 'view submission' depending on if theres a submission and/or the submission window is closed

### Prompt 4

this work got accidentally reverted please add it back

