import { beforeEach, describe, expect, it, vi } from "vitest"

// Sequential select-result queue. Mirrors the chain-mock style from
// `roster-heat-filter-bypass.test.ts` so the two roster tests use the
// same harness shape. Used here to mock the email-hydration query the
// candidates module fires after `getCompetitionLeaderboard` returns.
const selectQueue: unknown[][] = []

function makeChain(): unknown {
	const chain: Record<string, unknown> = {}
	const noop = () => chain
	for (const m of [
		"from",
		"where",
		"limit",
		"innerJoin",
		"leftJoin",
		"orderBy",
	]) {
		chain[m] = vi.fn(noop)
	}
	chain.then = (resolve: (value: unknown) => void) => {
		const next = selectQueue.shift() ?? []
		resolve(next)
		return Promise.resolve(next)
	}
	return chain
}

const fakeDb = {
	select: vi.fn(() => makeChain()),
}

vi.mock("@/db", () => ({
	getDb: vi.fn(() => fakeDb),
}))

vi.mock("cloudflare:workers", () => ({
	env: { APP_URL: "https://test.wodsmith.com" },
}))

// Critical assertion: `getCandidatesForSourceComp` MUST route through
// `getCompetitionLeaderboard` so the candidates page mirrors the
// qualifier's leaderboard exactly. The bug this guards against is
// "athlete X placed 3rd on the qualifier but shows up as 1st on the
// invite roster" — the two surfaces must agree on rank for organizers
// to use the candidates page as a source of truth.
const getCompetitionLeaderboard = vi.fn()
vi.mock("@/server/competition-leaderboard", () => ({
	getCompetitionLeaderboard: (...args: unknown[]) =>
		getCompetitionLeaderboard(...args),
}))

import { getCandidatesForSourceComp } from "@/server/competition-invites/candidates"

beforeEach(() => {
	selectQueue.length = 0
	fakeDb.select.mockClear()
	getCompetitionLeaderboard.mockReset()
})

