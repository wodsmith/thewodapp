"use client"

import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { VolunteerMembershipMetadata } from "@/db/schemas/volunteers"
import { VOLUNTEER_AVAILABILITY } from "@/db/schemas/volunteers"
import { updateVolunteerProfileFn } from "@/server-fns/volunteer-profile-fns"

interface EditVolunteerDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	metadata: VolunteerMembershipMetadata | null
	membershipId: string
	competitionSlug: string
}

/**
 * Dialog for editing volunteer profile information
 * Updates availability, credentials, and notes
 */
export function EditVolunteerDialog({
	open,
	onOpenChange,
	metadata,
	membershipId,
	competitionSlug,
}: EditVolunteerDialogProps) {
	const router = useRouter()
	const formRef = useRef<HTMLFormElement>(null)
	const [isPending, setIsPending] = useState(false)

	const updateProfile = useServerFn(updateVolunteerProfileFn)

	// Reset form when dialog opens
	useEffect(() => {
		if (open && formRef.current) {
			formRef.current.reset()
		}
	}, [open])

	async function handleSubmit(formData: FormData) {
		setIsPending(true)
		const availability = formData.get("availability") as string
		const credentials = formData.get("credentials") as string
		const availabilityNotes = formData.get("availabilityNotes") as string

		try {
			await updateProfile({
				data: {
					membershipId,
					competitionSlug,
					availability: availability as
						| "morning"
						| "afternoon"
						| "all_day"
						| undefined,
					credentials: credentials || undefined,
					availabilityNotes: availabilityNotes || undefined,
				},
			})
			toast.success("Profile updated successfully")
			onOpenChange(false)
			router.invalidate()
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to update profile",
			)
		} finally {
			setIsPending(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Edit Volunteer Profile</DialogTitle>
					<DialogDescription>
						Update your availability and credentials for this competition.
					</DialogDescription>
				</DialogHeader>

				<form ref={formRef} action={handleSubmit} className="space-y-4">
					{/* Credentials */}
					<div className="space-y-2">
						<Label htmlFor="credentials">Certifications / Credentials</Label>
						<Input
							id="credentials"
							name="credentials"
							placeholder="e.g., L1 Judge, L2, EMT, CPR certified..."
							defaultValue={metadata?.credentials || ""}
							disabled={isPending}
						/>
						<p className="text-xs text-muted-foreground">
							List any relevant certifications or judging credentials
						</p>
					</div>

					{/* Availability */}
					<div className="space-y-3">
						<Label>Availability</Label>
						<div className="space-y-2">
							<div className="flex items-center space-x-2">
								<input
									type="radio"
									id="availability-morning"
									name="availability"
									value={VOLUNTEER_AVAILABILITY.MORNING}
									defaultChecked={
										metadata?.availability === VOLUNTEER_AVAILABILITY.MORNING
									}
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
									defaultChecked={
										metadata?.availability === VOLUNTEER_AVAILABILITY.AFTERNOON
									}
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
									defaultChecked={
										!metadata?.availability ||
										metadata?.availability === VOLUNTEER_AVAILABILITY.ALL_DAY
									}
									disabled={isPending}
									className="h-4 w-4"
								/>
								<Label htmlFor="availability-all-day" className="font-normal">
									All Day
								</Label>
							</div>
						</div>
					</div>

					{/* Additional Notes */}
					<div className="space-y-2">
						<Label htmlFor="availabilityNotes">Additional Notes</Label>
						<Textarea
							id="availabilityNotes"
							name="availabilityNotes"
							placeholder="Anything else about your availability or experience..."
							rows={3}
							defaultValue={metadata?.availabilityNotes || ""}
							disabled={isPending}
						/>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isPending}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Saving...
								</>
							) : (
								"Save Changes"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
