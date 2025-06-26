import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ListItem } from "@/components/ui/list-item"
import type { WorkoutResultWithWorkoutName } from "@/types"
import Link from "next/link"

interface LogRowCardProps {
	logEntry: WorkoutResultWithWorkoutName
}

export function LogRowCard({ logEntry }: LogRowCardProps) {
	return (
		<ListItem key={logEntry.id}>
			<ListItem.Content>
				<div className="flex flex-col gap-1">
					<h3 className="font-bold text-lg">
						{logEntry.workoutName || "Workout Result"}
					</h3>
					<p className="text-muted-foreground text-sm">
						{new Date(logEntry.date).toLocaleDateString()}
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
					{logEntry.scale && (
						<Badge variant={logEntry.scale}>
							{logEntry.scale.toUpperCase()}
						</Badge>
					)}
				</ListItem.Meta>

				<ListItem.Actions>
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
