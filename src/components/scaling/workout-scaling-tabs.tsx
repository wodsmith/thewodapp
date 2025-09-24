"use client"

import { useState, useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

interface WorkoutScalingTabsProps {
	workoutDescription: string
	scalingLevels?: ScalingLevel[]
	scalingDescriptions?: ScalingDescription[]
	className?: string
}

export function WorkoutScalingTabs({
	workoutDescription,
	scalingLevels = [],
	scalingDescriptions = [],
	className,
}: WorkoutScalingTabsProps) {
	// Sort levels by position (0 = hardest)
	const sortedLevels = useMemo(
		() => [...scalingLevels].sort((a, b) => a.position - b.position),
		[scalingLevels],
	)

	// Default to first (hardest) level
	const [activeTab, setActiveTab] = useState(sortedLevels[0]?.id || "base")

	// If no scaling levels, just show the workout description
	if (sortedLevels.length === 0) {
		return (
			<div className={className}>
				<p className="whitespace-pre-wrap text-foreground">
					{workoutDescription}
				</p>
			</div>
		)
	}

	// Get description for a specific level
	const getDescriptionForLevel = (levelId: string) => {
		const customDescription = scalingDescriptions.find(
			(desc) => desc.scalingLevelId === levelId,
		)?.description
		return customDescription || workoutDescription
	}

	return (
		<div className={cn("space-y-4", className)}>
			<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
				<TabsList
					className="grid w-full"
					style={{ gridTemplateColumns: `repeat(${sortedLevels.length}, 1fr)` }}
				>
					{sortedLevels.map((level) => (
						<TabsTrigger
							key={level.id}
							value={level.id}
							className="flex items-center gap-2"
						>
							<span className="font-mono text-sm">{level.label}</span>
							{level.position === 0 && (
								<Badge
									variant="secondary"
									className="ml-1 h-4 px-1 text-[10px]"
								>
									RX
								</Badge>
							)}
						</TabsTrigger>
					))}
				</TabsList>

				{sortedLevels.map((level) => (
					<TabsContent key={level.id} value={level.id} className="mt-4">
						<div className="space-y-2">
							<div className="flex items-center gap-2">
								<Badge variant="outline" className="font-mono">
									{level.label}
								</Badge>
								{level.position === 0 && (
									<span className="text-xs text-muted-foreground">
										(Prescribed)
									</span>
								)}
							</div>
							<p className="whitespace-pre-wrap text-foreground">
								{getDescriptionForLevel(level.id)}
							</p>
							{!scalingDescriptions.find((d) => d.scalingLevelId === level.id)
								?.description && (
								<p className="text-xs text-muted-foreground italic">
									Using base workout description
								</p>
							)}
						</div>
					</TabsContent>
				))}
			</Tabs>

			{/* Show note if no custom descriptions exist */}
			{scalingDescriptions.length === 0 && sortedLevels.length > 0 && (
				<div className="rounded-lg bg-muted/50 p-3">
					<p className="text-sm text-muted-foreground">
						No scaling-specific descriptions available. All levels show the base
						workout.
					</p>
				</div>
			)}
		</div>
	)
}
