"use client"

import { ArrowLeft, CalendarIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "@repo/zsa-react"
import { scheduleStandaloneWorkoutAction } from "@/actions/workout-actions"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import type { TeamMembership } from "@/db/schema"

interface ScheduleWorkoutClientProps {
	workout: {
		id: string
		name: string
		description: string
	}
	workoutId: string
	teamId: string
	teamsWithProgrammingPermission: (TeamMembership & {
		team: { id: string; name: string; isPersonalTeam: number } | null
	})[]
}

export default function ScheduleWorkoutClient({
	workout,
	workoutId,
	teamId,
	teamsWithProgrammingPermission,
}: ScheduleWorkoutClientProps) {
	const [selectedDate, setSelectedDate] = useState<Date | undefined>()
	const [selectedTeamId, setSelectedTeamId] = useState<string>(
		teamsWithProgrammingPermission.length > 0
			? teamsWithProgrammingPermission[0]?.teamId || teamId
			: teamId,
	)
	const router = useRouter()

	const { execute: scheduleWorkout, isPending } = useServerAction(
		scheduleStandaloneWorkoutAction,
		{
			onError: (error) => {
				console.error("Failed to schedule workout:", error)
				toast.error(
					error.err?.message || "An error occurred scheduling the workout",
				)
			},
			onSuccess: () => {
				toast.success("Workout scheduled successfully")
				router.push(`/workouts/${workoutId}`)
			},
		},
	)

	const handleSchedule = async () => {
		if (!selectedDate) {
			toast.error("Please select a date")
			return
		}

		await scheduleWorkout({
			teamId: selectedTeamId,
			workoutId,
			scheduledDate: selectedDate,
		})
	}

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Button asChild variant="outline" size="icon">
						<Link href={`/workouts/${workoutId}`}>
							<ArrowLeft className="h-5 w-5" />
						</Link>
					</Button>
					<h1>SCHEDULE WORKOUT</h1>
				</div>
			</div>

			<div className="border-2 border-black p-6">
				<div className="mb-6">
					<h2 className="mb-2 font-bold text-lg">{workout.name}</h2>
					<p className="text-muted-foreground">{workout.description}</p>
				</div>

				<div className="space-y-6">
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<label
								htmlFor="date-picker"
								className="mb-2 block font-bold uppercase"
							>
								Select Date
							</label>
							<Popover>
								<PopoverTrigger asChild>
									<Button
										id="date-picker"
										variant="outline"
										className={cn(
											"w-full justify-start text-left font-normal",
											!selectedDate && "text-muted-foreground",
										)}
									>
										<CalendarIcon className="mr-2 h-4 w-4" />
										{selectedDate ? (
											format(selectedDate, "PPP")
										) : (
											<span>Pick a date</span>
										)}
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0" align="start">
									<Calendar
										mode="single"
										selected={selectedDate}
										onSelect={setSelectedDate}
										className="border"
									/>
								</PopoverContent>
							</Popover>
						</div>

						{teamsWithProgrammingPermission.length > 1 && (
							<div>
								<label
									htmlFor="team-select"
									className="mb-2 block font-bold uppercase"
								>
									Schedule for Team
								</label>
								<Select
									onValueChange={setSelectedTeamId}
									value={selectedTeamId}
								>
									<SelectTrigger
										id="team-select"
										className="w-full justify-start text-left font-normal h-10"
									>
										<SelectValue placeholder="Select team" />
									</SelectTrigger>
									<SelectContent>
										{teamsWithProgrammingPermission.map((membership) => (
											<SelectItem
												key={membership.teamId}
												value={membership.teamId}
											>
												{membership.team?.name || membership.teamId}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						)}
					</div>

					<div className="flex justify-end gap-4">
						<Button asChild variant="outline">
							<Link href={`/workouts/${workoutId}`}>Cancel</Link>
						</Button>
						<Button onClick={handleSchedule} disabled={isPending}>
							{isPending ? "Scheduling..." : "Schedule Workout"}
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}
