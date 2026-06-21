import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	benchmarkBatteriesTable,
	benchmarkTestsTable,
	benchmarkTierThresholdsTable,
} from "@/db/schemas/benchmarks"
import {
	competitionEventsTable,
	competitionRegistrationsTable,
	competitionsTable,
} from "@/db/schemas/competitions"
import {
	programmingTracksTable,
	trackWorkoutsTable,
} from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { scoresTable } from "@/db/schemas/scores"
import { teamMembershipTable } from "@/db/schemas/teams"
import { userTable } from "@/db/schemas/users"
import { videoSubmissionsTable } from "@/db/schemas/video-submissions"
import { waiverSignaturesTable, waiversTable } from "@/db/schemas/waivers"
import { workouts } from "@/db/schemas/workouts"
import {
	checkBenchmarkOpenJoinRateLimit,
	resetBenchmarkOpenJoinRateLimitForTests,
} from "@/server/benchmark-open-join-rate-limit"
import { submitVideoFn } from "@/server-fns/video-submission-fns"

type BenchmarkGender = "male" | "female"

type ScoreRow = {
	id: string
	scoreValue: number | null
	status: string
	scheme: string
	scoreType: string
	secondaryValue: number | null
	tiebreakValue: number | null
	verificationStatus: string | null
	verifiedAt: Date | null
	verifiedByUserId: string | null
	penaltyType: string | null
	penaltyPercentage: number | null
	noRepCount: number | null
	benchmarkVariant: BenchmarkGender | null
	scalingLevelId: string | null
}

type VideoSubmissionRow = {
	id: string
	reviewStatus: string
	reviewedAt: Date | null
	reviewedBy: string | null
	reviewerNotes: string | null
}

type BenchmarkFixture = {
	profileGender: BenchmarkGender | null
	hasRegistration: boolean
	registrationDivisionId: string
	openDivisionId: string
	divisionTeamSize: number
	hasBattery: boolean
	videoPolicy: "never" | "always" | "for_top_scores"
	batteryStatus: "draft" | "published" | "archived"
	competitionStatus: "draft" | "published"
	competitionVisibility: "public" | "private"
	isOpenJoin: boolean
	requiredWaiverIds: string[]
	signedWaiverIds: string[]
	existingScore: ScoreRow | null
	existingSubmission: VideoSubmissionRow | null
}

type MutationLog = {
	scoreInserts: Record<string, unknown>[]
	scoreDuplicateUpdates: Record<string, unknown>[]
	scoreUpdateSets: Record<string, unknown>[]
	videoInserts: Record<string, unknown>[]
	videoUpdateSets: Record<string, unknown>[]
	registrationInserts: Record<string, unknown>[]
	teamMembershipInserts: Record<string, unknown>[]
}

const mockAuthenticatedSession = {
	userId: "athlete-1",
	user: {
		id: "athlete-1",
		email: "athlete@example.com",
	},
	teams: [],
}

class QueryChain {
	private kind: "select" | "insert" | "update" | "delete" = "select"
	private fromTable: unknown
	private mutationTable: unknown
	private selection: Record<string, unknown> | undefined

	constructor(private readonly db: BenchmarkSubmissionDb) {}

	select = vi.fn((selection?: Record<string, unknown>) => {
		this.kind = "select"
		this.selection = selection
		return this
	})

	from = vi.fn((table: unknown) => {
		this.fromTable = table
		return this
	})

	innerJoin = vi.fn(() => this)
	leftJoin = vi.fn(() => this)
	where = vi.fn(() => this)
	orderBy = vi.fn(() => this)
	groupBy = vi.fn(() => this)
	for = vi.fn(() => this)

	limit = vi.fn(async () => this.resolve())

	insert = vi.fn((table: unknown) => {
		this.kind = "insert"
		this.mutationTable = table
		return this
	})

	values = vi.fn((values: Record<string, unknown> | Record<string, unknown>[]) => {
		this.db.recordValues(this.mutationTable, values)
		return this
	})

