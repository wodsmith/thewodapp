import { beforeEach, describe, expect, it, vi } from "vitest"
import { getBenchmarkViewerScores } from "@/server-fns/athlete-score-fns"
import { getBatchVenuesForTrackWorkoutsFn } from "@/server-fns/competition-heats-fns"
import {
	getBatchWorkoutDivisionDescriptionsFn,
	getPublishedCompetitionWorkoutsWithDetailsFn,
} from "@/server-fns/competition-workouts-fns"
import { getPublicWorkoutsPageDataFn } from "@/server-fns/competition-workouts-page-fns"
import { getPublicEventDivisionMappingsFn } from "@/server-fns/event-division-mapping-fns"
import { getBatchSubmissionStatusFn } from "@/server-fns/video-submission-fns"

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		inputValidator: (validator: (data: unknown) => unknown) => ({
			handler: (handler: (context: { data: unknown }) => Promise<unknown>) =>
				async (context: { data: unknown }) =>
					handler({ data: validator(context.data) }),
		}),
	}),
}))

vi.mock("@/server-fns/athlete-score-fns", () => ({
	getBenchmarkViewerScores: vi.fn(),
}))

vi.mock("@/server-fns/competition-heats-fns", () => ({
	getBatchVenuesForTrackWorkoutsFn: vi.fn(),
}))

vi.mock("@/server-fns/competition-workouts-fns", () => ({
	getBatchWorkoutDivisionDescriptionsFn: vi.fn(),
	getPublishedCompetitionWorkoutsWithDetailsFn: vi.fn(),
}))

vi.mock("@/server-fns/event-division-mapping-fns", () => ({
	getPublicEventDivisionMappingsFn: vi.fn(),
}))

vi.mock("@/server-fns/video-submission-fns", () => ({
	getBatchSubmissionStatusFn: vi.fn(),
}))

const workouts = [
	{ id: "track-workout-fran", workoutId: "workout-fran" },
	{ id: "track-workout-grace", workoutId: "workout-grace" },
]

describe("getPublicWorkoutsPageDataFn benchmark viewer scores", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(getPublishedCompetitionWorkoutsWithDetailsFn).mockResolvedValue({
			workouts,
		} as never)
		vi.mocked(getPublicEventDivisionMappingsFn).mockResolvedValue({
			mappings: [],
			hasMappings: false,
		} as never)
		vi.mocked(getBatchWorkoutDivisionDescriptionsFn).mockResolvedValue({
			descriptionsByWorkout: {},
		} as never)
		vi.mocked(getBatchVenuesForTrackWorkoutsFn).mockResolvedValue({
			venues: {},
		} as never)
		vi.mocked(getBatchSubmissionStatusFn).mockResolvedValue({
			statuses: {},
		} as never)
		vi.mocked(getBenchmarkViewerScores).mockResolvedValue({
			"track-workout-fran": { displayScore: "5:00", status: "scored" },
		})
	})

	it("includes one batched viewer score map when opted in", async () => {
		const result = await getPublicWorkoutsPageDataFn({
			data: {
				competitionId: "competition-benchmarks",
				divisionIds: [],
				includeBenchmarkViewerScores: true,
			},
		})

		expect(getBenchmarkViewerScores).toHaveBeenCalledOnce()
		expect(getBenchmarkViewerScores).toHaveBeenCalledWith({
			competitionId: "competition-benchmarks",
			trackWorkoutIds: ["track-workout-fran", "track-workout-grace"],
		})
		expect(result.benchmarkViewerScores).toEqual({
			"track-workout-fran": { displayScore: "5:00", status: "scored" },
		})
	})

	it("keeps existing callers valid and avoids session work by default", async () => {
		const result = await getPublicWorkoutsPageDataFn({
			data: {
				competitionId: "competition-benchmarks",
				divisionIds: [],
			},
		})

		expect(getBenchmarkViewerScores).not.toHaveBeenCalled()
		expect(result.benchmarkViewerScores).toEqual({})
		expect(result.submissionStatuses).toEqual({})
	})
})
