import { createId } from "@paralleldrive/cuid2"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as schema from "@/db/schema"
import { createTestDb, cleanupTestDb } from "../lib/test-db"
import { createTestSession } from "../lib/test-session"

// IMPORTANT: Unmock @/db to use our real module with test injection
vi.unmock("@/db")

// Mock auth boundary
vi.mock("@/utils/auth", () => ({
	requireVerifiedEmail: vi.fn(),
	getSessionFromCookie: vi.fn(),
}))

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
}))

// Mock KV session functions
vi.mock("@/utils/kv-session", async () => {
	const actual = await vi.importActual<typeof import("@/utils/kv-session")>(
		"@/utils/kv-session",
	)
	return {
		...actual,
		updateAllSessionsOfUser: vi.fn(),
		getAllSessionIdsOfUser: vi.fn().mockResolvedValue([]),
	}
})

// Import after vi.unmock
import { setTestDb } from "@/db"
import { getSessionFromCookie, requireVerifiedEmail } from "@/utils/auth"

describe("Programming Tracks Integration", () => {
	let db: ReturnType<typeof createTestDb>["db"]
	let sqlite: ReturnType<typeof createTestDb>["sqlite"]
	let testUser: typeof schema.userTable.$inferSelect
	let testTeam: typeof schema.teamTable.$inferSelect

	beforeEach(async () => {
		const testDb = createTestDb()
		db = testDb.db
		sqlite = testDb.sqlite
		setTestDb(db)

		const now = new Date()

		// Create test user
		;[testUser] = await db
			.insert(schema.userTable)
			.values({
				id: `usr_${createId()}`,
				email: `test-${createId().slice(0, 8)}@example.com`,
				firstName: "Test",
				lastName: "User",
				role: "user",
				emailVerified: now,
				createdAt: now,
				updatedAt: now,
			})
			.returning()

		// Create test team
		;[testTeam] = await db
			.insert(schema.teamTable)
			.values({
				id: `team_${createId()}`,
				name: "Test Gym",
				slug: `test-gym-${createId().slice(0, 8)}`,
				type: "gym",
				isPersonalTeam: 0,
				createdAt: now,
				updatedAt: now,
			})
			.returning()

		// Configure session mock
		vi.mocked(getSessionFromCookie).mockResolvedValue(
			createTestSession({
				userId: testUser.id,
				teams: [
					{
						id: testTeam.id,
						name: testTeam.name,
						permissions: ["access_dashboard", "manage_programming"],
					},
				],
			}),
		)
		vi.mocked(requireVerifiedEmail).mockResolvedValue(
			createTestSession({
				userId: testUser.id,
				teams: [
					{
						id: testTeam.id,
						name: testTeam.name,
						permissions: ["access_dashboard", "manage_programming"],
					},
				],
			}),
		)
	})

	afterEach(() => {
		setTestDb(null)
		cleanupTestDb(sqlite)
		vi.clearAllMocks()
	})

	it("returns owned tracks for a team", async () => {
		const now = new Date()
		// Create a track owned by the team
		await db.insert(schema.programmingTracksTable).values({
			id: `track_${createId()}`,
			name: "Team Owned Track",
			description: "A track owned by the team",
			type: "programming",
			ownerTeamId: testTeam.id,
			isPublic: 0,
			createdAt: now,
			updatedAt: now,
		})

		const { getTeamTracks } = await import("@/server/programming-tracks")
		const tracks = await getTeamTracks(testTeam.id)

		expect(tracks).toHaveLength(1)
		expect(tracks[0].name).toBe("Team Owned Track")
		expect(tracks[0].ownerTeamId).toBe(testTeam.id)
	})

	it("returns assigned tracks for a team", async () => {
		const now = new Date()
		// Create a track not owned by the team
		const [track] = await db
			.insert(schema.programmingTracksTable)
			.values({
				id: `track_${createId()}`,
				name: "Third Party Track",
				description: "A track from third party",
				type: "programming",
				ownerTeamId: null, // Not owned by any team
				isPublic: 1,
				createdAt: now,
				updatedAt: now,
			})
			.returning()

		// Assign the track to the team
		await db.insert(schema.teamProgrammingTracksTable).values({
			id: `sub_${createId()}`,
			teamId: testTeam.id,
			trackId: track.id,
			isActive: 1,
			isDefault: 0,
			subscribedAt: now,
			createdAt: now,
			updatedAt: now,
		})

		const { getTeamTracks } = await import("@/server/programming-tracks")
		const tracks = await getTeamTracks(testTeam.id)

		expect(tracks.some((t) => t.id === track.id)).toBe(true)
	})

	it("returns both owned and assigned tracks without duplicates", async () => {
		const now = new Date()
		// Create a track owned by the team
		const [ownedTrack] = await db
			.insert(schema.programmingTracksTable)
			.values({
				id: `track_${createId()}`,
				name: "Owned and Assigned Track",
				description: "Track owned and assigned",
				type: "programming",
				ownerTeamId: testTeam.id,
				isPublic: 0,
				createdAt: now,
				updatedAt: now,
			})
			.returning()

		// Also assign it to the team (this could happen in real scenarios)
		await db.insert(schema.teamProgrammingTracksTable).values({
			id: `sub_${createId()}`,
			teamId: testTeam.id,
			trackId: ownedTrack.id,
			isActive: 1,
			isDefault: 0,
			subscribedAt: now,
			createdAt: now,
			updatedAt: now,
		})

		const { getTeamTracks } = await import("@/server/programming-tracks")
		const tracks = await getTeamTracks(testTeam.id)

		// Should only appear once despite being both owned and assigned
		const ownedTrackCount = tracks.filter((t) => t.id === ownedTrack.id).length
		expect(ownedTrackCount).toBe(1)
	})
})
