"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
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
	defaultLevelPosition?: number // Default to hardest (0)
	className?: string
	showToggle?: boolean // Whether to show the toggle controls
}

export function WorkoutScalingDisplay({
	workoutDescription,
	scalingLevels = [],
	scalingDescriptions = [],
	defaultLevelPosition = 0, // Default to hardest level
	className,
	showToggle = true,
}: WorkoutScalingDisplayProps) {
	const [selectedLevelIndex, setSelectedLevelIndex] = useState(0)

	// Sort levels by position (0 = hardest)
	const sortedLevels = [...scalingLevels].sort(
		(a, b) => a.position - b.position,
	)

	// Initialize to default position
	useEffect(() => {
		if (sortedLevels.length > 0) {
			const defaultIndex = sortedLevels.findIndex(
				(level) => level.position === defaultLevelPosition,
			)
			setSelectedLevelIndex(defaultIndex >= 0 ? defaultIndex : 0)
		}
	}, [defaultLevelPosition, sortedLevels])

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

	const currentLevel = sortedLevels[selectedLevelIndex]
	const currentDescription = scalingDescriptions.find(
		(desc) => desc.scalingLevelId === currentLevel?.id,
	)

	const handlePrevious = () => {
		setSelectedLevelIndex((prev) => Math.max(0, prev - 1))
	}

	const handleNext = () => {
		setSelectedLevelIndex((prev) => Math.min(sortedLevels.length - 1, prev + 1))
	}

	const isHardest = selectedLevelIndex === 0
	const isEasiest = selectedLevelIndex === sortedLevels.length - 1

	return (
		<div className={cn("space-y-4", className)}>
			{/* Scaling Level Toggle */}
			<div className="border-2 border-primary p-4 rounded-none bg-surface">
				<div className="flex items-center justify-between mb-3">
					<h3 className="text-sm font-mono font-semibold uppercase">
						Scaling Level
					</h3>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="icon"
							onClick={handlePrevious}
							disabled={isHardest}
							className="h-8 w-8"
							aria-label="Previous scaling level"
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>

						<div className="flex items-center gap-2 min-w-[120px] justify-center">
							<Badge
								variant={
									isHardest ? "default" : isEasiest ? "secondary" : "outline"
								}
								className="font-mono"
							>
								{currentLevel?.label}
							</Badge>
							{isHardest && (
								<span className="text-xs text-muted-foreground">(Hardest)</span>
							)}
							{isEasiest && (
								<span className="text-xs text-muted-foreground">(Easiest)</span>
							)}
						</div>

						<Button
							variant="outline"
							size="icon"
							onClick={handleNext}
							disabled={isEasiest}
							className="h-8 w-8"
							aria-label="Next scaling level"
						>
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* Level Indicators */}
				<div className="flex items-center gap-1 justify-center">
					{sortedLevels.map((level, index) => (
						<button
							type="button"
							key={level.id}
							onClick={() => setSelectedLevelIndex(index)}
							className={cn(
								"h-2 w-8 rounded-full transition-all",
								index === selectedLevelIndex
									? "bg-primary"
									: "bg-muted hover:bg-muted-foreground/30",
							)}
							aria-label={`Select ${level.label}`}
						/>
					))}
				</div>
			</div>

			{/* Description Display */}
			<div>
				<p className="whitespace-pre-wrap text-foreground text-lg dark:text-dark-foreground">
					{currentDescription?.description || workoutDescription}
				</p>
				{currentDescription?.description && (
					<p className="text-sm text-muted-foreground mt-2 italic">
						Scaled for {currentLevel?.label}
					</p>
				)}
			</div>
		</div>
	)
}
