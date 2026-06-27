"use client"

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
  CrewImportKind,
  HeatScheduleImportRow,
  ImportIssue,
  PreviewImportRow,
  VolunteerImportRow,
} from "@/lib/crew/imports/types"
import {
  applyCrewImportFn,
  type CrewImportApplyResult,
  type CrewImportHistoryItem,
  type CrewImportReferenceData,
  getCrewImportMappingSuggestionFn,
  type PersistedCrewImportPreview,
  saveCrewImportMappingPresetFn,
} from "@/server-fns/crew-import-fns"

type ImportSearchTab = CrewImportKind

export function EventImportTabs({
  eventId,
  history,
  initialTab,
  reference,
  onApplyComplete,
  onHistoryRefresh,
}: {
  eventId: string
  history: CrewImportHistoryItem[]
  initialTab: ImportSearchTab
  reference: CrewImportReferenceData
  onApplyComplete: (result: CrewImportApplyResult) => Promise<void>
  onHistoryRefresh: () => Promise<void>
}) {
  const [activeTab, setActiveTab] = useState<ImportSearchTab>(initialTab)
  const [latestPreview, setLatestPreview] =
    useState<PersistedCrewImportPreview | null>(null)
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  function handlePreviewComplete(preview: PersistedCrewImportPreview) {
    setLatestPreview(preview)
    setActiveTab(preview.kind)
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
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            Import volunteers & heat schedule
          </h2>
          <p className="text-sm text-muted-foreground">
            Upload a volunteer list or heat schedule, review what Crew found,
            then apply the rows you are ready to use.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ImportChoiceButton
          active={activeTab === "volunteers"}
          kind="volunteers"
          onClick={() => setActiveTab("volunteers")}
        />
        <ImportChoiceButton
          active={activeTab === "heat_schedule"}
          kind="heat_schedule"
          onClick={() => setActiveTab("heat_schedule")}
        />
      </div>

      <ImportTabContent
        key={activeTab}
        activeTab={activeTab}
        eventId={eventId}
        latestPreview={latestPreview}
        onApplyComplete={handleApplyComplete}
        onHistoryRefresh={onHistoryRefresh}
        onPreviewComplete={handlePreviewComplete}
      />

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <button
          type="button"
          aria-expanded={showAdvancedDetails}
          onClick={() => setShowAdvancedDetails((current) => !current)}
          className="text-sm font-medium"
        >
          Advanced details
        </button>
        {showAdvancedDetails ? (
          <div className="mt-5 space-y-6">
            <ReferencePanel reference={reference} />
            <HistoryPanel history={history} />
          </div>
        ) : null}
      </section>
    </section>
  )
}

function ImportTabContent({
  activeTab,
  eventId,
  latestPreview,
  onApplyComplete,
  onHistoryRefresh,
  onPreviewComplete,
}: {
  activeTab: ImportSearchTab
  eventId: string
  latestPreview: PersistedCrewImportPreview | null
  onApplyComplete: (result: CrewImportApplyResult) => Promise<void>
  onHistoryRefresh: () => Promise<void>
  onPreviewComplete: (preview: PersistedCrewImportPreview) => void
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,24rem)_1fr]">
      <ImportUploadPanel
        eventId={eventId}
        kind={activeTab}
        onPreviewComplete={onPreviewComplete}
        onHistoryRefresh={onHistoryRefresh}
      />
      <PreviewPanel
        eventId={eventId}
        preview={latestPreview}
        expectedKind={activeTab}
        onApplyComplete={onApplyComplete}
      />
    </div>
  )
}

