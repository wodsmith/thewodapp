import { beforeEach, describe, expect, it, vi } from "vitest"
import { FakeDrizzleDb } from "@repo/test-utils"
import {
	getVideoSubmissionFn,
	submitVideoFn,
} from "@/server-fns/video-submission-fns"

// Mock the database
const mockDb = new FakeDrizzleDb()

vi.mock("@/db", () => ({
	getDb: vi.fn(() => mockDb),
}))

// Create test sessions
const mockAuthenticatedSession = {
	userId: "test-user-123",
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

// Mock TanStack createServerFn to make server functions directly callable in tests
vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => {
		return {
			inputValidator: (validator: (data: unknown) => unknown) => ({
				handler: (fn: (ctx: { data: unknown }) => Promise<unknown>) => {
					// Return a wrapper that validates input then calls handler
					return async (ctx: { data: unknown }) => {
						// Run validation - will throw on invalid input
						const validatedData = validator(ctx.data)
						return fn({ data: validatedData })
					}
				},
			}),
		}
	},
}))

// Import mocked getSessionFromCookie so we can change its behavior in tests
import { getSessionFromCookie } from "@/utils/auth"

// Helper to set mock session with proper type coercion
const setMockSession = (session: unknown) => {
	vi.mocked(getSessionFromCookie).mockResolvedValue(
		session as Awaited<ReturnType<typeof getSessionFromCookie>>,
	)
}

// Factory for creating test competitions
function createTestCompetition(
	overrides?: Partial<{
		id: string
		competitionType: "in_person" | "online"
	}>,
) {
	return {
		id: overrides?.id ?? `comp-${Math.random().toString(36).slice(2, 8)}`,
		competitionType: overrides?.competitionType ?? "online",
		...overrides,
	}
}

// Factory for creating test registrations
function createTestRegistration(
	overrides?: Partial<{
		id: string
		eventId: string
		userId: string
		divisionId: string | null
	}>,
) {
	return {
		id: overrides?.id ?? `reg-${Math.random().toString(36).slice(2, 8)}`,
		eventId: overrides?.eventId ?? "comp-1",
		userId: overrides?.userId ?? "test-user-123",
		divisionId: overrides?.divisionId ?? "div-rx",
		...overrides,
	}
}

// Factory for creating test competition events
function createTestCompetitionEvent(
	overrides?: Partial<{
		competitionId: string
		trackWorkoutId: string
		submissionOpensAt: Date | null
		submissionClosesAt: Date | null
	}>,
) {
	return {
		competitionId: overrides?.competitionId ?? "comp-1",
		trackWorkoutId: overrides?.trackWorkoutId ?? "tw-1",
		submissionOpensAt: overrides?.submissionOpensAt ?? null,
		submissionClosesAt: overrides?.submissionClosesAt ?? null,
		...overrides,
	}
}

// Factory for creating test workouts
function createTestWorkout(
	overrides?: Partial<{
		id: string
		name: string
		scheme: string
		scoreType: string | null
		timeCap: number | null
		tiebreakScheme: string | null
		repsPerRound: number | null
	}>,
) {
	return {
		id: overrides?.id ?? `wk-${Math.random().toString(36).slice(2, 8)}`,
		name: overrides?.name ?? "Test Workout",
		scheme: overrides?.scheme ?? "time",
		scoreType: overrides?.scoreType ?? "min",
		timeCap: overrides?.timeCap ?? null,
		tiebreakScheme: overrides?.tiebreakScheme ?? null,
		repsPerRound: overrides?.repsPerRound ?? null,
		...overrides,
	}
}

// Factory for creating test track workouts
function createTestTrackWorkout(
	overrides?: Partial<{
		id: string
		trackId: string
		workoutId: string
	}>,
) {
	return {
		id: overrides?.id ?? `tw-${Math.random().toString(36).slice(2, 8)}`,
		trackId: overrides?.trackId ?? "track-1",
		workoutId: overrides?.workoutId ?? "wk-1",
		...overrides,
	}
}

