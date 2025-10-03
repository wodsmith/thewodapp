"use client"

import type { LeaderboardEntry } from "@/server/leaderboard"
import type { ScheduledWorkoutInstanceWithDetails } from "@/server/scheduling-service"
import { DailyLeaderboard } from "./daily-leaderboard"

interface Team {
	id: string
	name: string
	isPersonalTeam?: number | boolean
}

interface WorkoutWithLeaderboardProps {
	workout: ScheduledWorkoutInstanceWithDetails
	leaderboard: LeaderboardEntry[]
	team: Team
}

export function WorkoutWithLeaderboard({
	leaderboard,
}: WorkoutWithLeaderboardProps) {
	return <DailyLeaderboard entries={leaderboard} />
}
