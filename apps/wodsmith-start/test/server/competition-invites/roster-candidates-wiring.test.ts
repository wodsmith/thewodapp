import { beforeEach, describe, expect, it, vi } from "vitest"

// Sequential select-result queue. Each `db.select(...).from(...)...` chain
// yields the next array we push. Mirrors the pattern from
// `prior-team.test.ts` so the roster tests share a uniform harness.
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

// Forbid the legacy path. The whole architectural reason
// `getCandidatesForSourceComp` exists is to give the roster its own
// query that doesn't inherit the leaderboard's heat / publication
// gating. If this mock is ever invoked we've regressed back to the
// fragile coupling that caused the missing-divisions bug.
const getCompetitionLeaderboard = vi.fn()
vi.mock("@/server/competition-leaderboard", () => ({
	getCompetitionLeaderboard: (...args: unknown[]) =>
		getCompetitionLeaderboard(...args),
}))

const getCandidatesForSourceComp = vi.fn()
vi.mock("@/server/competition-invites/candidates", () => ({
	getCandidatesForSourceComp: (...args: unknown[]) =>
		getCandidatesForSourceComp(...args),
}))

const listSourcesForChampionship = vi.fn()
vi.mock("@/server/competition-invites/sources", () => ({
	listSourcesForChampionship: (...args: unknown[]) =>
		listSourcesForChampionship(...args),
}))

const listAllocationsForChampionship = vi.fn()
const resolveSourceAllocations = vi.fn()
vi.mock("@/server/competition-invites/allocations", () => ({
	listAllocationsForChampionship: (...args: unknown[]) =>
		listAllocationsForChampionship(...args),
	resolveSourceAllocations: (...args: unknown[]) =>
		resolveSourceAllocations(...args),
}))

vi.mock("@/server-fns/competition-divisions-fns", () => ({
	parseCompetitionSettings: vi.fn(() => ({
		divisions: { scalingGroupId: "sg_qual" },
	})),
}))

import {
	COMPETITION_INVITE_SOURCE_KIND,
	type CompetitionInviteSource,
} from "@/db/schemas/competition-invites"
import { getChampionshipRoster } from "@/server/competition-invites/roster"

function sourceFixture(
	overrides: Partial<CompetitionInviteSource> = {},
): CompetitionInviteSource {
	return {
		id: "cisrc_qual",
		championshipCompetitionId: "comp_champ",
		kind: COMPETITION_INVITE_SOURCE_KIND.COMPETITION,
		sourceCompetitionId: "comp_qual",
		sourceGroupId: null,
		globalSpots: 5,
		divisionMappings: null,
		sortOrder: 0,
		notes: null,
		createdAt: new Date("2026-04-01T00:00:00Z"),
		updatedAt: new Date("2026-04-01T00:00:00Z"),
		updateCounter: 0,
		...overrides,
	}
}

beforeEach(() => {
	selectQueue.length = 0
	fakeDb.select.mockClear()
	getCandidatesForSourceComp.mockReset()
	getCompetitionLeaderboard.mockReset()
	listSourcesForChampionship.mockReset()
	listAllocationsForChampionship.mockReset()
	resolveSourceAllocations.mockReset()
})

// @lat: [[competition-invites#Roster computation]]
describe("getChampionshipRoster — wires through getCandidatesForSourceComp", () => {
	it("calls getCandidatesForSourceComp per (sourceComp, division), never getCompetitionLeaderboard, and surfaces the returned athletes with the email already hydrated", async () => {
		listSourcesForChampionship.mockResolvedValueOnce([sourceFixture()])

		listAllocationsForChampionship.mockResolvedValueOnce([])
		resolveSourceAllocations.mockReturnValue({ total: 0, byDivision: {} })

		// DB queries fired before the candidate fan-out (see roster.ts).
		// 1. resolveSourceCompetitions → directComps lookup.
		selectQueue.push([
			{ id: "comp_qual", name: "Qualifier Open", groupId: null },
		])
		// 2. resolveDivisionRefs → competition settings rows.
		selectQueue.push([{ id: "comp_qual", settings: "{}" }])
		// 3. resolveDivisionRefs → scaling levels for the source comp.
		selectQueue.push([
			{
				id: "div_qual_rx",
				label: "Rx",
				scalingGroupId: "sg_qual",
				position: 0,
			},
			{
				id: "div_qual_scaled",
				label: "Scaled",
				scalingGroupId: "sg_qual",
				position: 1,
			},
		])
		// 4. resolveChampionshipDivisions → championship settings row.
		selectQueue.push([{ settings: "{}" }])
		// 5. resolveChampionshipDivisions → championship scaling levels.
		selectQueue.push([
			{ id: "div_champ_rx", label: "Rx", position: 0 },
			{ id: "div_champ_scaled", label: "Scaled", position: 1 },
		])

		// One candidate per division. The candidates fn returns the email
		// inline so the roster doesn't need a separate hydration pass —
		// this assertion is part of the new contract.
		getCandidatesForSourceComp.mockImplementation(async (params: {
			competitionId: string
			divisionId: string
		}) => {
			if (params.divisionId === "div_qual_rx") {
				return {
					entries: [
						{
							registrationId: "reg_a",
							userId: "usr_a",
							athleteName: "Athlete A",
							athleteEmail: "athlete-a@example.com",
							divisionId: "div_qual_rx",
							divisionLabel: "Rx",
							registeredAt: new Date("2026-04-10T12:00:00Z"),
						},
					],
				}
			}
			return {
				entries: [
					{
						registrationId: "reg_b",
						userId: "usr_b",
						athleteName: "Athlete B",
						athleteEmail: "athlete-b@example.com",
						divisionId: "div_qual_scaled",
						divisionLabel: "Scaled",
						registeredAt: new Date("2026-04-11T12:00:00Z"),
					},
				],
			}
		})

		const result = await getChampionshipRoster({
			championshipId: "comp_champ",
		})

		// Assertion 1: leaderboard is forbidden.
		expect(getCompetitionLeaderboard).not.toHaveBeenCalled()

		// Assertion 2: candidates fn called once per (comp, division), with
		// the right arguments.
		expect(getCandidatesForSourceComp).toHaveBeenCalledTimes(2)
		const calls = getCandidatesForSourceComp.mock.calls.map(
			(c) => c[0] as { competitionId: string; divisionId: string },
		)
		const divisionIds = calls.map((c) => c.divisionId).sort()
		expect(divisionIds).toEqual(["div_qual_rx", "div_qual_scaled"])
		for (const c of calls) {
			expect(c.competitionId).toBe("comp_qual")
		}

		// Assertion 3: rows surface each athlete with email hydrated by the
		// candidates fn (the old roster path did a second user lookup; the
		// new path expects email on the entry).
		const byUser = Object.fromEntries(
			result.rows.map((r) => [r.userId, r.athleteEmail]),
		)
		expect(byUser.usr_a).toBe("athlete-a@example.com")
		expect(byUser.usr_b).toBe("athlete-b@example.com")
	})
})

