"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useServerAction } from "@repo/zsa-react"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
	createJudgeRotationAction,
	updateJudgeRotationAction,
	validateRotationAction,
} from "@/actions/judge-rotation-actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
	type CompetitionJudgeRotation,
	LANE_SHIFT_PATTERN,
	type LaneShiftPattern,
} from "@/db/schema"
import { useToast } from "@/hooks/use-toast"
import type { JudgeVolunteerInfo } from "@/server/judge-scheduling"

/**
 * Creates a dynamic schema based on the actual number of heats in the competition.
 * No arbitrary limits - judges can cover as many heats as the event has.
 */
function createRotationFormSchema(maxHeats: number) {
	return z.object({
		membershipId: z.string().min(1, "Judge is required"),
		startingHeat: z.number().int().min(1, "Starting heat must be at least 1"),
		startingLane: z.number().int().min(1, "Starting lane must be at least 1"),
		heatsCount: z
			.number()
			.int()
			.min(1, "Must cover at least 1 heat")
			.max(maxHeats, `Maximum ${maxHeats} heats available`),
		notes: z.string().max(500, "Notes too long").optional(),
	})
}

type RotationFormValues = z.infer<ReturnType<typeof createRotationFormSchema>>

/** Represents a cell that would be covered by a rotation */
export interface PreviewCell {
	heat: number
	lane: number
}

interface RotationEditorProps {
	competitionId: string
	teamId: string
	trackWorkoutId: string
	maxHeats: number
	maxLanes: number
	availableJudges: JudgeVolunteerInfo[]
	rotation?: CompetitionJudgeRotation // For editing existing rotation
	/** Initial heat to pre-populate (when clicking a cell) */
	initialHeat?: number
	/** Initial lane to pre-populate (when clicking a cell) */
	initialLane?: number
	/** External position update (when user clicks a cell while editor is open) */
	externalPosition?: { heat: number; lane: number } | null
	/** Event-level lane shift pattern (read-only for this rotation) */
	eventLaneShiftPattern: LaneShiftPattern
	/** Default number of heats from event settings */
	eventDefaultHeatsCount?: number
	onSuccess: () => void
	onCancel: () => void
	/** Called when form values change to show preview cells in the grid */
	onPreviewChange?: (cells: PreviewCell[]) => void
}

/**
 * Form to create or edit a judge rotation.
 * Shows live validation of conflicts and preview of coverage.
 */
