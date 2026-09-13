import type { TrainingContentSnapshot, TrainingWorkoutSnapshot } from "@repo/wodsmith-db/schemas/training"

const prescriptions: Array<Pick<TrainingWorkoutSnapshot, "name" | "description" | "scheme" | "scoreType">> = [
  { name: "Engine builder", description: "4 rounds for time:\n400 m run\n20 air squats\n12 push-ups", scheme: "time", scoreType: "min" },
  { name: "Squat strength", description: "5 sets of 5 back squats. Build to a challenging, controlled final set. Rest 2–3 minutes between sets. Record the heaviest completed set.", scheme: "load", scoreType: "max" },
  { name: "Mixed modal", description: "AMRAP 15 minutes:\n250 m row\n12 kettlebell swings\n9 box step-ups", scheme: "rounds-reps", scoreType: "max" },
  { name: "Pull and carry", description: "5 rounds for time:\n10 ring rows\n12 alternating dumbbell snatches\n40 m farmer carry", scheme: "time", scoreType: "min" },
  { name: "Weekend endurance", description: "AMRAP 24 minutes:\n600 m run\n20 walking lunges\n15 sit-ups", scheme: "rounds-reps", scoreType: "max" },
  { name: "Row and press", description: "5 rounds for time:\n300 m row\n10 dumbbell push presses\n12 air squats", scheme: "time", scoreType: "min" },
  { name: "Hinge strength", description: "5 sets of 3 deadlifts. Build gradually with a controlled setup. Rest 2–3 minutes between sets. Record the heaviest completed set.", scheme: "load", scoreType: "max" },
  { name: "Bodyweight rounds", description: "AMRAP 18 minutes:\n5 pull-ups\n10 push-ups\n15 air squats", scheme: "rounds-reps", scoreType: "max" },
  { name: "Short intervals", description: "6 rounds:\n1 minute bike for calories\n1 minute rest\nRecord total calories across all six efforts.", scheme: "calories", scoreType: "max" },
  { name: "Long chipper", description: "For time:\n1,000 m row\n50 alternating step-ups\n40 sit-ups\n30 kettlebell swings\n20 push-ups\n800 m run", scheme: "time", scoreType: "min" },
  { name: "Dumbbell day", description: "AMRAP 16 minutes:\n10 dumbbell hang cleans\n12 front-rack lunges\n14 lateral hops", scheme: "rounds-reps", scoreType: "max" },
  { name: "Press strength", description: "5 sets of 5 strict presses. Rest 2 minutes between sets. Keep each repetition controlled and record the heaviest completed set.", scheme: "load", scoreType: "max" },
  { name: "Jump and pull", description: "5 rounds for time:\n40 single-unders\n12 ring rows\n16 goblet squats", scheme: "time", scoreType: "min" },
  { name: "Steady machine", description: "Row for 20 minutes at a sustainable pace. Record total distance in meters.", scheme: "meters", scoreType: "max" },
  { name: "Saturday circuit", description: "AMRAP 25 minutes:\n400 m run\n20 kettlebell deadlifts\n15 sit-ups\n10 burpees", scheme: "rounds-reps", scoreType: "max" },
  { name: "Repeatable pace", description: "4 rounds for time:\n500 m row\n15 wall-ball shots\n10 box step-ups", scheme: "time", scoreType: "min" },
  { name: "Front squat strength", description: "6 sets of 3 front squats. Rest 2–3 minutes between sets. Record the heaviest technically sound set.", scheme: "load", scoreType: "max" },
  { name: "Simple triplet", description: "AMRAP 14 minutes:\n8 dumbbell push presses\n10 ring rows\n12 alternating lunges", scheme: "rounds-reps", scoreType: "max" },
  { name: "Bike intervals", description: "8 rounds:\n45 seconds bike for calories\n75 seconds easy recovery\nRecord total work-interval calories.", scheme: "calories", scoreType: "max" },
  { name: "Team-day conditioning", description: "For time:\n800 m run\n30 goblet squats\n600 m run\n20 goblet squats\n400 m run\n10 goblet squats", scheme: "time", scoreType: "min" },
]

export function buildAdminTrainingDays(startDate: string, days = 61): Array<{ date: string; content: TrainingContentSnapshot }> {
  const start = new Date(`${startDate}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== startDate || !Number.isInteger(days) || days < 1 || days > 93) {
    throw new Error("Choose a valid start date and between 1 and 93 days")
  }
  const endDate = new Date(start.getTime() + (days - 1) * 86_400_000).toISOString().slice(0, 10)
  if (startDate < "2000-01-01" || startDate > "2100-12-31" || endDate > "2100-12-31") {
    throw new Error("Training dates must stay within 2000–2100")
  }
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * 86_400_000)
    const label = date.toISOString().slice(0, 10)
    const weekday = date.getUTCDay()
    const rest = weekday === 0 || weekday === 4
    const week = Math.floor(index / 7)
    const slot = [1, 2, 3, 5, 6].indexOf(weekday)
    const definition = prescriptions[(week % 4) * 5 + Math.max(slot, 0)]
    const workout: TrainingWorkoutSnapshot = {
      ...definition,
      scope: "private",
      roundsToScore: 1,
      timeCapSeconds: null,
      repsPerRound: null,
      tiebreakScheme: null,
      scalingGroupId: null,
      movementIds: [],
    }
    return {
      date: label,
      content: {
        title: rest ? "Rest and recovery" : `Week ${week + 1} · ${definition.name}`,
        coachNote: "Demo training programming. Adapt movement choices, loading, and volume with your coach.",
        isRestDay: rest,
        blocks: rest ? [] : [
          { id: `warmup_${label}`, kind: "check", title: "Warm-up", prescription: "5 minutes easy cardio, then 2 rounds of 10 air squats, 8 ring rows, and 6 alternating lunges. Build through light practice sets of today's movements.", scalingGuidance: "Use a comfortable range of motion and an easy pace.", coachGuidance: "Prepare the day's movements before increasing intensity." },
          { id: `workout_${label}`, kind: "workout", title: workout.name, prescription: workout.description, workout, scalingGuidance: "Choose loads and movement variations that allow steady technique. Substitute ring rows for pull-ups and step-ups for jumping; reduce reps or duration as needed.", coachGuidance: "Use repeatable pacing and record the performed variation with your score." },
          { id: `cooldown_${label}`, kind: "check", title: "Cool-down", prescription: "3–5 minutes easy walking or cycling, followed by relaxed mobility for the muscles used today.", scalingGuidance: "Keep the effort comfortable.", coachGuidance: "Record any training notes privately." },
        ],
      },
    }
  })
}
