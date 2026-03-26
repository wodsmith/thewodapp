/**
 * Stripe Connection Required Component
 * Port from apps/wodsmith/src/app/(compete)/compete/organizer/[competitionId]/(with-sidebar)/pricing/_components/stripe-connection-required.tsx
 *
 * Displays a prompt for organizers to connect their Stripe account
 * before they can configure registration fees.
 */

import { Link, useLocation } from "@tanstack/react-router"
import { AlertCircle, CreditCard, ExternalLink } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface Props {
  teamSlug: string
  competitionName: string
  /** When true, shows a read-only message instead of linking to organizer payouts settings */
  isCohost?: boolean
}

export function StripeConnectionRequired({ teamSlug, competitionName, isCohost }: Props) {
  const location = useLocation()
  // Build the payouts URL with returnTo so user comes back here after setup
  const payoutsUrl = `/compete/organizer/settings/payouts/${teamSlug}?returnTo=${encodeURIComponent(location.pathname)}`

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Stripe Connection Required</AlertTitle>
        <AlertDescription>
          {isCohost
            ? `The organizer needs to connect a Stripe account to charge registration fees for ${competitionName}. Free registrations ($0) are always available.`
            : <>Connect your Stripe account to charge registration fees for{" "}{competitionName}. Free registrations ($0) are always available.</>}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{isCohost ? "Stripe Not Connected" : "Connect Stripe to Accept Payments"}</CardTitle>
          <CardDescription>
            {isCohost
              ? "The competition organizer has not yet connected their Stripe account. Registration fees cannot be configured until Stripe is set up. Contact the organizer to resolve this."
              : "To charge registration fees for your competition, you need to connect your Stripe account. This allows you to receive payouts directly from athlete registrations."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {!isCohost && (
            <Button asChild>
              <Link to={payoutsUrl}>
                Set Up Payouts
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
          <p className="text-xs text-center text-muted-foreground max-w-md">
            {isCohost
              ? "Free registrations work without a Stripe connection."
              : "You'll be able to set registration fees after connecting Stripe. Free registrations work without a Stripe connection."}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
