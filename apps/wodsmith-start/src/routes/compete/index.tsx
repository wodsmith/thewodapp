import {createFileRoute, useNavigate} from '@tanstack/react-router'
import {
  getPublicCompetitionsFn,
  type CompetitionWithOrganizingTeam,
} from '@/server-fns/competition-fns'
import {CompetitionSearch} from '@/components/competition-search'
import {CompetitionSection} from '@/components/competition-section'
import {CompetitionRow} from '@/components/competition-row'

type CompeteSearch = {
  q?: string
  past?: boolean
}

export const Route = createFileRoute('/compete/')({
  component: CompetePage,
  validateSearch: (search: Record<string, unknown>): CompeteSearch => ({
    q: typeof search.q === 'string' ? search.q : undefined,
    past: search.past === 'true' || search.past === true,
  }),
  loader: async () => {
    const result = await getPublicCompetitionsFn({data: {}})
    return {
      competitions: result.competitions,
    }
  },
})

// Helper to determine competition status
function getCompetitionStatus(comp: CompetitionWithOrganizingTeam, now: Date) {
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

type CompetitionStatus =
  | 'registration-open'
  | 'active'
  | 'coming-soon'
  | 'registration-closed'
  | 'past'

function CompetePage() {
  const {competitions} = Route.useLoaderData()
  const {q: searchQuery, past} = Route.useSearch()
  const navigate = useNavigate({from: Route.fullPath})
  const showPast = past === true
  const now = new Date()

  // TODO: Authentication - this will be wired up when auth is implemented
  const isAuthenticated = false

  // Handlers for search state updates
  const handleSearchChange = (value: string) => {
    navigate({
      search: (prev) => ({...prev, q: value || undefined}),
    })
  }

  const handleShowPastChange = (value: boolean) => {
    navigate({
      search: (prev) => ({...prev, past: value || undefined}),
    })
  }

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
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
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

      <CompetitionSearch
        search={searchQuery || ''}
        showPast={showPast}
        onSearchChange={handleSearchChange}
        onShowPastChange={handleShowPastChange}
      />

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
              status={getCompetitionStatus(comp, now) as CompetitionStatus}
              isAuthenticated={isAuthenticated}
            />
          ))}
        </CompetitionSection>
      )}
    </div>
  )
}
