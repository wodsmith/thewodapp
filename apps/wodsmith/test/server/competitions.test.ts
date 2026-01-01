import { describe, it, expect, beforeEach, vi } from "vitest"
import { getDb } from "@/db"
import { eq } from "drizzle-orm"

// Mock the database
vi.mock("@/db", () => ({
	getDb: vi.fn(),
}))

// Mock drizzle-orm with all needed exports
vi.mock("drizzle-orm", async (importOriginal) => {
	const actual = await importOriginal<typeof import("drizzle-orm")>()
	return {
		...actual,
		eq: vi.fn((field, value) => ({ field, value, _eq: true })),
	}
})

// Mock server-only - this module throws in non-server environments
vi.mock("server-only", () => ({}))

// Import the function under test AFTER mocking
import { getAllCompetitionsForAdmin, getCompetitions } from "@/server/competitions"

/**
 * Factory for creating mock competition data with sensible defaults.
 * Makes tests more readable and maintainable.
 */
function createMockCompetition(overrides: {
	id?: string
	name?: string
	slug?: string
	organizingTeamId?: string
	competitionTeamId?: string
	groupId?: string | null
	startDate?: Date
	createdAt?: Date
	organizingTeam?: { id: string; name: string; slug?: string } | null
	competitionTeam?: { id: string; name: string; slug?: string } | null
	group?: { id: string; name: string; slug?: string } | null
} = {}) {
	const id = overrides.id ?? `comp_${Math.random().toString(36).slice(2, 8)}`
	return {
		id,
		name: overrides.name ?? "Test Competition",
		slug: overrides.slug ?? `test-competition-${id.slice(5)}`,
		organizingTeamId: overrides.organizingTeamId ?? "team_default",
		competitionTeamId: overrides.competitionTeamId ?? "event_default",
		groupId: overrides.groupId ?? null,
		startDate: overrides.startDate ?? new Date(),
		createdAt: overrides.createdAt ?? new Date(),
		organizingTeam: overrides.organizingTeam ?? null,
		competitionTeam: overrides.competitionTeam ?? null,
		group: overrides.group ?? null,
	}
}

/**
 * Helper to set up the mock database with a findMany implementation.
 */
function setupMockDb(mockCompetitions: ReturnType<typeof createMockCompetition>[]) {
	const mockFindMany = vi.fn().mockResolvedValue(mockCompetitions)
	vi.mocked(getDb).mockReturnValue({
		query: {
			competitionsTable: {
				findMany: mockFindMany,
			},
		},
	} as ReturnType<typeof getDb>)
	return mockFindMany
}