// @lat: [[competition-invites#Candidates query]]
describe("getCandidatesForSourceComp", () => {
	it("returns leaderboard-ranked candidates for the (comp, division), preserving overallRank from getCompetitionLeaderboard", async () => {
		// Three athletes ranked on the qualifier's leaderboard. The
		// candidates page must render them in this exact order so an
		// organizer comparing the two screens sees the same #1, #2, #3.
		getCompetitionLeaderboard.mockResolvedValueOnce({
			entries: [
				{
					registrationId: "reg_a",
					userId: "usr_a",
					athleteName: "Athlete A",
					divisionId: "div_qual_rx",
					divisionLabel: "Rx",
					totalPoints: 90,
					overallRank: 1,
					isTeamDivision: false,
					teamName: null,
					teamMembers: [],
					affiliate: null,
					eventResults: [],
				},
				{
					registrationId: "reg_b",
					userId: "usr_b",
					athleteName: "Athlete B",
					divisionId: "div_qual_rx",
					divisionLabel: "Rx",
					totalPoints: 80,
					overallRank: 2,
					isTeamDivision: false,
					teamName: null,
					teamMembers: [],
					affiliate: null,
					eventResults: [],
				},
				{
					registrationId: "reg_c",
					userId: "usr_c",
					athleteName: "Athlete C",
					divisionId: "div_qual_rx",
					divisionLabel: "Rx",
					totalPoints: 70,
					overallRank: 3,
					isTeamDivision: false,
					teamName: null,
					teamMembers: [],
					affiliate: null,
					eventResults: [],
				},
			],
			scoringConfig: {} as unknown,
			events: [],
		})

		// Email-hydration query result.
		selectQueue.push([
			{ id: "usr_a", email: "athlete-a@example.com" },
			{ id: "usr_b", email: "athlete-b@example.com" },
			{ id: "usr_c", email: "athlete-c@example.com" },
		])

		const result = await getCandidatesForSourceComp({
			competitionId: "comp_qual",
			divisionId: "div_qual_rx",
		})

		// Assertion 1: the leaderboard is the source of truth — the
		// candidates query must call it with the right arguments and
		// with `bypassPublicationFilter: true` so the organizer-only
		// candidates page surfaces standings even before the qualifier
		// publishes per-division results.
		expect(getCompetitionLeaderboard).toHaveBeenCalledTimes(1)
		expect(getCompetitionLeaderboard).toHaveBeenCalledWith({
			competitionId: "comp_qual",
			divisionId: "div_qual_rx",
			bypassPublicationFilter: true,
		})

		// Assertion 2: rows surface in leaderboard order, with
		// `overallRank` mirroring the leaderboard's value 1:1.
		expect(result.entries.map((e) => e.userId)).toEqual([
			"usr_a",
			"usr_b",
			"usr_c",
		])
		expect(result.entries.map((e) => e.overallRank)).toEqual([1, 2, 3])
		expect(result.entries.map((e) => e.totalPoints)).toEqual([90, 80, 70])

		// Assertion 3: emails are hydrated by userId.
		expect(
			Object.fromEntries(result.entries.map((e) => [e.userId, e.athleteEmail])),
		).toEqual({
			usr_a: "athlete-a@example.com",
			usr_b: "athlete-b@example.com",
			usr_c: "athlete-c@example.com",
		})
	})

	it("re-sorts entries by overallRank ascending even when the leaderboard returns them out of order", async () => {
		// Defensive: a future change to `getCompetitionLeaderboard`'s
		// ordering must not silently shuffle the candidates page. The
		// candidates contract is "ascending overallRank" regardless of
		// upstream order.
		getCompetitionLeaderboard.mockResolvedValueOnce({
			entries: [
				{
					registrationId: "reg_b",
					userId: "usr_b",
					athleteName: "Athlete B",
					divisionId: "div_qual_rx",
					divisionLabel: "Rx",
					totalPoints: 80,
					overallRank: 2,
					isTeamDivision: false,
					teamName: null,
					teamMembers: [],
					affiliate: null,
					eventResults: [],
				},
				{
					registrationId: "reg_a",
					userId: "usr_a",
					athleteName: "Athlete A",
					divisionId: "div_qual_rx",
					divisionLabel: "Rx",
					totalPoints: 90,
					overallRank: 1,
					isTeamDivision: false,
					teamName: null,
					teamMembers: [],
					affiliate: null,
					eventResults: [],
				},
			],
			scoringConfig: {} as unknown,
			events: [],
		})

		selectQueue.push([
			{ id: "usr_a", email: "athlete-a@example.com" },
			{ id: "usr_b", email: "athlete-b@example.com" },
		])

		const result = await getCandidatesForSourceComp({
			competitionId: "comp_qual",
			divisionId: "div_qual_rx",
		})

		expect(result.entries.map((e) => e.userId)).toEqual(["usr_a", "usr_b"])
	})

	it("returns an empty entries list when the leaderboard has no entries (no email lookup fired)", async () => {
		getCompetitionLeaderboard.mockResolvedValueOnce({
			entries: [],
			scoringConfig: {} as unknown,
			events: [],
		})

		const result = await getCandidatesForSourceComp({
			competitionId: "comp_qual",
			divisionId: "div_qual_rx",
		})

		expect(result.entries).toEqual([])
		// Skip the email lookup when there are no userIds to hydrate.
		expect(fakeDb.select).not.toHaveBeenCalled()
	})

	it("surfaces a candidate even when their user row has no email on file (athleteEmail = null)", async () => {
		getCompetitionLeaderboard.mockResolvedValueOnce({
			entries: [
				{
					registrationId: "reg_a",
					userId: "usr_a",
					athleteName: "Athlete A",
					divisionId: "div_qual_rx",
					divisionLabel: "Rx",
					totalPoints: 0,
					overallRank: 1,
					isTeamDivision: false,
					teamName: null,
					teamMembers: [],
					affiliate: null,
					eventResults: [],
				},
			],
			scoringConfig: {} as unknown,
			events: [],
		})

		// User row exists but has a null email column.
		selectQueue.push([{ id: "usr_a", email: null }])

		const result = await getCandidatesForSourceComp({
			competitionId: "comp_qual",
			divisionId: "div_qual_rx",
		})

		expect(result.entries).toHaveLength(1)
		expect(result.entries[0].athleteEmail).toBeNull()
	})
})
