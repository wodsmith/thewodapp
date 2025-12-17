"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useServerAction } from "@repo/zsa-react"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
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
} from "@/db/schema"
import type { JudgeVolunteerInfo } from "@/server/judge-scheduling"

const rotationFormSchema = z.object({
	membershipId: z.string().min(1, "Judge is required"),
	startingHeat: z.number().int().min(1, "Starting heat must be at least 1"),
	startingLane: z.number().int().min(1, "Starting lane must be at least 1"),
	heatsCount: z
		.number()
		.int()
		.min(1, "Must cover at least 1 heat")
		.max(8, "Maximum 8 heats per rotation"),
	laneShiftPattern: z.enum([
		LANE_SHIFT_PATTERN.STAY,
		LANE_SHIFT_PATTERN.SHIFT_RIGHT,
		LANE_SHIFT_PATTERN.SHIFT_LEFT,
	]),
	notes: z.string().max(500, "Notes too long").optional(),
})

type RotationFormValues = z.infer<typeof rotationFormSchema>

interface RotationEditorProps {
	competitionId: string
	teamId: string
	trackWorkoutId: string
	maxHeats: number
	maxLanes: number
	availableJudges: JudgeVolunteerInfo[]
	rotation?: CompetitionJudgeRotation // For editing existing rotation
	onSuccess: () => void
	onCancel: () => void
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
	onSuccess,
	onCancel,
}: RotationEditorProps) {
	const isEditing = !!rotation
	const [conflicts, setConflicts] = useState<string[]>([])

	const createRotation = useServerAction(createJudgeRotationAction)
	const updateRotation = useServerAction(updateJudgeRotationAction)
	const validateRotation = useServerAction(validateRotationAction)

	const form = useForm<RotationFormValues>({
		resolver: zodResolver(rotationFormSchema),
		defaultValues: {
			membershipId: rotation?.membershipId ?? "",
			startingHeat: rotation?.startingHeat ?? 1,
			startingLane: rotation?.startingLane ?? 1,
			heatsCount: rotation?.heatsCount ?? 4,
			laneShiftPattern: rotation?.laneShiftPattern ?? LANE_SHIFT_PATTERN.STAY,
			notes: rotation?.notes ?? "",
		},
	})

	const formValues = form.watch()

	// Validate on form changes
	useEffect(() => {
		const timer = setTimeout(async () => {
			if (!formValues.membershipId) {
				setConflicts([])
				return
			}

			const [result] = await validateRotation.execute({
				trackWorkoutId,
				membershipId: formValues.membershipId,
				startingHeat: formValues.startingHeat,
				startingLane: formValues.startingLane,
				heatsCount: formValues.heatsCount,
				laneShiftPattern: formValues.laneShiftPattern,
				rotationId: rotation?.id,
			})

			if (result?.data) {
				setConflicts(
					result.data.valid
						? []
						: result.data.conflicts.map((c) => c.message),
				)
			}
		}, 500) // Debounce

		return () => clearTimeout(timer)
	}, [formValues, trackWorkoutId, rotation?.id, validateRotation])

	async function onSubmit(values: RotationFormValues) {
		if (isEditing) {
			const [result] = await updateRotation.execute({
				teamId,
				rotationId: rotation.id,
				...values,
			})

			if (result?.data) {
				onSuccess()
			}
		} else {
			const [result] = await createRotation.execute({
				teamId,
				competitionId,
				trackWorkoutId,
				...values,
			})

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
										<SelectItem key={judge.membershipId} value={judge.membershipId}>
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
									max={8}
									{...field}
									onChange={(e) => field.onChange(Number(e.target.value))}
								/>
							</FormControl>
							<FormDescription>
								How many consecutive heats (1-8)
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Lane Shift Pattern */}
				<FormField
					control={form.control}
					name="laneShiftPattern"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Lane Shift Pattern</FormLabel>
							<Select onValueChange={field.onChange} value={field.value}>
								<FormControl>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									<SelectItem value={LANE_SHIFT_PATTERN.STAY}>
										Stay - Same lane all heats
									</SelectItem>
									<SelectItem value={LANE_SHIFT_PATTERN.SHIFT_RIGHT}>
										Shift Right - Move to next lane each heat
									</SelectItem>
									<SelectItem value={LANE_SHIFT_PATTERN.SHIFT_LEFT}>
										Shift Left - Move to previous lane each heat
									</SelectItem>
								</SelectContent>
							</Select>
							<FormDescription>
								How the judge moves between lanes across heats
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
								<p>
									{`${selectedJudge.firstName ?? ""} ${selectedJudge.lastName ?? ""}`.trim()}{" "}
									will judge heats {formValues.startingHeat} through{" "}
									{formValues.startingHeat + formValues.heatsCount - 1}
								</p>
								{formValues.laneShiftPattern === LANE_SHIFT_PATTERN.STAY && (
									<p>Starting and staying in lane {formValues.startingLane}</p>
								)}
								{formValues.laneShiftPattern === LANE_SHIFT_PATTERN.SHIFT_RIGHT && (
									<p>Starting at lane {formValues.startingLane}, shifting right each heat</p>
								)}
								{formValues.laneShiftPattern === LANE_SHIFT_PATTERN.SHIFT_LEFT && (
									<p>Starting at lane {formValues.startingLane}, shifting left each heat</p>
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
							(isEditing ? updateRotation.isPending : createRotation.isPending) ||
							conflicts.length > 0
						}
					>
						{(isEditing ? updateRotation.isPending : createRotation.isPending) && (
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						)}
						{isEditing ? "Update Rotation" : "Create Rotation"}
					</Button>
				</div>
			</form>
		</Form>
	)
}
