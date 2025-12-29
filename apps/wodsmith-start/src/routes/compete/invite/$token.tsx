import { createFileRoute, Link } from "@tanstack/react-router"
import {
	AlertCircle,
	Calendar,
	CheckCircle2,
	Clock,
	LogIn,
	Mail,
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
import {
	checkEmailExistsFn,
	getSessionInfoFn,
	getTeammateInviteFn,
	getVolunteerInviteFn,
	type TeammateInvite,
	type VolunteerInvite,
} from "@/server-fns/invite-fns"
import { AcceptInviteButton } from "./-components/accept-invite-button"
import { AcceptVolunteerInviteForm } from "./-components/accept-volunteer-invite-form"
import { InviteSignUpForm } from "./-components/invite-signup-form"

export const Route = createFileRoute("/compete/invite/$token")({
	loader: async ({ params }) => {
		const [volunteerInvite, teammateInvite, session] = await Promise.all([
			getVolunteerInviteFn({ data: { token: params.token } }),
			getTeammateInviteFn({ data: { token: params.token } }),
			getSessionInfoFn(),
		])

		// Determine if the invite email has an account (for anonymous users)
		let emailHasAccount = false
		const inviteEmail = volunteerInvite?.email || teammateInvite?.email
		if (inviteEmail && !session) {
			emailHasAccount = await checkEmailExistsFn({
				data: { email: inviteEmail },
			})
		}

		return {
			volunteerInvite,
			teammateInvite,
			session,
			emailHasAccount,
			token: params.token,
		}
	},
	component: InvitePage,
	head: ({ loaderData }) => {
		const { volunteerInvite, teammateInvite } = loaderData || {}

		if (volunteerInvite?.competition) {
			return {
				meta: [
					{
						title: `Volunteer Invitation - ${volunteerInvite.competition.name}`,
					},
					{
						name: "description",
						content: `You've been invited to volunteer at ${volunteerInvite.competition.name}`,
					},
				],
			}
		}

		if (teammateInvite?.competition) {
			return {
				meta: [
					{ title: `Team Invitation - ${teammateInvite.competition.name}` },
					{
						name: "description",
						content: `You've been invited to join a team for ${teammateInvite.competition.name}`,
					},
				],
			}
		}

		return {
			meta: [
				{ title: "Competition Invitation | WODsmith" },
				{
					name: "description",
					content: "You've been invited to join a competition",
				},
			],
		}
	},
})

function InvitePage() {
	const { volunteerInvite, teammateInvite, session, emailHasAccount, token } =
		Route.useLoaderData()

	// First check if this is a volunteer invite
	if (volunteerInvite) {
		// Applications show status page (admin must approve)
		// Direct invites show accept UI (user accepts like normal team invite)
		if (volunteerInvite.inviteSource === "application") {
			return <VolunteerApplicationStatus invite={volunteerInvite} />
		}
		// Direct volunteer invite - show accept flow
		return (
			<DirectVolunteerInvite
				invite={volunteerInvite}
				session={session}
				token={token}
				emailHasAccount={emailHasAccount}
			/>
		)
	}

	// Handle teammate invite
	const invite = teammateInvite

	if (!invite) {
		return (
			<div className="container mx-auto max-w-lg py-16">
				<Card>
					<CardContent className="space-y-4 py-8 text-center">
						<AlertCircle className="mx-auto h-12 w-12 text-destructive" />
						<h2 className="text-xl font-semibold">Invite Not Found</h2>
						<p className="text-muted-foreground">
							This invitation link is invalid or has expired.
						</p>
						<Button asChild variant="outline">
							<Link to="/compete">Browse Competitions</Link>
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
					<CardContent className="space-y-4 py-8 text-center">
						<AlertCircle className="mx-auto h-12 w-12 text-yellow-500" />
						<h2 className="text-xl font-semibold">Invite Already Accepted</h2>
						<p className="text-muted-foreground">
							This invitation has already been accepted.
						</p>
						{invite.competition && (
							<Button asChild>
								<Link
									to="/compete/$slug"
									params={{ slug: invite.competition.slug }}
								>
									View Competition
								</Link>
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
					<CardContent className="space-y-4 py-8 text-center">
						<AlertCircle className="mx-auto h-12 w-12 text-destructive" />
						<h2 className="text-xl font-semibold">Invite Expired</h2>
						<p className="text-muted-foreground">
							This invitation has expired. Please ask your team captain to send
							a new invite.
						</p>
						<Button asChild variant="outline">
							<Link to="/compete">Browse Competitions</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		)
	}

	// Auth State 1: Logged in, email matches
	if (session && session.email?.toLowerCase() === invite.email.toLowerCase()) {
		return (
			<div className="container mx-auto max-w-lg py-16">
				<Card>
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 w-fit rounded-full bg-primary/10 p-3">
							<Users className="h-8 w-8 text-primary" />
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
						<InviteDetails invite={invite} />

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
	if (session && session.email?.toLowerCase() !== invite.email.toLowerCase()) {
		return (
			<div className="container mx-auto max-w-lg py-16">
				<Card>
					<CardContent className="space-y-4 py-8 text-center">
						<AlertCircle className="mx-auto h-12 w-12 text-yellow-500" />
						<h2 className="text-xl font-semibold">Wrong Account</h2>
						<p className="text-muted-foreground">
							This invite was sent to <strong>{invite.email}</strong>.
							You&apos;re currently logged in as{" "}
							<strong>{session.email}</strong>.
						</p>
						<p className="text-sm text-muted-foreground">
							Please sign out and sign in with the correct account.
						</p>
						<div className="flex justify-center gap-3">
							<Button asChild variant="outline">
								<a href="/api/auth/sign-out">Sign Out</a>
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	// Auth States 3 & 4: Not logged in
	const redirectPath = `/compete/invite/${token}`

	return (
		<div className="container mx-auto max-w-lg py-16">
			<Card>
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 w-fit rounded-full bg-primary/10 p-3">
						<Users className="h-8 w-8 text-primary" />
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
					<InviteDetails invite={invite} />

					{emailHasAccount ? (
						// Email has account - show sign in button
						<>
							<div className="space-y-2">
								<p className="text-center text-sm text-muted-foreground">
									Invitation for <strong>{invite.email}</strong>
								</p>
							</div>
							<Button asChild className="w-full" size="lg">
								<Link to="/sign-in" search={{ redirect: redirectPath }}>
									<LogIn className="mr-2 h-4 w-4" />
									Sign In to Accept
								</Link>
							</Button>
						</>
					) : (
						// No account - show inline sign up form
						<>
							<div className="space-y-2">
								<p className="text-center text-sm text-muted-foreground">
									Create an account to join the team
								</p>
							</div>
							<InviteSignUpForm
								inviteToken={token}
								inviteEmail={invite.email}
							/>
							<p className="text-center text-xs text-muted-foreground">
								Already have an account?{" "}
								<Link
									to="/sign-in"
									search={{ redirect: redirectPath }}
									className="text-primary underline"
								>
									Sign in
								</Link>
							</p>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	)
}

/**
 * Invite details component for team invites
 */
function InviteDetails({ invite }: { invite: TeammateInvite }) {
	return (
		<div className="space-y-3 rounded-lg bg-muted/50 p-4">
			<div className="flex items-center gap-3">
				<Trophy className="h-5 w-5 text-muted-foreground" />
				<div>
					<p className="text-sm text-muted-foreground">Competition</p>
					<p className="font-medium">
						{invite.competition?.name || "Competition"}
					</p>
				</div>
			</div>
			<div className="flex items-center gap-3">
				<Users className="h-5 w-5 text-muted-foreground" />
				<div>
					<p className="text-sm text-muted-foreground">Team</p>
					<p className="font-medium">{invite.team.name}</p>
				</div>
			</div>
			{invite.division && (
				<div className="flex items-center gap-3">
					<Calendar className="h-5 w-5 text-muted-foreground" />
					<div>
						<p className="text-sm text-muted-foreground">Division</p>
						<p className="font-medium">{invite.division.label}</p>
					</div>
				</div>
			)}
			{invite.captain && (
				<div className="flex items-center gap-3">
					<UserPlus className="h-5 w-5 text-muted-foreground" />
					<div>
						<p className="text-sm text-muted-foreground">Invited by</p>
						<p className="font-medium">
							{invite.captain.firstName} {invite.captain.lastName}
						</p>
					</div>
				</div>
			)}
		</div>
	)
}

/**
 * Status page for volunteer APPLICATIONS (from public sign-up form)
 * Admin must approve these - user is just checking status
 */
function VolunteerApplicationStatus({ invite }: { invite: VolunteerInvite }) {
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
						className={`mx-auto mb-4 w-fit rounded-full p-3 ${config.bgClass}`}
					>
						<StatusIcon className={`h-8 w-8 ${config.iconClass}`} />
					</div>
					<CardTitle className="text-2xl">{config.title}</CardTitle>
					<CardDescription>{config.description}</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Application Details */}
					<div className="space-y-3 rounded-lg bg-muted/50 p-4">
						{invite.competition && (
							<div className="flex items-center gap-3">
								<Trophy className="h-5 w-5 text-muted-foreground" />
								<div>
									<p className="text-sm text-muted-foreground">Competition</p>
									<p className="font-medium">{invite.competition.name}</p>
								</div>
							</div>
						)}
						{invite.signupName && (
							<div className="flex items-center gap-3">
								<UserPlus className="h-5 w-5 text-muted-foreground" />
								<div>
									<p className="text-sm text-muted-foreground">Name</p>
									<p className="font-medium">{invite.signupName}</p>
								</div>
							</div>
						)}
						{invite.roleTypes && invite.roleTypes.length > 0 && (
							<div className="flex items-center gap-3">
								<Users className="h-5 w-5 text-muted-foreground" />
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
							<Link
								to="/compete/$slug"
								params={{ slug: invite.competition.slug }}
							>
								View Competition
							</Link>
						</Button>
					)}

					{status === "pending" && (
						<p className="text-center text-sm text-muted-foreground">
							Questions? Contact the competition organizers directly.
						</p>
					)}

					<Button asChild variant="outline" className="w-full">
						<Link to="/compete">Browse Competitions</Link>
					</Button>
				</CardContent>
			</Card>
		</div>
	)
}

/**
 * Direct volunteer invite (admin invited a specific person)
 * Works like a normal team invite - user accepts to join
 */
function DirectVolunteerInvite({
	invite,
	session,
	token,
	emailHasAccount,
}: {
	invite: VolunteerInvite
	session: { userId: string; email: string | null } | null
	token: string
	emailHasAccount: boolean
}) {
	// Check if already accepted
	if (invite.acceptedAt) {
		return (
			<div className="container mx-auto max-w-lg py-16">
				<Card>
					<CardContent className="space-y-4 py-8 text-center">
						<CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
						<h2 className="text-xl font-semibold">Invite Already Accepted</h2>
						<p className="text-muted-foreground">
							You&apos;ve already accepted this volunteer invitation.
						</p>
						{invite.competition && (
							<Button asChild>
								<Link
									to="/compete/$slug"
									params={{ slug: invite.competition.slug }}
								>
									View Competition
								</Link>
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
					<CardContent className="space-y-4 py-8 text-center">
						<AlertCircle className="mx-auto h-12 w-12 text-destructive" />
						<h2 className="text-xl font-semibold">Invite Expired</h2>
						<p className="text-muted-foreground">
							This invitation has expired. Please contact the competition
							organizer for a new invite.
						</p>
						<Button asChild variant="outline">
							<Link to="/compete">Browse Competitions</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		)
	}

	const redirectPath = `/compete/invite/${token}`

	// Logged in - email matches
	if (session && session.email?.toLowerCase() === invite.email.toLowerCase()) {
		return (
			<div className="container mx-auto max-w-lg py-16">
				<Card>
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 w-fit rounded-full bg-primary/10 p-3">
							<Users className="h-8 w-8 text-primary" />
						</div>
						<CardTitle className="text-2xl">Volunteer Invitation</CardTitle>
						<CardDescription>
							You&apos;ve been invited to volunteer at{" "}
							{invite.competition?.name || "a competition"}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<VolunteerInviteDetails invite={invite} />

						<AcceptVolunteerInviteForm
							token={token}
							competitionSlug={invite.competition?.slug}
							competitionId={invite.competition?.id}
							competitionName={invite.competition?.name}
						/>
					</CardContent>
				</Card>
			</div>
		)
	}

	// Logged in - email doesn't match
	if (session && session.email?.toLowerCase() !== invite.email.toLowerCase()) {
		return (
			<div className="container mx-auto max-w-lg py-16">
				<Card>
					<CardContent className="space-y-4 py-8 text-center">
						<AlertCircle className="mx-auto h-12 w-12 text-yellow-500" />
						<h2 className="text-xl font-semibold">Wrong Account</h2>
						<p className="text-muted-foreground">
							This invite was sent to <strong>{invite.email}</strong>.
							You&apos;re currently logged in as{" "}
							<strong>{session.email}</strong>.
						</p>
						<p className="text-sm text-muted-foreground">
							Please sign out and sign in with the correct account.
						</p>
						<div className="flex justify-center gap-3">
							<Button asChild variant="outline">
								<a href="/api/auth/sign-out">Sign Out</a>
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	// Not logged in
	return (
		<div className="container mx-auto max-w-lg py-16">
			<Card>
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 w-fit rounded-full bg-primary/10 p-3">
						<Users className="h-8 w-8 text-primary" />
					</div>
					<CardTitle className="text-2xl">Volunteer Invitation</CardTitle>
					<CardDescription>
						You&apos;ve been invited to volunteer at{" "}
						{invite.competition?.name || "a competition"}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<VolunteerInviteDetails invite={invite} />

					{emailHasAccount ? (
						<>
							<div className="space-y-2">
								<p className="text-center text-sm text-muted-foreground">
									Invitation for <strong>{invite.email}</strong>
								</p>
							</div>
							<Button asChild className="w-full" size="lg">
								<Link to="/sign-in" search={{ redirect: redirectPath }}>
									<LogIn className="mr-2 h-4 w-4" />
									Sign In to Accept
								</Link>
							</Button>
						</>
					) : (
						<>
							<div className="space-y-2">
								<p className="text-center text-sm text-muted-foreground">
									Create an account to accept this invitation
								</p>
							</div>
							<InviteSignUpForm
								inviteToken={token}
								inviteEmail={invite.email}
							/>
							<p className="text-center text-xs text-muted-foreground">
								Already have an account?{" "}
								<Link
									to="/sign-in"
									search={{ redirect: redirectPath }}
									className="text-primary underline"
								>
									Sign in
								</Link>
							</p>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	)
}

/**
 * Volunteer invite details component
 */
function VolunteerInviteDetails({ invite }: { invite: VolunteerInvite }) {
	return (
		<div className="space-y-3 rounded-lg bg-muted/50 p-4">
			{invite.competition && (
				<div className="flex items-center gap-3">
					<Trophy className="h-5 w-5 text-muted-foreground" />
					<div>
						<p className="text-sm text-muted-foreground">Competition</p>
						<p className="font-medium">{invite.competition.name}</p>
					</div>
				</div>
			)}
			{invite.roleTypes && invite.roleTypes.length > 0 && (
				<div className="flex items-center gap-3">
					<Users className="h-5 w-5 text-muted-foreground" />
					<div>
						<p className="text-sm text-muted-foreground">Role(s)</p>
						<p className="font-medium capitalize">
							{invite.roleTypes.join(", ").replace(/_/g, " ")}
						</p>
					</div>
				</div>
			)}
			<div className="flex items-center gap-3">
				<Mail className="h-5 w-5 text-muted-foreground" />
				<div>
					<p className="text-sm text-muted-foreground">Invited as</p>
					<p className="font-medium">{invite.email}</p>
				</div>
			</div>
		</div>
	)
}
