/**
 * Explicit decline of a competition invite.
 *
 * The athlete clicks "Decline" in the email body. We run the same
 * identity-match rules as the claim route — only the invited email can
 * decline — and only actually flip the status on an explicit POST so a
 * random GET or link-preview crawler can't terminate an invite.
 */

import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { AlertCircle, CheckCircle2, UserX } from "lucide-react"
import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { identityMatch } from "@/server/competition-invites/identity"
import {
  declineInviteFn,
  getInviteByTokenFn,
} from "@/server-fns/competition-invite-fns"

type Branch =
  | { kind: "ready"; championshipName: string; divisionLabel: string; email: string }
  | { kind: "wrong_account"; championshipName: string; inviteEmail: string }
  | { kind: "invalid"; reason: string; championshipName?: string }

export const Route = createFileRoute("/compete/$slug/claim/$token/decline")({
  component: DeclinePage,
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
        kind: "ready",
        championshipName: result.championshipName,
        divisionLabel: result.divisionLabel,
        email: result.invite.email,
      }
    }

    if (match.reason === "wrong_account") {
      return {
        kind: "wrong_account",
        championshipName: result.championshipName,
        inviteEmail: result.invite.email,
      }
    }

    // Signed out — send through the claim route, which will redirect to
    // sign-in / sign-up. After auth they'll land back on the claim page;
    // clicking decline there re-enters this loader signed in.
    throw redirect({
      to: "/compete/$slug/claim/$token",
      params: { slug: params.slug, token: params.token },
    })
  },
})

function DeclinePage() {
  const { slug, token } = Route.useParams()
  const data = Route.useLoaderData()
  const router = useRouter()
  const decline = useServerFn(declineInviteFn)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (data.kind === "invalid") {
    return <InvalidPage reason={data.reason} />
  }
  if (data.kind === "wrong_account") {
    return (
      <WrongAccountPage
        championshipName={data.championshipName}
        inviteEmail={data.inviteEmail}
        slug={slug}
      />
    )
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card>
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-center">Invite declined</CardTitle>
            <CardDescription className="text-center">
              We've let the organizer know you won't be competing. Your link
              has been deactivated.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const onDecline = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const result = await decline({ data: { slug, token } })
      if (result.ok) {
        setDone(true)
      } else {
        setError(`Unable to decline this invite: ${result.reason}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to decline")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Decline this invite?</CardTitle>
          <CardDescription className="text-center">
            {data.championshipName} · {data.divisionLabel}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Declining lets the organizer re-allocate your spot. Your link
            will no longer work — the organizer can re-issue a fresh invite
            later if plans change.
          </p>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() =>
              router.navigate({
                to: "/compete/$slug/claim/$token",
                params: { slug, token },
              })
            }
            disabled={submitting}
          >
            Go back
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={onDecline}
            disabled={submitting}
          >
            {submitting ? "Declining…" : "Decline invite"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

function WrongAccountPage(props: {
  championshipName: string
  inviteEmail: string
  slug: string
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card>
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            <UserX className="h-7 w-7 text-amber-600" />
          </div>
          <CardTitle className="text-center">
            Only the invited account can decline
          </CardTitle>
          <CardDescription className="text-center">
            {props.championshipName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert>
            <AlertDescription>
              Sign in as{" "}
              <span className="font-medium">{props.inviteEmail}</span> to
              decline this invite. If you no longer have access, reach out
              to the organizer directly.
            </AlertDescription>
          </Alert>
          <Button asChild variant="outline" className="w-full">
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

function InvalidPage(props: { reason: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card>
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <CardTitle className="text-center">
            This invite is no longer active
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>
              Reason: {props.reason}. If that's unexpected, contact the
              organizer.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
