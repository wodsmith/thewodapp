#!/usr/bin/env bun

/**
 * SessionEnd hook: stub for future session transcript processing.
 *
 * Currently a no-op. When Claude Code exposes session transcript data
 * via env or stdin, this hook will POST session summaries to /sessions.
 */

console.error(
	"session-end: no-op until session transcript access is available",
);
process.exit(0);