	onDuplicateKeyUpdate = vi.fn((config: { set?: Record<string, unknown> }) => {
		this.db.recordDuplicateUpdate(this.mutationTable, config)
		return this
	})

	returning = vi.fn(async () => this.db.returningRows(this.mutationTable))

	update = vi.fn((table: unknown) => {
		this.kind = "update"
		this.mutationTable = table
		return this
	})

	set = vi.fn((values: Record<string, unknown>) => {
		this.db.recordSet(this.mutationTable, values)
		return this
	})

	delete = vi.fn((table?: unknown) => {
		this.kind = "delete"
		this.mutationTable = table
		return this
	})

	then<TResult1 = unknown[], TResult2 = never>(
		onfulfilled?:
			| ((value: unknown[]) => TResult1 | PromiseLike<TResult1>)
			| null,
		onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
	): Promise<TResult1 | TResult2> {
		return Promise.resolve(this.resolve()).then(onfulfilled, onrejected)
	}

	private resolve() {
		if (this.kind !== "select") return []
		return this.db.rowsFor(this.fromTable, this.selection)
	}
}

class BenchmarkSubmissionDb {
	fixture = createFixture()
	mutations: MutationLog = createMutationLog()
	private createdOpenJoinRegistration = false

	select = vi.fn((selection?: Record<string, unknown>) =>
		new QueryChain(this).select(selection),
	)

	insert = vi.fn((table: unknown) => new QueryChain(this).insert(table))
	update = vi.fn((table: unknown) => new QueryChain(this).update(table))
	delete = vi.fn((table?: unknown) => new QueryChain(this).delete(table))
	transaction = vi.fn(async (fn: (tx: BenchmarkSubmissionDb) => unknown) =>
		fn(this),
	)

	reset(overrides: Partial<BenchmarkFixture> = {}) {
		this.fixture = createFixture(overrides)
		this.mutations = createMutationLog()
		this.createdOpenJoinRegistration = false
	}

