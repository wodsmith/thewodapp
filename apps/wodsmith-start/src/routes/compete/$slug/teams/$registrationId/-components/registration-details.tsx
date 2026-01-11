import { Link, useLocation } from "@tanstack/react-router"
import {
	Calendar,
	CheckCircle,
	Clock,
	CreditCard,
	ExternalLink,
	Receipt,
	Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import type { RegistrationDetails } from "@/server-fns/registration-fns"

type Props = {
	details: RegistrationDetails
	isTeamRegistration: boolean
}

function formatDate(date: Date | null | undefined): string {
	if (!date) return "—"
	return new Date(date).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	})
}

function formatDateRange(start: Date, end: Date): string {
	const startDate = new Date(start)
	const endDate = new Date(end)

	const startMonth = startDate.toLocaleDateString("en-US", { month: "short" })
	const endMonth = endDate.toLocaleDateString("en-US", { month: "short" })
	const startDay = startDate.getDate()
	const endDay = endDate.getDate()
	const year = endDate.getFullYear()

	if (startMonth === endMonth) {
		return `${startMonth} ${startDay}–${endDay}, ${year}`
	}
	return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`
}

function formatCurrency(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100)
}

function PaymentStatusBadge({ status }: { status: string | null }) {
	if (!status) return null

	switch (status) {
		case "PAID":
			return (
				<Badge className="bg-green-100 text-green-800 border-green-200">
					<CheckCircle className="w-3 h-3 mr-1" />
					Paid
				</Badge>
			)
		case "FREE":
			return (
				<Badge variant="secondary">
					<CheckCircle className="w-3 h-3 mr-1" />
					Free
				</Badge>
			)
		case "PENDING_PAYMENT":
			return (
				<Badge variant="outline" className="text-yellow-600 border-yellow-300">
					<Clock className="w-3 h-3 mr-1" />
					Pending
				</Badge>
			)
		case "FAILED":
			return (
				<Badge variant="destructive">
					<Clock className="w-3 h-3 mr-1" />
					Failed
				</Badge>
			)
		default:
			return <Badge variant="outline">{status}</Badge>
	}
}

export function RegistrationDetailsCard({ details, isTeamRegistration }: Props) {
	const location = useLocation()
	const { competition, division, purchase, paymentStatus, registeredAt, teamName } =
		details

	return (
		<div className="space-y-4">
			{/* Competition Info */}
			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-start justify-between">
						<div>
							<CardTitle className="text-lg">
								{competition?.name || "Competition"}
							</CardTitle>
							{competition && (
								<CardDescription className="flex items-center gap-1 mt-1">
									<Calendar className="w-3.5 h-3.5" />
									{formatDateRange(competition.startDate, competition.endDate)}
								</CardDescription>
							)}
						</div>
						{competition?.slug && (
							<Link
								to="/compete/$slug"
								params={{ slug: competition.slug }}
								className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
							>
								View Event
								<ExternalLink className="w-3.5 h-3.5" />
							</Link>
						)}
					</div>
				</CardHeader>
			</Card>

			{/* Division Info */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-base">
						<Users className="w-4 h-4" />
						Division
					</CardTitle>
				</CardHeader>
				<CardContent className="pt-0">
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<span className="font-medium">{division?.label || "—"}</span>
							{division?.teamSize && division.teamSize > 1 && (
								<Badge variant="outline">
									Team of {division.teamSize}
								</Badge>
							)}
						</div>
						{isTeamRegistration && teamName && (
							<div className="text-sm text-muted-foreground">
								Team: <span className="font-medium text-foreground">{teamName}</span>
							</div>
						)}
						{division?.description && (
							<p className="text-sm text-muted-foreground">
								{division.description}
							</p>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Payment/Registration Info */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-base">
						<CreditCard className="w-4 h-4" />
						Payment
					</CardTitle>
				</CardHeader>
				<CardContent className="pt-0">
					<div className="space-y-3">
						{/* Status and Amount */}
						<div className="flex items-center justify-between">
							<PaymentStatusBadge status={paymentStatus} />
							{(purchase?.totalCents || division?.feeCents) && (
								<span className="font-semibold">
									{formatCurrency(purchase?.totalCents || division?.feeCents || 0)}
								</span>
							)}
							{paymentStatus === "FREE" && (
								<span className="font-medium text-muted-foreground">$0.00</span>
							)}
						</div>

						{/* Registration Date */}
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">Registered</span>
							<span>{formatDate(registeredAt)}</span>
						</div>

						{/* Payment Date (if paid) */}
						{details.paidAt && (
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">Paid</span>
								<span>{formatDate(details.paidAt)}</span>
							</div>
						)}

						{/* Invoice Link */}
						{purchase?.id && paymentStatus === "PAID" && (
							<div className="pt-2 border-t">
								<Link
									to="/compete/athlete/invoices/$purchaseId"
									params={{ purchaseId: purchase.id }}
									search={{ returnTo: location.pathname }}
									className="text-sm text-primary hover:underline flex items-center gap-1"
								>
									<Receipt className="w-3.5 h-3.5" />
									View Invoice
								</Link>
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
