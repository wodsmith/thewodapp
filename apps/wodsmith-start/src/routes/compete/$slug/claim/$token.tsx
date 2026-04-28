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
import { AlertCircle, CheckCircle2, LogOut, Ticket, UserX } from "lucide-react"
import { useState } from "react"
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
  type InviteClaimableError,
  identityMatch,
} from "@/server/competition-invites/identity"
import { logoutFn } from "@/server-fns/auth-fns"
import { getInviteByTokenFn } from "@/server-fns/competition-invite-fns"

type Branch =
  | {
      kind: "claimable"
      divisionId: string
      divisionLabel: string
      championshipName: string
    }
  | {
      kind: "wrong_account"
      championshipName: string
      inviteEmail: string
      accountExistsForInviteEmail: boolean
    }
  | {
      kind: "already_claimed"
      championshipName: string
      registrationId: string
    }
  | {
      kind: "over_allocated"
      championshipName?: string
    }
  | { kind: "invalid"; reason: InviteClaimableError; championshipName?: string }

export const Route = createFileRoute("/compete/$slug/claim/$token")({
  component: ClaimPage,
  staleTime: 0,
  loader: async ({ params, context, parentMatchPromise }): Promise<Branch> => {
    const result = await getInviteByTokenFn({
      data: { slug: params.slug, token: params.token },
    })

    if (result.kind === "not_claimable") {
      // Already-registered athletes shouldn't see a destructive "error" page —
      // they're not in an error state, they just landed on the wrong page.
      // Send them to their registration view. Covers both an invite that was
      // already consumed (status = accepted_paid) and the cross-check against
      // an active registration created via any lane.
      if (result.reason === "already_paid") {
        throw redirect({
          to: "/compete/$slug/registered",
          params: { slug: params.slug },
          search: { session_id: undefined, registration_id: undefined },
        })
      }

      // ADR-0012 Phase 5: source-attributed allocation filled. Render a
      // soft (info-style) page rather than a destructive error — the
      // athlete isn't at fault, the spot just isn't available from this
      // source for this division.
      if (result.reason === "over_allocated") {
        return {
          kind: "over_allocated",
          championshipName:
            "championshipName" in result ? result.championshipName : undefined,
        }
      }

      // `not_found` happens both when the link is bogus AND when the original
      // invite has been consumed and the token hash nulled (replay-safe). To
      // tell them apart, peek at the parent route's `userRegistrations`: if
      // the signed-in visitor already has an active registration in this
      // competition, render the friendly "already claimed" page instead of
      // the generic invalid-link error.
      if (result.reason === "not_found" && context.session) {
        const parentMatch = await parentMatchPromise
        const userRegistrations = parentMatch.loaderData?.userRegistrations
        const competition = parentMatch.loaderData?.competition
        const firstRegistration = userRegistrations?.[0]
        if (competition && firstRegistration) {
          return {
            kind: "already_claimed",
            championshipName: competition.name,
            registrationId: firstRegistration.id,
          }
        }
      }

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
        accountExistsForInviteEmail: result.accountExistsForInviteEmail,
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
    return (
      <InvalidInvite
        reason={data.reason}
        championshipName={data.championshipName}
      />
    )
  }

  if (data.kind === "wrong_account") {
    return (
      <WrongAccount
        slug={slug}
        token={token}
        championshipName={data.championshipName}
        inviteEmail={data.inviteEmail}
        accountExistsForInviteEmail={data.accountExistsForInviteEmail}
      />
    )
  }

  if (data.kind === "already_claimed") {
    return (
      <AlreadyClaimed
        slug={slug}
        championshipName={data.championshipName}
        registrationId={data.registrationId}
      />
    )
  }

  if (data.kind === "over_allocated") {
    return <OverAllocated championshipName={data.championshipName} />
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
            Continue to registration and payment to claim your spot. This invite
            is locked to your email — only this account can complete the claim.
          </p>
          <Button asChild className="w-full" size="lg">
            <Link
              to="/compete/$slug/register"
              params={{ slug: props.slug }}
              search={{
                canceled: undefined,
                // Forward the invited division id so the registration form
                // pre-selects (and pins) the right division. The token lets
                // the server bypass the public registration window and (in
                // Phase 2D) settle the invite to accepted_paid via Stripe
                // metadata.
                divisionId: props.divisionId,
                invite: props.token,
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
  token: string
  championshipName: string
  inviteEmail: string
  accountExistsForInviteEmail: boolean
}) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // After logout, send the visitor straight to sign-in (or sign-up when no
  // account exists for the invited email) with the email pre-filled and the
  // claim URL set as the post-auth redirect — so the post-auth flow re-runs
  // the claim loader and lands them on the happy path.
  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logoutFn()
    } catch (error) {
      // Bouncing the user to /sign-in while their session is still live
      // would just send them back here — surface the error and let them retry.
      console.error("Logout error:", error)
      setIsLoggingOut(false)
      return
    }
    const authPath = props.accountExistsForInviteEmail ? "/sign-in" : "/sign-up"
    const claimUrl = `/compete/${props.slug}/claim/${props.token}`
    const search = new URLSearchParams({
      redirect: claimUrl,
      email: props.inviteEmail,
      invite: props.token,
    })
    window.location.href = `${authPath}?${search.toString()}`
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card>
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            <UserX className="h-7 w-7 text-amber-600" />
          </div>
          <CardTitle className="text-center">
            This invite is for a different account
          </CardTitle>
          <CardDescription className="text-center">
            {props.championshipName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              You're signed in as a different email. This invite was sent to{" "}
              <span className="font-medium">{props.inviteEmail}</span>. Log out
              to continue as that address.
            </AlertDescription>
          </Alert>
          <Button
            type="button"
            className="w-full"
            size="lg"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isLoggingOut ? "Logging out…" : "Log out"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function AlreadyClaimed(props: {
  slug: string
  championshipName: string
  registrationId: string
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card>
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Ticket className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-center">
            You've already claimed this invitation
          </CardTitle>
          <CardDescription className="text-center">
            {props.championshipName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Your spot is locked in. Head to your registration to review your
            details or manage your team.
          </p>
          <Button asChild className="w-full" size="lg">
            <Link
              to="/compete/$slug/teams/$registrationId"
              params={{
                slug: props.slug,
                registrationId: props.registrationId,
              }}
            >
              View your registration
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function OverAllocated(props: { championshipName?: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card>
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            <AlertCircle className="h-7 w-7 text-amber-600" />
          </div>
          <CardTitle className="text-center">
            This division has filled its spots from this qualifier
          </CardTitle>
          {props.championshipName ? (
            <CardDescription className="text-center">
              {props.championshipName}
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              The organizer has been notified — please contact them if you
              believe this is in error.
            </AlertDescription>
          </Alert>
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
    case "over_allocated":
      return {
        title: "This division has filled its spots from this qualifier",
        headline: "Allocation filled",
        description:
          "The organizer has been notified — please contact them if you believe this is in error.",
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
