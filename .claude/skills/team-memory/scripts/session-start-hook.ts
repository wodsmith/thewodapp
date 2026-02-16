#!/usr/bin/env bun

/**
 * SessionStart hook: loads top memories from team-memory Worker
 * and injects them as additional context into the Claude session.
 *
 * Output format: JSON with hookSpecificOutput.additionalContext
 */

const BASE_URL = process.env.TEAM_MEMORY_URL || "http://localhost:8787";

interface Observation {
	id: string;
	content: string;
	category: string;
	priority: string;
	score: number;
	maturity: string;
}

interface Reflection {
	id: string;
	content: string;
	category: string;
	priority: string;
	score: number;
	maturity: string;
}

interface ContextResponse {
	observations: Observation[];
	reflections: Reflection[];
}

function formatMemories(ctx: ContextResponse): string {
	const lines: string[] = ["# Team Memory Context\n"];

	if (ctx.observations.length > 0) {
		lines.push("## Observations\n");
		for (const o of ctx.observations) {
			lines.push(
				`- [${o.category}/${o.priority}] ${o.content} (id: ${o.id}, score: ${o.score?.toFixed(2) ?? "?"})`,
			);
		}
		lines.push("");
	}

	if (ctx.reflections.length > 0) {
		lines.push("## Reflections\n");
		for (const r of ctx.reflections) {
			lines.push(
				`- [${r.category}/${r.priority}] ${r.content} (id: ${r.id}, score: ${r.score?.toFixed(2) ?? "?"})`,
			);
		}
		lines.push("");
	}

	if (ctx.observations.length === 0 && ctx.reflections.length === 0) {
		lines.push("No memories stored yet. Use /remember to save observations.\n");
	}

	return lines.join("\n");
}

try {
	const res = await fetch(`${BASE_URL}/context?limit=10`);

	if (!res.ok) {
		// Non-fatal: output empty context so the hook doesn't block session start
		const hookOutput = {
			hookSpecificOutput: {
				hookEventName: "SessionStart",
				additionalContext:
					"# Team Memory Context\n\nTeam memory service unavailable. Memories will not be loaded this session.\n",
			},
		};
		console.log(JSON.stringify(hookOutput));
		process.exit(0);
	}

	const ctx = (await res.json()) as ContextResponse;
	const markdown = formatMemories(ctx);

	const hookOutput = {
		hookSpecificOutput: {
			hookEventName: "SessionStart",
			additionalContext: markdown,
		},
	};

	console.log(JSON.stringify(hookOutput));
} catch {
	// Connection failure is non-fatal
	const hookOutput = {
		hookSpecificOutput: {
			hookEventName: "SessionStart",
			additionalContext:
				"# Team Memory Context\n\nTeam memory service not reachable. Memories will not be loaded this session.\n",
		},
	};
	console.log(JSON.stringify(hookOutput));
	process.exit(0);
}
