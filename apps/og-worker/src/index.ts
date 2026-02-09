import { ImageResponse } from "workers-og"
import {
	type CompetitionData,
	CompetitionTemplate,
} from "./templates/competition"
import { DefaultTemplate } from "./templates/default"

export interface Env {
	DB: D1Database
}

async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer> {
	const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`
	const css = await (
		await fetch(url, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
			},
		})
	).text()

	const fontUrl = css.match(/src: url\((.+?)\)/)?.[1]
	if (!fontUrl) throw new Error(`Font not found: ${family}`)

	return fetch(fontUrl).then((r) => r.arrayBuffer())
}

async function loadFonts() {
	const [regular, bold] = await Promise.all([
		loadGoogleFont("Inter", 400),
		loadGoogleFont("Inter", 700),
	])
	return [
		{ name: "Inter", data: regular, weight: 400, style: "normal" as const },
		{ name: "Inter", data: bold, weight: 700, style: "normal" as const },
	]
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url)
		const path = url.pathname

		if (path === "/health") {
			return new Response("OK", { status: 200 })
		}

		const competitionMatch = path.match(/^\/competition\/([^/]+)$/)
		if (competitionMatch?.[1]) {
			return generateCompetitionOG(competitionMatch[1], env)
		}

		return generateDefaultOG()
	},
}

async function generateCompetitionOG(
	slug: string,
	env: Env,
): Promise<Response> {
	try {
		const [row, fonts] = await Promise.all([
			env.DB.prepare(
				`SELECT
					c.name, c.slug, c.description,
					c.profileImageUrl, c.bannerImageUrl,
					c.startDate, c.endDate, c.timezone,
					c.competitionType,
					c.registrationOpensAt, c.registrationClosesAt,
					t.name AS teamName, t.avatarUrl AS teamAvatarUrl,
					a.city AS city, a.stateProvince AS stateProvince
				FROM competitions c
				LEFT JOIN team t ON t.id = c.organizingTeamId
				LEFT JOIN addresses a ON a.id = c.primaryAddressId
				WHERE c.slug = ? AND c.status = 'published'
				LIMIT 1`,
			)
				.bind(slug)
				.first(),
			loadFonts(),
		])

		if (!row) {
			return generateDefaultOG()
		}

		// Validate profile image is reachable (satori crashes on bad URLs)
		const candidateLogoUrl =
			(row.profileImageUrl as string | null) ||
			(row.teamAvatarUrl as string | null)
		const logoUrl = candidateLogoUrl
			? await validateImageUrl(candidateLogoUrl)
			: null

		const location =
			row.city && row.stateProvince
				? `${row.city as string}, ${row.stateProvince as string}`
				: row.city
					? (row.city as string)
					: null

		const competition: CompetitionData = {
			name: row.name as string,
			slug: row.slug as string,
			description: row.description as string | null,
			logoUrl,
			startDate: row.startDate as string,
			endDate: row.endDate as string,
			timezone: (row.timezone as string) || "America/Denver",
			competitionType: row.competitionType as "in-person" | "online",
			registrationOpensAt: row.registrationOpensAt as string | null,
			registrationClosesAt: row.registrationClosesAt as string | null,
			location,
			organizingTeam: row.teamName
				? { name: row.teamName as string }
				: null,
		}

		return new ImageResponse(CompetitionTemplate({ competition }), {
			width: 1200,
			height: 630,
			fonts,
			headers: getCacheHeaders(),
		})
	} catch (error) {
		console.error("OG generation failed:", error)
		return generateDefaultOG()
	}
}

async function generateDefaultOG(): Promise<Response> {
	const fonts = await loadFonts()
	return new ImageResponse(DefaultTemplate(), {
		width: 1200,
		height: 630,
		fonts,
		headers: getCacheHeaders(),
	})
}

async function validateImageUrl(url: string): Promise<string | null> {
	try {
		const res = await fetch(url, { method: "HEAD" })
		const contentType = res.headers.get("content-type") || ""
		if (res.ok && contentType.startsWith("image/")) {
			return url
		}
		return null
	} catch {
		return null
	}
}

function getCacheHeaders(): Record<string, string> {
	return {
		"Cache-Control": "public, max-age=3600, s-maxage=86400",
		"CDN-Cache-Control": "max-age=604800",
	}
}
