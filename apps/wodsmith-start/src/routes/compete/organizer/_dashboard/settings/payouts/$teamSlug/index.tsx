/**
 * Payout Settings Route
 * Allows organizers to configure Stripe Connect payouts for their team.
 * Uses Express Stripe Connect account type for streamlined onboarding.
 *
 * Port from apps/wodsmith/src/app/(compete)/compete/(organizer-protected)/organizer/settings/payouts/[teamSlug]/page.tsx
 */

import { createFileRoute, notFound, redirect } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
	AlertCircle,
	CheckCircle2,
	CreditCard,
	ExternalLink,
	Loader2,
	RefreshCw,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { z } from "zod"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	type AccountBalance,
	disconnectStripeAccountFn,
	getStripeAccountBalanceFn,
	getStripeConnectionStatusFn,
	getStripeDashboardUrlFn,
	initiateExpressOnboardingFn,
	refreshOnboardingLinkFn,
	syncStripeAccountStatusFn,
} from "@/server-fns/stripe-connect-fns"
import { getTeamBySlugFn } from "@/server-fns/team-settings-fns"

// Search params validation for Stripe callback handling
const payoutSearchSchema = z.object({
	stripe_connected: z.enum(["true", "false"]).optional().catch(undefined),
	stripe_refresh: z.enum(["true", "false"]).optional().catch(undefined),
})

interface LoaderData {
	team: {
		id: string
		name: string
		slug: string
	}
	stripeStatus: {
		isConnected: boolean
		status: string | null
		accountType: string | null
		onboardingCompletedAt: Date | null
	}
	balance: AccountBalance | null
}

export const Route = createFileRoute(
	"/compete/organizer/_dashboard/settings/payouts/$teamSlug/",
)({
	component: PayoutSettingsPage,
	validateSearch: payoutSearchSchema,
	loader: async ({ params, context }): Promise<LoaderData> => {
		const { teamSlug } = params

		// Validate session
		const session = context.session
		if (!session) {
			throw redirect({
				to: "/sign-in",
				search: { redirect: `/compete/organizer/settings/payouts/${teamSlug}` },
			})
		}

		// Get team by slug
		const teamResult = await getTeamBySlugFn({ data: { slug: teamSlug } })
		if (!teamResult.success || !teamResult.data) {
			throw notFound()
		}

		const team = teamResult.data

		// Get Stripe connection status
		const stripeStatus = await getStripeConnectionStatusFn({
			data: { teamId: team.id },
		})

		// Get balance if connected
		let balance: AccountBalance | null = null
		if (stripeStatus.isConnected) {
			balance = await getStripeAccountBalanceFn({ data: { teamId: team.id } })
		}

		return {
			team: {
				id: team.id,
				name: team.name,
				slug: team.slug,
			},
			stripeStatus: {
				isConnected: stripeStatus.isConnected,
				status: stripeStatus.status,
				accountType: stripeStatus.accountType,
				onboardingCompletedAt: stripeStatus.onboardingCompletedAt
					? new Date(stripeStatus.onboardingCompletedAt)
					: null,
			},
			balance,
		}
	},
})

