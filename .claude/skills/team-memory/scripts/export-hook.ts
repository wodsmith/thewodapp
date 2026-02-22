#!/usr/bin/env bun

/**
 * Export hook: syncs team-memory Worker export to the project MEMORY.md file.
 *
 * Replaces content between <!-- BEGIN TEAM-MEMORY --> and <!-- END TEAM-MEMORY -->
 * markers. If markers don't exist, appends them at the end.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const BASE_URL = process.env.TEAM_MEMORY_URL || "http://localhost:8787";
const API_TOKEN = process.env.TEAM_MEMORY_TOKEN;

if (!API_TOKEN) {
	console.error("Error: TEAM_MEMORY_TOKEN environment variable is required");
	process.exit(1);
}
const MEMORY_PATH =
	process.env.TEAM_MEMORY_FILE ||
	`${process.cwd()}/MEMORY.md`;

const BEGIN_MARKER = "<!-- BEGIN TEAM-MEMORY -->";
const END_MARKER = "<!-- END TEAM-MEMORY -->";

try {
	const res = await fetch(`${BASE_URL}/export`, {
		headers: {Authorization: `Bearer ${API_TOKEN}`},
	});

	if (!res.ok) {
		console.error(`Export failed (${res.status}): ${await res.text()}`);
		process.exit(1);
	}

	const exportedMarkdown = await res.text();

	const markerContent = `${BEGIN_MARKER}\n${exportedMarkdown}\n${END_MARKER}`;

	if (!existsSync(MEMORY_PATH)) {
		writeFileSync(MEMORY_PATH, `# Team Memory\n\n${markerContent}\n`);
		console.log(`Created ${MEMORY_PATH} with team memory export`);
		process.exit(0);
	}

	const existing = readFileSync(MEMORY_PATH, "utf-8");

	const beginIdx = existing.indexOf(BEGIN_MARKER);
	const endIdx = existing.indexOf(END_MARKER);

	let updated: string;

	if (beginIdx !== -1 && endIdx !== -1) {
		// Replace between markers
		updated =
			existing.slice(0, beginIdx) +
			markerContent +
			existing.slice(endIdx + END_MARKER.length);
	} else {
		// Append markers at end
		updated = `${existing.trimEnd()}\n\n${markerContent}\n`;
	}

	writeFileSync(MEMORY_PATH, updated);
	console.log(`Updated ${MEMORY_PATH} with team memory export`);
} catch (err) {
	console.error(`Failed to export team memory:`, err);
	process.exit(1);
}
