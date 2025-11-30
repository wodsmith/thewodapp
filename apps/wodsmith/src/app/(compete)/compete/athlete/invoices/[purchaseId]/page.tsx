import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Receipt, CreditCard, Building2, Calendar } from "lucide-react"
import { getSessionFromCookie } from "@/utils/auth"
import { getInvoiceDetails } from "@/server/commerce"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { DownloadInvoiceButton } from "./_components/download-invoice-button"

function formatCurrency(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100)
}

function formatDate(date: Date | null): string {
	if (!date) return "-"
	return new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(date)
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

export default async function InvoiceDetailPage({
	params,
}: {
	params: Promise<{ purchaseId: string }>
}) {
	const { purchaseId } = await params
	const session = await getSessionFromCookie()

	if (!session) {
		redirect(`/sign-in?redirect=/compete/athlete/invoices/${purchaseId}`)
	}

	const invoice = await getInvoiceDetails(purchaseId, session.userId)

	if (!invoice) {
		notFound()
	}

	// Calculate registration fee (total minus fees passed to customer)
	const registrationFee =
		invoice.totalCents - invoice.platformFeeCents - invoice.stripeFeeCents

	return (
		<div className="mx-auto max-w-2xl space-y-6 pb-12">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Button variant="ghost" size="icon" asChild>
						<Link href="/compete/athlete/invoices">
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
										{capitalizeFirst(invoice.stripe.brand ?? invoice.stripe.paymentMethod)}
										{invoice.stripe.last4 && ` ending in ${invoice.stripe.last4}`}
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
						<Link href={`/compete/${invoice.competition.slug}`}>
							View Competition
						</Link>
					</Button>
				</div>
			)}
		</div>
	)
}
