#!/usr/bin/env bun

/**
 * SessionEnd hook: reads the session transcript and posts it to team-memory,
 * then kicks off a background Claude agent to extract observations.
 *
 * Receives JSON on stdin from Claude Code:
 *   { session_id, transcript_path, cwd, reason, permission_mode, hook_event_name }
 *
 * Reads the JSONL transcript, extracts user/assistant messages,
 * POSTs them to the /sessions endpoint, then spawns `claude -p` (sonnet)
 * to extract reusable observations and POST them to /observations.
 */

import {readFileSync, existsSync} from "fs";
import {spawn} from "node:child_process";

const BASE_URL = process.env.TEAM_MEMORY_URL || "https://team-memory.zacjones93.workers.dev";
const MAX_MESSAGES = 200;
const MAX_CONTENT_LENGTH = 5000;

interface HookInput {
	session_id: string;
	transcript_path: string;
	cwd: string;
	reason: string;
	permission_mode?: string;
	hook_event_name: string;
}

interface TranscriptEntry {
	type: string;
	message?: {
		role: string;
		content: string | Array<{type: string; text?: string}>;
	};
	timestamp?: string;
}

interface ExtractedMessage {
	role: "user" | "assistant" | "system";
	content: string;
}

function extractTextContent(
	content: string | Array<{type: string; text?: string}>,
): string {
	if (typeof content === "string") {
		return content;
	}
	if (Array.isArray(content)) {
		return content
			.filter((block) => block.type === "text" && block.text)
			.map((block) => block.text!)
			.join("\n");
	}
	return "";
}

function parseTranscript(path: string): ExtractedMessage[] {
	if (!existsSync(path)) {
		console.error(`session-end: transcript not found: ${path}`);
		return [];
	}

	const raw = readFileSync(path, "utf-8");
	const lines = raw.split("\n").filter((l: string) => l.trim());
	const messages: ExtractedMessage[] = [];

	for (const line of lines) {
		try {
			const entry = JSON.parse(line) as TranscriptEntry;

			if (
				(entry.type === "user" || entry.type === "assistant") &&
				entry.message
			) {
				const role = entry.message.role as ExtractedMessage["role"];
				let text = extractTextContent(entry.message.content);

				// Truncate very long messages to keep payload reasonable
				if (text.length > MAX_CONTENT_LENGTH) {
					text = text.slice(0, MAX_CONTENT_LENGTH) + "\n...[truncated]";
				}

				if (text.trim()) {
					messages.push({role, content: text});
				}
			}
		} catch {
			// Skip malformed lines
		}
	}

	// Cap total messages to avoid massive payloads
	if (messages.length > MAX_MESSAGES) {
		const kept = [
			// Keep first 10 messages for context
			...messages.slice(0, 10),
			// Keep last N messages for recent work
			...messages.slice(-(MAX_MESSAGES - 10)),
		];
		return kept;
	}

	return messages;
}

function buildExtractionPrompt(messages: ExtractedMessage[]): string {
	// Build a condensed transcript for the LLM
	const transcript = messages
		.map((m) => `[${m.role}]: ${m.content}`)
		.join("\n\n");

	return `You are reviewing a coding session transcript. Your job is to notice genuinely reusable insights — but ONLY if they exist. Most sessions are routine and won't have anything worth saving. That's fine.

You're looking for things like:
- A non-obvious bug or gotcha that cost time to figure out
- A pattern or convention that was established and should be followed
- A debugging technique that cracked a hard problem
- An architecture decision with rationale worth remembering
- Something that went wrong in the session (wasted effort, wrong approach) worth avoiding next time

Do NOT extract:
- Routine coding (added a component, wrote a test, fixed a typo)
- Session-specific context (working on ticket X, deployed to Y)
- Things that are already obvious from the codebase
- Forced or low-value observations — when in doubt, skip it

If the session was uneventful, output NOTHING. An empty response is perfectly fine.

For each genuine insight, output a JSON object on its own line (JSONL format):
- "content": concise, actionable observation (under 200 chars)
- "category": one of "convention", "gotcha", "debugging", "architecture", "workflow"
- "priority": "critical" (cost real time/pain), "moderate" (useful to know), or "ephemeral" (minor tip)

Output ONLY JSON lines. No preamble, no summary, no explanation.

<transcript>
${transcript}
</transcript>`;
}

