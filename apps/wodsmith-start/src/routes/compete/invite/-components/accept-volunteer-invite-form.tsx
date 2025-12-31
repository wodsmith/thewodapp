"use client"

import { useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { CheckCircle, Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { VOLUNTEER_AVAILABILITY } from "@/db/schemas/volunteers"
import { useTrackEvent } from "@/lib/posthog/hooks"
import { acceptVolunteerInviteFn } from "@/server-fns/invite-fns"

interface AcceptVolunteerInviteFormProps {
	token: string
	competitionSlug?: string
	competitionName?: string
	competitionId?: string
}

/**
 * Form for accepting a direct volunteer invitation
 * Collects availability and credentials before accepting
 */
export function AcceptVolunteerInviteForm({
	token,
	competitionSlug,
	competitionName,
	competitionId,
}: AcceptVolunteerInviteFormProps) {
	const navigate = useNavigate()
	const [isPending, setIsPending] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const acceptInvite = useServerFn(acceptVolunteerInviteFn)
	const trackEvent = useTrackEvent()

	async function handleSubmit(formData: FormData) {
		setIsPending(true)
		setError(null)

		const availabilityValue = formData.get("availability") as string

		try {
			await acceptInvite({
				data: {
					token,
					availability: availabilityValue as
						| "morning"
						| "afternoon"
						| "all_day",
					availabilityNotes:
						(formData.get("availabilityNotes") as string) || undefined,
					credentials: (formData.get("credentials") as string) || undefined,
					signupPhone: (formData.get("phone") as string) || undefined,
				},
			})

			toast.success("You're now a volunteer!")

			trackEvent("competition_volunteer_invite_accepted", {
				competition_slug: competitionSlug,
				competition_id: competitionId,
				competition_name: competitionName,
			})

			if (competitionSlug) {
				navigate({ to: "/compete/$slug", params: { slug: competitionSlug } })
			} else {
				navigate({ to: "/compete" })
			}
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to accept invitation"
			setError(message)
			toast.error(message)

			trackEvent("competition_volunteer_invite_accepted_failed", {
				competition_slug: competitionSlug,
				error_message: message,
			})
		} finally {
			setIsPending(false)
		}
	}

	return (
		<form action={handleSubmit} className="space-y-6">
			{/* Phone Number */}
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

			{/* Credentials */}
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

			{/* Availability */}
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
					Select when you&apos;ll be available to volunteer
				</p>
			</div>

			{/* Additional Notes */}
			<div className="space-y-2">
				<Label htmlFor="availabilityNotes">Additional Notes</Label>
				<Textarea
					id="availabilityNotes"
					name="availabilityNotes"
					placeholder="Anything else you'd like us to know about your availability or experience..."
					rows={2}
					disabled={isPending}
				/>
			</div>

			{error && (
				<div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
					<p className="text-sm text-destructive">
						{error || "Something went wrong. Please try again."}
					</p>
				</div>
			)}

			<Button type="submit" className="w-full" size="lg" disabled={isPending}>
				{isPending ? (
					<>
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						Accepting...
					</>
				) : (
					<>
						<CheckCircle className="mr-2 h-4 w-4" />
						Accept & Volunteer
					</>
				)}
			</Button>
		</form>
	)
}
