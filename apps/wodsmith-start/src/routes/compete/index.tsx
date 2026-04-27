import {
	useEffect,
	useDeferredValue,
	useMemo,
	useState,
	useTransition,
} from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { FilterIcon, SearchIcon, X } from "lucide-react"
import { CompetitionCard } from "@/components/competition-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getSessionFn } from "@/server-fns/auth-fns"
import {
  type CompetitionWithOrganizingTeam,
  getPublicCompetitionsFn,
} from "@/server-fns/competition-fns"
import { cn } from "@/utils/cn"
import { getTodayInTimezone } from "@/utils/date-utils"

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

type StatusFilter = "all" | "registration-open" | "active" | "upcoming" | "past"

type CompeteSearch = {
  q?: string
  filter?: StatusFilter
  location?: string
  organizer?: string
  type?: "in-person" | "online"
}

export const Route = createFileRoute("/compete/")({
  head: () => ({
    meta: [
      {
        title: "Find Fitness Competitions | WODsmith",
      },
      {
        name: "description",
        content:
          "Browse and register for functional fitness competitions. Find upcoming CrossFit throwdowns, see leaderboards, and sign up on WODsmith.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://wodsmith.com/compete" },
      {
        property: "og:title",
        content: "Find Fitness Competitions | WODsmith",
      },
      {
        property: "og:description",
        content:
          "Browse and register for functional fitness competitions. Find upcoming CrossFit throwdowns, see leaderboards, and sign up.",
      },
      { property: "og:site_name", content: "WODsmith" },
      { name: "twitter:card", content: "summary" },
      {
        name: "twitter:title",
        content: "Find Fitness Competitions | WODsmith",
      },
      {
        name: "twitter:description",
        content:
          "Browse and register for functional fitness competitions on WODsmith.",
      },
    ],
    links: [{ rel: "canonical", href: "https://wodsmith.com/compete" }],
  }),
  component: CompetePage,
  staleTime: 30_000,
  validateSearch: (search: Record<string, unknown>): CompeteSearch => ({
    q: typeof search.q === "string" ? search.q : undefined,
    filter: isValidStatusFilter(search.filter) ? search.filter : undefined,
    location: typeof search.location === "string" ? search.location : undefined,
    organizer:
      typeof search.organizer === "string" ? search.organizer : undefined,
    type:
      search.type === "in-person" || search.type === "online"
        ? search.type
        : undefined,
  }),
  loader: async () => {
    const [result, session] = await Promise.all([
      getPublicCompetitionsFn({ data: {} }),
      getSessionFn(),
    ])
    return {
      competitions: result.competitions,
      isAuthenticated: session !== null,
    }
  },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidStatusFilter(value: unknown): value is StatusFilter {
  return (
    typeof value === "string" &&
    ["all", "registration-open", "active", "upcoming", "past"].includes(value)
  )
}

type CompetitionStatus =
  | "registration-open"
  | "active"
  | "coming-soon"
  | "registration-closed"
  | "past"

function getCompetitionStatus(
  comp: CompetitionWithOrganizingTeam,
): CompetitionStatus {
  const { startDate, endDate, registrationOpensAt, registrationClosesAt } = comp
  const today = getTodayInTimezone(comp.timezone ?? "America/Denver")

  if (endDate < today) return "past"
  if (startDate <= today && endDate >= today) return "active"
  if (
    startDate > today &&
    registrationOpensAt &&
    registrationClosesAt &&
    registrationOpensAt <= today &&
    registrationClosesAt >= today
  )
    return "registration-open"
  if (startDate > today && registrationClosesAt && registrationClosesAt < today)
    return "registration-closed"
  return "coming-soon"
}

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "registration-open", label: "Open" },
  { value: "active", label: "Live" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
]

function matchesStatusFilter(
  status: CompetitionStatus,
  filter: StatusFilter,
): boolean {
  if (filter === "all") return status !== "past"
  if (filter === "past") return status === "past"
  if (filter === "active") return status === "active"
  if (filter === "registration-open") return status === "registration-open"
  if (filter === "upcoming")
    return status === "coming-soon" || status === "registration-closed"
  return true
}

function getLocationLabel(comp: CompetitionWithOrganizingTeam): string | null {
  const city = comp.address?.city?.trim()
  const state = comp.address?.stateProvince?.trim()
  if (city && state) return `${city}, ${state}`
  if (city) return city
  if (state) return state
  return null
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function CompetePage() {
  const { competitions } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const activeStatus = search.filter ?? "all"
  const [, startTransition] = useTransition()
  const [localSearch, setLocalSearch] = useState(search.q ?? "")
  const deferredSearchQuery = useDeferredValue(search.q)
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(search.location || search.organizer || search.type),
  )

  // Prevent card-enter animation from firing twice on SSR + hydration.
  // Only enable animation after the client has hydrated.
  const [hasMounted, setHasMounted] = useState(false)
  useEffect(() => setHasMounted(true), [])

  const updateSearch = (updates: Partial<CompeteSearch>) => {
    startTransition(() => {
      navigate({
        search: (prev) => {
          const next = { ...prev, ...updates }
          // Clean undefined values
          for (const key of Object.keys(next) as (keyof CompeteSearch)[]) {
            if (next[key] === undefined) delete next[key]
          }
          return next
        },
      })
    })
  }

  const handleSearchChange = (value: string) => {
    setLocalSearch(value)
    updateSearch({ q: value || undefined })
  }

  // Derive statuses
  const competitionsWithStatus = useMemo(
    () =>
      competitions.map((comp) => ({
        ...comp,
        _status: getCompetitionStatus(comp),
        _location: getLocationLabel(comp),
      })),
    [competitions],
  )

  // Build filter option lists from data
  const filterOptions = useMemo(() => {
    const locations = new Set<string>()
    const organizers = new Set<string>()

    for (const comp of competitionsWithStatus) {
      if (comp._location) locations.add(comp._location)
      if (comp.organizingTeam?.name) organizers.add(comp.organizingTeam.name)
    }

    return {
      locations: [...locations].sort(),
      organizers: [...organizers].sort(),
    }
  }, [competitionsWithStatus])

  // Counts per status tab
  const counts = useMemo(() => {
    const c = {
      all: 0,
      "registration-open": 0,
      active: 0,
      upcoming: 0,
      past: 0,
    }
    for (const comp of competitionsWithStatus) {
      if (comp._status !== "past") c.all++
      if (comp._status === "registration-open") c["registration-open"]++
      if (comp._status === "active") c.active++
      if (
        comp._status === "coming-soon" ||
        comp._status === "registration-closed"
      )
        c.upcoming++
      if (comp._status === "past") c.past++
    }
    return c
  }, [competitionsWithStatus])

  // Check if any advanced filter is active
  const hasAdvancedFilters = Boolean(
    search.location || search.organizer || search.type,
  )

  const clearAdvancedFilters = () => {
    updateSearch({
      location: undefined,
      organizer: undefined,
      type: undefined,
    })
  }

  // Filter + search + sort
  const sorted = useMemo(() => {
    let list = competitionsWithStatus.filter((c) =>
      matchesStatusFilter(c._status, activeStatus),
    )

    // Advanced filters
    if (search.location) {
      list = list.filter((c) => c._location === search.location)
    }
    if (search.organizer) {
      list = list.filter((c) => c.organizingTeam?.name === search.organizer)
    }
    if (search.type) {
      list = list.filter((c) => c.competitionType === search.type)
    }

    // Text search
    if (deferredSearchQuery) {
      const q = deferredSearchQuery.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.organizingTeam?.name.toLowerCase().includes(q),
      )
    }

    const priority: Record<CompetitionStatus, number> = {
      active: 0,
      "registration-open": 1,
      "coming-soon": 2,
      "registration-closed": 2,
      past: 4,
    }
    return [...list].sort((a, b) => {
      const p = priority[a._status] - priority[b._status]
      if (p !== 0) return p
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    })
  }, [
    competitionsWithStatus,
    activeStatus,
    search.location,
    search.organizer,
    search.type,
    deferredSearchQuery,
  ])

  return (
    <div className="container mx-auto px-2 sm:px-6 py-4 sm:py-12">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Competitions
        </h1>
        <p className="mt-2 text-base text-muted-foreground max-w-lg">
          Discover events, register to compete, and track your performance.
        </p>
      </header>

      {/* ── Toolbar ────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
        {/* Status tabs */}
        <div
          className="flex items-center gap-0.5 -ml-2"
          role="tablist"
          aria-label="Filter competitions"
        >
          {STATUS_TABS.map((tab) => {
            const isActive = activeStatus === tab.value
            const count = counts[tab.value]
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() =>
                  updateSearch({
                    filter: tab.value === "all" ? undefined : tab.value,
                  })
                }
                className={cn(
                  "relative px-3 py-1.5 text-sm rounded-md",
                  "transition-colors duration-100 motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive
                    ? "font-semibold text-foreground bg-secondary"
                    : "font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={cn(
                      "ml-1.5 text-xs tabular-nums",
                      isActive
                        ? "text-foreground/50"
                        : "text-muted-foreground/60",
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search + filter toggle */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-56">
            <SearchIcon
              className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
              aria-hidden="true"
            />
            <Input
              type="search"
              aria-label="Search competitions"
              name="competition-search"
              placeholder="Search…"
              value={localSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="pl-9 pr-8 h-9 text-sm bg-secondary/50 border-transparent focus:bg-card focus:border-input"
            />
            {localSearch && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => handleSearchChange("")}
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Clear search</span>
              </Button>
            )}
          </div>
          <Button
            variant={showAdvanced ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "h-9 gap-1.5 shrink-0",
              hasAdvancedFilters && "text-primary",
            )}
            onClick={() => setShowAdvanced((v) => !v)}
          >
            <FilterIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Filters</span>
            {hasAdvancedFilters && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
                {
                  [search.location, search.organizer, search.type].filter(
                    Boolean,
                  ).length
                }
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* ── Advanced filters ───────────────────────────────── */}
      {showAdvanced && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3 mb-4 p-4 rounded-lg bg-secondary/30 border">
          {/* Location */}
          <div className="flex flex-col gap-1.5 sm:min-w-[180px]">
            <label
              htmlFor="filter-location"
              className="text-xs font-medium text-muted-foreground"
            >
              Location
            </label>
            <Select
              value={search.location ?? "__all__"}
              onValueChange={(v) =>
                updateSearch({ location: v === "__all__" ? undefined : v })
              }
            >
              <SelectTrigger id="filter-location" className="h-9 text-sm">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All locations</SelectItem>
                {filterOptions.locations.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Organizer */}
          <div className="flex flex-col gap-1.5 sm:min-w-[180px]">
            <label
              htmlFor="filter-organizer"
              className="text-xs font-medium text-muted-foreground"
            >
              Organizer
            </label>
            <Select
              value={search.organizer ?? "__all__"}
              onValueChange={(v) =>
                updateSearch({ organizer: v === "__all__" ? undefined : v })
              }
            >
              <SelectTrigger id="filter-organizer" className="h-9 text-sm">
                <SelectValue placeholder="All organizers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All organizers</SelectItem>
                {filterOptions.organizers.map((org) => (
                  <SelectItem key={org} value={org}>
                    {org}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Competition type */}
          <div className="flex flex-col gap-1.5 sm:min-w-[150px]">
            <label
              htmlFor="filter-type"
              className="text-xs font-medium text-muted-foreground"
            >
              Type
            </label>
            <Select
              value={search.type ?? "__all__"}
              onValueChange={(v) =>
                updateSearch({
                  type: v === "in-person" || v === "online" ? v : undefined,
                })
              }
            >
              <SelectTrigger id="filter-type" className="h-9 text-sm">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All types</SelectItem>
                <SelectItem value="in-person">In-Person</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear */}
          {hasAdvancedFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-muted-foreground self-end"
              onClick={clearAdvancedFilters}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* ── Divider ────────────────────────────────────────── */}
      <div className="border-t mb-8" />

      {/* ── Grid ───────────────────────────────────────────── */}
      {sorted.length === 0 ? (
        <EmptyState
          searchQuery={deferredSearchQuery}
          hasFilters={activeStatus !== "all" || hasAdvancedFilters}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sorted.map((comp, i) => (
            <CompetitionCard
              key={comp.id}
              competition={comp}
              status={comp._status}
              index={i}
              animate={hasMounted}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  searchQuery,
  hasFilters,
}: {
  searchQuery?: string
  hasFilters: boolean
}) {
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="h-px w-12 bg-border mb-6" />
      <p className="text-sm font-medium text-foreground">
        {searchQuery ? "No results" : "Nothing here yet"}
      </p>
      <p className="mt-1.5 text-sm text-muted-foreground max-w-xs">
        {searchQuery
          ? `Nothing matches "${searchQuery}".`
          : hasFilters
            ? "Try adjusting your filters."
            : "Check back soon — new competitions are added regularly."}
      </p>
      {(searchQuery || hasFilters) && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-4 text-muted-foreground"
          onClick={() => navigate({ search: {} })}
        >
          Clear all filters
        </Button>
      )}
    </div>
  )
}
