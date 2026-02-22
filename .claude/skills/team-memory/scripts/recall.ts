#!/usr/bin/env bun

const BASE_URL = process.env.TEAM_MEMORY_URL || "http://localhost:8787";
const API_TOKEN = process.env.TEAM_MEMORY_TOKEN;

if (!API_TOKEN) {
	console.error("Error: TEAM_MEMORY_TOKEN environment variable is required");
	process.exit(1);
}

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help") {
	console.log(
		"Usage: bun run recall.ts <query> [--limit=5] [--category=...] [--priority=...]",
	);
	process.exit(args[0] === "--help" ? 0 : 1);
}

const positionalArgs: string[] = [];
let limit = "5";
let category = "";
let priority = "";

for (const arg of args) {
	if (arg.startsWith("--limit=")) {
		limit = arg.split("=")[1];
	} else if (arg.startsWith("--category=")) {
		category = arg.split("=")[1];
	} else if (arg.startsWith("--priority=")) {
		priority = arg.split("=")[1];
	} else {
		positionalArgs.push(arg);
	}
}

const query = positionalArgs.join(" ");

if (!query) {
	console.error("Error: query is required");
	process.exit(1);
}

const params = new URLSearchParams({ q: query, limit });
if (category) params.set("category", category);
if (priority) params.set("priority", priority);

try {
	const res = await fetch(`${BASE_URL}/search?${params}`, {
		headers: {Authorization: `Bearer ${API_TOKEN}`},
	});
	const data = await res.json();

	if (!res.ok) {
		console.error(
			`Error (${res.status}): ${(data as { error?: string }).error || JSON.stringify(data)}`,
		);
		process.exit(1);
	}

	interface SearchResult {
		id: string;
		content: string;
		category: string;
		priority: string;
		score: number;
		maturity: string;
	}

	const results = (data as { results: SearchResult[] }).results;

	if (results.length === 0) {
		console.log("No memories found matching your query.");
		process.exit(0);
	}

	console.log(`## Team Memory Results (${results.length})\n`);
	for (const r of results) {
		console.log(`- **[${r.id}]** (${r.category}/${r.priority}, score: ${r.score?.toFixed(2) ?? "?"}, ${r.maturity})`);
		console.log(`  ${r.content}\n`);
	}
} catch (err) {
	console.error(`Failed to connect to team-memory at ${BASE_URL}:`, err);
	process.exit(1);
}
