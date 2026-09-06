import { useServerFn } from "@tanstack/react-start"
import { useEffect, useRef, useState } from "react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  crossFitConversionSchema,
  crossFitPrescription,
} from "@/lib/crossfit/conversion"
import { providerDateLabel, workoutScoring } from "@/lib/crossfit/display"
import { crossFitScheduledDate, sourceDateSchema } from "@/lib/crossfit/source"
import {
  getCrossFitImportsFn,
  getCrossFitRunStatusFn,
  runCrossFitImportFn,
} from "@/server-fns/crossfit-import-fns"

const previewSchema = z.object({
  status: z.literal("dry-run"),
  date: sourceDateSchema,
  source: z.object({
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    markdown: z.string(),
  }),
  normalized: crossFitConversionSchema,
})
type Preview = z.infer<typeof previewSchema>
export function CrossFitImportAdmin() {
  const load = useServerFn(getCrossFitImportsFn)
  const run = useServerFn(runCrossFitImportFn)
  const status = useServerFn(getCrossFitRunStatusFn)
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof getCrossFitImportsFn>>
  >([])
  const [date, setDate] = useState(() => crossFitScheduledDate(Date.now()))
  const generation = useRef(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [runId, setRunId] = useState("")
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof getCrossFitRunStatusFn>
  > | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  useEffect(() => {
    let active = true
    load()
      .then((data) => {
        if (active) setRows(data)
      })
      .catch((e: Error) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [load])
  async function start(mode: "dry-run" | "publish") {
    const current = generation.current
    setBusy(true)
    setError("")
    setResult(null)
    try {
      const created = await run({
        data: {
          sourceDate: date,
          mode,
          expectedSourceHash:
            mode === "publish" ? preview?.source.hash : undefined,
        },
      })
      if (current === generation.current) setRunId(created.id)
    } catch (e) {
      if (current === generation.current)
        setError(e instanceof Error ? e.message : "Unable to start import")
    } finally {
      if (current === generation.current) setBusy(false)
    }
  }
  async function refresh() {
    const current = generation.current
    setBusy(true)
    setError("")
    try {
      if (runId) {
        const next = await status({ data: { id: runId } })
        if (current !== generation.current) return
        setResult(next)
        if (next.output) {
          const output = previewSchema.safeParse(JSON.parse(next.output))
          if (output.success && output.data.date === date)
            setPreview(output.data)
        }
      }
      const nextRows = await load()
      if (current === generation.current) setRows(nextRows)
    } catch (e) {
      if (current === generation.current)
        setError(
          e instanceof Error ? e.message : "Unable to load import status",
        )
    } finally {
      if (current === generation.current) setBusy(false)
    }
  }
  const published = rows.find(
    (row) => row.sourceDate === date && row.status === "published",
  )
  return (
    <div className="space-y-10">
      <p className="text-sm text-muted-foreground">
        Daily import: 05:00 PST (UTC−8), year-round. During Pacific daylight
        time this is 06:00 local.
      </p>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Preview an import</h2>
        <p>Preview checks the source without publishing it.</p>
        <label className="block space-y-2" htmlFor="crossfit-source-date">
          <span>CrossFit workout date</span>
          <Input
            className="min-h-11 w-full max-w-xs"
            id="crossfit-source-date"
            type="date"
            value={date}
            disabled={busy}
            onChange={(e) => {
              generation.current++
              setDate(e.target.value)
              setPreview(null)
              setResult(null)
              setRunId("")
              setError("")
            }}
          />
        </label>
        {sourceDateSchema.safeParse(date).success && (
          <p>{providerDateLabel(date)}</p>
        )}
        <Button
          variant="outline"
          className="min-h-11"
          disabled={busy || !sourceDateSchema.safeParse(date).success}
          onClick={() => start("dry-run")}
        >
          Preview import
        </Button>
      </section>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {runId && (
        <section className="space-y-3">
          <output>Import {result?.status ?? "started"}</output>
          {result?.error && <p role="alert">{result.error}</p>}
          <Button variant="outline" disabled={busy} onClick={refresh}>
            Refresh status
          </Button>
          <details>
            <summary className="cursor-pointer py-3">Technical details</summary>
            <p className="break-all">{runId}</p>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs">
              {result?.output}
            </pre>
          </details>
        </section>
      )}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Publish an import</h2>
        {published ? (
          <>
            <p>Already published</p>
            <a
              className="inline-flex min-h-11 items-center underline"
              href={`/programming/ptrk_crossfit_dotcom?date=${date}`}
            >
              Open published day
            </a>
            <p className="text-sm text-muted-foreground">
              Replaying a published date preserves its existing workouts.
            </p>
          </>
        ) : preview?.date === date ? (
          <>
            <h3 className="font-semibold">
              {preview.normalized.kind === "rest"
                ? "Rest day"
                : providerDateLabel(date)}
            </h3>
            <p className="whitespace-pre-wrap">
              {crossFitPrescription(preview.source.markdown)}
            </p>
            {preview.normalized.components.map((component, index) => (
              <div
                key={`${component.scheme}-${index}`}
                className="space-y-2 border-t py-4"
              >
                <h4 className="font-semibold">{`Score ${index + 1}`}</h4>
                <p>{workoutScoring(component)}</p>
              </div>
            ))}
            <p className="text-sm text-muted-foreground">
              Publishing checks that the source still matches this preview.
            </p>
            <Button
              className="min-h-11"
              disabled={busy}
              onClick={() => start("publish")}
            >
              Publish date
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground">
            Complete a preview for this date before publishing.
          </p>
        )}
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Import history</h2>
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.id} className="py-4 space-y-2">
              <p>
                {providerDateLabel(row.sourceDate)} · {row.status}
                {row.kind === "rest" ? " · Rest day" : ""}
              </p>
              {row.publishedAt && (
                <p className="text-sm text-muted-foreground">
                  Published {new Date(row.publishedAt).toLocaleString()}
                </p>
              )}
              {row.error && <p className="text-destructive">{row.error}</p>}
              {row.status === "published" && (
                <a
                  className="inline-flex min-h-11 items-center underline"
                  href={`/programming/ptrk_crossfit_dotcom?date=${row.sourceDate}`}
                >
                  Open published day
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
