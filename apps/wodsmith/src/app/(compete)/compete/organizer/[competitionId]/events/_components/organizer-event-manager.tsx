"use client"

import { Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "@repo/zsa-react"
import { useRouter } from "next/navigation"
import {
	addWorkoutToCompetitionAction,
	reorderCompetitionEventsAction,
	removeWorkoutFromCompetitionAction,
} from "@/actions/competition-actions"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import type { CompetitionWorkout } from "@/server/competition-workouts"
import { AddEventDialog } from "./add-event-dialog"
import { CompetitionEventRow } from "./competition-event-row"

interface OrganizerEventManagerProps {
	competitionId: string
	organizingTeamId: string
	events: CompetitionWorkout[]
	availableWorkouts: Array<{
		id: string
		name: string
		description: string | null
		scheme: string
		scoreType: string | null
		tags: Array<{ id: string; name: string }>
		movements: Array<{ id: string; name: string; type: string }>
	}>
}

export function OrganizerEventManager({
	competitionId,
	organizingTeamId,
	events: initialEvents,
	availableWorkouts,
}: OrganizerEventManagerProps) {
	const router = useRouter()
	const [events, setEvents] = useState(initialEvents)
	const [showAddDialog, setShowAddDialog] = useState(false)
	const [instanceId] = useState(() => Symbol("competition-events"))

	// Sync props to state when server data changes
	useEffect(() => {
		setEvents(initialEvents)
	}, [initialEvents])

	const { execute: addWorkout, isPending: isAdding } = useServerAction(
		addWorkoutToCompetitionAction,
	)

	const { execute: removeWorkout } = useServerAction(
		removeWorkoutFromCompetitionAction,
	)

	const { execute: reorderEvents } = useServerAction(
		reorderCompetitionEventsAction,
	)

	// Sort events by trackOrder
	const sortedEvents = [...events].sort((a, b) => a.trackOrder - b.trackOrder)

	const handleAddWorkout = async (workoutId: string) => {
		const workout = availableWorkouts.find((w) => w.id === workoutId)
		if (!workout) {
			toast.error("Workout not found")
			return
		}

		const [result, error] = await addWorkout({
			competitionId,
			organizingTeamId,
			workoutId,
		})

		if (error) {
			toast.error(error.message || "Failed to add workout")
		} else if (result?.data) {
			toast.success(`Added "${workout.name}" to competition`)
			// Optimistically add the event
			const newEvent: CompetitionWorkout = {
				id: result.data.trackWorkoutId,
				trackId: "",
				workoutId,
				trackOrder: events.length + 1,
				notes: null,
				pointsMultiplier: 100,
				createdAt: new Date(),
				updatedAt: new Date(),
				workout: {
					id: workout.id,
					name: workout.name,
					description: workout.description,
					scheme: workout.scheme,
					scoreType: workout.scoreType,
				},
			}
			setEvents((prev) => [...prev, newEvent])
			setShowAddDialog(false)
		}
	}

	const handleRemove = async (trackWorkoutId: string) => {
		const [_result, error] = await removeWorkout({
			trackWorkoutId,
			organizingTeamId,
		})

		if (error) {
			toast.error(error.message || "Failed to remove event")
		} else {
			toast.success("Event removed")
			setEvents((prev) => prev.filter((e) => e.id !== trackWorkoutId))
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
				// Revert
				setEvents(initialEvents)
			}
		}
	}

	// Filter out workouts that are already in the competition
	const existingWorkoutIds = new Set(events.map((e) => e.workoutId))
	const filteredAvailableWorkouts = availableWorkouts.filter(
		(w) => !existingWorkoutIds.has(w.id),
	)

	return (
		<>
			<div className="flex justify-end">
				<Button onClick={() => setShowAddDialog(true)}>
					<Plus className="h-4 w-4 mr-2" />
					Add Event
				</Button>
			</div>
			{events.length === 0 ? (
				<div className="text-center py-8">
					<p className="text-muted-foreground mb-4">
						No events added to this competition yet.
					</p>
					<Button onClick={() => setShowAddDialog(true)} variant="outline">
						<Plus className="h-4 w-4 mr-2" />
						Add First Event
					</Button>
				</div>
			) : (
				<div className="space-y-2">
					{sortedEvents.map((event, index) => (
						<CompetitionEventRow
							key={event.id}
							event={event}
							index={index}
							instanceId={instanceId}
							onRemove={() => handleRemove(event.id)}
							onDrop={handleDrop}
						/>
					))}
				</div>
			)}

			<AddEventDialog
				open={showAddDialog}
				onOpenChange={setShowAddDialog}
				availableWorkouts={filteredAvailableWorkouts}
				onAddWorkout={handleAddWorkout}
				isAdding={isAdding}
			/>
		</>
	)
}
