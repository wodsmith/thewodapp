import { useServerFn } from "@tanstack/react-start"
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  PlayCircle,
  Save,
  Upload,
} from "lucide-react"
import type { ChangeEvent, FormEvent, ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
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
import {
  CREW_IMPORT_ACCEPTED_FILE_TYPES,
  parseCrewImportFile,
} from "@/lib/crew/imports/file"
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

  function handlePreviewComplete(preview: PersistedCrewImportPreview) {
    setLatestPreview(preview)
  }

  async function handleApplyComplete(result: CrewImportApplyResult) {
    setLatestPreview((current) =>
      current && current.importId === result.importId
        ? { ...current, status: result.status }
        : current,
    )
    await onApplyComplete(result)
  }

  return (
    <div className="space-y-6">
      <VolunteerUploadPanel
        eventId={eventId}
        onPreviewComplete={handlePreviewComplete}
      />
      <VolunteerPreviewPanel
        eventId={eventId}
        preview={latestPreview}
        onApplyComplete={handleApplyComplete}
      />
    </div>
  )
}

function VolunteerUploadPanel({
  eventId,
  onPreviewComplete,
}: {
  eventId: string
  onPreviewComplete: (preview: PersistedCrewImportPreview) => void
}) {
  const getMappingSuggestion = useServerFn(getCrewImportMappingSuggestionFn)
  const saveMappingPreset = useServerFn(saveCrewImportMappingPresetFn)
  const kind = "volunteers" as const
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [mappingSuggestion, setMappingSuggestion] =
    useState<CrewImportMappingSuggestion | null>(null)
  const [sourcePlatform, setSourcePlatform] = useState("")
  const [clientIssues, setClientIssues] = useState<ImportIssue[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingMappingSuggestion, setIsLoadingMappingSuggestion] =
    useState(false)
  const [isSavingMapping, setIsSavingMapping] = useState(false)
  const fields = useMemo(() => getImportFields(kind), [kind])
  const mappedFieldCount = Object.keys(mapping).length

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
      data: {
        eventId,
        kind,
        sourcePlatform,
        headers,
      },
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
  }, [eventId, getMappingSuggestion, headers, kind, sourcePlatform])

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null
    setFile(selectedFile)

    if (!selectedFile) {
      setHeaders([])
      setMapping({})
      setMappingSuggestion(null)
      setClientIssues([])
      return
    }

    const parsed = parseCrewImportFile(
      {
        filename: selectedFile.name,
        mimeType: selectedFile.type,
        data: await selectedFile.arrayBuffer(),
      },
      { maxRows: 20 },
    )
    setHeaders(parsed.headers)
    setMapping(inferColumnMapping(parsed.headers, kind))
    setClientIssues(parsed.fileIssues)
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
      className="rounded-md border bg-card p-5 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-md bg-muted">
          <FileSpreadsheet className="size-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold">Volunteer list file</h3>
          <p className="text-sm text-muted-foreground">
            {headers.length > 0
              ? `${headers.length} columns detected`
              : "Choose a volunteer list CSV or Excel file to preview."}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <ImportField label="CSV or Excel file" htmlFor="volunteer-import-file">
          <input
            id="volunteer-import-file"
            type="file"
            accept={CREW_IMPORT_ACCEPTED_FILE_TYPES}
            onChange={handleFileChange}
            className="block w-full rounded-md border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
        </ImportField>
        <ImportField
          label="Source label (optional)"
          htmlFor="volunteer-import-source"
        >
          <input
            id="volunteer-import-source"
            value={sourcePlatform}
            onChange={(event) => setSourcePlatform(event.target.value)}
            placeholder="Competition Corner export"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </ImportField>
      </div>

      {clientIssues.length > 0 ? (
        <IssueList className="mt-4" issues={clientIssues} />
      ) : null}

      {headers.length > 0 ? (
        <div className="mt-6 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-sm font-semibold">Match columns</h4>
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
          <div className="space-y-3">
            {fields.map((field) => (
              <label
                key={field.key}
                className="grid gap-1 text-sm sm:grid-cols-[8rem_1fr] sm:items-center"
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
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          Preview volunteer list
        </button>
      </div>
    </form>
  )
}

function VolunteerPreviewPanel({
  eventId,
  preview,
  onApplyComplete,
}: {
  eventId: string
  preview: PersistedCrewImportPreview | null
  onApplyComplete: (result: CrewImportApplyResult) => Promise<void>
}) {
  const applyImport = useServerFn(applyCrewImportFn)
  const [isApplying, setIsApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<CrewImportApplyResult | null>(
    null,
  )
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  if (!preview || preview.kind !== "volunteers") {
    return (
      <section className="rounded-md border bg-card p-5 shadow-sm">
        <h3 className="font-semibold">Preview</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Your volunteer list preview will appear here.
        </p>
      </section>
    )
  }

  const canApply = preview.status === "previewed"
  const impact = getPreviewImpact(preview)
  const appliedCount = applyResult
    ? applyResult.createdCount + applyResult.updatedCount
    : 0

  async function handleApply() {
    if (!preview) return

    setIsApplying(true)
    try {
      const result = await applyImport({
        data: {
          eventId,
          importId: preview.importId,
          confirmed: true,
        },
      })
      setApplyResult(result)
      await onApplyComplete(result)
      setIsConfirmOpen(false)
      toast.success("Volunteer list applied")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to apply volunteer list",
      )
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <section className="space-y-4 rounded-md border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold">
            Preview ready: {formatPreviewReadyCount(preview)}
          </h3>
          <p className="text-sm text-muted-foreground">
            {preview.originalFilename}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PreviewStatusBadge status={applyResult?.status ?? preview.status} />
          <button
            type="button"
            onClick={() => setIsConfirmOpen(true)}
            disabled={!canApply || isApplying}
            className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isApplying ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PlayCircle className="size-4" />
            )}
            Apply volunteer list
          </button>
        </div>
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

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply volunteer list?</DialogTitle>
            <DialogDescription>
              Review these changes before Crew updates your event.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Crew will use ready rows to add volunteers or match existing
              people on this event.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryMetric label="Ready" value={impact.readyCount} />
              <SummaryMetric label="Skipped" value={impact.skippedCount} />
              <SummaryMetric label="Need review" value={impact.blockedCount} />
            </div>
            {preview.warningCount > 0 ? (
              <p className="text-amber-700">
                {preview.warningCount} warnings will stay attached to the
                preview so you can review them after applying.
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!canApply || isApplying}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isApplying ? <Loader2 className="size-4 animate-spin" /> : null}
              Apply volunteer list
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
