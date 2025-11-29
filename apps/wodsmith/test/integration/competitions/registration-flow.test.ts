import { createId } from "@paralleldrive/cuid2"
import { eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as schema from "@/db/schema"
import { createTestDb, cleanupTestDb } from "../../lib/test-db"
import { createTestSession } from "../../lib/test-session"
import type Database from "better-sqlite3"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"

// IMPORTANT: Unmock @/db to use our real module with test injection
// The global setup.ts mocks @/db, but we want the real implementation
vi.unmock("@/db")

// Mock auth boundary - this is the only thing we mock
vi.mock("@/utils/auth", () => ({
	getSessionFromCookie: vi.fn(),
	requireVerifiedEmail: vi.fn(),
}))

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
}))

// Mock KV session functions that require Cloudflare KV
vi.mock("@/utils/kv-session", async () => {
	const actual = await vi.importActual<typeof import("@/utils/kv-session")>(
		"@/utils/kv-session",
	)
	return {
		...actual,
		// Mock functions that need KV store
		updateAllSessionsOfUser: vi.fn(),
		getAllSessionIdsOfUser: vi.fn().mockResolvedValue([]),
	}
})

// Import after vi.unmock
import { setTestDb } from "@/db"

// Import mocked functions
import { getSessionFromCookie } from "@/utils/auth"

