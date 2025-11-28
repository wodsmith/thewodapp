import "server-only"
import { cache } from "react"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getSessionFromCookie } from "@/utils/auth"

export interface OrganizingTeam {
	id: string
	name: string
	slug: string | null
}

/**
 * Get teams where the current user has MANAGE_PROGRAMMING permission
 * These are the teams that can organize competitions
 */
export const getUserOrganizingTeams = cache(
	async (): Promise<OrganizingTeam[]> => {
		const session = await getSessionFromCookie()

		if (!session?.teams) {
			return []
		}

		// Filter teams where user has MANAGE_PROGRAMMING permission
		return session.teams
			.filter((team) =>
				team.permissions.includes(TEAM_PERMISSIONS.MANAGE_PROGRAMMING),
			)
			.map((team) => ({
				id: team.id,
				name: team.name,
				slug: team.slug,
			}))
	},
)

/**
 * Check if user can organize competitions for any team
 */
export const canOrganizeCompetitions = cache(async (): Promise<boolean> => {
	const teams = await getUserOrganizingTeams()
	return teams.length > 0
})

/**
 * Check if user can organize competitions for a specific team
 */
export const canOrganizeForTeam = cache(
	async (teamId: string): Promise<boolean> => {
		const teams = await getUserOrganizingTeams()
		return teams.some((team) => team.id === teamId)
	},
)
