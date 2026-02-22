/**
 * Team Management Route
 * Displays team roster for team competitions and allows management of affiliates.
 * Shows confirmed members, pending invitations, affiliate info, and waiver signing.
 *
 * Port from apps/wodsmith/src/app/(compete)/compete/(public)/[slug]/teams/[registrationId]/page.tsx
 */

import {
	createFileRoute,
	notFound,
	redirect,
	useNavigate,
} from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { CheckCircle, ChevronDown, Clock, Copy, Crown, Mail, Users } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"
import { RegistrationAnswersForm } from "@/components/registration/registration-answers-form"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import type { Waiver, WaiverSignature } from "@/db/schemas/waivers"
import {
	getRegistrationDetailsFn,
	getTeamRosterFn,
	type RegistrationDetails,
	type TeamRosterResult,
} from "@/server-fns/registration-fns"
import { getUserCompetitionRegistrationsFn } from "@/server-fns/competition-detail-fns"
import {
	getCompetitionQuestionsFn,
	getRegistrationAnswersFn,
	type RegistrationQuestion,
} from "@/server-fns/registration-questions-fns"
import {
	getCompetitionWaiversFn,
	getWaiverSignaturesForUserFn,
} from "@/server-fns/waiver-fns"
import { AffiliateEditor } from "./-components/affiliate-editor"
import { RegistrationDetailsCard } from "./-components/registration-details"
import { WaiverSection } from "./-components/waiver-section"
import { WelcomeModal } from "./-components/welcome-modal"

// Search params schema
const searchSchema = z.object({
	welcome: z.boolean().optional(),
})

// Types
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

interface UserRegistrationEntry {
	id: string
	divisionId: string | null
	teamName: string | null
	divisionLabel: string | null
}

interface LoaderData {
	registration: TeamRosterResult["registration"]
	registrationDetails: RegistrationDetails | null
	members: TeamRosterResult["members"]
	pending: TeamRosterResult["pending"]
	isTeamRegistration: boolean
	competition: {
		id: string
		name: string
		slug: string
		registrationClosesAt: string | null
	} | null
	division: {
		id: string
		label: string
	} | null
	isTeamMember: boolean
	isRegisteredUser: boolean
	canEditOwnAffiliate: boolean
	currentUserId: string
	memberAffiliates: Record<string, string>
	currentUserAffiliate: string | null
	pendingTeammates: PendingTeammate[]
	waivers: Waiver[]
	waiverSignatures: WaiverSignature[]
	registrationQuestions: RegistrationQuestion[]
	registrationAnswers: Array<{
		id: string
		questionId: string
		registrationId: string
		userId: string
		answer: string
	}>
	allUserRegistrations: UserRegistrationEntry[]
}

