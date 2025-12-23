import type {LeaderboardEntry} from '@/server-fns/team-fns'
import {DailyLeaderboard} from './daily-leaderboard'

interface WorkoutWithLeaderboardProps {
  leaderboard: LeaderboardEntry[]
}

export function WorkoutWithLeaderboard({
  leaderboard,
}: WorkoutWithLeaderboardProps) {
  return <DailyLeaderboard entries={leaderboard} />
}
