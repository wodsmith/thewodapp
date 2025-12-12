import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Separator } from '~/components/ui/separator'
import { PendingTeamInvites } from '~/components/compete/pending-team-invites'
import { AthleteHeader } from '~/components/compete/athlete/athlete-header'
import { AthleteStats } from '~/components/compete/athlete/athlete-stats'
import { BenchmarkStats } from '~/components/compete/athlete/benchmark-stats'
import { CompetitiveHistory } from '~/components/compete/athlete/competitive-history'
import { SponsorsSocial } from '~/components/compete/athlete/sponsors-social'
import { getAthleteProfileFn } from '~/server-functions/user'
import { getSessionFromCookie } from '~/utils/auth'

export const Route = createFileRoute('/_compete/compete/athlete')({
  loader: async () => {
    const session = await getSessionFromCookie()
    if (!session) {
      throw new Error('Unauthorized')
    }

    return {
      athleteProfile: await getAthleteProfileFn({ data: { userId: session.userId } }),
    }
  },
  component: AthletePageComponent,
  errorComponent: () => {
    const navigate = useNavigate()
    useEffect(() => {
      navigate({ to: '/sign-in', search: { redirect: '/compete/athlete' } })
    }, [navigate])
    return null
  },
})

function AthletePageComponent() {
  const { athleteProfile } = Route.useLoaderData()

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* Header with cover image and avatar */}
      <AthleteHeader athleteProfile={athleteProfile} />

      {/* Stats Section */}
      <AthleteStats athleteProfile={athleteProfile} />

      {/* Pending Team Invites */}
      {athleteProfile.pendingInvitations?.length > 0 && (
        <>
          <Separator />
          <section className="space-y-4">
            <h2 className="font-semibold text-lg">Pending Team Invites</h2>
            <PendingTeamInvites
              invitations={athleteProfile.pendingInvitations}
              variant="inline"
            />
          </section>
        </>
      )}

      <Separator />

      {/* Competitive History */}
      <CompetitiveHistory
        registrations={athleteProfile.competitionHistory}
      />

      <Separator />

      {/* Benchmark Stats */}
      <BenchmarkStats athleteProfile={athleteProfile} />

      <Separator />

      {/* Sponsors & Social */}
      <SponsorsSocial athleteProfile={athleteProfile} />
    </div>
  )
}
