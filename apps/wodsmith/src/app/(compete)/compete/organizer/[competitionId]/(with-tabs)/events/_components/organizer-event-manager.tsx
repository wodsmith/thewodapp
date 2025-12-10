"use client"

import { useServerAction } from "@repo/zsa-react"
import { Plus } from "lucide-react"
import posthog from "posthog-js"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
	createCompetitionEventAction,
	removeWorkoutFromCompetitionAction,
	reorderCompetitionEventsAction,
} from "@/actions/competition-actions"
import { Button } from "@/components/ui/button"
import type { Movement, Sponsor } from "@/db/schema"
import type {
	ScoreType,
	SecondaryScheme,
	TiebreakScheme,
	WorkoutScheme,
} from "@/db/schemas/workouts"
import type { CompetitionWorkout } from "@/server/competition-workouts"
import { AddEventDialog } from "./add-event-dialog"
import { CompetitionEventRow } from "./competition-event-row"
import { CreateEventDialog } from "./create-event-dialog"

interface Division {
	id: string
	label: string
	position: number
	registrationCount: number
}

interface DivisionDescription {
	divisionId: string
	divisionLabel: string
	description: string | null
}

interface OrganizerEventManagerProps {
	competitionId: string
	organizingTeamId: string
	events: CompetitionWorkout[]
	movements: Movement[]
	divisions: Division[]
	divisionDescriptionsByWorkout: Record<string, DivisionDescription[]>
	sponsors: Sponsor[]
}

