"use client"

import { useServerAction } from "@repo/zsa-react"
import { CheckCircle, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import posthog from "posthog-js"
import { toast } from "sonner"
import { acceptVolunteerInviteAction } from "@/actions/volunteer-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { VOLUNTEER_AVAILABILITY } from "@/db/schemas/volunteers"

type Props = {
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
}: Props) {
	const router = useRouter()

	const { execute, isPending, error } = useServerAction(
		acceptVolunteerInviteAction,
		{
			onSuccess: () => {
				toast.success("You're now a volunteer!")
				posthog.capture("competition_volunteer_invite_accepted", {
					competition_slug: competitionSlug,
					competition_id: competitionId,
					competition_name: competitionName,
				})
				if (competitionSlug) {
					router.push(`/compete/${competitionSlug}`)
				} else {
					router.push("/compete")
				}
			},
			onError: ({ err }) => {
				toast.error(err?.message || "Failed to accept invitation")
				posthog.capture("competition_volunteer_invite_accepted_failed", {
					competition_slug: competitionSlug,
					error_message: err?.message,
				})
			},
		},
	)

	function handleSubmit(formData: FormData) {
		const availabilityValue = formData.get("availability") as string

		execute({
			token,
			availability: availabilityValue as "morning" | "afternoon" | "all_day",
			availabilityNotes:
				(formData.get("availabilityNotes") as string) || undefined,
			credentials: (formData.get("credentials") as string) || undefined,
			signupPhone: (formData.get("phone") as string) || undefined,
		})
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
				<div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
					<p className="text-sm text-destructive">
						{error.message || "Something went wrong. Please try again."}
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
						<CheckCircle className="w-4 h-4 mr-2" />
						Accept & Volunteer
					</>
				)}
			</Button>
		</form>
	)
}
