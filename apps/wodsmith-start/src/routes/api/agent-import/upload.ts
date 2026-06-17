/**
 * Private upload route for the organizer file-drop import agent.
 *
 * Mirrors the auth/logging shape of /api/upload but stores the dropped file
 * under a private, unguessable key and returns NO public URL — PII stays
 * server-side. The agent reads the object back via env.R2_BUCKET.get(key).
 */

import { env } from "cloudflare:workers"
import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { getDb } from "@/db"
import { AGENT_IMPORT_STATUS, agentImportRunsTable } from "@/db/schema"
import { logInfo, logWarning } from "@/lib/logging"
import {
	loadFileImportScopeByRun,
	requireFileImportTeamAccess,
} from "@/server/organizer-file-import/access"
import { getSessionFromCookie } from "@/utils/auth"

const MAX_BYTES = 15 * 1024 * 1024 // 15MB

// CSV/TSV + XLSX + plain text/markdown for MVP. PDF/DOCX text extraction is a
// later spike — reject them here until pre-extraction lands.
const ALLOWED_TYPES = new Set([
	"text/csv",
	"text/tab-separated-values",
	"text/plain",
	"text/markdown",
	"application/csv",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/octet-stream", // some browsers send this for .csv/.tsv
])
const ALLOWED_EXTENSIONS = [".csv", ".tsv", ".txt", ".md", ".xlsx", ".xls"]

function hasAllowedExtension(filename: string): boolean {
	const lower = filename.toLowerCase()
	return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export const Route = createFileRoute("/api/agent-import/upload")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const session = await getSessionFromCookie()
				if (!session) {
					logWarning({ message: "[AgentImport] Unauthorized upload attempt" })
					return json({ error: "Unauthorized" }, { status: 401 })
				}

				const formData = await request.formData()
				const file = formData.get("file") as File | null
				const importRunId = formData.get("importRunId") as string | null

				if (!file || !importRunId) {
					return json(
						{ error: "Missing file or importRunId" },
						{ status: 400 },
					)
				}
				if (file.size > MAX_BYTES) {
					return json(
						{ error: "File too large (max 15MB)" },
						{ status: 400 },
					)
				}
				if (!ALLOWED_TYPES.has(file.type) && !hasAllowedExtension(file.name)) {
					return json(
						{ error: `Unsupported file type: ${file.type || file.name}` },
						{ status: 400 },
					)
				}

				// Authorize against the run's competition (defense in depth) and
				// confirm the uploader owns the run.
				const scope = await loadFileImportScopeByRun(importRunId)
				try {
					await requireFileImportTeamAccess({
						teamId: scope.organizingTeamId,
						scope,
					})
				} catch (err) {
					logWarning({
						message: "[AgentImport] Upload authorization denied",
						attributes: {
							importRunId,
							reason: err instanceof Error ? err.message : String(err),
						},
					})
					return json({ error: "Forbidden" }, { status: 403 })
				}
				if (scope.createdByUserId !== session.user.id) {
					return json({ error: "Forbidden" }, { status: 403 })
				}

				const bytes = await file.arrayBuffer()
				const digest = await crypto.subtle.digest("SHA-256", bytes)
				const checksum = [...new Uint8Array(digest)]
					.map((b) => b.toString(16).padStart(2, "0"))
					.join("")

				const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
				const key = `agent-imports/${scope.competitionId}/${importRunId}/${safeName}`

				await env.R2_BUCKET.put(key, bytes, {
					httpMetadata: { contentType: file.type || "application/octet-stream" },
					customMetadata: {
						uploadedBy: session.user.id,
						importRunId,
						purpose: "agent-import",
					},
				})

				const db = getDb()
				await db
					.update(agentImportRunsTable)
					.set({
						status: AGENT_IMPORT_STATUS.UPLOADED,
						r2Key: key,
						originalFilename: file.name,
						mimeType: file.type || null,
						fileSize: file.size,
						checksum,
					})
					.where(eq(agentImportRunsTable.id, importRunId))

				logInfo({
					message: "[AgentImport] upload completed",
					attributes: { importRunId, key, checksum },
				})

				// No public URL — PII stays server-side.
				return json({
					key,
					checksum,
					originalFilename: file.name,
					fileSize: file.size,
					mimeType: file.type,
				})
			},
		},
	},
})
