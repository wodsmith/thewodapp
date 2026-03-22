"use client"

import {
  createFileRoute,
  Link,
  useRouter,
} from "@tanstack/react-router"
import { AlertCircle, CheckCircle2, LogIn, Users } from "lucide-react"
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
import { acceptCohostInviteFn, getCohostInviteFn } from "@/server-fns/cohost-fns"
import { getSessionInfoFn } from "@/server-fns/invite-fns"

export const Route = createFileRoute("/compete/cohost-invite/$token")({
  loader: async ({ params }) => {
    const [invite, session] = await Promise.all([
      getCohostInviteFn({ data: { token: params.token } }),
      getSessionInfoFn(),
    ])
    return { invite, session, token: params.token }
  },
  head: ({ loaderData }) => {
    const { invite } = loaderData || {}
    const competitionName = invite?.competitionName ?? "a competition"
    return {
      meta: [
        { title: `Co-Host Invitation - ${competitionName}` },
        {
          name: "description",
          content: `You've been invited to co-host ${competitionName}`,
        },
      ],
    }
  },
  component: CohostInvitePage,
})

function CohostInvitePage() {
  const { invite, session, token } = Route.useLoaderData()
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
            <CardDescription>
              You&apos;ve been invited to co-host{" "}
              {invite.competitionName ?? "a competition"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
      toast.success("You are now a co-host for this competition")

      if (result.competitionId) {
        router.navigate({
          to: "/compete/cohost/$competitionId",
          params: { competitionId: result.competitionId },
        })
      } else {
        router.navigate({ to: "/compete" })
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

  return (
    <div className="container mx-auto max-w-lg py-16">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-fit rounded-full bg-primary/10 p-3">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Co-Host Invitation</CardTitle>
          <CardDescription>
            You&apos;ve been invited to co-host{" "}
            {invite.competitionName ?? "a competition"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <PermissionsSummary permissions={invite.permissions} />

          <Button
            className="w-full"
            size="lg"
            onClick={handleAccept}
            disabled={isAccepting}
          >
            {isAccepting ? "Accepting..." : "Accept Invitation"}
          </Button>

          <Button asChild variant="outline" className="w-full">
            <Link to="/compete">Browse Competitions</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function PermissionsSummary({
  permissions,
}: {
  permissions: {
    canViewRevenue: boolean
    canEditCapacity: boolean
    canEditScoring: boolean
    canEditRotation: boolean
    canManagePricing: boolean
    canManageVolunteers?: boolean
    canManageEvents?: boolean
    canManageHeats?: boolean
    canManageResults?: boolean
    canManageRegistrations?: boolean
  }
}) {
  const granted = [
    permissions.canEditCapacity && "Edit capacity",
    permissions.canEditScoring && "Edit scoring",
    permissions.canEditRotation && "Edit rotation",
    permissions.canViewRevenue && "View revenue",
    permissions.canManagePricing && "Manage pricing and coupons",
    permissions.canManageVolunteers && "Manage volunteers",
    permissions.canManageEvents && "Manage events",
    permissions.canManageHeats && "Manage heats/schedule",
    permissions.canManageResults && "Manage results/scores",
    permissions.canManageRegistrations && "Manage registrations",
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
