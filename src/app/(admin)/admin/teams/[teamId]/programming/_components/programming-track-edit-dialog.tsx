"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRef, useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { useServerAction } from "zsa-react"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import {
	Form,
	FormControl,
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
import type { ProgrammingTrack } from "@/db/schema"
import { PROGRAMMING_TRACK_TYPE } from "@/db/schemas/programming"
import { getScalingGroupsAction } from "@/actions/scaling-actions"
import { updateProgrammingTrackAction } from "../../_actions/programming-track-actions"

const formSchema = z.object({
	name: z
		.string()
		.min(1, "Track name is required")
		.max(255, "Name is too long"),
	description: z.string().max(1000, "Description is too long").optional(),
	type: z.enum([
		PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED,
		PROGRAMMING_TRACK_TYPE.TEAM_OWNED,
		PROGRAMMING_TRACK_TYPE.OFFICIAL_3RD_PARTY,
	]),
	isPublic: z.boolean().optional().default(false),
	scalingGroupId: z
		.union([z.string(), z.null(), z.undefined()])
		.transform((val) => {
			// Coerce sentinel values to undefined
			if (val === "" || val === "none" || val === null || val === undefined) {
				return undefined
			}
			return val
		})
		.refine(
			(val) => {
				// If undefined, it's valid (optional field)
				if (val === undefined) return true
				// If present, must match the DB ID pattern: "sgrp_" prefix + allowed ID chars
				return /^sgrp_[a-zA-Z0-9_-]+$/.test(val)
			},
			{
				message: "Invalid scaling group ID format",
			},
		)
		.optional(),
})

type FormValues = z.infer<typeof formSchema>

interface ScalingGroup {
	id: string
	title: string
	description: string | null
	teamId: string | null
	isSystem: number
	isDefault: number
}

interface ProgrammingTrackEditDialogProps {
	teamId: string
	track: ProgrammingTrack
	trigger: React.ReactNode
	onTrackUpdated?: (track: ProgrammingTrack) => void
	open?: boolean
	onOpenChange?: (open: boolean) => void
}

