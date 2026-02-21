#!/usr/bin/env bun

/**
 * SessionStart hook: reminds the agent about the team memory system
 * and how to load task-relevant memories via /recall.
 *
 * Output format: JSON with hookSpecificOutput.additionalContext
 */

const context = `# 🚨 MANDATORY: Team Memory System 🚨

A shared team memory stores critical gotchas, conventions, and debugging insights across sessions.

## REQUIRED: /recall BEFORE Starting Any Task

You MUST run /recall at the start of every task to check for relevant prior knowledge. Skipping this risks repeating known mistakes and wasting time on already-solved problems.

\`\`\`
/recall "<topic or keyword relevant to your task>"
\`\`\`

Examples:
- Working on Stripe integration? → /recall "Stripe"
- Fixing a database query? → /recall "database" or /recall "Drizzle"
- Debugging a test? → /recall "testing patterns"
- Working on team creation? → /recall "team" or /recall "createId"
- Touching waivers? → /recall "waiver"

**Do NOT skip this step.** Past sessions have stored critical gotchas that will save significant debugging time.

## REQUIRED: /remember After Discoveries

When you discover something useful — a gotcha, root cause, convention, or debugging insight — you MUST save it immediately with /remember. Do not wait until the end of the session.

\`\`\`
/remember "<what you learned>" --category=gotcha|convention|debugging|architecture|workflow --priority=critical|moderate|ephemeral
\`\`\`

## Summary

- **BEFORE work**: /recall to load relevant memories (MANDATORY)
- **DURING work**: /remember as soon as you discover something worth saving (MANDATORY)
- Failure to use team memory means the team loses knowledge and repeats mistakes.
`;

const hookOutput = {
	hookSpecificOutput: {
		hookEventName: "SessionStart",
		additionalContext: context,
	},
};

console.log(JSON.stringify(hookOutput));
