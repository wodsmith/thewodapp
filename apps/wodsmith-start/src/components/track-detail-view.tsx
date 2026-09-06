import { CrossFitTrackDays } from "@/components/crossfit-track-days"
import { TrackFollowActions } from "@/components/track-follow-actions"
import { providerDateLabel, workoutTitle } from "@/lib/crossfit/display"
import { CROSSFIT_TRACK_ID, sourceDateSchema } from "@/lib/crossfit/source"
import type { getCrossFitTrackDaysFn } from "@/server-fns/crossfit-import-fns"
import type {
  ProgrammingTrackWithOwner,
  TrackWorkoutWithDetails,
} from "@/server-fns/programming-fns"
import type { getTrackFollowStateFn } from "@/server-fns/track-follow-fns"
export interface TrackDetailData {
  track: ProgrammingTrackWithOwner | null
  workouts: TrackWorkoutWithDetails[]
  days: Awaited<ReturnType<typeof getCrossFitTrackDaysFn>>
  selected: Awaited<ReturnType<typeof getCrossFitTrackDaysFn>>
  state: Awaited<ReturnType<typeof getTrackFollowStateFn>>
  date: string
  canManageImports: boolean
}
export function TrackDetailView({
  data,
  onChanged,
  onDateChange,
}: {
  data: TrackDetailData
  onChanged: () => void
  onDateChange: (date: string) => void
}) {
  const { track, workouts, days, selected, state, date, canManageImports } =
    data
  if (!track)
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-semibold">Track not found</h1>
        <a
          className="inline-flex min-h-11 items-center underline"
          href="/programming"
        >
          Back to tracks
        </a>
      </main>
    )
  const imported = new Set(
    days.flatMap((day) => day.workouts.map((workout) => workout.workoutId)),
  )
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 space-y-8">
      <a
        className="inline-flex min-h-11 items-center underline"
        href="/programming"
      >
        Back to tracks
      </a>
      <header className="space-y-4">
        <h1 className="break-words text-3xl font-semibold">{track.name}</h1>
        {track.description && (
          <p className="max-w-prose text-muted-foreground">
            {track.description}
          </p>
        )}
        <TrackFollowActions
          trackId={track.id}
          date={date}
          state={state}
          onChanged={() => {
            onChanged()
          }}
        />
      </header>
      {track.id === CROSSFIT_TRACK_ID && (
        <>
          <label className="block space-y-2" htmlFor="track-date">
            <span>Programming date</span>
            <input
              id="track-date"
              className="block min-h-11 w-full max-w-xs rounded-md border bg-background px-3"
              type="date"
              value={date}
              onChange={(e) => {
                if (sourceDateSchema.safeParse(e.target.value).success)
                  onDateChange(e.target.value)
              }}
            />
          </label>
          <CrossFitTrackDays
            days={selected}
            selectedDate={date}
            onAdd={
              state.trainingAvailable
                ? (ids) => {
                    const query = new URLSearchParams({
                      view: "training",
                      date,
                      workoutIds: ids.join(","),
                    })
                    if (state.following) query.set("trackId", track.id)
                    if (state.personalTeamId)
                      query.set("teamId", state.personalTeamId)
                    window.location.assign(`/training?${query}`)
                  }
                : undefined
            }
          />
          {!state.trainingAvailable && (
            <p className="text-sm text-muted-foreground">
              Training access is required to add workouts to your day.{" "}
              <a href="/settings" className="underline">
                View account settings
              </a>
              .
            </p>
          )}
          <section>
            <h2 className="text-xl font-semibold">Recent days</h2>
            <ul className="mt-3 divide-y">
              {days
                .filter((day) => day.date !== date)
                .map((day) => (
                  <li key={day.id}>
                    <a
                      className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3 underline"
                      href={`?date=${day.date}`}
                    >
                      <span>{providerDateLabel(day.date)}</span>
                      <span>
                        {day.kind === "rest"
                          ? "Rest day"
                          : `${day.workouts.length} workout${day.workouts.length === 1 ? "" : "s"}`}
                      </span>
                    </a>
                  </li>
                ))}
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">
              Latest 60 published days. Choose a date to view an earlier entry.
            </p>
          </section>
        </>
      )}
      <TrackFollowActions
        gymOnly
        trackId={track.id}
        date={date}
        state={state}
        onChanged={() => {
          onChanged()
        }}
      />
      {canManageImports && (
        <section aria-label="Admin" className="border-t pt-6">
          <h2 className="text-lg font-semibold">Admin</h2>
          <p className="text-sm text-muted-foreground">
            Only visible to site administrators
          </p>
          <a
            className="inline-flex min-h-11 items-center underline"
            href={`/admin/programming/${track.id}`}
          >
            Manage imports
          </a>
        </section>
      )}
      <details className="border-t pt-4">
        <summary className="min-h-11 cursor-pointer py-3 text-lg font-semibold">
          Workout library
        </summary>
        <ul className="divide-y">
          {workouts
            .filter((item) => !imported.has(item.workout.id))
            .map((item) => (
              <li key={item.id} className="py-4">
                <a
                  href={`/workouts/${item.workout.id}`}
                  className="inline-flex min-h-11 items-center break-words font-medium underline"
                >
                  {workoutTitle(item.workout.name)}
                </a>
                {item.workout.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {item.workout.description}
                  </p>
                )}
              </li>
            ))}
        </ul>
      </details>
    </main>
  )
}
