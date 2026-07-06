"use client"

import { Link } from "@tanstack/react-router"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  MinusCircle,
} from "lucide-react"
import { useCallback, useState } from "react"
import { VideoSubmissionForm } from "@/components/compete/video-submission-form"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import type { CompetitionLeaderboardEntry } from "@/server-fns/leaderboard-fns"
import {
  getVideoSubmissionFn,
  type VideoSubmissionResult,
} from "@/server-fns/video-submission-fns"

interface BenchmarkTestSubmissionContext {
  competitionId: string
  slug: string
  divisionId: string
  divisionLabel: string
  timezone?: string | null
  onSubmitSuccess: () => void
}

interface BenchmarkStatLineProps {
  entry: CompetitionLeaderboardEntry
  /**
   * When provided, each test row becomes an expandable score-submission
   * dropdown. Only supplied for the viewer's own entry on competitions that
   * support video submissions.
   */
  submission?: BenchmarkTestSubmissionContext
}

type TestState =
  | "unavailable"
  | "excluded"
  | "untested"
  | "pending"
  | "verified"
  | "adjusted"
  | "penalized"
  | "tier_0"
  | "logged"

const stateLabels: Record<TestState, string> = {
  unavailable: "Unavailable",
  excluded: "Excluded",
  untested: "Untested",
  pending: "Pending",
  verified: "Verified",
  adjusted: "Adjusted",
  penalized: "Penalized",
  tier_0: "Tier 0",
  logged: "Logged",
}

function formatBenchmarkNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function getTestState(
  result: CompetitionLeaderboardEntry["eventResults"][number],
): TestState {
  const reviewStatus = result.reviewSummary?.worstStatus ?? null

  if (result.benchmarkIncludedInScoring === false) return "unavailable"
  if (result.verificationStatus === "invalid" || reviewStatus === "invalid") {
    return "excluded"
  }
  if (result.rawScore === null) return "untested"
  if (reviewStatus === "pending" || reviewStatus === "under_review") {
    return "pending"
  }
  if (result.penaltyType || reviewStatus === "penalized") return "penalized"
  if (
    result.isDirectlyModified ||
    result.verificationStatus === "adjusted" ||
    reviewStatus === "adjusted"
  ) {
    return "adjusted"
  }
  if (result.verificationStatus === "verified" || reviewStatus === "verified") {
    return "verified"
  }
  if (result.benchmarkTier === 0) return "tier_0"
  return "logged"
}

function StateBadge({ state }: { state: TestState }) {
  const Icon =
    state === "verified"
      ? CheckCircle2
      : state === "pending"
        ? Clock
        : state === "untested" || state === "unavailable"
          ? MinusCircle
          : AlertTriangle

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium",
        state === "verified" && "border-emerald-500/30 text-emerald-700",
        state === "pending" && "border-blue-500/30 text-blue-700",
        (state === "untested" || state === "unavailable") &&
          "border-border text-muted-foreground",
        (state === "adjusted" ||
          state === "penalized" ||
          state === "excluded" ||
          state === "tier_0") &&
          "border-amber-500/30 text-amber-700",
      )}
    >
      <Icon className="h-3 w-3" />
      {stateLabels[state]}
    </span>
  )
}

