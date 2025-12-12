export interface LeaderboardEntry {
  rank: number
  athleteId: string
  athleteName: string
  score: string
}

export async function getLeaderboard(competitionId: string) {
  return []
}
