import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PendingTeamInvites } from "@/components/compete/pending-team-invites"
import { getCompetition, getCompetitionRegistrations, getUserCompetitionRegistration } from "@/server/competitions"
import { getPendingInvitationsForCurrentUser } from "@/server/team-members"
import { listScalingLevels } from "@/server/scaling-levels"
import { parseCompetitionSettings } from "@/types/competitions"
import { getSessionFromCookie } from "@/utils/auth"
import { canOrganizeForTeam } from "@/utils/get-user-organizing-teams"
import { CompetitionHero } from "./_components/competition-hero"
import { CompetitionTabs } from "./_components/competition-tabs"
import { EventDetailsContent } from "./_components/event-details-content"
import { LeaderboardContent } from "./_components/leaderboard-content"
import { RegisterButton } from "./_components/register-button"
import { RegistrationSidebar } from "./_components/registration-sidebar"
import { WorkoutsContent } from "./_components/workouts-content"

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const competition = await getCompetition(slug)

  if (!competition) {
    return {
      title: "Competition Not Found",
    }
  }

  return {
    title: `${competition.name} - Compete`,
    description: competition.description || `Register for ${competition.name}`,
    openGraph: {
      type: "website",
      title: competition.name,
      description: competition.description || `Register for ${competition.name}`,
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(competition.name)}`,
          width: 1200,
          height: 630,
          alt: competition.name,
        },
      ],
    },
  }
}

export default async function CompetitionDetailPage({ params }: Props) {
  const { slug } = await params
  const competition = await getCompetition(slug)

  if (!competition) {
    notFound()
  }

  // Parse settings early to check for divisions
  const settings = parseCompetitionSettings(competition.settings)

  // Parallel fetch: session, registrations, and divisions
  const [session, registrations, divisions] = await Promise.all([
    getSessionFromCookie(),
    getCompetitionRegistrations(competition.id),
    settings?.divisions?.scalingGroupId
      ? listScalingLevels({ scalingGroupId: settings.divisions.scalingGroupId })
      : Promise.resolve(null),
  ])

  // Check if user is already registered, get pending invites, and check manage permission (depends on session)
  let userRegistration = null
  let pendingInvitations: Awaited<ReturnType<typeof getPendingInvitationsForCurrentUser>> = []
  let canManage = false
  if (session) {
    const [registration, invitations, canOrganize] = await Promise.all([
      getUserCompetitionRegistration(competition.id, session.userId),
      getPendingInvitationsForCurrentUser().catch(() => []),
      canOrganizeForTeam(competition.organizingTeamId),
    ])
    userRegistration = registration
    pendingInvitations = invitations
    canManage = canOrganize
  }

  const registrationCount = registrations.length

  // Check registration status
  const now = new Date()
  const regOpensAt = competition.registrationOpensAt
    ? typeof competition.registrationOpensAt === "number"
      ? new Date(competition.registrationOpensAt)
      : competition.registrationOpensAt
    : null
  const regClosesAt = competition.registrationClosesAt
    ? typeof competition.registrationClosesAt === "number"
      ? new Date(competition.registrationClosesAt)
      : competition.registrationClosesAt
    : null

  const registrationOpen = !!(regOpensAt && regClosesAt && regOpensAt <= now && regClosesAt >= now)
  const registrationClosed = !!(regClosesAt && regClosesAt < now)
  const registrationNotYetOpen = !!(regOpensAt && regOpensAt > now)

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <CompetitionHero
        competition={competition}
        registrationCount={registrationCount}
        canManage={canManage}
      />

      {/* Tabbed Content */}
      <CompetitionTabs
        workoutsContent={<WorkoutsContent competition={competition} />}
        leaderboardContent={
          <LeaderboardContent
            competitionId={competition.id}
            divisions={divisions}
          />
        }
        registerButton={
          <RegisterButton
            slug={slug}
            isLoggedIn={!!session}
            isRegistered={!!userRegistration}
            registrationOpen={registrationOpen}
            registrationClosed={registrationClosed}
            registrationNotYetOpen={registrationNotYetOpen}
          />
        }
      >
        {/* Event Details Tab Content */}
        <div className="container mx-auto px-4 py-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            {/* Main Content */}
            <EventDetailsContent
              competition={competition}
              divisions={divisions ?? undefined}
            />

            {/* Sidebar */}
            <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              <PendingTeamInvites
                invitations={pendingInvitations}
                competitionId={competition.id}
              />
              <RegistrationSidebar
                competition={competition}
                isRegistered={!!userRegistration}
                registrationOpen={registrationOpen}
                registrationCount={registrationCount}
                userDivision={userRegistration?.division?.label}
                registrationId={userRegistration?.id}
                isTeamRegistration={(userRegistration?.division?.teamSize ?? 1) > 1}
                isCaptain={userRegistration?.userId === session?.userId}
              />
            </aside>
          </div>
        </div>
      </CompetitionTabs>
    </div>
  )
}
