"use server"

import { notFound, redirect } from "next/navigation"
import { Copy, Users, Clock, CheckCircle, Mail, Crown } from "lucide-react"
import { getSessionFromCookie } from "@/utils/auth"
import { getTeamRoster, getCompetition } from "@/server/competitions"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CopyInviteLinkButton } from "./_components/copy-invite-link-button"

export default async function TeamManagementPage({
	params,
}: {
	params: Promise<{ slug: string; registrationId: string }>
}) {
	const { slug, registrationId } = await params
	const session = await getSessionFromCookie()

	if (!session) {
		redirect(`/auth/sign-in?returnTo=/compete/${slug}/teams/${registrationId}`)
	}

	const roster = await getTeamRoster(registrationId)

	if (!roster) {
		notFound()
	}

	const { registration, members, pending, isTeamRegistration } = roster

	// Get competition details
	const competition = registration.competition
		? (Array.isArray(registration.competition)
				? registration.competition[0]
				: registration.competition)
		: null

	const division = registration.division
		? (Array.isArray(registration.division)
				? registration.division[0]
				: registration.division)
		: null

	const athleteTeam = registration.athleteTeam
		? (Array.isArray(registration.athleteTeam)
				? registration.athleteTeam[0]
				: registration.athleteTeam)
		: null

	// Check if current user is the captain
	const isCaptain = registration.captainUserId === session.userId

	if (!isTeamRegistration) {
		return (
			<div className="container mx-auto max-w-4xl py-8">
				<Card>
					<CardContent className="py-8 text-center">
						<p className="text-muted-foreground">
							This is an individual registration. No team roster to display.
						</p>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="container mx-auto max-w-4xl py-8 space-y-6">
			{/* Header */}
			<div className="space-y-2">
				<h1 className="text-3xl font-bold">{registration.teamName || "Team"}</h1>
				<p className="text-muted-foreground">
					{competition?.name || "Competition"} - {division?.label || "Division"}
				</p>
			</div>

			{/* Team Status Card */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Users className="w-5 h-5" />
						Team Roster
					</CardTitle>
					<CardDescription>
						{members.length} confirmed, {pending.length} pending invitation
						{pending.length !== 1 ? "s" : ""}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Confirmed Members */}
					<div className="space-y-3">
						<h4 className="text-sm font-medium flex items-center gap-2">
							<CheckCircle className="w-4 h-4 text-green-500" />
							Confirmed Members
						</h4>
						<div className="space-y-2">
							{members.map((member) => (
								<div
									key={member.id}
									className="flex items-center justify-between p-3 rounded-lg border bg-card"
								>
									<div className="flex items-center gap-3">
										<Avatar className="w-10 h-10">
											<AvatarImage src={member.user?.avatar || undefined} />
											<AvatarFallback>
												{member.user?.firstName?.[0] || "?"}
												{member.user?.lastName?.[0] || ""}
											</AvatarFallback>
										</Avatar>
										<div>
											<div className="flex items-center gap-2">
												<span className="font-medium">
													{member.user?.firstName} {member.user?.lastName}
												</span>
												{member.isCaptain && (
													<Badge variant="secondary" className="text-xs">
														<Crown className="w-3 h-3 mr-1" />
														Captain
													</Badge>
												)}
											</div>
											<p className="text-sm text-muted-foreground">
												{member.user?.email}
											</p>
										</div>
									</div>
									<Badge variant="outline" className="text-green-600">
										Confirmed
									</Badge>
								</div>
							))}
						</div>
					</div>

					{/* Pending Invitations */}
					{pending.length > 0 && (
						<div className="space-y-3">
							<h4 className="text-sm font-medium flex items-center gap-2">
								<Clock className="w-4 h-4 text-yellow-500" />
								Pending Invitations
							</h4>
							<div className="space-y-2">
								{pending.map((invite) => (
									<div
										key={invite.id}
										className="flex items-center justify-between p-3 rounded-lg border bg-card"
									>
										<div className="flex items-center gap-3">
											<Avatar className="w-10 h-10">
												<AvatarFallback>
													<Mail className="w-4 h-4" />
												</AvatarFallback>
											</Avatar>
											<div>
												<p className="font-medium">{invite.email}</p>
												<p className="text-sm text-muted-foreground">
													Invited{" "}
													{invite.invitedAt
														? new Date(invite.invitedAt).toLocaleDateString()
														: ""}
												</p>
											</div>
										</div>
										<div className="flex items-center gap-2">
											{isCaptain && invite.token && (
												<CopyInviteLinkButton
													token={invite.token}
													competitionSlug={slug}
												/>
											)}
											<Badge variant="outline" className="text-yellow-600">
												Pending
											</Badge>
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Captain Actions */}
			{isCaptain && pending.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">Captain Actions</CardTitle>
						<CardDescription>
							Share the invite links with your teammates so they can join the team
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">
							Teammates will receive an email with their invitation link. If they
							didn&apos;t receive it, you can copy the link above and share it
							directly.
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
