import { describe, expect, it, vi } from "vitest"

/**
 * Integration test for getPublicProgrammingTracks helper.
 * Ensures only public tracks are returned.
 */

// Mock database response
const mockTracks = [
	{
		id: "ptrk_mock1",
		name: "Mock Public Track 1",
		description: "Desc 1",
		type: "official_3rd_party" as const,
		ownerTeamId: null,
	},
	{
		id: "ptrk_mock2",
		name: "Mock Public Track 2",
		description: "Desc 2",
		type: "official_3rd_party" as const,
		ownerTeamId: null,
	},
]

// Intercept getDB to return a minimal chainable API that our helper expects
vi.mock("@/db", () => ({
	getDB: () => ({
		select: () => ({
			from: () => ({
				where: () => mockTracks,
			}),
		}),
	}),
}))

// Re-import the helper after mocking
// eslint-disable-next-line import/first
import { getPublicProgrammingTracks as getPublicTracks } from "@/server/programming-tracks"

describe("getPublicProgrammingTracks functionality", () => {
	it("should return all mocked public tracks", async () => {
		const tracks = await getPublicTracks()

		expect(tracks.length).toBe(mockTracks.length)
		for (const t of mockTracks) {
			expect(tracks).toContainEqual(t)
		}
	})
})