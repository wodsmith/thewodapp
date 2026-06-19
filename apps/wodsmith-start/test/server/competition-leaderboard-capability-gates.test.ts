import { describe, expect, it } from "vitest"
import {
	resolveLeaderboardDivisionResults,
	shouldFetchLeaderboardVideoSubmissions,
} from "@/server/competition-leaderboard"
import type { CompetitionSettings } from "@/types/competitions"

describe("competition leaderboard capability gates", () => {
	describe("resolveLeaderboardDivisionResults", () => {
		it("defaults online competitions to hidden-by-division when settings omit divisionResults", () => {
			expect(
				resolveLeaderboardDivisionResults({
					bypassPublicationFilter: false,
					competitionType: "online",
					settings: {},
				}),
			).toEqual({})
		})

		it("defaults in-person competitions to ungated results when settings omit divisionResults", () => {
			expect(
				resolveLeaderboardDivisionResults({
					bypassPublicationFilter: false,
					competitionType: "in-person",
					settings: {},
				}),
			).toBeUndefined()
		})

		it("preserves explicit divisionResults for either competition type", () => {
			const divisionResults: NonNullable<CompetitionSettings["divisionResults"]> =
				{
					"event-1": {
						"division-1": { publishedAt: 1_720_000_000 },
					},
				}

			expect(
				resolveLeaderboardDivisionResults({
					bypassPublicationFilter: false,
					competitionType: "in-person",
					settings: { divisionResults },
				}),
			).toBe(divisionResults)
		})

		it("bypasses result publishing when organizer preview requests it", () => {
			expect(
				resolveLeaderboardDivisionResults({
					bypassPublicationFilter: true,
					competitionType: "online",
					settings: {
						divisionResults: {
							"event-1": {
								"division-1": { publishedAt: null },
							},
						},
					},
				}),
			).toBeUndefined()
		})
	})

	describe("shouldFetchLeaderboardVideoSubmissions", () => {
		it("fetches submissions only for online competitions with registrations", () => {
			expect(
				shouldFetchLeaderboardVideoSubmissions({
					competitionType: "online",
					registrationCount: 1,
				}),
			).toBe(true)
		})

		it("skips submissions for in-person competitions", () => {
			expect(
				shouldFetchLeaderboardVideoSubmissions({
					competitionType: "in-person",
					registrationCount: 1,
				}),
			).toBe(false)
		})

		it("skips submissions when no registrations are visible", () => {
			expect(
				shouldFetchLeaderboardVideoSubmissions({
					competitionType: "online",
					registrationCount: 0,
				}),
			).toBe(false)
		})
	})
})
