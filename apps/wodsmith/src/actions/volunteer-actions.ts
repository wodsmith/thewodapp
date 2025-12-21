"use server"

import { createServerAction, ZSAError } from "@repo/zsa"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getDb } from "@/db"
import {
	teamInvitationTable,
	teamMembershipTable,
	userTable,
} from "@/db/schema"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { VOLUNTEER_AVAILABILITY } from "@/db/schemas/volunteers"
import { inviteUserToTeam } from "@/server/team-members"
import {
	addVolunteerRoleType,
	approveVolunteerInvitation,
	createVolunteerSignup,
	getCompetitionVolunteers,
	grantScoreAccess,
	removeVolunteerRoleType,
	revokeScoreAccess,
} from "@/server/volunteers"
import { requireTeamPermission } from "@/utils/team-auth"

/* -------------------------------------------------------------------------- */
/*                              Schemas                                        */
/* -------------------------------------------------------------------------- */

const _membershipIdSchema = z
	.string()
	.startsWith("tmem_", "Invalid membership ID")
// Schema that accepts both membership IDs (tmem_) and invitation IDs (tinv_)
const membershipOrInvitationIdSchema = z
	.string()
	.refine(
		(val) => val.startsWith("tmem_") || val.startsWith("tinv_"),
		"Invalid membership or invitation ID",
	)
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
	"equipment",
	"medical",
	"check_in",
	"staff",
])

const getCompetitionVolunteersSchema = z.object({
	competitionTeamId: competitionTeamIdSchema,
	organizingTeamId: competitionTeamIdSchema,
})

const addVolunteerRoleTypeSchema = z.object({
	membershipId: membershipOrInvitationIdSchema,
	organizingTeamId: competitionTeamIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	roleType: volunteerRoleTypeSchema,
})

