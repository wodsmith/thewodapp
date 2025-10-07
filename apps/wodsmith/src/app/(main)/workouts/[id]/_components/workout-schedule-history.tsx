import { Calendar, Shuffle, Users } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"

interface WorkoutScheduleHistoryProps {
	scheduleHistory: Array<{
		id: string
		scheduledDate: Date
		teamId: string
		teamName: string
		workoutId: string
		workoutName: string
		isRemix: boolean
	}>
}

export function WorkoutScheduleHistory({
	scheduleHistory,
}: WorkoutScheduleHistoryProps) {
	if (!scheduleHistory || scheduleHistory.length === 0) {
		return null
	}

	const formatDate = (date: Date) => {
		return new Date(date).toLocaleDateString("en-US", {
			weekday: "short",
			year: "numeric",
			month: "short",
			day: "numeric",
		})
	}

	// Group schedule history by month/year
	const groupedHistory = scheduleHistory.reduce(
		(acc, item) => {
			const monthYear = new Date(item.scheduledDate).toLocaleDateString(
				"en-US",
				{
					year: "numeric",
					month: "long",
				},
			)
			if (!acc[monthYear]) {
				acc[monthYear] = []
			}
			acc[monthYear].push(item)
			return acc
		},
		{} as Record<string, typeof scheduleHistory>,
	)

	return (
		<div className="mt-8 border-2 border-black dark:border-dark-border">
			<div className="border-black border-b-2 p-6 dark:border-dark-border">
				<div className="flex items-center gap-2 mb-4">
					<Calendar className="h-5 w-5" />
					<h2>SCHEDULE HISTORY</h2>
				</div>
				<p className="text-gray-600 dark:text-dark-muted-foreground mb-6">
					When this workout has been scheduled for your teams
				</p>

				<div className="space-y-6">
					{Object.entries(groupedHistory).map(([monthYear, items]) => (
						<div key={monthYear}>
							<h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
								{monthYear}
							</h3>
							<div className="overflow-x-auto">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Date</TableHead>
											<TableHead>Team</TableHead>
											<TableHead>Workout</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{items.map((item) => (
											<TableRow key={item.id}>
												<TableCell className="font-medium">
													{formatDate(item.scheduledDate)}
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-2">
														<Users className="h-4 w-4 text-gray-500" />
														<span>{item.teamName}</span>
													</div>
												</TableCell>
												<TableCell>
													{item.isRemix ? (
														<div className="flex items-center gap-2">
															<Shuffle className="h-4 w-4 text-orange-500" />
															<Link
																href={`/workouts/${item.workoutId}`}
																className="text-orange-600 dark:text-orange-400 hover:underline"
															>
																{item.workoutName}
															</Link>
															<Badge
																variant="outline"
																className="text-xs text-orange-600 border-orange-600 dark:text-orange-400 dark:border-orange-400"
															>
																Remix
															</Badge>
														</div>
													) : (
														<span>{item.workoutName}</span>
													)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
