#!/usr/bin/env bun

const BASE_URL = process.env.TEAM_MEMORY_URL || "http://localhost:8787";

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help") {
	console.log(
		"Usage: bun run remember.ts <content> [--category=convention] [--priority=moderate]",
	);
	console.log(
		"\nCategories: convention, gotcha, debugging, architecture, workflow",
	);
	console.log("Priorities: critical, moderate, ephemeral");
	process.exit(args[0] === "--help" ? 0 : 1);
}

let content = "";
let category = "convention";
let priority = "moderate";
let userId: string | undefined;
let sessionId: string | undefined;

for (const arg of args) {
	if (arg.startsWith("--category=")) {
		category = arg.split("=")[1];
	} else if (arg.startsWith("--priority=")) {
		priority = arg.split("=")[1];
	} else if (arg.startsWith("--userId=")) {
		userId = arg.split("=")[1];
	} else if (arg.startsWith("--sessionId=")) {
		sessionId = arg.split("=")[1];
	} else {
		content = arg;
	}
}

if (!content) {
	console.error("Error: content is required");
	process.exit(1);
}

const body: Record<string, string> = { content, category, priority };
if (userId) body.userId = userId;
if (sessionId) body.sessionId = sessionId;

try {
	const res = await fetch(`${BASE_URL}/observations`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});

	const data = await res.json();

	if (!res.ok) {
		console.error(
			`Error (${res.status}): ${(data as { error?: string }).error || JSON.stringify(data)}`,
		);
		process.exit(1);
	}

	const obs = data as { id: string; content: string; category: string; priority: string };
	console.log(`Stored observation ${obs.id}`);
	console.log(`  Category: ${obs.category}`);
	console.log(`  Priority: ${obs.priority}`);
	console.log(`  Content: ${obs.content}`);
} catch (err) {
	console.error(`Failed to connect to team-memory at ${BASE_URL}:`, err);
	process.exit(1);
}
