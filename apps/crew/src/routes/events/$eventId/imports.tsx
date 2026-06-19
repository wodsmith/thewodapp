import type { ChangeEvent, FormEvent, ReactNode } from "react"
import { useMemo, useState } from "react"
import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router"
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import {
  getImportFields,
  inferColumnMapping,
} from "@/lib/crew/imports/column-mapping"
import { parseCsv } from "@/lib/crew/imports/csv"
import type {
  ColumnMapping,
  CrewImportKind,
  HeatScheduleImportRow,
  ImportIssue,
  PreviewImportRow,
  VolunteerImportRow,
} from "@/lib/crew/imports/types"
import {
  getCrewImportsPageFn,
  type CrewImportHistoryItem,
  type CrewImportReferenceData,
  type PersistedCrewImportPreview,
} from "@/server-fns/crew-import-fns"

export const Route = createFileRoute("/events/$eventId/imports")({
  loader: async ({ params }) =>
    await getCrewImportsPageFn({ data: { eventId: params.eventId } }),
  component: EventImportsPage,
})

const parentRoute = getRouteApi("/events/$eventId")

type ImportsTab = CrewImportKind | "roles" | "history"

function EventImportsPage() {
  const router = useRouter()
  const { eventId } = parentRoute.useParams()
  const { history, reference } = Route.useLoaderData()
  const [activeTab, setActiveTab] = useState<ImportsTab>("volunteers")
  const [latestPreview, setLatestPreview] =
    useState<PersistedCrewImportPreview | null>(null)

  function handlePreviewComplete(preview: PersistedCrewImportPreview) {
    setLatestPreview(preview)
    setActiveTab(preview.kind)
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Imports</h2>
          <p className="text-sm text-muted-foreground">
            CSV preview, mapping, warnings, and event import history.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <ImportTabButton
            active={activeTab === "volunteers"}
            label="Volunteers"
            onClick={() => setActiveTab("volunteers")}
          />
          <ImportTabButton
            active={activeTab === "heat_schedule"}
            label="Heat schedule"
            onClick={() => setActiveTab("heat_schedule")}
          />
          <ImportTabButton
            active={activeTab === "roles"}
            label="Roles"
            onClick={() => setActiveTab("roles")}
          />
          <ImportTabButton
            active={activeTab === "history"}
            label="History"
            onClick={() => setActiveTab("history")}
          />
        </div>
      </div>

      {activeTab === "volunteers" || activeTab === "heat_schedule" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,24rem)_1fr]">
          <ImportUploadPanel
            key={activeTab}
            eventId={eventId}
            kind={activeTab}
            onPreviewComplete={handlePreviewComplete}
            onHistoryRefresh={() => router.invalidate()}
          />
          <PreviewPanel preview={latestPreview} expectedKind={activeTab} />
        </div>
      ) : null}

      {activeTab === "roles" ? <ReferencePanel reference={reference} /> : null}

      {activeTab === "history" ? <HistoryPanel history={history} /> : null}
    </section>
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
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [sourcePlatform, setSourcePlatform] = useState("")
  const [clientIssues, setClientIssues] = useState<ImportIssue[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fields = useMemo(() => getImportFields(kind), [kind])

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null
    setFile(selectedFile)

    if (!selectedFile) {
      setHeaders([])
      setMapping({})
      setClientIssues([])
      return
    }

    const csv = parseCsv(await selectedFile.text(), { maxRows: 20 })
    setHeaders(csv.headers)
    setMapping(inferColumnMapping(csv.headers, kind))
    setClientIssues(csv.fileIssues)
  }

  function updateMapping(field: string, header: string) {
    setMapping((current) => {
      const next = { ...current }
      if (header) next[field] = header
      else delete next[field]
      return next
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!file) {
      toast.error("Choose a CSV file first")
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
      toast.success("Import preview created")
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
          <h3 className="font-semibold">{formatKind(kind)} CSV</h3>
          <p className="text-sm text-muted-foreground">
            {headers.length > 0
              ? `${headers.length} columns detected`
              : "No file selected"}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <Field label="CSV file" htmlFor={`crew-import-file-${kind}`}>
          <input
            id={`crew-import-file-${kind}`}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="block w-full rounded-md border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
        </Field>
        <Field label="Source platform" htmlFor={`crew-import-source-${kind}`}>
          <input
            id={`crew-import-source-${kind}`}
            value={sourcePlatform}
            onChange={(event) => setSourcePlatform(event.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </Field>
      </div>

      {clientIssues.length > 0 ? (
        <IssueList className="mt-4" issues={clientIssues} />
      ) : null}

      {headers.length > 0 ? (
        <div className="mt-6 space-y-3">
          <h4 className="text-sm font-semibold">Mapping</h4>
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

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        Preview CSV
      </button>
    </form>
  )
}

function PreviewPanel({
  preview,
  expectedKind,
}: {
  preview: PersistedCrewImportPreview | null
  expectedKind: CrewImportKind
}) {
  if (!preview || preview.kind !== expectedKind) {
    return (
      <section className="rounded-md border bg-card p-5 shadow-sm">
        <h3 className="font-semibold">Preview</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          The latest {formatKind(expectedKind).toLowerCase()} preview will
          appear here.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4 rounded-md border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold">{preview.originalFilename}</h3>
          <p className="text-sm text-muted-foreground">
            Import {preview.importId}
          </p>
        </div>
        <StatusBadge status={preview.status} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryMetric label="Rows" value={preview.rowCount} />
        <SummaryMetric label="Warnings" value={preview.warningCount} />
        <SummaryMetric label="Errors" value={preview.errorCount} />
      </div>

      {preview.fileIssues.length > 0 ? (
        <IssueList issues={preview.fileIssues} />
      ) : null}

      <PreviewTable kind={preview.kind} rows={preview.rows} />
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
        <h3 className="font-semibold">Import history</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          No import previews yet.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-md border bg-card p-5 shadow-sm">
      <h3 className="font-semibold">Import history</h3>
      <div className="mt-4 overflow-hidden rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">File</th>
                <th className="px-3 py-2 font-medium">Kind</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Rows</th>
                <th className="px-3 py-2 font-medium">Warnings</th>
                <th className="px-3 py-2 font-medium">Errors</th>
                <th className="px-3 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2">
                    <p className="font-medium">
                      {item.originalFilename ?? item.id}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {item.id}
                    </p>
                  </td>
                  <td className="px-3 py-2">{formatKind(item.kind)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-3 py-2">{item.rowCount}</td>
                  <td className="px-3 py-2">{item.warningCount}</td>
                  <td className="px-3 py-2">{item.errorCount}</td>
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

function ImportTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-md border bg-muted px-3 py-2 text-sm font-medium text-foreground"
          : "rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      }
    >
      {label}
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
  if (kind === "unknown") return "Unknown"
  return "Volunteers"
}

function formatStatus(status: string) {
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
