"use client"

import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { useServerFn } from "@tanstack/react-start"
import { Plus, Save } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { upsertCompetitionEventsFn } from "@/server-fns/competition-event-fns"
import { useSubmissionWindowsStore } from "@/state/submission-windows"
import { SubmissionWindow } from "./submission-window"
import { UnassignedWorkoutsPool } from "./unassigned-workouts-pool"

interface WorkoutWithType {
	id: string
	workoutId: string
	name: string
	workoutType: string
	trackOrder: number
}

interface CompetitionEvent {
	id?: string
	trackWorkoutId: string
	submissionOpensAt: string | null
	submissionClosesAt: string | null
}

interface SubmissionWindowsManagerProps {
	competitionId: string
	teamId: string
	workouts: WorkoutWithType[]
	initialEvents: CompetitionEvent[]
	timezone: string // IANA timezone (e.g., "America/Denver")
}

export function SubmissionWindowsManager({
	competitionId,
	teamId,
	workouts,
	initialEvents,
	timezone,
}: SubmissionWindowsManagerProps) {
	const [instanceId] = useState(() => Symbol("submission-windows"))
	const [isSaving, setIsSaving] = useState(false)
	const [isInitialized, setIsInitialized] = useState(false)
	const hasInitialized = useRef(false)

	const {
		windows,
		workoutAssignments,
		isDirty,
		setWindows,
		addWindow,
		updateWindow,
		assignWorkout,
		unassignWorkout,
		markClean,
		reset,
	} = useSubmissionWindowsStore()

	const upsertEvents = useServerFn(upsertCompetitionEventsFn)

	// Initialize state from server data
	useEffect(() => {
		// Prevent double initialization in strict mode
		if (hasInitialized.current) return
		hasInitialized.current = true

		// Reset store before initializing to clear any stale state
		reset()

		// Group events by submission window (based on matching timestamps)
		// Skip events with null times - those are unassigned workouts
		const windowMap = new Map<
			string,
			{
				submissionOpensAt: string | null
				submissionClosesAt: string | null
				workoutIds: string[]
			}
		>()

		for (const event of initialEvents) {
			// Skip events with no submission window configured
			if (!event.submissionOpensAt && !event.submissionClosesAt) {
				continue
			}

			const key = `${event.submissionOpensAt || "null"}-${event.submissionClosesAt || "null"}`
			const existing = windowMap.get(key)
			if (existing) {
				existing.workoutIds.push(event.trackWorkoutId)
			} else {
				windowMap.set(key, {
					submissionOpensAt: event.submissionOpensAt,
					submissionClosesAt: event.submissionClosesAt,
					workoutIds: [event.trackWorkoutId],
				})
			}
		}

		// Create windows and assignments from grouped events
		const initialWindows = Array.from(windowMap.entries()).map(
			([_key, data], index) => ({
				id: `window-${index}`,
				submissionOpensAt: data.submissionOpensAt,
				submissionClosesAt: data.submissionClosesAt,
			}),
		)

		setWindows(initialWindows)

		// Set initial assignments
		Array.from(windowMap.entries()).forEach(([_key, data], index) => {
			const windowId = `window-${index}`
			for (const workoutId of data.workoutIds) {
				assignWorkout(windowId, workoutId)
			}
		})

		// Mark as clean since we just loaded from server
		markClean()
		setIsInitialized(true)
	}, [initialEvents, setWindows, assignWorkout, markClean, reset])

	// Monitor for drag-drop events
	useEffect(() => {
		return monitorForElements({
			canMonitor({ source }) {
				return (
					source.data.instanceId === instanceId &&
					source.data.type === "workout-pool"
				)
			},
			onDrop({ source, location }) {
				const destinationWindow = location.current.dropTargets[0]
				if (!destinationWindow) return

				const workoutId = source.data.workoutId
				const windowId = destinationWindow.data.windowId

				if (typeof workoutId === "string" && typeof windowId === "string") {
					// Remove from any existing window first
					for (const [wId, workoutIds] of workoutAssignments.entries()) {
						if (workoutIds.includes(workoutId)) {
							unassignWorkout(wId, workoutId)
						}
					}

					// Assign to new window
					assignWorkout(windowId, workoutId)
				}
			},
		})
	}, [instanceId, assignWorkout, unassignWorkout, workoutAssignments])

	const assignedWorkoutIds = useMemo(() => {
		const ids = new Set<string>()
		for (const workoutIds of workoutAssignments.values()) {
			for (const id of workoutIds) {
				ids.add(id)
			}
		}
		return ids
	}, [workoutAssignments])

	const handleAddWindow = useCallback(() => {
		const newWindow = {
			id: `window-${Date.now()}`,
			submissionOpensAt: null,
			submissionClosesAt: null,
		}
		addWindow(newWindow)
	}, [addWindow])

	const handleUpdateWindow = useCallback(
		(windowId: string) =>
			(updates: {
				submissionOpensAt?: string | null
				submissionClosesAt?: string | null
			}) => {
				updateWindow(windowId, updates)
			},
		[updateWindow],
	)

	const handleRemoveWorkout = useCallback(
		(windowId: string) => (workoutId: string) => {
			unassignWorkout(windowId, workoutId)
		},
		[unassignWorkout],
	)

	const handleSave = async () => {
		setIsSaving(true)
		try {
			// Build events array from windows and assignments
			const events: {
				trackWorkoutId: string
				submissionOpensAt: string | null
				submissionClosesAt: string | null
			}[] = []

			// Track which workouts are assigned
			const assignedIds = new Set<string>()

			for (const window of windows) {
				const workoutIds = workoutAssignments.get(window.id) || []
				for (const workoutId of workoutIds) {
					assignedIds.add(workoutId)
					events.push({
						trackWorkoutId: workoutId,
						submissionOpensAt: window.submissionOpensAt,
						submissionClosesAt: window.submissionClosesAt,
					})
				}
			}

			// Only clear submission windows for workouts that PREVIOUSLY had values
			// (don't create new records with null values)
			const previouslyAssignedIds = new Set(
				initialEvents
					.filter((e) => e.submissionOpensAt || e.submissionClosesAt)
					.map((e) => e.trackWorkoutId),
			)

			for (const workoutId of previouslyAssignedIds) {
				if (!assignedIds.has(workoutId)) {
					events.push({
						trackWorkoutId: workoutId,
						submissionOpensAt: null,
						submissionClosesAt: null,
					})
				}
			}

			if (events.length === 0) {
				markClean()
				return
			}

			await upsertEvents({
				data: {
					competitionId,
					teamId,
					events,
				},
			})

			markClean()
			console.log("Submission windows saved successfully")
		} catch (error) {
			console.error(
				"Failed to save:",
				error instanceof Error ? error.message : error,
			)
		} finally {
			setIsSaving(false)
		}
	}

	// Show skeleton while initializing
	if (!isInitialized) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<Skeleton className="h-8 w-48" />
					<div className="flex gap-2">
						<Skeleton className="h-9 w-28" />
						<Skeleton className="h-9 w-24" />
					</div>
				</div>

				<div className="grid gap-6 lg:grid-cols-[300px_1fr]">
					<div className="space-y-4">
						<Skeleton className="h-10 w-full" />
						<div className="space-y-2">
							{/* biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton array, items never reorder */}
							{Array.from({ length: workouts.length || 3 }).map((_, i) => (
								<Skeleton key={i} className="h-10 w-full" />
							))}
						</div>
					</div>
					<div className="space-y-4">
						<Skeleton className="h-48 w-full" />
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h2 className="text-2xl font-bold">Submission Windows</h2>
				<div className="flex gap-2">
					<Button onClick={handleAddWindow} variant="outline" size="sm">
						<Plus className="h-4 w-4 mr-2" />
						Add Window
					</Button>
					<Button
						onClick={handleSave}
						disabled={!isDirty || isSaving}
						size="sm"
					>
						<Save className="h-4 w-4 mr-2" />
						{isSaving ? "Saving..." : isDirty ? "Save Changes" : "Saved"}
					</Button>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-[300px_1fr]">
				<div className="space-y-4">
					<UnassignedWorkoutsPool
						workouts={workouts}
						assignedWorkoutIds={assignedWorkoutIds}
						instanceId={instanceId}
					/>
				</div>

				<div className="space-y-4">
					{windows.length === 0 ? (
						<div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
							<p className="mb-4">No submission windows created</p>
							<Button onClick={handleAddWindow} variant="outline">
								<Plus className="h-4 w-4 mr-2" />
								Create First Window
							</Button>
						</div>
					) : (
						windows.map((window) => {
							const windowWorkouts = (workoutAssignments.get(window.id) || [])
								.map((workoutId) => {
									const workout = workouts.find((w) => w.id === workoutId)
									return workout
										? {
												id: workout.id,
												name: workout.name,
												trackWorkoutId: workout.id,
											}
										: null
								})
								.filter((w): w is NonNullable<typeof w> => w !== null)

							return (
								<SubmissionWindow
									key={window.id}
									window={window}
									workouts={windowWorkouts}
									instanceId={instanceId}
									timezone={timezone}
									onUpdateWindow={handleUpdateWindow(window.id)}
									onRemoveWorkout={handleRemoveWorkout(window.id)}
								/>
							)
						})
					)}
				</div>
			</div>
		</div>
	)
}