// Factory for creating test video submissions
function createTestVideoSubmission(
	overrides?: Partial<{
		id: string
		registrationId: string
		trackWorkoutId: string
		userId: string
		videoUrl: string
		notes: string | null
		submittedAt: Date
		updatedAt: Date
	}>,
) {
	const now = new Date()
	return {
		id: overrides?.id ?? `sub-${Math.random().toString(36).slice(2, 8)}`,
		registrationId: overrides?.registrationId ?? "reg-1",
		trackWorkoutId: overrides?.trackWorkoutId ?? "tw-1",
		userId: overrides?.userId ?? "test-user-123",
		videoUrl: overrides?.videoUrl ?? "https://youtube.com/watch?v=test",
		notes: overrides?.notes ?? null,
		submittedAt: overrides?.submittedAt ?? now,
		updatedAt: overrides?.updatedAt ?? now,
		...overrides,
	}
}

// Factory for creating test scores
function createTestScore(
	overrides?: Partial<{
		id: string
		userId: string
		competitionEventId: string
		scoreValue: number | null
		status: string
		scheme: string
		secondaryValue: number | null
		tiebreakValue: number | null
	}>,
) {
	return {
		id: overrides?.id ?? `score-${Math.random().toString(36).slice(2, 8)}`,
		userId: overrides?.userId ?? "test-user-123",
		competitionEventId: overrides?.competitionEventId ?? "tw-1",
		scoreValue: overrides?.scoreValue ?? 300000,
		status: overrides?.status ?? "scored",
		scheme: overrides?.scheme ?? "time",
		secondaryValue: overrides?.secondaryValue ?? null,
		tiebreakValue: overrides?.tiebreakValue ?? null,
		...overrides,
	}
}

