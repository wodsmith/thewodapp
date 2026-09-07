import { Check } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type {
  OwnTrainingResult,
  SaveTrainingResultInput,
  TrainingBlock,
  TrainingSession,
} from "@/lib/training/types"
import { trainingWorkoutSummary } from "@/lib/training/workout-display"
import { saveTrainingResultFn } from "@/server-fns/training-fns"
import { TrainingResultDialog } from "./training-result-dialog"
import { TrainingWorkoutResultDetails } from "./training-workout-result-details"

export function AthleteSessionBlock({
  session,
  block,
  index,
  trackName,
  gymName,
  result,
  readOnlyMessage,
  onSaved,
  privateOnly = false,
  saveResult = (data) => saveTrainingResultFn({ data }),
}: {
  session: TrainingSession
  block: TrainingBlock
  index: number
  trackName: string
  gymName: string
  result?: OwnTrainingResult
  readOnlyMessage?: string
  privateOnly?: boolean
  saveResult?: (input: SaveTrainingResultInput) => Promise<OwnTrainingResult>
  onSaved: (result: OwnTrainingResult) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggleCompletion() {
    setSaving(true)
    setError(null)
    try {
      onSaved(
        await saveResult({
          sessionId: session.id,
          blockId: block.id,
          publishedVersion: session.publishedVersion,
          score: "",
          scaling: result?.scaling ?? "rx",
          modification: result?.modification ?? "",
          notes: result?.notes ?? "",
          audience: result?.audience ?? "private",
          unit: result?.unit ?? "lb",
          completed: !result?.completed,
        }),
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save completion. Try again.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="min-w-0 border-t border-border py-7 sm:py-8">
      <div className="flex items-baseline gap-3">
        <span
          className="text-sm tabular-nums text-muted-foreground"
          aria-hidden="true"
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <h3 className="min-w-0 break-words text-xl font-semibold sm:text-2xl">
          {block.title}
        </h3>
        {result?.completed ? (
          <span className="ml-auto flex shrink-0 items-center gap-1 text-sm">
            <Check className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Saved</span>
          </span>
        ) : null}
      </div>
      <div className="mt-4 space-y-4 sm:pl-8">
        <p className="max-w-prose whitespace-pre-wrap break-words leading-relaxed">
          {block.prescription}
        </p>
        {block.kind === "workout" && block.workout ? (
          <p className="text-sm text-muted-foreground">
            {trainingWorkoutSummary(block.workout)}
          </p>
        ) : null}
        {block.coachGuidance ? (
          <p className="max-w-prose whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">
              Coach's guidance:{" "}
            </span>
            {block.coachGuidance}
          </p>
        ) : null}
        {block.scalingGuidance ? (
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-3 font-medium">
              Scaling options
            </summary>
            <p className="max-w-prose whitespace-pre-wrap break-words pb-3 leading-relaxed text-muted-foreground">
              {block.scalingGuidance}
            </p>
          </details>
        ) : null}
        {block.kind !== "note" ? (
          <div className="space-y-3">
            {result ? (
              <div aria-live="polite" className="text-sm">
                <p className="font-semibold">
                  {block.kind === "check"
                    ? result.completed
                      ? "Completed"
                      : "Not completed"
                    : `${result.displayScore}${block.kind === "load" ? ` ${result.unit}` : ""}`}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {block.kind === "check"
                      ? ""
                      : result.scaling === "rx"
                        ? "Rx · "
                        : `${result.scaling === "custom" ? "Custom" : "Scaled"} · `}
                    {result.audience === "private"
                      ? "Only you"
                      : "Shared with gym"}
                  </span>
                </p>
                {result.modification ? (
                  <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
                    {result.modification}
                  </p>
                ) : null}
              </div>
            ) : null}
            <TrainingWorkoutResultDetails details={result?.details} />
            {readOnlyMessage ? (
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>{readOnlyMessage}</p>
                {result?.notes ? (
                  <details>
                    <summary className="min-h-11 cursor-pointer py-3 font-medium">
                      Private notes
                    </summary>
                    <p className="whitespace-pre-wrap break-words">
                      {result.notes}
                    </p>
                  </details>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {block.kind === "check" ? (
                  <Button
                    variant={result?.completed ? "outline" : "default"}
                    className={`min-h-11 ${result?.completed ? "" : "bg-primary text-black hover:bg-primary hover:brightness-110 dark:text-black dark:hover:bg-primary"}`}
                    disabled={saving}
                    aria-pressed={result?.completed ?? false}
                    onClick={toggleCompletion}
                  >
                    {saving
                      ? "Saving…"
                      : result?.completed
                        ? "Undo completion"
                        : "Mark complete"}
                  </Button>
                ) : null}
                <TrainingResultDialog
                  privateOnly={privateOnly}
                  saveResult={saveResult}
                  session={session}
                  block={block}
                  trackName={trackName}
                  gymName={gymName}
                  result={result}
                  disabled={saving}
                  onSavingChange={setSaving}
                  onSaved={(savedResult) => {
                    setError(null)
                    onSaved(savedResult)
                  }}
                />
              </div>
            )}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  )
}
