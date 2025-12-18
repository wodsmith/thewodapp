"use client"

import { Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { updateEventDefaultsAction } from "@/actions/judge-rotation-actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

const DEBOUNCE_MS = 500

interface EventDefaultsEditorProps {
	teamId: string
	trackWorkoutId: string
	defaultHeatsCount: number | null
	defaultLaneShiftPattern: LaneShiftPattern | null
	competitionDefaultHeats: number
	competitionDefaultPattern: LaneShiftPattern
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

/**
 * Inline editor for event-level rotation defaults.
 * Allows overriding competition-wide defaults for a specific event/workout.
 * Displays inline above RotationTimeline in the Rotations tab.
 */
export function EventDefaultsEditor({
	teamId,
	trackWorkoutId,
	defaultHeatsCount,
	defaultLaneShiftPattern,
	competitionDefaultHeats,
	competitionDefaultPattern,
}: EventDefaultsEditorProps) {
	const [isSubmitting, setIsSubmitting] = useState(false)

	// Use event-specific value or fall back to competition default
	const effectiveHeats = defaultHeatsCount ?? competitionDefaultHeats
	const effectivePattern = defaultLaneShiftPattern ?? competitionDefaultPattern

	// Local state for heats input (allows immediate UI feedback while debouncing)
	const [localHeats, setLocalHeats] = useState(effectiveHeats)
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	// Sync local state when props change (e.g., after revalidation or event switch)
	useEffect(() => {
		setLocalHeats(effectiveHeats)
	}, [effectiveHeats])

	const saveHeats = async (newHeats: number) => {
		setIsSubmitting(true)
		try {
			await updateEventDefaultsAction({
				teamId,
				trackWorkoutId,
				defaultHeatsCount: newHeats,
			})
			toast.success("Event defaults updated")
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to update")
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleHeatsChange = (value: string) => {
		const newHeats = Number.parseInt(value, 10)
		if (Number.isNaN(newHeats) || newHeats < 1 || newHeats > 10) {
			return
		}

		// Update local state immediately for responsive UI
		setLocalHeats(newHeats)

		// Debounce the save
		if (debounceRef.current) {
			clearTimeout(debounceRef.current)
		}
		debounceRef.current = setTimeout(() => {
			saveHeats(newHeats)
		}, DEBOUNCE_MS)
	}

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current)
			}
		}
	}, [])

	const handlePatternChange = async (value: LaneShiftPattern) => {
		setIsSubmitting(true)
		try {
			await updateEventDefaultsAction({
				teamId,
				trackWorkoutId,
				defaultLaneShiftPattern: value,
			})
			toast.success("Event defaults updated")
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to update")
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Event Defaults</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Default Heats Count */}
				<div className="space-y-2">
					<Label htmlFor="defaultHeatsCount" className="text-sm">
						Default Heats per Rotation
					</Label>
					<div className="flex items-center gap-2">
						<Input
							id="defaultHeatsCount"
							type="number"
							min={1}
							max={10}
							value={localHeats}
							onChange={(e) => handleHeatsChange(e.target.value)}
							disabled={isSubmitting}
							className="max-w-[120px]"
						/>
						{isSubmitting && (
							<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
						)}
					</div>
					<p className="text-xs text-muted-foreground">
						{defaultHeatsCount === null
							? `Using competition default (${competitionDefaultHeats})`
							: "Event-specific override"}
					</p>
				</div>

				{/* Default Lane Shift Pattern */}
				<div className="space-y-2">
					<Label htmlFor="defaultLaneShiftPattern" className="text-sm">
						Default Lane Shift Pattern
					</Label>
					<p className="text-xs text-muted-foreground">
						{LANE_SHIFT_OPTIONS.find((opt) => opt.value === effectivePattern)
							?.description ?? "Select a pattern"}
					</p>
					<Select
						value={effectivePattern}
						onValueChange={(value) =>
							handlePatternChange(value as LaneShiftPattern)
						}
						disabled={isSubmitting}
					>
						<SelectTrigger id="defaultLaneShiftPattern" className="max-w-[200px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{LANE_SHIFT_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="text-xs text-muted-foreground">
						{defaultLaneShiftPattern === null
							? `Using competition default (${LANE_SHIFT_OPTIONS.find((opt) => opt.value === competitionDefaultPattern)?.label})`
							: "Event-specific override"}
					</p>
				</div>
			</CardContent>
		</Card>
	)
}
