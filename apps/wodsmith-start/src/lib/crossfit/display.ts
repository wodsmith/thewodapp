export function providerDateLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`))
}
export function workoutTitle(name: string) {
  return name.replace(/[*_`#]/g, "").trim()
}
export function workoutScoring(workout: {
  scheme: string
  roundsToScore?: number | null
  scoreType?: string | null
  timeCap?: number | null
}) {
  const scheme =
    (
      {
        time: "For time",
        "time-with-cap": "For time",
        load: "Load",
        "rounds-reps": "Rounds and reps",
        reps: "Repetitions",
        calories: "Calories",
        meters: "Distance",
      } as Record<string, string>
    )[workout.scheme] ?? workout.scheme
  return [
    scheme,
    workout.roundsToScore && workout.roundsToScore > 1
      ? `${workout.roundsToScore} scores · ${workout.scoreType ?? "max"}`
      : null,
    workout.timeCap ? `${workout.timeCap / 60} minute cap` : null,
  ]
    .filter(Boolean)
    .join(" · ")
}
