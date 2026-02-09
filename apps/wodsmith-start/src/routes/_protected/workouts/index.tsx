import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router"
import { LayoutGrid, LayoutList, Plus, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { z } from "zod"
import { Pagination } from "@/components/pagination"
import { ScheduledWorkoutsSection } from "@/components/scheduled-workouts-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { WorkoutCard } from "@/components/workout-card"
import {
	type FilterOptions,
	WorkoutFilters,
	type WorkoutFilters as WorkoutFiltersType,
} from "@/components/workout-filters"
import WorkoutRowCard from "@/components/workout-row-card"
import { WORKOUT_SCHEME_VALUES } from "@/db/schemas/workouts"
import {
	getScheduledWorkoutsWithResultsFn,
	getTodayScoresFn,
	getWorkoutFilterOptionsFn,
	getWorkoutsFn,
	type ScheduledWorkoutWithResult,
	type TodayScore,
} from "@/server-fns/workout-fns"

// Helper to get start of local day
function startOfLocalDay(date: Date = new Date()): Date {
	const d = new Date(date)
	d.setHours(0, 0, 0, 0)
	return d
}

// Helper to get end of local day
function endOfLocalDay(date: Date = new Date()): Date {
	const d = new Date(date)
	d.setHours(23, 59, 59, 999)
	return d
}

// Default page size for pagination
const DEFAULT_PAGE_SIZE = 50

// Search params schema for URL-based filters
// Note: All params are optional to allow linking without specifying all params
// Defaults are applied in the loader/component
const workoutsSearchSchema = z.object({
	view: z.enum(["row", "card"]).optional(),
	q: z.string().optional(),
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
		if (!context.hasWorkoutTracking) {
			throw redirect({ to: "/compete" })
		}
	},
	validateSearch: (search: Record<string, unknown>): WorkoutsSearch => {
		return workoutsSearchSchema.parse(search)
	},
	loaderDeps: ({ search }) => ({
		page: search.page,
		pageSize: search.pageSize,
		tagIds: search.tagIds,
		movementIds: search.movementIds,
		workoutType: search.workoutType,
		trackId: search.trackId,
		type: search.type,
	}),
	loader: async ({ context, deps }) => {
		// Get teamId and userId from session
		const session = context.session
		const teamId = session?.teams?.[0]?.id
		const userId = session?.userId

		if (!teamId) {
			return {
				workouts: [],
				totalCount: 0,
				currentPage: 1,
				pageSize: DEFAULT_PAGE_SIZE,
				scheduledWorkouts: [] as ScheduledWorkoutWithResult[],
				filterOptions: {
					tags: [],
					movements: [],
					tracks: [],
				} as FilterOptions,
				todayScoresMap: {} as Record<string, TodayScore>,
				teamId: null,
				userId: null,
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
			page: number
			pageSize: number
			tagIds?: string[]
			movementIds?: string[]
			workoutType?: (typeof WORKOUT_SCHEME_VALUES)[number]
			trackId?: string
			type?: "all" | "original" | "remix"
		} = {
			teamId,
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

		// Fetch workouts, scheduled workouts, and filter options in parallel
		const today = new Date()
		const [workoutsResult, scheduledResult, filterOptionsResult] =
			await Promise.all([
				getWorkoutsFn({ data: filterParams }),
				userId
					? getScheduledWorkoutsWithResultsFn({
							data: {
								teamId,
								userId,
								startDate: startOfLocalDay(today).toISOString(),
								endDate: endOfLocalDay(today).toISOString(),
							},
						})
					: Promise.resolve({ scheduledWorkoutsWithResults: [] }),
				getWorkoutFilterOptionsFn({ data: { teamId } }),
			])

		// Fetch today's scores for the returned workouts
		const workoutIds = workoutsResult.workouts.map((w) => w.id)
		const todayScoresResult =
			userId && workoutIds.length > 0
				? await getTodayScoresFn({
						data: {
							teamId,
							userId,
							workoutIds,
						},
					})
				: { scores: [] as TodayScore[] }

		// Create a map of workout ID to today's score for easy lookup
		const todayScoresMap = new Map<string, TodayScore>()
		for (const score of todayScoresResult.scores) {
			todayScoresMap.set(score.workoutId, score)
		}

		return {
			workouts: workoutsResult.workouts,
			totalCount: workoutsResult.totalCount,
			currentPage: workoutsResult.currentPage,
			pageSize: workoutsResult.pageSize,
			scheduledWorkouts: scheduledResult.scheduledWorkoutsWithResults,
			filterOptions: filterOptionsResult,
			todayScoresMap: Object.fromEntries(todayScoresMap),
			teamId,
			userId,
		}
	},
})

function WorkoutsPage() {
	const {
		workouts,
		totalCount,
		currentPage,
		pageSize,
		scheduledWorkouts,
		filterOptions,
		todayScoresMap,
		teamId,
		userId,
	} = Route.useLoaderData()
	const navigate = useNavigate({ from: Route.fullPath })
	const search = Route.useSearch()
	// Apply defaults for optional search params
	const view = search.view ?? "row"
	const q = search.q ?? ""
	const { tagIds, movementIds, workoutType, trackId, type } = search
	const [searchQuery, setSearchQuery] = useState(q)

	// Build search params for pagination navigation
	const buildPaginationSearchParams = (page: number) => ({
		view,
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

	// Filter workouts by search query (client-side for immediate feedback)
	const filteredWorkouts = useMemo(() => {
		if (!searchQuery.trim()) {
			return workouts
		}
		const query = searchQuery.toLowerCase()
		return workouts.filter((workout) =>
			workout.name.toLowerCase().includes(query),
		)
	}, [workouts, searchQuery])

	// Handle view toggle
	const handleViewChange = (newView: "row" | "card") => {
		navigate({
			search: (prev) => ({ ...prev, view: newView }),
		})
	}

	// Handle search input change
	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newQuery = e.target.value
		setSearchQuery(newQuery)
		navigate({
			search: (prev) => ({ ...prev, q: newQuery }),
		})
	}

	// Handle filters change - update URL params and refetch (reset to page 1)
	const handleFiltersChange = (newFilters: WorkoutFiltersType) => {
		navigate({
			search: {
				view,
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
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-4xl font-bold">WORKOUTS</h1>
				<Button asChild>
					<Link to="/workouts/new" search={{ remixFrom: undefined }}>
						<Plus className="h-5 w-5 mr-2" />
						Create Workout
					</Link>
				</Button>
			</div>

			{/* Scheduled Workouts Section */}
			{teamId && userId && (
				<ScheduledWorkoutsSection
					teamId={teamId}
					userId={userId}
					initialWorkouts={scheduledWorkouts}
				/>
			)}

			{/* Search + View Toggle */}
			<div className="mb-4 flex gap-4">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search workouts..."
						className="pl-10"
						value={searchQuery}
						onChange={handleSearchChange}
					/>
				</div>
				<div className="flex border rounded-md">
					<Button
						variant={view === "row" ? "default" : "ghost"}
						size="icon"
						onClick={() => handleViewChange("row")}
					>
						<LayoutList className="h-4 w-4" />
					</Button>
					<Button
						variant={view === "card" ? "default" : "ghost"}
						size="icon"
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
						{searchQuery.trim() || hasActiveFilters
							? "No workouts found matching your filters."
							: "No workouts found. Create your first workout to get started."}
					</p>
				</div>
			) : view === "row" ? (
				<ul className="space-y-2">
					{filteredWorkouts.map((workout) => (
						<WorkoutRowCard
							key={workout.id}
							workout={workout}
							result={todayScoresMap[workout.id] ?? null}
						/>
					))}
				</ul>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{filteredWorkouts.map((workout, index) => (
						<Link
							key={workout.id}
							to="/workouts/$workoutId"
							params={{ workoutId: workout.id }}
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
