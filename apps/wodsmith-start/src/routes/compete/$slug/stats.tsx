import {
  createFileRoute,
  getRouteApi,
  useNavigate,
} from "@tanstack/react-router"
import { BarChart3 } from "lucide-react"
import { z } from "zod"
import { BenchmarkStatLine } from "@/components/benchmark-stat-line"
import { CompetitionTabs } from "@/components/competition-tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type CompetitionLeaderboardEntry,
  type CompetitionLeaderboardResponse,
  getCompetitionLeaderboardFn,
} from "@/server-fns/leaderboard-fns"
import {
  getEffectiveScoringConfig,
  parseCompetitionSettings,
} from "@/types/competitions"

const parentRoute = getRouteApi("/compete/$slug")

interface BenchmarkStatsCompetition {
  id: string
  slug: string
  settings: string | null
}

interface BenchmarkStatsDivision {
  id: string
  label: string
}

interface BenchmarkStatsRegistration {
  id: string
  divisionId: string | null
}

interface BenchmarkStatsParentData {
  competition: BenchmarkStatsCompetition
  divisions: BenchmarkStatsDivision[]
  userRegistrations: BenchmarkStatsRegistration[]
}

interface BenchmarkStatsLoaderData {
  initialStats: {
    entries: CompetitionLeaderboardEntry[]
    scoringAlgorithm: CompetitionLeaderboardResponse["scoringAlgorithm"]
    divisionId: string
  } | null
  loadError: string | null
}

const statsSearchSchema = z.object({
  division: z.string().optional(),
  athlete: z.string().optional(),
})

export const Route = createFileRoute("/compete/$slug/stats")({
  validateSearch: statsSearchSchema,
  staleTime: 10_000,
  loaderDeps: ({ search }) => ({ division: search.division }),
  loader: async ({ deps, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const parentData = parentMatch.loaderData as
      | Pick<BenchmarkStatsParentData, "competition" | "divisions">
      | undefined
    const competition = parentData?.competition
    const divisions = parentData?.divisions ?? []

    if (!competition) {
      return { initialStats: null, loadError: null }
    }

    const targetDivisionId = deps.division ?? divisions[0]?.id ?? null
    if (!targetDivisionId) {
      return { initialStats: null, loadError: null }
    }

    try {
      const result = await getCompetitionLeaderboardFn({
        data: {
          competitionId: competition.id,
          divisionId: targetDivisionId,
        },
      })
      return {
        initialStats: {
          entries: result.entries,
          scoringAlgorithm: result.scoringAlgorithm,
          divisionId: targetDivisionId,
        },
        loadError: null,
      }
    } catch {
      return {
        initialStats: null,
        loadError:
          "Benchmark stats could not be loaded because the benchmark configuration is incomplete or unavailable.",
      }
    }
  },
  head: ({ params }) => {
    const displayName = params.slug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
    return {
      meta: [
        { title: `${displayName} Stats | WODsmith` },
        {
          name: "description",
          content: `View benchmark stats for ${displayName} on WODsmith.`,
        },
      ],
      links: [
        {
          rel: "canonical",
          href: `https://wodsmith.com/compete/${params.slug}/stats`,
        },
      ],
    }
  },
  component: BenchmarkStatsPage,
})

export function BenchmarkStatsPage() {
  const { competition, divisions, userRegistrations } =
    parentRoute.useLoaderData() as BenchmarkStatsParentData
  const { initialStats, loadError } =
    Route.useLoaderData() as BenchmarkStatsLoaderData
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const scoringConfig = getEffectiveScoringConfig(
    parseCompetitionSettings(competition.settings),
  )
  const isBenchmarkStats = scoringConfig?.algorithm === "absolute_tier"
  const selectedDivisionId = search.division ?? divisions[0]?.id ?? ""
  const entries = initialStats?.entries ?? []

  const viewerRegistration = userRegistrations.find(
    (registration) => registration.divisionId === selectedDivisionId,
  )
  const selectedRegistrationId =
    search.athlete ?? viewerRegistration?.id ?? entries[0]?.registrationId ?? ""
  const selectedEntry =
    entries.find((entry) => entry.registrationId === selectedRegistrationId) ??
    entries[0] ??
    null

  const handleDivisionChange = (divisionId: string) => {
    navigate({
      search: {
        ...search,
        division: divisionId,
        athlete: undefined,
      },
      replace: true,
    })
  }

  const handleAthleteChange = (registrationId: string) => {
    navigate({
      search: {
        ...search,
        athlete: registrationId,
      },
      replace: true,
    })
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-4 z-10">
        <CompetitionTabs
          slug={competition.slug}
          settings={competition.settings}
        />
      </div>

      <div className="rounded-2xl border border-black/10 bg-black/5 p-4 sm:p-6 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Benchmark Stats</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Overall score, category breakdown, and test-by-test status.
              </p>
            </div>

            {isBenchmarkStats && entries.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {divisions.length > 1 && (
                  <Select
                    value={selectedDivisionId}
                    onValueChange={handleDivisionChange}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Division" />
                    </SelectTrigger>
                    <SelectContent>
                      {divisions.map((division) => (
                        <SelectItem key={division.id} value={division.id}>
                          {division.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select
                  value={selectedEntry?.registrationId ?? ""}
                  onValueChange={handleAthleteChange}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Athlete" />
                  </SelectTrigger>
                  <SelectContent>
                    {entries.map((entry) => (
                      <SelectItem
                        key={entry.registrationId}
                        value={entry.registrationId}
                      >
                        {entry.athleteName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          {!isBenchmarkStats ? (
            <Alert>
              <BarChart3 className="h-4 w-4" />
              <AlertTitle>Benchmark stats are not available</AlertTitle>
              <AlertDescription>
                This view is available for benchmark boards that use absolute
                tier scoring.
              </AlertDescription>
            </Alert>
          ) : loadError ? (
            <Alert variant="destructive">
              <BarChart3 className="h-4 w-4" />
              <AlertTitle>Benchmark stats could not load</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : selectedEntry ? (
            <BenchmarkStatLine entry={selectedEntry} />
          ) : (
            <Alert className="border-dashed">
              <BarChart3 className="h-4 w-4" />
              <AlertTitle>No benchmark stats yet</AlertTitle>
              <AlertDescription>
                Stats will appear after athletes submit benchmark scores.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  )
}
