import "server-only"
import { createId } from "@paralleldrive/cuid2"
import { and, count, eq, not } from "drizzle-orm"
import { ZSAError } from "zsa"
import {
	MAX_TEAMS_CREATED_PER_USER,
	MAX_TEAMS_JOINED_PER_USER,
} from "@/constants"
import { getDd } from "@/db"
import {
	SYSTEM_ROLES_ENUM,
	TEAM_PERMISSIONS,
	teamMembershipTable,
	teamRoleTable,
	teamTable,
} from "@/db/schema"
import { requireVerifiedEmail } from "@/utils/auth"
import { updateAllSessionsOfUser } from "@/utils/kv-session"
import { generateSlug } from "@/utils/slugify"
import { requireTeamPermission } from "@/utils/team-auth"

/**
 * Create a new team with the current user as owner
 */
export async function createTeam({
	name,
	description,
	avatarUrl,
}: {
	name: string
	description?: string
	avatarUrl?: string
}) {
	// Verify user is authenticated
	const session = await requireVerifiedEmail()
	if (!session) {
		throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
	}

	const userId = session.userId
	const db = getDd()

	// Check if user has reached their team creation limit
	const ownedTeamsCount = await db
		.select({ value: count() })
		.from(teamMembershipTable)
		.where(
			and(
				eq(teamMembershipTable.userId, userId),
				eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.OWNER),
				eq(teamMembershipTable.isSystemRole, 1),
			),
		)

	const teamsOwned = ownedTeamsCount[0]?.value || 0

	if (teamsOwned >= MAX_TEAMS_CREATED_PER_USER) {
		throw new ZSAError(
			"FORBIDDEN",
			`You have reached the limit of ${MAX_TEAMS_CREATED_PER_USER} teams you can create.`,
		)
	}

	// Generate unique slug for the team
	let slug = generateSlug(name)
	let slugIsUnique = false
	let attempts = 0

	// Make sure slug is unique
	while (!slugIsUnique && attempts < 5) {
		const existingTeam = await db.query.teamTable.findFirst({
			where: eq(teamTable.slug, slug),
		})

		if (!existingTeam) {
			slugIsUnique = true
		} else {
			// Add a random suffix to make the slug unique
			slug = `${generateSlug(name)}-${createId().substring(0, 4)}`
			attempts++
		}
	}

	if (!slugIsUnique) {
		throw new ZSAError("ERROR", "Could not generate a unique slug for the team")
	}

	// Insert the team
	const newTeam = (await db
		.insert(teamTable)
		.values({
			name,
			slug,
			description,
			avatarUrl,
			creditBalance: 0,
		})
		.returning()) as unknown as Array<typeof teamTable.$inferInsert>

	const team = Array.isArray(newTeam) ? newTeam[0] : undefined
	if (!team || !team.id) {
		throw new ZSAError("ERROR", "Could not create team")
	}

	const teamId: string = team.id

	// Add the creator as an owner
	await db.insert(teamMembershipTable).values({
		teamId,
		userId,
		roleId: SYSTEM_ROLES_ENUM.OWNER,
		isSystemRole: 1,
		invitedBy: userId,
		invitedAt: new Date(),
		joinedAt: new Date(),
		isActive: 1,
	})

	// Create default custom role for the team
	await db.insert(teamRoleTable).values({
		teamId,
		name: "Editor",
		description: "Can edit team content",
		permissions: [
			TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			TEAM_PERMISSIONS.CREATE_COMPONENTS,
			TEAM_PERMISSIONS.EDIT_COMPONENTS,
		],
		isEditable: 1,
	})

	// Update the user's session to include the new team
	await updateAllSessionsOfUser(userId)

	return {
		teamId,
		name,
		slug,
	}
}

/**
 * Update a team's details
 */
