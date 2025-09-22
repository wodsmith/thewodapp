"use client"

import { useState, useEffect } from "react"
import { useServerAction } from "zsa-react"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Save, AlertCircle } from "lucide-react"
import {
	getScalingGroupWithLevelsAction,
	getWorkoutScalingDescriptionsAction,
	updateWorkoutScalingDescriptionsAction,
} from "@/actions/scaling-actions"

interface WorkoutScalingDescriptionsEditorProps {
	workoutId: string
	scalingGroupId: string | null
	teamId?: string
	onSave?: () => void
}

interface ScalingLevel {
	id: string
	label: string
	position: number
}

interface ScalingDescription {
	scalingLevelId: string
	description: string | null
}

export function WorkoutScalingDescriptionsEditor({
	workoutId,
	scalingGroupId,
	teamId,
	onSave,
}: WorkoutScalingDescriptionsEditorProps) {
	const [scalingLevels, setScalingLevels] = useState<ScalingLevel[]>([])
	const [descriptions, setDescriptions] = useState<Map<string, string>>(
		new Map(),
	)
	const [isLoading, setIsLoading] = useState(false)
	const [hasChanges, setHasChanges] = useState(false)

	// Fetch scaling levels
	const { execute: fetchScalingLevels } = useServerAction(
		getScalingGroupWithLevelsAction,
		{
			onError: (error) => {
				console.error("Failed to fetch scaling levels:", error)
			},
		},
	)

	// Fetch existing descriptions
	const { execute: fetchDescriptions } = useServerAction(
		getWorkoutScalingDescriptionsAction,
		{
			onError: (error) => {
				console.error("Failed to fetch scaling descriptions:", error)
			},
		},
	)

	// Update descriptions
	const { execute: updateDescriptions, isPending: isSaving } = useServerAction(
		updateWorkoutScalingDescriptionsAction,
		{
			onError: (error) => {
				toast.error(error.err?.message || "Failed to save scaling descriptions")
			},
			onSuccess: () => {
				toast.success("Scaling descriptions saved successfully")
				setHasChanges(false)
				onSave?.()
			},
		},
	)

	// Load scaling levels when group changes
	useEffect(() => {
		if (!scalingGroupId || scalingGroupId === "none") {
			setScalingLevels([])
			setDescriptions(new Map())
			return
		}

		setIsLoading(true)
		fetchScalingLevels({
			groupId: scalingGroupId,
			teamId: teamId || "",
		}).then(([result]) => {
			if (result?.success && result.data?.levels) {
				setScalingLevels(
					result.data.levels.map((level: any) => ({
						id: level.id,
						label: level.label,
						position: level.position,
					})),
				)
			}
			setIsLoading(false)
		})
	}, [scalingGroupId, teamId, fetchScalingLevels])

	// Load existing descriptions
	useEffect(() => {
		if (!workoutId) return

		fetchDescriptions({ workoutId }).then(([result]) => {
			if (result?.success && result.data) {
				const descMap = new Map<string, string>()
				result.data.forEach((desc: any) => {
					if (desc.description) {
						descMap.set(desc.scalingLevelId, desc.description)
					}
				})
				setDescriptions(descMap)
			}
		})
	}, [workoutId, fetchDescriptions])

	const handleDescriptionChange = (levelId: string, value: string) => {
		const newDescriptions = new Map(descriptions)
		if (value.trim() === "") {
			newDescriptions.delete(levelId)
		} else {
			newDescriptions.set(levelId, value)
		}
		setDescriptions(newDescriptions)
		setHasChanges(true)
	}

	const handleSave = async () => {
		const descriptionsToSave: ScalingDescription[] = scalingLevels.map(
			(level) => ({
				scalingLevelId: level.id,
				description: descriptions.get(level.id) || null,
			}),
		)

		await updateDescriptions({
			workoutId,
			descriptions: descriptionsToSave,
		})
	}

	if (!scalingGroupId || scalingGroupId === "none") {
		return (
			<div className="p-4 border-2 border-dashed border-muted rounded-none">
				<div className="flex items-center gap-2 text-muted-foreground">
					<AlertCircle className="h-4 w-4" />
					<p className="text-sm font-mono">
						Select a scaling group to add scaling descriptions for this workout.
					</p>
				</div>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className="p-4 font-mono text-muted-foreground">
				Loading scaling levels...
			</div>
		)
	}

	if (scalingLevels.length === 0) {
		return (
			<div className="p-4 border-2 border-dashed border-muted rounded-none">
				<p className="text-sm text-muted-foreground font-mono">
					No scaling levels found for this group.
				</p>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold font-mono">
					Scaling Descriptions
				</h3>
				{hasChanges && (
					<Badge variant="secondary" className="font-mono">
						Unsaved changes
					</Badge>
				)}
			</div>

			<div className="space-y-4 p-4 border-2 border-primary rounded-none bg-surface">
				{scalingLevels.map((level, index) => (
					<div key={level.id} className="space-y-2">
						<div className="flex items-center gap-2">
							<Label
								htmlFor={`scaling-${level.id}`}
								className="font-mono font-semibold"
							>
								{level.label}
							</Label>
							{index === 0 && (
								<Badge variant="default" className="text-xs">
									Hardest
								</Badge>
							)}
							{index === scalingLevels.length - 1 && (
								<Badge variant="secondary" className="text-xs">
									Easiest
								</Badge>
							)}
						</div>
						<Textarea
							id={`scaling-${level.id}`}
							value={descriptions.get(level.id) || ""}
							onChange={(e) =>
								handleDescriptionChange(level.id, e.target.value)
							}
							placeholder={`Enter scaling description for ${level.label}...`}
							className="border-2 border-primary rounded-none font-mono min-h-[100px]"
						/>
					</div>
				))}
			</div>

			<div className="flex justify-end gap-2">
				<Button
					onClick={handleSave}
					disabled={!hasChanges || isSaving}
					className="border-2 border-primary shadow-[4px_4px_0px_0px] shadow-primary hover:shadow-[2px_2px_0px_0px] transition-all font-mono rounded-none"
				>
					<Save className="h-4 w-4 mr-2" />
					{isSaving ? "Saving..." : "Save Descriptions"}
				</Button>
			</div>
		</div>
	)
}
