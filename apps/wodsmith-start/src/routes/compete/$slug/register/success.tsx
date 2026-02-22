import {
	createFileRoute,
	Link,
	redirect,
	useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
	AlertCircle,
	CheckCircle,
	CheckCircle2,
	Clock,
	Loader2,
	Mail,
	Receipt,
	Users,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { z } from "zod"
import { CopyInviteLink } from "@/components/registration/copy-invite-link"
import { ProfileCompletionForm } from "@/components/registration/profile-completion-form"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { Gender } from "@/db/schema"
import { getAppUrlFn } from "@/lib/env"
import {
	getRegistrationSuccessDataFn,
	updateAthleteBasicProfileFn,
} from "@/server-fns/athlete-profile-fns"
import {
	getRegistrationPurchaseStatusFn,
	getUserCompetitionRegistrationFn,
} from "@/server-fns/competition-detail-fns"

const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 40 // ~2 minutes of polling

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100)
}

// ============================================================================
// Route Definition
// ============================================================================

export const Route = createFileRoute("/compete/$slug/register/success")({
	component: RegistrationSuccessPage,
	validateSearch: z.object({
		session_id: z.string().optional(),
	}),
	loaderDeps: ({ search }) => ({ session_id: search.session_id }),
	loader: async ({ params, context, deps, parentMatchPromise }) => {
		const { slug } = params
		const { session_id } = deps
		const session = context?.session ?? null

		if (!session) {
			throw redirect({
				to: "/sign-in",
				search: { redirect: `/compete/${slug}` },
			})
		}

		// Get competition from parent
		const parentMatch = await parentMatchPromise
		const competition = parentMatch.loaderData?.competition
		if (!competition) {
			throw redirect({ to: "/compete" })
		}

		// Check for registration
		const { registration } = await getUserCompetitionRegistrationFn({
			data: {
				competitionId: competition.id,
				userId: session.userId,
			},
		})

		// Check if competition passes Stripe fees to customer
		const passStripeFeesToCustomer =
			competition.passStripeFeesToCustomer ?? false

		// Get the base URL for invite links
		const baseUrl = await getAppUrlFn()

		// Fetch additional data via server function (avoids client-side db import)
		const { user, isProfileComplete, checkoutSession, purchase, teamInvites } =
			await getRegistrationSuccessDataFn({
				data: {
					competitionId: competition.id,
					userId: session.userId,
					sessionId: session_id,
					registrationId: registration?.id,
					commercePurchaseId:
						(registration as { commercePurchaseId?: string })
							?.commercePurchaseId ?? undefined,
					athleteTeamId: registration?.athleteTeamId ?? undefined,
					passStripeFeesToCustomer,
				},
			})

		return {
			competition,
			registration,
			user,
			isProfileComplete,
			checkoutSession,
			purchase,
			passStripeFeesToCustomer,
			teamInvites,
			baseUrl,
			slug,
			competitionId: competition.id,
			userId: session.userId,
		}
	},
})

