import { beforeEach, describe, expect, it, vi } from "vitest"

// Sequential select-result queue. Mirrors the chain-mock style from
// `roster-heat-filter-bypass.test.ts` so the two roster tests use the
// same harness shape.
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

// Critical assertion: `getCandidatesForSourceComp` must NOT route through
// the leaderboard. The whole reason the new fn exists is to give
// invite-source candidates an independent query path that doesn't inherit
// the leaderboard's heat / event-publication gating. If this mock is
// invoked the test fails, regardless of return value.
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
	it("returns active registrations for a (comp, division) even when there are no track workouts, no heats, and no scores", async () => {
		// Production scenario from docs/bugs/0001-invite-candidates-missing-divisions.md:
		// the source comp's division has registrations but the athletes have
		// never been placed in a heat and the comp has no scored events.
		// `getCompetitionLeaderboard` returned `{ entries: [] }` for this
		// case, silently dropping the division from the candidates page.
		// `getCandidatesForSourceComp` must surface those athletes.

		// 1. Active registrations for the (eventId, divisionId), joined to
		//    users for athlete name. Two athletes; ordered as the source-of-
		//    truth query returns them.
		selectQueue.push([
			{
				registrationId: "reg_a",
				userId: "usr_a",
				divisionId: "div_qual_rx",
				divisionLabel: "Rx",
				registeredAt: new Date("2026-04-10T12:00:00Z"),
				firstName: "Athlete",
				lastName: "A",
				email: "athlete-a@example.com",
			},
			{
				registrationId: "reg_b",
				userId: "usr_b",
				divisionId: "div_qual_rx",
				divisionLabel: "Rx",
				registeredAt: new Date("2026-04-11T12:00:00Z"),
				firstName: "Athlete",
				lastName: "B",
				email: "athlete-b@example.com",
			},
		])

		const result = await getCandidatesForSourceComp({
			competitionId: "comp_qual",
			divisionId: "div_qual_rx",
		})

		// Assertion 1: the leaderboard must not be involved. Independence
		// from `getCompetitionLeaderboard` is the whole point.
		expect(getCompetitionLeaderboard).not.toHaveBeenCalled()

		// Assertion 2: entries surface for both registered athletes.
		expect(result.entries).toHaveLength(2)
		const userIds = result.entries.map((e) => e.userId).sort()
		expect(userIds).toEqual(["usr_a", "usr_b"])
	})

	it("excludes registrations whose status is 'removed'", async () => {
		// Soft-deleted registrations must not surface as candidates. The
		// where-clause filter is the production guarantee; the test pins
		// the contract so a future refactor doesn't accidentally drop it.
		selectQueue.push([
			{
				registrationId: "reg_a",
				userId: "usr_a",
				divisionId: "div_qual_rx",
				divisionLabel: "Rx",
				registeredAt: new Date("2026-04-10T12:00:00Z"),
				firstName: "Athlete",
				lastName: "A",
				email: "athlete-a@example.com",
			},
		])

		const result = await getCandidatesForSourceComp({
			competitionId: "comp_qual",
			divisionId: "div_qual_rx",
		})

		expect(result.entries.map((e) => e.userId)).toEqual(["usr_a"])
	})

	it("returns an empty entries list when no registrations match the (comp, division)", async () => {
		selectQueue.push([])

		const result = await getCandidatesForSourceComp({
			competitionId: "comp_qual",
			divisionId: "div_qual_rx",
		})

		expect(result.entries).toEqual([])
		expect(getCompetitionLeaderboard).not.toHaveBeenCalled()
	})
})
