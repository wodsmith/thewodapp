import { getDb } from "@/db"
import {
	programmingTracksTable,
	teamProgrammingTracksTable,
	teamTable,
} from "@/db/schema"
import {
	assignTrackToTeam,
	createProgrammingTrack,
	getTeamTracks,
} from "@/server/programming-tracks"
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

// TODO: These are integration tests that require a real database connection.
// They should be moved to a separate integration test suite or run with a test database.
describe.skip("getTeamTracks functionality", () => {
	let testTeamId: string
	let db: ReturnType<typeof getDb>

	beforeEach(async () => {
		db = getDb()

		// Get or create a test team
		const existingTeams = await db.select().from(teamTable).limit(1)
		if (existingTeams.length > 0) {
			testTeamId = existingTeams[0].id
		} else {
			// Create a test team if none exists
			const [newTeam] = await db
				.insert(teamTable)
				.values({
					name: "Test Team",
					slug: `test-team-${Date.now()}`,
					isPersonalTeam: 0,
					creditBalance: 0,
				})
				.returning()
			testTeamId = newTeam.id
		}
	})

	it("should return owned tracks for a team", async () => {
		// Create a track owned by the team
		const track = await createProgrammingTrack({
			name: `Test Track Owned ${Date.now()}`,
			description: "Test track owned by team",
			type: "team_owned",
			ownerTeamId: testTeamId,
			isPublic: false,
		})

		console.log(`Created track: ${track.id} owned by team: ${testTeamId}`)

		// Get team tracks
		const tracks = await getTeamTracks(testTeamId)
		console.log(
			`Retrieved ${tracks.length} tracks:`,
			tracks.map((t) => ({
				id: t.id,
				name: t.name,
				ownerTeamId: t.ownerTeamId,
			})),
		)

		// Should find the owned track
		expect(tracks.length).toBeGreaterThan(0)
		expect(tracks.some((t) => t.id === track.id)).toBe(true)
	})

	it("should return assigned tracks for a team", async () => {
		// Create a track not owned by the team
		const track = await createProgrammingTrack({
			name: `Test Track Assigned ${Date.now()}`,
			description: "Test track assigned to team",
			type: "official_3rd_party",
			ownerTeamId: null,
			isPublic: false,
		})

		console.log(`Created track: ${track.id} not owned by any team`)

		// Assign the track to the team
		await assignTrackToTeam(testTeamId, track.id, true)
		console.log(`Assigned track: ${track.id} to team: ${testTeamId}`)

		// Get team tracks
		const tracks = await getTeamTracks(testTeamId)
		console.log(
			`Retrieved ${tracks.length} tracks:`,
			tracks.map((t) => ({
				id: t.id,
				name: t.name,
				ownerTeamId: t.ownerTeamId,
			})),
		)

		// Should find the assigned track
		expect(tracks.length).toBeGreaterThan(0)
		expect(tracks.some((t) => t.id === track.id)).toBe(true)
	})

	it("should return both owned and assigned tracks without duplicates", async () => {
		// Create a track owned by the team
		const ownedTrack = await createProgrammingTrack({
			name: `Test Owned Track ${Date.now()}`,
			description: "Test track owned by team",
			type: "team_owned",
			ownerTeamId: testTeamId,
			isPublic: false,
		})

		// Also assign it to the team (this could happen in real scenarios)
		await assignTrackToTeam(testTeamId, ownedTrack.id, true)

		// Get team tracks
		const tracks = await getTeamTracks(testTeamId)
		console.log(
			`Retrieved ${tracks.length} tracks:`,
			tracks.map((t) => ({
				id: t.id,
				name: t.name,
				ownerTeamId: t.ownerTeamId,
			})),
		)

		// Should only appear once despite being both owned and assigned
		const ownedTrackCount = tracks.filter((t) => t.id === ownedTrack.id).length
		expect(ownedTrackCount).toBe(1)
	})
})
