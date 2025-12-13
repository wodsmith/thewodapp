import "server-only"
import { cache } from "react"
import { FEATURES } from "@/config/features"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { hasFeature } from "@/server/entitlements"
import { getSessionFromCookie } from "@/utils/auth"

export interface OrganizingTeam {
	id: string
	name: string
	slug: string | null
	type: string
}

/**
 * Get teams where the current user has MANAGE_PROGRAMMING permission
 * AND the team has the HOST_COMPETITIONS feature enabled
 * These are the teams that can organize competitions
 */
export const getUserOrganizingTeams = cache(
	async (): Promise<OrganizingTeam[]> => {
		const session = await getSessionFromCookie()

		if (!session?.teams) {
			return []
		}

		// Filter teams where user has MANAGE_PROGRAMMING permission
		const teamsWithPermission = session.teams.filter((team) =>
			team.permissions.includes(TEAM_PERMISSIONS.MANAGE_PROGRAMMING),
		)

		// Check each team for HOST_COMPETITIONS feature
		const teamsWithFeature = await Promise.all(
			teamsWithPermission.map(async (team) => {
				const canHost = await hasFeature(team.id, FEATURES.HOST_COMPETITIONS)
				return canHost ? team : null
			}),
		)

		return teamsWithFeature
			.filter((team): team is NonNullable<typeof team> => team !== null)
			.map((team) => ({
				id: team.id,
				name: team.name,
				type: team.type,
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
