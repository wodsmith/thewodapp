import { beforeEach, describe, expect, it, vi } from "vitest"
import { FakeDrizzleDb } from "@repo/test-utils"
import {
	createReviewNoteFn,
	deleteReviewNoteFn,
	getReviewNotesFn,
	getWorkoutMovementsFn,
	updateReviewNoteFn,
} from "@/server-fns/review-note-fns"

// Mock the database
const mockDb = new FakeDrizzleDb()

vi.mock("@/db", () => ({
	getDb: vi.fn(() => mockDb),
}))

// Create test sessions
const mockAuthenticatedSession = {
	id: "session-1",
	userId: "test-user-123",
	expiresAt: Date.now() + 86400000,
	createdAt: Date.now(),
	user: {
		id: "test-user-123",
		email: "test@example.com",
	},
	teams: [
		{
			id: "team-1",
			permissions: [],
		},
	],
}

// Mock auth - default to authenticated
vi.mock("@/utils/auth", () => ({
	getSessionFromCookie: vi.fn(() => Promise.resolve(mockAuthenticatedSession)),
}))

// Mock team auth - default to allowing
vi.mock("@/utils/team-auth", () => ({
	requireTeamPermission: vi.fn(() => Promise.resolve()),
}))

// Mock TanStack createServerFn to make server functions directly callable in tests
vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => {
		return {
			inputValidator: (validator: (data: unknown) => unknown) => ({
				handler: (fn: (ctx: { data: unknown }) => Promise<unknown>) => {
					return async (ctx: { data: unknown }) => {
						const validatedData = validator(ctx.data)
						return fn({ data: validatedData })
					}
				},
			}),
		}
	},
}))

// Import mocked modules so we can change behavior in tests
import { getSessionFromCookie } from "@/utils/auth"
import { requireTeamPermission } from "@/utils/team-auth"

// Helper to set mock session with proper type coercion
const setMockSession = (session: unknown) => {
	vi.mocked(getSessionFromCookie).mockResolvedValue(
		session as Awaited<ReturnType<typeof getSessionFromCookie>>,
	)
}

// Factory helpers
function createTestCompetition(overrides?: Partial<{ id: string; organizingTeamId: string }>) {
	return {
		id: overrides?.id ?? "comp-1",
		organizingTeamId: overrides?.organizingTeamId ?? "team-1",
	}
}

function createTestReviewNote(overrides?: Partial<{
	id: string
	type: string
	content: string
	timestampSeconds: number | null
	movementId: string | null
	movementName: string | null
	createdAt: Date
	reviewerId: string
	reviewerFirstName: string
	reviewerLastName: string
	reviewerAvatar: string | null
}>) {
	return {
		id: overrides?.id ?? "rnote_test1",
		type: overrides?.type ?? "general",
		content: overrides?.content ?? "Good form on the clean",
		timestampSeconds: overrides?.timestampSeconds ?? 45,
		movementId: overrides?.movementId ?? null,
		movementName: overrides?.movementName ?? null,
		createdAt: overrides?.createdAt ?? new Date("2026-01-15T10:00:00Z"),
		reviewerId: overrides?.reviewerId ?? "test-user-123",
		reviewerFirstName: overrides?.reviewerFirstName ?? "Test",
		reviewerLastName: overrides?.reviewerLastName ?? "User",
		reviewerAvatar: overrides?.reviewerAvatar ?? null,
	}
}

beforeEach(() => {
	mockDb.reset()
	vi.mocked(getSessionFromCookie).mockResolvedValue(
		mockAuthenticatedSession as unknown as Awaited<ReturnType<typeof getSessionFromCookie>>,
	)
	vi.mocked(requireTeamPermission).mockResolvedValue(undefined)
})

// ============================================================================
// getReviewNotesFn
// ============================================================================