const removeVolunteerRoleTypeSchema = z.object({
	membershipId: membershipOrInvitationIdSchema,
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
	// Can be either membership ID (tmem_) for existing members or invitation ID (tinv_) for pending signups
	membershipId: z
		.string()
		.refine(
			(val) => val.startsWith("tmem_") || val.startsWith("tinv_"),
			"Invalid membership or invitation ID",
		),
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
 *
 * Handles both:
 * - Team memberships (tmem_*) - existing volunteers with accounts
 * - Team invitations (tinv_*) - pending volunteer signups
 */
export const updateVolunteerMetadataAction = createServerAction()
	.input(updateVolunteerMetadataSchema)
	.handler(async ({ input }) => {
		try {
			const { getSessionFromCookie } = await import("@/utils/auth")
			const session = await getSessionFromCookie()

			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "You must be logged in")
			}

			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
			)

			const db = getDb()
			const isInvitation = input.membershipId.startsWith("tinv_")
			const newMetadata = input.metadata as Record<string, unknown>

			// Check if status is changing to "approved"
			const isApprovingStatus = newMetadata.status === "approved"

			if (isInvitation) {
				// Handle invitation updates
				const invitation = await db.query.teamInvitationTable.findFirst({
					where: eq(teamInvitationTable.id, input.membershipId),
				})

				if (!invitation) {
					throw new ZSAError("NOT_FOUND", "Invitation not found")
				}

				// Parse current metadata
				const currentMetadata = invitation.metadata
					? (JSON.parse(invitation.metadata) as Record<string, unknown>)
					: {}

				const wasApproved =
					currentMetadata.status !== "approved" && isApprovingStatus

				if (wasApproved) {
					// Use the dedicated approval function which handles invitedBy and membership creation
					const updatedInvitation = await approveVolunteerInvitation({
						db,
						invitationId: input.membershipId,
						approverId: session.userId,
					})

					// Get volunteer email for notification
					const volunteerEmail = updatedInvitation.email
					const metadata = updatedInvitation.metadata
						? (JSON.parse(updatedInvitation.metadata) as Record<
								string,
								unknown
							>)
						: {}
					const volunteerName =
						(metadata.signupName as string | undefined) || "Volunteer"

					// Send approval email
					const { notifyVolunteerApproved } = await import(
						"@/server/notifications/compete"
					)
					notifyVolunteerApproved({
						volunteerEmail,
						volunteerName,
						competitionTeamId: updatedInvitation.teamId,
						roleTypes: metadata.volunteerRoleTypes as string[] | undefined,
					}).catch((err) => {
						console.error("Failed to send volunteer approved email:", err)
					})
				} else {
					// For non-approval updates (e.g., rejection), just update metadata
					const updatedMetadata = {
						...currentMetadata,
						...newMetadata,
					}

					await db
						.update(teamInvitationTable)
						.set({
							metadata: JSON.stringify(updatedMetadata),
							updatedAt: new Date(),
						})
						.where(eq(teamInvitationTable.id, input.membershipId))
				}
			} else {
				// Handle membership updates (existing flow)
				const membership = await db.query.teamMembershipTable.findFirst({
					where: eq(teamMembershipTable.id, input.membershipId),
					with: {
						user: true,
					},
				})

				if (!membership) {
					throw new ZSAError("NOT_FOUND", "Membership not found")
				}

				// Parse current and new metadata
				const currentMetadata = membership.metadata
					? (JSON.parse(membership.metadata) as Record<string, unknown>)
					: {}
				const updatedMetadata = {
					...currentMetadata,
					...newMetadata,
				}

				// Update membership
				await db
					.update(teamMembershipTable)
					.set({
						metadata: JSON.stringify(updatedMetadata),
						updatedAt: new Date(),
					})
					.where(eq(teamMembershipTable.id, input.membershipId))

				// Send approval email if status changed to approved
				const wasApproved =
					currentMetadata.status !== "approved" && isApprovingStatus

				if (wasApproved) {
					// Get volunteer email - either from user account or signup metadata
					let volunteerEmail: string | undefined
					let volunteerName = "Volunteer"

					// Try to get user info if membership has a userId
					if (membership.userId) {
						const user = await db.query.userTable.findFirst({
							where: eq(userTable.id, membership.userId),
						})
						if (user) {
							volunteerEmail = user.email ?? undefined
							volunteerName = user.firstName || volunteerName
						}
					}

					// Fall back to signup metadata if no user or no email
					if (!volunteerEmail) {
						volunteerEmail = currentMetadata.signupEmail as string | undefined
						volunteerName =
							(currentMetadata.signupName as string | undefined) ||
							volunteerName
					}

					if (volunteerEmail) {
						const { notifyVolunteerApproved } = await import(
							"@/server/notifications/compete"
						)
						notifyVolunteerApproved({
							volunteerEmail,
							volunteerName,
							competitionTeamId: membership.teamId,
							roleTypes: updatedMetadata.volunteerRoleTypes as
								| string[]
								| undefined,
						}).catch((err) => {
							console.error("Failed to send volunteer approved email:", err)
						})
					}
				}
			}

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
	availability: z
		.enum([
			VOLUNTEER_AVAILABILITY.MORNING,
			VOLUNTEER_AVAILABILITY.AFTERNOON,
			VOLUNTEER_AVAILABILITY.ALL_DAY,
		])
		.default(VOLUNTEER_AVAILABILITY.ALL_DAY),
	availabilityNotes: z.string().optional(),
	// Certifications/credentials (e.g., "CrossFit L1 Judge", "EMT")
	credentials: z.string().optional(),
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
				inviteSource: "direct" as const, // Admin directly invited - user accepts to join
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
/*                      Accept Volunteer Invite Action                          */
/* -------------------------------------------------------------------------- */

const acceptVolunteerInviteSchema = z.object({
	token: z.string().min(1, "Token is required"),
	availability: z
		.enum([
			VOLUNTEER_AVAILABILITY.MORNING,
			VOLUNTEER_AVAILABILITY.AFTERNOON,
			VOLUNTEER_AVAILABILITY.ALL_DAY,
		])
		.default(VOLUNTEER_AVAILABILITY.ALL_DAY),
	availabilityNotes: z.string().optional(),
	credentials: z.string().optional(),
	signupPhone: z.string().optional(),
})

/**
 * Accept a direct volunteer invitation with additional volunteer data
 *
 * This is used when an admin directly invites someone to volunteer.
 * The user provides their availability and credentials when accepting.
 */
export const acceptVolunteerInviteAction = createServerAction()
	.input(acceptVolunteerInviteSchema)
	.handler(async ({ input }) => {
		// Import here to avoid circular dependencies
		const { getSessionFromCookie } = await import("@/utils/auth")
		const { updateAllSessionsOfUser } = await import("@/utils/kv-session")
		const { and, eq, count } = await import("drizzle-orm")
		const { teamTable, SYSTEM_ROLES_ENUM } = await import("@/db/schema")

		const session = await getSessionFromCookie()
		if (!session) {
			throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
		}

		const db = getDb()

		// Find the invitation by token
		const invitation = await db.query.teamInvitationTable.findFirst({
			where: eq(teamInvitationTable.token, input.token),
		})

		if (!invitation) {
			throw new ZSAError("NOT_FOUND", "Invitation not found")
		}

		// Verify this is a volunteer invitation
		if (
			invitation.roleId !== SYSTEM_ROLES_ENUM.VOLUNTEER ||
			invitation.isSystemRole !== 1
		) {
			throw new ZSAError("ERROR", "This is not a volunteer invitation")
		}

		// Check if invitation has expired
		if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
			throw new ZSAError("ERROR", "Invitation has expired")
		}

		// Check if invitation was already accepted
		if (invitation.acceptedAt) {
			throw new ZSAError("CONFLICT", "Invitation has already been accepted")
		}

		// Check if user's email matches the invitation email (case-insensitive)
		if (session.user.email?.toLowerCase() !== invitation.email?.toLowerCase()) {
			throw new ZSAError(
				"FORBIDDEN",
				"This invitation is for a different email address",
			)
		}

		// Check if user is already a member
		const existingMembership = await db.query.teamMembershipTable.findFirst({
			where: and(
				eq(teamMembershipTable.teamId, invitation.teamId),
				eq(teamMembershipTable.userId, session.userId),
			),
		})

		if (existingMembership) {
			// Mark invitation as accepted
			await db
				.update(teamInvitationTable)
				.set({
					acceptedAt: new Date(),
					acceptedBy: session.userId,
					updatedAt: new Date(),
				})
				.where(eq(teamInvitationTable.id, invitation.id))

			throw new ZSAError(
				"CONFLICT",
				"You are already a volunteer for this competition",
			)
		}

		// Check if user has reached their team joining limit
		const MAX_TEAMS_JOINED_PER_USER = 100
		const teamsCountResult = await db
			.select({ value: count() })
			.from(teamMembershipTable)
			.where(eq(teamMembershipTable.userId, session.userId))

		const teamsJoined = teamsCountResult[0]?.value || 0

		if (teamsJoined >= MAX_TEAMS_JOINED_PER_USER) {
			throw new ZSAError(
				"FORBIDDEN",
				`You have reached the limit of ${MAX_TEAMS_JOINED_PER_USER} teams you can join.`,
			)
		}

		// Parse existing invitation metadata and merge with user-provided data
		let existingMetadata: Record<string, unknown> = {}
		if (invitation.metadata) {
			try {
				existingMetadata = JSON.parse(invitation.metadata)
			} catch {
				// Invalid JSON, ignore
			}
		}

		// Merge user-provided volunteer data with existing metadata
		const mergedMetadata = {
			...existingMetadata,
			availability: input.availability,
			availabilityNotes: input.availabilityNotes,
			credentials: input.credentials,
			signupPhone: input.signupPhone,
			// Mark as approved since user is accepting a direct invite
			status: "approved",
		}

		// Add user to the team with merged metadata
		await db.insert(teamMembershipTable).values({
			teamId: invitation.teamId,
			userId: session.userId,
			roleId: invitation.roleId,
			isSystemRole: Number(invitation.isSystemRole),
			invitedBy: invitation.invitedBy,
			invitedAt: invitation.createdAt
				? new Date(invitation.createdAt)
				: new Date(),
			joinedAt: new Date(),
			isActive: 1,
			metadata: JSON.stringify(mergedMetadata),
		})

		// Mark invitation as accepted
		await db
			.update(teamInvitationTable)
			.set({
				acceptedAt: new Date(),
				acceptedBy: session.userId,
				updatedAt: new Date(),
			})
			.where(eq(teamInvitationTable.id, invitation.id))

		// Update the user's session to include this team
		await updateAllSessionsOfUser(session.userId)

		// Get team to return competition info
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, invitation.teamId),
		})

		return {
			success: true,
			teamId: invitation.teamId,
			teamSlug: team?.slug,
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
				availability: input.availability,
				availabilityNotes: input.availabilityNotes,
				credentials: input.credentials,
			})

			// Send confirmation email (fire-and-forget, don't block on email delivery)
			const { notifyVolunteerSignupReceived } = await import(
				"@/server/notifications/compete"
			)
			notifyVolunteerSignupReceived({
				volunteerEmail: input.signupEmail,
				volunteerName: input.signupName,
				competitionTeamId: input.competitionTeamId,
			}).catch((err) => {
				console.error("Failed to send volunteer signup email:", err)
			})

			return { success: true, membershipId: membership.id }
		} catch (error) {
			console.error("Failed to submit volunteer signup:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to submit volunteer signup")
		}
	})

