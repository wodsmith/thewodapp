---
name: ralph-mode
description: Autonomous AI coding loop that ships features while you sleep. Use when the user wants to run Ralph, start an autonomous coding session, work overnight, or let Claude implement multiple user stories autonomously. Triggers on "ralph", "autonomous mode", "overnight coding", "autonomous loop", or requests to implement multiple stories without supervision.
---

# Ralph Mode

Ralph is an autonomous AI coding loop that spawns fresh Claude Code instances repeatedly until all tasks are complete. Each iteration gets a fresh context window while memory persists via git history and text files.

Named after Ralph Wiggum from The Simpsons - perpetually confused, always making mistakes, but never stopping. The philosophy: iteration beats perfection.

## Quick Start

1. **Initialize Ralph** in your project:
   ```bash
   bun .claude/skills/ralph-mode/scripts/init-ralph.ts
   ```

2. **Populate your PRD** at `scripts/ralph/prd.json` with user stories

3. **Start Ralph**:
   ```bash
   ./scripts/ralph/ralph.sh [max_iterations]
   ```

## How It Works

Each iteration:
1. Reads `prd.json` to see what needs to be done
2. Reads `progress.txt` to see what has already been done
3. **Decides what to do next** (agent chooses the task, not you)
4. Explores the codebase
5. Implements ONE feature
6. Runs feedback loops (types, linting, tests)
7. Commits the code
8. Loop repeats until all stories pass or max iterations reached

Memory persists ONLY through:
- Git commits (implementation)
- `progress.txt` (learnings + codebase patterns)
- `prd.json` (task status with `passes` field)

## File Structure

```
scripts/ralph/
├── ralph.sh        # Main loop script (AFK mode)
├── ralph-once.sh   # Single iteration (HITL mode)
├── prompt.md       # Instructions for each iteration
├── prd.json        # User stories with completion status
└── progress.txt    # Accumulated learnings
```

## The 11 Tips for Success

### 1. Ralph Is A Loop
Instead of writing a new prompt for each phase, run the same prompt in a loop. The key improvement: **the agent chooses the task, not you**. You define the end state. Ralph gets there.

### 2. Start With HITL, Then Go AFK
Two modes of running Ralph:

| Mode | How It Works | Best For | Script |
|------|--------------|----------|--------|
| **HITL** (human-in-the-loop) | Run once, watch, intervene | Learning, prompt refinement | `ralph-once.sh` |
| **AFK** (away from keyboard) | Run in loop with max iterations | Bulk work, low-risk tasks | `ralph.sh` |

Start with HITL to learn and refine. Go AFK once you trust your prompt.

### 3. Define The Scope
Before letting Ralph run, define what "done" looks like. Use PRD items with a `passes` field:

```json
{
  "category": "functional",
  "description": "New chat button creates a fresh conversation",
  "steps": ["Click 'New Chat'", "Verify new conversation created"],
  "passes": false
}
```

Ralph marks `passes` to `true` when complete. As long as scope and stop condition are explicit, Ralph knows when to emit `<promise>COMPLETE</promise>`.

### 4. Track Ralph's Progress
Every loop emits to `progress.txt`. AI agents forget everything between tasks - this file IS the memory. Include:
- Tasks completed in this session
- Decisions made and why
- Blockers encountered
- Files changed

### 5. Use Feedback Loops
The best setup blocks commits unless everything passes. Ralph can't declare victory if tests are red.

```bash
# Required in every iteration:
pnpm type-check  # TypeScript errors block commit
pnpm test        # Test failures block commit
pnpm lint        # Lint errors block commit
```

### 6. Take Small Steps
The rate at which you can get feedback is your speed limit. **Never outrun your headlights.**

Context windows are limited, and LLMs get worse as they fill up (context rot). Keep PRD items small - one logical change per commit.

### 7. Prioritize Risky Tasks
| Task Type | Priority | Why |
|-----------|----------|-----|
| Architectural work | High | Decisions cascade through entire codebase |
| Integration points | High | Reveals incompatibilities early |
| Unknown unknowns | High | Better to fail fast than fail late |
| UI polish | Low | Can be parallelized later |
| Quick wins | Low | Easy to slot in anytime |

Use HITL Ralph for early architectural decisions. Save AFK Ralph for when the foundation is solid.

### 8. Explicitly Define Software Quality
The agent doesn't know what kind of repo it's in. Tell it explicitly:

| Repo Type | What To Say |
|-----------|-------------|
| Prototype | "Speed over perfection" |
| Production | "Must be maintainable" |
| Library | "Backward compatibility matters" |

**Your instructions compete with your codebase.** Agents amplify what they see. Poor code leads to poorer code.

### 9. Use Docker Sandboxes
For AFK Ralph, use Docker sandboxes:
```bash
docker sandbox run claude
```
Your current directory is mounted, but nothing else. Ralph can edit project files but can't touch your home directory, SSH keys, or system files.

### 10. Pay To Play
If you never run AFK Ralph, HITL Ralph still has benefits over multi-phase planning. The rewards are there if you're willing to claim them.

### 11. Make It Your Own
Ralph is just a loop. Some alternative loop types:
- **Test Coverage Loop**: Write tests until coverage hits target
- **Duplication Loop**: Find and refactor duplicate code
- **Linting Loop**: Fix linting errors one at a time
- **Entropy Loop**: Scan for code smells and clean them up

## Usage Modes

### HITL Mode (recommended to start)
Run a single iteration, watch, and intervene:
```bash
./scripts/ralph/ralph-once.sh
```

### AFK Mode
Run in a loop with max iterations:
```bash
./scripts/ralph/ralph.sh 20      # 20 iterations max
./scripts/ralph/ralph.sh         # Uses default (10)
```

## Monitoring Progress

```bash
# Story status
cat scripts/ralph/prd.json | jq '.userStories[] | {id, title, passes}'

# Learnings
cat scripts/ralph/progress.txt

# Recent commits
git log --oneline -10
```

## Safety

- AFK Ralph runs with `--dangerously-skip-permissions`
- Use Docker sandboxes for AFK mode when possible
- Always cap iterations to prevent runaway costs
- Ctrl+C stops the loop immediately
- `git reset --hard` reverts uncommitted changes

## When NOT to Use

- Exploratory work without clear outcomes
- Major refactors without explicit criteria
- Security-critical code needing human review
- Early architectural decisions (use HITL instead)

## References

- See [prd-guide.md](references/prd-guide.md) for writing effective user stories
- See [patterns.md](references/patterns.md) for common patterns and gotchas
