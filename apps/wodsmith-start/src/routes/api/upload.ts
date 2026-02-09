/**
 * File Upload API Route for TanStack Start
 *
 * This file uses top-level imports for server-only modules.
 *
 * Handles file uploads to R2 with purpose-based configuration:
 * - competition-profile: Competition profile images (5MB max)
 * - competition-banner: Competition banner images (5MB max)
 * - competition-sponsor-logo: Sponsor logos (2MB max)
 * - athlete-profile: Athlete profile images (2MB max)
 * - athlete-cover: Athlete cover images (5MB max)
 * - sponsor-logo: General sponsor logos (2MB max)
 * - judging-sheet: Judging sheet PDFs (20MB max)
 *
 * OBSERVABILITY:
 * - All upload attempts are logged with purpose and file info
 * - Authorization failures are tracked
 * - Successful uploads include R2 key for correlation
 */

import { env } from "cloudflare:workers"
import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import {
	addRequestContextAttribute,
	logError,
	logInfo,
	logWarning,
	updateRequestContext,
} from "@/lib/logging"
import { checkUploadAuthorization } from "@/server/upload-authorization"
import { getSessionFromCookie } from "@/utils/auth"

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const DOCUMENT_TYPES = ["application/pdf"]

const PURPOSE_CONFIG: Record<
	string,
	{ maxSizeMb: number; pathPrefix: string; allowedTypes: string[] }
> = {
	"competition-profile": {
		maxSizeMb: 5,
		pathPrefix: "competitions/profiles",
		allowedTypes: IMAGE_TYPES,
	},
	"competition-banner": {
		maxSizeMb: 5,
		pathPrefix: "competitions/banners",
		allowedTypes: IMAGE_TYPES,
	},
	"competition-sponsor-logo": {
		maxSizeMb: 2,
		pathPrefix: "competitions/sponsors",
		allowedTypes: IMAGE_TYPES,
	},
	"athlete-profile": {
		maxSizeMb: 2,
		pathPrefix: "athletes/profiles",
		allowedTypes: IMAGE_TYPES,
	},
	"athlete-cover": {
		maxSizeMb: 5,
		pathPrefix: "athletes/covers",
		allowedTypes: IMAGE_TYPES,
	},
	"sponsor-logo": {
		maxSizeMb: 2,
		pathPrefix: "sponsors/logos",
		allowedTypes: IMAGE_TYPES,
	},
	"judging-sheet": {
		maxSizeMb: 20,
		pathPrefix: "competitions/judging-sheets",
		allowedTypes: DOCUMENT_TYPES,
	},
}

export const Route = createFileRoute("/api/upload")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const session = await getSessionFromCookie()
				if (!session) {
					logWarning({ message: "[Upload] Unauthorized upload attempt" })
					return json({ error: "Unauthorized" }, { status: 401 })
				}

				// Update request context
				updateRequestContext({ userId: session.user.id })

				const formData = await request.formData()
				const file = formData.get("file") as File | null
				const purpose = formData.get("purpose") as string | null
				const entityId = formData.get("entityId") as string | null

				if (!file) {
					logWarning({ message: "[Upload] No file provided" })
					return json({ error: "No file provided" }, { status: 400 })
				}

				if (!purpose || !PURPOSE_CONFIG[purpose]) {
					logWarning({
						message: "[Upload] Invalid purpose",
						attributes: { purpose },
					})
					return json({ error: "Invalid or missing purpose" }, { status: 400 })
				}

				// Add upload context
				addRequestContextAttribute("uploadPurpose", purpose)
				if (entityId) {
					addRequestContextAttribute("uploadEntityId", entityId)
				}

				logInfo({
					message: "[Upload] Upload started",
					attributes: {
						purpose,
						entityId,
						fileName: file.name,
						fileSize: file.size,
						mimeType: file.type,
					},
				})

				// Authorization check
				const authCheck = await checkUploadAuthorization(
					purpose,
					entityId,
					session.user.id,
				)
				if (!authCheck.authorized) {
					logWarning({
						message: "[Upload] Authorization denied",
						attributes: {
							purpose,
							entityId,
							reason: authCheck.error,
						},
					})
					return json(
						{ error: authCheck.error || "Forbidden" },
						{ status: 403 },
					)
				}

				const config = PURPOSE_CONFIG[purpose]
				const maxSizeBytes = config.maxSizeMb * 1024 * 1024

				if (file.size > maxSizeBytes) {
					logWarning({
						message: "[Upload] File too large",
						attributes: {
							purpose,
							fileSize: file.size,
							maxSize: maxSizeBytes,
						},
					})
					return json(
						{ error: `File too large. Maximum size is ${config.maxSizeMb}MB` },
						{ status: 400 },
					)
				}

				if (!config.allowedTypes.includes(file.type)) {
					logWarning({
						message: "[Upload] Invalid file type",
						attributes: {
							purpose,
							mimeType: file.type,
							allowedTypes: config.allowedTypes,
						},
					})
					const allowedTypeNames =
						purpose === "judging-sheet" ? "PDF" : "JPEG, PNG, WebP, GIF"
					return json(
						{ error: `Invalid file type. Allowed: ${allowedTypeNames}` },
						{ status: 400 },
					)
				}

				const extension = file.name.split(".").pop() || "jpg"
				const timestamp = Date.now()
				const filename = `${timestamp}.${extension}`
				const key = entityId
					? `${config.pathPrefix}/${entityId}/${filename}`
					: `${config.pathPrefix}/${session.user.id}/${filename}`

				try {
					await env.R2_BUCKET.put(key, await file.arrayBuffer(), {
						httpMetadata: {
							contentType: file.type,
						},
						customMetadata: {
							uploadedBy: session.user.id,
							purpose,
							originalFilename: file.name,
						},
					})

					const publicUrl = env.R2_PUBLIC_URL
						? `${env.R2_PUBLIC_URL}/${key}`
						: key

					addRequestContextAttribute("uploadKey", key)

					logInfo({
						message: "[Upload] Upload completed",
						attributes: {
							purpose,
							entityId,
							key,
							fileSize: file.size,
						},
					})

					return json({
						url: publicUrl,
						key,
						// Additional metadata useful for judging sheets and other document uploads
						originalFilename: file.name,
						fileSize: file.size,
						mimeType: file.type,
					})
				} catch (err) {
					logError({
						message: "[Upload] R2 upload failed",
						error: err,
						attributes: {
							purpose,
							entityId,
							key,
						},
					})
					return json({ error: "Upload failed" }, { status: 500 })
				}
			},
		},
	},
})