describe("Competition Registration Flow", () => {
	let db: BetterSQLite3Database<typeof schema>
	let sqlite: Database.Database
	let testUser: typeof schema.userTable.$inferSelect
	let testTeam: typeof schema.teamTable.$inferSelect
	let competitionTeam: typeof schema.teamTable.$inferSelect
	let competition: typeof schema.competitionsTable.$inferSelect
	let scalingGroup: typeof schema.scalingGroupsTable.$inferSelect
	let division: typeof schema.scalingLevelsTable.$inferSelect

	beforeEach(async () => {
		// Create fresh in-memory DB
		const testDb = createTestDb()
		db = testDb.db
		sqlite = testDb.sqlite
		setTestDb(db)

		// Use Date objects - Drizzle should convert to timestamps
		const now = new Date()
		const dob = new Date("1990-01-01")

		// Seed base data

		// 1. Create user with complete profile
		const userId = `usr_${createId()}`
		;[testUser] = await db
			.insert(schema.userTable)
			.values({
				id: userId,
				email: `test-${createId().slice(0, 8)}@test.com`,
				firstName: "Test",
				lastName: "User",
				role: "user",
				emailVerified: now,
				gender: "male", // Required for registration
				dateOfBirth: dob, // Required for registration
				createdAt: now,
				updatedAt: now,
			})
			.returning()

		// 2. Create organizing team
		const teamId = `team_${createId()}`
		;[testTeam] = await db
			.insert(schema.teamTable)
			.values({
				id: teamId,
				name: "Test Gym",
				slug: `test-gym-${createId().slice(0, 8)}`,
				type: "gym",
				isPersonalTeam: 0, // Use 0 instead of false for better-sqlite3 compatibility
				createdAt: now,
				updatedAt: now,
			})
			.returning()

		// 3. Create competition team (auto-created for athlete management)
		const compTeamId = `team_${createId()}`
		;[competitionTeam] = await db
			.insert(schema.teamTable)
			.values({
				id: compTeamId,
				name: "Competition Athletes",
				slug: `comp-athletes-${createId().slice(0, 8)}`,
				type: "competition_team",
				isPersonalTeam: 0, // Use 0 instead of false for better-sqlite3 compatibility
				parentTeamId: teamId,
				createdAt: now,
				updatedAt: now,
			})
			.returning()

		// 4. Create scaling group for divisions
		const sgId = `sgrp_${createId()}`
		;[scalingGroup] = await db
			.insert(schema.scalingGroupsTable)
			.values({
				id: sgId,
				title: "Competition Divisions",
				teamId: testTeam.id,
				isDefault: 0,
				isSystem: 0,
				createdAt: now,
				updatedAt: now,
			})
			.returning()

		// 5. Create division (scaling level)
		const divId = `slvl_${createId()}`
		;[division] = await db
			.insert(schema.scalingLevelsTable)
			.values({
				id: divId,
				scalingGroupId: scalingGroup.id,
				label: "RX",
				position: 0,
				teamSize: 1, // Individual division
				createdAt: now,
				updatedAt: now,
			})
			.returning()

		// 6. Create competition with open registration
		const compId = `comp_${createId()}`
		const startDate = new Date(Date.now() + 86400000 * 30) // 30 days from now
		const endDate = new Date(Date.now() + 86400000 * 31)
		const regOpens = new Date(Date.now() - 86400000) // Yesterday (open)
		const regCloses = new Date(Date.now() + 86400000 * 29) // 29 days from now

		;[competition] = await db
			.insert(schema.competitionsTable)
			.values({
				id: compId,
				organizingTeamId: testTeam.id,
				competitionTeamId: competitionTeam.id,
				slug: `test-comp-${createId().slice(0, 8)}`,
				name: "Test Competition",
				startDate,
				endDate,
				registrationOpensAt: regOpens,
				registrationClosesAt: regCloses,
				settings: JSON.stringify({
					divisions: {
						scalingGroupId: scalingGroup.id,
					},
				}),
				createdAt: now,
				updatedAt: now,
			})
			.returning()

		// Configure session mock
		vi.mocked(getSessionFromCookie).mockResolvedValue(
			createTestSession({
				userId: testUser.id,
				user: {
					id: testUser.id,
					email: testUser.email ?? "",
					firstName: testUser.firstName ?? "Test",
					lastName: testUser.lastName ?? "User",
				},
				teams: [
					{
						id: testTeam.id,
						name: testTeam.name,
						slug: testTeam.slug,
						permissions: ["access_dashboard"],
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

	describe("getCompetition", () => {
		it("retrieves competition with divisions", async () => {
			const { getCompetition } = await import("@/server/competitions")

			const result = await getCompetition(competition.id)

			expect(result).toBeDefined()
			expect(result?.name).toBe("Test Competition")
			expect(result?.organizingTeamId).toBe(testTeam.id)
		})

		it("returns null for non-existent competition", async () => {
			const { getCompetition } = await import("@/server/competitions")

			const result = await getCompetition("comp_nonexistent")

			expect(result).toBeNull()
		})
	})

	describe("registerForCompetition", () => {
		it("successfully registers user for competition", async () => {
			const { registerForCompetition } = await import("@/server/competitions")

			const result = await registerForCompetition({
				competitionId: competition.id,
				userId: testUser.id,
				divisionId: division.id,
			})

			expect(result.registrationId).toBeDefined()

			// Verify registration was created in DB
			const registration =
				await db.query.competitionRegistrationsTable.findFirst({
					where: eq(
						schema.competitionRegistrationsTable.id,
						result.registrationId,
					),
				})

			expect(registration).toBeDefined()
			expect(registration?.userId).toBe(testUser.id)
			expect(registration?.eventId).toBe(competition.id) // eventId, not competitionId
			expect(registration?.divisionId).toBe(division.id)
		})

		it("rejects registration when window is closed", async () => {
			// Update competition to have closed registration
			await db
				.update(schema.competitionsTable)
				.set({
					registrationClosesAt: new Date(Date.now() - 86400000), // Yesterday
				})
				.where(eq(schema.competitionsTable.id, competition.id))

			const { registerForCompetition } = await import("@/server/competitions")

			await expect(
				registerForCompetition({
					competitionId: competition.id,
					userId: testUser.id,
					divisionId: division.id,
				}),
			).rejects.toThrow("Registration has closed")
		})

		it("rejects registration when user profile is incomplete", async () => {
			// Create user without gender/dateOfBirth
			const now = new Date()
			const [incompleteUser] = await db
				.insert(schema.userTable)
				.values({
					id: `usr_${createId()}`,
					email: `incomplete-${createId().slice(0, 8)}@test.com`,
					firstName: "Incomplete",
					lastName: "User",
					role: "user",
					emailVerified: now,
					// Missing gender and dateOfBirth
					createdAt: now,
					updatedAt: now,
				})
				.returning()

			const { registerForCompetition } = await import("@/server/competitions")

			await expect(
				registerForCompetition({
					competitionId: competition.id,
					userId: incompleteUser.id,
					divisionId: division.id,
				}),
			).rejects.toThrow(/complete your profile/)
		})

		it("rejects registration with invalid division", async () => {
			const { registerForCompetition } = await import("@/server/competitions")

			await expect(
				registerForCompetition({
					competitionId: competition.id,
					userId: testUser.id,
					divisionId: "slvl_invalid",
				}),
			).rejects.toThrow("Division not found")
		})
	})
})
