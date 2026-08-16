import { FakeDrizzleDb } from "@repo/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { scoresTable } from "@/db/schemas/scores"
import { getBenchmarkViewerScores } from "@/server-fns/athlete-score-fns"
import { getSessionFromCookie } from "@/utils/auth"

const mockDb = new FakeDrizzleDb()

vi.mock("@/db", () => ({
	getDb: vi.fn(() => mockDb),
}))

vi.mock("@/utils/auth", () => ({
	getSessionFromCookie: vi.fn(),
}))

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		inputValidator: (validator: (data: unknown) => unknown) => ({
			handler: (handler: (context: { data: unknown }) => Promise<unknown>) =>
				async (context: { data: unknown }) =>
					handler({ data: validator(context.data) }),
		}),
	}),
}))

const authenticatedSession = {
	userId: "viewer-1",
	user: { id: "viewer-1", email: "viewer@example.com" },
	teams: [],
}

function setSession(session: unknown) {
	vi.mocked(getSessionFromCookie).mockResolvedValue(session as never)
}

describe("getBenchmarkViewerScores", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockDb.reset()
		setSession(authenticatedSession)
	})

	it("maps the viewer's division-scoped scores by track workout in one score query", async () => {
		const chain = mockDb.getChainMock()
		chain.limit.mockImplementationOnce(
			() => [{ divisionId: "division-rx" }] as never,
		)
		mockDb.setMockReturnValue([
			{
				trackWorkoutId: "track-workout-fran",
				scoreValue: 300000,
				scoreType: "min",
				secondaryValue: null,
				status: "scored",
				scheme: "time",
				timeCapMs: null,
			},
			{
				trackWorkoutId: "track-workout-grace",
				scoreValue: null,
				scoreType: "min",
				secondaryValue: 45,
				status: "cap",
				scheme: "time-with-cap",
				timeCapMs: 600000,
			},
		])

		const result = await getBenchmarkViewerScores({
			competitionId: "competition-benchmarks",
			trackWorkoutIds: ["track-workout-fran", "track-workout-grace"],
		})

		expect(result).toEqual({
			"track-workout-fran": { displayScore: "5:00", status: "scored" },
			"track-workout-grace": {
				displayScore: "CAP (45 reps)",
				status: "cap",
			},
		})
		expect(
			chain.from.mock.calls.filter(([table]) => table === scoresTable),
		).toHaveLength(1)
	})

	it("formats terminal score statuses instead of exposing numeric fallbacks", async () => {
		const chain = mockDb.getChainMock()
		chain.limit.mockImplementationOnce(
			() => [{ divisionId: "division-rx" }] as never,
		)
		mockDb.setMockReturnValue([
			{
				trackWorkoutId: "track-workout-dq",
				scoreValue: null,
				scoreType: "max",
				secondaryValue: null,
				status: "dq",
				scheme: "reps",
				timeCapMs: null,
			},
			{
				trackWorkoutId: "track-workout-withdrawn",
				scoreValue: null,
				scoreType: "max",
				secondaryValue: null,
				status: "withdrawn",
				scheme: "reps",
				timeCapMs: null,
			},
		])

		expect(
			await getBenchmarkViewerScores({
				competitionId: "competition-benchmarks",
				trackWorkoutIds: ["track-workout-dq", "track-workout-withdrawn"],
			}),
		).toEqual({
			"track-workout-dq": { displayScore: "DQ", status: "dq" },
			"track-workout-withdrawn": {
				displayScore: "WD",
				status: "withdrawn",
			},
		})
	})

	it("returns an empty map without querying scores when unauthenticated", async () => {
		setSession(null)

		expect(
			await getBenchmarkViewerScores({
				competitionId: "competition-benchmarks",
				trackWorkoutIds: ["track-workout-fran"],
			}),
		).toEqual({})
		expect(mockDb.getChainMock().select).not.toHaveBeenCalled()
	})

	it.each([
		["unregistered", []],
		[
			"registered in multiple divisions",
			[{ divisionId: "division-rx" }, { divisionId: "division-scaled" }],
		],
	])("returns an empty map when the viewer is %s", async (_label, registrations) => {
		const chain = mockDb.getChainMock()
		chain.limit.mockImplementationOnce(() => registrations as never)

		expect(
			await getBenchmarkViewerScores({
				competitionId: "competition-benchmarks",
				trackWorkoutIds: ["track-workout-fran"],
			}),
		).toEqual({})
		expect(
			chain.from.mock.calls.filter(([table]) => table === scoresTable),
		).toHaveLength(0)
	})

	it("returns an empty map when the registered viewer has no scores", async () => {
		const chain = mockDb.getChainMock()
		chain.limit.mockImplementationOnce(
			() => [{ divisionId: "division-rx" }] as never,
		)

		expect(
			await getBenchmarkViewerScores({
				competitionId: "competition-benchmarks",
				trackWorkoutIds: ["track-workout-fran"],
			}),
		).toEqual({})
	})

	it("omits workouts without a displayable score", async () => {
		const chain = mockDb.getChainMock()
		chain.limit.mockImplementationOnce(
			() => [{ divisionId: null }] as never,
		)
		mockDb.setMockReturnValue([
			{
				trackWorkoutId: "track-workout-fran",
				scoreValue: null,
				scoreType: "min",
				secondaryValue: null,
				status: "scored",
				scheme: "time",
				timeCapMs: null,
			},
		])

		expect(
			await getBenchmarkViewerScores({
				competitionId: "competition-benchmarks",
				trackWorkoutIds: ["track-workout-fran"],
			}),
		).toEqual({})
	})
})
