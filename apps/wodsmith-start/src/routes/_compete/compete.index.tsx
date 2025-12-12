import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { CompetitionRow } from '~/components/compete/competition-row'
import { CompetitionSearch } from '~/components/compete/competition-search'
import { CompetitionSection } from '~/components/compete/competition-section'
import { getPublicCompetitionsFn } from '~/server-functions/competitions'

export const Route = createFileRoute('/_compete/compete/')({
  loader: async () => {
    const result = await getPublicCompetitionsFn({})
    return {
      competitions: result.success ? result.data : [],
    }
  },
  component: CompeteIndexComponent,
})

// Helper to determine competition status
function getCompetitionStatus(comp: any, now: Date) {
  const startDate = new Date(comp.startDate)
  const endDate = new Date(comp.endDate)
  const regOpens = comp.registrationOpensAt
    ? new Date(comp.registrationOpensAt)
    : null
  const regCloses = comp.registrationClosesAt
    ? new Date(comp.registrationClosesAt)
    : null

  // Past if already ended
  if (endDate < now) {
    return 'past'
  }

  // Active if currently happening
  if (startDate <= now && endDate >= now) {
    return 'active'
  }

  // Registration open if starts in future AND registration window is active
  if (
    startDate > now &&
    regOpens &&
    regCloses &&
    regOpens <= now &&
    regCloses > now
  ) {
    return 'registration-open'
  }

  // Registration closed if starts in future AND reg window closed
  if (startDate > now && regOpens && regCloses && regCloses <= now) {
    return 'registration-closed'
  }

  // Coming soon if starts in future AND (no reg window OR reg not yet open)
  if (startDate > now && (!regOpens || regOpens > now)) {
    return 'coming-soon'
  }

  // Default fallback
  return 'coming-soon'
}

function CompeteIndexComponent() {
  const search = Route.useSearch() as { q?: string; past?: string }
  const { competitions } = Route.useLoaderData()
  
  const searchQuery = search.q
  const showPast = search.past === 'true'
  const now = new Date()

  // Filter by search query if provided
  const filteredCompetitions = searchQuery
    ? competitions.filter(
        (comp) =>
          comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          comp.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          comp.organizingTeam?.name
            .toLowerCase()
            .includes(searchQuery.toLowerCase()),
      )
    : competitions

  // Filter out past competitions unless showPast is true
  const visibleCompetitions = showPast
    ? filteredCompetitions
    : filteredCompetitions.filter(
        (comp) => getCompetitionStatus(comp, now) !== 'past',
      )

  // Sort competitions by start date
  const sortedCompetitions = [...visibleCompetitions].sort(
    (a, b) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  )

  const hasNoCompetitions = sortedCompetitions.length === 0

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold uppercase">All Competitions</h1>
        <p className="text-muted-foreground mt-1">
          Find and register for CrossFit competitions
        </p>
      </div>

      <Suspense>
        <CompetitionSearch />
      </Suspense>

      {/* All Competitions Section */}
      {hasNoCompetitions ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery
              ? 'No competitions match your search.'
              : 'No competitions available right now.'}
          </p>
        </div>
      ) : (
        <CompetitionSection
          title="All Competitions"
          count={sortedCompetitions.length}
        >
          {sortedCompetitions.map((comp) => (
            <CompetitionRow
              key={comp.id}
              competition={comp}
              status={getCompetitionStatus(comp, now) as any}
            />
          ))}
        </CompetitionSection>
      )}
    </div>
  )
}