describe("getReviewNotesFn", () => {
	it("returns notes for a valid submission", async () => {
		const note = createTestReviewNote()
		mockDb.getChainMock().limit.mockResolvedValueOnce([createTestCompetition()])
		mockDb.getChainMock().orderBy.mockResolvedValueOnce([note])

		const result = await getReviewNotesFn({
			data: { videoSubmissionId: "sub-1", competitionId: "comp-1" },
		})

		expect(result.notes).toHaveLength(1)
		expect(result.notes[0].content).toBe("Good form on the clean")
		expect(result.notes[0].reviewer.firstName).toBe("Test")
	})

	it("returns empty array when no notes exist", async () => {
		mockDb.getChainMock().limit.mockResolvedValueOnce([createTestCompetition()])
		mockDb.getChainMock().orderBy.mockResolvedValueOnce([])

		const result = await getReviewNotesFn({
			data: { videoSubmissionId: "sub-1", competitionId: "comp-1" },
		})

		expect(result.notes).toHaveLength(0)
	})

	it("throws when competition not found", async () => {
		mockDb.getChainMock().limit.mockResolvedValueOnce([])

		await expect(
			getReviewNotesFn({
				data: { videoSubmissionId: "sub-1", competitionId: "nonexistent" },
			}),
		).rejects.toThrow("NOT_FOUND: Competition not found")
	})

	it("checks organizer permission", async () => {
		mockDb.getChainMock().limit.mockResolvedValueOnce([
			createTestCompetition({ organizingTeamId: "team-org" }),
		])
		mockDb.getChainMock().orderBy.mockResolvedValueOnce([])

		await getReviewNotesFn({
			data: { videoSubmissionId: "sub-1", competitionId: "comp-1" },
		})

		expect(requireTeamPermission).toHaveBeenCalledWith(
			"team-org",
			expect.any(String),
		)
	})

	it("rejects invalid input", async () => {
		await expect(
			getReviewNotesFn({ data: { videoSubmissionId: "", competitionId: "comp-1" } }),
		).rejects.toThrow()
	})
})

// ============================================================================
// createReviewNoteFn
// ============================================================================