	rowsFor(table: unknown, selection?: Record<string, unknown>) {
		if (table === competitionRegistrationsTable) {
			if (!this.fixture.hasRegistration && !this.createdOpenJoinRegistration) {
				return []
			}

			const divisionId = this.createdOpenJoinRegistration
				? this.fixture.openDivisionId
				: this.fixture.registrationDivisionId

			return [
				{
					id: "registration-1",
					divisionId,
					captainUserId: null,
					athleteTeamId: null,
				},
			]
		}

		if (table === competitionsTable) {
			return [
				{
					id: "competition-benchmark",
					competitionType: "benchmark",
					visibility: "public",
					status: "published",
				},
			]
		}

		if (table === competitionEventsTable) {
			return []
		}

		if (table === scalingLevelsTable) {
			if (selection && Object.keys(selection).every((key) => key === "teamSize")) {
				return [
					{
						id: this.fixture.registrationDivisionId,
						teamSize: this.fixture.divisionTeamSize,
					},
				]
			}

			return [
				{
					id: this.fixture.openDivisionId,
					label: "Open",
					position: 0,
					teamSize: 1,
					scalingGroupId: "benchmark-open-scaling-group",
				},
			]
		}

		if (table === videoSubmissionsTable) {
			if (!this.fixture.existingSubmission) return []
			return [
				{
					...this.fixture.existingSubmission,
					registrationId: "registration-1",
					trackWorkoutId: "track-workout-benchmark",
					videoIndex: 0,
					userId: "athlete-1",
					videoUrl: "https://example.com/current-video",
					notes: null,
				},
			]
		}

		if (table === trackWorkoutsTable) {
			return [
				{
					id: "track-workout-benchmark",
					workoutId: "workout-benchmark-test",
					name: "Benchmark test",
					scheme: "reps",
					scoreType: "max",
					timeCap: null,
					tiebreakScheme: null,
					repsPerRound: null,
					roundsToScore: 1,
					trackId: "programming-track-1",
					benchmarkTestId: "benchmark-test-1",
					benchmarkCategory: "engine",
					includedInScoring: true,
				},
			]
		}

		if (table === workouts) {
			return [
				{
					id: "workout-benchmark-test",
					scheme: "reps",
					scoreType: "max",
					timeCap: null,
					tiebreakScheme: null,
				},
			]
		}

		if (table === programmingTracksTable) {
			return [{ ownerTeamId: "benchmark-owner-team" }]
		}

		if (table === userTable) {
			return [
				{
					id: "athlete-1",
					gender: this.fixture.profileGender,
				},
			]
		}

		if (table === benchmarkBatteriesTable) {
			if (!this.fixture.hasBattery) return []

			return [
				{
					id: "benchmark-battery-1",
					batteryId: "benchmark-battery-1",
					competitionId: "competition-benchmark",
					status: this.fixture.batteryStatus,
					batteryStatus: this.fixture.batteryStatus,
					videoPolicy: this.fixture.videoPolicy,
					isOpenJoin: this.fixture.isOpenJoin,
					variantScalingGroupId: "benchmark-open-scaling-group",
					competitionTeamId: "competition-team-1",
					competitionStatus: this.fixture.competitionStatus,
					competitionVisibility: this.fixture.competitionVisibility,
					competitionSettings: JSON.stringify({
						divisions: { scalingGroupId: "benchmark-open-scaling-group" },
					}),
				},
			]
		}

		if (table === benchmarkTestsTable) {
			return [
				{
					id: "benchmark-test-1",
					batteryId: "benchmark-battery-1",
					categoryKey: "engine",
					scheme: "reps",
					scoreType: "max",
					includedInScoring: true,
					scoreModel: "standard",
				},
			]
		}

		if (table === benchmarkTierThresholdsTable) {
			return [
				{
					testId: "benchmark-test-1",
					variant: "female",
					tier: 1,
					thresholdValue: 10,
					value: 10,
				},
				{
					testId: "benchmark-test-1",
					variant: "female",
					tier: 2,
					thresholdValue: 20,
					value: 20,
				},
				{
					testId: "benchmark-test-1",
					variant: "female",
					tier: 3,
					thresholdValue: 30,
					value: 30,
				},
				{
					testId: "benchmark-test-1",
					variant: "male",
					tier: 1,
					thresholdValue: 12,
					value: 12,
				},
				{
					testId: "benchmark-test-1",
					variant: "male",
					tier: 2,
					thresholdValue: 24,
					value: 24,
				},
				{
					testId: "benchmark-test-1",
					variant: "male",
					tier: 3,
					thresholdValue: 36,
					value: 36,
				},
			]
		}

		if (table === scoresTable) {
			return this.fixture.existingScore ? [this.fixture.existingScore] : []
		}

		if (table === teamMembershipTable) {
			return []
		}

		if (table === waiversTable) {
			return this.fixture.requiredWaiverIds.map((id) => ({ id }))
		}

		if (table === waiverSignaturesTable) {
			return this.fixture.signedWaiverIds.map((waiverId) => ({ waiverId }))
		}

		return []
	}

	recordValues(
		table: unknown,
		values: Record<string, unknown> | Record<string, unknown>[],
	) {
		const rows = Array.isArray(values) ? values : [values]
		if (table === scoresTable) this.mutations.scoreInserts.push(...rows)
		if (table === videoSubmissionsTable) this.mutations.videoInserts.push(...rows)
		if (table === competitionRegistrationsTable) {
			this.createdOpenJoinRegistration = true
			this.mutations.registrationInserts.push(...rows)
		}
		if (table === teamMembershipTable) {
			this.mutations.teamMembershipInserts.push(...rows)
		}
	}

	recordSet(table: unknown, values: Record<string, unknown>) {
		if (table === scoresTable) this.mutations.scoreUpdateSets.push(values)
		if (table === videoSubmissionsTable) this.mutations.videoUpdateSets.push(values)
	}

	recordDuplicateUpdate(
		table: unknown,
		config: { set?: Record<string, unknown> },
	) {
		if (table === scoresTable) {
			this.mutations.scoreDuplicateUpdates.push(config.set ?? {})
		}
	}