// @lat: [[competition-invites#Roster computation]]
describe("getChampionshipRoster — does not truncate candidates by allocation cutoff", () => {
	// Repro for the production case where Ian's registration on
	// `comp_inv_qualifier` (creg_01KQGX21AH1XSXD4S7X1WQFBT4, Men's RX,
	// active) silently disappeared from the championship Candidates page.
	// The qualifier source had a per-division allocation override of 5
	// spots for the championship's Men's RX, but 6 athletes were actively
	// registered in the matching source division. `entries.slice(0, 5)`
	// dropped the 6th athlete (Ian) without surfacing him anywhere.
	//
	// The cutoff is allocation budget metadata, not a candidate filter —
	// the organizer needs every eligible athlete on the page so they can
	// choose whom to invite. This test pins that contract.
	it("returns every active candidate even when allocation spots < candidate count", async () => {
		listSourcesForChampionship.mockResolvedValueOnce([
			sourceFixture({ globalSpots: 2 }),
		])

		listAllocationsForChampionship.mockResolvedValueOnce([])
		// Override gives Men's RX exactly 5 spots from this source — fewer
		// than the 6 registrations below.
		resolveSourceAllocations.mockReturnValue({
			total: 5,
			byDivision: { div_champ_rx: 5 },
		})

		// resolveSourceCompetitions → directComps lookup.
		selectQueue.push([
			{ id: "comp_qual", name: "Qualifier Open", groupId: null },
		])
		// resolveDivisionRefs → competition settings rows.
		selectQueue.push([{ id: "comp_qual", settings: "{}" }])
		// resolveDivisionRefs → scaling levels for the source comp.
		selectQueue.push([
			{
				id: "div_qual_rx",
				label: "Rx",
				scalingGroupId: "sg_qual",
				position: 0,
			},
		])
		// resolveChampionshipDivisions → championship settings row.
		selectQueue.push([{ settings: "{}" }])
		// resolveChampionshipDivisions → championship scaling levels.
		// Label "Rx" matches source → cutoff resolves via div_champ_rx.
		selectQueue.push([{ id: "div_champ_rx", label: "Rx", position: 0 }])

		// 6 active candidates in the source division — one more than the
		// allocation cutoff (5).
		const candidateEntries = Array.from({ length: 6 }, (_, i) => ({
			registrationId: `reg_${i + 1}`,
			userId: `usr_${i + 1}`,
			athleteName: `Athlete ${i + 1}`,
			athleteEmail: `athlete-${i + 1}@example.com`,
			divisionId: "div_qual_rx",
			divisionLabel: "Rx",
			registeredAt: new Date(`2026-04-${10 + i}T12:00:00Z`),
		}))
		getCandidatesForSourceComp.mockResolvedValueOnce({
			entries: candidateEntries,
		})

		const result = await getChampionshipRoster({
			championshipId: "comp_champ",
		})

		// All 6 candidates surface — the 6th (latest registrant) is the
		// one that previously disappeared via `entries.slice(0, cutoff)`.
		expect(result.rows).toHaveLength(6)
		const userIds = result.rows.map((r) => r.userId)
		expect(userIds).toContain("usr_6")
		expect(new Set(userIds)).toEqual(
			new Set(candidateEntries.map((c) => c.userId)),
		)
	})
})
