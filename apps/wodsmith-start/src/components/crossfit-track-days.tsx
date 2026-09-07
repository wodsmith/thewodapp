import { Link } from "@tanstack/react-router"
import { useState } from "react"
import ReactMarkdown from "react-markdown"
import { crossFitPrescription } from "@/lib/crossfit/conversion"
import {
  providerDateLabel,
  workoutScoring,
  workoutTitle,
} from "@/lib/crossfit/display"
import { crossFitScheduledDate } from "@/lib/crossfit/source"
import type { TrainingProviderDay } from "@/lib/training/types"

type ProviderDay = TrainingProviderDay
export function CrossFitTrackDays({
  days,
  selectedDate,
  onAdd,
}: {
  days: ProviderDay[]
  selectedDate?: string
  onAdd?: (workoutIds: string[]) => void
}) {
  const [sourceOpen, setSourceOpen] = useState(false)
  const selected =
    selectedDate ?? days[0]?.date ?? crossFitScheduledDate(Date.now())
  const day = days.find((day) => day.date === selected)
  return (
    <section className="mb-8 space-y-6" aria-label="Daily programming">
      <header>
        <h2 className="text-2xl font-semibold">
          <time dateTime={selected}>{providerDateLabel(selected)}</time>
        </h2>
        {selected === crossFitScheduledDate(Date.now()) && (
          <p className="mt-1 text-sm text-muted-foreground">Today</p>
        )}
      </header>
      {!day ? (
        <p>No programming published for this date.</p>
      ) : (
        <article className="space-y-5">
          {day.kind === "rest" ? (
            <h3 className="text-3xl font-semibold">Rest day</h3>
          ) : (
            <>
              <div className="prose dark:prose-invert max-w-prose break-words [&_p]:whitespace-pre-line">
                <ReactMarkdown>
                  {crossFitPrescription(day.markdown ?? "")}
                </ReactMarkdown>
              </div>
              <ul className="divide-y divide-border">
                {day.workouts.map((workout) => (
                  <li
                    key={workout.workoutId}
                    className="py-5 first:pt-0 space-y-3"
                  >
                    <h3 className="break-words text-xl font-semibold">
                      {workoutTitle(workout.name)}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {workoutScoring(workout)}
                    </p>

                    <div className="flex flex-wrap gap-4">
                      <Link
                        className="inline-flex min-h-11 items-center underline underline-offset-4"
                        to="/workouts/$workoutId"
                        params={{ workoutId: workout.workoutId }}
                      >
                        View workout
                      </Link>
                      {onAdd && (
                        <button
                          type="button"
                          className="min-h-11 underline underline-offset-4"
                          onClick={() => onAdd([workout.workoutId])}
                        >
                          Add to my day
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {onAdd && day.workouts.length > 1 && (
                <button
                  type="button"
                  className="min-h-11 font-medium underline underline-offset-4"
                  onClick={() => onAdd(day.workouts.map((w) => w.workoutId))}
                >
                  Add all to my day
                </button>
              )}
            </>
          )}
          <details
            onToggle={(event) => setSourceOpen(event.currentTarget.open)}
          >
            <summary className="min-h-11 cursor-pointer py-3 underline underline-offset-4">
              Read programming and scaling
            </summary>
            {sourceOpen && (
              <div className="prose dark:prose-invert max-w-prose break-words [&_p]:whitespace-pre-line">
                <ReactMarkdown>{day.markdown}</ReactMarkdown>
              </div>
            )}
          </details>
          <a
            className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
            href={day.url}
            target="_blank"
            rel="noreferrer"
          >
            View on CrossFit.com
          </a>
        </article>
      )}
    </section>
  )
}
