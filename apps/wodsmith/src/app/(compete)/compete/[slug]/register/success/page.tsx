import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

import { getCloudflareContext } from "@opennextjs/cloudflare"
import { eq } from "drizzle-orm"
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
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { getDb } from "@/db"
import {
	commercePurchaseTable,
	teamInvitationTable,
	userTable,
} from "@/db/schema"
import { getStripe } from "@/lib/stripe"
import {
	getCompetition,
	getUserCompetitionRegistration,
} from "@/server/competitions"
import { getSessionFromCookie } from "@/utils/auth"
import { CopyInviteLink } from "./_components/copy-invite-link"
import { ProfileCompletionForm } from "./_components/profile-completion-form"
import { RefreshButton } from "./_components/refresh-button"

function formatCurrency(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100)
}

export default async function RegistrationSuccessPage({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>
	searchParams: Promise<{ session_id?: string }>
}) {
	const { slug } = await params
	const { session_id } = await searchParams
	const session = await getSessionFromCookie()

	if (!session) {
		redirect(`/sign-in?redirect=/compete/${slug}`)
	}

	// Get competition
	const competition = await getCompetition(slug)
	if (!competition) {
		redirect("/compete")
	}

	// Get user profile to check if complete
	const db = getDb()
	const user = await db.query.userTable.findFirst({
		where: eq(userTable.id, session.userId),
	})

	const isProfileComplete =
		user?.gender && user?.dateOfBirth && user?.affiliateName

	// Check for registration
	const registration = await getUserCompetitionRegistration(
		competition.id,
		session.userId,
	)

	// Fetch checkout session details if session_id provided
	let checkoutSession: Awaited<
		ReturnType<ReturnType<typeof getStripe>["checkout"]["sessions"]["retrieve"]>
	> | null = null

	if (session_id) {
		try {
			checkoutSession = await getStripe().checkout.sessions.retrieve(
				session_id,
				{
					expand: ["line_items", "payment_intent"],
				},
			)
		} catch {
			// Session not found or invalid - continue without payment details
		}
	}

	// Fetch purchase record for fee breakdown
	let purchase: typeof commercePurchaseTable.$inferSelect | null = null
	if (registration?.commercePurchaseId) {
		purchase =
			(await db.query.commercePurchaseTable.findFirst({
				where: eq(commercePurchaseTable.id, registration.commercePurchaseId),
			})) ?? null
	}

	// Check if competition passes Stripe fees to customer
	const passStripeFeesToCustomer = competition.passStripeFeesToCustomer ?? false

	// Fetch team invitations if this is a team registration
	let teamInvites: Array<{
		id: string
		email: string
		token: string
		acceptedAt: Date | null
		expiresAt: Date
	}> = []

	if (registration?.athleteTeam?.id) {
		const invites = await db.query.teamInvitationTable.findMany({
			where: eq(teamInvitationTable.teamId, registration.athleteTeam.id),
		})
		teamInvites = invites.map((inv) => ({
			id: inv.id,
			email: inv.email,
			token: inv.token,
			acceptedAt: inv.acceptedAt,
			expiresAt: inv.expiresAt,
		}))
	}

	// Get the base URL for invite links
	const { env } = getCloudflareContext()
	const baseUrl = env.NEXT_PUBLIC_APP_URL

	if (!registration) {
		// Payment may still be processing (webhook hasn't completed yet)
		return (
			<div className="mx-auto max-w-lg py-12 px-4">
				<Card>
					<CardHeader className="text-center">
						<Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
						<CardTitle className="text-2xl">
							Processing Your Registration...
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-center">
						<p className="text-muted-foreground">
							Your payment was successful! We&apos;re finalizing your
							registration.
						</p>
						<p className="text-sm text-muted-foreground">
							This usually takes just a few seconds. You&apos;ll receive a
							confirmation email shortly.
						</p>
						<div className="pt-4 flex flex-col gap-2">
							<Button variant="outline" asChild>
								<Link href={`/compete/${slug}`}>Back to Competition</Link>
							</Button>
							<RefreshButton />
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
							<Link href={`/compete/${slug}`}>View Competition</Link>
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Team Info with Invite Links */}
			{registration.athleteTeam && teamInvites.length > 0 && (
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<Users className="w-5 h-5 text-muted-foreground" />
							<CardTitle className="text-lg">Your Team</CardTitle>
						</div>
						<CardDescription>
							{registration.teamName || registration.athleteTeam.name}
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
						/>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