function spawnExtractionAgent(
	messages: ExtractedMessage[],
	sessionId: string,
): void {
	const prompt = buildExtractionPrompt(messages);

	// Strip CLAUDECODE env var so nested claude can run
	const env: Record<string, string | undefined> = {...process.env};
	delete env.CLAUDECODE;
	delete env.CLAUDE_CODE_SSE_PORT;

	const child = spawn(
		"claude",
		["-p", "--model", "sonnet", "--output-format", "text"],
		{
			env,
			cwd: "/tmp", // Avoid inheriting project hooks (entire, beads, etc.)
			stdio: ["pipe", "pipe", "pipe"],
		},
	);

	if (!child.stdin || !child.stdout) {
		console.error("session-end: failed to spawn extraction agent");
		return;
	}

	child.stdin.write(prompt);
	child.stdin.end();

	// Collect stdout, parse observations, POST them
	const chunks: Uint8Array[] = [];
	void (async () => {
		try {
			for await (const chunk of child.stdout!) {
				chunks.push(chunk);
			}
			const output = Buffer.concat(chunks).toString("utf-8").trim();
			if (!output) {
				console.error("session-end: extraction agent returned empty output");
				return;
			}

			const lines = output.split("\n").filter((l: string) => l.trim());
			let posted = 0;

			for (const line of lines) {
				try {
					const obs = JSON.parse(line) as {
						content: string;
						category: string;
						priority: string;
					};
					if (!obs.content || !obs.category || !obs.priority) continue;

					const res = await fetch(`${BASE_URL}/observations`, {
						method: "POST",
						headers: {"Content-Type": "application/json"},
						body: JSON.stringify({
							content: obs.content,
							category: obs.category,
							priority: obs.priority,
							userId: "claude-code-extractor",
							sessionId,
						}),
					});

					if (res.ok) {
						posted++;
					} else if (res.status === 409) {
						// Duplicate, skip
					} else {
						const err = await res.text();
						console.error(`session-end: observation POST failed (${res.status}): ${err}`);
					}
				} catch {
					// Skip unparseable lines
				}
			}

			if (posted > 0) {
				console.error(`session-end: extracted and stored ${posted} observations`);
			}
		} catch (err) {
			console.error("session-end: extraction agent error:", err);
		}
	})().catch((err) => console.error("session-end: unexpected extraction error:", err));

	// Note: we intentionally do NOT unref — the async IIFE above needs
	// the process to stay alive until stdout collection + POSTs complete.
}

async function readStdin(): Promise<string> {
	const chunks: Uint8Array[] = [];
	for await (const chunk of Bun.stdin.stream()) {
		chunks.push(chunk);
	}
	return Buffer.concat(chunks).toString("utf-8");
}

try {
	const stdinData = await readStdin();

	if (!stdinData.trim()) {
		console.error("session-end: no stdin data received");
		process.exit(0);
	}

	const input = JSON.parse(stdinData) as HookInput;

	if (!input.transcript_path) {
		console.error("session-end: no transcript_path in hook input");
		process.exit(0);
	}

	const messages = parseTranscript(input.transcript_path);

	if (messages.length === 0) {
		console.error("session-end: no messages extracted from transcript");
		process.exit(0);
	}

	console.error(
		`session-end: extracted ${messages.length} messages, posting to ${BASE_URL}/sessions`,
	);

	const res = await fetch(`${BASE_URL}/sessions`, {
		method: "POST",
		headers: {"Content-Type": "application/json"},
		body: JSON.stringify({
			userId: "claude-code",
			messages,
			metadata: {
				sessionId: input.session_id,
				cwd: input.cwd,
				reason: input.reason,
				permissionMode: input.permission_mode,
				messageCount: messages.length,
			},
		}),
	});

	if (!res.ok) {
		const err = await res.text();
		console.error(`session-end: POST failed (${res.status}): ${err}`);
		process.exit(0);
	}

	const result = (await res.json()) as {sessionId: string};
	console.error(
		`session-end: stored session ${result.sessionId} (${messages.length} messages)`,
	);

	// Kick off background extraction agent (fire-and-forget)
	spawnExtractionAgent(messages, result.sessionId);
} catch (err) {
	console.error(`session-end: error:`, err);
	process.exit(0);
}
