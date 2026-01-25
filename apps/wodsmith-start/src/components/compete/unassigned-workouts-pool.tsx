"use client"

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine"
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview"
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview"
import { GripVertical } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

interface WorkoutWithType {
	id: string
	workoutId: string
	name: string
	workoutType: string
	trackOrder: number
}

interface UnassignedWorkoutsPoolProps {
	workouts: WorkoutWithType[]
	assignedWorkoutIds: Set<string>
	instanceId: symbol
}

function WorkoutPoolCard({
	workout,
	instanceId,
}: {
	workout: WorkoutWithType
	instanceId: symbol
}) {
	const ref = useRef<HTMLDivElement>(null)
	const dragHandleRef = useRef<HTMLButtonElement>(null)
	const [isDragging, setIsDragging] = useState(false)

	useEffect(() => {
		const element = ref.current
		const dragHandle = dragHandleRef.current
		if (!element || !dragHandle) return

		const itemData = {
			type: "workout-pool",
			workoutId: workout.id,
			trackWorkoutId: workout.id, // For drop target compatibility
			name: workout.name,
			instanceId,
		}

		return combine(
			draggable({
				element: dragHandle,
				getInitialData: () => itemData,
				onDragStart: () => setIsDragging(true),
				onDrop: () => setIsDragging(false),
				onGenerateDragPreview({ nativeSetDragImage }) {
					setCustomNativeDragPreview({
						nativeSetDragImage,
						getOffset: pointerOutsideOfPreview({ x: "16px", y: "8px" }),
						render({ container }) {
							const preview = document.createElement("div")
							preview.style.cssText = `
								background: hsl(var(--background));
								border: 2px solid hsl(var(--border));
								border-radius: 6px;
								padding: 12px;
								font-size: 14px;
								color: hsl(var(--foreground));
								box-shadow: 0 4px 12px rgba(0,0,0,0.15);
								min-width: 200px;
							`
							preview.innerHTML = `
								<div style="font-weight: 600; margin-bottom: 4px;">${workout.name}</div>
								<div style="font-size: 12px; color: hsl(var(--muted-foreground));">${workout.workoutType}</div>
							`
							container.appendChild(preview)
						},
					})
				},
			}),
		)
	}, [workout.id, workout.name, workout.workoutType, instanceId])

	return (
		<Card
			ref={ref}
			className={`transition-opacity ${isDragging ? "opacity-50" : ""}`}
		>
			<CardContent className="p-3">
				<div className="flex items-center gap-3">
					<button
						ref={dragHandleRef}
						type="button"
						aria-label={`Drag ${workout.name} to assign`}
						className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
					>
						<GripVertical className="h-5 w-5" />
					</button>
					<div className="flex-1 min-w-0">
						<div className="font-medium text-sm truncate">{workout.name}</div>
						<div className="flex items-center gap-2 mt-1">
							<Badge variant="secondary" className="text-xs">
								{workout.workoutType}
							</Badge>
							<span className="text-xs text-muted-foreground">
								Event #{workout.trackOrder}
							</span>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

export function UnassignedWorkoutsPool({
	workouts,
	assignedWorkoutIds,
	instanceId,
}: UnassignedWorkoutsPoolProps) {
	const unassignedWorkouts = workouts.filter(
		(workout) => !assignedWorkoutIds.has(workout.id),
	)

	if (unassignedWorkouts.length === 0) {
		return (
			<div className="text-center py-8 text-muted-foreground">
				<p>All workouts have been assigned to submission windows</p>
			</div>
		)
	}

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between mb-3">
				<h3 className="text-sm font-semibold">Unassigned Workouts</h3>
				<span className="text-xs text-muted-foreground">
					{unassignedWorkouts.length} workout
					{unassignedWorkouts.length !== 1 ? "s" : ""}
				</span>
			</div>
			<div className="space-y-2">
				{unassignedWorkouts.map((workout) => (
					<WorkoutPoolCard
						key={workout.id}
						workout={workout}
						instanceId={instanceId}
					/>
				))}
			</div>
		</div>
	)
}
