# Session Context

## User Prompts

### Prompt 1

We are testing invite logic for competitions. So in competition can invite Athletes and part of this feature is we have source allocations where you can And set a default source allocation for a competition you're inviting from as well as a per division allocation override so maybe in some cases like most division you want to only qualify the top person, but one division you want to qualify the top two people. We have a bug where it looks like our Invite page and our registration page for this i...

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

To be clear, when we set top one finishers qualify on a qualification source, only one person from that division is allowed to accept an invite regardless of the other qualification sources. There's no complicated logic here. If Online Qualifier 2026 has top one finisher qualifies as the default all divisions from that that competition only get one invite that can take a spot at the competition If there is a per division allocation, then only say that Men's Rx is set to 2. Only two spots from on...

### Prompt 4

so we don't actually use direct_spots_per_comp

### Prompt 5

Your tool call was malformed and could not be parsed. Please retry.

### Prompt 6

Stop hook feedback:
The codebase has changes (454 lines) but `lat.md/` may not be fully in sync (9 lines changed). Verify `lat.md/` is in sync — run `lat search` to find relevant sections. Run `lat check` at the end.