	returningRows(table: unknown) {
		if (table === videoSubmissionsTable) return [{ id: "video-submission-new" }]
		if (table === scoresTable) return [{ id: "score-new" }]
		return []
	}
}

const mockDb = new BenchmarkSubmissionDb()

vi.mock("@/db", () => ({
	getDb: vi.fn(() => mockDb),
}))

vi.mock("@/utils/auth", () => ({
	getSessionFromCookie: vi.fn(() => Promise.resolve(mockAuthenticatedSession)),
}))

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

function createFixture(
	overrides: Partial<BenchmarkFixture> = {},
): BenchmarkFixture {
	return {
		profileGender: "female",
		hasRegistration: true,
		registrationDivisionId: "female-variant-division",
		openDivisionId: "open-division",
		divisionTeamSize: 1,
		hasBattery: true,
		videoPolicy: "always",
		batteryStatus: "published",
		competitionStatus: "published",
		competitionVisibility: "public",
		isOpenJoin: true,
		requiredWaiverIds: [],
		signedWaiverIds: [],
		existingScore: null,
		existingSubmission: null,
		...overrides,
	}
}

function createMutationLog(): MutationLog {
	return {
		scoreInserts: [],
		scoreDuplicateUpdates: [],
		scoreUpdateSets: [],
		videoInserts: [],
		videoUpdateSets: [],
		registrationInserts: [],
		teamMembershipInserts: [],
	}
}

function createVerifiedScore(overrides: Partial<ScoreRow> = {}): ScoreRow {
	return {
		id: "score-existing",
		scoreValue: 20,
		status: "scored",
		scheme: "reps",
		scoreType: "max",
		secondaryValue: null,
		tiebreakValue: null,
		verificationStatus: "verified",
		verifiedAt: new Date("2026-01-01T00:00:00.000Z"),
		verifiedByUserId: "judge-1",
		penaltyType: "minor",
		penaltyPercentage: 10,
		noRepCount: 2,
		benchmarkVariant: "female",
		scalingLevelId: "open-division",
		...overrides,
	}
}

function createReviewedSubmission(
	overrides: Partial<VideoSubmissionRow> = {},
): VideoSubmissionRow {
	return {
		id: "video-submission-existing",
		reviewStatus: "verified",
		reviewedAt: new Date("2026-01-01T00:05:00.000Z"),
		reviewedBy: "judge-1",
		reviewerNotes: "Looks good",
		...overrides,
	}
}

function submissionPayload(overrides: Record<string, unknown> = {}) {
	return {
		trackWorkoutId: "track-workout-benchmark",
		competitionId: "competition-benchmark",
		divisionId: "female-variant-division",
		videoUrl: "https://example.com/benchmark-video",
		videoIndex: 0,
		score: "30",
		scoreStatus: "scored",
		...overrides,
	}
}

function allScoreWritePayloads() {
	return [
		...mockDb.mutations.scoreInserts,
		...mockDb.mutations.scoreDuplicateUpdates,
		...mockDb.mutations.scoreUpdateSets,
	]
}

