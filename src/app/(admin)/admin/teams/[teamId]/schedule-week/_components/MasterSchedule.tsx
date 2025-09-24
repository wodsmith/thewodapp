import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Clock, MapPin, User, AlertTriangle } from "lucide-react"
import type { Location } from "@/db/schemas/scheduling"
import type { getCoachesByTeam } from "@/actions/coach-actions"
import type { getScheduledClassesForDisplay } from "@/server/ai/scheduler"
import { format } from "date-fns"

// Type for coaches with relations - extract from ZSA response success case
type CoachWithRelations = NonNullable<
	NonNullable<Awaited<ReturnType<typeof getCoachesByTeam>>[0]>["data"]
>[number]

// Type for scheduled classes with relations
type ScheduledClassWithRelations = Awaited<
	ReturnType<typeof getScheduledClassesForDisplay>
>[number]

interface MasterScheduleProps {
	scheduledClasses: ScheduledClassWithRelations[]
	currentWeek: string
	coaches: CoachWithRelations[]
	locations: Location[]
}

const MasterSchedule = ({
	scheduledClasses,
	currentWeek,
	coaches,
	locations,
}: MasterScheduleProps) => {
	// Sort schedule by day and time
	const sortedSchedule = [...scheduledClasses].sort((a, b) => {
		const dateA = new Date(a.startTime)
		const dateB = new Date(b.startTime)
		return dateA.getTime() - dateB.getTime()
	})

	const getStatusBadge = (scheduledClass: ScheduledClassWithRelations) => {
		if (!scheduledClass.coachId) {
			return (
				<Badge variant="destructive" className="text-xs">
					Unassigned
				</Badge>
			)
		}
		return (
			<Badge variant="default" className="text-xs bg-green-600">
				Scheduled
			</Badge>
		)
	}

	const getCoachName = (coachId: string | null) => {
		if (!coachId) return null
		const coach = coaches.find((c) => c.id === coachId)
		const firstName = coach?.user?.firstName
		const lastName = coach?.user?.lastName
		const name =
			firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName
		return name || coach?.user?.email || "Unknown Coach"
	}

	const getLocationName = (locationId: string) => {
		const location = locations.find((l) => l.id === locationId)
		return location?.name || "Unknown Location"
	}

	return (
		<Card className="bg-white/60 backdrop-blur-sm border-white/20">
			<CardHeader>
				<CardTitle className="flex items-center space-x-2">
					<Clock className="h-5 w-5" />
					<span>Master Schedule</span>
				</CardTitle>
				<p className="text-sm text-slate-600">
					Complete overview for {currentWeek}
				</p>
			</CardHeader>
			<CardContent>
				<div className="overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="font-semibold">Day</TableHead>
								<TableHead className="font-semibold">Time</TableHead>
								<TableHead className="font-semibold">Location</TableHead>
								<TableHead className="font-semibold">Class</TableHead>
								<TableHead className="font-semibold">Coach</TableHead>
								<TableHead className="font-semibold">Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{sortedSchedule.map((scheduledClass) => {
								const classDate = new Date(scheduledClass.startTime)
								const dayName = format(classDate, "EEEE")
								const timeStr = format(classDate, "h:mm a")
								const coachName = getCoachName(scheduledClass.coachId)

								return (
									<TableRow
										key={scheduledClass.id}
										className="hover:bg-slate-50/50"
									>
										<TableCell className="font-medium">{dayName}</TableCell>
										<TableCell>
											<div className="flex items-center space-x-1">
												<Clock className="h-3 w-3 text-slate-500" />
												<span className="text-sm">{timeStr}</span>
											</div>
										</TableCell>
										<TableCell>
											<div className="flex items-center space-x-1">
												<MapPin className="h-3 w-3 text-slate-500" />
												<span className="text-sm">
													{getLocationName(scheduledClass.locationId)}
												</span>
											</div>
										</TableCell>
										<TableCell>
											<Badge variant="outline" className="text-xs">
												{scheduledClass.classCatalog?.name || "Class"}
											</Badge>
										</TableCell>
										<TableCell>
											{coachName ? (
												<div className="flex items-center space-x-1">
													<User className="h-3 w-3 text-slate-500" />
													<span className="text-sm">{coachName}</span>
												</div>
											) : (
												<div className="flex items-center space-x-1 text-orange-600">
													<AlertTriangle className="h-3 w-3" />
													<span className="text-sm font-medium">
														Needs Assignment
													</span>
												</div>
											)}
										</TableCell>
										<TableCell>{getStatusBadge(scheduledClass)}</TableCell>
									</TableRow>
								)
							})}
						</TableBody>
					</Table>
				</div>

				{sortedSchedule.length === 0 && (
					<div className="text-center py-8 text-slate-500">
						<Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
						<p>No classes scheduled for this week</p>
					</div>
				)}
			</CardContent>
		</Card>
	)
}

export default MasterSchedule
