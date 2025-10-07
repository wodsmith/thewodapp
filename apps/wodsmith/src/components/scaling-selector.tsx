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
import { Button } from "@/components/ui/button"
import { useServerAction } from "@repo/zsa-react"
import {
	getScalingGroupWithLevelsAction,
	getWorkoutScalingDescriptionsAction,
} from "@/actions/scaling-actions"
import { getDefinedScalingLevels } from "@/utils/scaling-utils"

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

interface ScalingDescription {
	scalingLevelId: string
	description: string | null
}

interface ScalingSelectorProps {
	workoutId?: string
	workoutScalingGroupId?: string | null
	programmingTrackId?: string | null
	trackScalingGroupId?: string | null
	teamId: string
	value?: string
	initialAsRx?: boolean
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
	workoutId,
	workoutScalingGroupId,
	programmingTrackId,
	trackScalingGroupId,
	teamId,
	value,
	initialAsRx = true,
	onChange,
	disabled = false,
	required = true,
	className = "",
}: ScalingSelectorProps) {
	const [scalingGroup, setScalingGroup] = useState<ScalingGroup | null>(null)
	const [workoutScalingDescriptions, setWorkoutScalingDescriptions] = useState<
		ScalingDescription[]
	>([])
	const [filteredLevels, setFilteredLevels] = useState<ScalingLevel[]>([])
	const [selectedLevelId, setSelectedLevelId] = useState<string>(value || "")
	const [asRxSelection, setAsRxSelection] = useState<"rx" | "scaled">(
		initialAsRx ? "rx" : "scaled",
	)
	const [isLoading, setIsLoading] = useState(true)
	const [scalingSource, setScalingSource] = useState<
		"workout" | "track" | "default"
	>("default")

	const { execute: fetchScalingGroup } = useServerAction(
		getScalingGroupWithLevelsAction,
	)

	const { execute: fetchWorkoutScalingDescriptions } = useServerAction(
		getWorkoutScalingDescriptionsAction,
	)

	// Fetch scaling levels and workout descriptions based on priority
	useEffect(() => {
		const loadScalingLevels = async () => {
			setIsLoading(true)

			let groupId: string | null = null
			let source: "workout" | "track" | "default" = "default"
			let fetchedGroup: ScalingGroup | null = null

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
					fetchedGroup = result.data
					setScalingSource(source)
				} else {
					// Fall back to default if fetch fails
					console.error("Failed to fetch scaling group:", error)
					fetchedGroup = getDefaultScalingGroup()
				}
			} else {
				// Use default scaling group (legacy Rx/Scaled)
				fetchedGroup = getDefaultScalingGroup()
			}

			setScalingGroup(fetchedGroup)

			// If we have a workoutId and it's not the default group, fetch workout-specific descriptions
			let descriptions: ScalingDescription[] = []
			if (workoutId && fetchedGroup && fetchedGroup.id !== "default") {
				try {
					const [descriptionsResult] = await fetchWorkoutScalingDescriptions({
						workoutId,
					})
					if (descriptionsResult?.data) {
						descriptions = descriptionsResult.data
							.map((d) => ({
								scalingLevelId: d.scalingLevel?.id || "",
								description: d.description,
							}))
							.filter((d) => d.scalingLevelId) // Remove entries without level ID
					}
				} catch (error) {
					console.error("Failed to fetch workout scaling descriptions:", error)
				}
			}

			setWorkoutScalingDescriptions(descriptions)

			// Filter levels to only show those with descriptions (if any descriptions exist)
			let levelsToShow = fetchedGroup?.levels || []
			if (workoutId && descriptions.length > 0) {
				levelsToShow = getDefinedScalingLevels(
					fetchedGroup?.levels || [],
					descriptions,
				)
			}

			setFilteredLevels(levelsToShow)
			setIsLoading(false)
		}

		loadScalingLevels()
	}, [
		workoutId,
		workoutScalingGroupId,
		trackScalingGroupId,
		programmingTrackId,
		teamId,
		fetchScalingGroup,
		fetchWorkoutScalingDescriptions,
	])

	const handleLevelChange = (levelId: string) => {
		setSelectedLevelId(levelId)
		// Use the current asRxSelection state
		onChange(levelId, asRxSelection === "rx")
	}

	const handleRxChange = (value: string) => {
		const isRx = value === "rx"
		setAsRxSelection(value as "rx" | "scaled")
		// Update with current selected level
		if (selectedLevelId) {
			onChange(selectedLevelId, isRx)
		}
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

	if (!scalingGroup || filteredLevels.length === 0) {
		return (
			<div className={`space-y-2 ${className}`}>
				<Label>Scaling Level</Label>
				<div className="p-4 border border-yellow-500/50 rounded-lg bg-yellow-500/10">
					<p className="text-sm text-yellow-600 dark:text-yellow-400">
						{!scalingGroup
							? "No scaling levels available for this workout."
							: workoutId &&
									workoutScalingDescriptions.length === 0 &&
									scalingGroup.id !== "default"
								? "No scaling descriptions defined for this workout. Please add descriptions to make scaling levels available."
								: "No defined scaling levels available for this workout."}
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className={`space-y-4 ${className}`}>
			<div className="space-y-2">
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
					onValueChange={handleLevelChange}
					disabled={disabled}
					required={required}
				>
					<SelectTrigger id="scaling-level" className="w-full">
						<SelectValue placeholder="Select scaling level" />
					</SelectTrigger>
					<SelectContent>
						{filteredLevels
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
			</div>

			{/* As Prescribed or Scaled Selection */}
			{selectedLevelId && (
				<div className="space-y-2">
					<Label>Performance</Label>
					<div className="flex gap-2">
						<Button
							type="button"
							variant={asRxSelection === "rx" ? "default" : "outline"}
							size="sm"
							onClick={() => handleRxChange("rx")}
							disabled={disabled}
							className="flex-1"
						>
							As Prescribed (Rx)
						</Button>
						<Button
							type="button"
							variant={asRxSelection === "scaled" ? "default" : "outline"}
							size="sm"
							onClick={() => handleRxChange("scaled")}
							disabled={disabled}
							className="flex-1"
						>
							Scaled
						</Button>
					</div>
					<p className="text-xs text-muted-foreground">
						Indicate if you performed this level as prescribed or made
						additional modifications
					</p>
				</div>
			)}

			{/* Show scaling group info */}
			{scalingSource !== "default" && scalingGroup.title && (
				<p className="text-xs text-muted-foreground">
					Using scaling group: {scalingGroup.title}
				</p>
			)}
		</div>
	)
}