/* -------------------------------------------------------------------------- */
/*                      Bulk Volunteer Role Assignment                         */
/* -------------------------------------------------------------------------- */

const bulkAssignVolunteerRoleSchema = z.object({
	membershipIds: z
		.array(membershipOrInvitationIdSchema)
		.min(1, "Select at least one volunteer"),
	organizingTeamId: competitionTeamIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	roleType: volunteerRoleTypeSchema,
})

/**
 * Bulk assign a role type to multiple volunteers
 */
export const bulkAssignVolunteerRoleAction = createServerAction()
	.input(bulkAssignVolunteerRoleSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
			)

			const db = getDb()

			// Add role type to each volunteer (D1 doesn't support transactions)
			const results = await Promise.allSettled(
				input.membershipIds.map((membershipId) =>
					addVolunteerRoleType(db, membershipId, input.roleType),
				),
			)

			const succeeded = results.filter((r) => r.status === "fulfilled").length
			const failed = results.filter((r) => r.status === "rejected").length

			revalidatePath(`/compete/organizer/${input.competitionId}/volunteers`)

			return {
				success: true,
				succeeded,
				failed,
			}
		} catch (error) {
			console.error("Failed to bulk assign volunteer roles:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to assign roles")
		}
	})

/* -------------------------------------------------------------------------- */
/*                     Update Volunteer Profile Action                        */
/* -------------------------------------------------------------------------- */

