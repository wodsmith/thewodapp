/**
 * Team Server Functions for TanStack Start
 * Functions for team page features (leaderboards, team info)
 */

import { createServerFn } from "@tanstack/react-start"
import { and, desc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { scoresTable } from "@/db/schemas/scores"
import { teamMembershipTable, teamTable } from "@/db/schemas/teams"
import { userTable } from "@/db/schemas/users"
import { getSessionFromCookie } from "@/utils/auth"

// ===========================
// Type Definitions
// ===========================

export interface LeaderboardEntry {
	rank: number
	userId: string
	userName: string
	scoreValue: number | null
	displayScore: string
	asRx: boolean
	scalingLabel: string | null
}

export interface TeamWithRole {
	id: string
	name: string
	slug: string
	description: string | null
	avatarUrl: string | null
	type: string
	role: string
	isSystemRole: boolean
}

// ===========================
// Input Schemas
// ===========================

const getTeamLeaderboardsInputSchema = z.object({
	scheduledWorkoutInstanceIds: z.array(z.string()).min(1),
	teamId: z.string().min(1, "Team ID is required"),
})

const getActiveTeamInputSchema = z.object({
	userId: z.string().min(1, "User ID is required"),
})

const getTeamSlugInputSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

// ===========================
// Helper Functions
// ===========================

/**
 * Format score value for display based on scheme
 */
function formatScoreValue(scoreValue: number | null, scheme: string): string {
	if (scoreValue === null) return "No score"

	switch (scheme) {
		case "time":
		case "time-with-cap": {
			// Time is stored in milliseconds
			const totalSeconds = Math.floor(scoreValue / 1000)
			const minutes = Math.floor(totalSeconds / 60)
			const seconds = totalSeconds % 60
			return `${minutes}:${seconds.toString().padStart(2, "0")}`
		}
		case "rounds-reps": {
			// Encoded as rounds * 100000 + reps
			const rounds = Math.floor(scoreValue / 100000)
			const reps = scoreValue % 100000
			return `${rounds}+${reps}`
		}
		case "reps":
			return `${scoreValue} reps`
		case "load": {
			// Load is stored in grams, convert to lbs
			const lbs = Math.round(scoreValue / 453.592)
			return `${lbs} lbs`
		}
		case "calories":
			return `${scoreValue} cal`
		case "meters":
			return `${scoreValue} m`
		case "feet":
			return `${scoreValue} ft`
		case "points":
			return `${scoreValue} pts`
		default:
			return String(scoreValue)
	}
}

/**
 * Determine if a score scheme should be sorted ascending (lower is better)
 */
function isLowerBetter(scheme: string, scoreType: string | null): boolean {
	// Time-based schemes: lower is better
	if (scheme === "time" || scheme === "time-with-cap") {
		return true
	}
	// Use scoreType if available
	if (scoreType === "min") {
		return true
	}
	// Default: higher is better
	return false
}

// ===========================
// Server Functions
// ===========================

/**
 * Get leaderboards for multiple scheduled workout instances
 * Returns a map of instance ID to leaderboard entries
 */
export const getTeamLeaderboardsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getTeamLeaderboardsInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Validate that we have instance IDs
		if (data.scheduledWorkoutInstanceIds.length === 0) {
			return { leaderboards: {} }
		}

		// Get all scores for these scheduled instances
		const scores = await db
			.select({
				scoreId: scoresTable.id,
				userId: scoresTable.userId,
				scoreValue: scoresTable.scoreValue,
				scheme: scoresTable.scheme,
				scoreType: scoresTable.scoreType,
				asRx: scoresTable.asRx,
				scheduledWorkoutInstanceId: scoresTable.scheduledWorkoutInstanceId,
				userName: userTable.firstName,
				userLastName: userTable.lastName,
				scalingLabel: scalingLevelsTable.label,
			})
			.from(scoresTable)
			.innerJoin(userTable, eq(scoresTable.userId, userTable.id))
			.leftJoin(
				scalingLevelsTable,
				eq(scoresTable.scalingLevelId, scalingLevelsTable.id),
			)
			.where(
				and(
					inArray(
						scoresTable.scheduledWorkoutInstanceId,
						data.scheduledWorkoutInstanceIds,
					),
					eq(scoresTable.teamId, data.teamId),
				),
			)

		// Group scores by scheduled instance ID
		const scoresByInstance = new Map<
			string,
			Array<{
				userId: string
				userName: string
				scoreValue: number | null
				scheme: string
				scoreType: string | null
				asRx: boolean
				scalingLabel: string | null
			}>
		>()

		for (const score of scores) {
			if (!score.scheduledWorkoutInstanceId) continue

			const fullName =
				`${score.userName || ""} ${score.userLastName || ""}`.trim()

			const entry = {
				userId: score.userId,
				userName: fullName || "Unknown",
				scoreValue: score.scoreValue,
				scheme: score.scheme,
				scoreType: score.scoreType,
				asRx: score.asRx,
				scalingLabel: score.scalingLabel,
			}

			const instanceScores =
				scoresByInstance.get(score.scheduledWorkoutInstanceId) || []
			instanceScores.push(entry)
			scoresByInstance.set(score.scheduledWorkoutInstanceId, instanceScores)
		}

		// Build leaderboards for each instance
		const leaderboards: Record<string, LeaderboardEntry[]> = {}

		for (const [instanceId, instanceScores] of scoresByInstance.entries()) {
			// Determine sort order from first score (all should have same scheme)
			const sortAscending =
				instanceScores.length > 0
					? isLowerBetter(instanceScores[0].scheme, instanceScores[0].scoreType)
					: false

			// Sort scores
			const sortedScores = [...instanceScores].sort((a, b) => {
				// First by asRx (Rx before scaled)
				if (a.asRx !== b.asRx) {
					return a.asRx ? -1 : 1
				}

				// Then by score value
				if (a.scoreValue === null && b.scoreValue === null) return 0
				if (a.scoreValue === null) return 1
				if (b.scoreValue === null) return -1

				if (sortAscending) {
					return a.scoreValue - b.scoreValue
				} else {
					return b.scoreValue - a.scoreValue
				}
			})

			// Add ranks and format
			leaderboards[instanceId] = sortedScores.map((score, index) => ({
				rank: index + 1,
				userId: score.userId,
				userName: score.userName,
				scoreValue: score.scoreValue,
				displayScore: formatScoreValue(score.scoreValue, score.scheme),
				asRx: score.asRx,
				scalingLabel: score.scalingLabel,
			}))
		}

		return { leaderboards }
	})

