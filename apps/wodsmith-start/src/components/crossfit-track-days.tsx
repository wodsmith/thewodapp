import { Link } from "@tanstack/react-router"
import ReactMarkdown from "react-markdown"
import type { getPublishedCrossFitDays } from "@/server/crossfit-import"

export function CrossFitTrackDays({
  days,
}: {
  days: Awaited<ReturnType<typeof getPublishedCrossFitDays>>
}) {
  if (!days.length) return null
  return (
    <section className="mb-8 space-y-4" aria-label="Daily programming">
      <h2 className="text-lg font-semibold">Daily programming</h2>
      {days.map((day) => (
        <article key={day.id} className="rounded-lg border p-4 space-y-3">
          <div className="flex flex-wrap justify-between gap-2">
            <h3 className="font-semibold">
              <time dateTime={day.date}>{day.date}</time>
              {day.kind === "rest" ? " · Rest Day" : ""}
            </h3>
            <a
              href={day.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm underline"
            >
              View on CrossFit.com
            </a>
          </div>
          <details>
            <summary className="cursor-pointer text-sm underline">
              Read programming and scaling
            </summary>
            <div className="prose dark:prose-invert max-w-none mt-3">
              <ReactMarkdown>{day.markdown}</ReactMarkdown>
            </div>
          </details>
          {day.kind !== "rest" && (
            <ul className="flex flex-wrap gap-3">
              {day.workouts.map((workout) => (
                <li key={workout.workoutId}>
                  <Link
                    to="/workouts/$workoutId"
                    params={{ workoutId: workout.workoutId }}
                    className="text-sm underline"
                  >
                    {workout.name} · {workout.scheme}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </section>
  )
}
