"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getDefinedScalingLevels } from "@/utils/scaling-utils"

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
	// Filter to only show levels that have descriptions defined
	const definedLevels = useMemo(
		() => getDefinedScalingLevels(scalingLevels, scalingDescriptions),
		[scalingLevels, scalingDescriptions],
	)

	// Sort levels by position (0 = hardest)
	const sortedLevels = useMemo(
		() => [...definedLevels].sort((a, b) => a.position - b.position),
		[definedLevels],
	)

	// Default to first (hardest) level
	const [activeTab, setActiveTab] = useState(sortedLevels[0]?.id || "base")
	const tabsListRef = useRef<HTMLDivElement>(null)

	// Update activeTab when sortedLevels changes (when data loads)
	useEffect(() => {
		if (
			sortedLevels.length > 0 &&
			(!activeTab ||
				activeTab === "base" ||
				!sortedLevels.find((level) => level.id === activeTab))
		) {
			const firstLevel = sortedLevels[0]
			if (firstLevel) {
				setActiveTab(firstLevel.id)
			}
		}
	}, [sortedLevels, activeTab])

	// Ensure first tab is always visible
	useEffect(() => {
		if (tabsListRef.current && sortedLevels.length > 0) {
			// Scroll to beginning to ensure first tab is visible
			tabsListRef.current.scrollLeft = 0
		}
	}, [sortedLevels])

	// If no defined scaling levels, just show the workout description
	if (sortedLevels.length === 0) {
		return (
			<div className={className}>
				<p className="whitespace-pre-wrap text-foreground">
					{workoutDescription}
				</p>
				{/* Show a note if there are scaling levels but no descriptions */}
				{scalingLevels.length > 0 && (
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
				<div className="px-2">
					<TabsList
						ref={tabsListRef}
						className={cn(
							"flex w-full overflow-x-auto scrollbar-hide pb-1 gap-1 justify-start",
							"md:grid md:overflow-visible md:px-0",
						)}
						style={{
							gridTemplateColumns:
								sortedLevels.length > 0
									? `repeat(${sortedLevels.length}, 1fr)`
									: undefined,
							scrollBehavior: "smooth",
							justifyContent: "flex-start",
						}}
					>
						{sortedLevels.map((level) => (
							<TabsTrigger
								key={level.id}
								value={level.id}
								className={cn(
									"flex items-center gap-1 flex-shrink-0 min-w-[70px] px-2",
									"md:min-w-0 md:px-3",
								)}
							>
								<span className="font-mono text-xs">{level.label}</span>
							</TabsTrigger>
						))}
					</TabsList>
				</div>

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
		</div>
	)
}
