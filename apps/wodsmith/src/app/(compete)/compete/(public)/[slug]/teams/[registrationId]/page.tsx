import "server-only"

import type { Metadata } from "next"
import { CheckCircle, Clock, Crown, Mail, Users } from "lucide-react"
import { notFound, redirect } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { getCompetition, getTeamRoster } from "@/server/competitions"
import { getSessionFromCookie } from "@/utils/auth"
import { AffiliateEditor } from "./_components/affiliate-editor"
import { CopyInviteLinkButton } from "./_components/copy-invite-link-button"

type RegistrationMetadata = {
	affiliateName?: string // Legacy: captain's affiliate
	affiliates?: Record<string, string> // New: per-user affiliates
}

type PendingTeammate = {
	email: string
	firstName?: string | null
	lastName?: string | null
	affiliateName?: string | null
}

type Props = {
	params: Promise<{ slug: string; registrationId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params
	const competition = await getCompetition(slug)

	if (!competition) {
		return {
			title: "Team Not Found",
		}
	}

	return {
		title: `Team Management - ${competition.name}`,
		description: `Manage your team for ${competition.name}`,
		openGraph: {
			title: `Team Management - ${competition.name}`,
			description: `Manage your team for ${competition.name}`,
			images: [
				{
					url: `/api/og/competition?slug=${encodeURIComponent(slug)}`,
					width: 1200,
					height: 630,
					alt: competition.name,
				},
			],
		},
	}
}

export default async function TeamManagementPage({
	params,
}: {
	params: Promise<{ slug: string; registrationId: string }>
}) {
	const { slug, registrationId } = await params
	const session = await getSessionFromCookie()

	if (!session) {
		redirect(`/sign-in?returnTo=/compete/${slug}/teams/${registrationId}`)
	}

	const roster = await getTeamRoster(registrationId)

	if (!roster) {
		notFound()
	}

	const { registration, members, pending, isTeamRegistration } = roster

	// Get competition details
	const competition = registration.competition
		? Array.isArray(registration.competition)
			? registration.competition[0]
			: registration.competition
		: null

	const division = registration.division
		? Array.isArray(registration.division)
			? registration.division[0]
			: registration.division
		: null

	const _athleteTeam = registration.athleteTeam
		? Array.isArray(registration.athleteTeam)
			? registration.athleteTeam[0]
			: registration.athleteTeam
		: null

	// Check if current user is a team member
	const isTeamMember = members.some((m) => m.userId === session.userId)
	const isRegisteredUser = registration.userId === session.userId
	const canEditOwnAffiliate = isTeamMember || isRegisteredUser

	// Parse affiliates from registration metadata
	let memberAffiliates: Record<string, string> = {}
	let currentUserAffiliate: string | null = null

	if (registration.metadata) {
		try {
			const metadata = JSON.parse(registration.metadata) as RegistrationMetadata
			// Support new format (affiliates map) and legacy format (affiliateName)
			if (metadata.affiliates) {
				memberAffiliates = metadata.affiliates
			}
			// Legacy: captain's affiliate stored as affiliateName
			if (metadata.affiliateName && registration.captainUserId) {
				memberAffiliates[registration.captainUserId] = metadata.affiliateName
			}
			currentUserAffiliate = memberAffiliates[session.userId] || null
		} catch {
			// Invalid JSON, ignore
		}
	}

	// Parse pending teammates for their affiliate info
	let pendingTeammates: PendingTeammate[] = []
	if (registration.pendingTeammates) {
		try {
			pendingTeammates = JSON.parse(
				registration.pendingTeammates,
			) as PendingTeammate[]
		} catch {
			// Invalid JSON, ignore
		}
	}

	// Helper to get affiliate for a pending invite by email
	const getPendingAffiliate = (email: string): string | null => {
		const teammate = pendingTeammates.find(
			(t) => t.email.toLowerCase() === email.toLowerCase(),
		)
		return teammate?.affiliateName || null
	}

	if (!isTeamRegistration) {
		// For individual registrations, show affiliate editor only
		return (
			<div className="container mx-auto max-w-4xl py-8 space-y-6">
				<div className="space-y-2">
					<h1 className="text-3xl font-bold">My Registration</h1>
					<p className="text-muted-foreground">
						{competition?.name || "Competition"} -{" "}
						{division?.label || "Division"}
					</p>
				</div>

				<AffiliateEditor
					registrationId={registrationId}
					userId={session.userId}
					currentAffiliate={currentUserAffiliate}
					canEdit={canEditOwnAffiliate}
				/>
			</div>
		)
	}

	return (
		<div className="container mx-auto max-w-4xl py-8 space-y-6">
			{/* Header */}
			<div className="space-y-2">
				<h1 className="text-3xl font-bold">
					{registration.teamName || "Team"}
				</h1>
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
							{members.map((member) => {
								const memberAffiliate = member.userId
									? memberAffiliates[member.userId]
									: null
								return (
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
												<p className="text-xs text-muted-foreground mt-0.5">
													🏠 {memberAffiliate || "Independent"}
												</p>
											</div>
										</div>
										<Badge variant="outline" className="text-green-600">
											Confirmed
										</Badge>
									</div>
								)
							})}
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
								{pending.map((invite) => {
									const pendingAffiliate = getPendingAffiliate(invite.email)
									return (
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
													<p className="text-xs text-muted-foreground mt-0.5">
														🏠 {pendingAffiliate || "Independent"}
													</p>
												</div>
											</div>
											<div className="flex items-center gap-2">
												{isRegisteredUser && invite.token && (
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
									)
								})}
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* My Affiliate */}
			{canEditOwnAffiliate && (
				<AffiliateEditor
					registrationId={registrationId}
					userId={session.userId}
					currentAffiliate={currentUserAffiliate}
					canEdit={canEditOwnAffiliate}
				/>
			)}

			{/* Captain Actions */}
			{isRegisteredUser && pending.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">Captain Actions</CardTitle>
						<CardDescription>
							Share the invite links with your teammates so they can join the
							team
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">
							Teammates will receive an email with their invitation link. If
							they didn&apos;t receive it, you can copy the link above and share
							it directly.
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