export async function updateTeam({
	teamId,
	data,
}: {
	teamId: string
	data: {
		name?: string
		description?: string
		avatarUrl?: string
		billingEmail?: string
		settings?: string
	}
}) {
	// Check if user has permission to update team settings
	await requireTeamPermission(teamId, TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS)

	const db = getDd()

	// If name is being updated, check if we need to update the slug
	if (data.name) {
		const currentTeam = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, teamId),
		})

		if (currentTeam && currentTeam.name !== data.name) {
			// Generate new slug based on the new name
			let newSlug = generateSlug(data.name)
			let slugIsUnique = false
			let attempts = 0

			while (!slugIsUnique && attempts < 5) {
				const existingTeam = await db.query.teamTable.findFirst({
					where: and(
						eq(teamTable.slug, newSlug),
						// Make sure we don't check against our own team
						not(eq(teamTable.id, teamId)),
					),
				})

				if (!existingTeam) {
					slugIsUnique = true
				} else {
					// Add a random suffix to make the slug unique
					newSlug = `${generateSlug(data.name)}-${createId().substring(0, 4)}`
					attempts++
				}
			}

			if (!slugIsUnique) {
				throw new ZSAError(
					"ERROR",
					"Could not generate a unique slug for the team",
				)
			}

			// Update team with new slug
			await db
				.update(teamTable)
				.set({
					...data,
					slug: newSlug,
				})
				.where(eq(teamTable.id, teamId))

			return { ...data, slug: newSlug }
		}
	}

	// Update team without changing slug
	await db.update(teamTable).set(data).where(eq(teamTable.id, teamId))

	return data
}

/**
 * Delete a team
 */
export async function deleteTeam(teamId: string) {
	// Check if user has permission to delete team
	await requireTeamPermission(teamId, TEAM_PERMISSIONS.DELETE_TEAM)

	const db = getDd()

	// Get all user IDs from the team memberships to update their sessions later
	const memberships = await db.query.teamMembershipTable.findMany({
		where: eq(teamMembershipTable.teamId, teamId),
		columns: {
			userId: true,
		},
	})

	const userIds = [...new Set(memberships.map((m) => m.userId))]

	// Delete team and related data
	// Note: In a real implementation, we might want to archive the team instead of deleting it
	await db.delete(teamTable).where(eq(teamTable.id, teamId))

	// Update sessions for all affected users
	for (const userId of userIds) {
		await updateAllSessionsOfUser(userId)
	}

	return { success: true }
}

/**
 * Get a team by ID
 */
export async function getTeam(teamId: string) {
	// Check if user is a member of this team
	await requireTeamPermission(teamId, TEAM_PERMISSIONS.ACCESS_DASHBOARD)

	const db = getDd()

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
	})

	if (!team) {
		throw new ZSAError("NOT_FOUND", "Team not found")
	}

	return team
}

/**
 * Get all team memberships for a specific user
 */
export async function getUserTeamMemberships(userId: string) {
	const db = getDd()

	const memberships = await db.query.teamMembershipTable.findMany({
		where: eq(teamMembershipTable.userId, userId),
		with: {
			team: true,
		},
	})

	return memberships
}

/**
 * Get all teams for current user
 */
export async function getUserTeams() {
	const session = await requireVerifiedEmail()

	if (!session) {
		throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
	}

	const db = getDd()

	const userTeams = await db.query.teamMembershipTable.findMany({
		where: eq(teamMembershipTable.userId, session.userId),
		with: {
			team: true,
		},
	})

	// This function doesn't enforce the MAX_TEAMS_JOINED_PER_USER limit directly
	// since it's just retrieving teams, but we use the constant here to show that
	// we're aware of the limit in the system
	if (userTeams.length > MAX_TEAMS_JOINED_PER_USER) {
		console.warn(
			`User ${session.userId} has exceeded the maximum teams limit: ${userTeams.length}/${MAX_TEAMS_JOINED_PER_USER}`,
		)
	}

	return userTeams.map((membership) => membership.team)
}

/**
 * Get teams owned by the current user
 */
export async function getOwnedTeams() {
	const session = await requireVerifiedEmail()

	if (!session) {
		throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
	}

	const db = getDd()

	const ownedTeams = await db.query.teamMembershipTable.findMany({
		where: and(
			eq(teamMembershipTable.userId, session.userId),
			eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.OWNER),
			eq(teamMembershipTable.isSystemRole, 1),
		),
		with: {
			team: true,
		},
	})

	return ownedTeams.map((membership) => membership.team)
}
