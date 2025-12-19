"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useServerAction } from "@repo/zsa-react"
import { AlertCircle, Crown, Info } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { checkCanCreateProgrammingTrackAction } from "@/actions/entitlements-actions"
import { getScalingGroupsAction } from "@/actions/scaling-actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import type { LimitCheckResult } from "@/server/entitlements-checks"
import { createProgrammingTrackAction } from "../../_actions/programming-track-actions"

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

interface ProgrammingTrackCreateDialogProps {
	teamId: string
	trigger: React.ReactNode
	onTrackCreated?: (track: ProgrammingTrack) => void
	open?: boolean
	onOpenChange?: (open: boolean) => void
}

export function ProgrammingTrackCreateDialog({
	teamId,
	trigger,
	onTrackCreated,
	open,
	onOpenChange,
}: ProgrammingTrackCreateDialogProps) {
	const dialogCloseRef = useRef<HTMLButtonElement>(null)
	const [scalingGroups, setScalingGroups] = useState<ScalingGroup[]>([])
	const [isLoadingGroups, setIsLoadingGroups] = useState(false)
	const [limitCheck, setLimitCheck] = useState<
		(LimitCheckResult & { hasFeature: boolean }) | null
	>(null)

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			description: "",
			type: PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED,
			isPublic: false,
			scalingGroupId: undefined,
		},
	})

	const { execute: checkLimit } = useServerAction(
		checkCanCreateProgrammingTrackAction,
		{
			onSuccess: (result) => {
				if (result.data) {
					setLimitCheck(result.data.data)
				}
			},
		},
	)

	const { execute: fetchScalingGroups } = useServerAction(
		getScalingGroupsAction,
		{
			onError: (error) => {
				console.error("Failed to fetch scaling groups:", error)
			},
		},
	)

	const { execute: createTrack, isPending } = useServerAction(
		createProgrammingTrackAction,
		{
			onError: (error) => {
				toast.error(error.err?.message || "Failed to create programming track")
			},
			onSuccess: (result) => {
				toast.success("Programming track created successfully")
				console.log(
					"DEBUG: [UI] Programming track creation form submitted with data:",
					result.data,
				)
				if (result.data?.success && result.data?.data) {
					onTrackCreated?.(result.data.data)
				}
				form.reset()
				dialogCloseRef.current?.click()
			},
		},
	)

	// Fetch limit check and scaling groups when dialog opens
	useEffect(() => {
		if (open && teamId) {
			// Check limits
			checkLimit({ teamId })

			// Fetch scaling groups
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
	}, [open, teamId, checkLimit, fetchScalingGroups])

	const onSubmit = (data: FormValues) => {
		// Block if at limit or missing feature
		if (limitCheck && !limitCheck.canCreate) {
			toast.error(
				"You've reached your programming track limit. Please upgrade your plan.",
			)
			return
		}

		console.log(
			"DEBUG: [UI] Programming track creation form submitted with data:",
			data,
		)
		createTrack({
			teamId,
			...data,
			scalingGroupId:
				data.scalingGroupId === "none" ? undefined : data.scalingGroupId,
		})
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Create Programming Track</DialogTitle>
				</DialogHeader>

				{/* Show limit warning */}
				{limitCheck && !limitCheck.canCreate && (
					<Alert className="mb-4 border-primary/50 bg-background dark:bg-card">
						<AlertCircle className="h-4 w-4 text-primary" />
						<AlertTitle className="text-foreground">
							{!limitCheck.hasFeature
								? "Feature Not Available"
								: "Track Limit Reached"}
						</AlertTitle>
						<AlertDescription className="mt-2 space-y-2 text-muted-foreground">
							<p>{limitCheck.message}</p>
							<Button size="sm" variant="outline" asChild className="mt-2">
								<Link href="/settings/billing">
									<Crown className="h-4 w-4 mr-2" />
									Upgrade Plan
								</Link>
							</Button>
						</AlertDescription>
					</Alert>
				)}

				{/* Show usage info */}
				{limitCheck?.canCreate &&
					!limitCheck.isUnlimited &&
					limitCheck.message && (
						<Alert className="mb-4">
							<Info className="h-4 w-4" />
							<AlertTitle>Plan Usage</AlertTitle>
							<AlertDescription>{limitCheck.message}</AlertDescription>
						</Alert>
					)}

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Track Name</FormLabel>
									<FormControl>
										<Input placeholder="Enter track name" {...field} />
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
									<FormLabel>Description (Optional)</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Enter track description"
											{...field}
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
									<FormLabel>Track Type</FormLabel>
									<Select
										onValueChange={field.onChange}
										defaultValue={field.value}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select track type" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem
												value={PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED}
											>
												Self-programmed
											</SelectItem>
											<SelectItem value={PROGRAMMING_TRACK_TYPE.TEAM_OWNED}>
												Team-owned
											</SelectItem>
											<SelectItem
												value={PROGRAMMING_TRACK_TYPE.OFFICIAL_3RD_PARTY}
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
									<FormLabel>Scaling Group (Optional)</FormLabel>
									<Select
										onValueChange={field.onChange}
										value={field.value}
										disabled={isLoadingGroups}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select scaling group (optional)" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="none">
												None (Use team default)
											</SelectItem>
											{scalingGroups.map((group) => (
												<SelectItem key={group.id} value={group.id}>
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
								<Button type="button" variant="outline">
									Cancel
								</Button>
							</DialogClose>

							<Button
								type="submit"
								disabled={
									isPending || (limitCheck ? !limitCheck.canCreate : false)
								}
							>
								{isPending
									? "Creating..."
									: limitCheck && !limitCheck.canCreate
										? "Upgrade to Create"
										: "Create Track"}
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
