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
}

export function AcceptInviteButton({
	token,
	competitionSlug,
	teamName,
	competitionId,
}: AcceptInviteButtonProps) {
	const navigate = useNavigate()
	const [isPending, setIsPending] = useState(false)
	const acceptInvitation = useServerFn(acceptTeamInvitationFn)
	const trackEvent = useTrackEvent()

	async function handleAccept() {
		setIsPending(true)
		try {
			await acceptInvitation({ data: { token } })
			toast.success("You've joined the team!")

			trackEvent("competition_team_invite_accepted", {
				competition_slug: competitionSlug,
				competition_id: competitionId,
				team_name: teamName,
			})

			if (competitionSlug) {
				navigate({ to: "/compete/$slug", params: { slug: competitionSlug } })
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
		} finally {
			setIsPending(false)
		}
	}

	return (
		<Button
			onClick={handleAccept}
			disabled={isPending}
			className="w-full"
			size="lg"
		>
			{isPending ? (
				"Joining Team..."
			) : (
				<>
					<CheckCircle className="mr-2 h-4 w-4" />
					Accept Invitation
				</>
			)}
		</Button>
	)
}
