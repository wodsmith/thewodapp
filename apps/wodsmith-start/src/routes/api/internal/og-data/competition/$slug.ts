import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { getInternalApiSecret } from "@/lib/env"
import { getDb } from "@/db"
import { competitionsTable } from "@/db/schema"
import { eq, and } from "drizzle-orm"

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false
	const encoder = new TextEncoder()
	const bufA = encoder.encode(a)
	const bufB = encoder.encode(b)
	let result = 0
	for (let i = 0; i < bufA.length; i++) {
		result |= bufA[i] ^ bufB[i]
	}
	return result === 0
}

export const Route = createFileRoute(
	"/api/internal/og-data/competition/$slug",
)({
	server: {
		handlers: {
			GET: async ({
				request,
				params,
			}: { request: Request; params: { slug: string } }) => {
				const secret = getInternalApiSecret()
				if (!secret) {
					return json({ error: "Not configured" }, { status: 500 })
				}

				const authHeader = request.headers.get("Authorization")
				const providedSecret = authHeader?.replace("Bearer ", "")

				if (!providedSecret || !timingSafeEqual(providedSecret, secret)) {
					return json({ error: "Unauthorized" }, { status: 401 })
				}

				const { slug } = params

				const db = getDb()
				const competition = await db.query.competitionsTable.findFirst({
					where: and(
						eq(competitionsTable.slug, slug),
						eq(competitionsTable.status, "published"),
					),
					with: {
						organizingTeam: {
							columns: { name: true, avatarUrl: true },
						},
					},
					columns: {
						name: true,
						slug: true,
						description: true,
						profileImageUrl: true,
						bannerImageUrl: true,
						startDate: true,
						endDate: true,
						timezone: true,
						competitionType: true,
					},
				})

				if (!competition) {
					return json(
						{ error: "Competition not found" },
						{ status: 404 },
					)
				}

				return json(competition, {
					headers: {
						"Cache-Control": "private, max-age=60",
					},
				})
			},
		},
	},
})
