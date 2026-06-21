// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

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
}))

vi.mock("@/server-fns/leaderboard-fns", () => ({
  getCompetitionLeaderboardFn: vi.fn(),
}))

const benchmarkSettings = JSON.stringify({
  scoringConfig: {
    algorithm: "absolute_tier",
    absoluteTier: { batteryId: "bbat_test" },
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

function setRouteData(settings: string, loadError: string | null) {
  routerMocks.parentUseLoaderData.mockReturnValue({
    competition: {
      id: "comp-1",
      slug: "test-benchmark",
      settings,
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
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fails closed when benchmark stats cannot load", async () => {
    setRouteData(
      benchmarkSettings,
      "Benchmark stats could not be loaded because the benchmark configuration is incomplete or unavailable.",
    )
    const { BenchmarkStatsPage } = await import(
      "@/routes/compete/$slug/stats"
    )

    render(<BenchmarkStatsPage />)

    expect(
      screen.getByText("Benchmark stats could not load"),
    ).toBeInTheDocument()
    expect(screen.queryByText("No benchmark stats yet")).toBeNull()
  })

  it("shows unavailable copy for direct visits on non-benchmark competitions", async () => {
    setRouteData(traditionalSettings, null)
    const { BenchmarkStatsPage } = await import(
      "@/routes/compete/$slug/stats"
    )

    render(<BenchmarkStatsPage />)

    expect(
      screen.getByText("Benchmark stats are not available"),
    ).toBeInTheDocument()
    expect(screen.getByText(/absolute tier scoring/i)).toBeInTheDocument()
  })
})