function PayoutSettingsPage() {
	const { team, stripeStatus, balance } = Route.useLoaderData()
	const { stripe_connected, stripe_refresh } = Route.useSearch()

	// Server function hooks
	const initiateExpress = useServerFn(initiateExpressOnboardingFn)
	const refreshOnboarding = useServerFn(refreshOnboardingLinkFn)
	const syncStatus = useServerFn(syncStripeAccountStatusFn)
	const getDashboardUrl = useServerFn(getStripeDashboardUrlFn)
	const disconnectAccount = useServerFn(disconnectStripeAccountFn)

	const [isLoading, setIsLoading] = useState<string | null>(null)

	// Show success message if just connected
	const showConnectedMessage = stripe_connected === "true"
	const showRefreshMessage = stripe_refresh === "true"

	const handleStartExpress = async () => {
		setIsLoading("express")
		try {
			const result = await initiateExpress({ data: { teamId: team.id } })
			if (result.onboardingUrl) {
				window.location.href = result.onboardingUrl
			}
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to start Stripe onboarding",
			)
		} finally {
			setIsLoading(null)
		}
	}

	const handleRefreshOnboarding = async () => {
		setIsLoading("refresh")
		try {
			const result = await refreshOnboarding({ data: { teamId: team.id } })
			if (result.onboardingUrl) {
				window.location.href = result.onboardingUrl
			}
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to refresh onboarding link",
			)
		} finally {
			setIsLoading(null)
		}
	}

	const handleSyncStatus = async () => {
		setIsLoading("sync")
		try {
			await syncStatus({ data: { teamId: team.id } })
			toast.success("Status synced successfully")
			// Reload to get updated status
			window.location.reload()
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to sync Stripe status",
			)
		} finally {
			setIsLoading(null)
		}
	}

	const handleOpenDashboard = async () => {
		setIsLoading("dashboard")
		try {
			const result = await getDashboardUrl({ data: { teamId: team.id } })
			if (result.dashboardUrl) {
				window.open(result.dashboardUrl, "_blank")
			}
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to open Stripe dashboard",
			)
		} finally {
			setIsLoading(null)
		}
	}

	const handleDisconnect = async () => {
		if (
			!window.confirm(
				"Are you sure you want to disconnect your Stripe account? You will need to reconnect to accept payments.",
			)
		) {
			return
		}

		setIsLoading("disconnect")
		try {
			await disconnectAccount({ data: { teamId: team.id } })
			toast.success("Stripe account disconnected")
			// Reload to get updated status
			window.location.reload()
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to disconnect Stripe account",
			)
		} finally {
			setIsLoading(null)
		}
	}

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
		}).format(amount / 100)
	}

	return (
		<div className="container mx-auto max-w-3xl py-8 space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold">Payout Settings</h1>
				<p className="text-muted-foreground mt-1">
					Configure how you receive payments for {team.name}
				</p>
			</div>
			{/* Success Messages */}
			{showConnectedMessage && (
				<Alert className="bg-green-50 border-green-200">
					<CheckCircle2 className="h-4 w-4 text-green-600" />
					<AlertTitle className="text-green-800">
						Stripe Account Connected
					</AlertTitle>
					<AlertDescription className="text-green-700">
						Your Stripe account has been successfully connected. You can now
						accept payments for your competitions.
					</AlertDescription>
				</Alert>
			)}
			{showRefreshMessage && (
				<Alert>
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Continue Stripe Setup</AlertTitle>
					<AlertDescription>
						Your Stripe setup was interrupted. Click the button below to
						continue where you left off.
					</AlertDescription>
				</Alert>
			)}
			{/* Stripe Connection Card */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2 pb-2">
								<CreditCard className="h-5 w-5" />
								Stripe Connect
							</CardTitle>
							<CardDescription>
								Connect your Stripe account to receive payouts
							</CardDescription>
						</div>
						{stripeStatus.isConnected && (
							<Badge
								variant="outline"
								className="text-green-600 border-green-600"
							>
								<CheckCircle2 className="h-3 w-3 mr-1" />
								Connected
							</Badge>
						)}
						{stripeStatus.status === "PENDING" && (
							<Badge
								variant="outline"
								className="text-yellow-600 border-yellow-600"
							>
								<AlertCircle className="h-3 w-3 mr-1" />
								Pending Setup
							</Badge>
						)}
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{!stripeStatus.status ? (
						// Not connected - show connection options
						<div className="space-y-4">
							<p className="text-sm text-muted-foreground">
								Connect your Stripe account to start accepting payments for
								competition registrations. Your earnings will be automatically
								transferred to your bank account.
							</p>
							<Button
								onClick={handleStartExpress}
								disabled={isLoading !== null}
								size="lg"
							>
								{isLoading === "express" ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Starting...
									</>
								) : (
									"Connect with Stripe"
								)}
							</Button>
						</div>
					) : stripeStatus.status === "PENDING" ? (
						// Pending - show continue setup button
						<div className="space-y-4">
							<Alert>
								<AlertCircle className="h-4 w-4" />
								<AlertTitle>Complete Your Setup</AlertTitle>
								<AlertDescription>
									Your Stripe account is connected but not fully verified. You
									need to complete the verification process to start accepting
									payments.
								</AlertDescription>
							</Alert>
							<div className="flex gap-3">
								{stripeStatus.accountType === "express" && (
									<Button
										onClick={handleRefreshOnboarding}
										disabled={isLoading !== null}
									>
										{isLoading === "refresh" ? (
											<>
												<Loader2 className="h-4 w-4 mr-2 animate-spin" />
												Loading...
											</>
										) : (
											"Continue Setup"
										)}
									</Button>
								)}

								<Button
									variant="outline"
									onClick={handleSyncStatus}
									disabled={isLoading !== null}
								>
									{isLoading === "sync" ? (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<RefreshCw className="h-4 w-4 mr-2" />
									)}
									Refresh Status
								</Button>
							</div>
						</div>
					) : (
						// Connected - show account info and balance
						<div className="space-y-4">
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="p-4 rounded-lg bg-muted/50">
									<p className="text-sm font-medium text-muted-foreground">
										Account Type
									</p>
									<p className="text-lg font-semibold capitalize">
										{stripeStatus.accountType || "Unknown"}
									</p>
								</div>
								{stripeStatus.onboardingCompletedAt && (
									<div className="p-4 rounded-lg bg-muted/50">
										<p className="text-sm font-medium text-muted-foreground">
											Connected On
										</p>
										<p className="text-lg font-semibold">
											{new Date(
												stripeStatus.onboardingCompletedAt,
											).toLocaleDateString()}
										</p>
									</div>
								)}
							</div>
							{/* Balance Display */}
							{balance && (
								<div className="space-y-2">
									<h3 className="font-medium">Account Balance</h3>
									<div className="grid gap-4 sm:grid-cols-2">
										<div className="p-4 rounded-lg border">
											<p className="text-sm text-muted-foreground">Available</p>
											<p className="text-2xl font-bold text-green-600">
												{balance.available.length > 0
													? formatCurrency(balance.available[0].amount)
													: "$0.00"}
											</p>
										</div>
										<div className="p-4 rounded-lg border">
											<p className="text-sm text-muted-foreground">Pending</p>
											<p className="text-2xl font-bold">
												{balance.pending.length > 0
													? formatCurrency(balance.pending[0].amount)
													: "$0.00"}
											</p>
										</div>
									</div>
								</div>
							)}
							{/* Actions */}
							<div className="flex flex-wrap gap-3 pt-2">
								<Button
									onClick={handleOpenDashboard}
									disabled={isLoading !== null}
								>
									{isLoading === "dashboard" ? (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<ExternalLink className="h-4 w-4 mr-2" />
									)}
									Open Stripe Dashboard
								</Button>

								<Button
									variant="outline"
									onClick={handleSyncStatus}
									disabled={isLoading !== null}
								>
									{isLoading === "sync" ? (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<RefreshCw className="h-4 w-4 mr-2" />
									)}
									Refresh Status
								</Button>

								<Button
									variant="ghost"
									className="text-destructive hover:text-destructive"
									onClick={handleDisconnect}
									disabled={isLoading !== null}
								>
									{isLoading === "disconnect" ? (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									) : null}
									Disconnect Account
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
			{/* Info Card */}
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">How Payouts Work</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3 text-sm text-muted-foreground">
					<p>
						When athletes register for your competitions, their payment is
						processed through Stripe. After Stripe and platform fees are
						deducted, the remaining amount is transferred to your connected bank
						account.
					</p>
					<p>
						Payouts typically arrive in your bank account within 2-7 business
						days, depending on your country and Stripe account settings.
					</p>
				</CardContent>
			</Card>
		</div>
	)
}
