import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { BenchmarkStatLine } from "@/components/benchmark-stat-line"
import type { CompetitionLeaderboardEntry } from "@/server-fns/leaderboard-fns"

type EventResult = CompetitionLeaderboardEntry["eventResults"][number]

function createEventResult(overrides: Partial<EventResult> = {}): EventResult {
  return {
    trackWorkoutId: "tw-1",
    trackOrder: 1,
    eventName: "Strict Press",
    scheme: "load",
    rank: 1,
    points: 8,
    rawScore: "90000",
    formattedScore: "198 lb",
    formattedTiebreak: null,
    penaltyType: null,
    penaltyPercentage: null,
    isDirectlyModified: false,
    videoUrl: null,
    videoSubmissionId: null,
    parentEventId: null,
    parentEventName: null,
    isParentEvent: false,
    cappedRoundCount: 0,
    totalRoundCount: 0,
    verificationStatus: "verified",
    benchmarkTier: 8,
    benchmarkCategoryKey: "strength",
    benchmarkCategoryLabel: "Strength",
    benchmarkIncludedInScoring: true,
    reviewSummary: null,
    ...overrides,
  }
}

function createEntry(): CompetitionLeaderboardEntry {
  return {
    registrationId: "reg-1",
    userId: "user-1",
    athleteName: "Alex Athlete",
    divisionId: "open",
    divisionLabel: "Open",
    totalPoints: 72.5,
    overallRank: 1,
    isTeamDivision: false,
    teamName: null,
    teamMembers: [],
    affiliate: "WODsmith Gym",
    benchmarkOverallScore: 72.5,
    benchmarkRatingBand: {
      key: "regional",
      label: "Regional",
      minScore: 60,
      maxScore: 79.9,
    },
    benchmarkCategoryScores: [
      {
        key: "strength",
        label: "Strength",
        score: 80,
        tierSum: 16,
        testCount: 2,
        weight: 1,
      },
      {
        key: "engine",
        label: "Engine",
        score: 65,
        tierSum: 6.5,
        testCount: 1,
        weight: 1,
      },
    ],
    eventResults: [
      createEventResult(),
      createEventResult({
        trackWorkoutId: "tw-2",
        trackOrder: 2,
        eventName: "Mile Run",
        scheme: "time",
        rank: 2,
        points: 6.5,
        rawScore: "390000",
        formattedScore: "6:30",
        formattedTiebreak: null,
        penaltyType: null,
        penaltyPercentage: null,
        isDirectlyModified: true,
        videoUrl: null,
        videoSubmissionId: null,
        parentEventId: null,
        parentEventName: null,
        isParentEvent: false,
        cappedRoundCount: 0,
        totalRoundCount: 0,
        verificationStatus: "adjusted",
        benchmarkTier: 6.5,
        benchmarkCategoryKey: "engine",
        benchmarkCategoryLabel: "Engine",
        benchmarkIncludedInScoring: true,
        reviewSummary: null,
      }),
      createEventResult({
        trackWorkoutId: "tw-3",
        trackOrder: 3,
        eventName: "Weighted Pull-Up",
        scheme: "load",
        rank: 0,
        points: 0,
        rawScore: null,
        formattedScore: "N/A",
        formattedTiebreak: null,
        penaltyType: null,
        penaltyPercentage: null,
        isDirectlyModified: false,
        videoUrl: null,
        videoSubmissionId: null,
        parentEventId: null,
        parentEventName: null,
        isParentEvent: false,
        cappedRoundCount: 0,
        totalRoundCount: 0,
        verificationStatus: null,
        benchmarkTier: null,
        benchmarkCategoryKey: "strength",
        benchmarkCategoryLabel: "Strength",
        benchmarkIncludedInScoring: false,
        reviewSummary: null,
      }),
      createEventResult({
        trackWorkoutId: "tw-4",
        trackOrder: 4,
        eventName: "Unsubmitted Snatch",
        rank: 0,
        points: 0,
        rawScore: null,
        formattedScore: "N/A",
        verificationStatus: null,
        benchmarkTier: null,
      }),
      createEventResult({
        trackWorkoutId: "tw-5",
        trackOrder: 5,
        eventName: "Attempted Clean",
        rank: 0,
        points: 0,
        rawScore: "0",
        formattedScore: "0 lb",
        verificationStatus: null,
        benchmarkTier: 0,
      }),
      createEventResult({
        trackWorkoutId: "tw-6",
        trackOrder: 6,
        eventName: "Pending Row",
        rawScore: "820",
        formattedScore: "820 watts",
        verificationStatus: null,
        benchmarkTier: 7,
        benchmarkCategoryKey: "engine",
        benchmarkCategoryLabel: "Engine",
        reviewSummary: {
          totalSubmitted: 1,
          expectedVideos: 1,
          reviewedCount: 0,
          statuses: ["pending"],
          worstStatus: "pending",
        },
      }),
      createEventResult({
        trackWorkoutId: "tw-7",
        trackOrder: 7,
        eventName: "Invalid Deadlift",
        rawScore: "120000",
        formattedScore: "265 lb",
        verificationStatus: "invalid",
        benchmarkTier: 6,
      }),
    ],
  }
}

describe("BenchmarkStatLine", () => {
  it("renders Overall/100, category scores, per-test tiers, and states", () => {
    render(<BenchmarkStatLine entry={createEntry()} />)

    expect(screen.getByText("72.5")).toBeInTheDocument()
    expect(screen.getByText("/100")).toBeInTheDocument()
    expect(screen.getByText("Regional")).toBeInTheDocument()
    expect(screen.getAllByText("Strength").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Engine").length).toBeGreaterThan(0)
    expect(screen.getByText("Strict Press")).toBeInTheDocument()
    expect(screen.getByText("Mile Run")).toBeInTheDocument()
    expect(screen.getByText("Weighted Pull-Up")).toBeInTheDocument()
    expect(screen.getAllByText("8").length).toBeGreaterThan(0)
    expect(screen.getAllByText("6.5").length).toBeGreaterThan(0)
    expect(screen.getByText("Verified")).toBeInTheDocument()
    expect(screen.getByText("Adjusted")).toBeInTheDocument()
    expect(screen.getByText("Unavailable")).toBeInTheDocument()
    expect(screen.getByText("Untested")).toBeInTheDocument()
    expect(screen.getByText("Tier 0")).toBeInTheDocument()
    expect(screen.getByText("Pending")).toBeInTheDocument()
    expect(screen.getByText("Excluded")).toBeInTheDocument()
  })
})
