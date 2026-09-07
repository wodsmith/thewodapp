import { Heart } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { compareTrainingResults } from "@/lib/training/score-order"
import type {
  TrainingResult,
  TrainingScaling,
  TrainingSession,
} from "@/lib/training/types"
import { setTrainingCheerFn } from "@/server-fns/training-fns"
import { TrainingWorkoutResultDetails } from "./training-workout-result-details"

export function AthleteTeamResults({
  session,
  results,
  userId,
  onCheered,
}: {
  session: TrainingSession
  results: TrainingResult[]
  userId: string
  onCheered: (id: string, cheered: boolean) => void
}) {
  const blocks =
    session.published?.blocks.filter(
      (block) => block.kind !== "note" && block.kind !== "check",
    ) ?? []
  const [blockId, setBlockId] = useState(blocks[0]?.id ?? "")
  const [scaling, setScaling] = useState<TrainingScaling>("rx")
  const [unit, setUnit] = useState<"lb" | "kg">("lb")
  const [ranked, setRanked] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const block = blocks.find((item) => item.id === blockId)
  const canRank = scaling === "rx" && !!block && block.kind !== "check"
  const isLoad = block?.kind === "load" || block?.workout?.scheme === "load"
  const visible = results.filter(
    (result) =>
      result.audience === "gym" &&
      result.sessionId === session.id &&
      result.publishedVersion === session.publishedVersion &&
      result.blockId === blockId &&
      result.scaling === scaling &&
      result.completed &&
      (!isLoad || result.unit === unit),
  )
  const sorted =
    ranked && canRank ? [...visible].sort(compareTrainingResults) : visible
  const participantCount = new Set(
    results
      .filter(
        (result) =>
          result.audience === "gym" &&
          result.sessionId === session.id &&
          result.publishedVersion === session.publishedVersion &&
          result.completed,
      )
      .map((result) => result.userId),
  ).size

  async function cheer(result: TrainingResult) {
    setPending(result.id)
    setError(null)
    try {
      await setTrainingCheerFn({
        data: { resultId: result.id, cheered: !result.hasCheered },
      })
      onCheered(result.id, !result.hasCheered)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save your encouragement. Try again.",
      )
    } finally {
      setPending(null)
    }
  }

  return (
    <section className="space-y-6" aria-labelledby="team-results-title">
      <div>
        <h2 id="team-results-title" className="text-3xl font-semibold">
          A shared effort.
        </h2>
        <p className="mt-2 text-muted-foreground">
          {participantCount === 0
            ? "No members have shared a result for this session yet."
            : `${participantCount} ${participantCount === 1 ? "member has" : "members have"} shared results for this session.`}{" "}
          Private results stay private.
        </p>
      </div>
      {blocks.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="team-result-section">Section</Label>
              <select
                id="team-result-section"
                className="min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3"
                value={blockId}
                onChange={(event) => setBlockId(event.target.value)}
              >
                {blocks.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>
            {block?.kind !== "check" ? (
              <div className="space-y-2">
                <Label htmlFor="team-result-scaling">Scaling</Label>
                <select
                  id="team-result-scaling"
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3"
                  value={scaling}
                  onChange={(event) =>
                    setScaling(event.target.value as TrainingScaling)
                  }
                >
                  <option value="rx">Rx</option>
                  <option value="scaled">Scaled</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            ) : null}
            {isLoad ? (
              <div className="space-y-2">
                <Label htmlFor="team-result-unit">Unit</Label>
                <select
                  id="team-result-unit"
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3"
                  value={unit}
                  onChange={(event) =>
                    setUnit(event.target.value as "lb" | "kg")
                  }
                >
                  <option value="lb">lb</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">
              {scaling !== "rx" && block?.kind !== "check"
                ? "Modifications differ, so these results are unranked."
                : "Results for this section and published version."}
            </p>
            {canRank ? (
              <Button
                variant="outline"
                className="min-h-11"
                aria-pressed={ranked}
                onClick={() => setRanked((value) => !value)}
              >
                {ranked ? "Show shared results" : "Show rankings"}
              </Button>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {sorted.length === 0 ? (
            <p className="border-t border-border py-8 text-muted-foreground">
              No shared results match these filters.
            </p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {sorted.map((result) => {
                const rank =
                  sorted.findIndex(
                    (item) => compareTrainingResults(item, result) === 0,
                  ) + 1
                return (
                  <li
                    key={result.id}
                    className="flex min-w-0 items-start gap-3 py-5"
                  >
                    {ranked && canRank ? (
                      <span className="w-6 shrink-0 pt-1 text-sm tabular-nums text-muted-foreground">
                        <span className="sr-only">Rank </span>
                        {rank}
                      </span>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-medium">
                        {result.userName}
                        {result.userId === userId ? " (you)" : ""}
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {result.displayScore}
                        {block?.kind === "load" ? ` ${result.unit}` : ""}
                      </p>
                      <TrainingWorkoutResultDetails details={result.details} />
                      {result.modification ? (
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                          {result.modification}
                        </p>
                      ) : null}
                    </div>
                    {result.userId !== userId ? (
                      <Button
                        variant="ghost"
                        className="min-h-11 shrink-0 gap-2"
                        disabled={pending !== null}
                        aria-pressed={result.hasCheered}
                        aria-label={`${result.hasCheered ? "Remove encouragement for" : "Encourage"} ${result.userName}; ${result.cheerCount} cheers`}
                        onClick={() => cheer(result)}
                      >
                        <Heart
                          className={`h-4 w-4 ${result.hasCheered ? "fill-current text-primary" : ""}`}
                          aria-hidden="true"
                        />
                        <span className="tabular-nums">
                          {result.cheerCount}
                        </span>
                      </Button>
                    ) : (
                      <span className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
                        <Heart className="h-4 w-4" aria-hidden="true" />
                        {result.cheerCount}
                        <span className="sr-only"> cheers</span>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      ) : (
        <p className="border-t border-border py-8 text-muted-foreground">
          This session has no result sections.
        </p>
      )}
    </section>
  )
}