const updateVolunteerProfileSchema = z.object({
	membershipId: z.string().startsWith("tmem_", "Invalid membership ID"),
	competitionSlug: z.string().min(1, "Competition slug is required"),
	availability: z
		.enum([
			VOLUNTEER_AVAILABILITY.MORNING,
			VOLUNTEER_AVAILABILITY.AFTERNOON,
			VOLUNTEER_AVAILABILITY.ALL_DAY,
		])
		.optional(),
	credentials: z.string().optional(),
	availabilityNotes: z.string().optional(),
})

/**
 * Update volunteer's own profile information
 * Self-service action for volunteers to update their availability and credentials
 */
export const updateVolunteerProfileAction = createServerAction()
	.input(updateVolunteerProfileSchema)
	.handler(async ({ input }) => {
		try {
			const { getSessionFromCookie } = await import("@/utils/auth")
			const session = await getSessionFromCookie()

			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "You must be logged in")
			}

			const db = getDb()

			// Get the membership to verify ownership
			const membership = await db.query.teamMembershipTable.findFirst({
				where: eq(teamMembershipTable.id, input.membershipId),
			})

			if (!membership) {
				throw new ZSAError("NOT_FOUND", "Membership not found")
			}

			// Verify the user owns this membership
			if (membership.userId !== session.userId) {
				throw new ZSAError("FORBIDDEN", "You can only update your own profile")
			}

			// Parse current metadata
			const currentMetadata = membership.metadata
				? (JSON.parse(membership.metadata) as Record<string, unknown>)
				: {}

			// Merge with new data - always update all fields (undefined = clear the field)
			const updatedMetadata = {
				...currentMetadata,
				availability: input.availability || currentMetadata.availability,
				credentials: input.credentials || undefined,
				availabilityNotes: input.availabilityNotes || undefined,
			}

			// Update membership
			await db
				.update(teamMembershipTable)
				.set({
					metadata: JSON.stringify(updatedMetadata),
					updatedAt: new Date(),
				})
				.where(eq(teamMembershipTable.id, input.membershipId))

			revalidatePath(`/compete/${input.competitionSlug}/my-schedule`)

			return { success: true }
		} catch (error) {
			console.error("Failed to update volunteer profile:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to update volunteer profile")
		}
	})
