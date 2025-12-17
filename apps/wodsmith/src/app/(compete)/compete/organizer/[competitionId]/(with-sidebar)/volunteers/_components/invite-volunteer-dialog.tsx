"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useServerAction } from "@repo/zsa-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { inviteUserAction } from "@/actions/team-membership-actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
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

const formSchema = z.object({
	email: z
		.string()
		.email("Please enter a valid email address")
		.min(1, "Email is required"),
	roleTypes: z
		.array(
			z.enum([
				"judge",
				"head_judge",
				"scorekeeper",
				"emcee",
				"floor_manager",
				"media",
				"general",
			]),
		)
		.min(1, "Select at least one role type"),
})

type FormValues = z.infer<typeof formSchema>

type VolunteerRoleType =
	| "judge"
	| "head_judge"
	| "scorekeeper"
	| "emcee"
	| "floor_manager"
	| "media"
	| "general"

const ROLE_TYPE_OPTIONS: { value: VolunteerRoleType; label: string }[] = [
	{ value: "judge", label: "Judge" },
	{ value: "head_judge", label: "Head Judge" },
	{ value: "scorekeeper", label: "Scorekeeper" },
	{ value: "emcee", label: "Emcee" },
	{ value: "floor_manager", label: "Floor Manager" },
	{ value: "media", label: "Media" },
	{ value: "general", label: "General" },
]

interface InviteVolunteerDialogProps {
	competitionTeamId: string
	open: boolean
	onOpenChange: (open: boolean) => void
}

/**
 * Dialog for inviting new volunteers to a competition
 * Uses existing team invite flow with volunteer role assignment
 */
export function InviteVolunteerDialog({
	competitionTeamId,
	open,
	onOpenChange,
}: InviteVolunteerDialogProps) {
	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: "",
			roleTypes: [],
		},
	})

	const { execute } = useServerAction(inviteUserAction, {
		onError: (error) => {
			toast.dismiss()
			toast.error(error.err?.message || "Failed to invite volunteer")
			console.error("Invite error:", error)
		},
		onStart: () => {
			toast.loading("Sending invitation...")
		},
		onSuccess: () => {
			toast.dismiss()
			toast.success("Volunteer invitation sent")
			form.reset()

			// Close dialog after delay
			setTimeout(() => {
				onOpenChange(false)
			}, 1500)
		},
	})

	const onSubmit = async (data: FormValues) => {
		// Create metadata for volunteer role types
		const metadata = {
			volunteerRoleTypes: data.roleTypes,
		}

		execute({
			teamId: competitionTeamId,
			email: data.email,
			roleId: "volunteer",
			isSystemRole: true,
			metadata: JSON.stringify(metadata),
		})
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Invite Volunteer</DialogTitle>
				</DialogHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-4 pt-4"
					>
						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Email Address</FormLabel>
									<FormControl>
										<Input
											type="email"
											placeholder="volunteer@example.com"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="roleTypes"
							render={() => (
								<FormItem>
									<div className="mb-4">
										<FormLabel>Role Types</FormLabel>
										<FormDescription>
											Select the volunteer role types for this person
										</FormDescription>
									</div>
									{ROLE_TYPE_OPTIONS.map((option) => (
										<FormField
											key={option.value}
											control={form.control}
											name="roleTypes"
											render={({ field }) => {
												return (
													<FormItem
														key={option.value}
														className="flex flex-row items-start space-x-3 space-y-0"
													>
														<FormControl>
															<Checkbox
																checked={field.value?.includes(option.value)}
																onCheckedChange={(checked) => {
																	return checked
																		? field.onChange([
																				...field.value,
																				option.value,
																			])
																		: field.onChange(
																				field.value?.filter(
																					(value) => value !== option.value,
																				),
																			)
																}}
															/>
														</FormControl>
														<FormLabel className="font-normal">
															{option.label}
														</FormLabel>
													</FormItem>
												)
											}}
										/>
									))}
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="flex justify-end gap-2 pt-2">
							<DialogClose asChild>
								<Button type="button" variant="outline">
									Cancel
								</Button>
							</DialogClose>

							<Button type="submit">Send Invitation</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
