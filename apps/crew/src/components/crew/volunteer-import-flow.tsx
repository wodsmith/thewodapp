import { useServerFn } from "@tanstack/react-start"
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  FileSpreadsheet,
  Loader2,
  PlayCircle,
  Save,
  Upload,
} from "lucide-react"
import type { ChangeEvent, FormEvent, ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  getImportFields,
  inferColumnMapping,
} from "@/lib/crew/imports/column-mapping"
import {
  CREW_IMPORT_ACCEPTED_FILE_TYPES,
  parseCrewImportFile,
} from "@/lib/crew/imports/file"
import type { CrewImportMappingSuggestion } from "@/lib/crew/imports/mapping-memory"
import {
  buildExistingQuestionMappingKey,
  buildNewQuestionMappingKey,
  isQuestionMappingKey,
} from "@/lib/crew/imports/question-mapping"
import type {
  ColumnMapping,
  ImportIssue,
  PreviewImportRow,
  VolunteerImportRow,
  VolunteerQuestionPreviewSummary,
} from "@/lib/crew/imports/types"
import {
  applyCrewImportFn,
  type CrewImportApplyResult,
  type CrewVolunteerImportQuestion,
  getCrewImportMappingSuggestionFn,
  getCrewVolunteerImportQuestionsFn,
  type PersistedCrewImportPreview,
  saveCrewImportMappingPresetFn,
} from "@/server-fns/crew-import-fns"

/**
 * Self-contained volunteer import flow: upload → column mapping → preview → apply.
 * Scoped to volunteer imports only (kind = "volunteers").
 * Call onApplyComplete when an import is successfully applied.
 */
export function VolunteerImportFlow({
  eventId,
  onApplyComplete,
}: {
  eventId: string
  onApplyComplete: (result: CrewImportApplyResult) => Promise<void>
}) {
  const [latestPreview, setLatestPreview] =
    useState<PersistedCrewImportPreview | null>(null)
  const [applyResult, setApplyResult] = useState<CrewImportApplyResult | null>(
    null,
  )
  const [isPreviewStale, setIsPreviewStale] = useState(false)

  function handlePreviewComplete(preview: PersistedCrewImportPreview) {
    setLatestPreview(preview)
    setApplyResult(null)
    setIsPreviewStale(false)
  }

  function handleDraftChange() {
    if (latestPreview) {
      setApplyResult(null)
      setIsPreviewStale(true)
    }
  }

  async function handleApplyComplete(result: CrewImportApplyResult) {
    setApplyResult(result)
    setLatestPreview((current) =>
      current && current.importId === result.importId
        ? { ...current, status: result.status }
        : current,
    )
    await onApplyComplete(result)
  }

  return (
    <div className="space-y-8">
      <ImportStepOverview
        preview={latestPreview}
        applyResult={applyResult}
        isPreviewStale={isPreviewStale}
      />
      <VolunteerUploadPanel
        eventId={eventId}
        onDraftChange={handleDraftChange}
        onPreviewComplete={handlePreviewComplete}
      />
      <VolunteerPreviewPanel
        preview={latestPreview}
        applyResult={applyResult}
        isPreviewStale={isPreviewStale}
      />
      <VolunteerApplyPanel
        eventId={eventId}
        preview={latestPreview}
        applyResult={applyResult}
        isPreviewStale={isPreviewStale}
        onApplyComplete={handleApplyComplete}
      />
    </div>
  )
}

