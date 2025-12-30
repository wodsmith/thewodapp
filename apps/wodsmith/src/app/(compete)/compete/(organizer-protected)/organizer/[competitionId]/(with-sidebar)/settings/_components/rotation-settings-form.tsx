"use client"

import { Loader2, RotateCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { updateCompetitionRotationSettings } from "@/actions/competition-settings.action"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	LANE_SHIFT_PATTERN,
	type LaneShiftPattern,
} from "@/db/schemas/volunteers"

interface Props {
	competition: {
		id: string
		name: string
		defaultHeatsPerRotation: number
		defaultLaneShiftPattern: string
	}
}

const LANE_SHIFT_OPTIONS = [
	{
		value: LANE_SHIFT_PATTERN.STAY,
		label: "Stay in Lane",
		description: "Judges stay in the same lane for all heats",
	},
	{
		value: LANE_SHIFT_PATTERN.SHIFT_RIGHT,
		label: "Shift Lanes",
		description: "Judges rotate one lane to the right after each heat",
	},
] as const

export function RotationSettingsForm({ competition }: Props) {
	const router = useRouter()
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [heatsPerRotation, setHeatsPerRotation] = useState(
		competition.defaultHeatsPerRotation,
	)
	const [laneShiftPattern, setLaneShiftPattern] = useState<LaneShiftPattern>(
		competition.defaultLaneShiftPattern as LaneShiftPattern,
	)

	const handleSave = async () => {
		setIsSubmitting(true)
		try {
			await updateCompetitionRotationSettings({
				competitionId: competition.id,
				defaultHeatsPerRotation: heatsPerRotation,
				defaultLaneShiftPattern: laneShiftPattern,
			})
			toast.success("Rotation settings updated")
			router.refresh()
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to update")
		} finally {
			setIsSubmitting(false)
		}
	}

	const hasChanges =
		heatsPerRotation !== competition.defaultHeatsPerRotation ||
		laneShiftPattern !== competition.defaultLaneShiftPattern

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<RotateCw className="h-5 w-5" />
					Rotation Defaults
				</CardTitle>
				<CardDescription>
					Configure default rotation settings for judge scheduling
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Heats Per Rotation */}
				<div className="space-y-2">
					<Label htmlFor="heatsPerRotation">Default Heats Per Rotation</Label>
					<Input
						id="heatsPerRotation"
						type="number"
						min={1}
						max={10}
						value={heatsPerRotation}
						onChange={(e) =>
							setHeatsPerRotation(Number.parseInt(e.target.value, 10))
						}
						disabled={isSubmitting}
						className="max-w-xs"
					/>
					<p className="text-sm text-muted-foreground">
						How many heats judges should work before rotating out (1-10)
					</p>
				</div>

				{/* Lane Shift Pattern */}
				<div className="space-y-2">
					<Label htmlFor="laneShiftPattern">Default Lane Shift Pattern</Label>
					<Select
						value={laneShiftPattern}
						onValueChange={(value) =>
							setLaneShiftPattern(value as LaneShiftPattern)
						}
						disabled={isSubmitting}
					>
						<SelectTrigger id="laneShiftPattern" className="max-w-xs">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{LANE_SHIFT_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									<div className="flex flex-col">
										<span>{option.label}</span>
										<span className="text-xs text-muted-foreground">
											{option.description}
										</span>
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="text-sm text-muted-foreground">
						How judges should rotate between lanes during their rotation
					</p>
				</div>

				{/* Save Button */}
				<div className="pt-4 border-t">
					<Button onClick={handleSave} disabled={isSubmitting || !hasChanges}>
						{isSubmitting ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Saving...
							</>
						) : (
							"Save Settings"
						)}
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}
