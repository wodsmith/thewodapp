import { Card, CardContent } from "@/components/ui/card"

interface ScheduleStatsProps {
	currentWeek: string
	totalScheduled: number
	unscheduledCount: number
}

const ScheduleStats = ({
	currentWeek,
	totalScheduled,
	unscheduledCount,
}: ScheduleStatsProps) => {
	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
			<Card>
				<CardContent className="p-4 text-center">
					<div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
						{currentWeek}
					</div>
					<div className="text-sm text-muted-foreground">Current Week</div>
				</CardContent>
			</Card>
			<Card>
				<CardContent className="p-4 text-center">
					<div className="text-2xl font-bold text-green-600 dark:text-green-400">
						{totalScheduled}
					</div>
					<div className="text-sm text-muted-foreground">Classes Scheduled</div>
				</CardContent>
			</Card>
			<Card>
				<CardContent className="p-4 text-center">
					<div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
						{unscheduledCount}
					</div>
					<div className="text-sm text-muted-foreground">Need Attention</div>
				</CardContent>
			</Card>
		</div>
	)
}

export default ScheduleStats
