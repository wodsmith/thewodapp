"use client"

import { useServerAction } from "@repo/zsa-react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { useState } from "react"
import { submitVolunteerSignupAction } from "@/actions/volunteer-actions"
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
import { Textarea } from "@/components/ui/textarea"
import { VOLUNTEER_AVAILABILITY } from "@/db/schemas/volunteers"

interface VolunteerSignupFormProps {
	competition: {
		id: string
		name: string
		slug: string
	}
	competitionTeamId: string
}

/**
 * Public volunteer sign-up form
 * No authentication required - anyone can fill out this form
 */
export function VolunteerSignupForm({
	competition,
	competitionTeamId,
}: VolunteerSignupFormProps) {
	const [submitted, setSubmitted] = useState(false)

	const { execute, isPending, error } = useServerAction(
		submitVolunteerSignupAction,
		{
			onSuccess: () => {
				setSubmitted(true)
			},
		},
	)

	function handleSubmit(formData: FormData) {
		const availabilityValue = formData.get("availability") as string
		const data = {
			competitionTeamId,
			signupName: formData.get("name") as string,
			signupEmail: formData.get("email") as string,
			signupPhone: (formData.get("phone") as string) || undefined,
			credentials: (formData.get("credentials") as string) || undefined,
			availability: availabilityValue as
				| "morning"
				| "afternoon"
				| "all_day"
				| undefined,
			availabilityNotes:
				(formData.get("availabilityNotes") as string) || undefined,
			// Honeypot field
			website: (formData.get("website") as string) || undefined,
		}

		// Don't await - onSuccess callback handles the state update
		// Awaiting can cause the spinner to hang due to a race condition
		// in useServerAction's Promise resolution
		execute(data)
	}

	if (submitted) {
		return (
			<Card>
				<CardContent className="pt-6">
					<div className="text-center space-y-4">
						<div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
							<CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
						</div>
						<h2 className="text-2xl font-bold">Thank you for signing up!</h2>
						<p className="text-muted-foreground">
							Your volunteer application for{" "}
							<span className="font-medium">{competition.name}</span> has been
							submitted. The organizers will review your application and contact
							you with next steps.
						</p>
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Volunteer for {competition.name}</CardTitle>
				<CardDescription>
					Fill out this form to sign up as a volunteer. The organizers will
					review your application and reach out with more information.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form action={handleSubmit} className="space-y-6">
					{/* Honeypot field - hidden from humans, visible to bots */}
					<div className="sr-only" aria-hidden="true">
						<Label htmlFor="website">Website</Label>
						<Input
							type="text"
							id="website"
							name="website"
							tabIndex={-1}
							autoComplete="off"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="name">
							Full Name <span className="text-destructive">*</span>
						</Label>
						<Input
							type="text"
							id="name"
							name="name"
							required
							placeholder="Your full name"
							disabled={isPending}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="email">
							Email <span className="text-destructive">*</span>
						</Label>
						<Input
							type="email"
							id="email"
							name="email"
							required
							placeholder="your@email.com"
							disabled={isPending}
						/>
						<p className="text-sm text-muted-foreground">
							We'll use this to contact you about your volunteer assignment.
						</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="phone">Phone Number</Label>
						<Input
							type="tel"
							id="phone"
							name="phone"
							placeholder="(555) 123-4567"
							disabled={isPending}
						/>
						<p className="text-sm text-muted-foreground">
							Optional - for day-of coordination
						</p>
					</div>

				<div className="space-y-2">
					<Label htmlFor="credentials">Certifications / Credentials</Label>
					<Textarea
						id="credentials"
						name="credentials"
						placeholder="e.g., CrossFit L1 Judge, CrossFit L2, EMT, First Aid/CPR certified..."
						rows={2}
						disabled={isPending}
					/>
					<p className="text-sm text-muted-foreground">
						List any relevant certifications or judging credentials you hold
					</p>
				</div>

				<div className="space-y-3">
					<Label>
						Availability <span className="text-destructive">*</span>
					</Label>
					<div className="space-y-2">
						<div className="flex items-center space-x-2">
							<input
								type="radio"
								id="availability-morning"
								name="availability"
								value={VOLUNTEER_AVAILABILITY.MORNING}
								required
								disabled={isPending}
								className="h-4 w-4"
							/>
							<Label htmlFor="availability-morning" className="font-normal">
								Morning
							</Label>
						</div>
						<div className="flex items-center space-x-2">
							<input
								type="radio"
								id="availability-afternoon"
								name="availability"
								value={VOLUNTEER_AVAILABILITY.AFTERNOON}
								required
								disabled={isPending}
								className="h-4 w-4"
							/>
							<Label htmlFor="availability-afternoon" className="font-normal">
								Afternoon
							</Label>
						</div>
						<div className="flex items-center space-x-2">
							<input
								type="radio"
								id="availability-all-day"
								name="availability"
								value={VOLUNTEER_AVAILABILITY.ALL_DAY}
								required
								disabled={isPending}
								className="h-4 w-4"
								defaultChecked
							/>
							<Label htmlFor="availability-all-day" className="font-normal">
								All Day
							</Label>
						</div>
					</div>
					<p className="text-sm text-muted-foreground">
						Select when you'll be available to volunteer
					</p>
				</div>

				<div className="space-y-2">
					<Label htmlFor="availabilityNotes">Additional Notes</Label>
					<Textarea
						id="availabilityNotes"
						name="availabilityNotes"
						placeholder="Anything else you'd like us to know about your availability, experience, or preferences..."
						rows={3}
						disabled={isPending}
					/>
				</div>

					{error && (
						<div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
							<p className="text-sm text-destructive">
								{error.message || "Something went wrong. Please try again."}
							</p>
						</div>
					)}

					<Button type="submit" className="w-full" disabled={isPending}>
						{isPending ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Submitting...
							</>
						) : (
							"Sign Up to Volunteer"
						)}
					</Button>

					<p className="text-center text-sm text-muted-foreground">
						By signing up, you're expressing interest in volunteering. The
						organizers will reach out to confirm your participation.
					</p>
				</form>
			</CardContent>
		</Card>
	)
}