function ImportUploadPanel({
  eventId,
  kind,
  onPreviewComplete,
  onHistoryRefresh,
}: {
  eventId: string
  kind: CrewImportKind
  onPreviewComplete: (preview: PersistedCrewImportPreview) => void
  onHistoryRefresh: () => Promise<void>
}) {
  const getMappingSuggestion = useServerFn(getCrewImportMappingSuggestionFn)
  const saveMappingPreset = useServerFn(saveCrewImportMappingPresetFn)
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
      toast.success(`${getImportCopy(kind).shortLabel} preview ready`)
      await onHistoryRefresh()
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
          <h3 className="font-semibold">{getImportCopy(kind).uploadTitle}</h3>
          <p className="text-sm text-muted-foreground">
            {headers.length > 0
              ? `${headers.length} columns detected`
              : getImportCopy(kind).uploadHelp}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <Field label="CSV or Excel file" htmlFor={`crew-import-file-${kind}`}>
          <input
            id={`crew-import-file-${kind}`}
            type="file"
            accept={CREW_IMPORT_ACCEPTED_FILE_TYPES}
            onChange={handleFileChange}
            className="block w-full rounded-md border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
        </Field>
        <Field
          label="Source label (optional)"
          htmlFor={`crew-import-source-${kind}`}
        >
          <input
            id={`crew-import-source-${kind}`}
            value={sourcePlatform}
            onChange={(event) => setSourcePlatform(event.target.value)}
            placeholder="Competition Corner export"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </Field>
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
          Preview {getImportCopy(kind).shortLabel.toLowerCase()}
        </button>
      </div>
    </form>
  )
}

