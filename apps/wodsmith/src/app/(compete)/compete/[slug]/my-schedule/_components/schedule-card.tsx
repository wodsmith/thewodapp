"use client"

import { Badge } from "@/components/ui/badge"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import type { CompetitionJudgeRotation } from "@/db/schema"
import { LANE_SHIFT_PATTERN } from "@/db/schema"

interface ScheduleCardProps {
	rotation: CompetitionJudgeRotation
	eventName: string
	timeWindow: string | null
	isUpcoming: boolean
}

/**
 * Displays a single judge rotation assignment
 * Shows event name, time, lanes, heats, and notes
 */
export function ScheduleCard({
	rotation,
	eventName,
	timeWindow,
	isUpcoming,
}: ScheduleCardProps) {
	// Calculate heats range
	const endHeat = rotation.startingHeat + rotation.heatsCount - 1
	const heatsRange =
		rotation.heatsCount === 1
			? `Heat ${rotation.startingHeat}`
			: `Heats ${rotation.startingHeat}-${endHeat}`

	// Calculate lane pattern description
	const lanePattern = formatLanePattern(rotation)

	return (
		<Card className={isUpcoming ? "border-primary/50" : undefined}>
			<CardHeader>
				<div className="flex items-start justify-between">
					<div>
						<CardTitle>{eventName}</CardTitle>
						{timeWindow && (
							<CardDescription className="text-base font-medium mt-1">
								{timeWindow}
							</CardDescription>
						)}
					</div>
					{isUpcoming && <Badge variant="default">Upcoming</Badge>}
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="grid gap-3 sm:grid-cols-2">
					<div>
						<p className="text-sm font-medium text-muted-foreground">Heats</p>
						<p className="text-base">{heatsRange}</p>
					</div>
					<div>
						<p className="text-sm font-medium text-muted-foreground">
							Lane Assignment
						</p>
						<p className="text-base">{lanePattern}</p>
					</div>
				</div>

				{rotation.notes && (
					<div className="bg-muted rounded-md p-3">
						<p className="text-sm font-medium text-muted-foreground mb-1">
							Notes from Organizer
						</p>
						<p className="text-sm">{rotation.notes}</p>
					</div>
				)}
			</CardContent>
		</Card>
	)
}

/**
 * Format lane pattern description
 */
function formatLanePattern(rotation: CompetitionJudgeRotation): string {
	const { startingLane, laneShiftPattern, heatsCount } = rotation

	switch (laneShiftPattern) {
		case LANE_SHIFT_PATTERN.STAY:
			return `Lane ${startingLane} (stay)`

		case LANE_SHIFT_PATTERN.SHIFT_RIGHT: {
			const endLane = startingLane + heatsCount - 1
			return `Lanes ${startingLane}→${endLane} (shift)`
		}

		default:
			return `Lane ${startingLane}`
	}
}
