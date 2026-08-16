import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { OnlineCompetitionLeaderboardTable } from "@/components/online-competition-leaderboard-table"
import type { CompetitionLeaderboardEntry } from "@/server-fns/leaderboard-fns"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children?: ReactNode; to?: string }) => (
    <a href={to ?? "#"}>{children}</a>
  ),
  useLocation: () => ({
    pathname: "/compete/test-benchmark/leaderboard",
    searchStr: "",
  }),
}))

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
  createServerFn: () => ({
    inputValidator: () => ({
      handler: () => vi.fn(),
    }),
  }),
}))

vi.mock("@/server-fns/video-submission-fns", () => ({
  getLeaderboardVideosFn: vi.fn().mockResolvedValue({ videos: [] }),
}))

vi.mock("@/server-fns/video-vote-fns", () => ({
  getVideoVoteCountsFn: vi.fn().mockResolvedValue({ votes: {} }),
}))

vi.mock("@/utils/auth-client", () => ({
  useSession: () => null,
}))

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

function createBenchmarkEntry(): CompetitionLeaderboardEntry {
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
    benchmarkScoreMax: 100,
    benchmarkGender: "male",
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
        isDirectlyModified: true,
        verificationStatus: "adjusted",
        benchmarkTier: 6.5,
        benchmarkCategoryKey: "engine",
        benchmarkCategoryLabel: "Engine",
      }),
    ],
  }
}

describe("OnlineCompetitionLeaderboardTable benchmark display", () => {
  it("renders Overall/100, rating, category scores, tiers, and verification state", () => {
    render(
      <OnlineCompetitionLeaderboardTable
        leaderboard={[createBenchmarkEntry()]}
        events={[
          {
            id: "tw-1",
            name: "Strict Press",
            trackOrder: 1,
            scheme: "load",
          },
          {
            id: "tw-2",
            name: "Mile Run",
            trackOrder: 2,
            scheme: "time",
          },
        ]}
        selectedEventId={null}
        scoringAlgorithm="online"
      />,
    )

    expect(screen.getAllByText("Alex Athlete").length).toBeGreaterThan(0)
    expect(screen.getAllByText("72.5/100").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Regional").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Strength").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Engine").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Tier 8").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Tier 6.5").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Verified").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Adjusted").length).toBeGreaterThan(0)
    expect(screen.queryByText(/HillerFit/i)).not.toBeInTheDocument()
  })

  it("renders affiliate as subtext under the athlete instead of a dedicated column", () => {
    render(
      <OnlineCompetitionLeaderboardTable
        leaderboard={[createBenchmarkEntry()]}
        events={[
          {
            id: "tw-1",
            name: "Strict Press",
            trackOrder: 1,
            scheme: "load",
          },
          {
            id: "tw-2",
            name: "Mile Run",
            trackOrder: 2,
            scheme: "time",
          },
        ]}
        selectedEventId={null}
        scoringAlgorithm="online"
      />,
    )

    // No dedicated Affiliate column header
    const headerTexts = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent)
    expect(headerTexts).not.toContain("Affiliate")

    // Affiliate still renders as subtext in the same cell as the athlete name
    const affiliateNodes = screen.getAllByText("WODsmith Gym")
    expect(affiliateNodes.length).toBeGreaterThan(0)
    expect(
      affiliateNodes.some((node) =>
        node.parentElement?.textContent?.includes("Alex Athlete"),
      ),
    ).toBe(true)
  })

  // @lat: [[competition-type-capabilities#Benchmark Category Grouping#Category Group Headers]]
  it("groups event columns under benchmark category headers", () => {
    render(
      <OnlineCompetitionLeaderboardTable
        leaderboard={[createBenchmarkEntry()]}
        events={[
          {
            id: "tw-1",
            name: "Strict Press",
            trackOrder: 1,
            scheme: "load",
            benchmarkCategoryKey: "strength",
            benchmarkCategoryLabel: "Strength",
          },
          {
            id: "tw-2",
            name: "Mile Run",
            trackOrder: 2,
            scheme: "time",
            benchmarkCategoryKey: "engine",
            benchmarkCategoryLabel: "Engine",
          },
        ]}
        selectedEventId={null}
        scoringAlgorithm="online"
      />,
    )

    const headers = screen.getAllByRole("columnheader")
    const headerTexts = headers.map((h) => h.textContent)
    expect(headerTexts).toContain("Strength")
    expect(headerTexts).toContain("Engine")
  })

  // @lat: [[competition-type-capabilities#Additive Tier Context]]
  it("renders tier context additively when the board ranks with online scoring", () => {
    render(
      <OnlineCompetitionLeaderboardTable
        leaderboard={[createBenchmarkEntry()]}
        events={[
          {
            id: "tw-1",
            name: "Strict Press",
            trackOrder: 1,
            scheme: "load",
          },
          {
            id: "tw-2",
            name: "Mile Run",
            trackOrder: 2,
            scheme: "time",
          },
        ]}
        selectedEventId={null}
        scoringAlgorithm="online"
      />,
    )

    expect(screen.getAllByText("72.5/100").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Regional").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Tier 8").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Tier 6.5").length).toBeGreaterThan(0)
  })
})
