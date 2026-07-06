// @lat: [[competition-type-capabilities#Public Discovery Split]]
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { SearchIcon, X } from "lucide-react"
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react"
import CompeteNav from "@/components/compete-nav"
import { CompetitionCard } from "@/components/competition-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { competitionCan } from "@/lib/competitions/capabilities"
import { perpetualSubmissionsClosed } from "@/lib/competitions/perpetual-dates"
import { getSessionFn } from "@/server-fns/auth-fns"
import { getPublicCompetitionsFn } from "@/server-fns/competition-fns"
import { hasCurrentUserOrganizerRequestFn } from "@/server-fns/organizer-onboarding-fns"
import { getTodayInTimezone } from "@/utils/date-utils"

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

type BenchmarksSearch = {
  q?: string
}

export const Route = createFileRoute("/benchmarks")({
  head: () => ({
    meta: [
      {
        title: "Benchmark Workouts & Leaderboards | WODsmith",
      },
      {
        name: "description",
        content:
          "Test yourself against perpetual benchmark workouts. Submit your scores, climb the leaderboards, and track your fitness on WODsmith.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://wodsmith.com/benchmarks" },
      {
        property: "og:title",
        content: "Benchmark Workouts & Leaderboards | WODsmith",
      },
      {
        property: "og:description",
        content:
          "Test yourself against perpetual benchmark workouts. Submit your scores, climb the leaderboards, and track your fitness.",
      },
      { property: "og:site_name", content: "WODsmith" },
      { name: "twitter:card", content: "summary" },
      {
        name: "twitter:title",
        content: "Benchmark Workouts & Leaderboards | WODsmith",
      },
      {
        name: "twitter:description",
        content:
          "Test yourself against perpetual benchmark workouts on WODsmith.",
      },
    ],
    links: [{ rel: "canonical", href: "https://wodsmith.com/benchmarks" }],
  }),
  component: BenchmarksPage,
  staleTime: 30_000,
  validateSearch: (search: Record<string, unknown>): BenchmarksSearch => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  loader: async () => {
    const [result, session, hasOrganizerApplication] = await Promise.all([
      getPublicCompetitionsFn({ data: {} }),
      getSessionFn(),
      hasCurrentUserOrganizerRequestFn(),
    ])

    return {
      competitions: result.competitions,
      session,
      hasOrganizerApplication,
    }
  },
})

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function BenchmarksPage() {
  const { competitions, session, hasOrganizerApplication } =
    Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [, startTransition] = useTransition()
  const [localSearch, setLocalSearch] = useState(search.q ?? "")
  const deferredSearchQuery = useDeferredValue(search.q)

  // Prevent card-enter animation from firing twice on SSR + hydration.
  // Only enable animation after the client has hydrated.
  const [hasMounted, setHasMounted] = useState(false)
  useEffect(() => setHasMounted(true), [])

  const handleSearchChange = (value: string) => {
    setLocalSearch(value)
    startTransition(() => {
      navigate({ search: value ? { q: value } : {} })
    })
  }

  // Benchmarks are perpetual boards — show every one that is available,
  // meaning its start date has passed.
  const benchmarks = useMemo(
    () =>
      competitions
        .filter((comp) => {
          if (!competitionCan(comp.competitionType, "perpetual")) return false
          const today = getTodayInTimezone(comp.timezone ?? "America/Denver")
          return comp.startDate <= today
        })
        .map((comp) => ({
          ...comp,
          _status: perpetualSubmissionsClosed(comp)
            ? ("past" as const)
            : ("active" as const),
        })),
    [competitions],
  )

  const sorted = useMemo(() => {
    let list = benchmarks

    if (deferredSearchQuery) {
      const q = deferredSearchQuery.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.organizingTeam?.name.toLowerCase().includes(q),
      )
    }

    return [...list].sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    )
  }, [benchmarks, deferredSearchQuery])

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <CompeteNav
        session={session}
        hasOrganizerApplication={hasOrganizerApplication}
      />

      <main className="container mx-auto flex-1 px-2 py-4 sm:px-6 sm:py-12">
        {/* ── Header ─────────────────────────────────────────── */}
        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Benchmarks
          </h1>
          <p className="mt-2 text-base text-muted-foreground max-w-lg">
            Perpetual benchmark boards. Test yourself, submit a score, and see
            where you stack up.
          </p>
        </header>

        {/* ── Toolbar ────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end mb-4">
          <div className="relative w-full sm:w-56">
            <SearchIcon
              className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
              aria-hidden="true"
            />
            <Input
              type="search"
              aria-label="Search benchmarks"
              name="benchmark-search"
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
        </div>

        {/* ── Divider ────────────────────────────────────────── */}
        <div className="border-t mb-8" />

        {/* ── Grid ───────────────────────────────────────────── */}
        {sorted.length === 0 ? (
          <EmptyState searchQuery={deferredSearchQuery} />
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
      </main>

      <footer className="border-black border-t-2 p-4">
        <div className="container mx-auto">
          <p className="text-center">
            &copy; {new Date().getFullYear()} WODsmith. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ searchQuery }: { searchQuery?: string }) {
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
          : "Check back soon — new benchmarks are added regularly."}
      </p>
      {searchQuery && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-4 text-muted-foreground"
          onClick={() => navigate({ search: {} })}
        >
          Clear search
        </Button>
      )}
    </div>
  )
}
