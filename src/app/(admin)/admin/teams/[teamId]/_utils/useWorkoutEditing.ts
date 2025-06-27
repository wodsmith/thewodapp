import { getAllMovementsAction } from "@/actions/movement-actions"
import { getAllTagsAction } from "@/actions/tag-actions"
import { getWorkoutByIdAction } from "@/actions/workout-actions"
import { updateWorkoutAction } from "@/actions/workout-actions"
import type {
	Movement,
	Tag,
	WorkoutUpdate,
	WorkoutWithTagsAndMovements,
} from "@/types"
import { useCallback, useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "zsa-react"
import type { ScheduledWorkoutWithDetails } from "../_components/workout-selection"

interface UseWorkoutEditingProps {
	scheduledWorkouts: ScheduledWorkoutWithDetails[]
	loadScheduledWorkouts: () => void
}

interface SchedulingFormData {
	classTimes: string
	teamNotes: string
	scalingGuidance: string
}

export function useWorkoutEditing({
	scheduledWorkouts,
	loadScheduledWorkouts,
}: UseWorkoutEditingProps) {
	// State
	const [editingScheduled, setEditingScheduled] = useState<string | null>(null)
	const [editingWorkout, setEditingWorkout] =
		useState<WorkoutWithTagsAndMovements | null>(null)
	const [allMovements, setAllMovements] = useState<Movement[]>([])
	const [allTags, setAllTags] = useState<Tag[]>([])

	// Server actions
	const { execute: getWorkoutById, isPending: isLoadingWorkoutDetails } =
		useServerAction(getWorkoutByIdAction)
	const { execute: getAllMovements, isPending: isLoadingAllMovements } =
		useServerAction(getAllMovementsAction)
	const { execute: getAllTags, isPending: isLoadingAllTags } =
		useServerAction(getAllTagsAction)
	const { execute: updateWorkout } = useServerAction(updateWorkoutAction)

	// Handlers
	const handleEditScheduled = useCallback(
		async (
			scheduled: ScheduledWorkoutWithDetails,
			setFormData: (data: SchedulingFormData) => void,
		) => {
			setEditingScheduled(scheduled.id)
			setFormData({
				teamNotes: scheduled.teamSpecificNotes || "",
				scalingGuidance: scheduled.scalingGuidanceForDay || "",
				classTimes: scheduled.classTimes || "",
			})

			if (!scheduled.trackWorkout || !scheduled) {
				toast.error("No workout details available for this scheduled workout.")
				return
			}

			const workoutId = scheduled.trackWorkout?.workout?.id || scheduled.id

			if (workoutId) {
				const [workoutResult, movementsResult, tagsResult] = await Promise.all([
					getWorkoutById({ id: workoutId }),
					allMovements.length === 0
						? getAllMovements()
						: Promise.resolve([null, null]),
					allTags.length === 0 ? getAllTags() : Promise.resolve([null, null]),
				])

				const [workoutData, workoutError] = workoutResult
				if (workoutError || !workoutData?.success) {
					toast.error("Failed to load workout details.")
					setEditingScheduled(null)
					return
				}
				setEditingWorkout(workoutData.data)

				const [movementsData, movementsError] = movementsResult
				if (movementsData) {
					if (movementsError || !movementsData.success) {
						toast.error("Failed to load movements.")
					} else {
						setAllMovements(movementsData.data)
					}
				}

				const [tagsData, tagsError] = tagsResult
				if (tagsData) {
					if (tagsError || !tagsData.success) {
						toast.error("Failed to load tags.")
					} else {
						setAllTags(tagsData.data)
					}
				}
			}
		},
		[
			getWorkoutById,
			getAllMovements,
			getAllTags,
			allMovements.length,
			allTags.length,
		],
	)

	const handleUpdateWorkout = useCallback(
		async (data: {
			id: string
			workout: WorkoutUpdate
			tagIds: string[]
			movementIds: string[]
		}) => {
			const [result, error] = await updateWorkout(data)

			if (error || !result?.success) {
				toast.error("Failed to update workout.")
				return false
			}
			toast.success("Workout updated successfully!")
			await loadScheduledWorkouts()
			return true
		},
		[updateWorkout, loadScheduledWorkouts],
	)

	const handleCancelEdit = useCallback(() => {
		setEditingScheduled(null)
		setEditingWorkout(null)
	}, [])

	// Computed values
	const scheduledWorkoutToEdit = editingScheduled
		? scheduledWorkouts.find((w) => w.id === editingScheduled)
		: null

	return {
		// State
		editingScheduled,
		editingWorkout,
		allMovements,
		allTags,
		scheduledWorkoutToEdit,
		// Loading states
		isLoadingWorkoutDetails,
		isLoadingAllMovements,
		isLoadingAllTags,
		// Handlers
		handleEditScheduled,
		handleUpdateWorkout,
		handleCancelEdit,
	}
}
