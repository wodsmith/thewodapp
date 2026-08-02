import { describe, expect, it } from "vitest"
import { DEFAULT_SCORING_CONFIG } from "@/lib/scoring"
import {
	resolveLeaderboardDivisionResults,
	resolveLeaderboardScoringConfig,
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

		it("ignores stale divisionResults for perpetual benchmark boards", () => {
			expect(
				resolveLeaderboardDivisionResults({
					bypassPublicationFilter: false,
					competitionType: "benchmark",
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

		it("re-enables the manual publish gate when benchmark pre-publishing is turned off", () => {
			expect(
				resolveLeaderboardDivisionResults({
					bypassPublicationFilter: false,
					competitionType: "benchmark",
					settings: { resultsAutoPublish: false },
				}),
			).toEqual({})

			const divisionResults: NonNullable<
				CompetitionSettings["divisionResults"]
			> = {
				"event-1": {
					"division-1": { publishedAt: 1_720_000_000 },
				},
			}
			expect(
				resolveLeaderboardDivisionResults({
					bypassPublicationFilter: false,
					competitionType: "benchmark",
					settings: { resultsAutoPublish: false, divisionResults },
				}),
			).toBe(divisionResults)
		})

		it("keeps benchmark boards pre-published when the setting is explicitly on", () => {
			expect(
				resolveLeaderboardDivisionResults({
					bypassPublicationFilter: false,
					competitionType: "benchmark",
					settings: { resultsAutoPublish: true },
				}),
			).toBeUndefined()
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

	describe("resolveLeaderboardScoringConfig", () => {
		it("ranks benchmark boards with the online algorithm when no config is stored", () => {
			expect(
				resolveLeaderboardScoringConfig({
					competitionType: "benchmark",
					settings: null,
				}),
			).toEqual({
				...DEFAULT_SCORING_CONFIG,
				algorithm: "online",
				customTable: undefined,
			})
		})

		it("forces stored non-online configs to online for benchmark boards", () => {
			const settings: CompetitionSettings = {
				scoringConfig: {
					algorithm: "traditional",
					traditional: { step: 5, firstPlacePoints: 100 },
					tiebreaker: { primary: "countback" },
					statusHandling: {
						dnf: "last_place",
						dns: "zero",
						withdrawn: "exclude",
					},
				},
			}

			const resolved = resolveLeaderboardScoringConfig({
				competitionType: "benchmark",
				settings,
			})
			expect(resolved.algorithm).toBe("online")
			expect(resolved.customTable).toBeUndefined()
			expect(resolved.statusHandling).toEqual(
				settings.scoringConfig?.statusHandling,
			)
		})

		it("keeps stored configs as-is for non-benchmark competitions", () => {
			const settings: CompetitionSettings = {
				scoringConfig: {
					algorithm: "traditional",
					traditional: { step: 5, firstPlacePoints: 100 },
					tiebreaker: { primary: "countback" },
					statusHandling: {
						dnf: "last_place",
						dns: "zero",
						withdrawn: "exclude",
					},
				},
			}

			expect(
				resolveLeaderboardScoringConfig({
					competitionType: "online",
					settings,
				}),
			).toEqual(settings.scoringConfig)
		})
	})

	describe("shouldFetchLeaderboardVideoSubmissions", () => {
		it("fetches submissions for competition types that support video submissions", () => {
			expect(
				shouldFetchLeaderboardVideoSubmissions({
					competitionType: "online",
					registrationCount: 1,
				}),
			).toBe(true)
			expect(
				shouldFetchLeaderboardVideoSubmissions({
					competitionType: "benchmark",
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
