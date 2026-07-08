// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const routerMocks = vi.hoisted(() => ({
  parentUseLoaderData: vi.fn(),
  routeUseLoaderData: vi.fn(),
  routeUseSearch: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: Record<string, unknown>) => ({
    ...config,
    fullPath: "/compete/$slug/stats",
    useLoaderData: routerMocks.routeUseLoaderData,
    useSearch: routerMocks.routeUseSearch,
  }),
  getRouteApi: () => ({
    useLoaderData: routerMocks.parentUseLoaderData,
  }),
  Link: ({
    children,
    to,
    className,
  }: {
    children: ReactNode
    to: string
    className?: string
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useLocation: () => ({ pathname: "/compete/test-benchmark/stats" }),
  useNavigate: () => routerMocks.navigate,
  useRouter: () => ({ invalidate: vi.fn() }),
  redirect: (options: Record<string, unknown>) => options,
}))

vi.mock("@/server-fns/leaderboard-fns", () => ({
  getCompetitionLeaderboardFn: vi.fn(),
}))

const benchmarkSettings = JSON.stringify({
  scoringConfig: {
    algorithm: "online",
    tiebreaker: { primary: "countback" },
    statusHandling: { dnf: "zero", dns: "zero", withdrawn: "zero" },
  },
})

const traditionalSettings = JSON.stringify({
  scoringConfig: {
    algorithm: "traditional",
    traditional: { step: 5, firstPlacePoints: 100 },
    tiebreaker: { primary: "countback" },
    statusHandling: { dnf: "zero", dns: "zero", withdrawn: "zero" },
  },
})

type LeaderboardEntry =
  import("@/server-fns/leaderboard-fns").CompetitionLeaderboardEntry

function createStatsEntry(): LeaderboardEntry {
  return {
    registrationId: "reg-1",
    userId: "user-1",
    athleteName: "Alex Athlete",
    divisionId: "div-open",
    divisionLabel: "Open",
    totalPoints: 72.5,
    overallRank: 1,
    isTeamDivision: false,
    teamName: null,
    teamMembers: [],
    affiliate: "WODsmith Gym",
    benchmarkOverallScore: 72.5,
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
        tierSum: 8,
        testCount: 1,
        weight: 1,
      },
    ],
    eventResults: [
      {
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
      },
    ],
  }
}

function setRouteData(
  settings: string,
  loadError: string | null,
  competitionType = "benchmark",
) {
  routerMocks.parentUseLoaderData.mockReturnValue({
    competition: {
      id: "comp-1",
      slug: "test-benchmark",
      settings,
      competitionType,
    },
    divisions: [{ id: "div-open", label: "Open" }],
    userRegistrations: [],
  })
  routerMocks.routeUseLoaderData.mockReturnValue({
    initialStats: null,
    loadError,
  })
  routerMocks.routeUseSearch.mockReturnValue({})
}

describe("benchmark stats route states", () => {
  // Import once: the route module pulls a heavy component graph, and paying
  // that cost inside a test times out under full-suite load.
  let BenchmarkStatsPage: (typeof import("@/routes/compete/$slug/stats"))["BenchmarkStatsPage"]

  beforeAll(async () => {
    ;({ BenchmarkStatsPage } = await import("@/routes/compete/$slug/stats"))
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fails closed when benchmark stats cannot load", async () => {
    setRouteData(
      benchmarkSettings,
      "Benchmark stats could not be loaded because the benchmark configuration is incomplete or unavailable.",
    )
    render(<BenchmarkStatsPage />)

    expect(
      screen.getByText("Benchmark stats could not load"),
    ).toBeInTheDocument()
    expect(screen.queryByText("No benchmark stats yet")).toBeNull()
  })

  it("shows unavailable copy for direct visits on non-benchmark competitions", async () => {
    setRouteData(traditionalSettings, null, "in-person")
    render(<BenchmarkStatsPage />)

    expect(
      screen.getByText("Benchmark stats are not available"),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/only available for benchmark competitions/i),
    ).toBeInTheDocument()
  })

  it("labels the division and athlete selects", async () => {
    routerMocks.parentUseLoaderData.mockReturnValue({
      competition: {
        id: "comp-1",
        slug: "test-benchmark",
        settings: benchmarkSettings,
        competitionType: "benchmark",
        timezone: null,
      },
      divisions: [
        { id: "div-open", label: "Open" },
        { id: "div-masters", label: "Masters" },
      ],
      userRegistrations: [],
    })
    routerMocks.routeUseLoaderData.mockReturnValue({
      initialStats: {
        entries: [createStatsEntry()],
        scoringAlgorithm: "online",
        divisionId: "div-open",
      },
      loadError: null,
    })
    routerMocks.routeUseSearch.mockReturnValue({})

    render(<BenchmarkStatsPage />)

    expect(screen.getByLabelText("Division")).toBeInTheDocument()
    expect(screen.getByLabelText("Athlete")).toBeInTheDocument()
  })
})
