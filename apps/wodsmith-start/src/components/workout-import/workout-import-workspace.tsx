import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { WorkoutForm } from "@/components/workout-form"
import type { Movement } from "@/db/schemas/workouts"
import {
  normalizedWorkoutSaveSchema,
  type WorkoutImportDraft,
  type WorkoutImportSaveInput,
  type WorkoutImportWorkout,
} from "@/lib/workout-import"
import {
  emptyImportWorkout,
  formToImportWorkout,
  importFieldLabels,
  importWorkoutToForm,
} from "./editor-adapter"
import {
  applyReviewedFields,
  changedFields,
  type ReviewedApplication,
  undoReviewedFields,
} from "./review-state"
import { WorkoutImportSource } from "./source-input"

export interface WorkoutImportWorkspaceProps {
  destinationLabel: string
  saveLabel: string
  draft: WorkoutImportDraft | null
  stage: string
  busy: boolean
  accessRequired: boolean
  accessUnavailable?: boolean
  error: string | null
  sourceUrl?: string
  movements: Pick<Movement, "id" | "name" | "type">[]
  scalingGroups?: { id: string; title: string }[]
  track?: { trackOrder: number; notes?: string }
  onRead: (text: string, file: File | null, requestId: string) => Promise<void>
  onRevise: (
    workout: WorkoutImportWorkout,
    instruction: string,
    requestId: string,
  ) => Promise<void>
  onSave: (input: WorkoutImportSaveInput) => Promise<void>
  onCancel: () => Promise<void>
  onClose: () => void
  onCheckAccess: () => void
}

