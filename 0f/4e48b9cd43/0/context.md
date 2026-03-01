# Session Context

## User Prompts

### Prompt 1

please add tests around the functionality implemented on this branch use the test skill

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

Base directory for this skill: /Users/zacjones/Documents/02.Areas/wodsmith/thewodapp-2/.claude/skills/test

# Testing (Router Skill)

**"Write tests. Not too many. Mostly integration."** — Kent C. Dodds

This skill routes you to the right testing approach. TDD is non-negotiable for swarm work.

## Testing Trophy

```
      /\
     /  \  E2E (slow, high confidence)
    /----\  5-10 critical path tests
   / INT  \ Integration (SWEET SPOT)
  /--------\ Test real interactions
 |  UNIT  | Unit (fas...

### Prompt 4

commit and push

