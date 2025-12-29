import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import type { LaneShiftPattern } from "@/db/schemas/volunteers"

/** Per-event defaults for judge rotations */
interface EventDefaults {
	defaultHeatsCount: number | null
	defaultLaneShiftPattern: LaneShiftPattern | null
	minHeatBuffer: number | null
}

interface JudgeSchedulingContainerProps {
	competitionId: string
	organizingTeamId: string
	events: unknown[]
	heats: unknown[]
	judges: unknown[]
	judgeAssignments: unknown[]
	rotations: unknown[]
	eventDefaultsMap: Map<string, EventDefaults>
	versionHistoryMap: Map<string, unknown[]>
	activeVersionMap: Map<string, unknown | null>
	competitionDefaultHeats: number
	competitionDefaultPattern: LaneShiftPattern
}

/**
 * Placeholder for judge scheduling container.
 * The full implementation with drag-and-drop, rotations, and version management
 * will be ported in a future update.
 */
export function JudgeSchedulingContainer({
	events,
	judges,
}: JudgeSchedulingContainerProps) {
	if (events.length === 0) {
		return (
			<div className="py-12 text-center">
				<p className="text-muted-foreground">
					No events have been added to this competition yet.
				</p>
				<p className="mt-2 text-sm text-muted-foreground">
					Add events in the Programming section before scheduling judges.
				</p>
			</div>
		)
	}

	return (
		<section className="space-y-8">
			<div>
				<h2 className="text-xl font-semibold">Judging Schedule</h2>
				<p className="text-sm text-muted-foreground">
					Manage judge assignments with manual or rotation-based scheduling
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Judge Scheduling</CardTitle>
					<CardDescription>
						{judges.length} judges available across {events.length} events
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="py-8 text-center">
						<p className="text-muted-foreground">
							Full judge scheduling with drag-and-drop, rotations, and version
							management is coming soon.
						</p>
						<p className="mt-2 text-sm text-muted-foreground">
							For now, you can manage judge roles in the Volunteers section
							above.
						</p>
					</div>
				</CardContent>
			</Card>
		</section>
	)
}
