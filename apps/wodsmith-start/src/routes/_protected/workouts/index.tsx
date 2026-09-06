import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
import { LayoutGrid, LayoutList, Plus, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { z } from "zod"
import { Pagination } from "@/components/pagination"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { WorkoutCard } from "@/components/workout-card"
import {
  type FilterOptions,
  WorkoutFilters,
  type WorkoutFilters as WorkoutFiltersType,
} from "@/components/workout-filters"
import { WorkoutImportEntry } from "@/components/workout-import/workout-import-entry"
import { WORKOUT_SCHEME_VALUES } from "@/db/schemas/workouts"
import { trainingDateSchema } from "@/server/training-validation"
import { getTrainingContextFn } from "@/server-fns/training-fns"
import {
  getWorkoutFilterOptionsFn,
  getWorkoutsFn,
} from "@/server-fns/workout-fns"

// Default page size for pagination
const DEFAULT_PAGE_SIZE = 50

// Search params schema for URL-based filters
// Note: All params are optional to allow linking without specifying all params
// Defaults are applied in the loader/component
const workoutsSearchSchema = z.object({
  view: z.enum(["row", "card"]).optional(),
  q: z.string().optional(),
  teamId: z.string().optional(),
  date: trainingDateSchema.optional().catch(undefined),
  // Pagination params
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  // Advanced filter params - stored as comma-separated strings in URL
  tagIds: z.string().optional(),
  movementIds: z.string().optional(),
  workoutType: z.enum(WORKOUT_SCHEME_VALUES).optional(),
  trackId: z.string().optional(),
  type: z.enum(["all", "original", "remix"]).optional(),
})

type WorkoutsSearch = z.infer<typeof workoutsSearchSchema>

// Helper to parse comma-separated string to array
function parseStringToArray(val: string | undefined): string[] {
  return val ? val.split(",").filter(Boolean) : []
}

export const Route = createFileRoute("/_protected/workouts/")({
  component: WorkoutsPage,
  beforeLoad: async ({ context }) => {
    // @lat: [[architecture#Route Groups#_protected#Workout tracking guards]]
    if (!context.hasWorkoutTracking) {
      throw redirect({ to: "/" })
    }
  },
  validateSearch: (search: Record<string, unknown>): WorkoutsSearch => {
    return workoutsSearchSchema.parse(search)
  },
  loaderDeps: ({ search }) => ({
    q: search.q,
    teamId: search.teamId,
    date: search.date,
    page: search.page,
    pageSize: search.pageSize,
    tagIds: search.tagIds,
    movementIds: search.movementIds,
    workoutType: search.workoutType,
    trackId: search.trackId,
    type: search.type,
  }),
  loader: async ({ deps }) => {
    const training = await getTrainingContextFn()
    const team =
      training.teams.find((item) => item.id === deps.teamId) ??
      training.teams.find((item) => item.id === training.activeTeamId) ??
      training.teams[0]
    const teamId = team?.id
    const date =
      deps.date ??
      new Intl.DateTimeFormat("en-CA", {
        timeZone: team?.timezone ?? "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date())
    if (!teamId) {
      return {
        workouts: [],
        totalCount: 0,
        currentPage: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        filterOptions: { tags: [], movements: [], tracks: [] } as FilterOptions,
        teamId: null,
        date,
        teams: training.teams,
      }
    }

    // Parse comma-separated strings to arrays
    const tagIdsArray = parseStringToArray(deps.tagIds)
    const movementIdsArray = parseStringToArray(deps.movementIds)

    // Apply defaults for pagination
    const page = deps.page ?? 1
    const pageSize = deps.pageSize ?? DEFAULT_PAGE_SIZE

    // Build filter params from search deps
    const filterParams: {
      teamId: string
      search?: string
      page: number
      pageSize: number
      tagIds?: string[]
      movementIds?: string[]
      workoutType?: (typeof WORKOUT_SCHEME_VALUES)[number]
      trackId?: string
      type?: "all" | "original" | "remix"
    } = {
      teamId,
      search: deps.q,
      page,
      pageSize,
    }

    if (tagIdsArray.length > 0) {
      filterParams.tagIds = tagIdsArray
    }
    if (movementIdsArray.length > 0) {
      filterParams.movementIds = movementIdsArray
    }
    if (deps.workoutType) {
      filterParams.workoutType = deps.workoutType
    }
    if (deps.trackId) {
      filterParams.trackId = deps.trackId
    }
    if (deps.type && deps.type !== "all") {
      filterParams.type = deps.type
    }

    const [workoutsResult, filterOptions] = await Promise.all([
      getWorkoutsFn({ data: filterParams }),
      getWorkoutFilterOptionsFn({ data: { teamId } }),
    ])
    return {
      ...workoutsResult,
      filterOptions,
      teamId,
      date,
      teams: training.teams,
    }
  },
})

function WorkoutsPage() {
  const {
    workouts,
    totalCount,
    currentPage,
    pageSize,
    filterOptions,
    teamId,
    date,
    teams,
  } = Route.useLoaderData()
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()
  // Apply defaults for optional search params
  const view = search.view ?? "row"
  const q = search.q ?? ""
  const { tagIds, movementIds, workoutType, trackId, type } = search
  const [searchQuery, setSearchQuery] = useState(q)
  useEffect(() => setSearchQuery(q), [q])

  // Build search params for pagination navigation
  const buildPaginationSearchParams = (page: number) => ({
    view,
    teamId: teamId ?? undefined,
    date,
    q: q || undefined,
    page,
    pageSize,
    tagIds,
    movementIds,
    workoutType,
    trackId,
    type,
  })

  // Current filters state derived from URL (parse comma-separated strings)
  const currentFilters: WorkoutFiltersType = {
    tagIds: parseStringToArray(tagIds),
    movementIds: parseStringToArray(movementIds),
    workoutType,
    trackId,
    type: type || "all",
  }

  // Check if any filters are active
  const hasActiveFilters =
    currentFilters.tagIds.length > 0 ||
    currentFilters.movementIds.length > 0 ||
    currentFilters.workoutType ||
    currentFilters.trackId ||
    (currentFilters.type && currentFilters.type !== "all")

  const filteredWorkouts = workouts

  // Handle view toggle
  const handleViewChange = (newView: "row" | "card") => {
    navigate({
      search: (prev) => ({ ...prev, view: newView }),
    })
  }

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  // Handle filters change - update URL params and refetch (reset to page 1)
  const handleFiltersChange = (newFilters: WorkoutFiltersType) => {
    navigate({
      search: {
        view,
        teamId: teamId ?? undefined,
        date,
        q,
        page: 1, // Reset to page 1 when filters change
        pageSize,
        tagIds:
          newFilters.tagIds.length > 0
            ? newFilters.tagIds.join(",")
            : undefined,
        movementIds:
          newFilters.movementIds.length > 0
            ? newFilters.movementIds.join(",")
            : undefined,
        workoutType: newFilters.workoutType || undefined,
        trackId: newFilters.trackId || undefined,
        type: newFilters.type === "all" ? undefined : newFilters.type,
      },
      reloadDocument: false,
    })
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-bold">Workout library</h1>
        <div className="flex flex-wrap gap-2">
          <WorkoutImportEntry
            destination={{ kind: "personal" }}
            saveLabel="Create workout"
            onSaved={(result) =>
              navigate({
                to: "/workouts/$workoutId",
                params: { workoutId: result.workoutId },
                search: { teamId: teamId ?? undefined, date },
              })
            }
          />
          <Button asChild>
            <Link
              to="/workouts/new"
              search={{ remixFrom: undefined, teamId: teamId ?? undefined }}
            >
              <Plus className="h-5 w-5 mr-2" />
              Create workout
            </Link>
          </Button>
        </div>
      </div>

      <p className="mb-6 max-w-2xl text-muted-foreground">
        Find a workout, make it your own, and add it to your training session.
      </p>
      {teams.length > 1 && (
        <div className="mb-6 max-w-sm space-y-2">
          <label htmlFor="library-gym" className="text-sm font-medium">
            Gym or coaching group
          </label>
          <select
            id="library-gym"
            className="min-h-11 w-full rounded-md border border-input bg-background px-3"
            value={teamId ?? ""}
            onChange={(event) => {
              const nextTeamId = event.currentTarget.value
              void navigate({
                search: (prev) => ({
                  ...prev,
                  teamId: nextTeamId,
                  trackId: undefined,
                  tagIds: undefined,
                  movementIds: undefined,
                  page: 1,
                }),
              })
            }}
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="mb-6 max-w-sm space-y-2">
        <label htmlFor="library-date" className="text-sm font-medium">
          Add to session on
        </label>
        <Input
          id="library-date"
          type="date"
          value={date}
          onChange={(event) => {
            if (event.target.value)
              navigate({
                search: (prev) => ({ ...prev, date: event.target.value }),
              })
          }}
        />
      </div>
      {/* Search + View Toggle */}
      <div className="mb-4 flex gap-4">
        <form
          className="flex min-w-0 flex-1 gap-2"
          aria-label="Workout library search"
          onSubmit={(event) => {
            event.preventDefault()
            void navigate({
              search: (prev) => ({ ...prev, q: searchQuery, page: 1 }),
            })
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Search workout library"
              placeholder="Search workouts..."
              className="pl-10"
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <div className="flex border rounded-md">
          <Button
            variant={view === "row" ? "default" : "ghost"}
            size="icon"
            aria-label="List view"
            onClick={() => handleViewChange("row")}
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "card" ? "default" : "ghost"}
            size="icon"
            aria-label="Card view"
            onClick={() => handleViewChange("card")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Advanced Filters */}
      <WorkoutFilters
        filterOptions={filterOptions}
        filters={currentFilters}
        onFiltersChange={handleFiltersChange}
        className="mb-6"
      />

      {/* Workout List */}
      {filteredWorkouts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">
            {q.trim() || hasActiveFilters
              ? "No workouts found matching your filters."
              : "No workouts found. Create your first workout to get started."}
          </p>
        </div>
      ) : view === "row" ? (
        <ul className="space-y-2">
          {filteredWorkouts.map((workout) => (
            <li key={workout.id} className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border py-5">
                <div className="min-w-0 flex-1">
                  <Link
                    className="text-lg font-semibold underline-offset-4 hover:underline"
                    to="/workouts/$workoutId"
                    params={{ workoutId: workout.id }}
                    search={{ teamId: teamId ?? undefined, date }}
                  >
                    {workout.name}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {workout.scheme}
                  </p>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm">
                    {workout.description}
                  </p>
                </div>
              </div>
              {teamId && (
                <a
                  className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
                  href={`/training?${new URLSearchParams({ teamId, date, workoutId: workout.id })}`}
                >
                  Add to my session
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkouts.map((workout, index) => (
            <div key={workout.id}>
              <Link
                to="/workouts/$workoutId"
                params={{ workoutId: workout.id }}
                search={{ teamId: teamId ?? undefined, date }}
              >
                <WorkoutCard
                  trackOrder={index + 1}
                  name={workout.name}
                  scheme={workout.scheme}
                  description={workout.description}
                  scoreType={null}
                  roundsToScore={null}
                  pointsMultiplier={null}
                  notes={null}
                  movements={workout.movements}
                  tags={workout.tags}
                  divisionDescriptions={[]}
                />
              </Link>
              {teamId && (
                <a
                  className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
                  href={`/training?${new URLSearchParams({ teamId, date, workoutId: workout.id })}`}
                >
                  Add to my session
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalCount={totalCount}
        pageSize={pageSize}
        basePath="/workouts"
        buildSearchParams={buildPaginationSearchParams}
        className="mt-8"
      />
    </div>
  )
}
