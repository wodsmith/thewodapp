"use client"

import { useNavigate, useSearch } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { BarChart3 } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { SeriesLeaderboardTable } from "@/components/series-leaderboard-table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getSeriesLeaderboardFn,
  type SeriesLeaderboardEntry,
} from "@/server-fns/series-leaderboard-fns"
import type { ScoringAlgorithm } from "@/types/scoring"

interface Props {
  groupId: string
}

export function SeriesLeaderboardPageContent({ groupId }: Props) {
  const navigate = useNavigate()
  const searchParams = useSearch({ strict: false }) as { division?: string }

  const [entries, setEntries] = useState<SeriesLeaderboardEntry[]>([])
  const [seriesEvents, setSeriesEvents] = useState<
    Array<{ workoutId: string; name: string; scheme: string }>
  >([])
  const [availableDivisions, setAvailableDivisions] = useState<
    Array<{ id: string; label: string }>
  >([])
  const [unmappedCompetitions, setUnmappedCompetitions] = useState<
    Array<{ id: string; name: string }>
  >([])
  const [scoringAlgorithm, setScoringAlgorithm] =
    useState<ScoringAlgorithm>("traditional")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const selectedDivision = searchParams.division ?? ""

  const getLeaderboard = useServerFn(getSeriesLeaderboardFn)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    getLeaderboard({
      data: {
        groupId,
        divisionId: selectedDivision || undefined,
      },
    })
      .then((result) => {
        if (cancelled) return
        setEntries(result.entries)
        setSeriesEvents(result.seriesEvents)
        setAvailableDivisions(result.availableDivisions)
        setUnmappedCompetitions(result.unmappedCompetitions)
        setScoringAlgorithm(result.scoringConfig.algorithm)
      })
      .catch((err) => {
        if (cancelled) return
        setError(
          err instanceof Error ? err.message : "Failed to load leaderboard",
        )
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [groupId, selectedDivision, getLeaderboard])

  const handleDivisionChange = useCallback(
    (divisionId: string) => {
      const resolved = divisionId === "__all__" ? "" : divisionId
      navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          division: resolved || undefined,
        }),
        replace: true,
      })
    },
    [navigate],
  )

  // Filter entries for selected division
  const filteredEntries = useMemo(() => {
    if (!selectedDivision) return entries
    return entries.filter((e) => e.divisionId === selectedDivision)
  }, [entries, selectedDivision])

  if (isLoading && entries.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Global Leaderboard</h2>
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Global Leaderboard</h2>
        <Alert variant="destructive">
          <BarChart3 className="h-4 w-4" />
          <AlertTitle>Error loading leaderboard</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold">Global Leaderboard</h2>

        {/* Unmapped competitions warning */}
        {unmappedCompetitions.length > 0 && (
          <Alert variant="default" className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
            <BarChart3 className="h-4 w-4 text-orange-600" />
            <AlertTitle className="text-orange-700 dark:text-orange-400">
              Competitions not included
            </AlertTitle>
            <AlertDescription>
              {unmappedCompetitions.length === 1
                ? `"${unmappedCompetitions[0].name}" is`
                : `${unmappedCompetitions.length} competitions are`}{" "}
              not included in the leaderboard because their divisions haven't
              been matched to the series yet. Set this up on the series
              Configure Divisions page.
            </AlertDescription>
          </Alert>
        )}

        {/* Division selector */}
        {availableDivisions.length > 1 && (
          <div className="flex items-center gap-4">
            <Select
              value={selectedDivision || "__all__"}
              onValueChange={handleDivisionChange}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Divisions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Divisions</SelectItem>
                {availableDivisions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isLoading && entries.length > 0 && (
              <span className="text-sm text-muted-foreground animate-pulse">
                Updating...
              </span>
            )}
          </div>
        )}
      </div>

      {filteredEntries.length === 0 && !isLoading ? (
        <Alert variant="default" className="border-dashed">
          <BarChart3 className="h-4 w-4" />
          <AlertTitle>No results yet</AlertTitle>
          <AlertDescription>
            No rankings yet. Make sure divisions are matched and athletes
            have submitted scores.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="rounded-md border">
          <SeriesLeaderboardTable
            entries={filteredEntries}
            seriesEvents={seriesEvents}
            scoringAlgorithm={scoringAlgorithm}
          />
        </div>
      )}
    </div>
  )
}
