#!/usr/bin/env bun

const BASE_URL = process.env.TEAM_MEMORY_URL || "http://localhost:8787";
const API_TOKEN = process.env.TEAM_MEMORY_TOKEN;

if (!API_TOKEN) {
	console.error("Error: TEAM_MEMORY_TOKEN environment variable is required");
	process.exit(1);
}

const args = process.argv.slice(2);

if (args.length < 2 || args[0] === "--help") {
	console.log("Usage: bun run feedback.ts <id> <signal> [--note=\"...\"]");
	console.log("\nSignals: helpful, harmful, irrelevant");
	process.exit(args[0] === "--help" ? 0 : 1);
}

const id = args[0];
const signal = args[1];
let note: string | undefined;

for (const arg of args.slice(2)) {
	if (arg.startsWith("--note=")) {
		note = arg.split("=").slice(1).join("=");
	}
}

const VALID_SIGNALS = ["helpful", "harmful", "irrelevant"];
if (!VALID_SIGNALS.includes(signal)) {
	console.error(
		`Error: signal must be one of: ${VALID_SIGNALS.join(", ")}`,
	);
	process.exit(1);
}

const body: Record<string, string> = { id, signal };
if (note) body.note = note;

try {
	const res = await fetch(`${BASE_URL}/feedback`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${API_TOKEN}`,
		},
		body: JSON.stringify(body),
	});

	const data = await res.json();

	if (!res.ok) {
		console.error(
			`Error (${res.status}): ${(data as { error?: string }).error || JSON.stringify(data)}`,
		);
		process.exit(1);
	}

	const result = data as { id: string; score: number; maturity: string };
	console.log(`Feedback recorded for ${result.id}`);
	console.log(`  Signal: ${signal}`);
	console.log(`  Score: ${result.score}`);
	console.log(`  Maturity: ${result.maturity}`);
	if (note) console.log(`  Note: ${note}`);
} catch (err) {
	console.error(`Failed to connect to team-memory at ${BASE_URL}:`, err);
	process.exit(1);
}
