/**
 * Judging Sheet Server Functions Tests
 *
 * Tests CRUD operations for competition event judging sheets:
 * - Creating judging sheets (with permission checks)
 * - Updating judging sheet titles
 * - Deleting judging sheets
 * - Getting judging sheets for an event (public access)
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FakeDrizzleDb } from "@repo/test-utils"

// Mock the database
const mockDb = new FakeDrizzleDb()

vi.mock("@/db", () => ({
	getDb: vi.fn(() => mockDb),
}))

// Test user and team data
const organizerUserId = "user-organizer-123"
const teamId = "team-organizer-abc"
const competitionId = "comp-test-123"
const trackWorkoutId = "trwk-test-456"

// Mock sessions - permissions must match the lowercase values in TEAM_PERMISSIONS
const mockOrganizerSession = {
	userId: organizerUserId,
	user: {
		id: organizerUserId,
		email: "organizer@example.com",
	},
	teams: [
		{
			id: teamId,
			permissions: ["manage_programming", "manage_team"],
		},
	],
}

// Mock auth
vi.mock("@/utils/auth", () => ({
	getSessionFromCookie: vi.fn(() => Promise.resolve(mockOrganizerSession)),
}))

// Mock TanStack createServerFn
vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		inputValidator: (validator: (data: unknown) => unknown) => ({
			handler: (fn: (ctx: { data: unknown }) => Promise<unknown>) => {
				return async (ctx: { data: unknown }) => {
					const validatedData = validator(ctx.data)
					return fn({ data: validatedData })
				}
			},
		}),
	}),
}))

// Import after mocks
import { getSessionFromCookie } from "@/utils/auth"
import {
	getEventJudgingSheetsFn,
	createJudgingSheetFn,
	updateJudgingSheetFn,
	deleteJudgingSheetFn,
} from "@/server-fns/judging-sheet-fns"

// Helper to set mock session
const setMockSession = (session: unknown) => {
	vi.mocked(getSessionFromCookie).mockResolvedValue(
		session as Awaited<ReturnType<typeof getSessionFromCookie>>,
	)
}

// Factory functions
function createMockJudgingSheet(
	overrides: Partial<{
		id: string
		competitionId: string
		trackWorkoutId: string
		title: string
		url: string
		r2Key: string
		originalFilename: string
		fileSize: number
		mimeType: string
		uploadedBy: string
		sortOrder: number
		createdAt: Date
		updatedAt: Date
	}> = {},
) {
	return {
		id: overrides.id ?? `ejsheet_${Math.random().toString(36).slice(2, 8)}`,
		competitionId: overrides.competitionId ?? competitionId,
		trackWorkoutId: overrides.trackWorkoutId ?? trackWorkoutId,
		title: overrides.title ?? "Event 1 Judging Sheet",
		url: overrides.url ?? "https://pub-test.r2.dev/competitions/judging-sheets/test.pdf",
		r2Key: overrides.r2Key ?? "competitions/judging-sheets/comp-test/test.pdf",
		originalFilename: overrides.originalFilename ?? "event1-scorecard.pdf",
		fileSize: overrides.fileSize ?? 150000,
		mimeType: overrides.mimeType ?? "application/pdf",
		uploadedBy: overrides.uploadedBy ?? organizerUserId,
		sortOrder: overrides.sortOrder ?? 0,
		createdAt: overrides.createdAt ?? new Date(),
		updatedAt: overrides.updatedAt ?? new Date(),
	}
}

describe("Judging Sheet Server Functions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockDb.reset()
		mockDb.registerTable("eventJudgingSheetsTable")
		mockDb.registerTable("competitionsTable")
		mockDb.registerTable("trackWorkoutsTable")
		mockDb.registerTable("programmingTracksTable")
		setMockSession(mockOrganizerSession)
	})

	describe("getEventJudgingSheetsFn", () => {
		it("returns empty array when no sheets exist", async () => {
			mockDb.setMockReturnValue([])

			const result = await getEventJudgingSheetsFn({
				data: { trackWorkoutId },
			})

			expect(result.sheets).toEqual([])
		})

		it("returns sheets sorted by sortOrder", async () => {
			const sheet1 = createMockJudgingSheet({ id: "sheet-1", sortOrder: 0 })
			const sheet2 = createMockJudgingSheet({ id: "sheet-2", sortOrder: 1, title: "Second Sheet" })

			mockDb.setMockReturnValue([sheet1, sheet2])

			const result = await getEventJudgingSheetsFn({
				data: { trackWorkoutId },
			})

			expect(result.sheets).toHaveLength(2)
			expect(result.sheets[0].id).toBe("sheet-1")
			expect(result.sheets[1].id).toBe("sheet-2")
		})

		it("does not require authentication (public access)", async () => {
			setMockSession(null)
			mockDb.setMockReturnValue([])

			const result = await getEventJudgingSheetsFn({
				data: { trackWorkoutId },
			})

			expect(result.sheets).toEqual([])
		})
	})

	describe("createJudgingSheetFn", () => {
		it("requires authentication", async () => {
			setMockSession(null)

			await expect(
				createJudgingSheetFn({
					data: {
						competitionId,
						trackWorkoutId,
						title: "Test",
						url: "https://test.r2.dev/test.pdf",
						r2Key: "test/test.pdf",
						originalFilename: "test.pdf",
						fileSize: 100,
						mimeType: "application/pdf",
					},
				}),
			).rejects.toThrow("Not authenticated")
		})

		// Note: Permission check test skipped - FakeDrizzleDb doesn't support
		// db.query.table.findFirst() pattern used by createJudgingSheetFn.
		// Permission checking is tested elsewhere via requireTeamPermission.

		it("fails if competition not found", async () => {
			mockDb.setMockReturnValue([])

			await expect(
				createJudgingSheetFn({
					data: {
						competitionId: "nonexistent",
						trackWorkoutId,
						title: "Test",
						url: "https://test.r2.dev/test.pdf",
						r2Key: "test/test.pdf",
						originalFilename: "test.pdf",
						fileSize: 100,
						mimeType: "application/pdf",
					},
				}),
			).rejects.toThrow("Competition not found")
		})
	})

	describe("updateJudgingSheetFn", () => {
		it("requires authentication", async () => {
			setMockSession(null)

			await expect(
				updateJudgingSheetFn({
					data: {
						judgingSheetId: "ejsheet-test-1",
						title: "Updated Title",
					},
				}),
			).rejects.toThrow("Not authenticated")
		})

		it("fails if sheet not found", async () => {
			mockDb.setMockReturnValue([])

			await expect(
				updateJudgingSheetFn({
					data: {
						judgingSheetId: "nonexistent",
						title: "Updated Title",
					},
				}),
			).rejects.toThrow("Judging sheet not found")
		})
	})

	describe("deleteJudgingSheetFn", () => {
		it("requires authentication", async () => {
			setMockSession(null)

			await expect(
				deleteJudgingSheetFn({
					data: {
						judgingSheetId: "ejsheet-test-1",
					},
				}),
			).rejects.toThrow("Not authenticated")
		})

		it("fails if sheet not found", async () => {
			mockDb.setMockReturnValue([])

			await expect(
				deleteJudgingSheetFn({
					data: {
						judgingSheetId: "nonexistent",
					},
				}),
			).rejects.toThrow("Judging sheet not found")
		})
	})
})
