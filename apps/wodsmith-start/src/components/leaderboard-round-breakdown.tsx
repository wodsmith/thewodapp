import type { CompetitionLeaderboardEntry } from "@/server-fns/leaderboard-fns"

// @lat: [[lat.md/domain#Domain Model#Scoring#Multi-round time caps]]
export function RoundBreakdown({
  result,
}: {
  result: CompetitionLeaderboardEntry["eventResults"][number]
}) {
  if (result.rawScore === null || result.rounds.length <= 1) return null

  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] leading-4 text-muted-foreground">
      {result.rounds.map((round) => (
        <span key={round.roundNumber} className="tabular-nums">
          R{round.roundNumber}:{" "}
          {round.status === "cap" ? (
            <>
              CAP ({round.formatted}
              {round.secondaryValue !== null
                ? `, ${round.secondaryValue} reps`
                : ""}
              )
            </>
          ) : (
            round.formatted
          )}
        </span>
      ))}
    </div>
  )
}
