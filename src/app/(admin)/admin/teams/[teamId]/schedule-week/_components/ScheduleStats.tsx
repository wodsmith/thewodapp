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
		<div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
			<Card>
				<CardContent className="p-4 text-center">
					<div className="text-2xl font-bold text-primary">{currentWeek}</div>
					<div className="text-sm text-muted-foreground">Current Week</div>
				</CardContent>
			</Card>
			<Card>
				<CardContent className="p-4 text-center">
					<div className="text-2xl font-bold text-green-600">
						{totalScheduled}
					</div>
					<div className="text-sm text-muted-foreground">Classes Scheduled</div>
				</CardContent>
			</Card>
			<Card>
				<CardContent className="p-4 text-center">
					<div className="text-2xl font-bold text-primary">
						{unscheduledCount}
					</div>
					<div className="text-sm text-muted-foreground">Need Attention</div>
				</CardContent>
			</Card>
		</div>
	)
}

export default ScheduleStats
