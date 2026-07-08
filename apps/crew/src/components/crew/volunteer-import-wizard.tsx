// @lat: [[crew#Import CSV Preview#Preview Records]]
import { Link, useNavigate, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  PlayCircle,
  Save,
  UploadCloud,
} from "lucide-react"
import type { DragEvent } from "react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  getImportFields,
  inferColumnMapping,
} from "@/lib/crew/imports/column-mapping"
import { parseCsv } from "@/lib/crew/imports/csv"
import type { CrewImportMappingSuggestion } from "@/lib/crew/imports/mapping-memory"
import type {
  ColumnMapping,
  ImportIssue,
  PreviewImportRow,
  VolunteerImportRow,
} from "@/lib/crew/imports/types"
import {
  applyCrewImportFn,
  type CrewImportApplyResult,
  getCrewImportMappingSuggestionFn,
  type PersistedCrewImportPreview,
  saveCrewImportMappingPresetFn,
} from "@/server-fns/crew-import-fns"

const KIND = "volunteers" as const

type WizardStep = "upload" | "map" | "review"

const WIZARD_STEPS: Array<{ id: WizardStep; label: string }> = [
  { id: "upload", label: "Upload CSV" },
  { id: "map", label: "Map fields" },
  { id: "review", label: "Review" },
]

/**
 * Full-page volunteer CSV import wizard: upload → map fields → review → apply.
 * Reuses the crew import server contract (POST /api/crew/import, applyCrewImportFn)
 * and mapping-memory suggestions; only the layout differs from the old modal flow.
 */
