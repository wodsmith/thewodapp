"use client"

import { PlusIcon } from "@heroicons/react/24/outline"
import { zodResolver } from "@hookform/resolvers/zod"
import { useServerAction } from "@repo/zsa-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { submitOrganizerRequestAction } from "@/actions/organizer-onboarding-actions"
import { createTeamAction } from "@/actions/team-actions"
import { Captcha } from "@/components/captcha"
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
import type { Team } from "@/db/schema"
import { catchaSchema } from "@/schemas/catcha.schema"
import { useConfigStore } from "@/state/config"

const CREATE_NEW_TEAM = "__create_new__"

const formSchema = z.object({
	teamId: z.string().min(1, "Please select a team"),
	newTeamName: z.string().optional(),
	reason: z
		.string()
		.min(10, "Please provide more detail about why you want to organize")
		.max(2000, "Reason is too long"),
	captchaToken: catchaSchema,
})

type FormValues = z.infer<typeof formSchema>

interface OnboardFormProps {
	teams: Team[]
}

export function OnboardForm({ teams }: OnboardFormProps) {
	const router = useRouter()
	const [isCreatingTeam, setIsCreatingTeam] = useState(false)
	const { isTurnstileEnabled } = useConfigStore()

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			teamId: teams.length === 1 ? teams[0]?.id : "",
			newTeamName: "",
			reason: "",
			captchaToken: "",
		},
	})

	const watchTeamId = form.watch("teamId")
	const captchaToken = useWatch({
		control: form.control,
		name: "captchaToken",
	})
	const showNewTeamFields = watchTeamId === CREATE_NEW_TEAM

	const { execute: submitRequest, isPending: isSubmitting } = useServerAction(
		submitOrganizerRequestAction,
		{
			onSuccess: () => {
				toast.success("Application submitted successfully!")
				router.push("/compete/organizer/onboard/pending")
			},
			onError: (error) => {
				toast.error(error.err?.message || "Failed to submit application")
			},
		},
	)

	const { execute: createTeam, isPending: isCreating } = useServerAction(
		createTeamAction,
		{
			onSuccess: async (result) => {
				if (result.data?.data?.teamId) {
					// Submit the organizer request with the new team
					await submitRequest({
						teamId: result.data.data.teamId,
						reason: form.getValues("reason"),
						captchaToken: form.getValues("captchaToken"),
					})
				}
			},
			onError: (error) => {
				toast.error(error.err?.message || "Failed to create team")
				setIsCreatingTeam(false)
			},
		},
	)

	const onSubmit = async (data: FormValues) => {
		if (data.teamId === CREATE_NEW_TEAM) {
			if (!data.newTeamName?.trim()) {
				form.setError("newTeamName", { message: "Team name is required" })
				return
			}
			setIsCreatingTeam(true)
			await createTeam({ name: data.newTeamName.trim() })
		} else {
			await submitRequest({
				teamId: data.teamId,
				reason: data.reason,
				captchaToken: data.captchaToken,
			})
		}
	}

	const isPending = isSubmitting || isCreating || isCreatingTeam

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
				{/* Team Selection */}
				<FormField
					control={form.control}
					name="teamId"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Organizing Team</FormLabel>
							<Select onValueChange={field.onChange} value={field.value}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select a team" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{teams.map((team) => (
										<SelectItem key={team.id} value={team.id}>
											{team.name}
										</SelectItem>
									))}
									<SelectItem value={CREATE_NEW_TEAM}>
										<span className="flex items-center gap-2">
											<PlusIcon className="h-4 w-4" />
											Create new team
										</span>
									</SelectItem>
								</SelectContent>
							</Select>
							<FormDescription>
								The team that will be listed as the competition organizer
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* New Team Name (conditional) */}
				{showNewTeamFields && (
					<FormField
						control={form.control}
						name="newTeamName"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Team Name</FormLabel>
								<FormControl>
									<Input placeholder="e.g., CrossFit Downtown" {...field} />
								</FormControl>
								<FormDescription>
									This will be your organizing team's name
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
				)}

				{/* Reason */}
				<FormField
					control={form.control}
					name="reason"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Why do you want to organize competitions?</FormLabel>
							<FormControl>
								<Textarea
									placeholder="Tell us about the competitions you plan to host, your experience organizing events, and what draws you to the WODsmith platform..."
									className="min-h-[120px]"
									{...field}
								/>
							</FormControl>
							<FormDescription>
								This helps us understand your needs and approve your application
								faster
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Captcha */}
				<Captcha
					onSuccess={(token: string) => form.setValue("captchaToken", token)}
					validationError={form.formState.errors.captchaToken?.message}
				/>

				{/* Submit */}
				<div className="flex justify-end gap-4 pt-4">
					<Button
						type="button"
						variant="outline"
						onClick={() => router.back()}
						disabled={isPending}
					>
						Cancel
					</Button>
					<Button
						type="submit"
						disabled={isPending || (isTurnstileEnabled && !captchaToken)}
					>
						{isPending ? "Submitting..." : "Submit Application"}
					</Button>
				</div>
			</form>
		</Form>
	)
}
