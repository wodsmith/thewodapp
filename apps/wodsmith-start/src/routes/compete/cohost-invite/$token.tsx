"use client"

import {
  createFileRoute,
  Link,
  redirect,
  useRouter,
} from "@tanstack/react-router"
import { AlertCircle, AlertTriangle, CheckCircle2, LogIn, Users } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  acceptCohostInviteFn,
  checkExistingCohostMembershipFn,
  getCohostInviteFn,
} from "@/server-fns/cohost-fns"
import { getSessionInfoFn } from "@/server-fns/invite-fns"

export const Route = createFileRoute("/compete/cohost-invite/$token")({
  loader: async ({ params }) => {
    const [invite, session] = await Promise.all([
      getCohostInviteFn({ data: { token: params.token } }),
      getSessionInfoFn(),
    ])

    // Check if the logged-in user already has cohost access
    let existingCohost: Awaited<
      ReturnType<typeof checkExistingCohostMembershipFn>
    > = null
    if (session && invite?.teamId) {
      existingCohost = await checkExistingCohostMembershipFn({
        data: { teamId: invite.teamId },
      })
    }

    // Already accepted + user has cohost access → skip the invite screen
    if (
      invite?.acceptedAt &&
      invite.competitionId &&
      existingCohost
    ) {
      throw redirect({
        to: "/compete/cohost/$competitionId",
        params: { competitionId: invite.competitionId },
      })
    }

    return { invite, session, token: params.token, existingCohost }
  },
  head: ({ loaderData }) => {
    const { invite } = loaderData || {}
    const title =
      invite?.seriesName
        ? `Co-Host Invitation - ${invite.seriesName}`
        : `Co-Host Invitation - ${invite?.competitionName ?? "a competition"}`
    return {
      meta: [
        { title },
        {
          name: "description",
          content: invite?.seriesName
            ? `You've been invited to co-host competitions in ${invite.seriesName}`
            : `You've been invited to co-host ${invite?.competitionName ?? "a competition"}`,
        },
      ],
    }
  },
  component: CohostInvitePage,
})

