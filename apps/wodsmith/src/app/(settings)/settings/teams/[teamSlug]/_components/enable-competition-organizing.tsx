"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
	Trophy,
	CheckCircle,
	Loader2,
	CreditCard,
	ExternalLink,
	Unlink,
	Wallet,
	Clock,
	CheckCircle2,
	AlertCircle,
} from "lucide-react"
import { useServerAction } from "@repo/zsa-react"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { enableCompetitionOrganizingAction } from "@/actions/entitlements-actions"
import {
	initiateExpressOnboarding,
	initiateStandardOAuth,
	refreshOnboardingLink,
	getStripeDashboardUrl,
	disconnectStripeAccount,
	getStripeConnectionStatus,
} from "@/actions/stripe-connect.action"
import { toast } from "sonner"
import type { AccountBalance } from "@/server/stripe-connect"

interface EnableCompetitionOrganizingProps {
	teamId: string
	teamSlug: string
	isEnabled: boolean
	organizerStatus: "not_applied" | "pending" | "approved"
	stripeAccountStatus: string | null
	stripeAccountType: string | null
	stripeOnboardingCompletedAt: Date | null
	balance?: AccountBalance | null
	showConnectedMessage?: boolean
	showRefreshMessage?: boolean
	stripeError?: string
}

function formatCurrency(amountCents: number, currency: string): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: currency.toUpperCase(),
	}).format(amountCents / 100)
}

