/**
 * Athlete Invoice Details Route
 *
 * Displays detailed invoice information for a specific purchase,
 * including payment breakdown and PDF download option.
 */

import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import { ArrowLeft, CreditCard, Receipt } from "lucide-react"
import { z } from "zod"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { getInvoiceDetailsFn } from "@/server-fns/athlete-profile-fns"
import { DownloadInvoiceButton } from "./-components/download-invoice-button"

const searchSchema = z.object({
	returnTo: z.string().startsWith("/").optional(),
})

export const Route = createFileRoute("/compete/athlete/invoices/$purchaseId")({
	component: InvoiceDetailPage,
	validateSearch: (search) => searchSchema.parse(search),
	loader: async ({ params }) => {
		const { invoice } = await getInvoiceDetailsFn({
			data: { purchaseId: params.purchaseId },
		})

		if (!invoice) {
			throw notFound()
		}

		return { invoice }
	},
})

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100)
}

function formatDate(date: string | Date | null): string {
	if (!date) return "-"

	// Handle YYYY-MM-DD string format
	if (typeof date === "string") {
		const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
		if (match) {
			const [, yearStr, monthStr, dayStr] = match
			const year = Number(yearStr)
			const month = Number(monthStr)
			const day = Number(dayStr)
			// Validate month range to prevent undefined access
			if (month < 1 || month > 12) return "-"
			const months = [
				"January",
				"February",
				"March",
				"April",
				"May",
				"June",
				"July",
				"August",
				"September",
				"October",
				"November",
				"December",
			]
			return `${months[month - 1]} ${day}, ${year}`
		}
		return "-"
	}

	return new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(new Date(date))
}

function getStatusBadge(status: string) {
	switch (status) {
		case "COMPLETED":
			return <Badge variant="default">Paid</Badge>
		case "PENDING":
			return <Badge variant="secondary">Pending</Badge>
		case "FAILED":
			return <Badge variant="destructive">Failed</Badge>
		case "CANCELLED":
			return <Badge variant="outline">Cancelled</Badge>
		default:
			return <Badge variant="outline">{status}</Badge>
	}
}

function capitalizeFirst(str: string | null): string {
	if (!str) return ""
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

// ============================================================================
// Component
// ============================================================================

function InvoiceDetailPage() {
	const { invoice } = Route.useLoaderData()
	const { returnTo } = Route.useSearch()

	// Calculate registration fee (total minus fees passed to customer)
	const registrationFee =
		invoice.totalCents - invoice.platformFeeCents - invoice.stripeFeeCents

	// Default back to invoices list if no returnTo specified
	const backLink = returnTo || "/compete/athlete/invoices"

	return (
		<div className="mx-auto max-w-2xl space-y-6 pb-12">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Button variant="ghost" size="icon" asChild>
						<Link to={backLink}>
							<ArrowLeft className="h-4 w-4" />
						</Link>
					</Button>
					<div className="flex items-center gap-2">
						<Receipt className="h-6 w-6" />
						<h1 className="font-bold text-2xl">Invoice</h1>
					</div>
				</div>
				<DownloadInvoiceButton invoice={invoice} />
			</div>

			{/* Invoice Card */}
			<Card>
				<CardHeader className="pb-4">
					<div className="flex items-start justify-between">
						<div>
							<CardTitle className="text-xl">
								{invoice.competition?.name ?? invoice.product.name}
							</CardTitle>
							{invoice.competition?.organizingTeam && (
								<p className="text-muted-foreground text-sm mt-1">
									{invoice.competition.organizingTeam.name}
								</p>
							)}
						</div>
						{getStatusBadge(invoice.status)}
					</div>
				</CardHeader>

				<CardContent className="space-y-6">
					{/* Invoice Details */}
					<div className="grid grid-cols-2 gap-4 text-sm">
						<div>
							<p className="text-muted-foreground">Invoice ID</p>
							<p className="font-mono text-xs mt-0.5">{invoice.id}</p>
						</div>
						<div>
							<p className="text-muted-foreground">Date</p>
							<p>{formatDate(invoice.completedAt ?? invoice.createdAt)}</p>
						</div>
						<div>
							<p className="text-muted-foreground">Bill To</p>
							<p>
								{invoice.user.firstName} {invoice.user.lastName}
							</p>
							<p className="text-muted-foreground">{invoice.user.email}</p>
						</div>
						{invoice.competition?.startDate && (
							<div>
								<p className="text-muted-foreground">Event Date</p>
								<p>{formatDate(invoice.competition.startDate)}</p>
							</div>
						)}
					</div>

					<Separator />

					{/* Line Items */}
					<div className="space-y-3">
						<h3 className="font-medium">Items</h3>

						{/* Registration Fee */}
						<div className="flex justify-between">
							<span>{invoice.product.name}</span>
							<span>{formatCurrency(registrationFee)}</span>
						</div>

						{/* Platform Fee */}
						{invoice.platformFeeCents > 0 && (
							<div className="flex justify-between text-muted-foreground text-sm">
								<span>Platform Fee</span>
								<span>{formatCurrency(invoice.platformFeeCents)}</span>
							</div>
						)}

						{/* Payment Processing Fee */}
						{invoice.stripeFeeCents > 0 && (
							<div className="flex justify-between text-muted-foreground text-sm">
								<span>Payment Processing Fee</span>
								<span>{formatCurrency(invoice.stripeFeeCents)}</span>
							</div>
						)}
					</div>

					<Separator />

					{/* Total */}
					<div className="flex justify-between font-medium text-lg">
						<span>Total</span>
						<span>{formatCurrency(invoice.totalCents)}</span>
					</div>

					{/* Payment Method */}
					{invoice.stripe && invoice.status === "COMPLETED" && (
						<>
							<Separator />
							<div className="flex items-center gap-3 text-sm">
								<CreditCard className="h-4 w-4 text-muted-foreground" />
								<div>
									<p className="font-medium">
										{capitalizeFirst(
											invoice.stripe.brand ?? invoice.stripe.paymentMethod,
										)}
										{invoice.stripe.last4 &&
											` ending in ${invoice.stripe.last4}`}
									</p>
									<p className="text-muted-foreground">
										Paid on {formatDate(invoice.completedAt)}
									</p>
								</div>
							</div>
						</>
					)}
				</CardContent>
			</Card>

			{/* Competition Link */}
			{invoice.competition && (
				<div className="text-center">
					<Button variant="outline" asChild>
						<Link
							to="/compete/$slug"
							params={{ slug: invoice.competition.slug }}
						>
							View Competition
						</Link>
					</Button>
				</div>
			)}
		</div>
	)
}
