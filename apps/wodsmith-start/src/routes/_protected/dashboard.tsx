import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { addDays, endOfDay, format, startOfDay, subDays } from "date-fns"
import {
	CalendarIcon,
	ChevronLeft,
	ChevronRight,
	Dumbbell,
	Plus,
} from "lucide-react"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover"
import { REDIRECT_AFTER_SIGN_IN } from "@/constants"
import {
	getScheduledWorkoutsFn,
	type ScheduledWorkoutWithDetails,
} from "@/server-fns/workout-fns"

export const Route = createFileRoute("/_protected/dashboard")({
	component: DashboardPage,
	beforeLoad: async ({ context }) => {
		if (!context.hasWorkoutTracking) {
			throw redirect({ to: "/compete" })
		}
	},
	loader: async ({ context }) => {
		const session = context.session
		const teamId = session?.teams?.[0]?.id
		const teamName = session?.teams?.[0]?.name || "Your Team"

		if (!teamId) {
			return { scheduledWorkouts: [], teamName, teamId: null }
		}

		// Get today's scheduled workouts
		const today = new Date()
		const startDate = startOfDay(today)
		const endDate = endOfDay(today)

		const result = await getScheduledWorkoutsFn({
			data: {
				teamId,
				startDate: startDate.toISOString(),
				endDate: endDate.toISOString(),
			},
		})

		return {
			scheduledWorkouts: result.scheduledWorkouts,
			teamName,
			teamId,
			initialDate: today.toISOString(),
		}
	},
})

function DashboardPage() {
	const {
		scheduledWorkouts: initialWorkouts,
		teamName,
		teamId,
		initialDate,
	} = Route.useLoaderData()
	const [selectedDate, setSelectedDate] = useState(
		initialDate ? new Date(initialDate) : new Date(),
	)
	const [scheduledWorkouts, setScheduledWorkouts] =
		useState<ScheduledWorkoutWithDetails[]>(initialWorkouts)
	const [isLoading, setIsLoading] = useState(false)

	// Fetch workouts when date changes
	const fetchWorkouts = async (date: Date) => {
		if (!teamId) return

		setIsLoading(true)
		try {
			const startDate = startOfDay(date)
			const endDate = endOfDay(date)

			const result = await getScheduledWorkoutsFn({
				data: {
					teamId,
					startDate: startDate.toISOString(),
					endDate: endDate.toISOString(),
				},
			})

			setScheduledWorkouts(result.scheduledWorkouts)
		} catch (error) {
			console.error("Failed to fetch scheduled workouts:", error)
		} finally {
			setIsLoading(false)
		}
	}

	const handleDateChange = (date: Date) => {
		setSelectedDate(date)
		fetchWorkouts(date)
	}

	const handlePrevious = () => {
		const newDate = subDays(selectedDate, 1)
		handleDateChange(newDate)
	}

	const handleNext = () => {
		const newDate = addDays(selectedDate, 1)
		handleDateChange(newDate)
	}

	const handleToday = () => {
		handleDateChange(new Date())
	}

	const isToday = useMemo(() => {
		const today = new Date()
		return (
			selectedDate.getDate() === today.getDate() &&
			selectedDate.getMonth() === today.getMonth() &&
			selectedDate.getFullYear() === today.getFullYear()
		)
	}, [selectedDate])

	if (!teamId) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="text-center py-12">
					<h1 className="text-2xl font-bold mb-4">Welcome to WODsmith</h1>
					<p className="text-muted-foreground mb-6">
						Please sign in to view your dashboard.
					</p>
					<Button asChild>
						<Link to="/sign-in" search={{ redirect: REDIRECT_AFTER_SIGN_IN }}>
							Sign In
						</Link>
					</Button>
				</div>
			</div>
		)
	}

	return (
		<div className="container mx-auto px-4 py-8">
			{/* Header */}
			<div className="mb-8">
				<h1 className="text-3xl font-bold mb-2">{teamName}</h1>
				<p className="text-muted-foreground">Team Dashboard</p>
			</div>

			{/* Date Navigation */}
			<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="icon"
						onClick={handlePrevious}
						aria-label="Previous day"
					>
						<ChevronLeft className="h-4 w-4" />
					</Button>

					<Button
						variant={isToday ? "default" : "outline"}
						onClick={handleToday}
					>
						Today
					</Button>

					<Popover>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								className="min-w-[200px] justify-center font-medium"
							>
								<CalendarIcon className="mr-2 h-4 w-4" />
								{format(selectedDate, "EEE, MMM d, yyyy")}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-0" align="center">
							<Calendar
								mode="single"
								selected={selectedDate}
								onSelect={(date) => {
									if (date) {
										handleDateChange(date)
									}
								}}
								className="rounded-md border p-3 [--cell-size:2.5rem]"
							/>
						</PopoverContent>
					</Popover>

					<Button
						variant="outline"
						size="icon"
						onClick={handleNext}
						aria-label="Next day"
					>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>

				<Button asChild>
					<Link to="/workouts" search={{ view: "row", q: "" }}>
						<Plus className="h-4 w-4 mr-2" />
						Browse Workouts
					</Link>
				</Button>
			</div>

			{/* Today's Workouts */}
			<section>
				<h2 className="text-2xl font-bold mb-6 pb-3 border-b-2 border-primary/20">
					{isToday ? "Today's" : format(selectedDate, "EEEE, MMMM d")} Workouts
				</h2>

				{isLoading ? (
					<div className="space-y-4">
						{[1, 2].map((i) => (
							<div
								key={i}
								className="border-2 border-border rounded-lg p-6 animate-pulse"
							>
								<div className="h-6 bg-muted rounded w-1/3 mb-4" />
								<div className="h-4 bg-muted rounded w-2/3" />
							</div>
						))}
					</div>
				) : scheduledWorkouts.length > 0 ? (
					<div className="space-y-4">
						{scheduledWorkouts.map((scheduled) => (
							<WorkoutCard key={scheduled.id} scheduled={scheduled} />
						))}
					</div>
				) : (
					<div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
						<Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
						<h3 className="text-lg font-semibold mb-2">
							No workouts scheduled
						</h3>
						<p className="text-muted-foreground mb-4">
							{isToday
								? "You don't have any workouts scheduled for today."
								: "No workouts scheduled for this day."}
						</p>
						<Button asChild variant="outline">
							<Link to="/workouts" search={{ view: "row", q: "" }}>
								Browse Workouts
							</Link>
						</Button>
					</div>
				)}
			</section>
		</div>
	)
}

function WorkoutCard({
	scheduled,
}: {
	scheduled: ScheduledWorkoutWithDetails
}) {
	const workout = scheduled.workout

	if (!workout) {
		return null
	}

	return (
		<div className="border-2 border-border rounded-lg p-6 bg-card">
			<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
				<div className="flex-1">
					<div className="flex items-center gap-2 mb-2">
						<h3 className="text-xl font-bold">{workout.name}</h3>
						<Badge variant="secondary">{workout.scheme.toUpperCase()}</Badge>
					</div>
					{workout.description && (
						<p className="text-muted-foreground whitespace-pre-wrap line-clamp-3">
							{workout.description}
						</p>
					)}
				</div>
				<div className="flex gap-2">
					<Button asChild variant="outline">
						<Link to="/workouts/$workoutId" params={{ workoutId: workout.id }}>
							View Details
						</Link>
					</Button>
					<Button asChild>
						<Link to="/log/new" search={{ workoutId: workout.id }}>
							Log Result
						</Link>
					</Button>
				</div>
			</div>
		</div>
	)
}
