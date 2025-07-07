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

interface ScheduleSlot {
	class: string
	coach: string | null
	status: string
}

interface Schedule {
	[key: string]: ScheduleSlot
}

interface MasterScheduleProps {
	schedule: Schedule
	currentWeek: string
}

const MasterSchedule = ({ schedule, currentWeek }: MasterScheduleProps) => {
	// Convert schedule object to array and sort by day and time
	const scheduleArray = Object.entries(schedule).map(([key, slot]) => {
		const [day, time, location] = key.split("-")
		return {
			key,
			day,
			time,
			location,
			...slot,
		}
	})

	// Sort by day order and then by time
	const dayOrder = [
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday",
		"Sunday",
	]
	const sortedSchedule = scheduleArray.sort((a, b) => {
		const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day)
		if (dayDiff !== 0) return dayDiff

		// Convert time to comparable format for sorting
		const parseTime = (timeStr: string) => {
			const [time, period] = timeStr.split(" ")
			const [hours, minutes] = time.split(":").map(Number)
			const hour24 =
				period === "PM" && hours !== 12
					? hours + 12
					: period === "AM" && hours === 12
						? 0
						: hours
			return hour24 * 60 + (minutes || 0)
		}

		return parseTime(a.time) - parseTime(b.time)
	})

	const getStatusBadge = (status: string, coach: string | null) => {
		if (status === "unscheduled" || !coach) {
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
							{sortedSchedule.map((item) => (
								<TableRow key={item.key} className="hover:bg-slate-50/50">
									<TableCell className="font-medium">{item.day}</TableCell>
									<TableCell>
										<div className="flex items-center space-x-1">
											<Clock className="h-3 w-3 text-slate-500" />
											<span className="text-sm">{item.time}</span>
										</div>
									</TableCell>
									<TableCell>
										<div className="flex items-center space-x-1">
											<MapPin className="h-3 w-3 text-slate-500" />
											<span className="text-sm">{item.location}</span>
										</div>
									</TableCell>
									<TableCell>
										<Badge variant="outline" className="text-xs">
											{item.class}
										</Badge>
									</TableCell>
									<TableCell>
										{item.coach ? (
											<div className="flex items-center space-x-1">
												<User className="h-3 w-3 text-slate-500" />
												<span className="text-sm">{item.coach}</span>
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
									<TableCell>
										{getStatusBadge(item.status, item.coach)}
									</TableCell>
								</TableRow>
							))}
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