describe("createReviewNoteFn", () => {
	it("creates a general note with timestamp", async () => {
		const createdNote = createTestReviewNote({ id: "rnote_new" })

		mockDb.getChainMock().limit.mockResolvedValueOnce([createTestCompetition()])
		// Video submission validation query
		mockDb.getChainMock().limit.mockResolvedValueOnce([{ id: "sub-1" }])
		mockDb.getChainMock().values.mockResolvedValueOnce([])
		mockDb.getChainMock().limit.mockResolvedValueOnce([createdNote])

		const result = await createReviewNoteFn({
			data: {
				videoSubmissionId: "sub-1",
				competitionId: "comp-1",
				content: "Good form on the clean",
				timestampSeconds: 45,
			},
		})

		expect(result.note.content).toBe("Good form on the clean")
		expect(result.note.timestampSeconds).toBe(45)
		expect(result.note.reviewer.id).toBe("test-user-123")
	})

	it("creates a no-rep note with movement", async () => {
		const createdNote = createTestReviewNote({
			type: "no-rep",
			movementId: "mv-1",
			movementName: "Clean & Jerk",
		})

		mockDb.getChainMock().limit.mockResolvedValueOnce([createTestCompetition()])
		mockDb.getChainMock().limit.mockResolvedValueOnce([{ id: "sub-1" }])
		mockDb.getChainMock().values.mockResolvedValueOnce([])
		mockDb.getChainMock().limit.mockResolvedValueOnce([createdNote])

		const result = await createReviewNoteFn({
			data: {
				videoSubmissionId: "sub-1",
				competitionId: "comp-1",
				type: "no-rep",
				content: "Did not reach full extension",
				movementId: "mv-1",
			},
		})

		expect(result.note.type).toBe("no-rep")
		expect(result.note.movementName).toBe("Clean & Jerk")
	})

	it("throws when not authenticated", async () => {
		setMockSession(null)

		await expect(
			createReviewNoteFn({
				data: {
					videoSubmissionId: "sub-1",
					competitionId: "comp-1",
					content: "Test note",
				},
			}),
		).rejects.toThrow("Not authenticated")
	})

	it("throws when competition not found", async () => {
		mockDb.getChainMock().limit.mockResolvedValueOnce([])

		await expect(
			createReviewNoteFn({
				data: {
					videoSubmissionId: "sub-1",
					competitionId: "nonexistent",
					content: "Test note",
				},
			}),
		).rejects.toThrow("NOT_FOUND: Competition not found")
	})

	it("defaults type to general", async () => {
		const createdNote = createTestReviewNote({ type: "general" })

		mockDb.getChainMock().limit.mockResolvedValueOnce([createTestCompetition()])
		mockDb.getChainMock().limit.mockResolvedValueOnce([{ id: "sub-1" }])
		mockDb.getChainMock().values.mockResolvedValueOnce([])
		mockDb.getChainMock().limit.mockResolvedValueOnce([createdNote])

		const result = await createReviewNoteFn({
			data: {
				videoSubmissionId: "sub-1",
				competitionId: "comp-1",
				content: "General observation",
			},
		})

		expect(result.note.type).toBe("general")
	})

	it("rejects content exceeding max length", async () => {
		const longContent = "a".repeat(2001)
		await expect(
			createReviewNoteFn({
				data: {
					videoSubmissionId: "sub-1",
					competitionId: "comp-1",
					content: longContent,
				},
			}),
		).rejects.toThrow()
	})

	it("rejects empty content", async () => {
		await expect(
			createReviewNoteFn({
				data: {
					videoSubmissionId: "sub-1",
					competitionId: "comp-1",
					content: "",
				},
			}),
		).rejects.toThrow()
	})

	it("rejects invalid type", async () => {
		await expect(
			createReviewNoteFn({
				data: {
					videoSubmissionId: "sub-1",
					competitionId: "comp-1",
					content: "Test",
					type: "invalid-type",
				},
			}),
		).rejects.toThrow()
	})

	it("rejects negative timestamp", async () => {
		await expect(
			createReviewNoteFn({
				data: {
					videoSubmissionId: "sub-1",
					competitionId: "comp-1",
					content: "Test",
					timestampSeconds: -1,
				},
			}),
		).rejects.toThrow()
	})
})

// ============================================================================
// updateReviewNoteFn
// ============================================================================

describe("updateReviewNoteFn", () => {
	it("updates note content", async () => {
		mockDb.getChainMock().limit.mockResolvedValueOnce([createTestCompetition()])
		// update().set().where() resolves via thenable

		const result = await updateReviewNoteFn({
			data: {
				noteId: "rnote_1",
				competitionId: "comp-1",
				content: "Updated content",
			},
		})

		expect(result.success).toBe(true)
	})

	it("updates note type", async () => {
		mockDb.getChainMock().limit.mockResolvedValueOnce([createTestCompetition()])

		const result = await updateReviewNoteFn({
			data: {
				noteId: "rnote_1",
				competitionId: "comp-1",
				type: "no-rep",
			},
		})

		expect(result.success).toBe(true)
	})

	it("clears movement by setting to null", async () => {
		mockDb.getChainMock().limit.mockResolvedValueOnce([createTestCompetition()])

		const result = await updateReviewNoteFn({
			data: {
				noteId: "rnote_1",
				competitionId: "comp-1",
				movementId: null,
			},
		})

		expect(result.success).toBe(true)
	})

	it("throws when no fields to update", async () => {
		mockDb.getChainMock().limit.mockResolvedValueOnce([createTestCompetition()])

		await expect(
			updateReviewNoteFn({
				data: {
					noteId: "rnote_1",
					competitionId: "comp-1",
				},
			}),
		).rejects.toThrow("No fields to update")
	})

	it("throws when not authenticated", async () => {
		setMockSession(null)

		await expect(
			updateReviewNoteFn({
				data: {
					noteId: "rnote_1",
					competitionId: "comp-1",
					content: "Updated",
				},
			}),
		).rejects.toThrow("Not authenticated")
	})

	it("throws when competition not found", async () => {
		mockDb.getChainMock().limit.mockResolvedValueOnce([])

		await expect(
			updateReviewNoteFn({
				data: {
					noteId: "rnote_1",
					competitionId: "nonexistent",
					content: "Updated",
				},
			}),
		).rejects.toThrow("NOT_FOUND: Competition not found")
	})
})

