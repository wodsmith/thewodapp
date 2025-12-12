"use client"

import { AlertCircle, CreditCard } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card"

interface Props {
	teamSlug: string
	competitionName: string
}

/**
 * Component displayed when organizer needs to connect Stripe to accept paid registrations
 */
export function StripeConnectionRequired({ teamSlug, competitionName }: Props) {
	return (
		<div className="space-y-6">
			<Alert>
				<AlertCircle className="h-4 w-4" />
				<AlertTitle>Stripe Connection Required</AlertTitle>
				<AlertDescription>
					Connect your Stripe account to charge registration fees for{" "}
					{competitionName}. Free registrations ($0) are always available.
				</AlertDescription>
			</Alert>

			<Card>
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
						<CreditCard className="h-6 w-6 text-primary" />
					</div>
					<CardTitle>Connect Stripe to Accept Payments</CardTitle>
					<CardDescription>
						To charge registration fees for your competition, you need to
						connect your Stripe account. This allows you to receive payouts
						directly from athlete registrations.
					</CardDescription>
				</CardHeader>
			<CardContent className="flex flex-col items-center gap-4">
				<Button asChild>
					<a href={`/settings/teams/${teamSlug}`}>
						Go to Team Settings
					</a>
				</Button>
				<p className="text-xs text-center text-muted-foreground max-w-md">
					You'll be able to set registration fees after connecting Stripe.
					Free registrations work without a Stripe connection.
				</p>
			</CardContent>
			</Card>
		</div>
	)
}
