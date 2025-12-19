"use server"

import {
	AlertCircle,
	Calendar,
	CheckCircle2,
	Clock,
	LogIn,
	Trophy,
	UserPlus,
	Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { getTeammateInvite, getVolunteerInvite } from "@/server/competitions"
import { checkEmailExists } from "@/server/user"
import { getSessionFromCookie } from "@/utils/auth"
import { AcceptInviteButton } from "./_components/accept-invite-button"
import { InviteSignUpForm } from "./_components/invite-signup-form"

export default async function CompeteInvitePage({
	params,
}: {
	params: Promise<{ token: string }>
}) {
	const { token } = await params
	const session = await getSessionFromCookie()

	// First check if this is a volunteer invite
	const volunteerInvite = await getVolunteerInvite(token)
	if (volunteerInvite) {
		return <VolunteerInviteStatus invite={volunteerInvite} />
	}

	// Get teammate invite details
	const invite = await getTeammateInvite(token)

	if (!invite) {
		return (
			<div className="container mx-auto max-w-lg py-16">
				<Card>
					<CardContent className="py-8 text-center space-y-4">
						<AlertCircle className="w-12 h-12 mx-auto text-destructive" />
						<h2 className="text-xl font-semibold">Invite Not Found</h2>
						<p className="text-muted-foreground">
							This invitation link is invalid or has expired.
						</p>
						<Button asChild variant="outline">
							<a href="/compete">Browse Competitions</a>
						</Button>
					</CardContent>
				</Card>
			</div>
		)
	}

	// Check if already accepted
	if (invite.acceptedAt) {
		return (
			<div className="container mx-auto max-w-lg py-16">
				<Card>
					<CardContent className="py-8 text-center space-y-4">
						<AlertCircle className="w-12 h-12 mx-auto text-yellow-500" />
						<h2 className="text-xl font-semibold">Invite Already Accepted</h2>
						<p className="text-muted-foreground">
							This invitation has already been accepted.
						</p>
						{invite.competition && (
							<Button asChild>
								<a href={`/compete/${invite.competition.slug}`}>
									View Competition
								</a>
							</Button>
						)}
					</CardContent>
				</Card>
			</div>
		)
	}

	// Check if expired
	if (invite.expiresAt && invite.expiresAt < new Date()) {
		return (
			<div className="container mx-auto max-w-lg py-16">
				<Card>
					<CardContent className="py-8 text-center space-y-4">
						<AlertCircle className="w-12 h-12 mx-auto text-destructive" />
						<h2 className="text-xl font-semibold">Invite Expired</h2>
						<p className="text-muted-foreground">
							This invitation has expired. Please ask your team captain to send
							a new invite.
						</p>
						<Button asChild variant="outline">
							<a href="/compete">Browse Competitions</a>
						</Button>
					</CardContent>
				</Card>
			</div>
		)
	}

	// Auth State 1: Logged in, email matches
	if (
		session &&
		session.user.email?.toLowerCase() === invite.email.toLowerCase()
	) {
		return (
			<div className="container mx-auto max-w-lg py-16">
				<Card>
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 w-fit">
							<Users className="w-8 h-8 text-primary" />
						</div>
						<CardTitle className="text-2xl">
							Join Team {invite.team.name}
						</CardTitle>
						<CardDescription>
							You&apos;ve been invited to compete in{" "}
							{invite.competition?.name || "a competition"}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						{/* Invite Details */}
						<div className="space-y-3 p-4 rounded-lg bg-muted/50">
							<div className="flex items-center gap-3">
								<Trophy className="w-5 h-5 text-muted-foreground" />
								<div>
									<p className="text-sm text-muted-foreground">Competition</p>
									<p className="font-medium">
										{invite.competition?.name || "Competition"}
									</p>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<Users className="w-5 h-5 text-muted-foreground" />
								<div>
									<p className="text-sm text-muted-foreground">Team</p>
									<p className="font-medium">{invite.team.name}</p>
								</div>
							</div>
							{invite.division && (
								<div className="flex items-center gap-3">
									<Calendar className="w-5 h-5 text-muted-foreground" />
									<div>
										<p className="text-sm text-muted-foreground">Division</p>
										<p className="font-medium">{invite.division.label}</p>
									</div>
								</div>
							)}
							{invite.captain && (
								<div className="flex items-center gap-3">
									<UserPlus className="w-5 h-5 text-muted-foreground" />
									<div>
										<p className="text-sm text-muted-foreground">Invited by</p>
										<p className="font-medium">
											{invite.captain.firstName} {invite.captain.lastName}
										</p>
									</div>
								</div>
							)}
						</div>

						<AcceptInviteButton
							token={token}
							competitionSlug={invite.competition?.slug}
							competitionId={invite.competition?.id}
							teamName={invite.team.name}
						/>
					</CardContent>
				</Card>
			</div>
		)
	}

	// Auth State 2: Logged in, email doesn't match
	if (
		session &&
		session.user.email?.toLowerCase() !== invite.email.toLowerCase()
	) {
		return (
			<div className="container mx-auto max-w-lg py-16">
				<Card>
					<CardContent className="py-8 text-center space-y-4">
						<AlertCircle className="w-12 h-12 mx-auto text-yellow-500" />
						<h2 className="text-xl font-semibold">Wrong Account</h2>
						<p className="text-muted-foreground">
							This invite was sent to <strong>{invite.email}</strong>.
							You&apos;re currently logged in as{" "}
							<strong>{session.user.email}</strong>.
						</p>
						<p className="text-sm text-muted-foreground">
							Please sign out and sign in with the correct account.
						</p>
						<div className="flex gap-3 justify-center">
							<Button asChild variant="outline">
								<a href="/auth/sign-out">Sign Out</a>
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	// Auth States 3 & 4: Not logged in
	// Check if email already has an account
	const emailHasAccount = await checkEmailExists(invite.email)
	const returnTo = `/compete/invite/${token}`
	const encodedEmail = encodeURIComponent(invite.email)

	return (
		<div className="container mx-auto max-w-lg py-16">
			<Card>
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 w-fit">
						<Users className="w-8 h-8 text-primary" />
					</div>
					<CardTitle className="text-2xl">
						Join Team {invite.team.name}
					</CardTitle>
					<CardDescription>
						You&apos;ve been invited to compete in{" "}
						{invite.competition?.name || "a competition"}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Invite Details */}
					<div className="space-y-3 p-4 rounded-lg bg-muted/50">
						<div className="flex items-center gap-3">
							<Trophy className="w-5 h-5 text-muted-foreground" />
							<div>
								<p className="text-sm text-muted-foreground">Competition</p>
								<p className="font-medium">
									{invite.competition?.name || "Competition"}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-3">
							<Users className="w-5 h-5 text-muted-foreground" />
							<div>
								<p className="text-sm text-muted-foreground">Team</p>
								<p className="font-medium">{invite.team.name}</p>
							</div>
						</div>
						{invite.division && (
							<div className="flex items-center gap-3">
								<Calendar className="w-5 h-5 text-muted-foreground" />
								<div>
									<p className="text-sm text-muted-foreground">Division</p>
									<p className="font-medium">{invite.division.label}</p>
								</div>
							</div>
						)}
					</div>

					{emailHasAccount ? (
						// Email has account - show sign in button
						<>
							<div className="space-y-2">
								<p className="text-sm text-center text-muted-foreground">
									Invitation for <strong>{invite.email}</strong>
								</p>
							</div>
							<Button asChild className="w-full" size="lg">
								<a
									href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}&email=${encodedEmail}`}
								>
									<LogIn className="w-4 h-4 mr-2" />
									Sign In to Accept
								</a>
							</Button>
						</>
					) : (
						// No account - show inline sign up form
						<>
							<div className="space-y-2">
								<p className="text-sm text-center text-muted-foreground">
									Create an account to join the team
								</p>
							</div>
							<InviteSignUpForm
								inviteToken={token}
								inviteEmail={invite.email}
							/>
							<p className="text-xs text-center text-muted-foreground">
								Already have an account?{" "}
								<a
									href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}&email=${encodedEmail}`}
									className="text-primary underline"
								>
									Sign in
								</a>
							</p>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	)
}

/**
 * Status page for volunteer invites
 * Shows the current status of a volunteer application (pending, approved, rejected)
 */
function VolunteerInviteStatus({
	invite,
}: {
	invite: NonNullable<Awaited<ReturnType<typeof getVolunteerInvite>>>
}) {
	const statusConfig = {
		pending: {
			icon: Clock,
			iconClass: "text-yellow-500",
			bgClass: "bg-yellow-500/10",
			title: "Application Pending",
			description:
				"Your volunteer application is being reviewed by the organizers. You'll receive an email when it's been processed.",
		},
		approved: {
			icon: CheckCircle2,
			iconClass: "text-green-500",
			bgClass: "bg-green-500/10",
			title: "Application Approved!",
			description:
				"Congratulations! Your volunteer application has been approved. Check your email for next steps.",
		},
		rejected: {
			icon: AlertCircle,
			iconClass: "text-destructive",
			bgClass: "bg-destructive/10",
			title: "Application Not Accepted",
			description:
				"Unfortunately, your volunteer application was not accepted at this time. Thank you for your interest.",
		},
	}

	const status = (invite.status as keyof typeof statusConfig) || "pending"
	const config = statusConfig[status] || statusConfig.pending
	const StatusIcon = config.icon

	return (
		<div className="container mx-auto max-w-lg py-16">
			<Card>
				<CardHeader className="text-center">
					<div
						className={`mx-auto mb-4 p-3 rounded-full ${config.bgClass} w-fit`}
					>
						<StatusIcon className={`w-8 h-8 ${config.iconClass}`} />
					</div>
					<CardTitle className="text-2xl">{config.title}</CardTitle>
					<CardDescription>{config.description}</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Application Details */}
					<div className="space-y-3 p-4 rounded-lg bg-muted/50">
						{invite.competition && (
							<div className="flex items-center gap-3">
								<Trophy className="w-5 h-5 text-muted-foreground" />
								<div>
									<p className="text-sm text-muted-foreground">Competition</p>
									<p className="font-medium">{invite.competition.name}</p>
								</div>
							</div>
						)}
						{invite.signupName && (
							<div className="flex items-center gap-3">
								<UserPlus className="w-5 h-5 text-muted-foreground" />
								<div>
									<p className="text-sm text-muted-foreground">Name</p>
									<p className="font-medium">{invite.signupName}</p>
								</div>
							</div>
						)}
						{invite.roleTypes && invite.roleTypes.length > 0 && (
							<div className="flex items-center gap-3">
								<Users className="w-5 h-5 text-muted-foreground" />
								<div>
									<p className="text-sm text-muted-foreground">
										Assigned Roles
									</p>
									<p className="font-medium capitalize">
										{invite.roleTypes.join(", ").replace(/_/g, " ")}
									</p>
								</div>
							</div>
						)}
					</div>

					{/* Action buttons based on status */}
					{status === "approved" && invite.competition && (
						<Button asChild className="w-full">
							<a href={`/compete/${invite.competition.slug}`}>
								View Competition
							</a>
						</Button>
					)}

					{status === "pending" && (
						<p className="text-sm text-center text-muted-foreground">
							Questions? Contact the competition organizers directly.
						</p>
					)}

					<Button asChild variant="outline" className="w-full">
						<a href="/compete">Browse Competitions</a>
					</Button>
				</CardContent>
			</Card>
		</div>
	)
}
