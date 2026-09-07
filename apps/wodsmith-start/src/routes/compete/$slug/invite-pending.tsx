/**
 * Informational landing for an athlete who arrives signed-in-as-the-wrong
 * account. The claim route's "wrong account" branch sends the visitor to
 * `/sign-in?redirect=/compete/$slug/invite-pending&email=…` so that after
 * they swap accounts we don't silently loop them back to the claim page
 * (they may not have the token in URL anymore).
 *
 * The page explains what happened and prompts them to re-click the
 * original email link.
 */

import { createFileRoute, Link } from "@tanstack/react-router"
import { Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const Route = createFileRoute("/compete/$slug/invite-pending")({
  component: InvitePendingPage,
})

function InvitePendingPage() {
  const { slug } = Route.useParams()
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card>
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-center">Claim your invite</CardTitle>
          <CardDescription className="text-center">
            Use the account that received the invitation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Re-open the invitation email and click the claim link. If prompted,
            sign in with the email address that received the invitation to
            continue to your registration.
          </p>
          <p className="text-xs text-muted-foreground">
            Can't find the email? Contact the organizer and they can
            re-issue your invite.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link to="/compete/$slug" params={{ slug }}>
              Go to competition page
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