export function VolunteerImportWizard({ eventId }: { eventId: string }) {
  const router = useRouter()
  const navigate = useNavigate()
  const getMappingSuggestion = useServerFn(getCrewImportMappingSuggestionFn)
  const saveMappingPreset = useServerFn(saveCrewImportMappingPresetFn)
  const applyImport = useServerFn(applyCrewImportFn)

  const [step, setStep] = useState<WizardStep>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [mappingSuggestion, setMappingSuggestion] =
    useState<CrewImportMappingSuggestion | null>(null)
  const [sourcePlatform, setSourcePlatform] = useState("")
  const [clientIssues, setClientIssues] = useState<ImportIssue[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isLoadingMappingSuggestion, setIsLoadingMappingSuggestion] =
    useState(false)
  const [isSavingMapping, setIsSavingMapping] = useState(false)
  const [isSubmittingPreview, setIsSubmittingPreview] = useState(false)
  const [preview, setPreview] = useState<PersistedCrewImportPreview | null>(
    null,
  )
  const [isApplying, setIsApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<CrewImportApplyResult | null>(
    null,
  )
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const fields = useMemo(() => getImportFields(KIND), [])
  const mappedFieldCount = Object.keys(mapping).length
  const currentStepIndex = WIZARD_STEPS.findIndex((entry) => entry.id === step)

  useEffect(() => {
    let ignore = false

    if (headers.length === 0) {
      setMappingSuggestion(null)
      setIsLoadingMappingSuggestion(false)
      return
    }

    setMappingSuggestion(null)
    setIsLoadingMappingSuggestion(true)
    void getMappingSuggestion({
      data: { eventId, kind: KIND, sourcePlatform, headers },
    })
      .then((result) => {
        if (!ignore) setMappingSuggestion(result.suggestion)
      })
      .catch(() => {
        if (!ignore) setMappingSuggestion(null)
      })
      .finally(() => {
        if (!ignore) setIsLoadingMappingSuggestion(false)
      })

    return () => {
      ignore = true
    }
  }, [eventId, getMappingSuggestion, headers, sourcePlatform])

  async function ingestFile(selectedFile: File | null) {
    setFile(selectedFile)
    setPreview(null)
    setApplyResult(null)

    if (!selectedFile) {
      setHeaders([])
      setMapping({})
      setMappingSuggestion(null)
      setClientIssues([])
      return
    }

    const csv = parseCsv(await selectedFile.text(), { maxRows: 20 })
    setHeaders(csv.headers)
    setMapping(inferColumnMapping(csv.headers, KIND))
    setClientIssues(csv.fileIssues)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    const dropped = event.dataTransfer.files?.[0] ?? null
    if (dropped) void ingestFile(dropped)
  }

  function updateMapping(field: string, header: string) {
    setMapping((current) => {
      const next = { ...current }
      if (header) next[field] = header
      else delete next[field]
      return next
    })
  }

  function handleUseSuggestedMapping(suggestion: CrewImportMappingSuggestion) {
    setMapping(suggestion.columnMapping)
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
          kind: KIND,
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

  async function handleSubmitMapping() {
    if (!file) {
      toast.error("Choose a CSV file first")
      return
    }

    setIsSubmittingPreview(true)
    const formData = new FormData()
    formData.append("eventId", eventId)
    formData.append("kind", KIND)
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

      setPreview(payload.importPreview)
      setApplyResult(null)
      setStep("review")
      toast.success("Volunteer list preview ready")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to preview import",
      )
    } finally {
      setIsSubmittingPreview(false)
    }
  }

  async function handleApply() {
    if (!preview) return

    setIsApplying(true)
    try {
      const result = await applyImport({
        data: { eventId, importId: preview.importId, confirmed: true },
      })
      setApplyResult(result)
      setPreview((current) =>
        current && current.importId === result.importId
          ? { ...current, status: result.status }
          : current,
      )
      setIsConfirmOpen(false)
      toast.success("Volunteer list applied")
      await router.invalidate()
      await navigate({
        to: "/events/$eventId/volunteers",
        params: { eventId },
      })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to apply volunteer list",
      )
      setIsApplying(false)
    }
  }

  const canLeaveUpload = headers.length > 0
  const canApply = preview?.status === "previewed"
  const impact = preview ? getPreviewImpact(preview) : null

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Import volunteers</h2>
        <p className="text-sm text-muted-foreground">
          Upload a CSV, match its columns to volunteer fields, then review
          before applying to your roster.
        </p>
      </div>

      <WizardStepper currentIndex={currentStepIndex} />

      {step === "upload" ? (
        <UploadStep
          fields={fields}
          fileName={file?.name ?? null}
          headers={headers}
          sourcePlatform={sourcePlatform}
          onSourcePlatformChange={setSourcePlatform}
          isDragging={isDragging}
          onDragEnter={() => setIsDragging(true)}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onFileSelected={(selected) => void ingestFile(selected)}
          clientIssues={clientIssues}
        />
      ) : null}

      {step === "map" ? (
        <MapStep
          fields={fields}
          headers={headers}
          mapping={mapping}
          mappedFieldCount={mappedFieldCount}
          mappingSuggestion={mappingSuggestion}
          isLoadingMappingSuggestion={isLoadingMappingSuggestion}
          isSavingMapping={isSavingMapping}
          onUpdateMapping={updateMapping}
          onUseSuggestedMapping={handleUseSuggestedMapping}
          onSaveMapping={handleSaveMapping}
        />
      ) : null}

      {step === "review" && preview && impact ? (
        <ReviewStep
          preview={preview}
          impact={impact}
          applyResult={applyResult}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button asChild variant="ghost">
          <Link to="/events/$eventId/volunteers" params={{ eventId }}>
            Cancel
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {step !== "upload" ? (
            <Button
              variant="outline"
              onClick={() => setStep(step === "review" ? "map" : "upload")}
              disabled={isSubmittingPreview || isApplying}
            >
              <ArrowLeft />
              Back
            </Button>
          ) : null}

          {step === "upload" ? (
            <Button onClick={() => setStep("map")} disabled={!canLeaveUpload}>
              Next
              <ArrowRight />
            </Button>
          ) : null}

          {step === "map" ? (
            <Button
              onClick={() => void handleSubmitMapping()}
              disabled={isSubmittingPreview}
            >
              {isSubmittingPreview ? (
                <Loader2 className="animate-spin" />
              ) : null}
              Next
              <ArrowRight />
            </Button>
          ) : null}

          {step === "review" ? (
            <Button
              onClick={() => setIsConfirmOpen(true)}
              disabled={!canApply || isApplying}
            >
              {isApplying ? (
                <Loader2 className="animate-spin" />
              ) : (
                <PlayCircle />
              )}
              Apply volunteer list
            </Button>
          ) : null}
        </div>
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply volunteer list?</DialogTitle>
            <DialogDescription>
              Review these changes before Crew updates your event.
            </DialogDescription>
          </DialogHeader>
          {preview && impact ? (
            <div className="space-y-3 text-sm">
              <p>
                Crew will use ready rows to add volunteers or match existing
                people on this event.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryMetric label="Ready" value={impact.readyCount} />
                <SummaryMetric label="Skipped" value={impact.skippedCount} />
                <SummaryMetric
                  label="Need review"
                  value={impact.blockedCount}
                />
              </div>
              {preview.warningCount > 0 ? (
                <p className="text-amber-700">
                  {preview.warningCount} warnings will stay attached to the
                  preview so you can review them after applying.
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isApplying}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleApply()}
              disabled={!canApply || isApplying}
            >
              {isApplying ? <Loader2 className="animate-spin" /> : null}
              Apply volunteer list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function WizardStepper({ currentIndex }: { currentIndex: number }) {
  return (
    <ol className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {WIZARD_STEPS.map((entry, index) => {
        const isComplete = index < currentIndex
        const isCurrent = index === currentIndex

        return (
          <li key={entry.id} className="flex flex-1 items-center gap-3">
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                isCurrent
                  ? "border-primary bg-primary text-primary-foreground"
                  : isComplete
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                    : "border-muted bg-muted text-muted-foreground"
              }`}
            >
              {isComplete ? <Check className="size-4" /> : index + 1}
            </span>
            <span
              className={`text-sm font-medium ${
                isCurrent
                  ? "text-foreground"
                  : isComplete
                    ? "text-foreground"
                    : "text-muted-foreground"
              }`}
            >
              {entry.label}
            </span>
            {index < WIZARD_STEPS.length - 1 ? (
              <span className="hidden h-px flex-1 bg-border sm:block" />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function UploadStep({
  fields,
  fileName,
  headers,
  sourcePlatform,
  onSourcePlatformChange,
  isDragging,
  onDragEnter,
  onDragLeave,
  onDrop,
  onFileSelected,
  clientIssues,
}: {
  fields: ReturnType<typeof getImportFields>
  fileName: string | null
  headers: string[]
  sourcePlatform: string
  onSourcePlatformChange: (value: string) => void
  isDragging: boolean
  onDragEnter: () => void
  onDragLeave: () => void
  onDrop: (event: DragEvent<HTMLDivElement>) => void
  onFileSelected: (file: File | null) => void
  clientIssues: ImportIssue[]
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        {/** biome-ignore lint/a11y/noStaticElementInteractions: dropzone forwards to a real file input */}
        <div
          onDragOver={(event) => {
            event.preventDefault()
            onDragEnter()
          }}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-3 rounded-md border border-dashed p-8 text-center transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "bg-card"
          }`}
        >
          <div className="flex size-12 items-center justify-center rounded-md bg-muted">
            <UploadCloud className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">Drag and drop your CSV</p>
            <p className="text-sm text-muted-foreground">
              {fileName
                ? `${fileName}${headers.length > 0 ? ` · ${headers.length} columns detected` : ""}`
                : "or choose a file from your computer"}
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted">
            <FileSpreadsheet className="size-4" />
            Choose file
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) =>
                onFileSelected(event.target.files?.[0] ?? null)
              }
            />
          </label>
        </div>

        <label className="block text-sm" htmlFor="volunteer-import-source">
          <span className="font-medium">CSV label (optional)</span>
          <input
            id="volunteer-import-source"
            value={sourcePlatform}
            onChange={(event) => onSourcePlatformChange(event.target.value)}
            placeholder="Competition Corner export"
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Naming the source helps Crew remember your column choices next time.
          </span>
        </label>

        {clientIssues.length > 0 ? <IssueList issues={clientIssues} /> : null}
      </div>

      <aside className="space-y-3 rounded-md border bg-muted/40 p-4 text-sm">
        <h3 className="font-semibold">Expected columns</h3>
        <p className="text-muted-foreground">
          Include a header row. You will map each column on the next step, so
          exact names are not required.
        </p>
        <ul className="space-y-1">
          {fields.map((field) => (
            <li key={field.key} className="flex items-center gap-2">
              <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground" />
              <span>{field.label}</span>
              {field.required ? (
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                  Required
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}

function MapStep({
  fields,
  headers,
  mapping,
  mappedFieldCount,
  mappingSuggestion,
  isLoadingMappingSuggestion,
  isSavingMapping,
  onUpdateMapping,
  onUseSuggestedMapping,
  onSaveMapping,
}: {
  fields: ReturnType<typeof getImportFields>
  headers: string[]
  mapping: ColumnMapping
  mappedFieldCount: number
  mappingSuggestion: CrewImportMappingSuggestion | null
  isLoadingMappingSuggestion: boolean
  isSavingMapping: boolean
  onUpdateMapping: (field: string, header: string) => void
  onUseSuggestedMapping: (suggestion: CrewImportMappingSuggestion) => void
  onSaveMapping: () => void
}) {
  return (
    <div className="space-y-4 rounded-md border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">Match columns</h3>
          <p className="text-sm text-muted-foreground">
            {mappedFieldCount} of {fields.length} fields matched
          </p>
        </div>
        <Button
          variant="outline"
          onClick={onSaveMapping}
          disabled={isSavingMapping || mappedFieldCount === 0}
        >
          {isSavingMapping ? <Loader2 className="animate-spin" /> : <Save />}
          Save column choices
        </Button>
      </div>

      {mappingSuggestion ? (
        <div className="rounded-md bg-muted p-3 text-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Saved column choices available</p>
              <p className="text-muted-foreground">
                {mappingSuggestion.matchedFieldCount} fields from{" "}
                {mappingSuggestion.sourcePlatform}
              </p>
            </div>
            <Button
              variant="outline"
              className="bg-background"
              onClick={() => onUseSuggestedMapping(mappingSuggestion)}
            >
              <CheckCircle2 />
              Use saved choices
            </Button>
          </div>
        </div>
      ) : isLoadingMappingSuggestion ? (
        <p className="text-sm text-muted-foreground">
          Checking saved column choices...
        </p>
      ) : null}

      <div className="space-y-3">
        {fields.map((field) => (
          <label
            key={field.key}
            className="grid gap-1 text-sm sm:grid-cols-[10rem_1fr] sm:items-center"
          >
            <span className="text-muted-foreground">
              {field.label}
              {field.required ? " *" : ""}
            </span>
            <select
              value={mapping[field.key] ?? ""}
              onChange={(event) =>
                onUpdateMapping(field.key, event.target.value)
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
    </div>
  )
}

function ReviewStep({
  preview,
  impact,
  applyResult,
}: {
  preview: PersistedCrewImportPreview
  impact: PreviewImpact
  applyResult: CrewImportApplyResult | null
}) {
  const appliedCount = applyResult
    ? applyResult.createdCount + applyResult.updatedCount
    : 0

  return (
    <section className="space-y-4 rounded-md border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold">
            Preview ready: {impact.readyCount} volunteers
          </h3>
          <p className="text-sm text-muted-foreground">
            {preview.originalFilename}
          </p>
        </div>
        <PreviewStatusBadge status={applyResult?.status ?? preview.status} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryMetric label="Ready volunteers" value={impact.readyCount} />
        <SummaryMetric label="Warnings" value={preview.warningCount} />
        <SummaryMetric label="Need review" value={impact.blockedCount} />
      </div>

      {applyResult ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryMetric label="Applied" value={appliedCount} />
          <SummaryMetric label="Added" value={applyResult.createdCount} />
          <SummaryMetric label="Skipped" value={applyResult.skippedCount} />
        </div>
      ) : null}

      <div className="rounded-md border bg-background p-4 text-sm">
        <p className="font-medium">What will change</p>
        <p className="mt-1 text-muted-foreground">
          Crew will use ready rows to add volunteers or match existing people on
          this event.
        </p>
        <ul className="mt-3 space-y-1 text-muted-foreground">
          <li>{impact.readyCount} rows are ready to apply.</li>
          <li>{impact.skippedCount} rows will be skipped.</li>
          <li>{impact.blockedCount} rows need review before they can apply.</li>
        </ul>
      </div>

      {preview.fileIssues.length > 0 ? (
        <IssueList issues={preview.fileIssues} />
      ) : null}

      <VolunteerPreviewTable rows={preview.rows} />
    </section>
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

interface PreviewImpact {
  readyCount: number
  skippedCount: number
  blockedCount: number
}

function getPreviewImpact(preview: PersistedCrewImportPreview): PreviewImpact {
  return preview.rows.reduce<PreviewImpact>(
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

function formatStatus(status: string) {
  if (status === "previewed") return "Preview ready"
  if (status === "applied") return "Applied"
  if (status === "failed") return "Needs review"

  return status
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ")
}