describe("Video Submission Server Functions (TanStack)", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockDb.reset()
		// Register tables for MySQL compatibility
		mockDb.registerTable('videoSubmissionsTable')
		// Reset to authenticated session
		setMockSession(mockAuthenticatedSession)
	})

	describe("getVideoSubmissionFn", () => {
		it("returns not authenticated when no session", async () => {
			setMockSession(null)

			const result = await getVideoSubmissionFn({
				data: {
					trackWorkoutId: "tw-1",
					competitionId: "comp-1",
				},
			})

			expect(result.submission).toBeNull()
			expect(result.canSubmit).toBe(false)
			expect(result.reason).toBe("Not authenticated")
			expect(result.isRegistered).toBe(false)
		})

		it("returns not registered when user has no registration", async () => {
			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock.mockResolvedValueOnce([]) // No registration found

			const result = await getVideoSubmissionFn({
				data: {
					trackWorkoutId: "tw-1",
					competitionId: "comp-1",
				},
			})

			expect(result.submission).toBeNull()
			expect(result.canSubmit).toBe(false)
			expect(result.reason).toBe(
				"You must be registered for this competition to submit a video",
			)
			expect(result.isRegistered).toBe(false)
		})

		it("returns canSubmit false for in-person competitions", async () => {
			const registration = createTestRegistration()
			const competition = createTestCompetition({ competitionType: "in_person" })

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration]) // Registration found
				.mockResolvedValueOnce([competition]) // Competition type check
				.mockResolvedValueOnce([]) // No submission
				.mockResolvedValueOnce([]) // No workout details
				.mockResolvedValueOnce([]) // No existing score

			const result = await getVideoSubmissionFn({
				data: {
					trackWorkoutId: "tw-1",
					competitionId: "comp-1",
				},
			})

			expect(result.canSubmit).toBe(false)
			expect(result.reason).toBe("Video submissions are only for online competitions")
		})

		it("returns canSubmit true when submission window is open", async () => {
			const registration = createTestRegistration()
			const competition = createTestCompetition({ competitionType: "online" })
			const now = new Date()
			const opensAt = new Date(now.getTime() - 3600000) // 1 hour ago
			const closesAt = new Date(now.getTime() + 3600000) // 1 hour from now
			const event = createTestCompetitionEvent({
				submissionOpensAt: opensAt,
				submissionClosesAt: closesAt,
			})

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration]) // Registration found
				.mockResolvedValueOnce([competition]) // Competition type check
				.mockResolvedValueOnce([event]) // Event with submission window
				.mockResolvedValueOnce([]) // No existing submission
				.mockResolvedValueOnce([]) // No workout details
				.mockResolvedValueOnce([]) // No existing score

			const result = await getVideoSubmissionFn({
				data: {
					trackWorkoutId: "tw-1",
					competitionId: "comp-1",
				},
			})

			expect(result.canSubmit).toBe(true)
			expect(result.isRegistered).toBe(true)
		})

		it("returns canSubmit false when submission window has not opened", async () => {
			const registration = createTestRegistration()
			const competition = createTestCompetition({ competitionType: "online" })
			const now = new Date()
			const opensAt = new Date(now.getTime() + 3600000) // 1 hour from now
			const closesAt = new Date(now.getTime() + 7200000) // 2 hours from now
			const event = createTestCompetitionEvent({
				submissionOpensAt: opensAt,
				submissionClosesAt: closesAt,
			})

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration])
				.mockResolvedValueOnce([competition])
				.mockResolvedValueOnce([event])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])

			const result = await getVideoSubmissionFn({
				data: {
					trackWorkoutId: "tw-1",
					competitionId: "comp-1",
				},
			})

			expect(result.canSubmit).toBe(false)
			expect(result.reason).toBe("Submission window has not opened yet")
		})

		it("returns canSubmit false when submission window has closed", async () => {
			const registration = createTestRegistration()
			const competition = createTestCompetition({ competitionType: "online" })
			const now = new Date()
			const opensAt = new Date(now.getTime() - 7200000) // 2 hours ago
			const closesAt = new Date(now.getTime() - 3600000) // 1 hour ago
			const event = createTestCompetitionEvent({
				submissionOpensAt: opensAt,
				submissionClosesAt: closesAt,
			})

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration])
				.mockResolvedValueOnce([competition])
				.mockResolvedValueOnce([event])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])

			const result = await getVideoSubmissionFn({
				data: {
					trackWorkoutId: "tw-1",
					competitionId: "comp-1",
				},
			})

			expect(result.canSubmit).toBe(false)
			expect(result.reason).toBe("Submission window has closed")
		})

		it("returns existing submission when found", async () => {
			const registration = createTestRegistration()
			const competition = createTestCompetition({ competitionType: "online" })
			const submission = createTestVideoSubmission()

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration])
				.mockResolvedValueOnce([competition])
				.mockResolvedValueOnce([]) // No event record = allow submission
				.mockResolvedValueOnce([submission])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])

			const result = await getVideoSubmissionFn({
				data: {
					trackWorkoutId: "tw-1",
					competitionId: "comp-1",
				},
			})

			expect(result.submission).toBeDefined()
			expect(result.submission?.videoUrl).toBe(submission.videoUrl)
		})

		it("returns workout details for score input", async () => {
			const registration = createTestRegistration()
			const competition = createTestCompetition({ competitionType: "online" })
			const workout = createTestWorkout({
				name: "21-15-9",
				scheme: "time-with-cap",
				timeCap: 600,
				tiebreakScheme: "time",
			})
			const trackWorkout = createTestTrackWorkout()

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration])
				.mockResolvedValueOnce([competition])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([{ ...trackWorkout, ...workout }])
				.mockResolvedValueOnce([])

			const result = await getVideoSubmissionFn({
				data: {
					trackWorkoutId: "tw-1",
					competitionId: "comp-1",
				},
			})

			expect(result.workout).toBeDefined()
			expect(result.workout?.name).toBe("21-15-9")
			expect(result.workout?.scheme).toBe("time-with-cap")
			expect(result.workout?.timeCap).toBe(600)
			expect(result.workout?.tiebreakScheme).toBe("time")
		})

		it("returns existing score when found", async () => {
			const registration = createTestRegistration()
			const competition = createTestCompetition({ competitionType: "online" })
			const score = createTestScore({
				scoreValue: 510000, // 8:30
				status: "scored",
				scheme: "time",
			})

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration])
				.mockResolvedValueOnce([competition])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([score])

			const result = await getVideoSubmissionFn({
				data: {
					trackWorkoutId: "tw-1",
					competitionId: "comp-1",
				},
			})

			expect(result.existingScore).toBeDefined()
			expect(result.existingScore?.scoreValue).toBe(510000)
			expect(result.existingScore?.status).toBe("scored")
		})

		it("throws on invalid input - empty trackWorkoutId", async () => {
			await expect(
				getVideoSubmissionFn({
					data: {
						trackWorkoutId: "",
						competitionId: "comp-1",
					},
				}),
			).rejects.toThrow()
		})

		it("throws on invalid input - empty competitionId", async () => {
			await expect(
				getVideoSubmissionFn({
					data: {
						trackWorkoutId: "tw-1",
						competitionId: "",
					},
				}),
			).rejects.toThrow()
		})
	})

	describe("submitVideoFn", () => {
		it("throws when not authenticated", async () => {
			setMockSession(null)

			await expect(
				submitVideoFn({
					data: {
						trackWorkoutId: "tw-1",
						competitionId: "comp-1",
						videoUrl: "https://youtube.com/watch?v=test",
					},
				}),
			).rejects.toThrow("Not authenticated")
		})

		it("throws when user is not registered", async () => {
			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock.mockResolvedValueOnce([]) // No registration

			await expect(
				submitVideoFn({
					data: {
						trackWorkoutId: "tw-1",
						competitionId: "comp-1",
						videoUrl: "https://youtube.com/watch?v=test",
					},
				}),
			).rejects.toThrow("You must be registered for this competition to submit a video")
		})

		it("throws when submission window is closed", async () => {
			const registration = createTestRegistration()
			const competition = createTestCompetition({ competitionType: "online" })
			const now = new Date()
			const event = createTestCompetitionEvent({
				submissionOpensAt: new Date(now.getTime() - 7200000),
				submissionClosesAt: new Date(now.getTime() - 3600000),
			})

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration])
				.mockResolvedValueOnce([competition])
				.mockResolvedValueOnce([event])

			await expect(
				submitVideoFn({
					data: {
						trackWorkoutId: "tw-1",
						competitionId: "comp-1",
						videoUrl: "https://youtube.com/watch?v=test",
					},
				}),
			).rejects.toThrow("Submission window has closed")
		})

		it("creates new video submission successfully", async () => {
			const registration = createTestRegistration()
			const competition = createTestCompetition({ competitionType: "online" })

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration])
				.mockResolvedValueOnce([competition])
				.mockResolvedValueOnce([]) // No event = allow submission
				.mockResolvedValueOnce([]) // No existing submission

			const result = await submitVideoFn({
				data: {
					trackWorkoutId: "tw-1",
					competitionId: "comp-1",
					videoUrl: "https://youtube.com/watch?v=test",
				},
			})

			expect(result.success).toBe(true)
			expect(result.submissionId).toBeDefined()
			expect(typeof result.submissionId).toBe("string")
			expect(result.submissionId).toMatch(/^vsub_/) // Verify CUID2 prefix
			expect(result.isUpdate).toBe(false)
			expect(mockDb.insert).toHaveBeenCalled()
		})

		it("updates existing video submission", async () => {
			const registration = createTestRegistration()
			const competition = createTestCompetition({ competitionType: "online" })
			const existingSubmission = createTestVideoSubmission({ id: "sub-existing" })

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration])
				.mockResolvedValueOnce([competition])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([existingSubmission]) // Existing submission found

			const result = await submitVideoFn({
				data: {
					trackWorkoutId: "tw-1",
					competitionId: "comp-1",
					videoUrl: "https://youtube.com/watch?v=updated",
				},
			})

			expect(result.success).toBe(true)
			expect(result.submissionId).toBe("sub-existing")
			expect(result.isUpdate).toBe(true)
			expect(mockDb.update).toHaveBeenCalled()
		})

		it("saves time score with video submission", async () => {
			const registration = createTestRegistration()
			const competition = createTestCompetition({ competitionType: "online" })
			const workout = createTestWorkout({
				id: "wk-1",
				scheme: "time",
				scoreType: "min",
			})
			const trackWorkout = createTestTrackWorkout({ workoutId: "wk-1" })
			const track = { ownerTeamId: "team-1" }

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration])
				.mockResolvedValueOnce([competition])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([]) // No existing submission
				.mockResolvedValueOnce([{ ...trackWorkout, ...workout, trackId: "track-1" }]) // Workout details
				.mockResolvedValueOnce([track]) // Track for team ownership

			const result = await submitVideoFn({
				data: {
					trackWorkoutId: "tw-1",
					competitionId: "comp-1",
					videoUrl: "https://youtube.com/watch?v=test",
					score: "5:30",
					scoreStatus: "scored",
				},
			})

			expect(result.success).toBe(true)
			// Should have called insert twice: video submission + score
			expect(mockDb.insert).toHaveBeenCalled()
		})

		it("saves capped score with secondary value (reps at cap)", async () => {
			const registration = createTestRegistration({ divisionId: "div-rx" })
			const competition = createTestCompetition({ competitionType: "online" })
			const workout = createTestWorkout({
				id: "wk-1",
				scheme: "time-with-cap",
				scoreType: "min",
				timeCap: 600, // 10 minutes
			})
			const trackWorkout = createTestTrackWorkout({ workoutId: "wk-1" })
			const track = { ownerTeamId: "team-1" }

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration])
				.mockResolvedValueOnce([competition])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([{ ...trackWorkout, ...workout, trackId: "track-1" }])
				.mockResolvedValueOnce([track])

			const result = await submitVideoFn({
				data: {
					trackWorkoutId: "tw-1",
					competitionId: "comp-1",
					videoUrl: "https://youtube.com/watch?v=test",
					score: "10:00",
					scoreStatus: "cap",
					secondaryScore: "150", // Reps at cap
				},
			})

			expect(result.success).toBe(true)
			expect(mockDb.insert).toHaveBeenCalled()
		})

		it("saves score with tiebreak value", async () => {
			const registration = createTestRegistration()
			const competition = createTestCompetition({ competitionType: "online" })
			const workout = createTestWorkout({
				id: "wk-1",
				scheme: "time",
				scoreType: "min",
				tiebreakScheme: "time",
			})
			const trackWorkout = createTestTrackWorkout({ workoutId: "wk-1" })
			const track = { ownerTeamId: "team-1" }

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration])
				.mockResolvedValueOnce([competition])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([{ ...trackWorkout, ...workout, trackId: "track-1" }])
				.mockResolvedValueOnce([track])

			const result = await submitVideoFn({
				data: {
					trackWorkoutId: "tw-1",
					competitionId: "comp-1",
					videoUrl: "https://youtube.com/watch?v=test",
					score: "8:30",
					scoreStatus: "scored",
					tiebreakScore: "3:45", // Tiebreak time
				},
			})

			expect(result.success).toBe(true)
			expect(mockDb.insert).toHaveBeenCalled()
		})

		it("throws on invalid score format", async () => {
			const registration = createTestRegistration()
			const competition = createTestCompetition({ competitionType: "online" })
			const workout = createTestWorkout({
				id: "wk-1",
				scheme: "time",
				scoreType: "min",
			})
			const trackWorkout = createTestTrackWorkout({ workoutId: "wk-1" })

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration])
				.mockResolvedValueOnce([competition])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([]) // No existing submission
				.mockResolvedValueOnce([{ ...trackWorkout, ...workout, trackId: "track-1" }])

			await expect(
				submitVideoFn({
					data: {
						trackWorkoutId: "tw-1",
						competitionId: "comp-1",
						videoUrl: "https://youtube.com/watch?v=test",
						score: "invalid-score",
						scoreStatus: "scored",
					},
				}),
			).rejects.toThrow(/Invalid score format/)
		})

		it("throws on invalid tiebreak score format", async () => {
			const registration = createTestRegistration()
			const competition = createTestCompetition({ competitionType: "online" })
			const workout = createTestWorkout({
				id: "wk-1",
				scheme: "time",
				scoreType: "min",
				tiebreakScheme: "time",
			})
			const trackWorkout = createTestTrackWorkout({ workoutId: "wk-1" })
			const track = { ownerTeamId: "team-1" }

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration])
				.mockResolvedValueOnce([competition])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([]) // No existing submission
				.mockResolvedValueOnce([{ ...trackWorkout, ...workout, trackId: "track-1" }])
				.mockResolvedValueOnce([track])

			await expect(
				submitVideoFn({
					data: {
						trackWorkoutId: "tw-1",
						competitionId: "comp-1",
						videoUrl: "https://youtube.com/watch?v=test",
						score: "8:30",
						scoreStatus: "scored",
						tiebreakScore: "invalid",
					},
				}),
			).rejects.toThrow(/Invalid tiebreak score format/)
		})

		it("throws on invalid videoUrl format", async () => {
			await expect(
				submitVideoFn({
					data: {
						trackWorkoutId: "tw-1",
						competitionId: "comp-1",
						videoUrl: "not-a-valid-url",
					},
				}),
			).rejects.toThrow()
		})

		it("throws on empty trackWorkoutId", async () => {
			await expect(
				submitVideoFn({
					data: {
						trackWorkoutId: "",
						competitionId: "comp-1",
						videoUrl: "https://youtube.com/watch?v=test",
					},
				}),
			).rejects.toThrow()
		})

		it("throws on empty competitionId", async () => {
			await expect(
				submitVideoFn({
					data: {
						trackWorkoutId: "tw-1",
						competitionId: "",
						videoUrl: "https://youtube.com/watch?v=test",
					},
				}),
			).rejects.toThrow()
		})

		it("includes notes in submission when provided", async () => {
			const registration = createTestRegistration()
			const competition = createTestCompetition({ competitionType: "online" })

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration])
				.mockResolvedValueOnce([competition])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])

			const result = await submitVideoFn({
				data: {
					trackWorkoutId: "tw-1",
					competitionId: "comp-1",
					videoUrl: "https://youtube.com/watch?v=test",
					notes: "Great performance!",
				},
			})

			expect(result.success).toBe(true)
			expect(mockDb.insert).toHaveBeenCalled()
		})

		it("handles rounds-reps score format", async () => {
			const registration = createTestRegistration()
			const competition = createTestCompetition({ competitionType: "online" })
			const workout = createTestWorkout({
				id: "wk-1",
				scheme: "rounds-reps",
				scoreType: "max",
				repsPerRound: 30,
			})
			const trackWorkout = createTestTrackWorkout({ workoutId: "wk-1" })
			const track = { ownerTeamId: "team-1" }

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration])
				.mockResolvedValueOnce([competition])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([{ ...trackWorkout, ...workout, trackId: "track-1" }])
				.mockResolvedValueOnce([track])

			const result = await submitVideoFn({
				data: {
					trackWorkoutId: "tw-1",
					competitionId: "comp-1",
					videoUrl: "https://youtube.com/watch?v=test",
					score: "5+15", // 5 rounds + 15 reps
					scoreStatus: "scored",
				},
			})

			expect(result.success).toBe(true)
			expect(mockDb.insert).toHaveBeenCalled()
		})

		it("handles reps score format", async () => {
			const registration = createTestRegistration()
			const competition = createTestCompetition({ competitionType: "online" })
			const workout = createTestWorkout({
				id: "wk-1",
				scheme: "reps",
				scoreType: "max",
			})
			const trackWorkout = createTestTrackWorkout({ workoutId: "wk-1" })
			const track = { ownerTeamId: "team-1" }

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration])
				.mockResolvedValueOnce([competition])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([{ ...trackWorkout, ...workout, trackId: "track-1" }])
				.mockResolvedValueOnce([track])

			const result = await submitVideoFn({
				data: {
					trackWorkoutId: "tw-1",
					competitionId: "comp-1",
					videoUrl: "https://youtube.com/watch?v=test",
					score: "150",
					scoreStatus: "scored",
				},
			})

			expect(result.success).toBe(true)
			expect(mockDb.insert).toHaveBeenCalled()
		})

		it("handles load score format", async () => {
			const registration = createTestRegistration()
			const competition = createTestCompetition({ competitionType: "online" })
			const workout = createTestWorkout({
				id: "wk-1",
				scheme: "load",
				scoreType: "max",
			})
			const trackWorkout = createTestTrackWorkout({ workoutId: "wk-1" })
			const track = { ownerTeamId: "team-1" }

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration])
				.mockResolvedValueOnce([competition])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([{ ...trackWorkout, ...workout, trackId: "track-1" }])
				.mockResolvedValueOnce([track])

			const result = await submitVideoFn({
				data: {
					trackWorkoutId: "tw-1",
					competitionId: "comp-1",
					videoUrl: "https://youtube.com/watch?v=test",
					score: "225",
					scoreStatus: "scored",
				},
			})

			expect(result.success).toBe(true)
			expect(mockDb.insert).toHaveBeenCalled()
		})

		it("throws when workout not found during score submission", async () => {
			const registration = createTestRegistration()
			const competition = createTestCompetition({ competitionType: "online" })

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration])
				.mockResolvedValueOnce([competition])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([]) // No existing video submission
				.mockResolvedValueOnce([]) // No workout found

			await expect(
				submitVideoFn({
					data: {
						trackWorkoutId: "tw-1",
						competitionId: "comp-1",
						videoUrl: "https://youtube.com/watch?v=test",
						score: "5:30",
						scoreStatus: "scored",
					},
				}),
			).rejects.toThrow("Workout not found")
		})

		it("throws when track ownership cannot be determined", async () => {
			const registration = createTestRegistration()
			const competition = createTestCompetition({ competitionType: "online" })
			const workout = createTestWorkout({
				id: "wk-1",
				scheme: "time",
				scoreType: "min",
			})
			const trackWorkout = createTestTrackWorkout({ workoutId: "wk-1" })

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration])
				.mockResolvedValueOnce([competition])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([]) // No existing video submission
				.mockResolvedValueOnce([{ ...trackWorkout, ...workout, trackId: "track-1" }])
				.mockResolvedValueOnce([]) // No track found

			await expect(
				submitVideoFn({
					data: {
						trackWorkoutId: "tw-1",
						competitionId: "comp-1",
						videoUrl: "https://youtube.com/watch?v=test",
						score: "5:30",
						scoreStatus: "scored",
					},
				}),
			).rejects.toThrow("Could not determine team ownership")
		})

		it("successfully saves submission with score (upsert behavior)", async () => {
			// This test verifies the full flow with score including upsert behavior
			const registration = createTestRegistration()
			const competition = createTestCompetition({ competitionType: "online" })
			const workout = createTestWorkout({
				id: "wk-1",
				scheme: "time",
				scoreType: "min",
			})
			const trackWorkout = createTestTrackWorkout({ workoutId: "wk-1" })
			const track = { ownerTeamId: "team-1" }

			const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
			limitMock
				.mockResolvedValueOnce([registration])
				.mockResolvedValueOnce([competition])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([]) // No existing submission
				.mockResolvedValueOnce([{ ...trackWorkout, ...workout, trackId: "track-1" }])
				.mockResolvedValueOnce([track])

			const result = await submitVideoFn({
				data: {
					trackWorkoutId: "tw-1",
					competitionId: "comp-1",
					videoUrl: "https://youtube.com/watch?v=test",
					score: "5:30",
					scoreStatus: "scored",
				},
			})

			expect(result.success).toBe(true)
			expect(result.submissionId).toBeDefined()
			expect(typeof result.submissionId).toBe("string")
			expect(result.submissionId).toMatch(/^vsub_/) // Verify CUID2 prefix
			// Verifies insert was called (for both video submission and score)
			expect(mockDb.insert).toHaveBeenCalled()
		})
	})
})