function PreviewPanel({
  eventId,
  preview,
  expectedKind,
  onApplyComplete,
}: {
  eventId: string
  preview: PersistedCrewImportPreview | null
  expectedKind: CrewImportKind
  onApplyComplete: (result: CrewImportApplyResult) => Promise<void>
}) {
  const applyImport = useServerFn(applyCrewImportFn)
  const [isApplying, setIsApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<CrewImportApplyResult | null>(
    null,
  )
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const importCopy = getImportCopy(expectedKind)

  if (!preview || preview.kind !== expectedKind) {
    return (
      <section className="rounded-md border bg-card p-5 shadow-sm">
        <h3 className="font-semibold">Preview</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Your {importCopy.shortLabel.toLowerCase()} preview will appear here.
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
      toast.success(`${formatKind(result.kind)} applied`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to apply ${getImportCopy(preview.kind).shortLabel.toLowerCase()}`,
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
          <StatusBadge status={applyResult?.status ?? preview.status} />
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
            Apply {getImportCopy(preview.kind).shortLabel.toLowerCase()}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryMetric
          label={`Ready ${importCopy.nounPlural}`}
          value={impact.readyCount}
        />
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
        <p className="mt-1 text-muted-foreground">{importCopy.changeSummary}</p>
        <ul className="mt-3 space-y-1 text-muted-foreground">
          <li>{impact.readyCount} rows are ready to apply.</li>
          <li>{impact.skippedCount} rows will be skipped.</li>
          <li>{impact.blockedCount} rows need review before they can apply.</li>
        </ul>
      </div>

      {preview.fileIssues.length > 0 ? (
        <IssueList issues={preview.fileIssues} />
      ) : null}

      <PreviewTable kind={preview.kind} rows={preview.rows} />

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Apply {getImportCopy(preview.kind).shortLabel.toLowerCase()}?
            </DialogTitle>
            <DialogDescription>
              Review these changes before Crew updates your event.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>{importCopy.changeSummary}</p>
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
              Apply {getImportCopy(preview.kind).shortLabel.toLowerCase()}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function PreviewTable({
  kind,
  rows,
}: {
  kind: CrewImportKind
  rows: PreviewImportRow[]
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
        No rows were parsed.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="sticky top-0 bg-muted text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Row</th>
              {kind === "volunteers" ? (
                <>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Division</th>
                </>
              ) : (
                <>
                  <th className="px-3 py-2 font-medium">Workout</th>
                  <th className="px-3 py-2 font-medium">Heat</th>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Division</th>
                </>
              )}
              <th className="px-3 py-2 font-medium">Issues</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rowNumber} className="border-t align-top">
                <td className="px-3 py-2 font-mono text-xs">{row.rowNumber}</td>
                {kind === "volunteers" ? (
                  <VolunteerCells
                    row={row.normalizedRow as VolunteerImportRow}
                  />
                ) : (
                  <HeatCells row={row.normalizedRow as HeatScheduleImportRow} />
                )}
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

function HeatCells({ row }: { row: HeatScheduleImportRow }) {
  return (
    <>
      <td className="px-3 py-2">{row.workout || "Not mapped"}</td>
      <td className="px-3 py-2">{row.heatLabel || "Not mapped"}</td>
      <td className="px-3 py-2">{row.scheduledTime || "Not mapped"}</td>
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

function ReferencePanel({ reference }: { reference: CrewImportReferenceData }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <ReferenceSection
        title="Role assumptions"
        values={reference.roleLabels}
      />
      <ReferenceSection
        title="Divisions"
        values={reference.divisions.map((division) => division.label)}
      />
      <ReferenceSection
        title="Workouts"
        values={reference.workouts.map(
          (workout) => `${workout.trackOrder}. ${workout.label}`,
        )}
      />
    </div>
  )
}

function ReferenceSection({
  title,
  values,
}: {
  title: string
  values: string[]
}) {
  return (
    <section className="rounded-md border bg-card p-5 shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      {values.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={value}
              className="rounded-md border bg-background px-2 py-1 text-sm"
            >
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">None configured.</p>
      )}
    </section>
  )
}

function HistoryPanel({ history }: { history: CrewImportHistoryItem[] }) {
  if (history.length === 0) {
    return (
      <section className="rounded-md border bg-card p-5 shadow-sm">
        <h3 className="font-semibold">Upload history</h3>
        <p className="mt-2 text-sm text-muted-foreground">No uploads yet.</p>
      </section>
    )
  }

  return (
    <section className="rounded-md border bg-card p-5 shadow-sm">
      <h3 className="font-semibold">Recent uploads</h3>
      <div className="mt-4 overflow-hidden rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">File</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Rows</th>
                <th className="px-3 py-2 font-medium">Warnings</th>
                <th className="px-3 py-2 font-medium">Errors</th>
                <th className="px-3 py-2 font-medium">Added</th>
                <th className="px-3 py-2 font-medium">Updated</th>
                <th className="px-3 py-2 font-medium">Skipped</th>
                <th className="px-3 py-2 font-medium">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2">
                    <p className="font-medium">
                      {item.originalFilename ?? "Uploaded file"}
                    </p>
                  </td>
                  <td className="px-3 py-2">{formatKind(item.kind)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-3 py-2">{item.rowCount}</td>
                  <td className="px-3 py-2">{item.warningCount}</td>
                  <td className="px-3 py-2">{item.errorCount}</td>
                  <td className="px-3 py-2">{item.createdCount}</td>
                  <td className="px-3 py-2">{item.updatedCount}</td>
                  <td className="px-3 py-2">{item.skippedCount}</td>
                  <td className="px-3 py-2">
                    {formatHistoryDate(item.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function ImportChoiceButton({
  active,
  kind,
  onClick,
}: {
  active: boolean
  kind: CrewImportKind
  onClick: () => void
}) {
  const copy = getImportCopy(kind)

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? "rounded-md border bg-muted p-4 text-left text-sm text-foreground"
          : "rounded-md border p-4 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      }
    >
      <span className="font-medium">{copy.choiceTitle}</span>
      <span className="mt-1 block">{copy.choiceDescription}</span>
    </button>
  )
}

function Field({
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

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex w-fit rounded-md border bg-background px-2 py-1 text-xs font-medium">
      {formatStatus(status)}
    </span>
  )
}

function formatKind(kind: string) {
  if (kind === "heat_schedule") return "Heat schedule"
  if (kind === "role_template") return "Role template"
  if (kind === "volunteers") return "Volunteer list"
  return "Unknown"
}

function getImportCopy(kind: CrewImportKind) {
  if (kind === "heat_schedule") {
    return {
      choiceTitle: "Upload heat schedule",
      choiceDescription:
        "Bring in workouts, heat labels, divisions, times, venues, and lane counts.",
      uploadTitle: "Heat schedule file",
      uploadHelp: "Choose a heat schedule CSV or Excel file to preview.",
      shortLabel: "Heat schedule",
      nounPlural: "heat rows",
      changeSummary:
        "Crew will use ready rows to add heat schedule details or match existing heat entries for this event.",
    }
  }

  return {
    choiceTitle: "Upload volunteer list",
    choiceDescription:
      "Bring in volunteer names, emails, roles, divisions, availability, and notes.",
    uploadTitle: "Volunteer list file",
    uploadHelp: "Choose a volunteer list CSV or Excel file to preview.",
    shortLabel: "Volunteer list",
    nounPlural: "volunteers",
    changeSummary:
      "Crew will use ready rows to add volunteers or match existing people on this event.",
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
  const copy = getImportCopy(preview.kind)
  return `${impact.readyCount} ${copy.nounPlural}`
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

function formatHistoryDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}
