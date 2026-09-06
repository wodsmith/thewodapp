import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type {
  OwnTrainingResult,
  SaveTrainingResultInput,
  TrainingAudience,
  TrainingBlock,
  TrainingScaling,
  TrainingSession,
} from "@/lib/training/types"
import { saveTrainingResultFn } from "@/server-fns/training-fns"

interface TrainingResultDialogProps {
  session: TrainingSession
  block: TrainingBlock
  trackName: string
  gymName: string
  result?: OwnTrainingResult
  privateOnly?: boolean
  saveResult?: (input: SaveTrainingResultInput) => Promise<OwnTrainingResult>
  disabled?: boolean
  onSavingChange?: (saving: boolean) => void
  onSaved: (result: OwnTrainingResult) => void
}

function initialFields(result?: OwnTrainingResult) {
  const timeMilliseconds =
    result?.block.kind === "time" && result.scoreValue !== null
      ? result.scoreValue
      : null
  return {
    score: result?.displayScore.replaceAll(",", "").match(/^[\d.]+/)?.[0] ?? "",
    minutes:
      timeMilliseconds === null
        ? ""
        : String(Math.floor(timeMilliseconds / 60000)),
    seconds:
      timeMilliseconds === null
        ? ""
        : String((timeMilliseconds % 60000) / 1000),
    scaling: result?.scaling ?? ("rx" as TrainingScaling),
    modification: result?.modification ?? "",
    notes: result?.notes ?? "",
    audience: result?.audience ?? ("private" as TrainingAudience),
    unit: result?.unit ?? ("lb" as const),
    completed: result?.completed ?? true,
  }
}

