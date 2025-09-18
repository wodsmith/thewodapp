import { format } from "date-fns"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ListItem } from "@/components/ui/list-item"
import type { WorkoutResultWithWorkoutName } from "@/types"

interface LogRowCardProps {
	logEntry: WorkoutResultWithWorkoutName
}

export function LogRowCard({ logEntry }: LogRowCardProps) {
	return (
		<ListItem>
			<ListItem.Content>
				<div className="flex flex-col gap-1">
					<h3 className="font-bold text-lg">
						{logEntry.workoutName || "Workout Result"}
					</h3>
					<p className="text-muted-foreground text-sm">
						{format(logEntry.date, "MMM d, yyyy")}
					</p>
					{logEntry.notes && (
						<p className="text-gray-600 text-sm">{logEntry.notes}</p>
					)}
				</div>
			</ListItem.Content>

			<div className="flex items-center gap-4">
				<ListItem.Meta>
					{logEntry.wodScore && (
						<Badge variant="secondary">{logEntry.wodScore}</Badge>
					)}
					{logEntry.time && <Badge variant="outline">{logEntry.time}</Badge>}
					{logEntry.setCount && logEntry.setCount > 1 && (
						<Badge variant="outline">Sets: {logEntry.setCount}</Badge>
					)}
					{/* Display custom scaling label if available, otherwise fall back to legacy scale */}
					{logEntry.scalingLevelLabel ? (
						<Badge
							variant={logEntry.asRx ? "default" : "secondary"}
							className="gap-1"
						>
							{logEntry.scalingLevelLabel}
							{logEntry.asRx && " (Rx)"}
						</Badge>
					) : logEntry.scale ? (
						<Badge variant={logEntry.scale}>
							{logEntry.scale.toUpperCase()}
						</Badge>
					) : null}
				</ListItem.Meta>

				<ListItem.Actions>
					<Button
						asChild
						variant="secondary"
						size="sm"
						className="flex items-center gap-2"
					>
						<Link
							href={{
								pathname: `/log/${logEntry.id}/edit`,
								query: {
									redirectUrl: "/log",
								},
							}}
						>
							Edit
						</Link>
					</Button>
					{logEntry.workoutId && (
						<Button asChild size="sm" variant="secondary">
							<Link href={`/workouts/${logEntry.workoutId}`}>View</Link>
						</Button>
					)}
				</ListItem.Actions>
			</div>
		</ListItem>
	)
}
