"use client"

import { useMemo } from "react"
import { Badge } from "~/components/ui/badge"
import { cn } from "~/lib/utils"
import { getDefinedScalingLevels } from "~/utils/scaling-utils"

interface ScalingLevel {
	id: string
	label: string
	position: number
}

interface ScalingDescription {
	scalingLevelId: string
	description: string | null
}

interface WorkoutScalingDisplayProps {
	workoutDescription: string
	scalingLevels?: ScalingLevel[]
	scalingDescriptions?: ScalingDescription[]
	className?: string
	showToggle?: boolean // Whether to show the toggle controls
}

export function WorkoutScalingDisplay({
	workoutDescription,
	scalingLevels = [],
	scalingDescriptions = [],
	className,
	showToggle = true,
}: WorkoutScalingDisplayProps) {
	// Filter to only show levels that have descriptions defined
	const definedLevels = useMemo(
		() => getDefinedScalingLevels(scalingLevels, scalingDescriptions),
		[scalingLevels, scalingDescriptions],
	)

	// Sort levels by position (0 = hardest) - memoize to prevent recreating on every render
	const sortedLevels = useMemo(
		() => [...definedLevels].sort((a, b) => a.position - b.position),
		[definedLevels],
	)

	// If no defined scaling levels or not showing toggle, just show the workout description
	if (sortedLevels.length === 0 || !showToggle) {
		return (
			<div className={className}>
				<p className="whitespace-pre-wrap text-foreground text-lg dark:text-dark-foreground">
					{workoutDescription}
				</p>
				{/* Show a note if there are scaling levels but no descriptions */}
				{scalingLevels.length > 0 &&
					sortedLevels.length === 0 &&
					showToggle && (
						<div className="mt-4 rounded-lg bg-muted/50 p-3">
							<p className="text-sm text-muted-foreground">
								This workout has scaling options, but no descriptions have been
								defined yet.
							</p>
						</div>
					)}
			</div>
		)
	}

	// Show all scaling descriptions stacked vertically
	return (
		<div className={cn("space-y-6", className)}>
			{sortedLevels.map((level, _index) => {
				const description = scalingDescriptions.find(
					(desc) => desc.scalingLevelId === level.id,
				)

				// Use custom description if available, otherwise use base workout description
				const displayDescription =
					description?.description || workoutDescription

				return (
					<div key={level.id} className="space-y-2">
						<Badge variant="outline" className="font-mono">
							{level.label}
						</Badge>
						<p className="whitespace-pre-wrap text-foreground text-lg dark:text-dark-foreground">
							{displayDescription}
						</p>
					</div>
				)
			})}

			{/* If no custom descriptions exist for any level, show the base description */}
			{scalingDescriptions.length > 0 &&
				scalingDescriptions.every((desc) => !desc.description) && (
					<div className="pt-4 border-t-2 border-black">
						<p className="text-sm text-muted-foreground mb-2 italic">
							No scaling-specific descriptions available. Showing base workout:
						</p>
						<p className="whitespace-pre-wrap text-foreground text-lg dark:text-dark-foreground">
							{workoutDescription}
						</p>
					</div>
				)}
		</div>
	)
}
