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
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	checkEmailExistsFn,
	getPendingInviteDataFn,
	getSessionInfoFn,
	getTeammateInviteFn,
	getVolunteerInviteFn,
	type TeammateInvite,
	type VolunteerInvite,
} from "@/server-fns/invite-fns"
import {
	getCompetitionQuestionsFn,
	type RegistrationQuestion,
} from "@/server-fns/registration-questions-fns"
import { getCompetitionWaiversFn } from "@/server-fns/waiver-fns"
import type { Waiver } from "@/db/schemas/waivers"
import { AcceptInviteButton } from "./-components/accept-invite-button"
import { AcceptVolunteerInviteForm } from "./-components/accept-volunteer-invite-form"
import { GuestInviteForm } from "./-components/guest-invite-form"
import { InviteSignUpForm } from "./-components/invite-signup-form"
import { SuccessClaimPrompt } from "./-components/success-claim-prompt"

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

		// Fetch questions for teammate invites
		let teammateQuestions: RegistrationQuestion[] = []
		if (teammateInvite?.competition?.id) {
			const questionsResult = await getCompetitionQuestionsFn({
				data: { competitionId: teammateInvite.competition.id },
			})
			// Filter to questions that are for teammates or required
			teammateQuestions = questionsResult.questions.filter(
				(q) => q.forTeammates || q.required,
			)
		}

		let waivers: Waiver[] = []
		if (teammateInvite?.competition?.id) {
			const waiversResult = await getCompetitionWaiversFn({
				data: { competitionId: teammateInvite.competition.id },
			})
			waivers = waiversResult.waivers
		}

		const pendingData = await getPendingInviteDataFn({
			data: { token: params.token },
		})
		const hasPendingData = !!(
			pendingData?.pendingAnswers?.length ||
			pendingData?.pendingSignatures?.length
		)

		return {
			volunteerInvite,
			teammateInvite,
			session,
			emailHasAccount,
			token: params.token,
			teammateQuestions,
			waivers,
			hasPendingData,
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
	const {
		volunteerInvite,
		teammateInvite,
		session,
		emailHasAccount,
		token,
		teammateQuestions,
		waivers,
		hasPendingData,
	} = Route.useLoaderData()
	const [guestSubmitComplete, setGuestSubmitComplete] = useState(false)
	const showSuccess = guestSubmitComplete || hasPendingData

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

	// Note: Pending data transfer now happens automatically in acceptTeamInvitationFn
	// when the user accepts the invite - no need for separate transfer logic

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

						{/* Registration Questions - only show if no pending data (guest already filled them) */}
						{teammateQuestions &&
							teammateQuestions.length > 0 &&
							!hasPendingData && (
								<TeammateQuestionsForm
									questions={teammateQuestions}
									token={token}
									competitionSlug={invite.competition?.slug}
									competitionId={invite.competition?.id}
									teamName={invite.team.name}
								/>
							)}

						{/* Simple accept button if no questions OR if pending data exists (will be transferred on accept) */}
						{(!teammateQuestions ||
							teammateQuestions.length === 0 ||
							hasPendingData) && (
							<>
								{hasPendingData && (
									<div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4 text-center">
										<p className="text-sm text-green-700 dark:text-green-300">
											Your registration answers have been saved. Click below to
											join the team.
										</p>
									</div>
								)}
								<AcceptInviteButton
									token={token}
									competitionSlug={invite.competition?.slug}
									competitionId={invite.competition?.id}
									teamName={invite.team.name}
								/>
							</>
						)}
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
						<h2 className="text-xl font-semibold">Different Account</h2>
						<p className="text-muted-foreground">
							This invite was sent to <strong>{invite.email}</strong>.
							You&apos;re currently logged in as{" "}
							<strong>{session.email}</strong>.
						</p>
						<p className="text-sm text-muted-foreground">
							You can claim this invite with your current account, which will
							update the registration email.
						</p>
						<div className="flex justify-center gap-3">
							<AcceptInviteButton
								token={token}
								competitionSlug={invite.competition?.slug}
								competitionId={invite.competition?.id}
								teamName={invite.team.name}
							/>
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
					{showSuccess ? (
						<SuccessClaimPrompt
							teamName={invite.team.name}
							competitionName={invite.competition?.name || "Competition"}
							inviteToken={token}
							emailHasAccount={emailHasAccount}
						/>
					) : teammateQuestions.length > 0 || waivers.length > 0 ? (
						<>
							<InviteDetails invite={invite} />
							<GuestInviteForm
								token={token}
								questions={teammateQuestions}
								waivers={waivers}
								teamName={invite.team.name}
								competitionName={invite.competition?.name || "Competition"}
								onSuccess={() => setGuestSubmitComplete(true)}
							/>
						</>
					) : emailHasAccount ? (
						// Email has account - show sign in button
						<>
							<InviteDetails invite={invite} />
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
							<InviteDetails invite={invite} />
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
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 w-fit rounded-full bg-yellow-500/10 p-3">
							<AlertCircle className="h-8 w-8 text-yellow-500" />
						</div>
						<CardTitle className="text-2xl">Different Account</CardTitle>
						<CardDescription>
							This invite was sent to <strong>{invite.email}</strong>.
							You&apos;re currently logged in as{" "}
							<strong>{session.email}</strong>.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<p className="text-center text-sm text-muted-foreground">
							You can claim this invite with your current account, which will
							update the volunteer email.
						</p>

						<VolunteerInviteDetails invite={invite} />

						<AcceptVolunteerInviteForm
							token={token}
							competitionSlug={invite.competition?.slug}
							competitionId={invite.competition?.id}
							competitionName={invite.competition?.name}
						/>

						<div className="flex justify-center">
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
 * Teammate questions form component
 * Handles rendering questions and accepting invitation with answers
 */
function TeammateQuestionsForm({
	questions,
	token,
	competitionSlug,
	competitionId,
	teamName,
}: {
	questions: RegistrationQuestion[]
	token: string
	competitionSlug?: string
	competitionId?: string
	teamName?: string
}) {
	const [answers, setAnswers] = useState<Record<string, string>>({})

	const handleAnswerChange = (questionId: string, value: string) => {
		setAnswers((prev) => ({ ...prev, [questionId]: value }))
	}

	// Check if all required questions are answered
	const requiredQuestions = questions.filter((q) => q.required)
	const allRequiredAnswered = requiredQuestions.every(
		(q) => answers[q.id] && answers[q.id].trim() !== "",
	)

	// Convert answers to array format for submission
	const answersArray = Object.entries(answers)
		.filter(([_, value]) => value && value.trim() !== "")
		.map(([questionId, answer]) => ({
			questionId,
			answer,
		}))

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>Registration Questions</CardTitle>
					<CardDescription>
						Please answer these questions to complete your team registration
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{questions.map((question) => (
						<div key={question.id} className="space-y-2">
							<Label htmlFor={`question-${question.id}`}>
								{question.label}
								{question.required && (
									<span className="text-destructive ml-1">*</span>
								)}
							</Label>
							{question.helpText && (
								<p className="text-sm text-muted-foreground">
									{question.helpText}
								</p>
							)}

							{question.type === "text" && (
								<Input
									id={`question-${question.id}`}
									value={answers[question.id] || ""}
									onChange={(e) =>
										handleAnswerChange(question.id, e.target.value)
									}
									placeholder="Enter your answer"
								/>
							)}

							{question.type === "number" && (
								<Input
									id={`question-${question.id}`}
									type="number"
									value={answers[question.id] || ""}
									onChange={(e) =>
										handleAnswerChange(question.id, e.target.value)
									}
									placeholder="Enter a number"
								/>
							)}

							{question.type === "select" && question.options && (
								<Select
									value={answers[question.id] || ""}
									onValueChange={(value) =>
										handleAnswerChange(question.id, value)
									}
								>
									<SelectTrigger id={`question-${question.id}`}>
										<SelectValue placeholder="Select an option" />
									</SelectTrigger>
									<SelectContent>
										{question.options.map((option) => (
											<SelectItem key={option} value={option}>
												{option}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</div>
					))}
				</CardContent>
			</Card>

			<AcceptInviteButton
				token={token}
				competitionSlug={competitionSlug}
				competitionId={competitionId}
				teamName={teamName}
				answers={answersArray}
				disabled={!allRequiredAnswered}
			/>
		</>
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
