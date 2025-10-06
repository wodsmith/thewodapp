"use client"

import type { LeaderboardEntry } from "@/server/leaderboard"
import { DailyLeaderboard } from "./daily-leaderboard"

interface WorkoutWithLeaderboardProps {
	leaderboard: LeaderboardEntry[]
}

export function WorkoutWithLeaderboard({
	leaderboard,
}: WorkoutWithLeaderboardProps) {
	return <DailyLeaderboard entries={leaderboard} />
}
