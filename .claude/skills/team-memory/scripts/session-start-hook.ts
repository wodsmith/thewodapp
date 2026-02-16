#!/usr/bin/env bun

/**
 * SessionStart hook: reminds the agent about the team memory system
 * and how to load task-relevant memories via /recall.
 *
 * Output format: JSON with hookSpecificOutput.additionalContext
 */

const context = `# Team Memory System

A shared team memory is available via the /recall and /remember skills.

## Loading Memories for a Task

When starting work on a task, use /recall to search for relevant memories:

\`\`\`
/recall "<topic or keyword relevant to your task>"
\`\`\`

Examples:
- Working on Stripe integration? → /recall "Stripe"
- Fixing a database query? → /recall "database" or /recall "Drizzle"
- Debugging a test? → /recall "testing patterns"

## Saving New Knowledge

When you discover something useful (gotcha, convention, debugging tip), save it:

\`\`\`
/remember
\`\`\`

## When to Use

- **Before starting work**: /recall to check for relevant prior knowledge
- **After discovering a gotcha**: /remember to save it for future sessions
- **After solving a tricky bug**: /remember the solution pattern
`;

const hookOutput = {
	hookSpecificOutput: {
		hookEventName: "SessionStart",
		additionalContext: context,
	},
};

console.log(JSON.stringify(hookOutput));
