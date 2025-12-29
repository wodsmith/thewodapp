import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import { ArrowLeft, Dumbbell, ListChecks } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import WorkoutRowCard from "@/components/workout-row-card"
import {
	getMovementByIdFn,
	getWorkoutsByMovementIdFn,
} from "@/server-fns/movement-fns"

export const Route = createFileRoute("/_protected/movements/$id/")({
	component: MovementDetailPage,
	loader: async ({ params }) => {
		const [movementResult, workoutsResult] = await Promise.all([
			getMovementByIdFn({ data: { id: params.id } }),
			getWorkoutsByMovementIdFn({ data: { movementId: params.id } }),
		])

		if (!movementResult.movement) {
			throw notFound()
		}

		return {
			movement: movementResult.movement,
			workouts: workoutsResult.workouts,
		}
	},
	notFoundComponent: MovementNotFound,
})

function MovementNotFound() {
	return (
		<div className="container mx-auto px-4 py-8">
			<div className="text-center py-12">
				<Dumbbell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
				<h1 className="text-2xl font-bold mb-4">Movement Not Found</h1>
				<p className="text-muted-foreground mb-6">
					The movement you're looking for doesn't exist or has been removed.
				</p>
				<Button asChild>
					<Link to="/workouts" search={{ view: "row", q: "" }}>
						Back to Workouts
					</Link>
				</Button>
			</div>
		</div>
	)
}

function MovementDetailPage() {
	const { movement, workouts } = Route.useLoaderData()

	// Format movement type for display
	const typeLabels: Record<string, string> = {
		weightlifting: "Weightlifting",
		gymnastic: "Gymnastic",
		monostructural: "Monostructural",
	}

	return (
		<div className="container mx-auto px-4 py-8">
			{/* Header with back button */}
			<div className="mb-6 flex items-center gap-3">
				<Button variant="outline" size="icon" asChild>
					<Link to="/workouts" search={{ view: "row", q: "" }}>
						<ArrowLeft className="h-5 w-5" />
					</Link>
				</Button>
				<div className="flex items-center gap-3">
					<Dumbbell className="h-7 w-7" />
					<h1 className="text-3xl font-bold">{movement.name.toUpperCase()}</h1>
				</div>
			</div>

			{/* Movement Details Card */}
			<div className="border-2 border-border rounded-lg mb-8">
				<div className="p-6">
					<div className="flex items-center gap-4">
						<div>
							<span className="text-sm font-medium text-muted-foreground">
								TYPE
							</span>
							<div className="mt-1">
								<Badge variant="outline" className="text-base">
									{typeLabels[movement.type] || movement.type}
								</Badge>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Workouts Section */}
			<section>
				<div className="mb-4 flex items-center gap-2">
					<ListChecks className="h-6 w-6" />
					<h2 className="font-semibold text-2xl">
						Workouts with this Movement
					</h2>
				</div>

				{workouts.length > 0 ? (
					<div className="space-y-4">
						{workouts.map((workout) => (
							<WorkoutRowCard key={workout.id} workout={workout} />
						))}
					</div>
				) : (
					<div className="border-2 border-border rounded-lg p-6">
						<p className="text-muted-foreground text-center">
							No workouts are currently using this movement.
						</p>
					</div>
				)}
			</section>
		</div>
	)
}
