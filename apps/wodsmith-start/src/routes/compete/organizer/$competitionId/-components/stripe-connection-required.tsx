/**
 * Stripe Connection Required Component
 * Port from apps/wodsmith/src/app/(compete)/compete/organizer/[competitionId]/(with-sidebar)/pricing/_components/stripe-connection-required.tsx
 *
 * Displays a prompt for organizers to connect their Stripe account
 * before they can configure registration fees.
 */

import {Link, useLocation} from '@tanstack/react-router'
import {AlertCircle, CreditCard, ExternalLink} from 'lucide-react'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface Props {
  teamSlug: string
  competitionName: string
}

export function StripeConnectionRequired({teamSlug, competitionName}: Props) {
  const location = useLocation()
  // Build the payouts URL with returnTo so user comes back here after setup
  const payoutsUrl = `/compete/organizer/settings/payouts/${teamSlug}?returnTo=${encodeURIComponent(location.pathname)}`

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Stripe Connection Required</AlertTitle>
        <AlertDescription>
          Connect your Stripe account to charge registration fees for{' '}
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
            <Link to={payoutsUrl}>
              Set Up Payouts
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
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
