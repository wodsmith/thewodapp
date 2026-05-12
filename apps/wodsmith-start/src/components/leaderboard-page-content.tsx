"use client"

import { useNavigate, useSearch } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { BarChart3, Eye, EyeOff } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  getStatusConfig,
  reviewStatusOrder,
} from "@/components/compete/submission-status-badge"
import { CompetitionLeaderboardTable } from "@/components/competition-leaderboard-table"
import { OnlineCompetitionLeaderboardTable } from "@/components/online-competition-leaderboard-table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { WorkoutPreview } from "@/components/workout-preview"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import {
  type DivisionDescription,
  getPublicEventDetailsFn,
  getWorkoutDivisionDescriptionsFn,
} from "@/server-fns/competition-workouts-fns"
import {
  type CompetitionLeaderboardEntry,
  getCompetitionLeaderboardFn,
} from "@/server-fns/leaderboard-fns"
import type { ScoringAlgorithm } from "@/types/scoring"

interface LeaderboardDivision {
  id: string
  label: string
}

interface LeaderboardCompetitionInfo {
  slug: string
  competitionType: "in-person" | "online"
}

/**
 * Props for the LeaderboardPageContent component
 */
interface LeaderboardPageContentProps {
  competitionId: string
  /** Divisions available for filtering. Required. */
  divisions: LeaderboardDivision[] | null | undefined
  /** Competition info needed for URL generation and table selection. */
  competition: LeaderboardCompetitionInfo
  /**
   * Preview mode: request the leaderboard with the publication filter
   * bypassed so organizers see unpublished results. Caller is responsible
   * for routing this only to authorized organizer views.
   */
  preview?: boolean
  /**
   * Pre-fetched leaderboard data from a route loader. When provided AND its
   * divisionId matches the URL-selected division, the initial client fetch
   * is skipped — the SSR'd data is used directly. Subsequent division
   * changes still re-trigger the client fetch path.
   */
  initialData?: {
    entries: CompetitionLeaderboardEntry[]
    scoringAlgorithm: ScoringAlgorithm
    divisionId: string
  } | null
}

/**
 * Legend for the review-status badges shown on the organizer-preview
 * leaderboard. Mirrors the icon + color config from `ReviewStatusIndicator`
 * in [[online-competition-leaderboard-table.tsx]] so organizers can decode
 * the inline cell badges at a glance.
 */
function ReviewStatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
      <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
        Review
        <span
          aria-hidden
          className="h-px w-6 bg-border"
        />
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {reviewStatusOrder.map((status) => {
          const config = getStatusConfig(status)
          const Icon = config.icon
          return (
            <span
              key={status}
              title={config.description}
              className={cn(
                "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-medium tabular-nums",
                config.className,
              )}
            >
              <Icon className={cn("h-3 w-3", config.iconClassName)} />
              {config.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Competition Leaderboard Page Content
 *
 * Displays competition leaderboard with configurable scoring support.
 * Supports Traditional, P-Score, and Custom scoring algorithms.
 */
export function LeaderboardPageContent({
  competitionId,
  divisions,
  competition,
  preview = false,
  initialData = null,
}: LeaderboardPageContentProps) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  // Get search params from URL - using strict: false since we're in a child component
  const searchParams = useSearch({ strict: false }) as {
    division?: string
    event?: string
    affiliate?: string
  }

  // Default to first division if available
  const defaultDivision = divisions?.[0]?.id ?? ""

  // URL state for shareable leaderboard views
  const selectedDivision = searchParams.division ?? defaultDivision
  const selectedEventId = searchParams.event ?? null
  const selectedAffiliate = searchParams.affiliate ?? "all"

  const initialMatchesSelected =
    initialData != null && initialData.divisionId === selectedDivision
  const [leaderboard, setLeaderboard] = useState<CompetitionLeaderboardEntry[]>(
    initialMatchesSelected ? initialData.entries : [],
  )
  const [scoringAlgorithm, setScoringAlgorithm] = useState<ScoringAlgorithm>(
    initialMatchesSelected ? initialData.scoringAlgorithm : "traditional",
  )
  const [isLoading, setIsLoading] = useState(!initialMatchesSelected)
  const [error, setError] = useState<string | null>(null)

  // Sync state when the loader hands us a new initialData payload
  // (e.g. division changed via URL navigation, loader re-ran)
  useEffect(() => {
    if (initialData && initialData.divisionId === selectedDivision) {
      setLeaderboard(initialData.entries)
      setScoringAlgorithm(initialData.scoringAlgorithm)
      setIsLoading(false)
      setError(null)
    }
  }, [initialData, selectedDivision])

  // Workout preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState<{
    name: string
    description: string | null
    scheme: string
    timeCap: number | null
    movements: Array<{ id: string; name: string }>
    tags: Array<{ id: string; name: string }>
    workoutId: string
    divisionDescriptions: DivisionDescription[]
  } | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const previewCache = useRef(
    new Map<
      string,
      {
        name: string
        description: string | null
        scheme: string
        timeCap: number | null
        movements: Array<{ id: string; name: string }>
        tags: Array<{ id: string; name: string }>
        workoutId: string
        divisionDescriptions: DivisionDescription[]
      }
    >(),
  )
  const getEventDetails = useServerFn(getPublicEventDetailsFn)
  const getDivisionDescriptions = useServerFn(getWorkoutDivisionDescriptionsFn)

  // Extract events from leaderboard data — must be before effectiveEventId and preview hooks
  const events = useMemo(() => {
    if (leaderboard.length === 0) return []

    const firstEntry = leaderboard[0]
    if (!firstEntry) return []

    return firstEntry.eventResults
      .map((r) => ({
        id: r.trackWorkoutId,
        name: r.eventName,
        trackOrder: r.trackOrder,
        scheme: r.scheme,
        parentEventId: r.parentEventId,
        parentEventName: r.parentEventName,
      }))
      .sort((a, b) => a.trackOrder - b.trackOrder)
  }, [leaderboard])

  // Validate selectedEventId against division-filtered events to prevent stale URL params.
  // When event-division mappings exist, the server only returns events mapped to
  // the selected division. If the URL has an event ID that's not in the filtered list
  // (e.g. shared link across divisions), fall back to overall view.
  const effectiveEventId = useMemo(() => {
    if (!selectedEventId) return null
    return events.some((e) => e.id === selectedEventId) ? selectedEventId : null
  }, [selectedEventId, events])

  // Close preview when effective event changes (includes division-filtered invalidation)
  // biome-ignore lint/correctness/useExhaustiveDependencies: effectiveEventId triggers reset intentionally
  useEffect(() => {
    setIsPreviewOpen(false)
    setPreviewData(null)
    setPreviewError(null)
  }, [effectiveEventId])

  const handleTogglePreview = useCallback(async () => {
    if (isPreviewOpen) {
      setIsPreviewOpen(false)
      return
    }

    if (!effectiveEventId) return

    // Check cache first
    const cached = previewCache.current.get(effectiveEventId)
    if (cached) {
      setPreviewData(cached)
      setIsPreviewOpen(true)
      return
    }

    // Fetch workout details
    setIsPreviewLoading(true)
    setPreviewError(null)
    setIsPreviewOpen(true)

    try {
      const result = await getEventDetails({
        data: {
          eventId: effectiveEventId,
          competitionId,
        },
      })

      if (result.event) {
        // Fetch division descriptions in parallel if divisions exist
        const divisionIds = divisions?.map((d) => d.id) ?? []
        let divisionDescriptions: DivisionDescription[] = []

        if (divisionIds.length > 0) {
          const descResult = await getDivisionDescriptions({
            data: {
              workoutId: result.event.workout.id,
              divisionIds,
            },
          })
          divisionDescriptions = descResult.descriptions
        }

        const data = {
          name: result.event.workout.name,
          description: result.event.workout.description,
          scheme: result.event.workout.scheme,
          timeCap: result.event.workout.timeCap,
          movements: result.event.workout.movements ?? [],
          tags: result.event.workout.tags ?? [],
          workoutId: result.event.workout.id,
          divisionDescriptions,
        }
        previewCache.current.set(effectiveEventId, data)
        setPreviewData(data)
      } else {
        setPreviewError("Workout details not found.")
      }
    } catch {
      setPreviewError("Failed to load workout details.")
    } finally {
      setIsPreviewLoading(false)
    }
  }, [
    isPreviewOpen,
    effectiveEventId,
    competitionId,
    divisions,
    getEventDetails,
    getDivisionDescriptions,
  ])

  // Server function for fetching leaderboard
  const getLeaderboard = useServerFn(getCompetitionLeaderboardFn)

  // Fetch leaderboard when division changes
  useEffect(() => {
    let cancelled = false

    async function fetchLeaderboard() {
      if (!selectedDivision) {
        setIsLoading(false)
        return
      }

      // SSR'd loader data already covers this division — no client fetch needed
      if (initialData && initialData.divisionId === selectedDivision) {
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const result = await getLeaderboard({
          data: {
            competitionId,
            divisionId: selectedDivision,
            preview,
          },
        })

        if (!cancelled) {
          setLeaderboard(result.entries)
          setScoringAlgorithm(result.scoringAlgorithm)
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch leaderboard:", err)
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load leaderboard. Please try again.",
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchLeaderboard()

    return () => {
      cancelled = true
    }
  }, [competitionId, selectedDivision, getLeaderboard, preview, initialData])

  // Handle division change - update URL
  const handleDivisionChange = useCallback(
    (divisionId: string) => {
      navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          division: divisionId,
          // Reset event and affiliate when changing divisions
          event: undefined,
          affiliate: undefined,
        }),
        replace: true,
      })
    },
    [navigate],
  )

  // Handle event change - update URL
  const handleEventChange = useCallback(
    (value: string) => {
      navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          event: value === "overall" ? undefined : value,
        }),
        replace: true,
      })
    },
    [navigate],
  )

  // Extract unique affiliates for filter dropdown
  const affiliates = useMemo(() => {
    const affiliateSet = new Set<string>()
    for (const entry of leaderboard) {
      if (entry.affiliate) {
        affiliateSet.add(entry.affiliate)
      }
    }
    return Array.from(affiliateSet).sort()
  }, [leaderboard])

  // Validate selectedAffiliate against known affiliates to prevent stale URL params
  const effectiveAffiliate = useMemo(() => {
    if (selectedAffiliate === "all") return "all"
    return affiliates.includes(selectedAffiliate) ? selectedAffiliate : "all"
  }, [selectedAffiliate, affiliates])

  // Filter leaderboard by selected affiliate
  const filteredLeaderboard = useMemo(() => {
    if (effectiveAffiliate === "all") return leaderboard
    return leaderboard.filter((entry) => entry.affiliate === effectiveAffiliate)
  }, [leaderboard, effectiveAffiliate])

  // Handle affiliate change - update URL
  const handleAffiliateChange = useCallback(
    (value: string) => {
      navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          affiliate: value === "all" ? undefined : value,
        }),
        replace: true,
      })
    },
    [navigate],
  )

  // Derive division-specific description for preview
  const selectedDivisionDesc = useMemo(() => {
    if (!previewData?.divisionDescriptions || !selectedDivision) return null
    return (
      previewData.divisionDescriptions.find(
        (d) => d.divisionId === selectedDivision,
      ) ?? null
    )
  }, [previewData?.divisionDescriptions, selectedDivision])

  // Loading state - initial load
  if (isLoading && leaderboard.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Leaderboard</h2>
        <div className="space-y-4">
          <div className="flex gap-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-48" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Leaderboard</h2>

        {/* Division selector even on error */}
        {divisions && divisions.length > 1 && (
          <div className="mb-6">
            <Select
              value={selectedDivision}
              onValueChange={handleDivisionChange}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select division" />
              </SelectTrigger>
              <SelectContent>
                {divisions.map((division) => (
                  <SelectItem key={division.id} value={division.id}>
                    {division.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Alert variant="destructive">
          <BarChart3 className="h-4 w-4" />
          <AlertTitle>Error loading leaderboard</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  // Empty state - no results yet
  if (leaderboard.length === 0 && !isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Leaderboard</h2>

        {/* Division selector even when empty */}
        {divisions && divisions.length > 1 && (
          <div className="mb-6">
            <Select
              value={selectedDivision}
              onValueChange={handleDivisionChange}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select division" />
              </SelectTrigger>
              <SelectContent>
                {divisions.map((division) => (
                  <SelectItem key={division.id} value={division.id}>
                    {division.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Alert variant="default" className="border-dashed">
          <BarChart3 className="h-4 w-4" />
          <AlertTitle>Leaderboard not yet available</AlertTitle>
          <AlertDescription>
            Results and rankings will appear here once athletes start submitting
            scores.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold">Leaderboard</h2>

        <div className="flex flex-wrap items-center gap-4">
          {/* Division selector */}
          {divisions && divisions.length > 1 && (
            <Select
              value={selectedDivision}
              onValueChange={handleDivisionChange}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select division" />
              </SelectTrigger>
              <SelectContent>
                {divisions.map((division) => (
                  <SelectItem key={division.id} value={division.id}>
                    {division.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* View selector (Overall vs individual events) */}
          {events.length > 0 && (
            <Select
              value={effectiveEventId ?? "overall"}
              onValueChange={handleEventChange}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overall">Overall</SelectItem>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Affiliate filter */}
          {(affiliates.length > 0 || effectiveAffiliate !== "all") && (
            <Select
              value={effectiveAffiliate}
              onValueChange={handleAffiliateChange}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Affiliate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Affiliates</SelectItem>
                {affiliates.map((affiliate) => (
                  <SelectItem key={affiliate} value={affiliate}>
                    {affiliate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* View Workout button */}
          {effectiveEventId && (
            <Button variant="outline" size="sm" onClick={handleTogglePreview}>
              {isPreviewOpen ? (
                <EyeOff className="h-4 w-4 mr-1.5" />
              ) : (
                <Eye className="h-4 w-4 mr-1.5" />
              )}
              {isPreviewOpen ? "Hide Workout" : "View Workout"}
            </Button>
          )}

          {/* Loading indicator for background refetches */}
          {isLoading && leaderboard.length > 0 && (
            <span className="text-sm text-muted-foreground animate-pulse">
              Updating...
            </span>
          )}
        </div>

        {/* Review-status legend (organizer preview, online only) */}
        {preview && competition.competitionType === "online" && (
          <ReviewStatusLegend />
        )}
      </div>

      {/* Desktop: Collapsible workout preview */}
      {effectiveEventId && !isMobile && (
        <Collapsible open={isPreviewOpen}>
          <CollapsibleContent>
            {previewError ? (
              <div className="p-4 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
                {previewError}
              </div>
            ) : (
              <WorkoutPreview
                name={previewData?.name ?? ""}
                description={previewData?.description ?? null}
                scheme={previewData?.scheme ?? ""}
                timeCap={previewData?.timeCap ?? null}
                movements={previewData?.movements ?? []}
                tags={previewData?.tags ?? []}
                eventDetailUrl={{
                  slug: competition.slug,
                  eventId: effectiveEventId,
                }}
                isLoading={isPreviewLoading}
                divisionScale={selectedDivisionDesc?.description}
                divisionLabel={selectedDivisionDesc?.divisionLabel}
              />
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="rounded-md border">
        {competition.competitionType === "online" ? (
          <OnlineCompetitionLeaderboardTable
            leaderboard={filteredLeaderboard}
            events={events}
            selectedEventId={effectiveEventId}
            scoringAlgorithm={scoringAlgorithm}
            linkToSubmission={preview}
            competitionId={competitionId}
          />
        ) : (
          <CompetitionLeaderboardTable
            leaderboard={filteredLeaderboard}
            events={events}
            selectedEventId={effectiveEventId}
            scoringAlgorithm={scoringAlgorithm}
            preview={preview}
          />
        )}
      </div>

      {/* Mobile: Bottom Sheet workout preview */}
      {effectiveEventId && isMobile && (
        <Sheet open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[70vh] overflow-y-auto rounded-t-2xl"
          >
            <SheetHeader>
              <SheetTitle>Workout Details</SheetTitle>
            </SheetHeader>
            {previewError ? (
              <div className="p-4 text-sm text-muted-foreground">
                {previewError}
              </div>
            ) : (
              <WorkoutPreview
                name={previewData?.name ?? ""}
                description={previewData?.description ?? null}
                scheme={previewData?.scheme ?? ""}
                timeCap={previewData?.timeCap ?? null}
                movements={previewData?.movements ?? []}
                tags={previewData?.tags ?? []}
                eventDetailUrl={{
                  slug: competition.slug,
                  eventId: effectiveEventId,
                }}
                isLoading={isPreviewLoading}
                divisionScale={selectedDivisionDesc?.description}
                divisionLabel={selectedDivisionDesc?.divisionLabel}
              />
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
