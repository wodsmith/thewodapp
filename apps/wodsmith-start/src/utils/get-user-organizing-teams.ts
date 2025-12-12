/**
 * Team that a user can organize competitions for
 */
export type OrganizingTeam = {
	id: string
	name: string
}

/**
 * Get teams that a user is an organizer for (has competition hosting access)
 * Stub implementation for TanStack Start migration
 */
export async function getUserOrganizingTeams(
	userId: string,
): Promise<OrganizingTeam[]> {
	// TODO: Implement actual team lookup
	return []
}