export function RotationEditor({
	competitionId,
	teamId,
	trackWorkoutId,
	maxHeats,
	maxLanes,
	availableJudges,
	rotation,
	initialHeat,
	initialLane,
	externalPosition,
	eventLaneShiftPattern,
	eventDefaultHeatsCount,
	onSuccess,
	onCancel,
	onPreviewChange,
}: RotationEditorProps) {
	const isEditing = !!rotation
	const { toast } = useToast()
	const [conflicts, setConflicts] = useState<string[]>([])
	const [truncationInfo, setTruncationInfo] = useState<{
		effectiveHeatsCount: number
		requestedHeatsCount: number
		truncated: boolean
	} | null>(null)

	const createRotation = useServerAction(createJudgeRotationAction)
	const updateRotation = useServerAction(updateJudgeRotationAction)
	const validateRotation = useServerAction(validateRotationAction)

	const rotationFormSchema = useMemo(
		() => createRotationFormSchema(maxHeats),
		[maxHeats],
	)

	const form = useForm<RotationFormValues>({
		resolver: zodResolver(rotationFormSchema),
		defaultValues: {
			membershipId: rotation?.membershipId ?? "",
			startingHeat: rotation?.startingHeat ?? initialHeat ?? 1,
			startingLane: rotation?.startingLane ?? initialLane ?? 1,
			heatsCount:
				rotation?.heatsCount ?? eventDefaultHeatsCount ?? Math.min(4, maxHeats),
			notes: rotation?.notes ?? "",
		},
	})

	const formValues = form.watch()

	// Watch specific fields for preview calculation
	const startingHeat = form.watch("startingHeat")
	const startingLane = form.watch("startingLane")
	const heatsCount = form.watch("heatsCount")

	// Emit preview cells when relevant fields change
	useEffect(() => {
		if (!onPreviewChange) return

		const cells: PreviewCell[] = []

		for (let i = 0; i < heatsCount; i++) {
			const heat = startingHeat + i
			if (heat > maxHeats) break

			let lane: number
			if (eventLaneShiftPattern === LANE_SHIFT_PATTERN.STAY) {
				lane = startingLane
			} else {
				// shift_right
				lane = ((startingLane - 1 + i) % maxLanes) + 1
			}

			cells.push({ heat, lane })
		}

		onPreviewChange(cells)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		startingHeat,
		startingLane,
		heatsCount,
		eventLaneShiftPattern,
		maxHeats,
		maxLanes,
		onPreviewChange,
	])

	// Handle external position updates (click-to-shift)
	useEffect(() => {
		if (externalPosition) {
			form.setValue("startingHeat", externalPosition.heat)
			form.setValue("startingLane", externalPosition.lane)
		}
	}, [externalPosition, form])

	// Validate on form changes
	useEffect(() => {
		const timer = setTimeout(async () => {
			if (!formValues.membershipId) {
				setConflicts([])
				setTruncationInfo(null)
				return
			}

			const [result] = await validateRotation.execute({
				trackWorkoutId,
				membershipId: formValues.membershipId,
				startingHeat: formValues.startingHeat,
				startingLane: formValues.startingLane,
				heatsCount: formValues.heatsCount,
				laneShiftPattern: eventLaneShiftPattern,
				rotationId: rotation?.id,
			})

			if (result?.data) {
				setConflicts(
					result.data.valid ? [] : result.data.conflicts.map((c) => c.message),
				)
				// Capture truncation info for display
				setTruncationInfo({
					effectiveHeatsCount: result.data.effectiveHeatsCount,
					requestedHeatsCount: result.data.requestedHeatsCount,
					truncated: result.data.truncated,
				})
			}
		}, 500) // Debounce

		return () => clearTimeout(timer)
	}, [
		formValues,
		trackWorkoutId,
		rotation?.id,
		validateRotation,
		eventLaneShiftPattern,
	])

	async function onSubmit(values: RotationFormValues) {
		if (isEditing) {
			const [result, error] = await updateRotation.execute({
				teamId,
				rotationId: rotation.id,
				laneShiftPattern: eventLaneShiftPattern,
				...values,
			})

			if (error) {
				toast({
					variant: "destructive",
					title: "Failed to update rotation",
					description: error.message,
				})
				return
			}

			if (result?.data) {
				onSuccess()
			}
		} else {
			const [result, error] = await createRotation.execute({
				teamId,
				competitionId,
				trackWorkoutId,
				laneShiftPattern: eventLaneShiftPattern,
				...values,
			})

			if (error) {
				toast({
					variant: "destructive",
					title: "Failed to create rotation",
					description: error.message,
				})
				return
			}

			if (result?.data) {
				onSuccess()
			}
		}
	}

	const selectedJudge = availableJudges.find(
		(j) => j.membershipId === formValues.membershipId,
	)

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				{/* Judge Selection */}
				<FormField
					control={form.control}
					name="membershipId"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Judge</FormLabel>
							<Select onValueChange={field.onChange} value={field.value}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select a judge" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{availableJudges.map((judge) => (
										<SelectItem
											key={judge.membershipId}
											value={judge.membershipId}
										>
											{`${judge.firstName ?? ""} ${judge.lastName ?? ""}`.trim() ||
												"Unknown"}
											{judge.credentials && ` (${judge.credentials})`}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Starting Heat */}
				<FormField
					control={form.control}
					name="startingHeat"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Starting Heat</FormLabel>
							<FormControl>
								<Input
									type="number"
									min={1}
									max={maxHeats}
									{...field}
									onChange={(e) => field.onChange(Number(e.target.value))}
								/>
							</FormControl>
							<FormDescription>Heat number (1-{maxHeats})</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Starting Lane */}
				<FormField
					control={form.control}
					name="startingLane"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Starting Lane</FormLabel>
							<FormControl>
								<Input
									type="number"
									min={1}
									max={maxLanes}
									{...field}
									onChange={(e) => field.onChange(Number(e.target.value))}
								/>
							</FormControl>
							<FormDescription>Lane number (1-{maxLanes})</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Heats Count */}
				<FormField
					control={form.control}
					name="heatsCount"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Number of Heats</FormLabel>
							<FormControl>
								<Input
									type="number"
									min={1}
									max={maxHeats}
									{...field}
									onChange={(e) => field.onChange(Number(e.target.value))}
								/>
							</FormControl>
							<FormDescription>
								How many consecutive heats (1-{maxHeats})
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Notes */}
				<FormField
					control={form.control}
					name="notes"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Notes (Optional)</FormLabel>
							<FormControl>
								<Textarea {...field} maxLength={500} rows={3} />
							</FormControl>
							<FormDescription>
								Special instructions or notes for this rotation
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Preview */}
				{selectedJudge && formValues.heatsCount > 0 && (
					<Alert>
						<AlertDescription>
							<div className="text-sm space-y-1">
								<p className="font-medium">Preview:</p>
								{truncationInfo?.truncated ? (
									<p>
										{`${selectedJudge.firstName ?? ""} ${selectedJudge.lastName ?? ""}`.trim()}{" "}
										will judge heats {formValues.startingHeat} through{" "}
										{formValues.startingHeat +
											truncationInfo.effectiveHeatsCount -
											1}{" "}
										<span className="text-muted-foreground">
											({truncationInfo.effectiveHeatsCount} of{" "}
											{truncationInfo.requestedHeatsCount} requested - remaining
											heats don't exist)
										</span>
									</p>
								) : (
									<p>
										{`${selectedJudge.firstName ?? ""} ${selectedJudge.lastName ?? ""}`.trim()}{" "}
										will judge heats {formValues.startingHeat} through{" "}
										{formValues.startingHeat + formValues.heatsCount - 1}
									</p>
								)}
								{eventLaneShiftPattern === LANE_SHIFT_PATTERN.STAY && (
									<p>Starting and staying in lane {formValues.startingLane}</p>
								)}
								{eventLaneShiftPattern === LANE_SHIFT_PATTERN.SHIFT_RIGHT && (
									<p>
										Starting at lane {formValues.startingLane}, shifting lanes
										each heat
									</p>
								)}
							</div>
						</AlertDescription>
					</Alert>
				)}

				{/* Conflicts */}
				{conflicts.length > 0 && (
					<Alert variant="destructive">
						<AlertDescription>
							<div className="text-sm space-y-1">
								<p className="font-medium">Conflicts:</p>
								<ul className="list-disc list-inside">
									{conflicts.map((msg) => (
										<li key={msg}>{msg}</li>
									))}
								</ul>
							</div>
						</AlertDescription>
					</Alert>
				)}

				{/* Actions */}
				<div className="flex justify-end gap-2 pt-2">
					<Button type="button" variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<Button
						type="submit"
						disabled={
							(isEditing
								? updateRotation.isPending
								: createRotation.isPending) || conflicts.length > 0
						}
					>
						{(isEditing
							? updateRotation.isPending
							: createRotation.isPending) && (
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						)}
						{isEditing ? "Update Rotation" : "Create Rotation"}
					</Button>
				</div>
			</form>
		</Form>
	)
}
