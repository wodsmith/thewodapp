"use client"

import { useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { CheckCircle } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useTrackEvent } from "@/lib/posthog/hooks"
import { acceptTeamInvitationFn } from "@/server-fns/invite-fns"

interface AcceptInviteButtonProps {
	token: string
	competitionSlug?: string
	teamName?: string
	competitionId?: string
	answers?: Array<{ questionId: string; answer: string }>
	disabled?: boolean
}

interface AcceptResult {
	success: boolean
	teamId: string
	teamSlug: string
	teamName: string
	registrationId: string | null
	competitionId: string | null
	competitionName: string | null
	competitionSlug: string | null
	divisionName: string | null
	hasWaivers: boolean
}

export function AcceptInviteButton({
	token,
	competitionSlug,
	teamName,
	competitionId,
	answers,
	disabled,
}: AcceptInviteButtonProps) {
	const navigate = useNavigate()
	const [isPending, setIsPending] = useState(false)
	const acceptInvitation = useServerFn(acceptTeamInvitationFn)
	const trackEvent = useTrackEvent()

	async function handleAccept() {
		setIsPending(true)
		try {
			const result = (await acceptInvitation({
				data: { token, answers },
			})) as AcceptResult

			trackEvent("competition_team_invite_accepted", {
				competition_slug: competitionSlug,
				competition_id: competitionId,
				team_name: teamName,
			})

			// Navigate to team page with welcome param to show modal there
			if (result.competitionSlug && result.registrationId) {
				navigate({
					to: "/compete/$slug/teams/$registrationId",
					params: {
						slug: result.competitionSlug,
						registrationId: result.registrationId,
					},
					search: { welcome: true },
				})
			} else if (result.competitionSlug) {
				// Fallback to competition page if no registration ID
				navigate({
					to: "/compete/$slug",
					params: { slug: result.competitionSlug },
				})
			} else {
				navigate({ to: "/compete" })
			}
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to accept invitation"
			toast.error(message)

			trackEvent("competition_team_invite_accepted_failed", {
				competition_slug: competitionSlug,
				error_message: message,
			})
			setIsPending(false)
		}
	}

	return (
		<Button
			onClick={handleAccept}
			disabled={isPending || disabled}
			className="w-full"
			size="lg"
		>
			{isPending ? (
				"Joining Team..."
			) : disabled ? (
				"Please answer all required questions"
			) : (
				<>
					<CheckCircle className="mr-2 h-4 w-4" />
					Accept Invitation
				</>
			)}
		</Button>
	)
}