export function BenchmarkStatLine({
  entry,
  submission,
}: BenchmarkStatLineProps) {
  const overall = entry.benchmarkOverallScore ?? entry.totalPoints
  const tests = [...entry.eventResults].sort(
    (a, b) => a.trackOrder - b.trackOrder,
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_1fr]">
        <div className="rounded-md border bg-background p-4">
          <div className="text-sm font-medium text-muted-foreground">
            Overall
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-5xl font-semibold tracking-normal tabular-nums">
              {formatBenchmarkNumber(overall)}
            </span>
            <span className="pb-2 text-sm text-muted-foreground">/100</span>
          </div>
          {entry.benchmarkRatingBand ? (
            <Badge variant="secondary" className="mt-4">
              {entry.benchmarkRatingBand.label}
            </Badge>
          ) : null}
        </div>

        <div className="rounded-md border bg-background p-4">
          <div className="mb-3 text-sm font-medium text-muted-foreground">
            Categories
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {entry.benchmarkCategoryScores.map((category) => (
              <div key={category.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">
                    {category.label ?? category.key}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatBenchmarkNumber(category.score)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-sm bg-muted">
                  <div
                    className="h-full rounded-sm bg-primary"
                    style={{
                      width: `${Math.max(0, Math.min(100, category.score))}%`,
                    }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {formatBenchmarkNumber(category.tierSum)} tier points across{" "}
                  {category.testCount} tests
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border bg-background">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Test Grid</h2>
        </div>
        <div className="divide-y">
          {tests.map((result) => (
            <TestRow
              key={result.trackWorkoutId}
              result={result}
              submission={submission}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function TestRow({
  result,
  submission,
}: {
  result: CompetitionLeaderboardEntry["eventResults"][number]
  submission?: BenchmarkTestSubmissionContext
}) {
  const state = getTestState(result)
  // Deferred tests (excluded from scoring) reject submissions server-side, so
  // their rows stay read-only instead of offering a form that can only fail.
  const submittable = state === "unavailable" ? undefined : submission
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState<VideoSubmissionResult | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState(false)

  const competitionId = submittable?.competitionId
  const divisionId = submittable?.divisionId

  const loadFormData = useCallback(() => {
    if (!competitionId || !divisionId) return
    setFormLoading(true)
    setFormError(false)
    getVideoSubmissionFn({
      data: {
        trackWorkoutId: result.trackWorkoutId,
        competitionId,
        divisionId,
      },
    })
      .then(setFormData)
      .catch(() => setFormError(true))
      .finally(() => setFormLoading(false))
  }, [result.trackWorkoutId, competitionId, divisionId])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next && !formData && !formLoading) {
      loadFormData()
    }
  }

  const cells = (
    <>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{result.eventName}</div>
        <div className="text-xs text-muted-foreground">
          {result.benchmarkCategoryLabel ?? "Benchmark"}
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Score</div>
        <div className="text-sm tabular-nums">
          {result.rawScore === null ? "-" : result.formattedScore}
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Tier</div>
        <div className="text-sm tabular-nums">
          {result.benchmarkTier === null
            ? "-"
            : formatBenchmarkNumber(result.benchmarkTier)}
        </div>
      </div>
      <div className="flex items-center gap-2 sm:justify-end">
        <StateBadge state={state} />
        {submittable ? (
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        ) : null}
      </div>
    </>
  )

  if (!submittable) {
    return (
      <div className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_8rem]">
        {cells}
      </div>
    )
  }

  const linkEventId = result.parentEventId ?? result.trackWorkoutId

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="grid w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_8rem]"
        >
          {cells}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 border-t bg-muted/20 px-4 py-3">
          {formLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span className="text-sm">Loading submission form...</span>
            </div>
          ) : formError ? (
            <div className="py-4 text-center">
              <p className="text-sm text-destructive">
                Failed to load the submission form.
              </p>
              <button
                type="button"
                onClick={loadFormData}
                className="mt-1 text-xs text-primary underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          ) : formData ? (
            <VideoSubmissionForm
              trackWorkoutId={result.trackWorkoutId}
              competitionId={submittable.competitionId}
              timezone={submittable.timezone}
              registeredDivisions={[
                {
                  divisionId: submittable.divisionId,
                  label: submittable.divisionLabel,
                },
              ]}
              initialData={formData}
              initialDivisionId={submittable.divisionId}
              onSubmitSuccess={submittable.onSubmitSuccess}
            />
          ) : null}
          <Link
            to="/compete/$slug/workouts/$eventId"
            params={{ slug: submittable.slug, eventId: linkEventId }}
            search={{ division: submittable.divisionId }}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View full workout
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
