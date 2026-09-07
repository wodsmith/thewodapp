import { decodeScore } from "@/lib/scoring"
import type { TrainingScoreDetails } from "@/lib/training/types"

export function TrainingWorkoutResultDetails({
  details,
}: {
  details?: TrainingScoreDetails | null
}) {
  if (!details || (details.rounds.length < 2 && details.tiebreakValue === null))
    return null
  const options = {
    includeUnit: true,
    weightUnit: details.unit === "kg" ? ("kg" as const) : ("lbs" as const),
    distanceUnit:
      details.unit === "m" ||
      details.unit === "km" ||
      details.unit === "ft" ||
      details.unit === "mi"
        ? details.unit
        : undefined,
  }
  return (
    <details className="text-sm">
      <summary className="min-h-11 cursor-pointer py-3 font-medium">
        Score breakdown
      </summary>
      {details.rounds.length > 1 ? (
        <ol className="space-y-2 pb-3">
          {details.rounds.map((round) => (
            <li
              key={round.roundNumber}
              className="flex flex-wrap justify-between gap-2"
            >
              <span className="text-muted-foreground">
                Round {round.roundNumber}
              </span>
              <span className="tabular-nums">
                {round.status === "cap"
                  ? `CAP · ${round.secondaryValue ?? 0} reps completed`
                  : decodeScore(round.value, details.scheme, options)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {details.tiebreakValue !== null && details.tiebreakScheme ? (
        <p className="pb-3">
          Tiebreak: {decodeScore(details.tiebreakValue, details.tiebreakScheme)}
        </p>
      ) : null}
    </details>
  )
}
