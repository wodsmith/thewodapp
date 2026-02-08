import { ImageResponse } from "workers-og"
import { CompetitionTemplate } from "./templates/competition"
import { DefaultTemplate } from "./templates/default"

export interface Env {
	WODSMITH_API_URL: string
	API_SECRET: string
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url)
		const path = url.pathname

		if (path === "/health") {
			return new Response("OK", { status: 200 })
		}

		const competitionMatch = path.match(/^\/competition\/([^/]+)$/)
		if (competitionMatch) {
			const slug = competitionMatch[1]
			return generateCompetitionOG(slug, env)
		}

		return generateDefaultOG()
	},
}

async function generateCompetitionOG(slug: string, env: Env): Promise<Response> {
	try {
		const response = await fetch(
			`${env.WODSMITH_API_URL}/api/internal/og-data/competition/${slug}`,
			{
				headers: {
					Authorization: `Bearer ${env.API_SECRET}`,
				},
			},
		)

		if (!response.ok) {
			console.error(`Failed to fetch competition ${slug}: ${response.status}`)
			return generateDefaultOG()
		}

		const competition = await response.json()

		return new ImageResponse(CompetitionTemplate({ competition }), {
			width: 1200,
			height: 630,
			headers: getCacheHeaders(),
		})
	} catch (error) {
		console.error("OG generation failed:", error)
		return generateDefaultOG()
	}
}

function generateDefaultOG(): Promise<Response> {
	return new ImageResponse(DefaultTemplate(), {
		width: 1200,
		height: 630,
		headers: getCacheHeaders(),
	})
}

function getCacheHeaders(): Record<string, string> {
	return {
		"Cache-Control": "public, max-age=3600, s-maxage=86400",
		"CDN-Cache-Control": "max-age=604800",
	}
}
