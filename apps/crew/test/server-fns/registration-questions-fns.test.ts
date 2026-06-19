/**
 * Registration Questions Server Functions Tests
 *
 * Tests CRUD operations for competition registration questions:
 * - Creating questions (with permission checks)
 * - Updating questions
 * - Deleting questions
 * - Reordering questions
 * - Getting questions (public)
 * - Submitting and retrieving answers
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
const athleteUserId = "user-athlete-456"
const teamId = "team-organizer-abc"
const competitionId = "comp-test-123"

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

const mockAthleteSession = {
	userId: athleteUserId,
	user: {
		id: athleteUserId,
		email: "athlete@example.com",
	},
	teams: [], // No team permissions
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
	getCompetitionQuestionsFn,
	createQuestionFn,
	updateQuestionFn,
	deleteQuestionFn,
	reorderQuestionsFn,
	getRegistrationAnswersFn,
	submitRegistrationAnswersFn,
	getCompetitionRegistrationAnswersFn,
	QUESTION_TYPES,
} from "@/server-fns/registration-questions-fns"

// Helper to set mock session
const setMockSession = (session: unknown) => {
	vi.mocked(getSessionFromCookie).mockResolvedValue(
		session as Awaited<ReturnType<typeof getSessionFromCookie>>,
	)
}

// Factory functions
function createMockQuestion(overrides: Partial<{
	id: string
	competitionId: string
	type: "text" | "select" | "number"
	label: string
	helpText: string | null
	options: string | null
	required: boolean
	forTeammates: boolean
	sortOrder: number
}> = {}) {
	return {
		id: overrides.id ?? `question_${Math.random().toString(36).slice(2, 8)}`,
		competitionId: overrides.competitionId ?? competitionId,
		type: overrides.type ?? "text",
		label: overrides.label ?? "Test Question",
		helpText: overrides.helpText ?? null,
		options: overrides.options ?? null,
		required: overrides.required ?? true,
		forTeammates: overrides.forTeammates ?? false,
		sortOrder: overrides.sortOrder ?? 0,
		createdAt: new Date(),
		updatedAt: new Date(),
	}
}

function createMockCompetition(overrides: Partial<{
	id: string
	organizingTeamId: string
	name: string
}> = {}) {
	return {
		id: overrides.id ?? competitionId,
		organizingTeamId: overrides.organizingTeamId ?? teamId,
		name: overrides.name ?? "Test Competition",
		slug: "test-comp",
	}
}

function createMockAnswer(overrides: Partial<{
	id: string
	questionId: string
	registrationId: string
	userId: string
	answer: string
}> = {}) {
	return {
		id: overrides.id ?? `answer_${Math.random().toString(36).slice(2, 8)}`,
		questionId: overrides.questionId ?? "question-123",
		registrationId: overrides.registrationId ?? "reg-123",
		userId: overrides.userId ?? athleteUserId,
		answer: overrides.answer ?? "Test answer",
		createdAt: new Date(),
		updatedAt: new Date(),
	}
}

describe("registration-questions-fns", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockDb.reset()
		mockDb.registerTable("competitionRegistrationQuestionsTable")
		mockDb.registerTable("competitionRegistrationAnswersTable")
		mockDb.registerTable("competitionsTable")
		mockDb.registerTable("competitionRegistrationsTable")
		setMockSession(mockOrganizerSession)
	})

	// ============================================================================
	// QUESTION_TYPES constant
	// ============================================================================

	describe("QUESTION_TYPES", () => {
		it("includes text, select, and number types", () => {
			expect(QUESTION_TYPES).toContain("text")
			expect(QUESTION_TYPES).toContain("select")
			expect(QUESTION_TYPES).toContain("number")
			expect(QUESTION_TYPES).toHaveLength(3)
		})
	})

	// ============================================================================
	// getCompetitionQuestionsFn (public - no auth required)
	// ============================================================================

	describe("getCompetitionQuestionsFn", () => {
		it("returns questions for a competition ordered by sortOrder", async () => {
			const questions = [
				createMockQuestion({ id: "q1", sortOrder: 0, label: "First" }),
				createMockQuestion({ id: "q2", sortOrder: 1, label: "Second" }),
				createMockQuestion({ id: "q3", sortOrder: 2, label: "Third" }),
			]
			mockDb.setMockReturnValue(questions)

			const result = await getCompetitionQuestionsFn({
				data: { competitionId },
			})

			expect(result.questions).toHaveLength(3)
			expect(result.questions[0].label).toBe("First")
			expect(result.questions[1].label).toBe("Second")
			expect(result.questions[2].label).toBe("Third")
		})

		it("returns empty array when no questions exist", async () => {
			mockDb.setMockReturnValue([])

			const result = await getCompetitionQuestionsFn({
				data: { competitionId },
			})

			expect(result.questions).toHaveLength(0)
		})

		it("parses JSON options for select questions", async () => {
			const questions = [
				createMockQuestion({
					type: "select",
					options: JSON.stringify(["Small", "Medium", "Large"]),
				}),
			]
			mockDb.setMockReturnValue(questions)

			const result = await getCompetitionQuestionsFn({
				data: { competitionId },
			})

			expect(result.questions[0].options).toEqual(["Small", "Medium", "Large"])
		})

		it("returns null for invalid JSON options", async () => {
			const questions = [
				createMockQuestion({
					type: "select",
					options: "not-valid-json",
				}),
			]
			mockDb.setMockReturnValue(questions)

			const result = await getCompetitionQuestionsFn({
				data: { competitionId },
			})

			expect(result.questions[0].options).toBeNull()
		})

		it("throws validation error for missing competitionId", async () => {
			await expect(
				getCompetitionQuestionsFn({
					data: { competitionId: "" },
				}),
			).rejects.toThrow()
		})
	})

	// ============================================================================
	// createQuestionFn (requires MANAGE_PROGRAMMING permission)
	// ============================================================================

	describe("createQuestionFn", () => {
		describe("authentication and authorization", () => {
			it("throws when not authenticated", async () => {
				setMockSession(null)

				await expect(
					createQuestionFn({
						data: {
							competitionId,
							teamId,
							type: "text",
							label: "Test Question",
							required: true,
							forTeammates: false,
						},
					}),
				).rejects.toThrow("Not authenticated")
			})

			it("throws when user lacks MANAGE_PROGRAMMING permission", async () => {
				setMockSession(mockAthleteSession)

				await expect(
					createQuestionFn({
						data: {
							competitionId,
							teamId,
							type: "text",
							label: "Test Question",
							required: true,
							forTeammates: false,
						},
					}),
				).rejects.toThrow("Missing required permission")
			})
		})

		describe("competition validation", () => {
			it("throws when competition not found", async () => {
				// Return empty array for competition lookup
				mockDb.setMockReturnValue([])

				await expect(
					createQuestionFn({
						data: {
							competitionId: "nonexistent",
							teamId,
							type: "text",
							label: "Test Question",
							required: true,
							forTeammates: false,
						},
					}),
				).rejects.toThrow("Competition not found")
			})
		})

		describe("input validation", () => {
			it("throws for empty label", async () => {
				await expect(
					createQuestionFn({
						data: {
							competitionId,
							teamId,
							type: "text",
							label: "",
							required: true,
							forTeammates: false,
						},
					}),
				).rejects.toThrow()
			})

			it("throws for invalid question type", async () => {
				await expect(
					createQuestionFn({
						data: {
							competitionId,
							teamId,
							type: "invalid" as "text",
							label: "Test",
							required: true,
							forTeammates: false,
						},
					}),
				).rejects.toThrow()
			})
		})
	})

	// ============================================================================
	// updateQuestionFn
	// ============================================================================

	describe("updateQuestionFn", () => {
		const questionId = "question-123"

		describe("authentication and authorization", () => {
			it("throws when not authenticated", async () => {
				setMockSession(null)

				await expect(
					updateQuestionFn({
						data: {
							questionId,
							teamId,
							label: "Updated Question",
						},
					}),
				).rejects.toThrow("Not authenticated")
			})

			it("throws when user lacks permission", async () => {
				setMockSession(mockAthleteSession)

				await expect(
					updateQuestionFn({
						data: {
							questionId,
							teamId,
							label: "Updated Question",
						},
					}),
				).rejects.toThrow("Missing required permission")
			})
		})

		describe("question lookup", () => {
			it("throws when question not found", async () => {
				// Return empty array for question lookup
				mockDb.setMockReturnValue([])

				await expect(
					updateQuestionFn({
						data: {
							questionId: "nonexistent",
							teamId,
							label: "Updated",
						},
					}),
				).rejects.toThrow("Question not found")
			})
		})
	})

	// ============================================================================
	// deleteQuestionFn
	// ============================================================================

	describe("deleteQuestionFn", () => {
		const questionId = "question-123"

		describe("authentication and authorization", () => {
			it("throws when not authenticated", async () => {
				setMockSession(null)

				await expect(
					deleteQuestionFn({
						data: { questionId, teamId },
					}),
				).rejects.toThrow("Not authenticated")
			})

			it("throws when user lacks permission", async () => {
				setMockSession(mockAthleteSession)

				await expect(
					deleteQuestionFn({
						data: { questionId, teamId },
					}),
				).rejects.toThrow("Missing required permission")
			})
		})

		describe("question deletion", () => {
			it("throws when question not found", async () => {
				mockDb.setMockReturnValue([])

				await expect(
					deleteQuestionFn({
						data: { questionId: "nonexistent", teamId },
					}),
				).rejects.toThrow("Question not found")
			})
		})
	})

	// ============================================================================
	// reorderQuestionsFn
	// ============================================================================

	describe("reorderQuestionsFn", () => {
		describe("authentication and authorization", () => {
			it("throws when not authenticated", async () => {
				setMockSession(null)

				await expect(
					reorderQuestionsFn({
						data: {
							competitionId,
							teamId,
							orderedQuestionIds: ["q1", "q2"],
						},
					}),
				).rejects.toThrow("Not authenticated")
			})

			it("throws when user lacks permission", async () => {
				setMockSession(mockAthleteSession)

				await expect(
					reorderQuestionsFn({
						data: {
							competitionId,
							teamId,
							orderedQuestionIds: ["q1", "q2"],
						},
					}),
				).rejects.toThrow("Missing required permission")
			})
		})

		describe("reordering", () => {
			it("throws when competition not found", async () => {
				mockDb.setMockReturnValue([])

				await expect(
					reorderQuestionsFn({
						data: {
							competitionId: "nonexistent",
							teamId,
							orderedQuestionIds: ["q1", "q2"],
						},
					}),
				).rejects.toThrow("Competition does not belong to this team")
			})
		})
	})

	// ============================================================================
	// getRegistrationAnswersFn
	// ============================================================================

	describe("getRegistrationAnswersFn", () => {
		const registrationId = "reg-123"

		it("returns answers for a registration", async () => {
			const answers = [
				createMockAnswer({ questionId: "q1", answer: "Answer 1" }),
				createMockAnswer({ questionId: "q2", answer: "Answer 2" }),
			]
			mockDb.setMockReturnValue(answers)

			const result = await getRegistrationAnswersFn({
				data: { registrationId },
			})

			expect(result.answers).toHaveLength(2)
			expect(result.answers[0].answer).toBe("Answer 1")
			expect(result.answers[1].answer).toBe("Answer 2")
		})

		it("filters by userId when provided", async () => {
			const answers = [
				createMockAnswer({ userId: athleteUserId, answer: "My answer" }),
			]
			mockDb.setMockReturnValue(answers)

			const result = await getRegistrationAnswersFn({
				data: { registrationId, userId: athleteUserId },
			})

			expect(result.answers).toHaveLength(1)
			expect(result.answers[0].userId).toBe(athleteUserId)
		})

		it("returns empty array when no answers exist", async () => {
			mockDb.setMockReturnValue([])

			const result = await getRegistrationAnswersFn({
				data: { registrationId },
			})

			expect(result.answers).toHaveLength(0)
		})
	})

	// ============================================================================
	// submitRegistrationAnswersFn
	// ============================================================================

	describe("submitRegistrationAnswersFn", () => {
		const registrationId = "reg-123"

		it("throws when not authenticated", async () => {
			setMockSession(null)

			await expect(
				submitRegistrationAnswersFn({
					data: {
						registrationId,
						answers: [{ questionId: "q1", answer: "Test" }],
					},
				}),
			).rejects.toThrow("Not authenticated")
		})

		it("inserts new answers when none exist", async () => {
			setMockSession(mockAthleteSession)
			// Mock no existing answer
			mockDb.query.competitionRegistrationAnswersTable = {
				findFirst: vi.fn().mockResolvedValue(null),
				findMany: vi.fn().mockResolvedValue([]),
			}

			const result = await submitRegistrationAnswersFn({
				data: {
					registrationId,
					answers: [
						{ questionId: "q1", answer: "Answer 1" },
						{ questionId: "q2", answer: "Answer 2" },
					],
				},
			})

			expect(result.success).toBe(true)
			expect(mockDb.insert).toHaveBeenCalledTimes(2)
		})

		it("updates existing answers", async () => {
			setMockSession(mockAthleteSession)
			// Mock existing answer
			mockDb.query.competitionRegistrationAnswersTable = {
				findFirst: vi.fn().mockResolvedValue(
					createMockAnswer({ id: "existing-answer", questionId: "q1" }),
				),
				findMany: vi.fn().mockResolvedValue([]),
			}

			const result = await submitRegistrationAnswersFn({
				data: {
					registrationId,
					answers: [{ questionId: "q1", answer: "Updated answer" }],
				},
			})

			expect(result.success).toBe(true)
			expect(mockDb.update).toHaveBeenCalled()
		})
	})

	// ============================================================================
	// getCompetitionRegistrationAnswersFn
	// ============================================================================

	describe("getCompetitionRegistrationAnswersFn", () => {
		it("throws when not authenticated", async () => {
			setMockSession(null)

			await expect(
				getCompetitionRegistrationAnswersFn({
					data: { competitionId, teamId },
				}),
			).rejects.toThrow("Not authenticated")
		})

		it("throws when user lacks permission", async () => {
			setMockSession(mockAthleteSession)

			await expect(
				getCompetitionRegistrationAnswersFn({
					data: { competitionId, teamId },
				}),
			).rejects.toThrow("Missing required permission")
		})

		it("throws when competition belongs to different team", async () => {
			// Mock competition with different team
			mockDb.setMockReturnValue([
				createMockCompetition({ organizingTeamId: "different-team" }),
			])

			await expect(
				getCompetitionRegistrationAnswersFn({
					data: { competitionId, teamId },
				}),
			).rejects.toThrow("Competition does not belong to this team")
		})
	})
})
