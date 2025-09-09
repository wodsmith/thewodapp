"use client"

import { use, useState, useCallback, Suspense, useTransition } from "react"
import { useServerAction } from "zsa-react"
import { Skeleton } from "@/components/ui/skeleton"
import { TeamWorkoutSection } from "./team-workout-section"
import { getScheduledTeamWorkoutsWithResultsAction } from "@/actions/workout-actions"
import { useSessionStore } from "@/state/session"
import {
	startOfLocalDay,
	endOfLocalDay,
	startOfLocalWeek,
	endOfLocalWeek,
} from "@/utils/date-utils"
import type { TeamWorkoutsData } from "./team-workouts-server"

type ViewMode = "daily" | "weekly"

interface Team {
	id: string
	name: string
	isPersonalTeam?: number | boolean
}

interface TeamWorkoutSuspenseProps {
	team: Team
	workoutsPromise: Promise<any[]>
	viewMode: ViewMode
	onViewModeChange: (teamId: string, mode: ViewMode) => void
	onRefresh: (teamId: string, mode: ViewMode) => Promise<void>
}

function TeamWorkoutSuspense({
	team,
	workoutsPromise,
	viewMode,
	onViewModeChange,
	onRefresh,
}: TeamWorkoutSuspenseProps) {
	const workouts = use(workoutsPromise)

	return (
		<TeamWorkoutSection
			team={team}
			viewMode={viewMode}
			teamWorkouts={workouts}
			isLoading={false}
			onViewModeChange={onViewModeChange}
			onRefresh={onRefresh}
		/>
	)
}

interface TeamWorkoutsClientProps {
	teams: Team[]
	initialWorkoutsData: TeamWorkoutsData[]
}

export function TeamWorkoutsClient({
	teams,
	initialWorkoutsData,
}: TeamWorkoutsClientProps) {
	const [teamViewModes, setTeamViewModes] = useState<Record<string, ViewMode>>(
		() => {
			const initial: Record<string, ViewMode> = {}
			for (const team of teams) {
				initial[team.id] = "daily"
			}
			return initial
		},
	)

	const [workoutsData, setWorkoutsData] = useState<
		Record<string, Promise<any[]>>
	>(() => {
		const initial: Record<string, Promise<any[]>> = {}
		for (const data of initialWorkoutsData) {
			initial[data.teamId] = data.workoutsPromise
		}
		return initial
	})

	const session = useSessionStore((state) => state.session)
	const userId = session?.id
	const { execute: fetchWorkouts } = useServerAction(
		getScheduledTeamWorkoutsWithResultsAction,
	)
	const [isPending, startTransition] = useTransition()

	const getDateRange = useCallback((mode: ViewMode) => {
		if (mode === "daily") {
			return { start: startOfLocalDay(), end: endOfLocalDay() }
		} else {
			return { start: startOfLocalWeek(), end: endOfLocalWeek() }
		}
	}, [])

	const fetchTeamWorkouts = useCallback(
		async (teamId: string, mode: ViewMode) => {
			if (!userId) return []

			const { start, end } = getDateRange(mode)
			const result = await fetchWorkouts({
				teamId,
				startDate: start.toISOString(),
				endDate: end.toISOString(),
				userId,
			})

			const [serverResult, serverError] = result
			if (serverResult?.success && !serverError) {
				return serverResult.data
			}
			return []
		},
		[userId, fetchWorkouts, getDateRange],
	)

	const handleViewModeChange = useCallback(
		(teamId: string, mode: ViewMode) => {
			startTransition(() => {
				setTeamViewModes((prev) => ({
					...prev,
					[teamId]: mode,
				}))

				// Create a new promise for the data fetch
				const newDataPromise = fetchTeamWorkouts(teamId, mode)
				setWorkoutsData((prev) => ({
					...prev,
					[teamId]: newDataPromise,
				}))
			})
		},
		[fetchTeamWorkouts],
	)

	const handleRefresh = useCallback(
		async (teamId: string, mode: ViewMode) => {
			startTransition(() => {
				const newDataPromise = fetchTeamWorkouts(teamId, mode)
				setWorkoutsData((prev) => ({
					...prev,
					[teamId]: newDataPromise,
				}))
			})
		},
		[fetchTeamWorkouts],
	)

	return (
		<div>
			<h2 className="text-2xl font-bold mb-6 pb-3 border-b-2 border-primary/20 text-center sm:text-left">
				Scheduled Workouts
			</h2>

			<div className="space-y-8">
				{teams.map((team) => {
					const viewMode = teamViewModes[team.id] || "daily"
					const workoutsPromise = workoutsData[team.id]

					if (!workoutsPromise) return null

					return (
						<Suspense
							key={`${team.id}-${viewMode}`}
							fallback={
								<div className="card p-6">
									<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
										<h3 className="font-semibold text-lg mb-2 sm:mb-0">
											{team.name}
										</h3>
									</div>
									<div className="space-y-3 py-12">
										<Skeleton className="h-4 w-full" />
										<Skeleton className="h-4 w-3/4" />
									</div>
								</div>
							}
						>
							<TeamWorkoutSuspense
								team={team}
								workoutsPromise={workoutsPromise}
								viewMode={viewMode}
								onViewModeChange={handleViewModeChange}
								onRefresh={handleRefresh}
							/>
						</Suspense>
					)
				})}
			</div>
		</div>
	)
}
