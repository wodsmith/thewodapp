import { redirect } from "next/navigation"
import Link from "next/link"
import { Receipt, ArrowLeft, FileText, ExternalLink } from "lucide-react"
import { getSessionFromCookie } from "@/utils/auth"
import { getUserPurchases } from "@/server/commerce"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

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
		month: "short",
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

export default async function InvoicesPage() {
	const session = await getSessionFromCookie()
	if (!session) {
		redirect("/sign-in?redirect=/compete/athlete/invoices")
	}

	const purchases = await getUserPurchases(session.userId)

	return (
		<div className="mx-auto max-w-4xl space-y-6 pb-12">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Button variant="ghost" size="icon" asChild>
					<Link href="/compete/athlete">
						<ArrowLeft className="h-4 w-4" />
					</Link>
				</Button>
				<div className="flex items-center gap-2">
					<Receipt className="h-6 w-6" />
					<h1 className="font-bold text-2xl">Invoices</h1>
				</div>
			</div>

			{purchases.length === 0 ? (
				<Card>
					<CardContent className="py-12 text-center">
						<FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
						<p className="mt-4 text-muted-foreground">No invoices yet</p>
						<p className="text-muted-foreground text-sm">
							When you register for competitions, your invoices will appear
							here.
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-3">
					{purchases.map((purchase) => (
						<Link
							key={purchase.id}
							href={`/compete/athlete/invoices/${purchase.id}`}
							className="block"
						>
							<Card className="transition-colors hover:bg-muted/50">
								<CardContent className="flex items-center justify-between py-4">
									<div className="flex items-center gap-4">
										<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
											<Receipt className="h-5 w-5 text-primary" />
										</div>
										<div>
											<p className="font-medium">
												{purchase.competition?.name ?? purchase.product.name}
											</p>
											<p className="text-muted-foreground text-sm">
												{formatDate(purchase.completedAt ?? purchase.createdAt)}
												{purchase.competition?.organizingTeam && (
													<span>
														{" "}
														&middot; {purchase.competition.organizingTeam.name}
													</span>
												)}
											</p>
										</div>
									</div>
									<div className="flex items-center gap-4">
										{getStatusBadge(purchase.status)}
										<span className="font-medium">
											{formatCurrency(purchase.totalCents)}
										</span>
										<ExternalLink className="h-4 w-4 text-muted-foreground" />
									</div>
								</CardContent>
							</Card>
						</Link>
					))}
				</div>
			)}
		</div>
	)
}
