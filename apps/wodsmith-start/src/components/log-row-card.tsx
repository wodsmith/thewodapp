import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ListItem } from "@/components/ui/list-item"
import { getScalingDisplayInfo } from "@/utils/scaling-display"

interface LogRowCardProps {
	logEntry: {
		id: string
		workoutId: string | null
		workoutName?: string | null
		date: Date
		displayScore?: string | null
		notes: string | null
		scalingLevelLabel?: string | null
		scalingLevelId?: string | null
		asRx: boolean
	}
}

export function LogRowCard({ logEntry }: LogRowCardProps) {
	const scalingInfo = getScalingDisplayInfo(logEntry)

	return (
		<ListItem>
			<ListItem.Content>
				<div className="flex flex-col gap-1">
					<h3 className="text-lg font-bold">
						{logEntry.workoutName || "Workout Result"}
					</h3>
					<p className="text-sm text-muted-foreground">
						{format(logEntry.date, "MMM d, yyyy")}
					</p>
					{logEntry.notes && (
						<p className="text-sm text-gray-600">{logEntry.notes}</p>
					)}
				</div>
			</ListItem.Content>

			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
				<ListItem.Meta showOnMobile={true}>
					{/* displayScore is pre-formatted by server using scoring library's decodeScore */}
					{logEntry.displayScore && (
						<Badge variant="secondary">{logEntry.displayScore}</Badge>
					)}
					{/* Display scaling information */}
					{scalingInfo && (
						<Badge variant={scalingInfo.variant} className="gap-1">
							{scalingInfo.label}
							{scalingInfo.showScaledSuffix && " (Scaled)"}
						</Badge>
					)}
				</ListItem.Meta>

				<ListItem.Actions>
					<Button
						asChild
						variant="secondary"
						size="sm"
						className="flex items-center gap-2"
					>
						<a href={`/log/${logEntry.id}/edit?redirectUrl=/log`}>Edit</a>
					</Button>
					{logEntry.workoutId && (
						<Button asChild size="sm" variant="secondary">
							<a href={`/workouts/${logEntry.workoutId}`}>View</a>
						</Button>
					)}
				</ListItem.Actions>
			</div>
		</ListItem>
	)
}