// @lat: [[workout-import-ux#Workout Import Workspace#Destination and source]]
export function WorkoutImportWorkspace(props: WorkoutImportWorkspaceProps) {
  const [text, setText] = useState("")
  const [remoteSourceRemoved, setRemoteSourceRemoved] = useState(false)
  const [editorVisible, setEditorVisible] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [workout, setWorkout] = useState<WorkoutImportWorkout>({
    ...emptyImportWorkout,
  })
  const [scope, setScope] = useState<"private" | "public">("private")
  const [reviewed, setReviewed] = useState<WorkoutImportDraft | null>(null)
  const [pending, setPending] = useState<{
    draft: WorkoutImportDraft
    baseline: WorkoutImportWorkout
  } | null>(null)
  const [selectedFields, setSelectedFields] = useState<
    (keyof WorkoutImportWorkout)[]
  >([])
  const [undo, setUndo] =
    useState<ReviewedApplication<WorkoutImportWorkout> | null>(null)
  const [instruction, setInstruction] = useState("")
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const requestRunning = useRef(false)
  const [requestPending, setRequestPending] = useState(false)
  const baseline = useRef<WorkoutImportWorkout>({ ...emptyImportWorkout })
  const requestId = useRef<string | null>(null)
  const cancelled = useRef(new Set<string>())
  const seen = useRef<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const saveAttempt = useRef<{ fingerprint: string; key: string } | null>(null)

  useEffect(() => {
    const draft = props.draft
    if (!draft || cancelled.current.has(draft.requestId)) return
    if (requestId.current && draft.requestId !== requestId.current) return
    const identity = `${draft.importId}:${draft.revision}`
    if (seen.current === identity) return
    seen.current = identity
    if (!requestId.current) setText(draft.source.text)
    setEditorVisible(true)
    setPending({ draft, baseline: baseline.current })
    setSelectedFields(changedFields(baseline.current, draft.workout))
    setNotice(
      "A workout proposal is ready. Review the changed fields before applying it.",
    )
  }, [props.draft])

  const run = async (operation: () => Promise<void>) => {
    setLocalError(null)
    try {
      await operation()
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "The operation failed. Your edits are still here.",
      )
    }
  }
  const runRequest = async (operation: () => Promise<void>) => {
    if (requestRunning.current) return
    requestRunning.current = true
    setRequestPending(true)
    try {
      await run(operation)
    } finally {
      requestRunning.current = false
      setRequestPending(false)
    }
  }
  const beginRequest = () => {
    baseline.current = structuredClone(workout)
    const id = crypto.randomUUID()
    requestId.current = id
    return id
  }
  const beginSourceRead = () => {
    setReviewed(null)
    setPending(null)
    setLocalError(null)
    return beginRequest()
  }
  const focusQuestion = () =>
    requestAnimationFrame(() => {
      const question = root.current?.querySelector<HTMLElement>(
        "[data-import-question]",
      )
      const selectedPart = root.current?.querySelector(
        "[data-import-selected-part]",
      )
      const fallback = root.current?.querySelector<HTMLElement>(
        selectedPart ? "#import-instruction" : '[data-import-field="name"]',
      )
      const target = question ?? fallback
      target?.focus()
    })
  const accept = (fields: (keyof WorkoutImportWorkout)[]) => {
    if (!pending) return
    const result = applyReviewedFields(
      workout,
      pending.baseline,
      pending.draft.workout,
      fields,
    )
    setUndo({ before: workout, after: result.value, fields: result.applied })
    setWorkout(result.value)
    setReviewed(pending.draft)
    setAnswers({})
    setPending(null)
    setNotice(
      result.conflicts.length
        ? `Kept your manual edits to ${result.conflicts.map((field) => importFieldLabels[field]).join(", ")}.`
        : "Proposal reviewed. Check the prescription and scoring, then create the workout.",
    )
    focusQuestion()
  }
  const unanswered =
    reviewed?.unresolved.filter(
      (question) =>
        question.field === "selectedPart" || !answers[question.id]?.trim(),
    ) ?? []
  const disabled =
    props.busy ||
    requestPending ||
    saving ||
    props.accessRequired ||
    !!props.accessUnavailable

  const save = async () => {
    if (!reviewed || pending || props.accessRequired) return
    if (unanswered.length) {
      setLocalError(
        "Answer the remaining questions before creating the workout.",
      )
      focusQuestion()
      return
    }
    if (
      props.track &&
      (!Number.isInteger(props.track.trackOrder) || props.track.trackOrder < 1)
    ) {
      setLocalError(
        "Track position must be a positive whole number. Correct it above before saving.",
      )
      return
    }
    if (
      workout.scalingGroupId &&
      !props.scalingGroups?.some((group) => group.id === workout.scalingGroupId)
    ) {
      setLocalError(
        "Choose an available scaling group or select None before saving.",
      )
      root.current
        ?.querySelector<HTMLElement>('[data-import-field="scalingGroupId"]')
        ?.focus()
      return
    }
    for (const question of reviewed.unresolved) {
      if (
        question.field === "prescription" ||
        question.field === "selectedPart"
      )
        continue
      const value = workout[question.field]
      if (
        value === null ||
        value === "" ||
        (Array.isArray(value) && !value.length) ||
        (question.choices.length &&
          ![value].flat().map(String).includes(answers[question.id]))
      ) {
        setLocalError(
          `Make the matching correction to ${importFieldLabels[question.field]} before saving.`,
        )
        root.current
          ?.querySelector<HTMLElement>(`[id="question-${question.id}"]`)
          ?.focus()
        return
      }
    }
    const parsed = normalizedWorkoutSaveSchema.safeParse({ ...workout, scope })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setLocalError(issue?.message ?? "Check the workout fields before saving.")
      const field =
        issue?.path[0] === "timeCapSeconds" ? "timeCap" : String(issue?.path[0])
      root.current
        ?.querySelector<HTMLElement>(`[data-import-field="${field}"]`)
        ?.focus()
      return
    }
    const content = {
      importId: reviewed.importId,
      revision: reviewed.revision,
      workout: parsed.data,
      resolutions: reviewed.unresolved.map((question) => ({
        questionId: question.id,
        answer: answers[question.id] ?? "",
      })),
      ...(props.track ? { track: props.track } : {}),
    }
    const fingerprint = JSON.stringify(content)
    if (saveAttempt.current?.fingerprint !== fingerprint)
      saveAttempt.current = { fingerprint, key: crypto.randomUUID() }
    const idempotencyKey = saveAttempt.current.key
    setSaving(true)
    await run(() => props.onSave({ ...content, idempotencyKey }))
    setSaving(false)
  }
  const displayValue = (field: keyof WorkoutImportWorkout, value: unknown) => {
    if (field === "scalingGroupId" && value)
      return (
        props.scalingGroups?.find((group) => group.id === value)?.title ??
        "Matched group is unavailable"
      )
    if (field === "movementIds" && Array.isArray(value))
      return (
        value
          .map(
            (id) =>
              props.movements.find((movement) => movement.id === id)?.name ??
              id,
          )
          .join(", ") || "None"
      )
    return value === null ? "Needs input" : String(value)
  }

  return (
    <div ref={root} className="min-w-0 space-y-6">
      <p className="text-sm font-medium break-words">
        {props.destinationLabel}
      </p>
      <output aria-live="polite" className="text-sm text-muted-foreground">
        {props.busy ? props.stage : notice || props.stage}
      </output>
      {(props.accessRequired || props.accessUnavailable) && (
        <div role="alert" className="space-y-3 rounded-md border p-4">
          <p className="font-medium">
            {props.accessRequired
              ? "AI Workout Import access required"
              : "AI access check unavailable"}
          </p>
          <p className="text-sm">
            {props.accessRequired
              ? "Access for this destination is unavailable or has expired. Your local edits remain here."
              : "The access check could not finish. Your local edits remain here."}
          </p>
          <Button type="button" variant="outline" onClick={props.onCheckAccess}>
            Check access again
          </Button>
        </div>
      )}
      {(props.error || localError) && (
        <p role="alert" className="text-sm text-destructive break-words">
          {props.error || localError}
        </p>
      )}
      <details open={!reviewed && !pending} className="min-w-0 space-y-4">
        <summary className="cursor-pointer py-2 font-medium">
          View source
        </summary>
        <WorkoutImportSource
          text={text}
          onTextChange={setText}
          file={file}
          onFileChange={(next) => {
            setFile(next)
            setRemoteSourceRemoved(true)
          }}
          sourceUrl={
            props.accessRequired || remoteSourceRemoved
              ? undefined
              : props.sourceUrl
          }
          disabled={disabled}
        />
        {props.draft?.extractedText && (
          <details>
            <summary className="cursor-pointer py-2 text-sm">
              Extracted text
            </summary>
            <p className="whitespace-pre-wrap break-words text-sm">
              {props.draft.extractedText}
            </p>
          </details>
        )}
        <Button
          type="button"
          disabled={disabled || (!text.trim() && !file)}
          onClick={() =>
            runRequest(() => props.onRead(text, file, beginSourceRead()))
          }
        >
          Read workout
        </Button>
      </details>
      {(props.busy || requestPending) && (
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            run(async () => {
              if (requestId.current) cancelled.current.add(requestId.current)
              await props.onCancel()
              setReviewed(null)
              setPending(null)
              setNotice(
                "Reading cancelled. Your source and edits are still here. Read the source again to create a new reviewed proposal before saving.",
              )
            })
          }
        >
          Cancel reading
        </Button>
      )}
      {pending && (
        <section
          className="space-y-4 border-y py-5"
          aria-label="Proposed changes"
        >
          <h3 className="font-semibold">Review proposed changes</h3>
          <p className="text-sm text-muted-foreground">
            Choose which fields to apply. Fields you edited while reading will
            be kept.
          </p>
          {changedFields(pending.baseline, pending.draft.workout).map(
            (field) => (
              <label
                key={field}
                className="flex min-w-0 items-start gap-3 py-2"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0"
                  checked={selectedFields.includes(field)}
                  disabled={disabled}
                  onChange={(event) =>
                    setSelectedFields((current) =>
                      event.target.checked
                        ? [...current, field]
                        : current.filter((item) => item !== field),
                    )
                  }
                />
                <span className="min-w-0 text-sm">
                  <span className="block font-medium">
                    {importFieldLabels[field]}
                  </span>
                  <span className="block whitespace-pre-wrap break-words text-muted-foreground">
                    {displayValue(field, workout[field])}
                  </span>
                  <span className="block whitespace-pre-wrap break-words">
                    {displayValue(field, pending.draft.workout[field])}
                  </span>
                </span>
              </label>
            ),
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={disabled}
              onClick={() => accept(selectedFields)}
            >
              Apply selected fields
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => accept([])}
            >
              Keep my version
            </Button>
          </div>
        </section>
      )}
      {editorVisible && (
        <div className="space-y-5">
          {undo && (
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => {
                const result = undoReviewedFields(workout, undo)
                setWorkout(result.value)
                setUndo(null)
                setNotice(
                  "Undid the last application. Later manual edits were kept.",
                )
              }}
            >
              Undo last application
            </Button>
          )}
          {reviewed?.warnings.map((warning, index) => (
            <p
              key={`${index}-${warning.message}`}
              className="text-sm text-muted-foreground"
            >
              {warning.message}
              {warning.sourceExcerpt && (
                <q className="block whitespace-pre-wrap break-words">
                  {warning.sourceExcerpt}
                </q>
              )}
            </p>
          ))}
          {reviewed?.unresolved.length ? (
            <section className="space-y-4" aria-label="Needs your input">
              <h3 className="font-semibold">Needs your input</h3>
              {reviewed.unresolved.map((question) => (
                <div key={question.id} className="space-y-2">
                  <Label htmlFor={`question-${question.id}`}>
                    {question.reason}
                  </Label>
                  {question.sourceExcerpt && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                      Source: {question.sourceExcerpt}
                    </p>
                  )}
                  {question.field === "selectedPart" ? (
                    <p className="text-sm" data-import-selected-part>
                      This has more than one workout. Use “Ask for a change”
                      below to choose which part to create first.
                    </p>
                  ) : question.choices.length ? (
                    <select
                      id={`question-${question.id}`}
                      data-import-question
                      className="flex min-h-11 w-full rounded-md border bg-background px-3 text-sm"
                      value={answers[question.id] ?? ""}
                      disabled={disabled}
                      onChange={(e) =>
                        setAnswers({
                          ...answers,
                          [question.id]: e.target.value,
                        })
                      }
                    >
                      <option value="">Choose an answer</option>
                      {question.choices.map((choice) => (
                        <option key={choice}>{choice}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={`question-${question.id}`}
                      data-import-question
                      value={answers[question.id] ?? ""}
                      disabled={disabled}
                      onChange={(e) =>
                        setAnswers({
                          ...answers,
                          [question.id]: e.target.value,
                        })
                      }
                    />
                  )}
                  {question.field !== "selectedPart" && (
                    <p className="text-xs text-muted-foreground">
                      Make the matching correction in the workout fields below.
                    </p>
                  )}
                </div>
              ))}
            </section>
          ) : null}
          <fieldset disabled={saving} className="min-w-0 space-y-5">
            <legend className="mb-3 font-semibold">Workout and scoring</legend>
            <WorkoutForm
              mode="create"
              embedded
              editor={{
                value: importWorkoutToForm(workout, scope),
                onChange: (value) => {
                  setWorkout(formToImportWorkout(value))
                  setScope(value.scope ?? "private")
                },
              }}
              movements={props.movements}
              scalingGroups={props.scalingGroups}
              onSubmit={save}
              onCancel={props.onClose}
              backUrl="/workouts"
              submitLabel={saving ? "Creating…" : props.saveLabel}
              submitDisabled={
                disabled || !!pending || !reviewed || unanswered.length > 0
              }
            />
          </fieldset>
          {props.track && (
            <p className="text-sm whitespace-pre-wrap break-words">
              Track position: {props.track.trackOrder}
              {props.track.notes ? ` · ${props.track.notes}` : ""}
            </p>
          )}
          <div className="space-y-2 border-t pt-5">
            <Label htmlFor="import-instruction">Ask for a change</Label>
            <Textarea
              id="import-instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={disabled}
              maxLength={4000}
              placeholder="The cap is 12 minutes. Use the second workout only."
            />
            <Button
              type="button"
              variant="outline"
              disabled={disabled || !instruction.trim() || !!pending}
              onClick={() =>
                runRequest(() =>
                  props.onRevise(workout, instruction, beginRequest()),
                )
              }
            >
              Review another proposal
            </Button>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Review the prescription and scoring before saving. Creating a workout
        does not log a result, schedule it, or publish a track.
      </p>
      {!reviewed && (
        <Button type="button" variant="outline" onClick={props.onClose}>
          Close import
        </Button>
      )}
    </div>
  )
}
