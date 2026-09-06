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
  return (
    <EarlierTrainingHistoryPages
      key={`${userId}:${teamId}`}
      userId={userId}
      teamId={teamId}
    />
  )
}

function EarlierTrainingHistoryPages({
  userId,
  teamId,
}: {
  userId: string
  teamId: string
}) {
  const [logs, setLogs] = useState<EarlierLog[] | null>(null)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry requests the same history again.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")
    getLogsByUserFn({
      data: { userId, teamId, personalOnly: true, limit: 20, offset },
    })
      .then(({ logs: results }) => {
        if (!cancelled) {
          setLogs((previous) =>
            offset === 0 ? results : [...(previous ?? []), ...results],
          )
          setHasMore(results.length === 20)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load your earlier results.",
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, teamId, offset, retry])

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
      {logs === null && loading ? (
        <output className="mt-4 block text-muted-foreground">
          Loading your workout history…
        </output>
      ) : logs?.length ? (
        <ul className="mt-4 divide-y divide-border">
          {logs.map((log) => (
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
      ) : !error ? (
        <p className="mt-5 text-muted-foreground">
          No earlier results for this gym.
        </p>
      ) : null}
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
      ) : hasMore ? (
        <Button
          variant="outline"
          className="mt-4 min-h-11"
          disabled={loading}
          onClick={() => setOffset((value) => value + 20)}
        >
          {loading ? "Loading more results…" : "Show more results"}
        </Button>
      ) : null}
    </section>
  )
}
