import {createFileRoute, Outlet, notFound} from '@tanstack/react-router'
import {getCompetitionBySlugFn} from '@/server-fns/competition-fns'
import {
  getCompetitionRegistrationCountFn,
  getUserCompetitionRegistrationFn,
  checkCanManageCompetitionFn,
  checkIsVolunteerFn,
  getRegistrationStatusFn,
} from '@/server-fns/competition-detail-fns'
import {CompetitionHero} from '@/components/competition-hero'
import {CompetitionTabs} from '@/components/competition-tabs'

export const Route = createFileRoute('/compete/$slug')({
  component: CompetitionDetailLayout,
  loader: async ({params, context}) => {
    const {slug} = params

    // Fetch competition by slug
    const {competition} = await getCompetitionBySlugFn({data: {slug}})

    if (!competition) {
      throw notFound()
    }

    // Parallel fetch: registration count and session data
    const session = context.session ?? null

    const registrationCountPromise = getCompetitionRegistrationCountFn({
      data: {competitionId: competition.id},
    })

    // If user is logged in, fetch user-specific data
    let userRegistration = null
    let canManage = false
    let isVolunteer = false
    let registrationStatus = {
      registrationOpen: false,
      registrationClosed: false,
      registrationNotYetOpen: false,
    }

    if (session) {
      const [userRegResult, canManageResult, isVolunteerResult] =
        await Promise.all([
          getUserCompetitionRegistrationFn({
            data: {
              competitionId: competition.id,
              userId: session.userId,
            },
          }),
          checkCanManageCompetitionFn({
            data: {
              organizingTeamId: competition.organizingTeamId,
              userId: session.userId,
            },
          }),
          checkIsVolunteerFn({
            data: {
              competitionTeamId: competition.competitionTeamId,
              userId: session.userId,
            },
          }),
        ])

      userRegistration = userRegResult.registration
      canManage = canManageResult.canManage
      isVolunteer = isVolunteerResult.isVolunteer
    }

    // Get registration status
    registrationStatus = await getRegistrationStatusFn({
      data: {
        registrationOpensAt: competition.registrationOpensAt,
        registrationClosesAt: competition.registrationClosesAt,
      },
    })

    const {count: registrationCount} = await registrationCountPromise

    return {
      competition,
      registrationCount,
      userRegistration,
      canManage,
      isVolunteer,
      registrationStatus,
      session,
    }
  },
})

function CompetitionDetailLayout() {
  const {
    competition,
    registrationCount,
    userRegistration,
    canManage,
    registrationStatus,
  } = Route.useLoaderData()
  const {slug} = Route.useParams()

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <CompetitionHero
        competition={competition}
        registrationCount={registrationCount}
        canManage={canManage}
      />

      {/* Tabbed Navigation */}
      <CompetitionTabs
        slug={slug}
        isRegistered={!!userRegistration}
        registrationOpen={registrationStatus.registrationOpen}
        registrationClosed={registrationStatus.registrationClosed}
        registrationNotYetOpen={registrationStatus.registrationNotYetOpen}
      />

      {/* Content Area */}
      <div className="container mx-auto px-4 py-8">
        <Outlet />
      </div>
    </div>
  )
}
