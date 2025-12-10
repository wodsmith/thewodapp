"use server"

import {
	Users,
	Calendar,
	Trophy,
	AlertCircle,
	LogIn,
	UserPlus,
} from "lucide-react"
import { getSessionFromCookie } from "@/utils/auth"
import { getTeammateInvite } from "@/server/competitions"
import { checkEmailExists } from "@/server/user"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AcceptInviteButton } from "./_components/accept-invite-button"
import { InviteSignUpForm } from "./_components/invite-signup-form"

export default async function CompeteInvitePage({
	params,
}: {
	params: Promise<{ token: string }>
}) {
	const { token } = await params
	const session = await getSessionFromCookie()

	// Get invite details
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
