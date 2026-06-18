/**
 * Private upload endpoint for the organizer file-drop import agent.
 *
 * Unlike /api/upload, this never returns a public URL — dropped rosters/packets
 * contain PII and stay server-side. Files are stored under a per-run private R2
 * prefix and read back only by the agent (server-side). A SHA-256 checksum is
 * stamped onto the import-run row for idempotency / duplicate-import detection.
 */

import { env } from "cloudflare:workers"
import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { getDb } from "@/db"
import { AGENT_IMPORT_STATUS, agentImportRunsTable } from "@/db/schema"
import { logError, logInfo, logWarning } from "@/lib/logging"
import { SUPPORTED_IMPORT_MIME_TYPES } from "@/lib/organizer-file-import/parse"
import {
  loadFileImportScopeByRun,
  requireFileImportTeamAccess,
} from "@/server/organizer-file-import/access"
import { getSessionFromCookie } from "@/utils/auth"

const MAX_BYTES = 15 * 1024 * 1024 // 15MB
const ALLOWED = new Set<string>(SUPPORTED_IMPORT_MIME_TYPES)
// Some browsers send octet-stream for .csv — allow when the extension is known.
const ALLOWED_EXTENSIONS = new Set(["csv", "tsv", "txt", "md"])

function hasAllowedExtension(filename: string): boolean {
  const dot = filename.lastIndexOf(".")
  if (dot === -1) return false
  return ALLOWED_EXTENSIONS.has(filename.slice(dot + 1).toLowerCase())
}

export const Route = createFileRoute("/api/agent-import/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getSessionFromCookie()
        if (!session) {
          return json({ error: "Unauthorized" }, { status: 401 })
        }

        const form = await request.formData()
        const file = form.get("file") as File | null
        const importRunId = form.get("importRunId") as string | null

        if (!file || !importRunId) {
          return json({ error: "Missing file or importRunId" }, { status: 400 })
        }
        if (file.size > MAX_BYTES) {
          return json({ error: "File too large (max 15MB)" }, { status: 400 })
        }
        if (!ALLOWED.has(file.type) && !hasAllowedExtension(file.name)) {
          return json(
            {
              error: `Unsupported file type. Supported: CSV, TSV, TXT, Markdown.`,
            },
            { status: 400 },
          )
        }

        // Authorize against the run's competition (defense in depth), then
        // confirm the uploader owns this run.
        const scope = await loadFileImportScopeByRun(importRunId)
        await requireFileImportTeamAccess({
          teamId: scope.organizingTeamId,
          scope,
        })
        if (scope.createdByUserId !== session.user.id) {
          logWarning({
            message: "[AgentImport] upload by non-owner blocked",
            attributes: { importRunId, userId: session.user.id },
          })
          return json({ error: "Forbidden" }, { status: 403 })
        }

        const bytes = await file.arrayBuffer()
        const digest = await crypto.subtle.digest("SHA-256", bytes)
        const checksum = [...new Uint8Array(digest)]
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const key = `agent-imports/${scope.competitionId}/${importRunId}/${safeName}`

        try {
          await env.R2_BUCKET.put(key, bytes, {
            httpMetadata: { contentType: file.type },
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
              mimeType: file.type,
              fileSize: file.size,
              checksum,
            })
            .where(eq(agentImportRunsTable.id, importRunId))

          logInfo({
            message: "[AgentImport] upload completed",
            attributes: { importRunId, key, fileSize: file.size },
          })

          // No public URL — PII stays server-side.
          return json({
            key,
            checksum,
            originalFilename: file.name,
            fileSize: file.size,
            mimeType: file.type,
          })
        } catch (err) {
          logError({
            message: "[AgentImport] R2 upload failed",
            error: err,
            attributes: { importRunId, key },
          })
          return json({ error: "Upload failed" }, { status: 500 })
        }
      },
    },
  },
})
