import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { getSessionFromCookie } from "~/utils/auth"
import { hasTeamPermission } from "~/utils/team-auth"
import { TEAM_PERMISSIONS } from "~/db/schemas/teams"
import { getCompetition } from "~/server/competitions"
import { getCloudflareContext } from "@opennextjs/cloudflare"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

const PURPOSE_CONFIG: Record<
	string,
	{ maxSizeMb: number; pathPrefix: string }
> = {
	"competition-profile": { maxSizeMb: 5, pathPrefix: "competitions/profiles" },
	"competition-banner": { maxSizeMb: 5, pathPrefix: "competitions/banners" },
	"competition-sponsor-logo": {
		maxSizeMb: 2,
		pathPrefix: "competitions/sponsors",
	},
	"athlete-profile": { maxSizeMb: 2, pathPrefix: "athletes/profiles" },
	"athlete-cover": { maxSizeMb: 5, pathPrefix: "athletes/covers" },
	"sponsor-logo": { maxSizeMb: 2, pathPrefix: "sponsors/logos" },
}

/**
 * Check if user has permission to upload for the given entity
 */
async function checkUploadAuthorization(
	purpose: string,
	entityId: string | null,
	userId: string,
): Promise<{ authorized: boolean; error?: string }> {
	// Competition uploads require team permission
	if (purpose.startsWith("competition-") && entityId) {
		const competition = await getCompetition(entityId)
		if (!competition) {
			return { authorized: false, error: "Competition not found" }
		}
		const hasPermission = await hasTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)
		if (!hasPermission) {
			return {
				authorized: false,
				error: "Not authorized to upload for this competition",
			}
		}
		return { authorized: true }
	}

	// Athlete uploads can only be for the current user
	if (purpose.startsWith("athlete-") && entityId) {
		if (entityId !== userId) {
			return {
				authorized: false,
				error: "Not authorized to upload for this athlete",
			}
		}
		return { authorized: true }
	}

	// Sponsor uploads require entityId to be the user's own or a team they manage
	// For now, allow only if entityId matches user or is not provided
	if (purpose === "sponsor-logo" && entityId && entityId !== userId) {
		return { authorized: false, error: "Not authorized to upload sponsor logo" }
	}

	return { authorized: true }
}

export const Route = createFileRoute("/api/upload")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const session = await getSessionFromCookie()
				if (!session) {
					return json({ error: "Unauthorized" }, { status: 401 })
				}

				const formData = await request.formData()
				const file = formData.get("file") as File | null
				const purpose = formData.get("purpose") as string | null
				const entityId = formData.get("entityId") as string | null

				if (!file) {
					return json({ error: "No file provided" }, { status: 400 })
				}

				if (!purpose || !PURPOSE_CONFIG[purpose]) {
					return json({ error: "Invalid or missing purpose" }, { status: 400 })
				}

				// Authorization check
				const authCheck = await checkUploadAuthorization(
					purpose,
					entityId,
					session.user.id,
				)
				if (!authCheck.authorized) {
					return json(
						{ error: authCheck.error || "Forbidden" },
						{ status: 403 },
					)
				}

				const config = PURPOSE_CONFIG[purpose]
				const maxSizeBytes = config.maxSizeMb * 1024 * 1024

				if (file.size > maxSizeBytes) {
					return json(
						{
							error: `File too large. Maximum size is ${config.maxSizeMb}MB`,
						},
						{ status: 400 },
					)
				}

				if (!ALLOWED_TYPES.includes(file.type)) {
					return json(
						{
							error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF",
						},
						{ status: 400 },
					)
				}

				const extension = file.name.split(".").pop() || "jpg"
				const timestamp = Date.now()
				const filename = `${timestamp}.${extension}`
				const key = entityId
					? `${config.pathPrefix}/${entityId}/${filename}`
					: `${config.pathPrefix}/${session.user.id}/${filename}`

				const { env } = getCloudflareContext()

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

				return json({
					url: publicUrl,
					key,
				})
			},
		},
	},
})