// ============================================================================
// deleteReviewNoteFn
// ============================================================================

describe("deleteReviewNoteFn", () => {
	it("deletes an existing note", async () => {
		mockDb.getChainMock().limit.mockResolvedValueOnce([createTestCompetition()])
		mockDb.getChainMock().limit.mockResolvedValueOnce([{ id: "rnote_1" }])

		const result = await deleteReviewNoteFn({
			data: { noteId: "rnote_1", competitionId: "comp-1" },
		})

		expect(result.success).toBe(true)
	})

	it("throws when note not found", async () => {
		mockDb.getChainMock().limit.mockResolvedValueOnce([createTestCompetition()])
		mockDb.getChainMock().limit.mockResolvedValueOnce([])

		await expect(
			deleteReviewNoteFn({
				data: { noteId: "nonexistent", competitionId: "comp-1" },
			}),
		).rejects.toThrow("NOT_FOUND: Review note not found")
	})

	it("throws when not authenticated", async () => {
		setMockSession(null)

		await expect(
			deleteReviewNoteFn({
				data: { noteId: "rnote_1", competitionId: "comp-1" },
			}),
		).rejects.toThrow("Not authenticated")
	})

	it("throws when competition not found", async () => {
		mockDb.getChainMock().limit.mockResolvedValueOnce([])

		await expect(
			deleteReviewNoteFn({
				data: { noteId: "rnote_1", competitionId: "nonexistent" },
			}),
		).rejects.toThrow("NOT_FOUND: Competition not found")
	})
})

// ============================================================================
// getWorkoutMovementsFn
// ============================================================================

describe("getWorkoutMovementsFn", () => {
	it("returns movements for a workout", async () => {
		const testMovements = [
			{ id: "mv-1", name: "Clean & Jerk", type: "weightlifting" },
			{ id: "mv-2", name: "Pull-up", type: "gymnastics" },
		]

		mockDb.getChainMock().limit.mockResolvedValueOnce([createTestCompetition()])
		// The movements query ends at .where() which resolves via thenable
		mockDb.setMockReturnValue(testMovements)

		const result = await getWorkoutMovementsFn({
			data: { workoutId: "wk-1", competitionId: "comp-1" },
		})

		expect(result.movements).toHaveLength(2)
		expect(result.movements[0].name).toBe("Clean & Jerk")
		expect(result.movements[1].name).toBe("Pull-up")
	})

	it("returns empty array when workout has no movements", async () => {
		mockDb.getChainMock().limit.mockResolvedValueOnce([createTestCompetition()])
		// Default mockReturnValue is [] after reset

		const result = await getWorkoutMovementsFn({
			data: { workoutId: "wk-1", competitionId: "comp-1" },
		})

		expect(result.movements).toHaveLength(0)
	})

	it("throws when competition not found", async () => {
		mockDb.getChainMock().limit.mockResolvedValueOnce([])

		await expect(
			getWorkoutMovementsFn({
				data: { workoutId: "wk-1", competitionId: "nonexistent" },
			}),
		).rejects.toThrow("NOT_FOUND: Competition not found")
	})

	it("checks organizer permission", async () => {
		mockDb.getChainMock().limit.mockResolvedValueOnce([
			createTestCompetition({ organizingTeamId: "team-org" }),
		])

		await getWorkoutMovementsFn({
			data: { workoutId: "wk-1", competitionId: "comp-1" },
		})

		expect(requireTeamPermission).toHaveBeenCalledWith(
			"team-org",
			expect.any(String),
		)
	})
})
