/**
 * Captures screenshots of demo.wodsmith.com from multiple user perspectives.
 *
 * Usage: bun run apps/docs/scripts/capture-screenshots.ts [perspective]
 *   perspective = athlete | organizer | judge | all (default: all)
 */

import { chromium } from "playwright"
type Page = Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>>

import { mkdirSync } from "node:fs"
import { resolve } from "node:path"

const BASE_URL = "https://demo.wodsmith.com"
const STATIC_DIR = resolve(import.meta.dirname, "../../docs/static/img")
const VIEWPORT = { width: 1440, height: 900 }
const PASSWORD = "password123"

const COMPETITION_SLUG = "winter-throwdown-2025"
const ONLINE_SLUG = "online-qualifier-2026"

type Shot = {
	name: string
	url: string
	wait?: string
	full?: boolean
	prep?: (page: Page) => Promise<void>
}

const ATHLETE_EMAIL = "mike@athlete.com"
const ORGANIZER_EMAIL = "admin@example.com"
const JUDGE_EMAIL = "dave.martinez@volunteer.com"

async function login(page: Page, email: string) {
	await page.goto(`${BASE_URL}/sign-in?redirect=/`, { waitUntil: "domcontentloaded" })
	await page.waitForLoadState("load", { timeout: 30000 }).catch(() => {})
	await page.waitForSelector('input[type="email"]', { timeout: 15000 })
	const emailInput = page.locator('input[type="email"]').first()
	const passwordInput = page.locator('input[type="password"]').first()
	await emailInput.click()
	await emailInput.pressSequentially(email, { delay: 25 })
	await passwordInput.click()
	await passwordInput.pressSequentially(PASSWORD, { delay: 25 })
	await page.waitForTimeout(300)
	await page.getByRole("button", { name: /^sign in$/i }).click()
	// Wait for navigation off /sign-in. If the user has 2FA, sign-in stays on
	// the page; we tolerate that and screenshot whatever lands.
	await page.waitForURL((url) => !url.toString().includes("/sign-in"), { timeout: 45000 })
		.catch(async () => {
			console.warn(`login: did not leave /sign-in for ${email}; current url=${page.url()}`)
			await page.screenshot({ path: resolve(STATIC_DIR, `_debug-login-${email.replace(/[@.]/g, "_")}.png`) })
		})
	await page.waitForLoadState("domcontentloaded").catch(() => {})
	await page.waitForTimeout(2000)
	console.log(`login complete: ${email} -> ${page.url()}`)
}

async function logout(page: Page) {
	const ctx = page.context()
	await ctx.clearCookies()
}

async function shoot(page: Page, subdir: string, shots: Shot[]) {
	const outDir = resolve(STATIC_DIR, subdir)
	mkdirSync(outDir, { recursive: true })

	for (const s of shots) {
		console.log(`[${subdir}] ${s.name} -> ${s.url}`)
		try {
			await page.goto(`${BASE_URL}${s.url}`, { waitUntil: "domcontentloaded" })
			await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {})
			if (s.wait) {
				await page.waitForSelector(s.wait, { timeout: 8000 }).catch(() => {})
			}
			// Generous wait so server-loaded content (leaderboard, results) hydrates.
			await page.waitForTimeout(2500)
			if (s.prep) {
				await s.prep(page).catch((e) => console.error(`prep failed:`, e))
				await page.waitForTimeout(600)
			}
			await page.screenshot({
				path: resolve(outDir, `${s.name}.png`),
				fullPage: s.full ?? false,
			})
		} catch (err) {
			console.error(`failed: ${s.name}`, err)
		}
	}
}

