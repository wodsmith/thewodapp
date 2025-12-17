"use server"

import { createServerAction, ZSAError } from "@repo/zsa"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getDb } from "@/db"
import { teamMembershipTable } from "@/db/schema"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import {
	addVolunteerRoleType,
	createVolunteerSignup,
	getCompetitionVolunteers,
	grantScoreAccess,
	removeVolunteerRoleType,
	revokeScoreAccess,
} from "@/server/volunteers"
import { inviteUserToTeam } from "@/server/team-members"
import { requireTeamPermission } from "@/utils/team-auth"

/* -------------------------------------------------------------------------- */
/*                              Schemas                                        */
/* -------------------------------------------------------------------------- */

const membershipIdSchema = z
	.string()
	.startsWith("tmem_", "Invalid membership ID")
const competitionTeamIdSchema = z
	.string()
	.startsWith("team_", "Invalid team ID")
const volunteerRoleTypeSchema = z.enum([
	"judge",
	"head_judge",
	"scorekeeper",
	"emcee",
	"floor_manager",
	"media",
	"general",
])

const getCompetitionVolunteersSchema = z.object({
	competitionTeamId: competitionTeamIdSchema,
	organizingTeamId: competitionTeamIdSchema,
})

const addVolunteerRoleTypeSchema = z.object({
	membershipId: membershipIdSchema,
	organizingTeamId: competitionTeamIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	roleType: volunteerRoleTypeSchema,
})

const removeVolunteerRoleTypeSchema = z.object({
	membershipId: membershipIdSchema,
	organizingTeamId: competitionTeamIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	roleType: volunteerRoleTypeSchema,
})

const grantScoreAccessSchema = z.object({
	volunteerId: z.string().min(1, "Volunteer ID is required"),
	competitionTeamId: competitionTeamIdSchema,
	organizingTeamId: competitionTeamIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	grantedBy: z.string().min(1, "Granter ID is required"),
	expiresAt: z.date().optional(),
})

const revokeScoreAccessSchema = z.object({
	userId: z.string().min(1, "User ID is required"),
	competitionTeamId: competitionTeamIdSchema,
	organizingTeamId: competitionTeamIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
})

const updateVolunteerMetadataSchema = z.object({
	membershipId: membershipIdSchema,
	organizingTeamId: competitionTeamIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	metadata: z.record(z.unknown()),
})

/* -------------------------------------------------------------------------- */
/*                           Volunteer Actions                                 */
/* -------------------------------------------------------------------------- */

/**
 * Get all volunteers for a competition team
 */
export const getCompetitionVolunteersAction = createServerAction()
	.input(getCompetitionVolunteersSchema)
	.handler(async ({ input }) => {
		try {
			// Public read access - no permission check needed
			const db = getDb()
			const volunteers = await getCompetitionVolunteers(
				db,
				input.competitionTeamId,
			)
			return { success: true, data: volunteers }
		} catch (error) {
			console.error("Failed to get competition volunteers:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to get competition volunteers")
		}
	})

/**
 * Add a volunteer role type to a membership
 */
export const addVolunteerRoleTypeAction = createServerAction()
	.input(addVolunteerRoleTypeSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
			)

			const db = getDb()
			await addVolunteerRoleType(db, input.membershipId, input.roleType)

			revalidatePath(`/compete/organizer/${input.competitionId}/volunteers`)

			return { success: true }
		} catch (error) {
			console.error("Failed to add volunteer role type:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to add volunteer role type")
		}
	})

/**
 * Remove a volunteer role type from a membership
 */
export const removeVolunteerRoleTypeAction = createServerAction()
	.input(removeVolunteerRoleTypeSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
			)

			const db = getDb()
			await removeVolunteerRoleType(db, input.membershipId, input.roleType)

			revalidatePath(`/compete/organizer/${input.competitionId}/volunteers`)

			return { success: true }
		} catch (error) {
			console.error("Failed to remove volunteer role type:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to remove volunteer role type")
		}
	})

/**
 * Grant score input access to a volunteer
 */
export const grantScoreAccessAction = createServerAction()
	.input(grantScoreAccessSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
			)

			const db = getDb()
			await grantScoreAccess({
				db,
				volunteerId: input.volunteerId,
				competitionTeamId: input.competitionTeamId,
				competitionId: input.competitionId,
				grantedBy: input.grantedBy,
				expiresAt: input.expiresAt,
			})

			revalidatePath(`/compete/organizer/${input.competitionId}/volunteers`)

			return { success: true }
		} catch (error) {
			console.error("Failed to grant score access:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to grant score access")
		}
	})

/**
 * Revoke score input access from a user
 */
