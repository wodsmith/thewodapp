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

### Prompt 7

so how does series qualification spots work now?

### Prompt 8

to be clear again, the global spots should still be considered a separate cap than the per division spots. The global spots are an idea where in a series you'll have five competitions Each of those competitions are qualifying the winner of the competition to the championship. So there'd be one top one from each competition and then for the global spots you could say top five and that means across the series five more invites from the global leader board can be invited It's its own bucket that do...

### Prompt 9

Stop hook feedback:
The codebase has changes (69 lines) but `lat.md/` was not updated. Verify `lat.md/` is in sync — run `lat search` to find relevant sections. Run `lat check` at the end.

### Prompt 10

We want a more surgical edit in that when you hit the add source button There is the source kind drop down where currently you have single competition and then series. We actually want to add a third source kind which would be series global leaderboard and then you can pick the series And when you pick the series, it lets you specify global spots. And then on the series it the global spots is removed because instead of conflating these two qualification sources, we make them distinct and promote...

