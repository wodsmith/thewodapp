"use client"

import { AlertTriangle, CheckCircle2, Clock, MinusCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { CompetitionLeaderboardEntry } from "@/server-fns/leaderboard-fns"

interface BenchmarkStatLineProps {
  entry: CompetitionLeaderboardEntry
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

export function BenchmarkStatLine({ entry }: BenchmarkStatLineProps) {
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
          {tests.map((result) => {
            const state = getTestState(result)
            return (
              <div
                key={result.trackWorkoutId}
                className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_8rem]"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {result.eventName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {result.benchmarkCategoryLabel ?? "Benchmark"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">
                    Score
                  </div>
                  <div className="text-sm tabular-nums">
                    {result.rawScore === null ? "-" : result.formattedScore}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">
                    Tier
                  </div>
                  <div className="text-sm tabular-nums">
                    {result.benchmarkTier === null
                      ? "-"
                      : formatBenchmarkNumber(result.benchmarkTier)}
                  </div>
                </div>
                <div className="flex items-center sm:justify-end">
                  <StateBadge state={state} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
