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
			permissions: ["manage_programming", "manage_team", "manage_competitions"],
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
		competition: {
			id: string
			organizingTeamId: string
		}
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
		...(overrides.competition && { competition: overrides.competition }),
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

		it("fails if competition not found", async () => {
			mockDb.query.competitionsTable.findFirst.mockResolvedValueOnce(undefined)

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

		it("creates judging sheet and returns it", async () => {
			const mockCompetition = {
				id: competitionId,
				organizingTeamId: teamId,
			}
			const newSheet = createMockJudgingSheet({ id: "ejsheet_new123" })

			// Mock competition lookup
			mockDb.query.competitionsTable.findFirst.mockResolvedValueOnce(mockCompetition)

			// Mock track workout verification (returns array with matching competitionId)
			// Then mock existing sheets lookup (returns empty array)
			mockDb.setMockReturnValue([{ trackWorkoutId, competitionId }])

			// Mock the .returning() call after insert
			mockDb.getChainMock().returning.mockResolvedValueOnce([newSheet])

			const result = await createJudgingSheetFn({
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
			})

			expect(result.sheet.id).toBe("ejsheet_new123")
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
			mockDb.query.eventJudgingSheetsTable.findFirst.mockResolvedValueOnce(undefined)

			await expect(
				updateJudgingSheetFn({
					data: {
						judgingSheetId: "nonexistent",
						title: "Updated Title",
					},
				}),
			).rejects.toThrow("Judging sheet not found")
		})

		it("updates sheet title and returns updated sheet", async () => {
			const existingSheet = createMockJudgingSheet({
				id: "ejsheet_test1",
				title: "Old Title",
				competition: {
					id: competitionId,
					organizingTeamId: teamId,
				},
			})
			const updatedSheet = { ...existingSheet, title: "Updated Title" }

			// Mock the initial sheet lookup
			mockDb.query.eventJudgingSheetsTable.findFirst.mockResolvedValueOnce(existingSheet)

			// Mock the .returning() call after update
			mockDb.getChainMock().returning.mockResolvedValueOnce([updatedSheet])

			const result = await updateJudgingSheetFn({
				data: {
					judgingSheetId: "ejsheet_test1",
					title: "Updated Title",
				},
			})

			expect(result.sheet.title).toBe("Updated Title")
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
			mockDb.query.eventJudgingSheetsTable.findFirst.mockResolvedValueOnce(undefined)

			await expect(
				deleteJudgingSheetFn({
					data: {
						judgingSheetId: "nonexistent",
					},
				}),
			).rejects.toThrow("Judging sheet not found")
		})

		it("deletes sheet and returns success", async () => {
			const existingSheet = createMockJudgingSheet({
				id: "ejsheet_test1",
				competition: {
					id: competitionId,
					organizingTeamId: teamId,
				},
			})

			mockDb.query.eventJudgingSheetsTable.findFirst.mockResolvedValueOnce(existingSheet)

			const result = await deleteJudgingSheetFn({
				data: {
					judgingSheetId: "ejsheet_test1",
				},
			})

			expect(result.success).toBe(true)
		})
	})
})
