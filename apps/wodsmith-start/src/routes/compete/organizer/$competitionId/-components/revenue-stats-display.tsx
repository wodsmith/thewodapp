"use client"

import { Link, useLocation } from "@tanstack/react-router"
import {
	AlertCircle,
	CreditCard,
	DollarSign,
	TrendingUp,
	Users,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import type { CompetitionRevenueStats } from "@/server-fns/commerce-fns"

interface RevenueStatsDisplayProps {
	stats: CompetitionRevenueStats
	stripeStatus?: {
		isConnected: boolean
		teamSlug: string
	}
}

function formatCents(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`
}

export function RevenueStatsDisplay({
	stats,
	stripeStatus,
}: RevenueStatsDisplayProps) {
	const location = useLocation()
	const hasRevenue = stats.purchaseCount > 0

	// Build payouts URL with returnTo so user comes back here after setup
	const payoutsUrl = stripeStatus
		? `/compete/organizer/settings/payouts/${stripeStatus.teamSlug}?returnTo=${encodeURIComponent(location.pathname)}`
		: ""

	return (
		<div className="space-y-6">
			{/* Stripe Connection Warning */}
			{stripeStatus && !stripeStatus.isConnected && (
				<Alert
					variant="default"
					className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
				>
					<AlertCircle className="h-4 w-4 text-yellow-600" />
					<AlertTitle>Payouts Not Set Up</AlertTitle>
					<AlertDescription>
						Connect your Stripe account to receive payouts for registrations.{" "}
						<Link to={payoutsUrl as "/"} className="font-medium underline">
							Set up payouts &rarr;
						</Link>
					</AlertDescription>
				</Alert>
			)}

			{/* Summary Cards */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
						<DollarSign className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{formatCents(stats.totalGrossCents)}
						</div>
						<p className="text-xs text-muted-foreground">
							Total collected from athletes
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Your Net Revenue
						</CardTitle>
						<TrendingUp className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-green-600">
							{formatCents(stats.totalOrganizerNetCents)}
						</div>
						<p className="text-xs text-muted-foreground">After all fees</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Processing Fees
						</CardTitle>
						<CreditCard className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-muted-foreground">
							{formatCents(stats.totalStripeFeeCents)}
						</div>
						<p className="text-xs text-muted-foreground">Stripe fees</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Paid Registrations
						</CardTitle>
						<Users className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{stats.purchaseCount}</div>
						<p className="text-xs text-muted-foreground">Completed purchases</p>
					</CardContent>
				</Card>
			</div>

			{/* Fee Breakdown Card */}
			<Card>
				<CardHeader>
					<CardTitle>Fee Breakdown</CardTitle>
					<CardDescription>Where your revenue goes</CardDescription>
				</CardHeader>
				<CardContent>
					{hasRevenue ? (
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<span className="text-sm text-muted-foreground">
									Gross Revenue
								</span>
								<span className="font-medium">
									{formatCents(stats.totalGrossCents)}
								</span>
							</div>
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-sm">Stripe Processing</span>
								<span className="text-sm">
									- {formatCents(stats.totalStripeFeeCents)}
								</span>
							</div>
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-sm">Platform Fee</span>
								<span className="text-sm">
									- {formatCents(stats.totalPlatformFeeCents)}
								</span>
							</div>
							<div className="border-t pt-4 flex items-center justify-between">
								<span className="font-medium">Your Net Revenue</span>
								<span className="font-bold text-green-600">
									{formatCents(stats.totalOrganizerNetCents)}
								</span>
							</div>
						</div>
					) : (
						<p className="text-sm text-muted-foreground text-center py-4">
							No paid registrations yet
						</p>
					)}
				</CardContent>
			</Card>

			{/* Division Breakdown */}
			{stats.byDivision.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Revenue by Division</CardTitle>
						<CardDescription>Breakdown per division</CardDescription>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Division</TableHead>
									<TableHead className="text-right">Athletes</TableHead>
									<TableHead className="text-right">Ticket Price</TableHead>
									<TableHead className="text-right">Gross</TableHead>
									<TableHead className="text-right text-red-400">
										Platform Fee
									</TableHead>
									<TableHead className="text-right text-red-400">
										Stripe Fee
									</TableHead>
									<TableHead className="text-right">Net</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{stats.byDivision.map((division) => (
									<TableRow key={division.divisionId}>
										<TableCell className="font-medium">
											{division.divisionLabel}
										</TableCell>
										<TableCell className="text-right">
											{division.purchaseCount}
										</TableCell>
										<TableCell className="text-right text-muted-foreground">
											{formatCents(division.registrationFeeCents)}
										</TableCell>
										<TableCell className="text-right">
											{formatCents(division.grossCents)}
										</TableCell>
										<TableCell className="text-right text-red-400">
											-{formatCents(division.platformFeeCents)}
										</TableCell>
										<TableCell className="text-right text-red-400">
											-{formatCents(division.stripeFeeCents)}
										</TableCell>
										<TableCell className="text-right text-green-600">
											{formatCents(division.organizerNetCents)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