async function findFirstCompetitionSlug(
	page: Page,
	preferred: string[] = []
): Promise<string | null> {
	await page.goto(`${BASE_URL}/compete`, { waitUntil: "domcontentloaded" })
	await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {})
	await page.waitForTimeout(2000)
	const slugs: string[] = await page.$$eval("a[href*='/compete/']", (els) =>
		(els as HTMLAnchorElement[])
			.map((a) => a.getAttribute("href") || "")
			.map((h) => h.match(/^\/compete\/([a-z0-9][a-z0-9-]+)\/?$/)?.[1])
			.filter((s): s is string => Boolean(s) && s !== "organizer" && s !== "athlete" && s !== "series")
	)
	for (const p of preferred) {
		if (slugs.includes(p)) return p
	}
	return slugs[0] || null
}

async function captureAthlete(page: Page) {
	await login(page, ATHLETE_EMAIL)

	const slug = (await findFirstCompetitionSlug(page, [COMPETITION_SLUG])) || COMPETITION_SLUG
	console.log("athlete using slug:", slug)

	const shots: Shot[] = [
		{ name: "athlete-landing", url: `/compete/${slug}` },
		{ name: "athlete-workouts", url: `/compete/${slug}/workouts` },
		{ name: "athlete-leaderboard", url: `/compete/${slug}/leaderboard` },
		{ name: "athlete-schedule", url: `/compete/${slug}/schedule` },
		{ name: "athlete-broadcasts", url: `/compete/${slug}/broadcasts` },
		{ name: "athlete-register", url: `/compete/${slug}/register` },
		{ name: "athlete-dashboard", url: `/compete/athlete` },
		{ name: "athlete-events-list", url: `/compete` },
	]
	await shoot(page, "tutorials/athletes", shots.slice(0, 6))
	await shoot(page, "how-to/athletes", shots)
}

