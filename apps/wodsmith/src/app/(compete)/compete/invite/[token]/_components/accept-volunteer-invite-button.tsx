"use client"

import { useServerAction } from "@repo/zsa-react"
import { CheckCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import posthog from "posthog-js"
import { toast } from "sonner"
import { acceptTeamInvitationAction } from "@/actions/team-actions"
import { Button } from "@/components/ui/button"

type Props = {
	token: string
	competitionSlug?: string
	competitionName?: string
	competitionId?: string
}

/**
 * Button for accepting a direct volunteer invitation
 * Uses the same acceptTeamInvitation action as teammate invites,
 * but with volunteer-specific messaging
 */
export function AcceptVolunteerInviteButton({
	token,
	competitionSlug,
	competitionName,
	competitionId,
}: Props) {
	const router = useRouter()

	const { execute, isPending } = useServerAction(acceptTeamInvitationAction, {
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
	})

	return (
		<Button
			onClick={() => execute({ token })}
			disabled={isPending}
			className="w-full"
			size="lg"
		>
			{isPending ? (
				"Accepting..."
			) : (
				<>
					<CheckCircle className="w-4 h-4 mr-2" />
					Accept & Volunteer
				</>
			)}
		</Button>
	)
}