export function TrainingResultDialog({
  session,
  block,
  trackName,
  gymName,
  result,
  disabled = false,
  privateOnly = false,
  saveResult = (data) => saveTrainingResultFn({ data }),
  onSavingChange,
  onSaved,
}: TrainingResultDialogProps) {
  const [open, setOpen] = useState(false)
  const [fields, setFields] = useState(() => initialFields(result))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fieldId = `result-${session.id}-${block.id}`

  function update<K extends keyof typeof fields>(
    key: K,
    value: (typeof fields)[K],
  ) {
    setFields((previous) => ({ ...previous, [key]: value }))
    setDirty(true)
  }

  function changeOpen(next: boolean) {
    if (saving || disabled) return
    setFields(initialFields(result))
    setDirty(false)
    setError(null)
    setOpen(next)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || disabled) return
    setError(null)
    setSaving(true)
    onSavingChange?.(true)
    try {
      const saved = await saveResult({
        sessionId: session.id,
        blockId: block.id,
        publishedVersion: session.publishedVersion,
        score:
          block.kind === "time"
            ? `${fields.minutes || "0"}:${(fields.seconds || "0").padStart(2, "0")}`
            : block.kind === "check"
              ? ""
              : fields.score,
        scaling: fields.scaling,
        modification: fields.scaling === "rx" ? "" : fields.modification,
        notes: fields.notes,
        audience: privateOnly ? "private" : fields.audience,
        unit: fields.unit,
        completed: block.kind === "check" ? fields.completed : true,
      })
      onSaved(saved)
      setDirty(false)
      setOpen(false)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your result could not be saved. Your entry is still here; try again.",
      )
    } finally {
      setSaving(false)
      onSavingChange?.(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button
          variant={result || block.kind === "check" ? "outline" : "default"}
          className={`min-h-11 ${result || block.kind === "check" ? "" : "bg-primary text-black hover:bg-primary hover:brightness-110 dark:text-black dark:hover:bg-primary"}`}
          disabled={disabled || saving}
        >
          {result
            ? "Edit result"
            : block.kind === "check"
              ? "Add notes"
              : "Log result"}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="training-shell max-h-[90dvh] overflow-y-auto sm:max-w-lg"
        onEscapeKeyDown={(event) => {
          if (saving) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (saving) event.preventDefault()
        }}
      >
        <DialogHeader className="pr-6 text-left">
          <DialogTitle>
            {result ? "Edit" : "Log"} {block.title}
          </DialogTitle>
          <DialogDescription>
            {gymName} · {trackName} · {session.trainingDate} ·{" "}
            {session.timezone.replaceAll("_", " ")} · Version{" "}
            {session.publishedVersion}
          </DialogDescription>
        </DialogHeader>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {block.prescription}
        </p>
        <form onSubmit={submit} className="space-y-5">
          <fieldset disabled={saving} className="space-y-5">
            <legend className="sr-only">Result details</legend>
            {block.kind === "time" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-minutes`}>Minutes</Label>
                  <Input
                    id={`${fieldId}-minutes`}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    required
                    value={fields.minutes}
                    onChange={(event) => update("minutes", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-seconds`}>Seconds</Label>
                  <Input
                    id={`${fieldId}-seconds`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="59.999"
                    step="0.001"
                    required
                    value={fields.seconds}
                    onChange={(event) => update("seconds", event.target.value)}
                  />
                </div>
              </div>
            ) : block.kind === "check" ? (
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  checked={fields.completed}
                  onChange={(event) =>
                    update("completed", event.target.checked)
                  }
                  className="h-5 w-5 accent-primary"
                />
                Completed this section
              </label>
            ) : (
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-score`}>
                  {block.kind === "load" ? "Load" : "Reps"}
                </Label>
                <div className="flex min-w-0 gap-2">
                  <Input
                    id={`${fieldId}-score`}
                    type="number"
                    inputMode={block.kind === "load" ? "decimal" : "numeric"}
                    min="0"
                    step={block.kind === "load" ? "0.01" : "1"}
                    required
                    value={fields.score}
                    onChange={(event) => update("score", event.target.value)}
                  />
                  {block.kind === "load" ? (
                    <select
                      aria-label="Load unit"
                      className="min-h-11 rounded-md border border-input bg-background px-3"
                      value={fields.unit}
                      onChange={(event) =>
                        update("unit", event.target.value as "lb" | "kg")
                      }
                    >
                      <option value="lb">lb</option>
                      <option value="kg">kg</option>
                    </select>
                  ) : null}
                </div>
              </div>
            )}
            {block.kind !== "check" && !privateOnly ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  How you performed it
                </legend>
                <div className="flex flex-wrap gap-2">
                  {(["rx", "scaled", "custom"] as const).map((scaling) => (
                    <label
                      key={scaling}
                      className="flex min-h-11 items-center gap-2 rounded-md border border-input px-3 has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                    >
                      <input
                        type="radio"
                        name={`${fieldId}-scaling`}
                        value={scaling}
                        checked={fields.scaling === scaling}
                        onChange={() => update("scaling", scaling)}
                        className="accent-primary"
                      />
                      {scaling === "rx"
                        ? "Rx"
                        : scaling === "scaled"
                          ? "Scaled"
                          : "Custom"}
                    </label>
                  ))}
                </div>
                {block.scalingGuidance ? (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {block.scalingGuidance}
                  </p>
                ) : null}
              </fieldset>
            ) : null}
            {fields.scaling !== "rx" &&
            block.kind !== "check" &&
            !privateOnly ? (
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-modification`}>
                  What did you change?
                </Label>
                <Textarea
                  id={`${fieldId}-modification`}
                  required={fields.scaling === "custom"}
                  value={fields.modification}
                  onChange={(event) =>
                    update("modification", event.target.value)
                  }
                  placeholder="Movement, load, or reps you changed"
                />
                <p className="text-xs text-muted-foreground">
                  Shared with your gym if you share this result.
                </p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={`${fieldId}-notes`}>Private notes</Label>
              <Textarea
                id={`${fieldId}-notes`}
                value={fields.notes}
                onChange={(event) => update("notes", event.target.value)}
                placeholder="Something to remember for next time"
              />
              <p className="text-xs text-muted-foreground">
                Only you can see these notes, even when your result is shared.
              </p>
            </div>
            {block.kind === "check" || privateOnly ? (
              <p className="text-sm text-muted-foreground">
                This result and its notes are private.
              </p>
            ) : (
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-audience`}>
                  Who can see this result?
                </Label>
                <select
                  id={`${fieldId}-audience`}
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3"
                  value={fields.audience}
                  onChange={(event) =>
                    update("audience", event.target.value as TrainingAudience)
                  }
                >
                  <option value="private">Only me</option>
                  <option value="gym">Members of my gym</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  {fields.audience === "private"
                    ? "Your result will stay out of team results."
                    : "Your name, result, scaling, and modifications will appear in team results."}
                </p>
              </div>
            )}
          </fieldset>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={saving}
              onClick={() => changeOpen(false)}
            >
              {dirty ? "Discard changes" : "Close"}
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="min-h-11 bg-primary text-black hover:bg-primary hover:brightness-110 dark:text-black dark:hover:bg-primary"
            >
              {saving ? "Saving…" : "Save result"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
