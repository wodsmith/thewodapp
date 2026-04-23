/**
 * Competition invite claim landing route.
 *
 * The athlete clicks the `/compete/$slug/claim/$token` link in the email.
 * The loader:
 *   1. resolves the invite via `getInviteByTokenFn` (hashes + looks up),
 *   2. runs `identityMatch` against the current session,
 *   3. branches — redirect for sign-in / sign-up, render rejection for
 *      wrong account, render error for expired / declined / revoked, or
 *      render the claim page for the happy path.
 *
 * The claim page itself is thin in Phase 2: it confirms the invite and
 * sends the athlete into the existing registration flow at
 * `/compete/$slug/register?divisionId=<x>`. Phase 2 sub-arc C extends
 * `initiateRegistrationPaymentFn` to accept `inviteToken` so the paid
 * registration flips the invite to `accepted_paid`.
 */

import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { AlertCircle, CheckCircle2, UserX } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  identityMatch,
  type InviteClaimableError,
} from "@/server/competition-invites/identity"
import { getInviteByTokenFn } from "@/server-fns/competition-invite-fns"

type Branch =
  | { kind: "claimable"; divisionId: string; divisionLabel: string; championshipName: string }
  | { kind: "wrong_account"; championshipName: string; inviteEmail: string }
  | { kind: "invalid"; reason: InviteClaimableError; championshipName?: string }

export const Route = createFileRoute("/compete/$slug/claim/$token")({
  component: ClaimPage,
  staleTime: 0,
  loader: async ({ params, context }): Promise<Branch> => {
    const result = await getInviteByTokenFn({
      data: { slug: params.slug, token: params.token },
    })

    if (result.kind === "not_claimable") {
      return {
        kind: "invalid",
        reason: result.reason,
        championshipName:
          "championshipName" in result ? result.championshipName : undefined,
      }
    }

    const session = context.session ?? null
    const match = identityMatch(
      session?.user ? { email: session.user.email } : null,
      result.invite,
      { accountExistsForInviteEmail: result.accountExistsForInviteEmail },
    )

    if (match.ok) {
      return {
        kind: "claimable",
        divisionId: result.invite.championshipDivisionId,
        divisionLabel: result.divisionLabel,
        championshipName: result.championshipName,
      }
    }

    if (match.reason === "wrong_account") {
      return {
        kind: "wrong_account",
        championshipName: result.championshipName,
        inviteEmail: result.invite.email,
      }
    }

    // Signed out — redirect into sign-in / sign-up with email pre-filled and
    // the invite token so the post-auth flow re-runs the claim.
    const authPath = match.reason === "needs_sign_in" ? "/sign-in" : "/sign-up"
    throw redirect({
      to: authPath,
      search: {
        redirect: `/compete/${params.slug}/claim/${params.token}`,
        email: result.invite.email,
        invite: params.token,
      },
    })
  },
})

function ClaimPage() {
  const { slug, token } = Route.useParams()
  const data = Route.useLoaderData()

  if (data.kind === "invalid") {
    return <InvalidInvite reason={data.reason} championshipName={data.championshipName} />
  }

  if (data.kind === "wrong_account") {
    return (
      <WrongAccount
        slug={slug}
        championshipName={data.championshipName}
        inviteEmail={data.inviteEmail}
      />
    )
  }

  return (
    <ClaimablePage
      slug={slug}
      token={token}
      divisionId={data.divisionId}
      divisionLabel={data.divisionLabel}
      championshipName={data.championshipName}
    />
  )
}

// ============================================================================
// Branch components
// ============================================================================

function ClaimablePage(props: {
  slug: string
  token: string
  divisionId: string
  divisionLabel: string
  championshipName: string
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card>
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-center">
            You're invited to {props.championshipName}
          </CardTitle>
          <CardDescription className="text-center">
            Division: <span className="font-medium">{props.divisionLabel}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Continue to registration and payment to claim your spot. This
            invite is locked to your email — only this account can complete
            the claim.
          </p>
          <Button asChild className="w-full" size="lg">
            <Link
              to="/compete/$slug/register"
              params={{ slug: props.slug }}
              search={{
                canceled: undefined,
                // Forward the invite token so the paid registration can
                // flip the invite to accepted_paid via Stripe webhook.
                invite: props.token,
                // Forward the invited division id so the registration form
                // pre-selects (and pins) the right division — invites are
                // locked to a single division at issue time.
                divisionId: props.divisionId,
              }}
            >
              Continue to registration
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function WrongAccount(props: {
  slug: string
  championshipName: string
  inviteEmail: string
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card>
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            <UserX className="h-7 w-7 text-amber-600" />
          </div>
          <CardTitle className="text-center">This invite is for a different account</CardTitle>
          <CardDescription className="text-center">
            {props.championshipName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              You're signed in as a different email. The invite was sent to{" "}
              <span className="font-medium">{props.inviteEmail}</span>. Sign
              out and sign in with that address to continue.
            </AlertDescription>
          </Alert>
          <Button asChild className="w-full" size="lg" variant="outline">
            <Link
              to="/sign-in"
              search={{
                redirect: `/compete/${props.slug}/invite-pending`,
                email: props.inviteEmail,
              }}
            >
              Sign in as {props.inviteEmail}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function InvalidInvite(props: {
  reason: InviteClaimableError
  championshipName?: string
}) {
  const copy = invalidReasonCopy(props.reason)
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card>
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <CardTitle className="text-center">{copy.title}</CardTitle>
          {props.championshipName ? (
            <CardDescription className="text-center">
              {props.championshipName}
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>{copy.headline}</AlertTitle>
            <AlertDescription>{copy.description}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}

function invalidReasonCopy(reason: InviteClaimableError): {
  title: string
  headline: string
  description: string
} {
  switch (reason) {
    case "expired":
      return {
        title: "This invite has expired",
        headline: "Invite expired",
        description:
          "The organizer can extend your invite and re-send it — reach out to them if you still want to compete.",
      }
    case "declined":
      return {
        title: "This invite was declined",
        headline: "Invite declined",
        description:
          "Contact the organizer if you meant to accept — they can re-issue a new link.",
      }
    case "revoked":
      return {
        title: "This invite was revoked",
        headline: "Invite revoked",
        description:
          "The organizer has revoked this invite. If that's a mistake, reach out to them directly.",
      }
    case "already_paid":
      return {
        title: "You're already registered",
        headline: "Registration complete",
        description:
          "This invite has already been claimed and paid. Head to your competitions dashboard to see the event.",
      }
    default:
      return {
        title: "This invite link isn't valid",
        headline: "Invalid link",
        description:
          "The link may be mistyped or no longer active. If you think this is a mistake, contact the organizer.",
      }
  }
}
