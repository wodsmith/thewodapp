import { describe, expect, it, vi } from "vitest"

// Mock underlying helper
const mockTracks = [
	{ id: "ptrk_1", name: "Track 1", description: "Desc", type: "official_3rd_party" as const, ownerTeamId: null },
]

vi.mock("@/server/programming-tracks", () => ({
	getPublicProgrammingTracks: vi.fn(() => mockTracks),
}))

// Import after mocks
// eslint-disable-next-line import/first
import { getPublicProgrammingTracksAction } from "@/app/(main)/programming/_actions/get-public-programming-tracks.action"

/**
 * Basic test ensuring action returns data from helper without error.
 */

describe("getPublicProgrammingTracksAction", () => {
	it("should return the list provided by helper", async () => {
		const [data, err] = await getPublicProgrammingTracksAction()

		expect(err).toBeNull()
		expect(data).toEqual(mockTracks)
	})
})