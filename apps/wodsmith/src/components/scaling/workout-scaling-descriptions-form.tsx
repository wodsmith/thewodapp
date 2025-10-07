"use client"

import { useEffect, useState } from "react"
import { useServerAction } from "@repo/zsa-react"
import { getScalingGroupWithLevelsAction } from "@/actions/scaling-actions"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface WorkoutScalingDescriptionsFormProps {
	scalingGroupId: string | null
	teamId?: string
	value: Map<string, string>
	onChange: (descriptions: Map<string, string>) => void
}

interface ScalingLevel {
	id: string
	label: string
	position: number
}

export function WorkoutScalingDescriptionsForm({
	scalingGroupId,
	teamId,
	value,
	onChange,
}: WorkoutScalingDescriptionsFormProps) {
	const [scalingLevels, setScalingLevels] = useState<ScalingLevel[]>([])
	const [isLoading, setIsLoading] = useState(false)

	// Fetch scaling levels
	const { execute: fetchScalingLevels } = useServerAction(
		getScalingGroupWithLevelsAction,
		{
			onError: (error) => {
				console.error("Failed to fetch scaling levels:", error)
			},
		},
	)

	// Load scaling levels when group changes
	useEffect(() => {
		if (!scalingGroupId || scalingGroupId === "none") {
			setScalingLevels([])
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

	const handleDescriptionChange = (levelId: string, description: string) => {
		const newDescriptions = new Map(value)
		if (description.trim() === "") {
			newDescriptions.delete(levelId)
		} else {
			newDescriptions.set(levelId, description)
		}
		onChange(newDescriptions)
	}

	if (!scalingGroupId || scalingGroupId === "none") {
		return null
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
							value={value.get(level.id) || ""}
							onChange={(e) =>
								handleDescriptionChange(level.id, e.target.value)
							}
							placeholder={`Enter scaling description for ${level.label}...`}
							className="border-2 border-primary rounded-none font-mono min-h-[100px]"
						/>
					</div>
				))}
			</div>
		</div>
	)
}