function ImportStepOverview({
  preview,
  applyResult,
  isPreviewStale,
}: {
  preview: PersistedCrewImportPreview | null
  applyResult: CrewImportApplyResult | null
  isPreviewStale: boolean
}) {
  const steps = [
    {
      label: "Upload & map",
      detail: isPreviewStale
        ? "Rebuild your preview"
        : preview
          ? "Preview built"
          : "Choose your file",
      state: isPreviewStale ? "current" : preview ? "complete" : "current",
    },
    {
      label: "Review",
      detail: isPreviewStale
        ? "Preview out of date"
        : applyResult
          ? "Review complete"
          : preview
            ? "Ready to review"
            : "Waiting for preview",
      state: applyResult
        ? "complete"
        : preview && !isPreviewStale
          ? "current"
          : "waiting",
    },
    {
      label: "Import",
      detail: applyResult
        ? "Import complete"
        : preview && !isPreviewStale
          ? "Ready when you are"
          : "Waiting for preview",
      state: applyResult
        ? "complete"
        : preview && !isPreviewStale
          ? "ready"
          : "waiting",
    },
  ]

  return (
    <ol
      aria-label="Volunteer import progress"
      className="grid grid-cols-3 overflow-hidden rounded-xl border bg-card"
    >
      {steps.map((step, index) => {
        const isComplete = step.state === "complete"
        const isCurrent = step.state === "current"
        const isReady = step.state === "ready"

        return (
          <li
            key={step.label}
            aria-current={isCurrent ? "step" : undefined}
            className="flex min-w-0 flex-col items-start gap-2 border-r px-3 py-3 last:border-r-0 sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-4"
          >
            <span
              className={
                isComplete
                  ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white sm:size-9"
                  : isCurrent
                    ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground sm:size-9"
                    : isReady
                      ? "flex size-8 shrink-0 items-center justify-center rounded-full border border-primary bg-primary/10 text-primary sm:size-9"
                      : "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground sm:size-9"
              }
              aria-hidden="true"
            >
              {isComplete ? (
                <CheckCircle2 className="size-5" />
              ) : (
                <span className="text-sm font-semibold">{index + 1}</span>
              )}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold sm:text-sm">{step.label}</p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                {step.detail}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function VolunteerUploadPanel({
  eventId,
  onDraftChange,
  onPreviewComplete,
}: {
  eventId: string
  onDraftChange: () => void
  onPreviewComplete: (preview: PersistedCrewImportPreview) => void
}) {
  const getMappingSuggestion = useServerFn(getCrewImportMappingSuggestionFn)
  const saveMappingPreset = useServerFn(saveCrewImportMappingPresetFn)
  const getVolunteerQuestions = useServerFn(getCrewVolunteerImportQuestionsFn)
  const kind = "volunteers" as const
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [questions, setQuestions] = useState<CrewVolunteerImportQuestion[]>([])
  const [mappingSuggestion, setMappingSuggestion] =
    useState<CrewImportMappingSuggestion | null>(null)
  const [builtInSuggestion, setBuiltInSuggestion] =
    useState<CrewImportMappingSuggestion | null>(null)
  const [sourcePlatform, setSourcePlatform] = useState("")
  const [clientIssues, setClientIssues] = useState<ImportIssue[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingMappingSuggestion, setIsLoadingMappingSuggestion] =
    useState(false)
  const [isSavingMapping, setIsSavingMapping] = useState(false)
  const draftVersionRef = useRef(0)
  const fields = useMemo(() => getImportFields(kind), [kind])
  const mappedFieldCount = Object.keys(mapping).length

  function markDraftChanged() {
    draftVersionRef.current += 1
    onDraftChange()
  }

  // Headers not claimed by a first-class field can be mapped to a volunteer
  // registration question (existing or created from the column header).
  const questionMappableHeaders = useMemo(() => {
    const fieldUsedHeaders = new Set(
      Object.entries(mapping)
        .filter(([key]) => !isQuestionMappingKey(key))
        .map(([, header]) => header),
    )
    return headers.filter((header) => !fieldUsedHeaders.has(header))
  }, [headers, mapping])

  useEffect(() => {
    let ignore = false
    void getVolunteerQuestions({ data: { eventId } })
      .then((result) => {
        if (!ignore) setQuestions(result.questions)
      })
      .catch(() => {
        if (!ignore) setQuestions([])
      })

    return () => {
      ignore = true
    }
  }, [eventId, getVolunteerQuestions])

  useEffect(() => {
    let ignore = false

    if (headers.length === 0) {
      setMappingSuggestion(null)
      setBuiltInSuggestion(null)
      setIsLoadingMappingSuggestion(false)
      return
    }

    setMappingSuggestion(null)
    setBuiltInSuggestion(null)
    setIsLoadingMappingSuggestion(true)
    void getMappingSuggestion({
      data: {
        eventId,
        kind,
        sourcePlatform,
        headers,
      },
    })
      .then((result) => {
        if (!ignore) {
          setMappingSuggestion(result.suggestion)
          setBuiltInSuggestion(result.builtInSuggestion)
        }
      })
      .catch(() => {
        if (!ignore) {
          setMappingSuggestion(null)
          setBuiltInSuggestion(null)
        }
      })
      .finally(() => {
        if (!ignore) setIsLoadingMappingSuggestion(false)
      })

    return () => {
      ignore = true
    }
  }, [eventId, getMappingSuggestion, headers, kind, sourcePlatform])

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null
    markDraftChanged()
    setFile(selectedFile)

    if (!selectedFile) {
      setHeaders([])
      setMapping({})
      setMappingSuggestion(null)
      setClientIssues([])
      return
    }

    let parsed: ReturnType<typeof parseCrewImportFile>
    try {
      parsed = parseCrewImportFile(
        {
          filename: selectedFile.name,
          mimeType: selectedFile.type,
          data: await selectedFile.arrayBuffer(),
        },
        { maxRows: 20 },
      )
    } catch {
      setHeaders([])
      setMapping({})
      setMappingSuggestion(null)
      setBuiltInSuggestion(null)
      setClientIssues([buildClientFileParseIssue()])
      return
    }

    setHeaders(parsed.headers)
    setMapping(inferColumnMapping(parsed.headers, kind))
    setClientIssues(parsed.fileIssues)
  }

  function updateMapping(field: string, header: string) {
    markDraftChanged()
    setMapping((current) => {
      const next = { ...current }
      if (header) {
        // A first-class field claims the header, so drop any question column
        // that was pointing at the same header.
        for (const key of Object.keys(next)) {
          if (isQuestionMappingKey(key) && next[key] === header) {
            delete next[key]
          }
        }
        next[field] = header
      } else {
        delete next[field]
      }
      return next
    })
  }

  function currentQuestionKeyForHeader(header: string) {
    return (
      Object.keys(mapping).find(
        (key) => isQuestionMappingKey(key) && mapping[key] === header,
      ) ?? ""
    )
  }

  function updateQuestionMapping(header: string, questionKey: string) {
    markDraftChanged()
    setMapping((current) => {
      const next = { ...current }
      for (const key of Object.keys(next)) {
        if (isQuestionMappingKey(key) && next[key] === header) {
          delete next[key]
        }
      }
      if (questionKey) next[questionKey] = header
      return next
    })
  }

  function handleUseSuggestedMapping(suggestion: CrewImportMappingSuggestion) {
    markDraftChanged()
    setMapping(suggestion.columnMapping)
    if (suggestion.isBuiltIn) {
      // Pre-fill the source label so a subsequent save records this as the
      // named platform, and so the preview carries the source through.
      if (!sourcePlatform.trim() && suggestion.name) {
        setSourcePlatform(suggestion.name)
      }
      toast.success(`${suggestion.name ?? "Built-in"} mapping applied`)
      return
    }
    toast.success("Saved column choices loaded")
  }

  async function handleSaveMapping() {
    if (headers.length === 0 || mappedFieldCount === 0) {
      toast.error("Match at least one column first")
      return
    }

    setIsSavingMapping(true)
    try {
      const result = await saveMappingPreset({
        data: {
          eventId,
          kind,
          sourcePlatform,
          headers,
          columnMapping: mapping,
        },
      })
      setMappingSuggestion(result.suggestion)
      toast.success("Column choices saved")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save column choices",
      )
    } finally {
      setIsSavingMapping(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!file) {
      toast.error("Choose a CSV or Excel file first")
      return
    }

    setIsSubmitting(true)
    const submittedDraftVersion = draftVersionRef.current
    const formData = new FormData()
    formData.append("eventId", eventId)
    formData.append("kind", kind)
    formData.append("file", file)
    formData.append("sourcePlatform", sourcePlatform)
    formData.append("columnMapping", JSON.stringify(mapping))

    try {
      const response = await fetch("/api/crew/import", {
        method: "POST",
        body: formData,
      })
      const payload = (await response.json()) as
        | { importPreview: PersistedCrewImportPreview }
        | { error: string }

      if (!response.ok || !("importPreview" in payload)) {
        throw new Error(
          "error" in payload ? payload.error : "Failed to preview import",
        )
      }

      if (draftVersionRef.current !== submittedDraftVersion) return

      onPreviewComplete(payload.importPreview)
      toast.success("Volunteer list preview ready")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to preview import",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-xl border bg-card"
    >
      <div className="flex items-start gap-3 border-b px-5 py-4 sm:gap-4 sm:px-6 sm:py-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:size-11">
          <FileSpreadsheet className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-semibold">1. Choose a file and match columns</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Select a volunteer list, then confirm which spreadsheet columns
            contain each Crew field. Building a preview will not change your
            roster.
          </p>
        </div>
      </div>

      <div className="space-y-6 px-5 py-6 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.6fr)]">
          <ImportField
            label="CSV or Excel file"
            htmlFor="volunteer-import-file"
          >
            <input
              id="volunteer-import-file"
              type="file"
              accept={CREW_IMPORT_ACCEPTED_FILE_TYPES}
              onChange={handleFileChange}
              className="block min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
          </ImportField>
          <ImportField
            label="Source label (optional)"
            htmlFor="volunteer-import-source"
          >
            <input
              id="volunteer-import-source"
              value={sourcePlatform}
              onChange={(event) => {
                markDraftChanged()
                setSourcePlatform(event.target.value)
              }}
              placeholder="Registration platform export"
              className="h-11 w-full rounded-md border bg-background px-3 text-sm"
            />
          </ImportField>
        </div>

        <output
          className="flex items-center gap-2 text-sm text-muted-foreground"
          aria-live="polite"
        >
          {headers.length > 0 ? (
            <CheckCircle2
              className="size-4 text-emerald-600"
              aria-hidden="true"
            />
          ) : (
            <Circle className="size-4" aria-hidden="true" />
          )}
          <span>
            {headers.length > 0
              ? `${file?.name ?? "File selected"} · ${headers.length} columns detected`
              : "Choose a .csv, .xlsx, or .xlsm file to begin."}
          </span>
        </output>

        {clientIssues.length > 0 ? <IssueList issues={clientIssues} /> : null}

        <div className="space-y-4 border-t pt-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-semibold">Match columns</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Required fields are marked with an asterisk. Unmapped optional
                fields will be ignored.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveMapping}
              disabled={isSavingMapping || mappedFieldCount === 0}
              className="inline-flex h-9 w-fit items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingMapping ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save column choices
            </button>
          </div>
          {headers.length === 0 ? (
            <div className="rounded-lg bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
              Column choices will be available here after you choose a file.
            </div>
          ) : mappingSuggestion ? (
            <div className="rounded-md bg-muted p-3 text-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">Saved column choices available</p>
                  <p className="text-muted-foreground">
                    {mappingSuggestion.matchedFieldCount} fields from{" "}
                    {mappingSuggestion.sourcePlatform}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUseSuggestedMapping(mappingSuggestion)}
                  className="inline-flex h-9 w-fit items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted"
                >
                  <CheckCircle2 className="size-4" />
                  Use saved choices
                </button>
              </div>
            </div>
          ) : isLoadingMappingSuggestion ? (
            <p className="text-sm text-muted-foreground">
              Checking saved column choices...
            </p>
          ) : null}
          {builtInSuggestion ? (
            <div className="rounded-md border border-dashed bg-muted/50 p-3 text-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">
                    {builtInSuggestion.name} (built-in)
                  </p>
                  <p className="text-muted-foreground">
                    Recognized this export — maps{" "}
                    {builtInSuggestion.matchedFieldCount} columns in one click.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUseSuggestedMapping(builtInSuggestion)}
                  className="inline-flex h-9 w-fit items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted"
                >
                  <CheckCircle2 className="size-4" />
                  Use {builtInSuggestion.name} mapping
                </button>
              </div>
            </div>
          ) : null}
          {headers.length > 0 ? (
            <div className="grid gap-x-8 gap-y-3 lg:grid-cols-2">
              {fields.map((field) => (
                <label
                  key={field.key}
                  className="grid gap-1 text-sm sm:grid-cols-[9rem_1fr] sm:items-center"
                >
                  <span className="text-muted-foreground">
                    {field.label}
                    {field.required ? " *" : ""}
                  </span>
                  <select
                    value={mapping[field.key] ?? ""}
                    onChange={(event) =>
                      updateMapping(field.key, event.target.value)
                    }
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">Not mapped</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          ) : null}

          {headers.length > 0 && questionMappableHeaders.length > 0 ? (
            <div className="space-y-3 border-t pt-4">
              <div>
                <h4 className="text-sm font-semibold">
                  Extra columns as questions
                </h4>
                <p className="text-sm text-muted-foreground">
                  Keep leftover columns by saving them as volunteer registration
                  questions instead of dropping them.
                </p>
              </div>
              <div className="space-y-3">
                {questionMappableHeaders.map((header) => (
                  <label
                    key={header}
                    className="grid gap-1 text-sm sm:grid-cols-[12rem_1fr] sm:items-center"
                  >
                    <span className="truncate text-muted-foreground">
                      {header}
                    </span>
                    <select
                      value={currentQuestionKeyForHeader(header)}
                      onChange={(event) =>
                        updateQuestionMapping(header, event.target.value)
                      }
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="">Not mapped</option>
                      {questions.length > 0 ? (
                        <optgroup label="Existing questions">
                          {questions.map((question) => (
                            <option
                              key={question.id}
                              value={buildExistingQuestionMappingKey(
                                question.id,
                              )}
                            >
                              {question.label}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                      <option value={buildNewQuestionMappingKey(header)}>
                        Create new question "{header}"
                      </option>
                    </select>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Next, Crew will show exactly which volunteers can be added, matched,
            skipped, or need attention.
          </p>
          <button
            type="submit"
            disabled={isSubmitting || !file}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {isSubmitting ? "Building preview..." : "Build preview"}
          </button>
        </div>
      </div>
    </form>
  )
}

function VolunteerPreviewPanel({
  preview,
  applyResult,
  isPreviewStale,
}: {
  preview: PersistedCrewImportPreview | null
  applyResult: CrewImportApplyResult | null
  isPreviewStale: boolean
}) {
  if (!preview || preview.kind !== "volunteers") {
    return (
      <section className="overflow-hidden rounded-xl border bg-card">
        <StepSectionHeader
          icon={FileSpreadsheet}
          title="2. Review the preview"
          description="Check ready rows, warnings, and skipped volunteers before anything is added to your roster."
        />
        <div className="px-5 py-10 sm:px-6">
          <div className="mx-auto max-w-xl text-center" aria-live="polite">
            <div className="mx-auto flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <FileSpreadsheet className="size-5" aria-hidden="true" />
            </div>
            <h4 className="mt-4 font-semibold">
              Preview waiting for your file
            </h4>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Complete step 1 and build a preview. This section will show the
              exact rows Crew can import and any issues that need your review.
            </p>
          </div>
        </div>
      </section>
    )
  }

  const impact = getPreviewImpact(preview)
  const appliedCount = applyResult
    ? applyResult.createdCount + applyResult.updatedCount
    : 0

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <StepSectionHeader
        icon={FileSpreadsheet}
        title="2. Review the preview"
        description="Check ready rows, warnings, and skipped volunteers before anything is added to your roster."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PreviewStatusBadge
              status={
                isPreviewStale
                  ? "out_of_date"
                  : (applyResult?.status ?? preview.status)
              }
            />
            <span className="text-sm text-muted-foreground">
              {preview.originalFilename}
            </span>
          </div>
        }
      />

      <div className="space-y-5 px-5 py-6 sm:px-6">
        {isPreviewStale ? (
          <output
            className="block rounded-lg bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">Preview needs to be rebuilt</p>
                <p className="mt-1 text-sm opacity-80">
                  The file or column choices changed. Build a new preview before
                  importing so these row results match your current setup.
                </p>
              </div>
            </div>
          </output>
        ) : null}

        <div>
          <h4 className="font-semibold">
            Preview ready: {formatPreviewReadyCount(preview)}
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Review the summary and row details below, then continue to step 3.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryMetric label="Ready volunteers" value={impact.readyCount} />
          <SummaryMetric label="Warnings" value={preview.warningCount} />
          <SummaryMetric label="Need review" value={impact.blockedCount} />
        </div>

        {applyResult ? (
          <div className="rounded-lg bg-emerald-50 p-4 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100">
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">Import complete</p>
                <p className="mt-1 text-sm opacity-80">
                  {appliedCount} volunteers were added or updated. The preview
                  remains here as your import record.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-lg bg-muted/50 p-4 text-sm">
          <p className="font-medium">What this preview will do</p>
          <p className="mt-1 leading-6 text-muted-foreground">
            Crew will use ready rows to add volunteers or match existing people
            on this event. Rows with blocking issues will not be imported.
          </p>
          <ul className="mt-3 grid gap-2 text-muted-foreground sm:grid-cols-3">
            <li>{impact.readyCount} rows are ready.</li>
            <li>{impact.skippedCount} rows will be skipped.</li>
            <li>{impact.blockedCount} rows need review.</li>
          </ul>
        </div>

        {preview.volunteerQuestionPlan &&
        preview.volunteerQuestionPlan.columns.length > 0 ? (
          <QuestionPlanPanel plan={preview.volunteerQuestionPlan} />
        ) : null}

        {preview.fileIssues.length > 0 ? (
          <IssueList issues={preview.fileIssues} />
        ) : null}

        <VolunteerPreviewTable rows={preview.rows} />
      </div>
    </section>
  )
}

function VolunteerApplyPanel({
  eventId,
  preview,
  applyResult,
  isPreviewStale,
  onApplyComplete,
}: {
  eventId: string
  preview: PersistedCrewImportPreview | null
  applyResult: CrewImportApplyResult | null
  isPreviewStale: boolean
  onApplyComplete: (result: CrewImportApplyResult) => Promise<void>
}) {
  const applyImport = useServerFn(applyCrewImportFn)
  const [isApplying, setIsApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const canApply =
    preview?.kind === "volunteers" &&
    preview.status === "previewed" &&
    !isPreviewStale
  const impact =
    preview?.kind === "volunteers" ? getPreviewImpact(preview) : null

  async function handleApply() {
    if (!preview || !canApply) return

    setIsApplying(true)
    setApplyError(null)
    try {
      const result = await applyImport({
        data: {
          eventId,
          importId: preview.importId,
          confirmed: true,
        },
      })
      await onApplyComplete(result)
      toast.success("Volunteers imported")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to import volunteers"
      setApplyError(message)
      toast.error(message)
    } finally {
      setIsApplying(false)
    }
  }

  const actionLabel = isApplying
    ? "Importing volunteers..."
    : applyResult
      ? "Import complete"
      : impact && !isPreviewStale
        ? `Import ${impact.readyCount} ${impact.readyCount === 1 ? "volunteer" : "volunteers"}`
        : "Import volunteers"

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <StepSectionHeader
        icon={PlayCircle}
        title="3. Import ready volunteers"
        description="This is the only step that changes your roster. Crew imports ready rows and leaves blocked rows untouched."
      />
      <div className="grid gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div aria-live="polite">
          <h4 className="font-semibold">
            {applyResult
              ? "Your roster is up to date"
              : isPreviewStale
                ? "Rebuild the preview before importing"
                : canApply
                  ? "Ready to import this preview"
                  : "Import is waiting for a preview"}
          </h4>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {applyResult
              ? "The import has finished. You can return to the roster or build another preview above."
              : isPreviewStale
                ? "Your file or mapping choices changed. Build a new preview in step 1 so the import matches those choices."
                : canApply && impact
                  ? `${impact.readyCount} ready rows will be added or matched. ${impact.skippedCount} skipped and ${impact.blockedCount} blocked rows will not change the roster.`
                  : "Build and review a preview in the steps above. This action will become available when the preview is ready."}
          </p>
          {applyError ? (
            <p
              className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {applyError}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleApply}
          disabled={!canApply || isApplying || Boolean(applyResult)}
          className="inline-flex h-11 min-w-48 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isApplying ? (
            <Loader2 className="size-4 animate-spin" />
          ) : applyResult ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <PlayCircle className="size-4" />
          )}
          {actionLabel}
        </button>
      </div>
    </section>
  )
}

function StepSectionHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof FileSpreadsheet
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 border-b px-5 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:size-11">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {action ? <div className="lg:pt-1">{action}</div> : null}
    </div>
  )
}

function VolunteerPreviewTable({ rows }: { rows: PreviewImportRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
        No rows were parsed.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="max-h-[24rem] overflow-auto">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="sticky top-0 bg-muted text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Row</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Division</th>
              <th className="px-3 py-2 font-medium">Issues</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rowNumber} className="border-t align-top">
                <td className="px-3 py-2 font-mono text-xs">{row.rowNumber}</td>
                <VolunteerCells row={row.normalizedRow as VolunteerImportRow} />
                <td className="px-3 py-2">
                  <RowIssues row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function VolunteerCells({ row }: { row: VolunteerImportRow }) {
  const displayName =
    row.name || [row.firstName, row.lastName].filter(Boolean).join(" ")

  return (
    <>
      <td className="px-3 py-2">{displayName || "Not mapped"}</td>
      <td className="px-3 py-2">{row.email || "Not mapped"}</td>
      <td className="px-3 py-2">{row.role || "Not mapped"}</td>
      <td className="px-3 py-2">{row.division || "Not mapped"}</td>
    </>
  )
}

function RowIssues({ row }: { row: PreviewImportRow }) {
  const issues = [...row.errors, ...row.warnings]

  if (issues.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700">
        <CheckCircle2 className="size-4" />
        Ready
      </span>
    )
  }

  return (
    <div className="space-y-1">
      {issues.map((issue, index) => (
        <p
          key={`${issue.code}-${index}`}
          className={
            issue.severity === "error" ? "text-destructive" : "text-amber-700"
          }
        >
          {issue.message}
        </p>
      ))}
    </div>
  )
}

function QuestionPlanPanel({
  plan,
}: {
  plan: VolunteerQuestionPreviewSummary
}) {
  return (
    <div className="rounded-md border bg-background p-4 text-sm">
      <p className="font-medium">Volunteer questions</p>
      <p className="mt-1 text-muted-foreground">
        {plan.totalAnswerCount} answers will be recorded across{" "}
        {plan.columns.length} {plan.columns.length === 1 ? "column" : "columns"}
        .
      </p>
      <ul className="mt-3 space-y-1 text-muted-foreground">
        {plan.columns.map((column) => (
          <li key={column.columnKey}>
            {column.willCreate
              ? `Will create volunteer question "${column.label}"`
              : `"${column.label}"`}{" "}
            from column "{column.header}" — {column.answerCount}{" "}
            {column.answerCount === 1 ? "answer" : "answers"}.
          </li>
        ))}
      </ul>
    </div>
  )
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function PreviewStatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex w-fit rounded-md border bg-background px-2 py-1 text-xs font-medium">
      {formatStatus(status)}
    </span>
  )
}

function ImportField({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <label className="block text-sm" htmlFor={htmlFor}>
      <span className="font-medium">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  )
}

function IssueList({
  issues,
  className,
}: {
  issues: ImportIssue[]
  className?: string
}) {
  return (
    <div className={className}>
      <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        {issues.map((issue, index) => (
          <div key={`${issue.code}-${index}`} className="flex gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>{issue.message}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function buildClientFileParseIssue(): ImportIssue {
  return {
    code: "invalid_import_file",
    severity: "error",
    message:
      "The selected file could not be read. Choose a valid CSV or Excel workbook.",
  }
}

function getPreviewImpact(preview: PersistedCrewImportPreview) {
  return preview.rows.reduce(
    (summary, row) => {
      if (row.action === "skip") summary.skippedCount += 1
      else if (row.action === "error" || row.errors.length > 0) {
        summary.blockedCount += 1
      } else summary.readyCount += 1
      return summary
    },
    { readyCount: 0, skippedCount: 0, blockedCount: 0 },
  )
}

function formatPreviewReadyCount(preview: PersistedCrewImportPreview) {
  const impact = getPreviewImpact(preview)
  return `${impact.readyCount} volunteers`
}

function formatStatus(status: string) {
  if (status === "previewed") return "Preview ready"
  if (status === "applied") return "Applied"
  if (status === "failed") return "Needs review"

  return status
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ")
}
