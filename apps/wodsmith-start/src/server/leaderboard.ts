/**
 * Leaderboard Server Module (Stub)
 * TODO: Implement full functionality
 */

export interface LeaderboardEntry {
	rank: number
	userId: string
	userName: string
	score: number
	time?: number
}

export async function getLeaderboard(
	_workoutId: string,
	_options?: { limit?: number },
): Promise<LeaderboardEntry[]> {
	return []
}

export async function getUserRank(
	_workoutId: string,
	_userId: string,
): Promise<number | null> {
	return null
}