export const Route = createFileRoute("/compete/$slug/teams/$registrationId/")({
	component: TeamManagementPage,
	validateSearch: (search) => searchSchema.parse(search),
	loader: async ({ params, context }): Promise<LoaderData> => {
		const { slug, registrationId } = params
		const session = context.session

		// Require authentication
		if (!session) {
			throw redirect({
				to: "/sign-in",
				search: { redirect: `/compete/${slug}/teams/${registrationId}` },
			})
		}

		// Get team roster and registration details first
		const [roster, registrationDetails] = await Promise.all([
			getTeamRosterFn({ data: { registrationId } }),
			getRegistrationDetailsFn({ data: { registrationId } }),
		])

		if (!roster) {
			throw notFound()
		}

		const { registration, members, pending, isTeamRegistration } = roster

		// Check if user is authorized to view this registration
		const isTeamMember = members.some((m) => m.user?.id === session.userId)
		const isRegisteredUser = registration.userId === session.userId

		// If user is not authorized, show 404 (don't reveal that the resource exists)
		if (!isTeamMember && !isRegisteredUser) {
			throw notFound()
		}

		// Now fetch questions, answers, and full competition data if we have a competition
		let registrationQuestions: RegistrationQuestion[] = []
		let registrationAnswers: Array<{
			id: string
			questionId: string
			registrationId: string
			userId: string
			answer: string
		}> = []
		let fullCompetition: { registrationClosesAt: string | null } | null = null

		if (registration.competition?.id) {
			const [questionsResult, answersResult, competitionData] =
				await Promise.all([
					getCompetitionQuestionsFn({
						data: { competitionId: registration.competition.id },
					}).catch(() => ({ questions: [] })),
					getRegistrationAnswersFn({
						data: { registrationId, userId: session.userId },
					}).catch(() => ({ answers: [] })),
					// Fetch full competition data for registrationClosesAt
					(async () => {
						const { getDb } = await import("@/db")
						const { competitionsTable } = await import(
							"@/db/schemas/competitions"
						)
						const db = getDb()
						const compId = registration.competition?.id
						if (!compId) return null
						const comp = await db.query.competitionsTable.findFirst({
							where: eq(competitionsTable.id, compId),
							columns: { registrationClosesAt: true },
						})
						return comp
					})().catch(() => null),
				])

			registrationQuestions = questionsResult.questions
			registrationAnswers = answersResult.answers
			fullCompetition = competitionData || null
		}

		// Parse affiliates from registration metadata
		let memberAffiliates: Record<string, string> = {}
		let currentUserAffiliate: string | null = null

		if (registration.metadata) {
			try {
				const metadata = JSON.parse(
					registration.metadata,
				) as RegistrationMetadata
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

		// Fetch waivers and signatures for the competition
		let waivers: Waiver[] = []
		let waiverSignatures: WaiverSignature[] = []

		if (registration.competition?.id) {
			const [waiversResult, signaturesResult] = await Promise.all([
				getCompetitionWaiversFn({
					data: { competitionId: registration.competition.id },
				}),
				getWaiverSignaturesForUserFn({
					data: {
						userId: session.userId,
						competitionId: registration.competition.id,
					},
				}),
			])

			waivers = waiversResult.waivers
			waiverSignatures = signaturesResult.signatures
		}

		const canEditOwnAffiliate = isTeamMember || isRegisteredUser

		// Fetch all user registrations for this competition (for division switcher)
		let allUserRegistrations: UserRegistrationEntry[] = []
		if (registration.competition?.id) {
			try {
				const { registrations: allRegs } =
					await getUserCompetitionRegistrationsFn({
						data: {
							competitionId: registration.competition.id,
							userId: session.userId,
						},
					})

				// Look up division labels for each registration
				if (allRegs.length > 1) {
					const { getDb } = await import("@/db")
					const { scalingLevelsTable } = await import(
						"@/db/schemas/scaling"
					)
					const db = getDb()

					allUserRegistrations = await Promise.all(
						allRegs.map(async (reg) => {
							let divisionLabel: string | null = null
							if (reg.divisionId) {
								const div =
									await db.query.scalingLevelsTable.findFirst({
										where: eq(scalingLevelsTable.id, reg.divisionId),
										columns: { label: true },
									})
								divisionLabel = div?.label ?? null
							}
							return {
								id: reg.id,
								divisionId: reg.divisionId,
								teamName: reg.teamName,
								divisionLabel,
							}
						}),
					)
				}
			} catch {
				// Non-critical - just won't show division switcher
			}
		}

		return {
			registration,
			registrationDetails,
			members,
			pending,
			isTeamRegistration,
			competition: registration.competition
				? {
						id: registration.competition.id,
						name: registration.competition.name,
						slug: registration.competition.slug,
						registrationClosesAt: fullCompetition?.registrationClosesAt || null,
					}
				: null,
			division: registration.division,
			isTeamMember,
			isRegisteredUser,
			canEditOwnAffiliate,
			currentUserId: session.userId,
			memberAffiliates,
			currentUserAffiliate,
			pendingTeammates,
			waivers,
			waiverSignatures,
			registrationQuestions,
			registrationAnswers,
			allUserRegistrations,
		}
	},
})

function DivisionSwitcher({
	registrations,
	currentRegistrationId,
	competitionSlug,
}: {
	registrations: UserRegistrationEntry[]
	currentRegistrationId: string
	competitionSlug: string
}) {
	const navigate = useNavigate()
	const [open, setOpen] = useState(false)
	const current = registrations.find((r) => r.id === currentRegistrationId)

	return (
		<div className="relative">
			<Button
				variant="outline"
				onClick={() => setOpen(!open)}
				className="w-full justify-between"
			>
				<span className="truncate">
					{current?.divisionLabel ?? "Division"}
					{current?.teamName ? ` - ${current.teamName}` : ""}
				</span>
				<ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
			</Button>
			{open && (
				<div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
					{registrations.map((reg) => (
						<button
							key={reg.id}
							type="button"
							onClick={() => {
								setOpen(false)
								if (reg.id !== currentRegistrationId) {
									navigate({
										to: "/compete/$slug/teams/$registrationId",
										params: {
											slug: competitionSlug,
											registrationId: reg.id,
										},
									})
								}
							}}
							className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${
								reg.id === currentRegistrationId
									? "bg-accent font-medium"
									: ""
							}`}
						>
							{reg.divisionLabel ?? "Division"}
							{reg.teamName ? ` - ${reg.teamName}` : ""}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

function TeamManagementPage() {
	const {
		registration,
		registrationDetails,
		members,
		pending,
		isTeamRegistration,
		competition,
		division,
		isTeamMember,
		isRegisteredUser,
		canEditOwnAffiliate,
		currentUserId,
		memberAffiliates,
		currentUserAffiliate,
		pendingTeammates,
		waivers,
		waiverSignatures,
		registrationQuestions,
		registrationAnswers,
		allUserRegistrations,
	} = Route.useLoaderData()

	const hasMultipleRegistrations = allUserRegistrations.length > 1

	const { welcome } = Route.useSearch()
	const navigate = useNavigate()
	const [showWelcomeModal, setShowWelcomeModal] = useState(false)

	// Show welcome modal when ?welcome=true is in URL
	useEffect(() => {
		if (welcome) {
			setShowWelcomeModal(true)
			// Clear the welcome param from URL without navigation
			navigate({
				to: ".",
				search: {},
				replace: true,
			})
		}
	}, [welcome, navigate])

	// Calculate if there are unsigned required waivers
	const signedWaiverIds = new Set(waiverSignatures.map((s) => s.waiverId))
	const hasUnsignedWaivers = waivers
		.filter((w) => w.required)
		.some((w) => !signedWaiverIds.has(w.id))

	// Helper to get affiliate for a pending invite by email
	const getPendingAffiliate = (email: string): string | null => {
		const teammate = pendingTeammates.find(
			(t) => t.email.toLowerCase() === email.toLowerCase(),
		)
		return teammate?.affiliateName || null
	}

	const copyInviteLink = async (token: string) => {
		const link = `${window.location.origin}/compete/invite/${token}`
		try {
			await navigator.clipboard.writeText(link)
			toast.success("Invite link copied to clipboard")
		} catch {
			toast.error("Failed to copy invite link")
		}
	}

	// Check if registration is still open for editing
	const isRegistrationOpen =
		!competition?.registrationClosesAt ||
		new Date() < new Date(competition.registrationClosesAt)

	// For individual registrations, show simpler view
	if (!isTeamRegistration) {
		return (
			<div className="container mx-auto max-w-4xl py-8 space-y-6">
				<div className="space-y-2">
					<h1 className="text-3xl font-bold">My Registration</h1>
					<p className="text-muted-foreground">
						{competition?.name || "Competition"} –{" "}
						{division?.label || "Division"}
					</p>
				</div>

				{/* Division Switcher - when user has multiple registrations */}
				{hasMultipleRegistrations && competition && (
					<DivisionSwitcher
						registrations={allUserRegistrations}
						currentRegistrationId={registration.id}
						competitionSlug={competition.slug}
					/>
				)}

				{/* Registration Details */}
				{registrationDetails && (
					<RegistrationDetailsCard
						details={registrationDetails}
						isTeamRegistration={false}
					/>
				)}

				{/* Registration Questions */}
				{isRegisteredUser && (
					<RegistrationAnswersForm
						registrationId={registration.id}
						questions={registrationQuestions}
						answers={registrationAnswers}
						isEditable={isRegistrationOpen}
						currentUserId={currentUserId}
						isCaptain={true}
					/>
				)}

				{/* Waivers */}
				{isRegisteredUser && waivers.length > 0 && (
					<WaiverSection
						waivers={waivers}
						signatures={waiverSignatures}
						registrationId={registration.id}
						competitionName={competition?.name || "Competition"}
					/>
				)}

				{/* Affiliate */}
				<AffiliateEditor
					registrationId={registration.id}
					userId={currentUserId}
					currentAffiliate={currentUserAffiliate}
					canEdit={canEditOwnAffiliate}
				/>
			</div>
		)
	}

	return (
		<>
			{/* Welcome Modal - shown after accepting invite */}
			<WelcomeModal
				isOpen={showWelcomeModal}
				onClose={() => setShowWelcomeModal(false)}
				teamName={registration.teamName || "Team"}
				competitionName={competition?.name || "Competition"}
				competitionSlug={competition?.slug || ""}
				divisionName={division?.label}
				hasUnsignedWaivers={hasUnsignedWaivers}
			/>

			<div className="container mx-auto max-w-4xl py-8 space-y-6">
				{/* Header */}
				<div className="space-y-2">
					<h1 className="text-3xl font-bold">
						{registration.teamName || "Team"}
					</h1>
					<p className="text-muted-foreground">
						{competition?.name || "Competition"} –{" "}
						{division?.label || "Division"}
					</p>
				</div>

				{/* Division Switcher - when user has multiple registrations */}
				{hasMultipleRegistrations && competition && (
					<DivisionSwitcher
						registrations={allUserRegistrations}
						currentRegistrationId={registration.id}
						competitionSlug={competition.slug}
					/>
				)}

				{/* Registration Details */}
				{registrationDetails && (
					<RegistrationDetailsCard
						details={registrationDetails}
						isTeamRegistration={true}
					/>
				)}

				{/* Registration Questions */}
				{(isTeamMember || isRegisteredUser) && (
					<RegistrationAnswersForm
						registrationId={registration.id}
						questions={registrationQuestions}
						answers={registrationAnswers}
						isEditable={isRegistrationOpen}
						currentUserId={currentUserId}
						isCaptain={isRegisteredUser}
					/>
				)}

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
									const memberAffiliate = member.user?.id
										? memberAffiliates[member.user.id]
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
														{memberAffiliate || "Independent"}
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
																? new Date(
																		invite.invitedAt,
																	).toLocaleDateString()
																: ""}
														</p>
														<p className="text-xs text-muted-foreground mt-0.5">
															{pendingAffiliate || "Independent"}
														</p>
													</div>
												</div>
												<div className="flex items-center gap-2">
													{isRegisteredUser && invite.token && (
														<Button
															variant="ghost"
															size="sm"
															onClick={() => copyInviteLink(invite.token!)}
														>
															<Copy className="w-4 h-4 mr-1" />
															Copy Link
														</Button>
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

				{/* Waiver Section - Show for team members */}
				{(isTeamMember || isRegisteredUser) && waivers.length > 0 && (
					<WaiverSection
						waivers={waivers}
						signatures={waiverSignatures}
						registrationId={registration.id}
						competitionName={competition?.name || "Competition"}
					/>
				)}

				{/* My Affiliate */}
				{canEditOwnAffiliate && (
					<AffiliateEditor
						registrationId={registration.id}
						userId={currentUserId}
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
								they didn&apos;t receive it, you can copy the link above and
								share it directly.
							</p>
						</CardContent>
					</Card>
				)}
			</div>
		</>
	)
}
