"use client"

import { useEffect, useState } from "react"
import { Loader2, Info } from "lucide-react"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { useServerAction } from "zsa-react"
import { getScalingGroupWithLevelsAction } from "@/actions/scaling-actions"

interface ScalingLevel {
	id: string
	label: string
	position: number
	description?: string | null
}

interface ScalingGroup {
	id: string
	title: string
	description?: string | null
	levels: ScalingLevel[]
}

interface ScalingSelectorProps {
	workoutId?: string
	workoutScalingGroupId?: string | null
	programmingTrackId?: string | null
	trackScalingGroupId?: string | null
	teamId: string
	value?: string
	onChange: (scalingLevelId: string, asRx: boolean) => void
	disabled?: boolean
	required?: boolean
	className?: string
}

// Get default/legacy scaling group
const getDefaultScalingGroup = (): ScalingGroup => ({
	id: "default",
	title: "Standard Scaling",
	description: "Traditional Rx and Scaled options",
	levels: [
		{ id: "rx+", label: "Rx+", position: 0, description: "Advanced" },
		{ id: "rx", label: "Rx", position: 1, description: "As prescribed" },
		{ id: "scaled", label: "Scaled", position: 2, description: "Modified" },
	],
})

export function ScalingSelector({
	workoutId: _workoutId,
	workoutScalingGroupId,
	programmingTrackId,
	trackScalingGroupId,
	teamId,
	value,
	onChange,
	disabled = false,
	required = true,
	className = "",
}: ScalingSelectorProps) {
	const [scalingGroup, setScalingGroup] = useState<ScalingGroup | null>(null)
	const [selectedLevelId, setSelectedLevelId] = useState<string>(value || "")
	const [isLoading, setIsLoading] = useState(true)
	const [scalingSource, setScalingSource] = useState<
		"workout" | "track" | "default"
	>("default")

	const { execute: fetchScalingGroup } = useServerAction(
		getScalingGroupWithLevelsAction,
	)

	// Fetch scaling levels based on priority
	useEffect(() => {
		const loadScalingLevels = async () => {
			setIsLoading(true)

			let groupId: string | null = null
			let source: "workout" | "track" | "default" = "default"

			// Priority 1: Workout-specific scaling group
			if (workoutScalingGroupId) {
				groupId = workoutScalingGroupId
				source = "workout"
			}
			// Priority 2: Programming track scaling group
			else if (trackScalingGroupId && programmingTrackId) {
				groupId = trackScalingGroupId
				source = "track"
			}

			// If we have a group ID, fetch it
			if (groupId) {
				const [result, error] = await fetchScalingGroup({
					groupId,
					teamId,
				})

				if (result?.data) {
					setScalingGroup(result.data)
					setScalingSource(source)
				} else {
					// Fall back to default if fetch fails
					console.error("Failed to fetch scaling group:", error)
					setScalingGroup(getDefaultScalingGroup())
				}
			} else {
				// Use default scaling group (legacy Rx/Scaled)
				setScalingGroup(getDefaultScalingGroup())
			}

			setIsLoading(false)
		}

		loadScalingLevels()
	}, [
		workoutScalingGroupId,
		trackScalingGroupId,
		programmingTrackId,
		teamId,
		fetchScalingGroup,
	])

	const handleChange = (levelId: string) => {
		setSelectedLevelId(levelId)

		// Determine if this counts as "Rx" based on position
		// Only position 0 (typically the top/compete level) is considered Rx
		const level = scalingGroup?.levels.find((l) => l.id === levelId)
		const asRx = level ? level.position === 0 : false

		onChange(levelId, asRx)
	}

	const getSourceLabel = () => {
		switch (scalingSource) {
			case "workout":
				return "Workout-specific"
			case "track":
				return "Track default"
			default:
				return "Standard"
		}
	}

	if (isLoading) {
		return (
			<div className={`space-y-2 ${className}`}>
				<Label>Scaling Level</Label>
				<div className="flex items-center justify-center p-4 border rounded-lg bg-muted/50">
					<Loader2 className="h-4 w-4 animate-spin mr-2" />
					<span className="text-sm text-muted-foreground">
						Loading scaling options...
					</span>
				</div>
			</div>
		)
	}

	if (!scalingGroup || scalingGroup.levels.length === 0) {
		return (
			<div className={`space-y-2 ${className}`}>
				<Label>Scaling Level</Label>
				<div className="p-4 border border-yellow-500/50 rounded-lg bg-yellow-500/10">
					<p className="text-sm text-yellow-600 dark:text-yellow-400">
						No scaling levels available for this workout.
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className={`space-y-2 ${className}`}>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Label htmlFor="scaling-level">
						Scaling Level{" "}
						{required && <span className="text-destructive">*</span>}
					</Label>
					<Badge variant="outline" className="text-xs">
						{getSourceLabel()}
					</Badge>
				</div>
				{scalingGroup.description && (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger>
								<Info className="h-4 w-4 text-muted-foreground" />
							</TooltipTrigger>
							<TooltipContent>
								<p className="max-w-xs">{scalingGroup.description}</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				)}
			</div>

			<Select
				value={selectedLevelId}
				onValueChange={handleChange}
				disabled={disabled}
				required={required}
			>
				<SelectTrigger id="scaling-level" className="w-full">
					<SelectValue placeholder="Select scaling level" />
				</SelectTrigger>
				<SelectContent>
					{scalingGroup.levels
						.sort((a, b) => a.position - b.position)
						.map((level) => (
							<SelectItem key={level.id} value={level.id}>
								<div className="flex items-center justify-between w-full">
									<span className="font-medium">{level.label}</span>
									{level.description && (
										<span className="text-xs text-muted-foreground ml-2">
											{level.description}
										</span>
									)}
								</div>
							</SelectItem>
						))}
				</SelectContent>
			</Select>

			{/* Show scaling group info */}
			{scalingSource !== "default" && scalingGroup.title && (
				<p className="text-xs text-muted-foreground">
					Using scaling group: {scalingGroup.title}
				</p>
			)}
		</div>
	)
}
