import { describe, expect, it } from "vitest"
import {
	bucketDocsForMatches,
	isDirectVideoFileUrl,
	labelForRouteId,
	orderDocsForMatches,
	type RouteDocForViewer,
} from "@/utils/route-docs"

function makeDoc(
	overrides: Partial<RouteDocForViewer> & { id: string },
): RouteDocForViewer {
	return {
		title: overrides.id,
		description: null,
		type: "markdown",
		content: "content",
		videoUrl: null,
		linkUrl: null,
		sortOrder: 1,
		routeIds: [],
		...overrides,
	}
}

describe("route-docs", () => {
	// @lat: [[route-docs#Workspace sidebar#Orders docs leaf-route first]]
	describe("orderDocsForMatches", () => {
		const matchChain = [
			"/compete/organizer",
			"/compete/organizer/$competitionId",
			"/compete/organizer/$competitionId/schedule",
		]

		it("puts docs attached to the leaf route before layout-level docs", () => {
			const layoutDoc = makeDoc({
				id: "layout",
				routeIds: ["/compete/organizer/$competitionId"],
			})
			const leafDoc = makeDoc({
				id: "leaf",
				routeIds: ["/compete/organizer/$competitionId/schedule"],
			})

			const ordered = orderDocsForMatches([layoutDoc, leafDoc], matchChain)

			expect(ordered.map((doc) => doc.id)).toEqual(["leaf", "layout"])
		})

		it("uses the deepest matched route when a doc maps to several", () => {
			const multiRouteDoc = makeDoc({
				id: "multi",
				routeIds: [
					"/compete/organizer",
					"/compete/organizer/$competitionId/schedule",
				],
			})
			const midDoc = makeDoc({
				id: "mid",
				routeIds: ["/compete/organizer/$competitionId"],
			})

			const ordered = orderDocsForMatches([midDoc, multiRouteDoc], matchChain)

			expect(ordered.map((doc) => doc.id)).toEqual(["multi", "mid"])
		})

		it("orders by sortOrder then title within the same route depth", () => {
			const routeIds = ["/compete/organizer/$competitionId/schedule"]
			const second = makeDoc({
				id: "b",
				title: "B doc",
				sortOrder: 2,
				routeIds,
			})
			const firstByTitle = makeDoc({
				id: "a",
				title: "A doc",
				sortOrder: 1,
				routeIds,
			})
			const firstBySort = makeDoc({
				id: "c",
				title: "C doc",
				sortOrder: 1,
				routeIds,
			})

			const ordered = orderDocsForMatches(
				[second, firstBySort, firstByTitle],
				matchChain,
			)

			expect(ordered.map((doc) => doc.id)).toEqual(["a", "c", "b"])
		})

		it("does not mutate the input array", () => {
			const docs = [
				makeDoc({ id: "one", routeIds: [matchChain[2] as string] }),
				makeDoc({ id: "two", routeIds: [matchChain[0] as string] }),
			]
			const copy = [...docs]

			orderDocsForMatches(docs, matchChain)

			expect(docs).toEqual(copy)
		})
	})

	// @lat: [[route-docs#Workspace sidebar#Buckets page docs from section docs]]
	describe("bucketDocsForMatches", () => {
		const matchChain = [
			"/compete/organizer",
			"/compete/organizer/$competitionId",
			"/compete/organizer/$competitionId/schedule",
		]

		it("splits leaf-route docs (page) from inherited layout docs (section)", () => {
			const layoutDoc = makeDoc({
				id: "layout",
				routeIds: ["/compete/organizer/$competitionId"],
			})
			const leafDoc = makeDoc({
				id: "leaf",
				routeIds: ["/compete/organizer/$competitionId/schedule"],
			})

			const { page, section } = bucketDocsForMatches(
				[layoutDoc, leafDoc],
				matchChain,
			)

			expect(page.map((doc) => doc.id)).toEqual(["leaf"])
			expect(section.map((doc) => doc.id)).toEqual(["layout"])
		})

		it("treats a doc mapped to both leaf and an ancestor as a page doc", () => {
			const multiRouteDoc = makeDoc({
				id: "multi",
				routeIds: [
					"/compete/organizer",
					"/compete/organizer/$competitionId/schedule",
				],
			})

			const { page, section } = bucketDocsForMatches([multiRouteDoc], matchChain)

			expect(page.map((doc) => doc.id)).toEqual(["multi"])
			expect(section).toEqual([])
		})

		it("matches an index-route leaf to its slashless doc mapping", () => {
			// The competition overview is an index route, so its leaf match is
			// slashed (`…/$competitionId/`) while the doc is mapped to the
			// canonical slashless id.
			const indexChain = [
				"/compete/organizer",
				"/compete/organizer/$competitionId",
				"/compete/organizer/$competitionId/",
			]
			const overviewDoc = makeDoc({
				id: "overview",
				routeIds: ["/compete/organizer/$competitionId"],
			})

			const { page, section } = bucketDocsForMatches([overviewDoc], indexChain)

			expect(page.map((doc) => doc.id)).toEqual(["overview"])
			expect(section).toEqual([])
		})

		it("returns everything as section docs when the leaf has no docs", () => {
			const layoutDoc = makeDoc({
				id: "layout",
				routeIds: ["/compete/organizer/$competitionId"],
			})

			const { page, section } = bucketDocsForMatches([layoutDoc], matchChain)

			expect(page).toEqual([])
			expect(section.map((doc) => doc.id)).toEqual(["layout"])
		})
	})

	describe("labelForRouteId", () => {
		it("maps known organizer segments to readable labels", () => {
			expect(
				labelForRouteId("/compete/organizer/$competitionId/schedule"),
			).toBe("Heat schedule")
			expect(labelForRouteId("/compete/organizer/$competitionId")).toBe(
				"Competition",
			)
		})

		it("ignores pathless layout segments and title-cases unknown ones", () => {
			expect(labelForRouteId("/compete/organizer/_dashboard/widgets")).toBe(
				"Widgets",
			)
			expect(labelForRouteId("/compete/organizer/$competitionId/foo-bar")).toBe(
				"Foo Bar",
			)
		})
	})

	// @lat: [[route-docs#Workspace sidebar#Detects direct video files]]
	describe("isDirectVideoFileUrl", () => {
		it("accepts direct video file URLs (R2 uploads)", () => {
			expect(
				isDirectVideoFileUrl(
					"https://uploads.wodsmith.com/docs/videos/usr_1/123.mp4",
				),
			).toBe(true)
			expect(isDirectVideoFileUrl("https://example.com/clip.WEBM")).toBe(true)
			expect(isDirectVideoFileUrl("https://example.com/clip.mov")).toBe(true)
		})

		it("rejects platform URLs that need an embed", () => {
			expect(
				isDirectVideoFileUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
			).toBe(false)
			expect(isDirectVideoFileUrl("https://vimeo.com/123456789")).toBe(false)
		})

		it("ignores video-looking query params and invalid URLs", () => {
			expect(
				isDirectVideoFileUrl("https://example.com/page?file=demo.mp4"),
			).toBe(false)
			expect(isDirectVideoFileUrl("not a url.mp4")).toBe(false)
		})
	})
})