/**
 * Get user's active team info with role and permissions
 */
export const getActiveTeamFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getActiveTeamInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Get session to verify user is authenticated
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Verify the user ID matches the session
		if (session.userId !== data.userId) {
			throw new Error("Unauthorized")
		}

		// Get user's team memberships
		const memberships = await db
			.select({
				teamId: teamMembershipTable.teamId,
				roleId: teamMembershipTable.roleId,
				isSystemRole: teamMembershipTable.isSystemRole,
				isActive: teamMembershipTable.isActive,
				teamName: teamTable.name,
				teamSlug: teamTable.slug,
				teamDescription: teamTable.description,
				teamAvatarUrl: teamTable.avatarUrl,
				teamType: teamTable.type,
			})
			.from(teamMembershipTable)
			.innerJoin(teamTable, eq(teamMembershipTable.teamId, teamTable.id))
			.where(
				and(
					eq(teamMembershipTable.userId, data.userId),
					eq(teamMembershipTable.isActive, 1),
				),
			)
			.orderBy(desc(teamMembershipTable.joinedAt))
			.limit(1)

		if (memberships.length === 0) {
			return { team: null }
		}

		const membership = memberships[0]

		const team: TeamWithRole = {
			id: membership.teamId,
			name: membership.teamName,
			slug: membership.teamSlug,
			description: membership.teamDescription,
			avatarUrl: membership.teamAvatarUrl,
			type: membership.teamType || "gym",
			role: membership.roleId,
			isSystemRole: Boolean(membership.isSystemRole),
		}

		return { team }
	})

/**
 * Get team slug by team ID
 * Used for redirects (e.g., Stripe connection redirect)
 */
export const getTeamSlugFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getTeamSlugInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, data.teamId),
			columns: { slug: true },
		})

		return team?.slug ?? null
	})

/**
 * Get the active team ID from cookie or fallback to first team
 *
 * This is the server function wrapper for getActiveTeamId from team-auth.ts.
 * Use this in route loaders to get the current user's active team.
 *
 * Priority:
 * 1. Cookie value (if user is still a member of that team)
 * 2. First team in session (fallback)
 * 3. null (if no teams)
 */
export const getActiveTeamIdFn = createServerFn({ method: "GET" }).handler(
	async () => {
		// Use dynamic import to avoid bundling issues
		const { getActiveTeamId } = await import("@/utils/team-auth")
		return getActiveTeamId()
	},
)

/**
 * Get teams that can organize competitions
 *
 * Returns teams that:
 * 1. Are NOT personal teams (isPersonalTeam === false)
 * 2. Have the HOST_COMPETITIONS feature enabled
 * 3. Are deduplicated by team ID (prevents display issues from DB duplicates)
 *
 * Used by the organizer dashboard team dropdown.
 *
 * Uses the session's cached plan features for faster checks. The session plan
 * is populated from the database when the session is created/refreshed.
 *
 * Note: If a user submits an organizer request (which grants HOST_COMPETITIONS),
 * the session is refreshed via invalidateTeamMembersSessions, so the cached
 * plan features will be up-to-date.
 */
export const getOrganizerTeamsFn = createServerFn({ method: "GET" }).handler(
	async () => {
		// Use dynamic imports to avoid bundling cloudflare:workers into client
		const { getSessionFromCookie } = await import("@/utils/auth")
		const { FEATURES } = await import("@/config/features")

		const session = await getSessionFromCookie()
		if (!session?.teams?.length) {
			return { teams: [] }
		}

		// Filter teams that can organize
		const organizerTeams: Array<{ id: string; name: string }> = []
		const seenTeamIds = new Set<string>()

		for (const team of session.teams) {
			// Skip if already processed (deduplication)
			if (seenTeamIds.has(team.id)) {
				continue
			}
			seenTeamIds.add(team.id)

			// Skip personal teams
			if (team.isPersonalTeam) {
				continue
			}

			// Check if team has HOST_COMPETITIONS feature via cached plan
			// This is faster than hitting the database for each team
			const canHost =
				team.plan?.features?.includes(FEATURES.HOST_COMPETITIONS) ?? false
			if (canHost) {
				organizerTeams.push({
					id: team.id,
					name: team.name,
				})
			}
		}

		return { teams: organizerTeams }
	},
)
