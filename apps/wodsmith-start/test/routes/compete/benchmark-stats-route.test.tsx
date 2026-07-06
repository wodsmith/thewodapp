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
})