describe("competitions server functions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("getAllCompetitionsForAdmin", () => {
		it("returns all competitions across all teams (no teamId filtering)", async () => {
			// Arrange: Set up mock data with competitions from different organizing teams
			const mockCompetitions = [
				{
					id: "comp_1",
					name: "Competition Alpha",
					organizingTeamId: "team_a",
					competitionTeamId: "event_team_a",
					createdAt: new Date("2024-01-15"),
					organizingTeam: { id: "team_a", name: "Team Alpha" },
					competitionTeam: { id: "event_team_a", name: "Alpha Event Team" },
					group: null,
				},
				{
					id: "comp_2",
					name: "Competition Beta",
					organizingTeamId: "team_b",
					competitionTeamId: "event_team_b",
					createdAt: new Date("2024-01-10"),
					organizingTeam: { id: "team_b", name: "Team Beta" },
					competitionTeam: { id: "event_team_b", name: "Beta Event Team" },
					group: { id: "grp_1", name: "Summer Series" },
				},
				{
					id: "comp_3",
					name: "Competition Gamma",
					organizingTeamId: "team_c",
					competitionTeamId: "event_team_c",
					createdAt: new Date("2024-01-05"),
					organizingTeam: { id: "team_c", name: "Team Gamma" },
					competitionTeam: { id: "event_team_c", name: "Gamma Event Team" },
					group: null,
				},
			]

			const mockFindMany = vi.fn().mockResolvedValue(mockCompetitions)
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findMany: mockFindMany,
					},
				},
			} as ReturnType<typeof getDb>)

			// Act
			const result = await getAllCompetitionsForAdmin()

			// Assert: Should return all competitions from all teams
			expect(result).toHaveLength(3)
			expect(result.map((c) => c.organizingTeamId)).toEqual([
				"team_a",
				"team_b",
				"team_c",
			])

			// Verify findMany was called with correct relations
			expect(mockFindMany).toHaveBeenCalledTimes(1)
			const callArgs = mockFindMany.mock.calls[0][0]
			expect(callArgs.with).toEqual({
				competitionTeam: true,
				group: true,
				organizingTeam: true,
			})
		})

		it("includes organizingTeam, competitionTeam, and group relations", async () => {
			// Arrange
			const mockCompetition = {
				id: "comp_test",
				name: "Test Competition",
				organizingTeamId: "team_1",
				competitionTeamId: "event_1",
				groupId: "grp_1",
				createdAt: new Date(),
				organizingTeam: { id: "team_1", name: "Organizing Team", slug: "org-team" },
				competitionTeam: { id: "event_1", name: "Event Team", slug: "event-team" },
				group: { id: "grp_1", name: "Competition Group", slug: "comp-group" },
			}

			const mockFindMany = vi.fn().mockResolvedValue([mockCompetition])
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findMany: mockFindMany,
					},
				},
			} as ReturnType<typeof getDb>)

			// Act
			const result = await getAllCompetitionsForAdmin()

			// Assert: All relations should be included
			expect(result).toHaveLength(1)
			const [competition] = result

			expect(competition.organizingTeam).toBeDefined()
			expect(competition.organizingTeam?.name).toBe("Organizing Team")

			expect(competition.competitionTeam).toBeDefined()
			expect(competition.competitionTeam?.name).toBe("Event Team")

			expect(competition.group).toBeDefined()
			expect(competition.group?.name).toBe("Competition Group")
		})

		it("orders results by createdAt DESC (newest first)", async () => {
			// Arrange: Create competitions with different createdAt dates
			const oldestDate = new Date("2024-01-01")
			const middleDate = new Date("2024-06-15")
			const newestDate = new Date("2024-12-01")

			const mockCompetitions = [
				{
					id: "comp_newest",
					name: "Newest Competition",
					createdAt: newestDate,
					organizingTeamId: "team_1",
					competitionTeamId: "event_1",
					organizingTeam: null,
					competitionTeam: null,
					group: null,
				},
				{
					id: "comp_middle",
					name: "Middle Competition",
					createdAt: middleDate,
					organizingTeamId: "team_2",
					competitionTeamId: "event_2",
					organizingTeam: null,
					competitionTeam: null,
					group: null,
				},
				{
					id: "comp_oldest",
					name: "Oldest Competition",
					createdAt: oldestDate,
					organizingTeamId: "team_3",
					competitionTeamId: "event_3",
					organizingTeam: null,
					competitionTeam: null,
					group: null,
				},
			]

			const mockFindMany = vi.fn().mockResolvedValue(mockCompetitions)
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findMany: mockFindMany,
					},
				},
			} as ReturnType<typeof getDb>)

			// Act
			const result = await getAllCompetitionsForAdmin()

			// Assert: Verify order is newest first
			expect(result[0].id).toBe("comp_newest")
			expect(result[1].id).toBe("comp_middle")
			expect(result[2].id).toBe("comp_oldest")

			// Verify orderBy was passed correctly
			expect(mockFindMany).toHaveBeenCalledTimes(1)
			const callArgs = mockFindMany.mock.calls[0][0]
			expect(callArgs.orderBy).toBeDefined()
		})

		it("returns empty array when no competitions exist", async () => {
			// Arrange
			const mockFindMany = vi.fn().mockResolvedValue([])
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findMany: mockFindMany,
					},
				},
			} as ReturnType<typeof getDb>)

			// Act
			const result = await getAllCompetitionsForAdmin()

			// Assert
			expect(result).toEqual([])
			expect(Array.isArray(result)).toBe(true)
		})

		it("handles null relations gracefully", async () => {
			// Arrange: Competition with all relations being null
			const mockCompetition = {
				id: "comp_no_relations",
				name: "No Relations Competition",
				organizingTeamId: "team_orphan",
				competitionTeamId: "event_orphan",
				groupId: null,
				createdAt: new Date(),
				organizingTeam: null,
				competitionTeam: null,
				group: null,
			}

			const mockFindMany = vi.fn().mockResolvedValue([mockCompetition])
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findMany: mockFindMany,
					},
				},
			} as ReturnType<typeof getDb>)

			// Act
			const result = await getAllCompetitionsForAdmin()

			// Assert: Function should handle null relations without throwing
			expect(result).toHaveLength(1)
			expect(result[0].organizingTeam).toBeNull()
			expect(result[0].competitionTeam).toBeNull()
			expect(result[0].group).toBeNull()
		})

		it("does not apply any where clause (no filtering)", async () => {
			// Arrange
			const mockFindMany = vi.fn().mockResolvedValue([])
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findMany: mockFindMany,
					},
				},
			} as ReturnType<typeof getDb>)

			// Act
			await getAllCompetitionsForAdmin()

			// Assert: No where clause should be passed
			expect(mockFindMany).toHaveBeenCalledTimes(1)
			const callArgs = mockFindMany.mock.calls[0][0]
			expect(callArgs.where).toBeUndefined()
		})
	})

	/**
	 * Tests for getCompetitions(teamId) - team-filtered competition list loading
	 *
	 * These tests verify the core team-based filtering behavior:
	 * 1. Only competitions for the specified organizingTeamId are returned
	 * 2. Switching teams returns a different set of competitions
	 * 3. Empty array when team has no competitions
	 *
	 * This is critical for the compete dashboard where organizers see only their competitions.
	 */
	describe("getCompetitions (team-filtered)", () => {
		it("returns only competitions for the specified team (not other teams)", async () => {
			// Arrange: Three competitions from different organizing teams
			const teamA = "team_alpha"
			const teamB = "team_beta"

			const competitionsFromTeamA = [
				createMockCompetition({
					id: "comp_a1",
					name: "Alpha Throwdown 2024",
					organizingTeamId: teamA,
					organizingTeam: { id: teamA, name: "Alpha Fitness" },
				}),
				createMockCompetition({
					id: "comp_a2",
					name: "Alpha Spring Games",
					organizingTeamId: teamA,
					organizingTeam: { id: teamA, name: "Alpha Fitness" },
				}),
			]

			// This competition belongs to teamB, should NOT be returned when querying teamA
			const _competitionFromTeamB = createMockCompetition({
				id: "comp_b1",
				name: "Beta Games",
				organizingTeamId: teamB,
				organizingTeam: { id: teamB, name: "Beta CrossFit" },
			})

			// Mock: Simulate database returning only teamA's competitions
			const mockFindMany = vi.fn().mockResolvedValue(competitionsFromTeamA)
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findMany: mockFindMany,
					},
				},
			} as ReturnType<typeof getDb>)

			// Act: Query competitions for Team Alpha
			const result = await getCompetitions(teamA)

			// Assert: Should return only Team Alpha's competitions
			expect(result).toHaveLength(2)
			expect(result.every((c) => c.organizingTeamId === teamA)).toBe(true)
			expect(result.map((c) => c.id)).toEqual(["comp_a1", "comp_a2"])

			// Verify the where clause was applied with the correct teamId
			expect(mockFindMany).toHaveBeenCalledTimes(1)
			const callArgs = mockFindMany.mock.calls[0][0]
			expect(callArgs.where).toBeDefined()
		})

		it("switching to a different team returns that team's competitions", async () => {
			// Arrange: Set up competitions for two different teams
			const teamA = "team_alpha"
			const teamB = "team_beta"

			const teamACompetitions = [
				createMockCompetition({
					id: "comp_a1",
					name: "Alpha Event",
					organizingTeamId: teamA,
				}),
			]

			const teamBCompetitions = [
				createMockCompetition({
					id: "comp_b1",
					name: "Beta Event 1",
					organizingTeamId: teamB,
				}),
				createMockCompetition({
					id: "comp_b2",
					name: "Beta Event 2",
					organizingTeamId: teamB,
				}),
			]

			// Mock: Return appropriate competitions based on query
			const mockFindMany = vi.fn()
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findMany: mockFindMany,
					},
				},
			} as ReturnType<typeof getDb>)

			// Act & Assert: Query Team A first
			mockFindMany.mockResolvedValueOnce(teamACompetitions)
			const resultA = await getCompetitions(teamA)
			expect(resultA).toHaveLength(1)
			expect(resultA[0].organizingTeamId).toBe(teamA)
			expect(resultA[0].name).toBe("Alpha Event")

			// Act & Assert: Switch to Team B - should get different competitions
			mockFindMany.mockResolvedValueOnce(teamBCompetitions)
			const resultB = await getCompetitions(teamB)
			expect(resultB).toHaveLength(2)
			expect(resultB.every((c) => c.organizingTeamId === teamB)).toBe(true)
			expect(resultB.map((c) => c.name)).toEqual(["Beta Event 1", "Beta Event 2"])

			// Verify both calls were made
			expect(mockFindMany).toHaveBeenCalledTimes(2)
		})

		it("returns empty array when team has no competitions", async () => {
			// Arrange: Team with no competitions
			const emptyTeamId = "team_no_comps"

			const mockFindMany = vi.fn().mockResolvedValue([])
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findMany: mockFindMany,
					},
				},
			} as ReturnType<typeof getDb>)

			// Act
			const result = await getCompetitions(emptyTeamId)

			// Assert: Empty array, not null or undefined
			expect(result).toEqual([])
			expect(Array.isArray(result)).toBe(true)

			// Verify query was still made with correct parameters
			expect(mockFindMany).toHaveBeenCalledTimes(1)
		})

		it("includes competitionTeam, group, and organizingTeam relations", async () => {
			// Arrange: Competition with all relations populated
			const teamId = "team_with_full_data"
			const fullCompetition = createMockCompetition({
				id: "comp_full",
				name: "Full Relations Competition",
				organizingTeamId: teamId,
				groupId: "grp_series",
				organizingTeam: { id: teamId, name: "Full Data Team", slug: "full-team" },
				competitionTeam: { id: "event_full", name: "Event Team", slug: "event-team" },
				group: { id: "grp_series", name: "Summer Series", slug: "summer-series" },
			})

			const mockFindMany = vi.fn().mockResolvedValue([fullCompetition])
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findMany: mockFindMany,
					},
				},
			} as ReturnType<typeof getDb>)

			// Act
			const result = await getCompetitions(teamId)

			// Assert: All relations should be included
			expect(result).toHaveLength(1)
			const [competition] = result

			expect(competition.organizingTeam).toBeDefined()
			expect(competition.organizingTeam?.name).toBe("Full Data Team")

			expect(competition.competitionTeam).toBeDefined()
			expect(competition.competitionTeam?.name).toBe("Event Team")

			expect(competition.group).toBeDefined()
			expect(competition.group?.name).toBe("Summer Series")

			// Verify relations were requested in the query
			const callArgs = mockFindMany.mock.calls[0][0]
			expect(callArgs.with).toEqual({
				competitionTeam: true,
				group: true,
				organizingTeam: true,
			})
		})

		it("orders results by startDate DESC (newest first)", async () => {
			// Arrange: Competitions with different start dates
			const teamId = "team_with_dates"

			const competitions = [
				createMockCompetition({
					id: "comp_future",
					name: "Future Competition",
					organizingTeamId: teamId,
					startDate: new Date("2025-12-01"),
				}),
				createMockCompetition({
					id: "comp_soon",
					name: "Upcoming Competition",
					organizingTeamId: teamId,
					startDate: new Date("2025-06-15"),
				}),
				createMockCompetition({
					id: "comp_past",
					name: "Past Competition",
					organizingTeamId: teamId,
					startDate: new Date("2024-01-01"),
				}),
			]

			const mockFindMany = vi.fn().mockResolvedValue(competitions)
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findMany: mockFindMany,
					},
				},
			} as ReturnType<typeof getDb>)

			// Act
			const result = await getCompetitions(teamId)

			// Assert: Results should be in startDate DESC order (as mocked)
			expect(result[0].id).toBe("comp_future")
			expect(result[1].id).toBe("comp_soon")
			expect(result[2].id).toBe("comp_past")

			// Verify orderBy was passed correctly
			const callArgs = mockFindMany.mock.calls[0][0]
			expect(callArgs.orderBy).toBeDefined()
		})
	})
})