export function EnableCompetitionOrganizing({
	teamId,
	teamSlug,
	isEnabled,
	organizerStatus,
	stripeAccountStatus,
	stripeAccountType,
	stripeOnboardingCompletedAt,
	balance,
	showConnectedMessage,
	showRefreshMessage,
	stripeError,
}: EnableCompetitionOrganizingProps) {
	const router = useRouter()
	const [enabled, setEnabled] = useState(isEnabled)
	const [isLoading, setIsLoading] = useState<string | null>(null)

	const isStripeConnected = stripeAccountStatus === "VERIFIED"
	const isStripePending = stripeAccountStatus === "PENDING"
	const isStripeNotConnected = !stripeAccountStatus

	const { execute, isPending } = useServerAction(
		enableCompetitionOrganizingAction,
		{
			onSuccess: () => {
				setEnabled(true)
				toast.success("Competition organizing enabled!")
				router.refresh()
			},
			onError: ({ err }) => {
				toast.error(err.message || "Failed to enable competition organizing")
			},
		},
	)

	const handleEnable = () => {
		execute({ teamId })
	}

	// Redirect to onboard page if not applied
	const handleApply = () => {
		router.push("/compete/organizer/onboard")
	}

	const handleExpressOnboarding = async () => {
		setIsLoading("express")
		try {
			const result = await initiateExpressOnboarding({ teamId })
			if (result.onboardingUrl) {
				window.location.href = result.onboardingUrl
			}
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to start onboarding",
			)
			setIsLoading(null)
		}
	}

	const handleStandardOAuth = async () => {
		setIsLoading("standard")
		try {
			console.log("[Stripe OAuth] Initiating Standard OAuth for team:", teamId)
			const result = await initiateStandardOAuth({ teamId })
			console.log("[Stripe OAuth] Result:", result)
			if (result.authorizationUrl) {
				console.log("[Stripe OAuth] Redirecting to:", result.authorizationUrl)
				window.location.href = result.authorizationUrl
			} else {
				console.error("[Stripe OAuth] No authorization URL returned")
				toast.error("Failed to get Stripe authorization URL")
				setIsLoading(null)
			}
		} catch (err) {
			console.error("[Stripe OAuth] Error:", err)
			toast.error(err instanceof Error ? err.message : "Failed to start OAuth")
			setIsLoading(null)
		}
	}

	const handleRefreshLink = async () => {
		setIsLoading("refresh")
		try {
			const result = await refreshOnboardingLink({ teamId })
			if (result.onboardingUrl) {
				window.location.href = result.onboardingUrl
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to refresh link")
			setIsLoading(null)
		}
	}

	const handleViewDashboard = async () => {
		setIsLoading("dashboard")
		try {
			const result = await getStripeDashboardUrl({ teamId })
			if (result.dashboardUrl) {
				window.open(result.dashboardUrl, "_blank")
			}
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to get dashboard link",
			)
		} finally {
			setIsLoading(null)
		}
	}

	const handleDisconnect = async () => {
		setIsLoading("disconnect")
		try {
			await disconnectStripeAccount({ teamId })
			toast.success("Stripe account disconnected")
			router.refresh()
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to disconnect")
		} finally {
			setIsLoading(null)
		}
	}

	// Not applied state - direct to onboard page
	if (organizerStatus === "not_applied") {
		return (
			<Card>
				<CardHeader>
					<div className="flex items-center gap-3">
						<Trophy className="h-6 w-6 text-muted-foreground" />
						<div>
							<CardTitle className="text-lg">Competition Organizing</CardTitle>
							<CardDescription>
								Apply to host competitions on WODsmith
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm text-muted-foreground">
						Competition organizing allows you to:
					</p>
					<ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
						<li>Create and publish competitions</li>
						<li>Manage athlete registrations</li>
						<li>Set up divisions and events</li>
						<li>Accept payments for entry fees</li>
					</ul>
					<Button onClick={handleApply}>Apply to Become an Organizer</Button>
				</CardContent>
			</Card>
		)
	}

	// Pending approval state
	if (organizerStatus === "pending") {
		return (
			<Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
				<CardHeader>
					<div className="flex items-center gap-3">
						<Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
						<div>
							<CardTitle className="text-lg">Application Pending</CardTitle>
							<CardDescription>
								Your organizer application is under review
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm text-muted-foreground">
						While your application is being reviewed, you can create draft
						competitions to get familiar with the platform. Draft competitions
						won't be visible until you publish them after approval.
					</p>
					<Button asChild variant="outline">
						<a href="/compete/organizer">Create Draft Competition</a>
					</Button>
				</CardContent>
			</Card>
		)
	}

	// Legacy fallback: if not enabled but has approved status, use old enable logic
	if (!enabled) {
		return (
			<Card>
				<CardHeader>
					<div className="flex items-center gap-3">
						<Trophy className="h-6 w-6 text-muted-foreground" />
						<div>
							<CardTitle className="text-lg">Competition Organizing</CardTitle>
							<CardDescription>
								Enable this team to create and manage CrossFit competitions
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm text-muted-foreground">
						Competition organizing allows you to:
					</p>
					<ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
						<li>Create and publish competitions</li>
						<li>Manage athlete registrations</li>
						<li>Set up divisions and events</li>
						<li>Accept payments for entry fees</li>
					</ul>
					<Button onClick={handleEnable} disabled={isPending}>
						{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						Enable Competition Organizing
					</Button>
				</CardContent>
			</Card>
		)
	}

	// Enabled state - show competition organizing + payouts
	return (
		<div className="space-y-4">
			{/* Success/Error Messages for Stripe */}
			{showConnectedMessage && (
				<Alert>
					<CheckCircle2 className="h-4 w-4" />
					<AlertTitle>Stripe Connected!</AlertTitle>
					<AlertDescription>
						Your Stripe account is now connected. You can accept paid
						registrations for your competitions.
					</AlertDescription>
				</Alert>
			)}

			{showRefreshMessage && (
				<Alert>
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Complete Your Setup</AlertTitle>
					<AlertDescription>
						Your onboarding link expired. Click below to continue setting up
						your Stripe account.
					</AlertDescription>
				</Alert>
			)}

			{stripeError && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Connection Failed</AlertTitle>
					<AlertDescription>
						{stripeError === "access_denied"
							? "You declined the Stripe connection request."
							: `Error: ${stripeError}`}
					</AlertDescription>
				</Alert>
			)}

			{/* Competition Organizing Enabled Card */}
			<Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
				<CardHeader>
					<div className="flex items-center gap-3">
						<CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
						<div>
							<CardTitle className="text-lg">
								Competition Organizing Enabled
							</CardTitle>
							<CardDescription>
								This team can create and manage competitions
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<Button asChild variant="outline">
						<a href="/compete/organizer">Go to Organizer Dashboard</a>
					</Button>
				</CardContent>
			</Card>

			{/* Stripe Balance Cards (when connected) */}
			{isStripeConnected && balance && (
				<div className="grid gap-4 sm:grid-cols-2">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Available Balance
							</CardTitle>
							<Wallet className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							{balance.available.length > 0 ? (
								balance.available.map((b) => (
									<div
										key={b.currency}
										className="text-2xl font-bold text-green-600"
									>
										{formatCurrency(b.amount, b.currency)}
									</div>
								))
							) : (
								<div className="text-2xl font-bold text-muted-foreground">
									$0.00
								</div>
							)}
							<p className="text-xs text-muted-foreground">Ready for payout</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Pending Balance
							</CardTitle>
							<Clock className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							{balance.pending.length > 0 ? (
								balance.pending.map((b) => (
									<div
										key={b.currency}
										className="text-2xl font-bold text-yellow-600"
									>
										{formatCurrency(b.amount, b.currency)}
									</div>
								))
							) : (
								<div className="text-2xl font-bold text-muted-foreground">
									$0.00
								</div>
							)}
							<p className="text-xs text-muted-foreground">
								Processing (typically 2-7 days)
							</p>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Stripe Connected State */}
			{isStripeConnected && (
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<CheckCircle2 className="h-5 w-5 text-green-600" />
							<CardTitle>Stripe Connected</CardTitle>
						</div>
						<CardDescription>
							Your {stripeAccountType === "express" ? "Express" : "Standard"}{" "}
							Stripe account is connected and ready to receive payouts.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex flex-col sm:flex-row gap-3">
							<Button
								variant="outline"
								onClick={handleViewDashboard}
								disabled={isLoading === "dashboard"}
							>
								{isLoading === "dashboard" ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<ExternalLink className="mr-2 h-4 w-4" />
								)}
								View Stripe Dashboard
							</Button>

							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button variant="ghost" className="text-destructive">
										<Unlink className="mr-2 h-4 w-4" />
										Disconnect
									</Button>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>
											Disconnect Stripe Account?
										</AlertDialogTitle>
										<AlertDialogDescription>
											This will prevent you from accepting paid registrations
											for your competitions. Any active paid competitions will
											stop accepting new registrations until you reconnect.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel>
										<AlertDialogAction
											onClick={handleDisconnect}
											className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
										>
											{isLoading === "disconnect" ? (
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											) : null}
											Disconnect
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</div>

						{stripeOnboardingCompletedAt && (
							<p className="text-xs text-muted-foreground">
								Connected on{" "}
								{new Date(stripeOnboardingCompletedAt).toLocaleDateString()}
							</p>
						)}
					</CardContent>
				</Card>
			)}

			{/* Stripe Pending State */}
			{isStripePending && (
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<Loader2 className="h-5 w-5 animate-spin text-yellow-600" />
							<CardTitle>Complete Stripe Setup</CardTitle>
						</div>
						<CardDescription>
							{stripeAccountType === "express"
								? "Your Stripe account setup is incomplete. Continue onboarding to start receiving payouts."
								: "Your Stripe account is connected but needs to complete verification in Stripe Dashboard."}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						{stripeAccountType === "express" ? (
							<Button
								onClick={handleRefreshLink}
								disabled={isLoading === "refresh"}
							>
								{isLoading === "refresh" ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<ExternalLink className="mr-2 h-4 w-4" />
								)}
								Continue Setup
							</Button>
						) : (
							<div className="space-y-3">
								<div className="flex flex-col sm:flex-row gap-3">
									<Button
										variant="outline"
										onClick={() =>
											window.open("https://dashboard.stripe.com", "_blank")
										}
									>
										<ExternalLink className="mr-2 h-4 w-4" />
										Open Stripe Dashboard
									</Button>
									<Button
										variant="secondary"
										onClick={async () => {
											setIsLoading("check")
											try {
												const result = await getStripeConnectionStatus({
													teamId,
												})
												if (result.isConnected) {
													toast.success("Account verified!")
													router.refresh()
												} else {
													toast.info("Account still pending verification")
												}
											} catch (err) {
												toast.error("Failed to check status")
											} finally {
												setIsLoading(null)
											}
										}}
										disabled={isLoading === "check"}
									>
										{isLoading === "check" ? (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										) : (
											<CheckCircle2 className="mr-2 h-4 w-4" />
										)}
										Check Status
									</Button>
								</div>
								<p className="text-xs text-muted-foreground">
									Complete any pending requirements in your Stripe Dashboard,
									then click "Check Status".
								</p>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{/* Stripe Not Connected State */}
			{isStripeNotConnected && (
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<CreditCard className="h-5 w-5 text-muted-foreground" />
							<CardTitle>Connect Stripe for Payouts</CardTitle>
						</div>
						<CardDescription>
							Connect your Stripe account to receive payouts from competition
							registrations. Free competitions work without Stripe.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-4 sm:grid-cols-2">
							{/* Express Account Option */}
							<Card className="border-2">
								<CardHeader className="pb-2">
									<CardTitle className="text-base">
										Create New Account
									</CardTitle>
									<CardDescription className="text-sm">
										Quick 5-10 minute setup with Stripe Express
									</CardDescription>
								</CardHeader>
								<CardContent>
									<Button
										onClick={handleExpressOnboarding}
										disabled={isLoading === "express"}
										className="w-full"
									>
										{isLoading === "express" ? (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										) : null}
										Get Started
									</Button>
								</CardContent>
							</Card>

							{/* Standard Account Option */}
							<Card className="border-2">
								<CardHeader className="pb-2">
									<CardTitle className="text-base">Connect Existing</CardTitle>
									<CardDescription className="text-sm">
										Already have a Stripe account? Connect it here
									</CardDescription>
								</CardHeader>
								<CardContent>
									<Button
										variant="outline"
										onClick={handleStandardOAuth}
										disabled={isLoading === "standard"}
										className="w-full"
									>
										{isLoading === "standard" ? (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										) : null}
										Connect Account
									</Button>
								</CardContent>
							</Card>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