export const revokeScoreAccessAction = createServerAction()
	.input(revokeScoreAccessSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
			)

			const db = getDb()
			await revokeScoreAccess(db, input.userId, input.competitionTeamId)

			revalidatePath(`/compete/organizer/${input.competitionId}/volunteers`)

			return { success: true }
		} catch (error) {
			console.error("Failed to revoke score access:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to revoke score access")
		}
	})

/**
 * Update volunteer membership metadata
 * Generic metadata update for volunteer-specific fields
 */
export const updateVolunteerMetadataAction = createServerAction()
	.input(updateVolunteerMetadataSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
			)

			const db = getDb()

			// Fetch current membership
			const membership = await db.query.teamMembershipTable.findFirst({
				where: eq(teamMembershipTable.id, input.membershipId),
			})

			if (!membership) {
				throw new ZSAError("NOT_FOUND", "Membership not found")
			}

			// Merge metadata
			const currentMetadata = membership.metadata
				? JSON.parse(membership.metadata)
				: {}
			const updatedMetadata = {
				...currentMetadata,
				...input.metadata,
			}

			// Update membership
			await db
				.update(teamMembershipTable)
				.set({
					metadata: JSON.stringify(updatedMetadata),
					updatedAt: new Date(),
				})
				.where(eq(teamMembershipTable.id, input.membershipId))

			revalidatePath(`/compete/organizer/${input.competitionId}/volunteers`)

			return { success: true }
		} catch (error) {
			console.error("Failed to update volunteer metadata:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to update volunteer metadata")
		}
	})

/* -------------------------------------------------------------------------- */
/*                         Volunteer Invite Action                             */
/* -------------------------------------------------------------------------- */

const inviteVolunteerSchema = z.object({
	email: z.string().email("Invalid email address"),
	competitionTeamId: competitionTeamIdSchema,
	organizingTeamId: competitionTeamIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	roleTypes: z
		.array(volunteerRoleTypeSchema)
		.min(1, "Select at least one role"),
})

const submitVolunteerSignupSchema = z.object({
	competitionTeamId: competitionTeamIdSchema,
	signupName: z.string().min(1, "Name is required"),
	signupEmail: z.string().email("Invalid email address"),
	signupPhone: z.string().optional(),
	availabilityNotes: z.string().optional(),
	// Honeypot field for spam prevention
	website: z.string().optional(),
})

/**
 * Invite a volunteer to a competition
 *
 * This action checks permissions against the ORGANIZING team (not the competition team),
 * then invites the user to the COMPETITION team with the volunteer role.
 *
 * This is necessary because:
 * - The organizer is a member of the organizing team
 * - The competition team is a separate team for athletes/volunteers
 * - The organizer needs to invite users to the competition team
 */
export const inviteVolunteerAction = createServerAction()
	.input(inviteVolunteerSchema)
	.handler(async ({ input }) => {
		try {
			// Check permission against the ORGANIZING team (where the user has permissions)
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
			)

			// Create metadata for volunteer role types
			const metadata = {
				volunteerRoleTypes: input.roleTypes,
			}

			// Invite user to the COMPETITION team with volunteer role
			// We bypass the normal permission check in inviteUserToTeam by directly
			// using the server function after our own permission check above
			await inviteUserToTeam({
				teamId: input.competitionTeamId,
				email: input.email,
				roleId: "volunteer",
				isSystemRole: true,
				metadata: JSON.stringify(metadata),
				skipPermissionCheck: true, // We already checked against organizing team
			})

			revalidatePath(`/compete/organizer/${input.competitionId}/volunteers`)

			return { success: true }
		} catch (error) {
			console.error("Failed to invite volunteer:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to invite volunteer")
		}
	})

/* -------------------------------------------------------------------------- */
/*                      Public Volunteer Signup Action                         */
/* -------------------------------------------------------------------------- */

/**
 * Submit public volunteer signup form
 * No authentication required - this is a public form for volunteer interest
 */
export const submitVolunteerSignupAction = createServerAction()
	.input(submitVolunteerSignupSchema)
	.handler(async ({ input }) => {
		try {
			// Honeypot check - if filled, silently succeed (bot detection)
			if (input.website && input.website.trim() !== "") {
				return { success: true }
			}

			const db = getDb()
			const membership = await createVolunteerSignup({
				db,
				competitionTeamId: input.competitionTeamId,
				signupName: input.signupName,
				signupEmail: input.signupEmail,
				signupPhone: input.signupPhone,
				availabilityNotes: input.availabilityNotes,
			})

			return { success: true, membershipId: membership.id }
		} catch (error) {
			console.error("Failed to submit volunteer signup:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to submit volunteer signup")
		}
	})
