import { useServerFn } from "@tanstack/react-start"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  getCrossFitImportsFn,
  getCrossFitRunStatusFn,
  runCrossFitImportFn,
} from "@/server-fns/crossfit-import-fns"

export function CrossFitImportAdmin() {
  const load = useServerFn(getCrossFitImportsFn)
  const run = useServerFn(runCrossFitImportFn)
  const status = useServerFn(getCrossFitRunStatusFn)
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof getCrossFitImportsFn>>
  >([])
  const [date, setDate] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [runId, setRunId] = useState("")
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof getCrossFitRunStatusFn>
  > | null>(null)
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
    setBusy(true)
    setError("")
    setResult(null)
    try {
      const created = await run({ data: { sourceDate: date, mode } })
      setRunId(created.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start import")
    } finally {
      setBusy(false)
    }
  }
  async function refresh() {
    setBusy(true)
    setError("")
    try {
      if (runId) setResult(await status({ data: { id: runId } }))
      setRows(await load())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load import status")
    } finally {
      setBusy(false)
    }
  }
  return (
    <details className="mb-6 rounded-lg border p-4">
      <summary className="cursor-pointer font-semibold">
        Manage daily imports
      </summary>
      <p className="mt-3 text-sm text-muted-foreground">
        Runs daily at 05:00 PST. Preview a date before publishing; replaying a
        published date keeps its existing workouts.
      </p>
      <div className="my-3 flex flex-wrap items-end gap-2">
        <label className="text-sm space-y-1" htmlFor="crossfit-source-date">
          Source date
          <Input
            id="crossfit-source-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <Button
          disabled={busy || !date}
          variant="outline"
          onClick={() => start("dry-run")}
        >
          Preview import
        </Button>
        <Button disabled={busy || !date} onClick={() => start("publish")}>
          Publish date
        </Button>
        <Button disabled={busy} variant="outline" onClick={refresh}>
          Refresh status
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {runId && (
        <output className="block text-sm break-all">
          Run: {runId}
          {result ? ` · ${result.status}` : " · started"}
        </output>
      )}
      {result?.error && <p role="alert">{result.error}</p>}
      {result?.output && result.output !== "null" && (
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs">
          {result.output}
        </pre>
      )}
      <ul className="mt-4 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="border-t pt-2 text-sm">
            <span className="font-medium">{row.sourceDate}</span> · {row.status}
            {row.kind === "rest" ? " · Rest Day" : ""}
            {row.error && <p className="text-destructive">{row.error}</p>}
            {row.sourceMarkdown && (
              <details>
                <summary className="cursor-pointer underline">
                  Review source
                </summary>
                <pre className="whitespace-pre-wrap text-xs">
                  {row.sourceMarkdown}
                </pre>
              </details>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}
