"use client"

import { Link } from "@tanstack/react-router"
import {
  ArrowRight,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { BenchmarkViewerScore } from "@/server-fns/athlete-score-fns"

export const BENCHMARK_WORKOUT_DOMAINS = [
  "Strength & barbell",
  "Gymnastics & skill",
  "Machines & rope",
  "Mixed tests",
  "Running",
  "Rowing",
  "CrossFit benchmarks",
  "Other benchmarks",
] as const

export type BenchmarkWorkoutDomain = (typeof BENCHMARK_WORKOUT_DOMAINS)[number]

export interface BenchmarkDirectoryWorkout {
  id: string
  trackOrder: number
  workout: {
    name: string
    scheme: string
    scoreType?: string | null
    movements?: readonly { name: string }[]
    tags?: readonly { name: string }[]
  }
}

export interface BenchmarkWorkoutGroup<
  TWorkout extends BenchmarkDirectoryWorkout = BenchmarkDirectoryWorkout,
> {
  domain: BenchmarkWorkoutDomain
  workouts: TWorkout[]
}

interface BenchmarkWorkoutDirectoryProps {
  slug: string
  workouts: readonly BenchmarkDirectoryWorkout[]
  viewerScores?: Readonly<Record<string, BenchmarkViewerScore>>
}

const DOMAIN_META: Record<
  BenchmarkWorkoutDomain,
  { code: string; short: string; description: string }
> = {
  "Strength & barbell": {
    code: "ST",
    short: "Strength",
    description: "Presses, pulls, squats and Olympic lifts",
  },
  "Gymnastics & skill": {
    code: "GY",
    short: "Gymnastics",
    description: "Bodyweight strength, control and skill",
  },
  "Machines & rope": {
    code: "EN",
    short: "Machines",
    description: "Bike, ski and rope capacity",
  },
  "Mixed tests": {
    code: "MX",
    short: "Mixed",
    description: "Multi-modal competition tests",
  },
  Running: {
    code: "RN",
    short: "Running",
    description: "Short speed through long aerobic work",
  },
  Rowing: {
    code: "RW",
    short: "Rowing",
    description: "Sprint, middle and long distance",
  },
  "CrossFit benchmarks": {
    code: "CF",
    short: "Classics",
    description: "Girls, heroes and Open tests",
  },
  "Other benchmarks": {
    code: "OT",
    short: "Other",
    description: "Benchmarks outside the established domains",
  },
}

const CROSSFIT_BENCHMARK_NAMES = [
  "angie",
  "annie",
  "barbara",
  "chelsea",
  "eva",
  "fran",
  "diane",
  "helen",
  "grace",
  "isabel",
  "amanda",
  "elizabeth",
  "nancy",
  "murph",
  "cindy",
  "jackie",
  "karen",
  "kelly",
  "linda",
  "lynne",
  "mary",
  "nicole",
  "100 wall ball 100 cal row",
  "7 min amrap burpees",
]

const MIXED_TEST_NAMES = ["acid bath", "beat bagent", "regional triple 3"]
const RAIL_STORAGE_KEY = "benchmark-domain-rail-collapsed"
const RESULT_LABELS: Readonly<Record<string, string>> = {
  time: "Time",
  "time-with-cap": "Time",
  "rounds-reps": "Rounds + reps",
  reps: "Reps",
  load: "Load",
  calories: "Calories",
  meters: "Distance",
  feet: "Distance",
  emom: "EMOM",
  "pass-fail": "Pass / fail",
  points: "Points",
}

function normalizeBenchmarkText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function containsAny(value: string, terms: readonly string[]): boolean {
  return terms.some((term) => value.includes(term))
}

function hasExplicitTag(tags: string, terms: readonly string[]): boolean {
  const paddedTags = ` ${tags} `
  return terms.some((term) =>
    paddedTags.includes(` ${normalizeBenchmarkText(term)} `),
  )
}

function getWorkoutSearchText(workout: BenchmarkDirectoryWorkout): string {
  const descriptor = workout.workout
  return normalizeBenchmarkText(
    [
      descriptor.name,
      descriptor.scheme,
      descriptor.scoreType ?? "",
      formatBenchmarkResult(descriptor),
      ...(descriptor.tags?.map(({ name }) => name) ?? []),
      ...(descriptor.movements?.map(({ name }) => name) ?? []),
    ].join(" "),
  )
}

export function getBenchmarkWorkoutDomain(
  workout: BenchmarkDirectoryWorkout,
): BenchmarkWorkoutDomain {
  const descriptor = workout.workout
  const name = normalizeBenchmarkText(descriptor.name)
  const tags = normalizeBenchmarkText(
    descriptor.tags?.map(({ name: tagName }) => tagName).join(" ") ?? "",
  )
  const movements = normalizeBenchmarkText(
    descriptor.movements
      ?.map(({ name: movementName }) => movementName)
      .join(" ") ?? "",
  )
  const combined = `${name} ${movements}`

  if (
    hasExplicitTag(tags, [
      "girl benchmark",
      "hero benchmark",
      "crossfit benchmark",
      "crossfit classic",
      "girl",
      "hero",
      "crossfit girl",
      "crossfit hero",
      "crossfit open",
      "girl wod",
      "hero wod",
      "open workout",
    ]) ||
    CROSSFIT_BENCHMARK_NAMES.some(
      (benchmarkName) =>
        name === benchmarkName || name.startsWith(`${benchmarkName} `),
    ) ||
    /^open \d/.test(name)
  ) {
    return "CrossFit benchmarks"
  }

  if (
    hasExplicitTag(tags, ["mixed modal", "mixed test", "multi modal"]) ||
    MIXED_TEST_NAMES.includes(name)
  ) {
    return "Mixed tests"
  }

  if (hasExplicitTag(tags, ["strength and barbell", "strength", "barbell"])) {
    return "Strength & barbell"
  }
  if (hasExplicitTag(tags, ["gymnastics and skill", "gymnastics", "skill"])) {
    return "Gymnastics & skill"
  }
  if (hasExplicitTag(tags, ["machines and rope", "machine", "jump rope"])) {
    return "Machines & rope"
  }
  if (hasExplicitTag(tags, ["running"])) return "Running"
  if (hasExplicitTag(tags, ["rowing"])) return "Rowing"

  if (containsAny(name, ["run", "mile", "400m sprint"])) return "Running"
  if (containsAny(name, [" row", "row ", "rowing"]) || name.endsWith(" row")) {
    return "Rowing"
  }
  if (
    containsAny(combined, [
      "bike erg",
      "bikeerg",
      "echo bike",
      "assault bike",
      "ski erg",
      "skierg",
      "double under",
      "jump rope",
    ])
  ) {
    return "Machines & rope"
  }
  if (
    containsAny(combined, [
      "pull up",
      "pullup",
      "toes to bar",
      "handstand",
      "hspu",
      "muscle up",
      "ring dip",
      "l sit",
      "ghdsu",
      "vertical jump",
      "dead hang",
      "pegboard",
    ])
  ) {
    return "Gymnastics & skill"
  }
  if (
    descriptor.scheme === "load" ||
    containsAny(combined, [
      "deadlift",
      "press",
      "squat",
      "snatch",
      "clean",
      "jerk",
      "barbell",
      "bench",
    ])
  ) {
    return "Strength & barbell"
  }

  return "Other benchmarks"
}

export function groupBenchmarkWorkouts<
  TWorkout extends BenchmarkDirectoryWorkout,
>(workouts: readonly TWorkout[]): BenchmarkWorkoutGroup<TWorkout>[] {
  const grouped: Record<BenchmarkWorkoutDomain, TWorkout[]> = {
    "Strength & barbell": [],
    "Gymnastics & skill": [],
    "Machines & rope": [],
    "Mixed tests": [],
    Running: [],
    Rowing: [],
    "CrossFit benchmarks": [],
    "Other benchmarks": [],
  }

  for (const workout of workouts) {
    grouped[getBenchmarkWorkoutDomain(workout)].push(workout)
  }

  return BENCHMARK_WORKOUT_DOMAINS.flatMap((domain) => {
    const domainWorkouts = grouped[domain]
    return domainWorkouts.length > 0
      ? [{ domain, workouts: domainWorkouts }]
      : []
  })
}

export function formatBenchmarkResult(
  workout: BenchmarkDirectoryWorkout["workout"],
): string {
  const resultLabel = RESULT_LABELS[workout.scheme]
  return (
    resultLabel ??
    workout.scoreType?.replace(/-/g, " ") ??
    workout.scheme.replace(/-/g, " ")
  )
}

export function filterBenchmarkWorkouts(
  workouts: readonly BenchmarkDirectoryWorkout[],
  query: string,
): BenchmarkDirectoryWorkout[] {
  const normalizedQuery = normalizeBenchmarkText(query)
  if (!normalizedQuery) return [...workouts]
  return workouts.filter((workout) =>
    getWorkoutSearchText(workout).includes(normalizedQuery),
  )
}

function getMovementSummary(workout: BenchmarkDirectoryWorkout): string {
  const movementNames = workout.workout.movements?.map(({ name }) => name) ?? []
  const patternNames =
    movementNames.length > 0
      ? movementNames
      : (workout.workout.tags?.map(({ name }) => name) ?? [])
  if (patternNames.length === 0) {
    return DOMAIN_META[getBenchmarkWorkoutDomain(workout)].short
  }
  if (patternNames.length <= 2) return patternNames.join(" · ")
  return `${patternNames.slice(0, 2).join(" · ")} +${patternNames.length - 2}`
}

function domainId(domain: BenchmarkWorkoutDomain): string {
  return `benchmark-domain-${normalizeBenchmarkText(domain).replace(/\s/g, "-")}`
}

export function BenchmarkWorkoutDirectory({
  slug,
  workouts,
  viewerScores = {},
}: BenchmarkWorkoutDirectoryProps) {
  const allGroups = useMemo(() => groupBenchmarkWorkouts(workouts), [workouts])
  const [query, setQuery] = useState("")
  const [railCollapsed, setRailCollapsed] = useState(false)
  const [currentDomain, setCurrentDomain] =
    useState<BenchmarkWorkoutDomain | null>(allGroups[0]?.domain ?? null)
  const [expandedDomains, setExpandedDomains] = useState(
    () => new Set(allGroups.map(({ domain }) => domain)),
  )
  const searchRef = useRef<HTMLInputElement>(null)
  const sectionRefs = useRef(new Map<BenchmarkWorkoutDomain, HTMLElement>())
  const isMobileRef = useRef<boolean | null>(null)

  const filteredWorkouts = useMemo(
    () => filterBenchmarkWorkouts(workouts, query),
    [query, workouts],
  )
  const visibleGroups = useMemo(
    () => groupBenchmarkWorkouts(filteredWorkouts),
    [filteredWorkouts],
  )
  const hasQuery = normalizeBenchmarkText(query).length > 0
  const activeDomain = visibleGroups.some(
    ({ domain }) => domain === currentDomain,
  )
    ? currentDomain
    : (visibleGroups[0]?.domain ?? null)

  useEffect(() => {
    try {
      setRailCollapsed(window.localStorage.getItem(RAIL_STORAGE_KEY) === "true")
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }, [])

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 720px)")
    const setBreakpointDefaults = (matches: boolean) => {
      if (isMobileRef.current === matches) return
      isMobileRef.current = matches
      setExpandedDomains(
        new Set(
          matches
            ? allGroups.slice(0, 1).map(({ domain }) => domain)
            : allGroups.map(({ domain }) => domain),
        ),
      )
    }
    setBreakpointDefaults(mobileQuery.matches)
    const handleChange = (event: MediaQueryListEvent) =>
      setBreakpointDefaults(event.matches)
    mobileQuery.addEventListener("change", handleChange)
    return () => mobileQuery.removeEventListener("change", handleChange)
  }, [allGroups])

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      (entries) => {
        const nearest = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top) -
              Math.abs(b.boundingClientRect.top),
          )[0]
        if (nearest) {
          setCurrentDomain(
            (nearest.target as HTMLElement).dataset
              .domain as BenchmarkWorkoutDomain,
          )
        }
      },
      { rootMargin: "-10% 0px -75% 0px", threshold: 0 },
    )
    for (const { domain } of visibleGroups) {
      const section = sectionRefs.current.get(domain)
      if (section) observer.observe(section)
    }
    return () => observer.disconnect()
  }, [visibleGroups])

  function toggleRail() {
    const next = !railCollapsed
    setRailCollapsed(next)
    try {
      window.localStorage.setItem(RAIL_STORAGE_KEY, String(next))
    } catch {
      // The UI state remains usable even when persistence is unavailable.
    }
  }

  function clearSearch() {
    setQuery("")
    requestAnimationFrame(() => searchRef.current?.focus())
  }

  function jumpToDomain(domain: BenchmarkWorkoutDomain) {
    setCurrentDomain(domain)
    setExpandedDomains((current) => new Set(current).add(domain))
    sectionRefs.current.get(domain)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    })
  }

  function toggleDomain(domain: BenchmarkWorkoutDomain) {
    if (hasQuery) return
    setExpandedDomains((current) => {
      const next = new Set(current)
      if (next.has(domain)) next.delete(domain)
      else next.add(domain)
      return next
    })
  }

  return (
    <section aria-labelledby="benchmark-directory-heading" className="min-w-0">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h2
            id="benchmark-directory-heading"
            className="text-balance text-xl font-semibold tracking-[-0.02em]"
          >
            Browse the benchmark
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Jump by training domain, then scan each test and your recorded score
            when available.
          </p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <label htmlFor="benchmark-workout-search" className="sr-only">
            Search benchmark workouts
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={searchRef}
            id="benchmark-workout-search"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${workouts.length} workouts`}
            className="h-11 w-full rounded-lg border border-input bg-background px-9 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none [&::-webkit-search-cancel-button]:hidden"
          />
          {hasQuery ? (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear workout search"
              className="absolute right-0 top-0 grid size-11 place-items-center rounded-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "grid min-w-0 items-start transition-[grid-template-columns] duration-200 ease-out motion-reduce:transition-none max-[720px]:block",
          railCollapsed
            ? "grid-cols-[56px_minmax(0,1fr)]"
            : "grid-cols-[190px_minmax(0,1fr)]",
        )}
      >
        <nav
          aria-label="Workout domains"
          className={cn(
            "sticky top-20 grid gap-1 border-r border-border py-3 max-[720px]:top-16 max-[720px]:z-20 max-[720px]:flex max-[720px]:max-w-full max-[720px]:gap-2 max-[720px]:overflow-x-auto max-[720px]:border-b max-[720px]:border-r-0 max-[720px]:bg-background max-[720px]:px-0 max-[720px]:py-3 max-[720px]:[scrollbar-width:none] max-[720px]:[&::-webkit-scrollbar]:hidden",
            railCollapsed ? "px-1.5" : "px-2.5",
          )}
        >
          <button
            type="button"
            onClick={toggleRail}
            aria-expanded={!railCollapsed}
            aria-label={`${railCollapsed ? "Expand" : "Collapse"} domain rail`}
            className="mb-1 grid min-h-11 grid-cols-[24px_minmax(0,1fr)] items-center gap-2 border-b border-border px-2 text-left text-xs font-semibold outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset max-[720px]:hidden"
          >
            {railCollapsed ? (
              <PanelLeftOpen aria-hidden="true" className="size-[18px]" />
            ) : (
              <PanelLeftClose aria-hidden="true" className="size-[18px]" />
            )}
            <span className={cn("truncate", railCollapsed && "sr-only")}>
              Domains
            </span>
          </button>

          {allGroups.map(({ domain, workouts: domainWorkouts }) => {
            const visibleCount =
              visibleGroups.find((group) => group.domain === domain)?.workouts
                .length ?? 0
            if (hasQuery && visibleCount === 0) return null
            const meta = DOMAIN_META[domain]
            return (
              <button
                key={domain}
                type="button"
                onClick={() => jumpToDomain(domain)}
                aria-current={activeDomain === domain ? "true" : undefined}
                aria-label={`${meta.short}, ${visibleCount} workout${visibleCount === 1 ? "" : "s"}`}
                className={cn(
                  "grid min-h-11 items-center gap-2 rounded-lg text-left text-xs font-semibold text-muted-foreground outline-none hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-[current=true]:bg-muted aria-[current=true]:text-foreground aria-[current=true]:ring-1 aria-[current=true]:ring-border aria-[current=true]:ring-inset max-[720px]:flex max-[720px]:shrink-0 max-[720px]:border max-[720px]:border-border max-[720px]:bg-background max-[720px]:px-3",
                  railCollapsed
                    ? "grid-cols-1 justify-items-center px-0"
                    : "grid-cols-[minmax(0,1fr)_auto] px-2.5",
                )}
              >
                <span
                  aria-hidden={railCollapsed}
                  className={cn(
                    "truncate max-[720px]:block",
                    railCollapsed ? "hidden" : "block",
                  )}
                >
                  {meta.short}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "text-sm font-bold max-[720px]:hidden",
                    railCollapsed ? "block" : "hidden",
                  )}
                >
                  {meta.code}
                </span>
                <span
                  className={cn(
                    "text-sm font-bold tabular-nums text-muted-foreground max-[720px]:block",
                    railCollapsed ? "hidden" : "block",
                  )}
                >
                  {hasQuery ? visibleCount : domainWorkouts.length}
                </span>
              </button>
            )
          })}
        </nav>

        <div className="min-w-0 px-5 pb-6 pt-4 max-[720px]:px-0 max-[720px]:pb-2">
          <p
            className="mb-3 text-xs text-muted-foreground"
            aria-live="polite"
            aria-atomic="true"
          >
            <strong className="font-semibold text-foreground">
              {filteredWorkouts.length}
            </strong>{" "}
            workout{filteredWorkouts.length === 1 ? "" : "s"} in{" "}
            {visibleGroups.length} domain{visibleGroups.length === 1 ? "" : "s"}
          </p>

          {visibleGroups.length > 0 ? (
            <div className="grid gap-7 max-[720px]:gap-5">
              {visibleGroups.map(({ domain, workouts: domainWorkouts }) => {
                const meta = DOMAIN_META[domain]
                const expanded = hasQuery || expandedDomains.has(domain)
                const id = domainId(domain)
                return (
                  <section
                    key={domain}
                    id={id}
                    data-domain={domain}
                    ref={(element) => {
                      if (element) sectionRefs.current.set(domain, element)
                      else sectionRefs.current.delete(domain)
                    }}
                    className="scroll-mt-24"
                    aria-labelledby={`${id}-heading`}
                  >
                    <h3 id={`${id}-heading`}>
                      <button
                        type="button"
                        onClick={() => toggleDomain(domain)}
                        aria-expanded={expanded}
                        aria-controls={`${id}-list`}
                        disabled={hasQuery}
                        className="grid min-h-[52px] w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border px-1 pb-2 text-left text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default max-[720px]:min-h-[58px]"
                      >
                        <span className="grid gap-0.5">
                          <strong className="text-lg font-semibold leading-tight tracking-[-0.02em]">
                            {domain}
                          </strong>
                          <span className="text-[11px] text-muted-foreground max-[720px]:hidden">
                            {meta.description}
                          </span>
                        </span>
                        <span className="text-sm font-bold tabular-nums text-muted-foreground">
                          {domainWorkouts.length}
                        </span>
                        <ChevronDown
                          aria-hidden="true"
                          className={cn(
                            "size-[18px] transition-transform duration-200 ease-out motion-reduce:transition-none",
                            !expanded && "-rotate-90",
                            hasQuery && "invisible",
                          )}
                        />
                      </button>
                    </h3>

                    <ul
                      id={`${id}-list`}
                      hidden={!expanded}
                      className="m-0 list-none p-0"
                    >
                      {domainWorkouts.map((workout) => {
                        const score = viewerScores[workout.id]
                        const movementSummary = getMovementSummary(workout)
                        return (
                          <li
                            key={workout.id}
                            className="border-b border-border last:border-b-0"
                          >
                            <Link
                              to="/compete/$slug/workouts/$eventId"
                              params={{ slug, eventId: workout.id }}
                              className="group grid min-h-[54px] grid-cols-[minmax(0,1fr)_78px_80px_64px_28px] items-center gap-2 rounded-sm px-1 text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transition-none max-[720px]:min-h-[58px] max-[720px]:grid-cols-[minmax(0,1fr)_minmax(68px,96px)_28px] max-[720px]:gap-2"
                            >
                              <span className="min-w-0 truncate font-semibold max-[720px]:grid max-[720px]:gap-0.5 max-[720px]:whitespace-normal">
                                <span className="truncate">
                                  {workout.workout.name}
                                </span>
                                <span className="hidden truncate text-[10px] font-normal text-muted-foreground max-[720px]:block">
                                  {movementSummary}
                                </span>
                              </span>
                              <span
                                className="truncate text-[11px] text-muted-foreground max-[720px]:hidden"
                                title={movementSummary}
                              >
                                {movementSummary}
                              </span>
                              {score ? (
                                <span className="grid min-w-0 gap-0.5 tabular-nums max-[720px]:justify-items-end max-[720px]:text-right">
                                  <small className="text-[9px] font-semibold text-muted-foreground">
                                    My score
                                  </small>
                                  <strong className="truncate text-xs font-semibold">
                                    {score.displayScore}
                                  </strong>
                                </span>
                              ) : (
                                <span aria-hidden="true" />
                              )}
                              <span className="truncate text-[11px] tabular-nums text-muted-foreground max-[720px]:hidden">
                                {formatBenchmarkResult(workout.workout)}
                              </span>
                              <ArrowRight
                                aria-hidden="true"
                                className="size-4 justify-self-center text-muted-foreground transition-colors group-hover:text-foreground motion-reduce:transition-none"
                              />
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })}
            </div>
          ) : (
            <div className="grid min-h-40 place-items-center border-y border-border px-4 py-8 text-center">
              <div>
                <h3 className="text-base font-semibold">No workouts found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try a workout name, movement, result format, or tag.
                </p>
                <button
                  type="button"
                  onClick={clearSearch}
                  className="mt-4 min-h-11 rounded-lg border border-border px-4 text-sm font-semibold outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Clear search
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
