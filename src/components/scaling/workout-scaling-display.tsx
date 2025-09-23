"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

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
	// Sort levels by position (0 = hardest) - memoize to prevent recreating on every render
	const sortedLevels = useMemo(
		() => [...scalingLevels].sort((a, b) => a.position - b.position),
		[scalingLevels],
	)

	// If no scaling levels, just show the workout description
	if (sortedLevels.length === 0 || !showToggle) {
		return (
			<div className={className}>
				<p className="whitespace-pre-wrap text-foreground text-lg dark:text-dark-foreground">
					{workoutDescription}
				</p>
			</div>
		)
	}

	// Show all scaling descriptions stacked vertically
	return (
		<div className={cn("space-y-6", className)}>
			{sortedLevels.map((level, index) => {
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
			{scalingDescriptions.every((desc) => !desc.description) && (
				<div className="pt-4 border-t border-black border-2">
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
