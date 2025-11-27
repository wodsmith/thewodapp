"use client"

import { useRouter } from "next/navigation"
import { CheckCircle } from "lucide-react"
import { useServerAction } from "@repo/zsa-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { acceptTeamInvitationAction } from "@/actions/team-actions"

type Props = {
	token: string
	competitionSlug?: string
}

export function AcceptInviteButton({ token, competitionSlug }: Props) {
	const router = useRouter()

	const { execute, isPending } = useServerAction(acceptTeamInvitationAction, {
		onSuccess: () => {
			toast.success("You've joined the team!")
			if (competitionSlug) {
				router.push(`/compete/${competitionSlug}`)
			} else {
				router.push("/compete")
			}
		},
		onError: ({ err }) => {
			toast.error(err?.message || "Failed to accept invitation")
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
				"Joining Team..."
			) : (
				<>
					<CheckCircle className="w-4 h-4 mr-2" />
					Accept Invitation
				</>
			)}
		</Button>
	)
}