function RegistrationSuccessPage() {
	const {
		competition,
		registration,
		user,
		isProfileComplete,
		checkoutSession,
		purchase,
		passStripeFeesToCustomer,
		teamInvites,
		baseUrl,
		slug,
		competitionId,
		userId,
	} = Route.useLoaderData()

	// Use useServerFn for client-side calls
	const updateAthleteProfile = useServerFn(updateAthleteBasicProfileFn)
	const checkStatus = useServerFn(getRegistrationPurchaseStatusFn)
	const router = useRouter()

	const isProcessing = !registration
	const [polling, setPolling] = useState(isProcessing)
	const pollCount = useRef(0)

	useEffect(() => {
		if (!polling) return

		const interval = setInterval(async () => {
			pollCount.current += 1

			if (pollCount.current >= MAX_POLL_ATTEMPTS) {
				setPolling(false)
				clearInterval(interval)
				return
			}

			const { status } = await checkStatus({
				data: { competitionId, userId },
			})

			if (status === "registered") {
				setPolling(false)
				clearInterval(interval)
				router.invalidate()
			}
		}, POLL_INTERVAL_MS)

		return () => clearInterval(interval)
	}, [polling, checkStatus, competitionId, userId, router])

	const handleProfileUpdate = async (values: {
		gender: Gender
		dateOfBirth: Date
		affiliateName: string
	}) => {
		await updateAthleteProfile({ data: values })
	}

	if (isProcessing) {
		// Payment may still be processing (webhook hasn't completed yet)
		return (
			<div className="mx-auto max-w-lg py-12 px-4">
				<Card>
					<CardHeader className="text-center">
						<Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
						<CardTitle className="text-xl">
							Finalizing Your Registration...
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-center">
						<p className="text-muted-foreground">
							Your payment was successful! We&apos;re finishing up the
							registration process.
						</p>
						<p className="text-sm text-muted-foreground">
							This page will update automatically once your registration is
							confirmed.
						</p>
						<div className="pt-4 flex flex-col gap-2">
							<Button variant="outline" asChild>
								<Link to="/compete/$slug" params={{ slug }}>
									Back to Competition
								</Link>
							</Button>
							{!polling && (
								<Button
									variant="ghost"
									className="text-sm"
									onClick={() => {
										pollCount.current = 0
										setPolling(true)
									}}
								>
									Check Again
								</Button>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	// Registration found - show success
	return (
		<div className="mx-auto max-w-lg py-12 px-4 space-y-6">
			<Card>
				<CardHeader className="text-center">
					<CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
					<CardTitle className="text-2xl">Registration Complete!</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 text-center">
					<p>
						You&apos;re registered for <strong>{competition.name}</strong>
					</p>

					{registration.teamName && (
						<p className="text-muted-foreground">
							Team: <strong>{registration.teamName}</strong>
						</p>
					)}

					<div className="pt-4">
						<Button asChild>
							<Link to="/compete/$slug" params={{ slug }}>
								View Competition
							</Link>
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Team Info with Invite Links */}
			{registration.athleteTeamId && teamInvites.length > 0 && (
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<Users className="w-5 h-5 text-muted-foreground" />
							<CardTitle className="text-lg">Your Team</CardTitle>
						</div>
						<CardDescription>
							{registration.teamName || "Your Team"}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-sm text-muted-foreground">
							Share these invite links with your teammates so they can join your
							team.
						</p>

						<div className="space-y-3">
							{teamInvites.map((invite) => {
								const inviteUrl = `${baseUrl}/compete/invite/${invite.token}`
								const isAccepted = !!invite.acceptedAt
								const isExpired = invite.expiresAt < new Date()

								return (
									<div
										key={invite.id}
										className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
									>
										<div className="flex items-center gap-3 min-w-0">
											{isAccepted ? (
												<CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
											) : isExpired ? (
												<Clock className="w-4 h-4 text-destructive flex-shrink-0" />
											) : (
												<Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
											)}
											<div className="min-w-0">
												<p className="text-sm font-medium truncate">
													{invite.email}
												</p>
												<p className="text-xs text-muted-foreground">
													{isAccepted
														? "Joined"
														: isExpired
															? "Invite expired"
															: "Pending"}
												</p>
											</div>
										</div>

										{!isAccepted && !isExpired && (
											<CopyInviteLink inviteUrl={inviteUrl} />
										)}
									</div>
								)
							})}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Payment Receipt */}
			{purchase && purchase.status === "COMPLETED" && (
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<Receipt className="w-5 h-5 text-muted-foreground" />
							<CardTitle className="text-lg">Payment Receipt</CardTitle>
						</div>
						{checkoutSession?.customer_details?.email && (
							<CardDescription>
								{checkoutSession.customer_details.email}
							</CardDescription>
						)}
					</CardHeader>
					<CardContent className="space-y-4">
						{/* Fee Breakdown */}
						<div className="space-y-2">
							{/* Registration Fee (base) - calculate from total minus fees */}
							<div className="flex justify-between text-sm">
								<span>Registration Fee</span>
								<span>
									{formatCurrency(
										purchase.totalCents -
											purchase.platformFeeCents -
											(passStripeFeesToCustomer ? purchase.stripeFeeCents : 0),
									)}
								</span>
							</div>

							{/* Platform Fee */}
							<div className="flex justify-between text-sm text-muted-foreground">
								<span>Platform Fee</span>
								<span>{formatCurrency(purchase.platformFeeCents)}</span>
							</div>

							{/* Stripe Fee (only if passed to customer) */}
							{passStripeFeesToCustomer && purchase.stripeFeeCents > 0 && (
								<div className="flex justify-between text-sm text-muted-foreground">
									<span>Payment Processing Fee</span>
									<span>{formatCurrency(purchase.stripeFeeCents)}</span>
								</div>
							)}
						</div>

						<Separator />

						{/* Total */}
						<div className="flex justify-between font-medium">
							<span>Total Paid</span>
							<span>{formatCurrency(purchase.totalCents)}</span>
						</div>

						{/* Payment Method & Date */}
						<div className="text-xs text-muted-foreground text-center pt-2 space-y-1">
							{typeof checkoutSession?.payment_intent === "object" &&
								checkoutSession.payment_intent?.payment_method_types && (
									<p>
										Paid via{" "}
										{checkoutSession.payment_intent.payment_method_types[0]}
									</p>
								)}
							{purchase.completedAt && (
								<p>
									{new Date(purchase.completedAt).toLocaleDateString("en-US", {
										year: "numeric",
										month: "long",
										day: "numeric",
									})}
								</p>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{!isProfileComplete && (
				<Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
					<CardHeader>
						<div className="flex items-center gap-2">
							<AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
							<CardTitle className="text-lg">Complete Your Profile</CardTitle>
						</div>
						<CardDescription>
							Please provide your gender and date of birth for competition
							purposes.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ProfileCompletionForm
							currentGender={user?.gender}
							currentDateOfBirth={user?.dateOfBirth}
							currentAffiliateName={user?.affiliateName}
							onSubmit={handleProfileUpdate}
						/>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