describe("benchmark submission M3 regressions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		resetBenchmarkOpenJoinRateLimitForTests()
		mockDb.reset()
	})

	it("rejects benchmark submissions without profile gender instead of defaulting to male", async () => {
		mockDb.reset({ profileGender: null })

		await expect(
			submitVideoFn({ data: submissionPayload() }),
		).rejects.toThrow(/gender/i)

		expect(mockDb.mutations.scoreInserts).toHaveLength(0)
		expect(mockDb.mutations.scoreDuplicateUpdates).toHaveLength(0)
		expect(
			allScoreWritePayloads().some(
				(payload) => payload.benchmarkVariant === "male",
			),
		).toBe(false)
	})

	it("writes benchmarkVariant from profile gender and stores the single Open division", async () => {
		// @lat: [[competition-type-capabilities#Perpetual Submission Gate Test]]
		await submitVideoFn({ data: submissionPayload({ score: "32" }) })

		expect(mockDb.mutations.scoreInserts).toContainEqual(
			expect.objectContaining({
				benchmarkVariant: "female",
				scalingLevelId: "open-division",
			}),
		)
		expect(allScoreWritePayloads()).not.toContainEqual(
			expect.objectContaining({
				benchmarkVariant: "male",
			}),
		)
		expect(allScoreWritePayloads()).not.toContainEqual(
			expect.objectContaining({
				scalingLevelId: "female-variant-division",
			}),
		)
	})

	it("accepts score-only benchmark submissions when the battery video policy is never", async () => {
		mockDb.reset({ videoPolicy: "never" })

		const result = await submitVideoFn({
			data: submissionPayload({ videoUrl: undefined, score: "32" }),
		})

		expect(result).toMatchObject({
			success: true,
			retainedCurrentBest: false,
		})
		expect(mockDb.mutations.scoreInserts).toContainEqual(
			expect.objectContaining({
				benchmarkVariant: "female",
				scalingLevelId: "open-division",
			}),
		)
		expect(mockDb.mutations.videoInserts).toHaveLength(0)
	})

	it("accepts non-top score-only submissions when the battery video policy is for_top_scores", async () => {
		mockDb.reset({ videoPolicy: "for_top_scores" })

		const result = await submitVideoFn({
			data: submissionPayload({ videoUrl: undefined, score: "20" }),
		})

		expect(result).toMatchObject({
			success: true,
			retainedCurrentBest: false,
		})
		expect(mockDb.mutations.scoreInserts).toContainEqual(
			expect.objectContaining({
				scoreValue: 20,
				benchmarkVariant: "female",
				scalingLevelId: "open-division",
			}),
		)
		expect(mockDb.mutations.videoInserts).toHaveLength(0)
	})

	it("requires video before writing a top-tier score when the battery video policy is for_top_scores", async () => {
		mockDb.reset({ videoPolicy: "for_top_scores" })

		await expect(
			submitVideoFn({
				data: submissionPayload({ videoUrl: undefined, score: "30" }),
			}),
		).rejects.toThrow(/video url/i)

		expect(mockDb.mutations.scoreInserts).toHaveLength(0)
		expect(mockDb.mutations.scoreUpdateSets).toHaveLength(0)
		expect(mockDb.mutations.videoInserts).toHaveLength(0)
	})

	it.each([
		["equal", "20"],
		["worse", "15"],
	])(
		"does not update the live score or reset review state for a retest that is %s",
		async (_case, score) => {
			mockDb.reset({
				existingScore: createVerifiedScore({ scoreValue: 20 }),
				existingSubmission: createReviewedSubmission(),
			})

			await submitVideoFn({ data: submissionPayload({ score }) })

			expect(mockDb.mutations.scoreInserts).toHaveLength(0)
			expect(mockDb.mutations.scoreDuplicateUpdates).toHaveLength(0)
			expect(mockDb.mutations.scoreUpdateSets).toHaveLength(0)
			expect(mockDb.mutations.videoUpdateSets).not.toContainEqual(
				expect.objectContaining({
					reviewStatus: "pending",
					reviewedAt: null,
					reviewedBy: null,
					reviewerNotes: null,
				}),
			)
		},
	)

	it("resets stale score verification and video review fields for a better retest", async () => {
		mockDb.reset({
			existingScore: createVerifiedScore({ scoreValue: 20 }),
			existingSubmission: createReviewedSubmission(),
		})

		await submitVideoFn({ data: submissionPayload({ score: "35" }) })

		expect(allScoreWritePayloads()).toContainEqual(
			expect.objectContaining({
				verificationStatus: null,
				verifiedAt: null,
				verifiedByUserId: null,
				penaltyType: null,
				penaltyPercentage: null,
				noRepCount: null,
			}),
		)
		expect(mockDb.mutations.videoUpdateSets).toContainEqual(
			expect.objectContaining({
				reviewStatus: "pending",
				reviewedAt: null,
				reviewedBy: null,
				reviewerNotes: null,
			}),
		)
	})

	it("rejects team division submissions because benchmark batteries are individual-only", async () => {
		mockDb.reset({
			registrationDivisionId: "team-division",
			divisionTeamSize: 2,
		})

		await expect(
			submitVideoFn({
				data: submissionPayload({ divisionId: "team-division" }),
			}),
		).rejects.toThrow(/benchmark|individual|team/i)

		expect(mockDb.mutations.scoreInserts).toHaveLength(0)
		expect(mockDb.mutations.scoreDuplicateUpdates).toHaveLength(0)
	})

	it("rejects registered submissions when the benchmark board is not public and published", async () => {
		mockDb.reset({
			competitionVisibility: "private",
		})

		await expect(
			submitVideoFn({ data: submissionPayload({ score: "33" }) }),
		).rejects.toThrow(/not open/i)

		expect(mockDb.mutations.registrationInserts).toHaveLength(0)
		expect(mockDb.mutations.scoreInserts).toHaveLength(0)
		expect(mockDb.mutations.scoreUpdateSets).toHaveLength(0)
	})

	it("fails closed when a benchmark competition is missing benchmark configuration", async () => {
		mockDb.reset({ hasBattery: false })

		await expect(
			submitVideoFn({ data: submissionPayload({ score: "33" }) }),
		).rejects.toThrow(/benchmark configuration/i)

		expect(mockDb.mutations.scoreInserts).toHaveLength(0)
		expect(mockDb.mutations.scoreUpdateSets).toHaveLength(0)
	})

	it("creates an open-join registration transactionally before accepting a benchmark score", async () => {
		mockDb.reset({ hasRegistration: false })

		await submitVideoFn({
			data: submissionPayload({ divisionId: undefined, score: "33" }),
		})

		expect(mockDb.transaction).toHaveBeenCalled()
		expect(mockDb.mutations.teamMembershipInserts).toContainEqual(
			expect.objectContaining({
				teamId: "competition-team-1",
				userId: "athlete-1",
			}),
		)
		expect(mockDb.mutations.registrationInserts).toContainEqual(
			expect.objectContaining({
				eventId: "competition-benchmark",
				userId: "athlete-1",
				divisionId: "open-division",
			}),
		)
		expect(mockDb.mutations.scoreInserts).toContainEqual(
			expect.objectContaining({
				benchmarkVariant: "female",
				scalingLevelId: "open-division",
			}),
		)
	})

	it("rejects open-join when the benchmark board is not public and published", async () => {
		mockDb.reset({
			hasRegistration: false,
			competitionVisibility: "private",
		})

		await expect(
			submitVideoFn({
				data: submissionPayload({ divisionId: undefined, score: "33" }),
			}),
		).rejects.toThrow(/not open/i)

		expect(mockDb.mutations.registrationInserts).toHaveLength(0)
		expect(mockDb.mutations.scoreInserts).toHaveLength(0)
	})

	it("rejects open-join when required waivers are unsigned", async () => {
		mockDb.reset({
			hasRegistration: false,
			requiredWaiverIds: ["waiver-1"],
			signedWaiverIds: [],
		})

		await expect(
			submitVideoFn({
				data: submissionPayload({ divisionId: undefined, score: "33" }),
			}),
		).rejects.toThrow(/waivers/i)

		expect(mockDb.mutations.registrationInserts).toHaveLength(0)
		expect(mockDb.mutations.scoreInserts).toHaveLength(0)
	})

	it("rate-limits repeated benchmark open-join attempts through the shared boundary", async () => {
		for (let i = 0; i < 10; i++) {
			await expect(
				checkBenchmarkOpenJoinRateLimit({
					userId: "athlete-rate-limited",
					competitionId: "competition-benchmark",
				}),
			).resolves.toMatchObject({ allowed: true })
		}

		await expect(
			checkBenchmarkOpenJoinRateLimit({
				userId: "athlete-rate-limited",
				competitionId: "competition-benchmark",
			}),
		).resolves.toMatchObject({ allowed: false })
	})
})