async function captureOrganizer(page: Page) {
	await login(page, ORGANIZER_EMAIL)

	// We need the competition id, not slug, for organizer routes.
	// Navigate to the organizer dashboard list to find the competition.
	await page.goto(`${BASE_URL}/compete/organizer`, { waitUntil: "domcontentloaded" })
	await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {})
	await page.waitForTimeout(2000)

	// Pull all organizer competition ids from edit links on the page.
	const allHrefs: string[] = await page.$$eval("a[href*='/compete/organizer/']", (els) =>
		(els as HTMLAnchorElement[]).map((a) => a.getAttribute("href") || "")
	)
	const compIds = Array.from(
		new Set(
			allHrefs
				.map((h) => h.match(/\/compete\/organizer\/(comp_[^/?#]+)/)?.[1])
				.filter((x): x is string => Boolean(x))
		)
	)
	console.log("found competitions:", compIds.length, compIds.slice(0, 5))

	// Pick the first in-person competition for general organizer screenshots.
	let compId: string | null = null
	let onlineCompId: string | null = null
	for (const id of compIds) {
		// Try the overview to determine type — fallback: just take the first.
		await page.goto(`${BASE_URL}/compete/organizer/${id}`, { waitUntil: "domcontentloaded" })
		await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {})
		await page.waitForTimeout(1500)
		const html = await page.content()
		const isOnline = /online/i.test(html) && /submission/i.test(html)
		if (!compId && !isOnline) compId = id
		if (!onlineCompId && isOnline) onlineCompId = id
		if (compId && onlineCompId) break
	}
	if (!compId && compIds[0]) compId = compIds[0]

	console.log("organizer compId:", compId, "onlineCompId:", onlineCompId)

	const shots: Shot[] = [
		{ name: "organizer-list", url: `/compete/organizer` },
		{ name: "organizer-create-form", url: `/compete/organizer/_dashboard/new` },
	]

	if (compId) {
		shots.push(
			{ name: "organizer-overview", url: `/compete/organizer/${compId}` },
			{ name: "organizer-edit", url: `/compete/organizer/${compId}/edit` },
			{ name: "organizer-divisions", url: `/compete/organizer/${compId}/divisions` },
			{ name: "organizer-events", url: `/compete/organizer/${compId}/events` },
			{ name: "organizer-schedule", url: `/compete/organizer/${compId}/schedule` },
			{ name: "organizer-registrations", url: `/compete/organizer/${compId}/athletes` },
			{ name: "organizer-volunteers", url: `/compete/organizer/${compId}/volunteers` },
			{ name: "organizer-results", url: `/compete/organizer/${compId}/results` },
			{ name: "organizer-leaderboard-preview", url: `/compete/organizer/${compId}/leaderboard-preview` },
			{ name: "organizer-broadcasts", url: `/compete/organizer/${compId}/broadcasts` },
			{ name: "organizer-waivers", url: `/compete/organizer/${compId}/waivers` },
			{ name: "organizer-pricing", url: `/compete/organizer/${compId}/pricing` },
			{ name: "organizer-settings", url: `/compete/organizer/${compId}/settings` },
		)
	}

	if (onlineCompId) {
		shots.push(
			{ name: "organizer-online-results", url: `/compete/organizer/${onlineCompId}/results` },
			{ name: "organizer-online-submission-windows", url: `/compete/organizer/${onlineCompId}/submission-windows` },
		)
	}

	await shoot(page, "tutorials/organizers", shots)
	await shoot(page, "how-to/organizers", shots)
}

async function captureJudge(page: Page) {
	await login(page, JUDGE_EMAIL)

	// Find any competition the judge can review/score.
	const slug = (await findFirstCompetitionSlug(page, [ONLINE_SLUG, COMPETITION_SLUG])) || ONLINE_SLUG
	console.log("judge using slug:", slug)

	const shots: Shot[] = [
		{ name: "judge-competition-landing", url: `/compete/${slug}` },
		{ name: "judge-volunteer-page", url: `/compete/${slug}/volunteer` },
		{ name: "judge-review-index", url: `/compete/${slug}/review` },
		{ name: "judge-personal-dashboard", url: `/compete/athlete` },
	]

	await shoot(page, "tutorials/judges", shots)
	await shoot(page, "how-to/judges", shots)

	// Try to deep-link into review/$eventId by navigating then clicking
	try {
		await page.goto(`${BASE_URL}/compete/${slug}/review`, { waitUntil: "domcontentloaded" })
		await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {})
		await page.waitForTimeout(2000)
		const eventLink = page.locator("a[href*='/review/']").first()
		if (await eventLink.count()) {
			const href = await eventLink.getAttribute("href")
			console.log("first review event:", href)
			if (href) {
				await page.goto(`${BASE_URL}${href}`, { waitUntil: "domcontentloaded" })
				await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {})
				await page.waitForTimeout(2000)
				await page.screenshot({
					path: resolve(STATIC_DIR, "how-to/judges/judge-review-event.png"),
					fullPage: false,
				})
				// dive one more into a submission
				const subLink = page.locator("a[href*='/review/']").nth(1)
				if (await subLink.count()) {
					const subHref = await subLink.getAttribute("href")
					if (subHref && subHref !== href) {
						await page.goto(`${BASE_URL}${subHref}`, { waitUntil: "domcontentloaded" })
						await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {})
						await page.waitForTimeout(2500)
						await page.screenshot({
							path: resolve(STATIC_DIR, "how-to/judges/judge-review-submission.png"),
							fullPage: false,
						})
					}
				}
			}
		}
	} catch (err) {
		console.error("judge deep-link failed", err)
	}
}

async function main() {
	const which = (process.argv[2] || "all").toLowerCase()
	const browser = await chromium.launch({ headless: true })
	const ctx = await browser.newContext({ viewport: VIEWPORT })
	const page = await ctx.newPage()

	try {
		if (which === "all" || which === "athlete") {
			console.log("=== ATHLETE ===")
			await captureAthlete(page)
			await logout(page)
		}
		if (which === "all" || which === "organizer") {
			console.log("=== ORGANIZER ===")
			await captureOrganizer(page)
			await logout(page)
		}
		if (which === "all" || which === "judge") {
			console.log("=== JUDGE ===")
			await captureJudge(page)
		}
	} finally {
		await ctx.close()
		await browser.close()
	}
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
