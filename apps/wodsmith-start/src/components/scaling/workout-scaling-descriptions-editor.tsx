"use client"

import { AlertCircle, Save } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import {
	getScalingGroupWithLevelsAction,
	getWorkoutScalingDescriptionsAction,
	updateWorkoutScalingDescriptionsAction,
} from "@/actions/scaling-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

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
	const [isSaving, startSaving] = useTransition()

	// Load scaling levels when group changes
	useEffect(() => {
		if (!scalingGroupId || scalingGroupId === "none" || !teamId) {
			setScalingLevels([])
			setDescriptions(new Map())
			return
		}

		const fetchLevels = async () => {
			setIsLoading(true)
			try {
				const result = await getScalingGroupWithLevelsAction({
					groupId: scalingGroupId,
					teamId: teamId,
				})

				if (result && !(result instanceof Error) && result.levels) {
					setScalingLevels(
						result.levels.map((level: any) => ({
							id: level.id,
							label: level.label,
							position: level.position,
						})),
					)
				}
			} catch (error) {
				console.error("Failed to fetch scaling levels:", error)
			} finally {
				setIsLoading(false)
			}
		}

		fetchLevels()
	}, [scalingGroupId, teamId])

	// Load existing descriptions
	useEffect(() => {
		if (!workoutId) return

		const fetchDescs = async () => {
			try {
				const result = await getWorkoutScalingDescriptionsAction({ workoutId })
				if (result && !(result instanceof Error) && Array.isArray(result)) {
					const descMap = new Map<string, string>()
					result.forEach((desc: any) => {
						if (desc.description) {
							descMap.set(desc.scalingLevelId, desc.description)
						}
					})
					setDescriptions(descMap)
				}
			} catch (error) {
				console.error("Failed to fetch scaling descriptions:", error)
			}
		}

		fetchDescs()
	}, [workoutId])

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

	const handleSave = () => {
		const descriptionsToSave: ScalingDescription[] = scalingLevels.map(
			(level) => ({
				scalingLevelId: level.id,
				description: descriptions.get(level.id) || null,
			}),
		)

		startSaving(async () => {
			try {
				const result = await updateWorkoutScalingDescriptionsAction({
					workoutId,
					descriptions: descriptionsToSave,
				})

				if (result instanceof Error || !result) {
					toast.error("Failed to save scaling descriptions")
					return
				}

				toast.success("Scaling descriptions saved successfully")
				setHasChanges(false)
				onSave?.()
			} catch (error) {
				toast.error("Failed to save scaling descriptions")
				console.error("Save error:", error)
			}
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
