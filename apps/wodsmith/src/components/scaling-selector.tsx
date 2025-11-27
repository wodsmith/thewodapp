"use client"

import { Info, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useServerAction } from "@repo/zsa-react"
import {
	getScalingGroupWithLevelsAction,
	getWorkoutScalingDescriptionsAction,
} from "@/actions/scaling-actions"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
	const [wasModified, setWasModified] = useState<boolean>(!initialAsRx)
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
		// Use the current wasModified state - if modified, asRx = false
		onChange(levelId, !wasModified)
	}

	const handleModifiedChange = (checked: boolean) => {
		setWasModified(checked)
		// Update with current selected level - if modified/checked, asRx = false
		if (selectedLevelId) {
			onChange(selectedLevelId, !checked)
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

			{/* Modified/Scaled Checkbox */}
			{selectedLevelId && (
				<div className="flex items-center space-x-2">
					<Checkbox
						id="scaled-modified"
						checked={wasModified}
						onCheckedChange={handleModifiedChange}
						disabled={disabled}
					/>
					<div className="flex items-center gap-1.5">
						<Label
							htmlFor="scaled-modified"
							className="text-sm font-normal cursor-pointer"
						>
							Scaled/Modified
						</Label>
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
								</TooltipTrigger>
								<TooltipContent>
									<p className="max-w-xs">
										Did you modify this level? Check this box if you made any
										modifications to the prescribed movements, weights, or reps.
									</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>
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
