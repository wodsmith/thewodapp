import { describe, it, expect, beforeEach, vi } from "vitest"
import { getDb } from "@/db"

// Mock the database
vi.mock("@/db", () => ({
	getDb: vi.fn(),
}))

// Mock server-only - this module throws in non-server environments
vi.mock("server-only", () => ({}))

// Import the function under test AFTER mocking
import { getAllCompetitionsForAdmin } from "@/server/competitions"

/**
 * Factory for creating mock competition data with sensible defaults.
 * Makes tests more readable and maintainable.
 */
function createMockCompetition(overrides: {
	id?: string
	name?: string
	organizingTeamId?: string
	competitionTeamId?: string
	groupId?: string | null
	createdAt?: Date
	organizingTeam?: { id: string; name: string; slug?: string } | null
	competitionTeam?: { id: string; name: string; slug?: string } | null
	group?: { id: string; name: string; slug?: string } | null
} = {}) {
	const id = overrides.id ?? `comp_${Math.random().toString(36).slice(2, 8)}`
	return {
		id,
		name: overrides.name ?? "Test Competition",
		organizingTeamId: overrides.organizingTeamId ?? "team_default",
		competitionTeamId: overrides.competitionTeamId ?? "event_default",
		groupId: overrides.groupId ?? null,
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
})