export function OrganizerEventManager({
	competitionId,
	organizingTeamId,
	events: initialEvents,
	movements,
	divisions,
	divisionDescriptionsByWorkout,
	sponsors,
}: OrganizerEventManagerProps) {
	const [events, setEvents] = useState(initialEvents)
	const [showCreateDialog, setShowCreateDialog] = useState(false)
	const [showAddDialog, setShowAddDialog] = useState(false)
	const [instanceId] = useState(() => Symbol("competition-events"))

	// Sync props to state when server data changes, but deduplicate
	useEffect(() => {
		setEvents((currentEvents) => {
			// Deduplicate by name + scheme (since new events may not have stable IDs yet)
			const serverEventKeys = new Set(
				initialEvents.map((e) => `${e.workout.name}:${e.workout.scheme}`),
			)
			const optimisticEvents = currentEvents.filter(
				(e) => !serverEventKeys.has(`${e.workout.name}:${e.workout.scheme}`),
			)

			// Merge server events with any remaining optimistic events
			return [...initialEvents, ...optimisticEvents]
		})
	}, [initialEvents])

	const { execute: createEvent, isPending: isCreating } = useServerAction(
		createCompetitionEventAction,
	)

	const [isAdding, setIsAdding] = useState(false)

	const { execute: removeWorkout } = useServerAction(
		removeWorkoutFromCompetitionAction,
	)

	const { execute: reorderEvents } = useServerAction(
		reorderCompetitionEventsAction,
	)

	// Sort events by trackOrder
	const sortedEvents = [...events].sort((a, b) => a.trackOrder - b.trackOrder)

	// Get existing workout IDs for filtering in AddEventDialog
	const existingWorkoutIds = new Set(events.map((e) => e.workoutId))

	const handleCreateEvent = async (data: {
		name: string
		scheme: WorkoutScheme
		scoreType?: ScoreType
		description?: string
		roundsToScore?: number
		tiebreakScheme?: TiebreakScheme
		secondaryScheme?: SecondaryScheme
		movementIds?: string[]
	}) => {
		const [result, error] = await createEvent({
			competitionId,
			organizingTeamId,
			name: data.name,
			scheme: data.scheme,
			scoreType: data.scoreType,
			description: data.description,
			roundsToScore: data.roundsToScore,
			tiebreakScheme: data.tiebreakScheme,
			secondaryScheme: data.secondaryScheme,
			movementIds: data.movementIds,
		})

		if (error) {
			toast.error(error.message || "Failed to create event")
			posthog.capture("competition_event_created_failed", {
				competition_id: competitionId,
				error_message: error.message,
			})
		} else if (result?.data) {
			toast.success(`Created "${data.name}"`)
			posthog.capture("competition_event_created", {
				competition_id: competitionId,
					event_id: result.data.trackWorkoutId,
				event_name: data.name,
				workout_scheme: data.scheme,
				is_remix: false,
			})
			setShowCreateDialog(false)
		}
	}

	const handleAddWorkout = async (workout: {
		id: string
		name: string
		description: string | null
		scheme: WorkoutScheme
		scoreType: ScoreType | null
		movements: Array<{ id: string; name: string; type: string }>
	}) => {
		setIsAdding(true)
		try {
			// Create as a remix of the existing workout
			const [result, error] = await createEvent({
				competitionId,
				organizingTeamId,
				name: workout.name,
				scheme: workout.scheme,
				scoreType: workout.scoreType,
				description: workout.description || undefined,
				sourceWorkoutId: workout.id, // Mark as remix
				movementIds: workout.movements.map((m) => m.id),
			})

			if (error) {
				toast.error(error.message || "Failed to add workout")
				posthog.capture("competition_event_created_failed", {
					competition_id: competitionId,
					error_message: error.message,
				})
			} else if (result?.data) {
				toast.success(`Added "${workout.name}" as a remix`)
				posthog.capture("competition_event_created", {
					competition_id: competitionId,
					event_id: result.data.trackWorkoutId,
					event_name: workout.name,
					workout_scheme: workout.scheme,
					is_remix: true,
					source_workout_id: workout.id,
				})
				setShowAddDialog(false)
			}
		} finally {
			setIsAdding(false)
		}
	}

	const handleRemove = async (trackWorkoutId: string) => {
		// Optimistically remove from state
		const eventToRemove = events.find((e) => e.id === trackWorkoutId)
		setEvents((prev) => prev.filter((e) => e.id !== trackWorkoutId))

		const [_result, error] = await removeWorkout({
			trackWorkoutId,
			organizingTeamId,
		})

		if (error) {
			toast.error(error.message || "Failed to remove event")
			// Revert - add it back
			if (eventToRemove) {
				setEvents((prev) => [...prev, eventToRemove])
			}
		} else {
			toast.success("Event removed")
		}
	}

	const handleDrop = async (sourceIndex: number, targetIndex: number) => {
		const newEvents = [...sortedEvents]
		const [movedItem] = newEvents.splice(sourceIndex, 1)
		if (movedItem) {
			newEvents.splice(targetIndex, 0, movedItem)

			// Update trackOrder values
			const updatedEvents = newEvents.map((event, index) => ({
				...event,
				trackOrder: index + 1,
			}))

			// Capture previous state before optimistic update
			const previousEvents = events

			setEvents(updatedEvents)

			// Persist to server
			const updates = updatedEvents.map((e) => ({
				trackWorkoutId: e.id,
				trackOrder: e.trackOrder,
			}))

			const [_result, error] = await reorderEvents({
				competitionId,
				organizingTeamId,
				updates,
			})

			if (error) {
				toast.error(error.message || "Failed to reorder events")
				// Revert to previous state instead of initialEvents
				setEvents(previousEvents)
			}
		}
	}

	return (
		<>
			<div className="flex justify-end">
				<div className="flex items-center gap-2">
					<Button variant="outline" onClick={() => setShowAddDialog(true)}>
						<Plus className="h-4 w-4 mr-2" />
						Add Existing
					</Button>
					<Button onClick={() => setShowCreateDialog(true)}>
						<Plus className="h-4 w-4 mr-2" />
						Create Event
					</Button>
				</div>
			</div>
			{events.length === 0 ? (
				<div className="text-center py-8">
					<p className="text-muted-foreground mb-4">
						No events added to this competition yet.
					</p>
					<div className="flex items-center justify-center gap-2">
						<Button variant="outline" onClick={() => setShowAddDialog(true)}>
							<Plus className="h-4 w-4 mr-2" />
							Add Existing Workout
						</Button>
						<Button onClick={() => setShowCreateDialog(true)}>
							<Plus className="h-4 w-4 mr-2" />
							Create New Event
						</Button>
					</div>
				</div>
			) : (
				<div className="space-y-2">
					{sortedEvents.map((event, index) => (
						<CompetitionEventRow
							key={event.id}
							event={event}
							index={index}
							instanceId={instanceId}
							competitionId={competitionId}
							organizingTeamId={organizingTeamId}
							divisions={divisions}
							divisionDescriptions={
								divisionDescriptionsByWorkout[event.workoutId] ?? []
							}
							sponsors={sponsors}
							onRemove={() => handleRemove(event.id)}
							onDrop={handleDrop}
						/>
					))}
				</div>
			)}

			<CreateEventDialog
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
				onCreateEvent={handleCreateEvent}
				isCreating={isCreating}
				movements={movements}
			/>

			<AddEventDialog
				open={showAddDialog}
				onOpenChange={setShowAddDialog}
				onAddWorkout={handleAddWorkout}
				isAdding={isAdding}
				teamId={organizingTeamId}
				existingWorkoutIds={existingWorkoutIds}
			/>
		</>
	)
}