export function ProgrammingTrackEditDialog({
	teamId,
	track,
	trigger,
	onTrackUpdated,
	open,
	onOpenChange,
}: ProgrammingTrackEditDialogProps) {
	const dialogCloseRef = useRef<HTMLButtonElement>(null)
	const [scalingGroups, setScalingGroups] = useState<ScalingGroup[]>([])
	const [isLoadingGroups, setIsLoadingGroups] = useState(false)

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: track.name,
			description: track.description || "",
			type: track.type as typeof PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED,
			isPublic: track.isPublic === 1,
			scalingGroupId: track.scalingGroupId || "none",
		},
	})

	const { execute: fetchScalingGroups } = useServerAction(
		getScalingGroupsAction,
		{
			onError: (error) => {
				console.error("Failed to fetch scaling groups:", error)
			},
		},
	)

	const { execute: updateTrack, isPending } = useServerAction(
		updateProgrammingTrackAction,
		{
			onError: (error) => {
				toast.error(error.err?.message || "Failed to update programming track")
			},
			onSuccess: (result) => {
				toast.success("Programming track updated successfully")
				console.log(
					"DEBUG: [UI] Programming track edit form submitted with data:",
					result,
				)
				if (result && result.data) {
					onTrackUpdated?.(result.data.data)
				}
				dialogCloseRef.current?.click()
			},
		},
	)

	// Fetch scaling groups when dialog opens
	useEffect(() => {
		if (open && teamId) {
			setIsLoadingGroups(true)
			fetchScalingGroups({ teamId, includeSystem: true })
				.then(([result]) => {
					if (result?.success && result.data) {
						setScalingGroups(result.data)
					}
				})
				.finally(() => {
					setIsLoadingGroups(false)
				})
		}
	}, [open, teamId, fetchScalingGroups])

	// Reset form when track changes
	useEffect(() => {
		form.reset({
			name: track.name,
			description: track.description || "",
			type: track.type as typeof PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED,
			isPublic: track.isPublic === 1,
			scalingGroupId: track.scalingGroupId || "none",
		})
	}, [track, form])

	const onSubmit = (data: FormValues) => {
		console.log(
			"DEBUG: [UI] Programming track edit form submitted with data:",
			data,
		)

		// Only include fields that have changed
		const changedFields: Parameters<typeof updateTrack>[0] = {
			teamId,
			trackId: track.id,
		}

		if (data.name !== track.name) changedFields.name = data.name
		if (data.description !== (track.description || "")) {
			changedFields.description = data.description || null
		}
		if (data.type !== track.type) changedFields.type = data.type
		if (data.isPublic !== (track.isPublic === 1))
			changedFields.isPublic = data.isPublic

		const newScalingGroupId =
			data.scalingGroupId === "none" ? null : data.scalingGroupId
		if (newScalingGroupId !== track.scalingGroupId) {
			changedFields.scalingGroupId = newScalingGroupId
		}

		updateTrack(changedFields)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="sm:max-w-md border-4 border-primary shadow-[8px_8px_0px_0px] shadow-primary rounded-none">
				<DialogHeader>
					<DialogTitle className="font-mono text-xl tracking-tight">
						Edit Programming Track
					</DialogTitle>
				</DialogHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-4 pt-4"
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="font-mono font-semibold">
										Track Name
									</FormLabel>
									<FormControl>
										<Input
											placeholder="Enter track name"
											{...field}
											className="border-2 border-primary rounded-none font-mono"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="font-mono font-semibold">
										Description (Optional)
									</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Enter track description"
											{...field}
											className="border-2 border-primary rounded-none font-mono"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="type"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="font-mono font-semibold">
										Track Type
									</FormLabel>
									<Select onValueChange={field.onChange} value={field.value}>
										<FormControl>
											<SelectTrigger className="border-2 border-primary rounded-none font-mono">
												<SelectValue placeholder="Select track type" />
											</SelectTrigger>
										</FormControl>
										<SelectContent className="border-2 border-primary rounded-none font-mono">
											<SelectItem
												value={PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED}
												className="font-mono"
											>
												Self-programmed
											</SelectItem>
											<SelectItem
												value={PROGRAMMING_TRACK_TYPE.TEAM_OWNED}
												className="font-mono"
											>
												Team-owned
											</SelectItem>
											<SelectItem
												value={PROGRAMMING_TRACK_TYPE.OFFICIAL_3RD_PARTY}
												className="font-mono"
											>
												Official 3rd Party
											</SelectItem>
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="scalingGroupId"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="font-mono font-semibold">
										Scaling Group
									</FormLabel>
									<Select
										onValueChange={field.onChange}
										value={field.value}
										disabled={isLoadingGroups}
									>
										<FormControl>
											<SelectTrigger className="border-2 border-primary rounded-none font-mono">
												<SelectValue placeholder="Select scaling group" />
											</SelectTrigger>
										</FormControl>
										<SelectContent className="border-2 border-primary rounded-none font-mono">
											<SelectItem value="none" className="font-mono">
												None (Use team default)
											</SelectItem>
											{scalingGroups.map((group) => (
												<SelectItem
													key={group.id}
													value={group.id}
													className="font-mono"
												>
													{group.title}
													{group.isDefault === 1 && " (Team Default)"}
													{group.isSystem === 1 && " (System)"}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="flex justify-end gap-2 pt-2">
							<DialogClose ref={dialogCloseRef} asChild>
								<Button
									type="button"
									className="border-2 border-primary shadow-[4px_4px_0px_0px] shadow-primary hover:shadow-[2px_2px_0px_0px] transition-all font-mono bg-black text-primary hover:bg-surface rounded-none"
								>
									Cancel
								</Button>
							</DialogClose>

							<Button
								type="submit"
								disabled={isPending}
								className="border-2 border-primary shadow-[4px_4px_0px_0px] shadow-primary hover:shadow-[2px_2px_0px_0px] transition-all font-mono rounded-none"
							>
								{isPending ? "Updating..." : "Update Track"}
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