function CohostInvitePage() {
  const { invite, session, token, existingCohost } = Route.useLoaderData()
  const router = useRouter()
  const [isAccepting, setIsAccepting] = useState(false)

  // Invite not found
  if (!invite) {
    return (
      <div className="container mx-auto max-w-lg py-16">
        <Card>
          <CardContent className="space-y-4 py-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="text-xl font-semibold">Invite Not Found</h2>
            <p className="text-muted-foreground">
              This invitation link is invalid or has expired.
            </p>
            <Button asChild variant="outline">
              <Link to="/compete">Browse Competitions</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Already accepted
  if (invite.acceptedAt) {
    return (
      <div className="container mx-auto max-w-lg py-16">
        <Card>
          <CardContent className="space-y-4 py-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <h2 className="text-xl font-semibold">
              Invitation Already Accepted
            </h2>
            <p className="text-muted-foreground">
              This co-host invitation has already been accepted.
            </p>
            {invite.competitionId && (
              <Button asChild>
                <Link
                  to="/compete/cohost/$competitionId"
                  params={{ competitionId: invite.competitionId }}
                >
                  Go to Competition
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Expired
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    return (
      <div className="container mx-auto max-w-lg py-16">
        <Card>
          <CardContent className="space-y-4 py-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="text-xl font-semibold">Invitation Expired</h2>
            <p className="text-muted-foreground">
              This invitation has expired. Please ask the organizer to send a
              new invite.
            </p>
            <Button asChild variant="outline">
              <Link to="/compete">Browse Competitions</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const redirectPath = `/compete/cohost-invite/${token}`
  const isSeries = invite.seriesCompetitions.length > 1
  const competitionCount = invite.seriesCompetitions.length

  const headerDescription = isSeries
    ? `You've been invited to co-host ${competitionCount} competitions in ${invite.seriesName ?? "a series"}`
    : `You've been invited to co-host ${invite.competitionName ?? "a competition"}`

  // Not logged in — redirect to sign-in
  if (!session) {
    return (
      <div className="container mx-auto max-w-lg py-16">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-fit rounded-full bg-primary/10 p-3">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Co-Host Invitation</CardTitle>
            <CardDescription>{headerDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isSeries && (
              <CompetitionsList
                competitions={invite.seriesCompetitions}
              />
            )}
            <PermissionsSummary permissions={invite.permissions} />
            <div className="space-y-2">
              <p className="text-center text-sm text-muted-foreground">
                Invitation for <strong>{invite.email}</strong>
              </p>
            </div>
            <Button asChild className="w-full" size="lg">
              <Link to="/sign-in" search={{ redirect: redirectPath }}>
                <LogIn className="mr-2 h-4 w-4" />
                Sign In to Accept
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleAccept = async () => {
    setIsAccepting(true)
    toast.loading("Accepting invitation...")

    try {
      const result = await acceptCohostInviteFn({ data: { token } })
      toast.dismiss()
      toast.success(
        isSeries
          ? `You are now a co-host for ${competitionCount} competitions`
          : "You are now a co-host for this competition",
      )

      if (result.competitionId) {
        await router.navigate({
          to: "/compete/cohost/$competitionId",
          params: { competitionId: result.competitionId },
          replace: true,
        })
      } else {
        await router.navigate({ to: "/compete", replace: true })
      }
    } catch (error) {
      toast.dismiss()
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to accept invitation",
      )
      setIsAccepting(false)
    }
  }

  const emailMismatch =
    session?.email &&
    invite.email &&
    session.email.toLowerCase() !== invite.email.toLowerCase()

  return (
    <div className="container mx-auto max-w-lg py-16">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-fit rounded-full bg-primary/10 p-3">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Co-Host Invitation</CardTitle>
          <CardDescription>{headerDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Show which account is accepting */}
          <div className="rounded-lg border bg-muted/30 p-4 text-center">
            <p className="text-sm text-muted-foreground">Accepting as</p>
            <p className="font-medium">{session?.email}</p>
          </div>

          {/* Warn if logged-in email doesn't match invite email */}
          {emailMismatch && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-400">
                  Account mismatch
                </p>
                <p className="mt-1 text-amber-700 dark:text-amber-500">
                  This invite was sent to <strong>{invite.email}</strong> but
                  you&apos;re logged in as <strong>{session?.email}</strong>.
                  Accepting will grant co-host access to your current account.
                </p>
              </div>
            </div>
          )}

          {/* Warn if already a cohost */}
          {existingCohost && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-400">
                  Already a co-host
                </p>
                <p className="mt-1 text-amber-700 dark:text-amber-500">
                  You already have co-host access to this competition. Accepting
                  this invite will <strong>not</strong> update your existing
                  permissions.
                </p>
              </div>
            </div>
          )}

          {isSeries && (
            <CompetitionsList
              competitions={invite.seriesCompetitions}
            />
          )}
          <PermissionsSummary permissions={invite.permissions} />

          <Button
            className="w-full"
            size="lg"
            onClick={handleAccept}
            disabled={isAccepting}
          >
            {isAccepting
              ? "Accepting..."
              : isSeries
                ? `Accept for ${competitionCount} Competitions`
                : "Accept Invitation"}
          </Button>

          <Button asChild variant="outline" className="w-full">
            <Link to="/compete">Browse Competitions</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function CompetitionsList({
  competitions,
}: {
  competitions: Array<{ competitionId: string; competitionName: string }>
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-4 space-y-2">
      <p className="text-sm font-medium">Competitions</p>
      <ul className="space-y-1">
        {competitions.map((comp) => (
          <li
            key={comp.competitionId}
            className="flex items-center gap-2 text-sm"
          >
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            <span>{comp.competitionName}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PermissionsSummary({
  permissions,
}: {
  permissions: {
    divisions?: boolean
    editEvents?: boolean
    scoringConfig?: boolean
    viewRegistrations?: boolean
    editRegistrations?: boolean
    waivers?: boolean
    schedule?: boolean
    locations?: boolean
    volunteers?: boolean
    results?: boolean
    pricing?: boolean
    revenue?: boolean
    coupons?: boolean
    sponsors?: boolean
  }
}) {
  const granted = [
    permissions.divisions && "Divisions",
    permissions.editEvents && "Edit events",
    permissions.scoringConfig && "Scoring config",
    permissions.viewRegistrations && "View registrations",
    permissions.editRegistrations && "Edit registrations",
    permissions.waivers && "Waivers",
    permissions.schedule && "Schedule",
    permissions.locations && "Locations",
    permissions.volunteers && "Volunteers",
    permissions.results && "Results",
    permissions.pricing && "Pricing",
    permissions.revenue && "Revenue",
    permissions.coupons && "Coupons",
    permissions.sponsors && "Sponsors",
  ].filter(Boolean)

  return (
    <div className="rounded-lg bg-muted/50 p-4 space-y-2">
      <p className="text-sm font-medium">Granted permissions</p>
      {granted.length > 0 ? (
        <ul className="space-y-1">
          {granted.map((perm) => (
            <li key={String(perm)} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <span>{perm}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No specific permissions granted — view-only access.
        </p>
      )}
    </div>
  )
}
