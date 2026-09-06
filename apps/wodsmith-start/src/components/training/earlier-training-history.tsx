import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { getLogsByUserFn } from "@/server-fns/log-fns"

type EarlierLog = Awaited<ReturnType<typeof getLogsByUserFn>>["logs"][number]

export function EarlierTrainingHistory({
  userId,
  teamId,
}: {
  userId: string
  teamId: string
}) {
  const [logs, setLogs] = useState<EarlierLog[] | null>(null)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  const [visible, setVisible] = useState(10)

  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry requests the same history again.
  useEffect(() => {
    let cancelled = false
    setLogs(null)
    setError("")
    setVisible(10)
    getLogsByUserFn({ data: { userId, teamId, personalOnly: true } })
      .then(({ logs: results }) => {
        if (!cancelled) setLogs(results)
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load your earlier results.",
          )
      })
    return () => {
      cancelled = true
    }
  }, [userId, teamId, retry])

  return (
    <section
      className="mt-10 border-t border-border pt-8"
      aria-labelledby="earlier-training-title"
    >
      <h2 id="earlier-training-title" className="text-xl font-semibold">
        Library and earlier results
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Your workout log for this gym, including results recorded before
        Training.
      </p>
      {error ? (
        <div role="alert" className="mt-4 space-y-3">
          <p>{error}</p>
          <Button
            variant="outline"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </Button>
        </div>
      ) : logs === null ? (
        <output className="mt-4 block text-muted-foreground">
          Loading your workout history…
        </output>
      ) : logs.length ? (
        <>
          <ul className="mt-4 divide-y divide-border">
            {logs.slice(0, visible).map((log) => (
              <li
                key={log.id}
                className="flex flex-wrap items-start justify-between gap-4 py-5"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="break-words font-semibold">
                    {log.workoutName || "Workout"}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(log.date))}
                    {log.displayScore ? ` · ${log.displayScore}` : ""}
                    {log.asRx ? " · Rx" : " · Scaled"}
                  </p>
                  {log.notes ? (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                      {log.notes}
                    </p>
                  ) : null}
                </div>
                <a
                  className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
                  href={`/log/${encodeURIComponent(log.id)}/edit?redirectUrl=${encodeURIComponent(`/training?view=progress&teamId=${teamId}`)}`}
                >
                  Edit result
                </a>
              </li>
            ))}
          </ul>
          {visible < logs.length ? (
            <Button
              variant="outline"
              onClick={() => setVisible((count) => count + 20)}
            >
              Show more results
            </Button>
          ) : null}
        </>
      ) : (
        <p className="mt-5 text-muted-foreground">
          No earlier results for this gym.
        </p>
      )}
    </section>
  )
}
