"use client"

// @lat: [[crew#Copy Prior Event Setup]]
import { Ban, CheckCircle2, Copy, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import {
  getCrewCopyPriorEventPageFn,
  type CrewCopyPriorEventPageData,
} from "@/server-fns/crew-copy-event-fns"

interface CrewCopyPriorEventPanelProps {
  eventId: string
  pageData: CrewCopyPriorEventPageData
  onApply: (input: { sourceEventId: string }) => Promise<void>
}

export function CrewCopyPriorEventPanel({
  eventId,
  pageData,
  onApply,
}: CrewCopyPriorEventPanelProps) {
  const [data, setData] = useState(pageData)
  const [selectedSourceEventId, setSelectedSourceEventId] = useState(
    pageData.selectedSourceEventId ?? "",
  )
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  useEffect(() => {
    setData(pageData)
    setSelectedSourceEventId(pageData.selectedSourceEventId ?? "")
  }, [pageData])

  async function handleSourceChange(sourceEventId: string) {
    setSelectedSourceEventId(sourceEventId)
    if (!sourceEventId) return
    setIsLoadingPreview(true)
    try {
      setData(
        await getCrewCopyPriorEventPageFn({
          data: { eventId, sourceEventId },
        }),
      )
    } finally {
      setIsLoadingPreview(false)
    }
  }

  async function handleApply() {
    if (!selectedSourceEventId) return
    setIsApplying(true)
    try {
      await onApply({ sourceEventId: selectedSourceEventId })
    } finally {
      setIsApplying(false)
    }
  }

  const preview = data.preview

  return (
    <section className="rounded-md border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Copy prior event setup</h2>
          <p className="text-sm text-muted-foreground">
            Preview structural setup from an earlier event before applying it to
            this draft.
          </p>
        </div>
        <span className="inline-flex rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground">
          Empty target only
        </span>
      </div>

      {data.eligibleEvents.length === 0 ? (
        <p className="mt-5 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
          No earlier Crew events from this organizing team are eligible.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(16rem,22rem)_1fr]">
          <div className="space-y-4">
            <label className="space-y-2">
              <span className="text-sm font-medium">Prior event</span>
              <select
                value={selectedSourceEventId}
                onChange={(event) => handleSourceChange(event.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {data.eligibleEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </label>

            {preview ? (
              <div className="rounded-md border bg-background p-3 text-sm">
                <p className="font-medium">{preview.sourceEvent.name}</p>
                <p className="mt-1 text-muted-foreground">
                  {preview.sourceEvent.startDate ?? "No start date"} to{" "}
                  {preview.targetEvent.startDate ?? "target date"}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <Metric
                    label="Copy"
                    value={
                      preview.summary.filter((item) => item.status === "copy")
                        .length
                    }
                  />
                  <Metric
                    label="Skip"
                    value={
                      preview.summary.filter((item) => item.status === "skip")
                        .length
                    }
                  />
                  <Metric
                    label="Deny"
                    value={
                      preview.summary.filter((item) => item.status === "deny")
                        .length
                    }
                  />
                </div>
              </div>
            ) : null}

            <button
              type="button"
              disabled={
                isApplying ||
                isLoadingPreview ||
                !selectedSourceEventId ||
                !preview?.canApply
              }
              onClick={handleApply}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {isApplying ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )}
              {isApplying ? "Applying..." : "Apply structural setup"}
            </button>
          </div>

          <div className="space-y-4">
            {isLoadingPreview ? (
              <p className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
                Loading preview...
              </p>
            ) : null}

            {preview ? (
              <>
                <div className="rounded-md border bg-background p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">Date shift</span>
                    <span className="text-muted-foreground">
                      {preview.dateShiftDays === null
                        ? "Unavailable until both events have start dates"
                        : `${preview.dateShiftDays} day${preview.dateShiftDays === 1 ? "" : "s"}`}
                    </span>
                  </div>
                  {preview.settings.willCopyAssumptions ? (
                    <p className="mt-2 text-muted-foreground">
                      Setup assumptions will be copied because the target is
                      empty.
                    </p>
                  ) : null}
                </div>

                <div className="overflow-hidden rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Area</th>
                        <th className="px-3 py-2 font-medium">Count</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.summary.map((item) => (
                        <tr key={item.category} className="border-t">
                          <td className="px-3 py-2">
                            <div className="font-medium">{item.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.reason}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {item.count}
                          </td>
                          <td className="px-3 py-2">
                            <StatusPill status={item.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card px-2 py-2">
      <div className="text-base font-semibold">{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  )
}

function StatusPill({ status }: { status: "copy" | "skip" | "deny" }) {
  const Icon = status === "copy" ? CheckCircle2 : status === "deny" ? Ban : Copy
  const label =
    status === "copy" ? "Copy" : status === "deny" ? "Denied" : "Skip"

  return (
    <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground">
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  )
}
