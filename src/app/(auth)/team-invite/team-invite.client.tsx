"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { useServerAction } from "zsa-react"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { teamInviteSchema } from "@/schemas/team-invite.schema"
import { acceptTeamInviteAction } from "./team-invite.action"

export default function TeamInviteClientComponent() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const token = searchParams.get("token")
	const hasCalledAcceptInvite = useRef(false)

	const {
		execute: handleAcceptInvite,
		isPending,
		error,
	} = useServerAction(acceptTeamInviteAction, {
		onError: ({ err }) => {
			toast.dismiss()
			toast.error(err.message || "Failed to accept team invitation")
		},
		onStart: () => {
			toast.loading("Processing your invitation...")
		},
		onSuccess: (data) => {
			toast.dismiss()
			toast.success("You've successfully joined the team!")

			router.refresh()

			// Redirect to the team dashboard, with fallback to general dashboard
			setTimeout(() => {
				if (data && typeof data === "object" && "teamSlug" in data) {
					router.push(`/settings/teams/${data.teamSlug}`)
				} else if (
					data &&
					typeof data === "object" &&
					data.data &&
					"teamSlug" in data.data
				) {
					router.push(`/settings/teams/${data.data.teamSlug}`)
				} else {
					// Fallback to dashboard if teamSlug is not found
					router.push("/settings")
				}
			}, 500)
		},
	})

	useEffect(() => {
		if (token && !hasCalledAcceptInvite.current) {
			const result = teamInviteSchema.safeParse({ token })
			if (result.success) {
				hasCalledAcceptInvite.current = true
				handleAcceptInvite(result.data)
			} else {
				toast.error("Invalid invitation token")
				router.push("/sign-in")
			}
		}
	}, [token, handleAcceptInvite, router])

	if (isPending) {
		return (
			<div className="container mx-auto px-4 flex items-center justify-center min-h-screen">
				<Card className="w-full max-w-md">
					<CardHeader className="text-center">
						<div className="flex flex-col items-center space-y-4">
							<Spinner size="large" />
							<CardTitle>Accepting Invitation</CardTitle>
							<CardDescription>
								Please wait while we process your team invitation...
							</CardDescription>
						</div>
					</CardHeader>
				</Card>
			</div>
		)
	}

	if (error) {
		return (
			<div className="container mx-auto px-4 flex items-center justify-center min-h-screen">
				<Card className="w-full max-w-md">
					<CardHeader>
						<CardTitle>Invitation Error</CardTitle>
						<CardDescription>
							{error?.message || "Failed to process the invitation"}
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<p className="text-sm text-muted-foreground">
							{error?.code === "CONFLICT"
								? "You are already a member of this team."
								: error?.code === "FORBIDDEN" &&
										error?.message.includes("limit")
									? "You've reached the maximum number of teams you can join."
									: "The invitation may have expired or been revoked."}
						</p>
						<Button
							variant="outline"
							className="w-full"
							onClick={() => router.push("/settings/teams")}
						>
							Go to Teams
						</Button>
					</CardContent>
				</Card>
			</div>
		)
	}

	if (!token) {
		return (
			<div className="container mx-auto px-4 flex items-center justify-center min-h-screen">
				<Card className="w-full max-w-md">
					<CardHeader>
						<CardTitle>Invalid Invitation Link</CardTitle>
						<CardDescription>
							The invitation link is invalid or has expired.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							variant="outline"
							className="w-full"
							onClick={() => router.push("/settings/teams")}
						>
							Go to Dashboard
						</Button>
					</CardContent>
				</Card>
			</div>
		)
	}

	return null
}
