/**
 * Team Management Route
 * Displays team roster for team competitions and allows management of affiliates.
 * Shows confirmed members, pending invitations, and affiliate info.
 *
 * Port from apps/wodsmith/src/app/(compete)/compete/(public)/[slug]/teams/[registrationId]/page.tsx
 */

import {createFileRoute, notFound, redirect} from '@tanstack/react-router'
import {CheckCircle, Clock, Copy, Crown, Mail, Users} from 'lucide-react'
import {toast} from 'sonner'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  getTeamRosterFn,
  type TeamRosterResult,
} from '@/server-fns/registration-fns'

// Types
type RegistrationMetadata = {
  affiliateName?: string // Legacy: captain's affiliate
  affiliates?: Record<string, string> // New: per-user affiliates
}

type PendingTeammate = {
  email: string
  firstName?: string | null
  lastName?: string | null
  affiliateName?: string | null
}

interface LoaderData {
  registration: TeamRosterResult['registration']
  members: TeamRosterResult['members']
  pending: TeamRosterResult['pending']
  isTeamRegistration: boolean
  competition: {
    id: string
    name: string
    slug: string
  } | null
  division: {
    id: string
    label: string
  } | null
  isTeamMember: boolean
  isRegisteredUser: boolean
  memberAffiliates: Record<string, string>
  currentUserAffiliate: string | null
  pendingTeammates: PendingTeammate[]
}

export const Route = createFileRoute('/compete/$slug/teams/$registrationId/')({
  component: TeamManagementPage,
  loader: async ({params, context}): Promise<LoaderData> => {
    const {slug, registrationId} = params
    const session = context.session

    // Require authentication
    if (!session) {
      throw redirect({
        to: '/sign-in',
        search: {redirect: `/compete/${slug}/teams/${registrationId}`},
      })
    }

    // Get team roster
    const roster = await getTeamRosterFn({data: {registrationId}})

    if (!roster) {
      throw notFound()
    }

    const {registration, members, pending, isTeamRegistration} = roster

    // Check if current user is a team member
    const isTeamMember = members.some((m) => m.user?.id === session.userId)
    const isRegisteredUser = registration.userId === session.userId

    // Parse affiliates from registration metadata
    let memberAffiliates: Record<string, string> = {}
    let currentUserAffiliate: string | null = null

    if (registration.metadata) {
      try {
        const metadata = JSON.parse(
          registration.metadata,
        ) as RegistrationMetadata
        // Support new format (affiliates map) and legacy format (affiliateName)
        if (metadata.affiliates) {
          memberAffiliates = metadata.affiliates
        }
        // Legacy: captain's affiliate stored as affiliateName
        if (metadata.affiliateName && registration.captainUserId) {
          memberAffiliates[registration.captainUserId] = metadata.affiliateName
        }
        currentUserAffiliate = memberAffiliates[session.userId] || null
      } catch {
        // Invalid JSON, ignore
      }
    }

    // Parse pending teammates for their affiliate info
    let pendingTeammates: PendingTeammate[] = []
    if (registration.pendingTeammates) {
      try {
        pendingTeammates = JSON.parse(
          registration.pendingTeammates,
        ) as PendingTeammate[]
      } catch {
        // Invalid JSON, ignore
      }
    }

    return {
      registration,
      members,
      pending,
      isTeamRegistration,
      competition: registration.competition,
      division: registration.division,
      isTeamMember,
      isRegisteredUser,
      memberAffiliates,
      currentUserAffiliate,
      pendingTeammates,
    }
  },
})

function TeamManagementPage() {
  const {
    registration,
    members,
    pending,
    isTeamRegistration,
    competition,
    division,
    isTeamMember,
    isRegisteredUser,
    memberAffiliates,
    currentUserAffiliate,
    pendingTeammates,
  } = Route.useLoaderData()

  // Helper to get affiliate for a pending invite by email
  const getPendingAffiliate = (email: string): string | null => {
    const teammate = pendingTeammates.find(
      (t) => t.email.toLowerCase() === email.toLowerCase(),
    )
    return teammate?.affiliateName || null
  }

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/compete/invite/${token}`
    navigator.clipboard.writeText(link)
    toast.success('Invite link copied to clipboard')
  }

  // For individual registrations, show simpler view
  if (!isTeamRegistration) {
    return (
      <div className="container mx-auto max-w-4xl py-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">My Registration</h1>
          <p className="text-muted-foreground">
            {competition?.name || 'Competition'} -{' '}
            {division?.label || 'Division'}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Affiliate</CardTitle>
            <CardDescription>
              Your representing affiliate for this competition
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg">{currentUserAffiliate || 'Independent'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">
          {registration.teamName || 'Team'}
        </h1>
        <p className="text-muted-foreground">
          {competition?.name || 'Competition'} - {division?.label || 'Division'}
        </p>
      </div>

      {/* Team Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Roster
          </CardTitle>
          <CardDescription>
            {members.length} confirmed, {pending.length} pending invitation
            {pending.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Confirmed Members */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Confirmed Members
            </h4>
            <div className="space-y-2">
              {members.map((member) => {
                const memberAffiliate = member.user?.id
                  ? memberAffiliates[member.user.id]
                  : null
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={member.user?.avatar || undefined} />
                        <AvatarFallback>
                          {member.user?.firstName?.[0] || '?'}
                          {member.user?.lastName?.[0] || ''}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {member.user?.firstName} {member.user?.lastName}
                          </span>
                          {member.isCaptain && (
                            <Badge variant="secondary" className="text-xs">
                              <Crown className="w-3 h-3 mr-1" />
                              Captain
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {member.user?.email}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {memberAffiliate || 'Independent'}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-green-600">
                      Confirmed
                    </Badge>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Pending Invitations */}
          {pending.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                Pending Invitations
              </h4>
              <div className="space-y-2">
                {pending.map((invite) => {
                  const pendingAffiliate = getPendingAffiliate(invite.email)
                  return (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback>
                            <Mail className="w-4 h-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{invite.email}</p>
                          <p className="text-sm text-muted-foreground">
                            Invited{' '}
                            {invite.invitedAt
                              ? new Date(invite.invitedAt).toLocaleDateString()
                              : ''}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {pendingAffiliate || 'Independent'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isRegisteredUser && invite.token && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyInviteLink(invite.token!)}
                          >
                            <Copy className="w-4 h-4 mr-1" />
                            Copy Link
                          </Button>
                        )}
                        <Badge variant="outline" className="text-yellow-600">
                          Pending
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Affiliate */}
      {(isTeamMember || isRegisteredUser) && (
        <Card>
          <CardHeader>
            <CardTitle>My Affiliate</CardTitle>
            <CardDescription>
              Your representing affiliate for this competition
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg">{currentUserAffiliate || 'Independent'}</p>
          </CardContent>
        </Card>
      )}

      {/* Captain Actions */}
      {isRegisteredUser && pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Captain Actions</CardTitle>
            <CardDescription>
              Share the invite links with your teammates so they can join the
              team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Teammates will receive an email with their invitation link. If
              they didn&apos;t receive it, you can copy the link above and share
              it directly.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
