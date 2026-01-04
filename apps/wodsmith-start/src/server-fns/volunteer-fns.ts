/**
 * Volunteer Management Server Functions for TanStack Start
 * Functions for managing competition volunteers and their permissions
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import type { TeamMembership, User } from "@/db/schema"
import {
	entitlementTable,
	entitlementTypeTable,
	SYSTEM_ROLES_ENUM,
	teamInvitationTable,
	teamMembershipTable,
	userTable,
} from "@/db/schema"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import type { VolunteerMembershipMetadata } from "@/db/schemas/volunteers"
import { VOLUNTEER_AVAILABILITY } from "@/db/schemas/volunteers"
import { createEntitlement } from "@/server/entitlements"
import { inviteUserToTeam } from "@/server/team-members"
import {
	calculateInviteStatus,
	isDirectInvite,
	isVolunteer,
} from "@/server/volunteers"
import { getSessionFromCookie } from "@/utils/auth"
import { autochunk } from "@/utils/batch-query"
import { requireTeamPermission } from "@/utils/team-auth"

// ============================================================================
// Constants
// ============================================================================

/** Entitlement type ID for competition score input access */
const SCORE_INPUT_TYPE_ID = "competition_score_input"

// ============================================================================
// Types
// ============================================================================

/** Membership with user relation included for volunteer queries */
export type TeamMembershipWithUser = TeamMembership & {
	user: User | null
}

/** Return type for direct volunteer invites */
export type DirectVolunteerInvite = {
	id: string
	token: string
	email: string
	name: string | null
	roleTypes: string[]
	status: "pending" | "accepted" | "expired"
	createdAt: Date
	expiresAt: Date | null
	acceptedAt: Date | null
}

// ============================================================================
// Input Schemas
// ============================================================================

const competitionTeamIdSchema = z
	.string()
	.startsWith("team_", "Invalid team ID")

const membershipOrInvitationIdSchema = z
	.string()
	.refine(
		(val) => val.startsWith("tmem_") || val.startsWith("tinv_"),
		"Invalid membership or invitation ID",
	)

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

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get pending volunteer invitations (not yet accepted/converted to memberships)
 */
export const getPendingVolunteerInvitationsFn = createServerFn({
	method: "GET",
})
	.inputValidator((data: unknown) =>
		z.object({ competitionTeamId: competitionTeamIdSchema }).parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()
		return db.query.teamInvitationTable.findMany({
			where: and(
				eq(teamInvitationTable.teamId, data.competitionTeamId),
				eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
				eq(teamInvitationTable.isSystemRole, 1),
				isNull(teamInvitationTable.acceptedAt),
			),
		})
	})

/**
 * Get all team members with volunteer role for a competition team
 */
export const getCompetitionVolunteersFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z.object({ competitionTeamId: competitionTeamIdSchema }).parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()
		return db.query.teamMembershipTable.findMany({
			where: and(
				eq(teamMembershipTable.teamId, data.competitionTeamId),
				eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
				eq(teamMembershipTable.isSystemRole, 1),
			),
			with: {
				user: true,
			},
		}) as unknown as Promise<TeamMembershipWithUser[]>
	})

/**
 * Get direct volunteer invitations (admin-invited, not public applications)
 */
export const getDirectVolunteerInvitesFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z.object({ competitionTeamId: competitionTeamIdSchema }).parse(data),
	)
	.handler(async ({ data }): Promise<DirectVolunteerInvite[]> => {
		const db = getDb()

		// Get all volunteer invitations for this team
		const invitations = await db.query.teamInvitationTable.findMany({
			where: and(
				eq(teamInvitationTable.teamId, data.competitionTeamId),
				eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
				eq(teamInvitationTable.isSystemRole, 1),
			),
		})

		// Filter to only direct invites (admin-initiated)
		const directInvites = invitations.filter((inv) => {
			try {
				const meta = JSON.parse(
					inv.metadata || "{}",
				) as VolunteerMembershipMetadata
				return isDirectInvite(meta, inv.invitedBy)
			} catch {
				return isDirectInvite(null, inv.invitedBy)
			}
		})

		// Map to return type with calculated status
		return directInvites
			.map((inv) => {
				let roleTypes: string[] = []
				let inviteName: string | null = null
				try {
					const meta = JSON.parse(
						inv.metadata || "{}",
					) as VolunteerMembershipMetadata & { inviteName?: string }
					roleTypes = meta.volunteerRoleTypes ?? []
					inviteName = meta.inviteName ?? null
				} catch {
					// Invalid metadata, leave roleTypes empty
				}

				return {
					id: inv.id,
					token: inv.token,
					email: inv.email,
					name: inviteName,
					roleTypes,
					status: calculateInviteStatus(inv.acceptedAt, inv.expiresAt),
					createdAt: inv.createdAt,
					expiresAt: inv.expiresAt,
					acceptedAt: inv.acceptedAt,
				}
			})
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
	})

/**
 * Check if a user can input scores for a competition team
 */
export const canInputScoresFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				userId: z.string(),
				competitionTeamId: competitionTeamIdSchema,
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()
		const entitlements = await db.query.entitlementTable.findMany({
			where: and(
				eq(entitlementTable.userId, data.userId),
				eq(entitlementTable.teamId, data.competitionTeamId),
				eq(entitlementTable.entitlementTypeId, SCORE_INPUT_TYPE_ID),
				isNull(entitlementTable.deletedAt),
				or(
					isNull(entitlementTable.expiresAt),
					gt(entitlementTable.expiresAt, new Date()),
				),
			),
		})
		return entitlements.length > 0
	})

// ============================================================================
// Mutation Functions
// ============================================================================

/**
 * Submit public volunteer signup form
 * No authentication required - this is a public form for volunteer interest
 */
export const submitVolunteerSignupFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
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
				credentials: z.string().optional(),
				website: z.string().optional(), // Honeypot
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		// Honeypot check - if filled, silently succeed (bot detection)
		if (data.website && data.website.trim() !== "") {
			return { success: true }
		}

		const db = getDb()

		// Check for duplicate email sign-up
		const existingInvitations = await db.query.teamInvitationTable.findMany({
			where: and(
				eq(teamInvitationTable.teamId, data.competitionTeamId),
				eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
				eq(teamInvitationTable.isSystemRole, 1),
			),
		})

		// Check for matching email (case-insensitive)
		for (const invitation of existingInvitations) {
			if (invitation.email.toLowerCase() === data.signupEmail.toLowerCase()) {
				throw new Error(
					"This email has already been used to sign up as a volunteer for this competition",
				)
			}
		}

		// Also check if there's already an accepted membership with this email
		const existingUser = await db.query.userTable.findFirst({
			where: eq(userTable.email, data.signupEmail),
		})

		if (existingUser) {
			const existingMembership = await db.query.teamMembershipTable.findFirst({
				where: and(
					eq(teamMembershipTable.teamId, data.competitionTeamId),
					eq(teamMembershipTable.userId, existingUser.id),
					eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
					eq(teamMembershipTable.isSystemRole, 1),
				),
			})

			if (existingMembership) {
				throw new Error(
					"An account with this email is already volunteering for this competition",
				)
			}
		}

		// Create volunteer signup metadata
		const metadata: VolunteerMembershipMetadata = {
			volunteerRoleTypes: [],
			credentials: data.credentials,
			availability: data.availability,
			status: "pending",
			inviteSource: "application",
			signupEmail: data.signupEmail,
			signupName: data.signupName,
			signupPhone: data.signupPhone,
			availabilityNotes: data.availabilityNotes,
		}

		// Create team invitation for volunteer signup
		const oneYearFromNow = new Date()
		oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)

		const newInvitation = await db
			.insert(teamInvitationTable)
			.values({
				teamId: data.competitionTeamId,
				email: data.signupEmail,
				roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
				isSystemRole: 1,
				token: crypto.randomUUID(),
				invitedBy: null,
				expiresAt: oneYearFromNow,
				metadata: JSON.stringify(metadata),
			})
			.returning()

		const invitation = newInvitation[0]
		if (!invitation) {
			throw new Error("Failed to create volunteer invitation")
		}

		return { success: true, membershipId: invitation.id }
	})

/**
 * Invite a volunteer to a competition (admin action)
 */
export const inviteVolunteerFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				name: z.string().optional(),
				email: z.string().email("Invalid email address"),
				competitionTeamId: competitionTeamIdSchema,
				organizingTeamId: competitionTeamIdSchema,
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
				roleTypes: z
					.array(volunteerRoleTypeSchema)
					.min(1, "Select at least one role"),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireTeamPermission(
			data.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const metadata: {
			volunteerRoleTypes: typeof data.roleTypes
			inviteSource: "direct"
			inviteName?: string
			inviteEmail: string
		} = {
			volunteerRoleTypes: data.roleTypes,
			inviteSource: "direct" as const,
			inviteEmail: data.email,
		}

		// Store name if provided for display before user signs up
		if (data.name) {
			metadata.inviteName = data.name
		}

		await inviteUserToTeam({
			teamId: data.competitionTeamId,
			email: data.email,
			roleId: "volunteer",
			isSystemRole: true,
			metadata: JSON.stringify(metadata),
			skipPermissionCheck: true,
		})

		return { success: true }
	})

/**
 * Add a volunteer role type to a membership
 */
export const addVolunteerRoleTypeFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				membershipId: membershipOrInvitationIdSchema,
				organizingTeamId: competitionTeamIdSchema,
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
				roleType: volunteerRoleTypeSchema,
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireTeamPermission(
			data.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const db = getDb()
		const isInvitation = data.membershipId.startsWith("tinv_")

		if (isInvitation) {
			const invitation = await db.query.teamInvitationTable.findFirst({
				where: eq(teamInvitationTable.id, data.membershipId),
			})

			if (!invitation) {
				throw new Error(`Invitation ${data.membershipId} not found`)
			}

			let metadata: VolunteerMembershipMetadata
			try {
				metadata = invitation.metadata
					? (JSON.parse(invitation.metadata) as VolunteerMembershipMetadata)
					: { volunteerRoleTypes: [] }
			} catch {
				metadata = { volunteerRoleTypes: [] }
			}

			const currentRoleTypes = metadata.volunteerRoleTypes ?? []
			if (currentRoleTypes.includes(data.roleType)) {
				return { success: true }
			}

			metadata.volunteerRoleTypes = [...currentRoleTypes, data.roleType]

			await db
				.update(teamInvitationTable)
				.set({ metadata: JSON.stringify(metadata), updatedAt: new Date() })
				.where(eq(teamInvitationTable.id, data.membershipId))
		} else {
			const membership = await db.query.teamMembershipTable.findFirst({
				where: eq(teamMembershipTable.id, data.membershipId),
			})

			if (!membership) {
				throw new Error(`Membership ${data.membershipId} not found`)
			}

			if (!isVolunteer(membership)) {
				throw new Error(
					"Cannot add volunteer role type to non-volunteer membership",
				)
			}

			let metadata: VolunteerMembershipMetadata
			try {
				metadata = membership.metadata
					? (JSON.parse(membership.metadata) as VolunteerMembershipMetadata)
					: { volunteerRoleTypes: [] }
			} catch {
				metadata = { volunteerRoleTypes: [] }
			}

			const currentRoleTypes = metadata.volunteerRoleTypes ?? []
			if (currentRoleTypes.includes(data.roleType)) {
				return { success: true }
			}

			metadata.volunteerRoleTypes = [...currentRoleTypes, data.roleType]

			await db
				.update(teamMembershipTable)
				.set({ metadata: JSON.stringify(metadata) })
				.where(eq(teamMembershipTable.id, data.membershipId))
		}

		return { success: true }
	})

/**
 * Remove a volunteer role type from a membership
 */
export const removeVolunteerRoleTypeFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				membershipId: membershipOrInvitationIdSchema,
				organizingTeamId: competitionTeamIdSchema,
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
				roleType: volunteerRoleTypeSchema,
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireTeamPermission(
			data.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const db = getDb()
		const isInvitation = data.membershipId.startsWith("tinv_")

		if (isInvitation) {
			const invitation = await db.query.teamInvitationTable.findFirst({
				where: eq(teamInvitationTable.id, data.membershipId),
			})

			if (!invitation) {
				throw new Error(`Invitation ${data.membershipId} not found`)
			}

			let metadata: VolunteerMembershipMetadata
			try {
				metadata = invitation.metadata
					? (JSON.parse(invitation.metadata) as VolunteerMembershipMetadata)
					: { volunteerRoleTypes: [] }
			} catch {
				metadata = { volunteerRoleTypes: [] }
			}

			const currentRoleTypes = metadata.volunteerRoleTypes ?? []
			if (!currentRoleTypes.includes(data.roleType)) {
				return { success: true }
			}

			metadata.volunteerRoleTypes = currentRoleTypes.filter(
				(r) => r !== data.roleType,
			)

			await db
				.update(teamInvitationTable)
				.set({ metadata: JSON.stringify(metadata), updatedAt: new Date() })
				.where(eq(teamInvitationTable.id, data.membershipId))
		} else {
			const membership = await db.query.teamMembershipTable.findFirst({
				where: eq(teamMembershipTable.id, data.membershipId),
			})

			if (!membership) {
				throw new Error(`Membership ${data.membershipId} not found`)
			}

			let metadata: VolunteerMembershipMetadata
			try {
				metadata = membership.metadata
					? (JSON.parse(membership.metadata) as VolunteerMembershipMetadata)
					: { volunteerRoleTypes: [] }
			} catch {
				metadata = { volunteerRoleTypes: [] }
			}

			const currentRoleTypes = metadata.volunteerRoleTypes ?? []
			if (!currentRoleTypes.includes(data.roleType)) {
				return { success: true }
			}

			metadata.volunteerRoleTypes = currentRoleTypes.filter(
				(r) => r !== data.roleType,
			)

			await db
				.update(teamMembershipTable)
				.set({ metadata: JSON.stringify(metadata) })
				.where(eq(teamMembershipTable.id, data.membershipId))
		}

		return { success: true }
	})

/**
 * Grant score input access to a volunteer
 */
export const grantScoreAccessFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				volunteerId: z.string().min(1, "Volunteer ID is required"),
				competitionTeamId: competitionTeamIdSchema,
				organizingTeamId: competitionTeamIdSchema,
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
				grantedBy: z.string().min(1, "Granter ID is required"),
				expiresAt: z.date().optional(),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireTeamPermission(
			data.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const db = getDb()

		// Ensure the entitlement type exists (create if not)
		const existingType = await db.query.entitlementTypeTable.findFirst({
			where: eq(entitlementTypeTable.id, SCORE_INPUT_TYPE_ID),
		})

		if (!existingType) {
			await db.insert(entitlementTypeTable).values({
				id: SCORE_INPUT_TYPE_ID,
				name: "Competition Score Input",
				description:
					"Allows a volunteer to input scores for a competition event",
			})
		}

		// Check if volunteer already has score access
		const existingAccess = await db.query.entitlementTable.findFirst({
			where: and(
				eq(entitlementTable.userId, data.volunteerId),
				eq(entitlementTable.teamId, data.competitionTeamId),
				eq(entitlementTable.entitlementTypeId, SCORE_INPUT_TYPE_ID),
				isNull(entitlementTable.deletedAt),
			),
		})

		if (
			existingAccess &&
			existingAccess.metadata?.competitionId === data.competitionId
		) {
			return { success: true }
		}

		await createEntitlement({
			userId: data.volunteerId,
			teamId: data.competitionTeamId,
			entitlementTypeId: SCORE_INPUT_TYPE_ID,
			sourceType: "MANUAL",
			sourceId: data.grantedBy,
			metadata: {
				competitionId: data.competitionId,
				grantedAt: new Date().toISOString(),
			},
			expiresAt: data.expiresAt,
		})

		return { success: true }
	})

/**
 * Revoke score input access from a user
 */
export const revokeScoreAccessFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				userId: z.string().min(1, "User ID is required"),
				competitionTeamId: competitionTeamIdSchema,
				organizingTeamId: competitionTeamIdSchema,
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireTeamPermission(
			data.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const db = getDb()

		const entitlements = await db.query.entitlementTable.findMany({
			where: and(
				eq(entitlementTable.userId, data.userId),
				eq(entitlementTable.teamId, data.competitionTeamId),
				eq(entitlementTable.entitlementTypeId, SCORE_INPUT_TYPE_ID),
				isNull(entitlementTable.deletedAt),
			),
		})

		if (entitlements.length === 0) {
			return { success: true }
		}

		const entitlementIds = entitlements.map((e) => e.id)

		await autochunk({ items: entitlementIds }, async (chunk) => {
			await db
				.update(entitlementTable)
				.set({ deletedAt: new Date() })
				.where(inArray(entitlementTable.id, chunk))
			return []
		})

		return { success: true }
	})

/**
 * Update volunteer membership metadata
 */
export const updateVolunteerMetadataFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				membershipId: membershipOrInvitationIdSchema,
				organizingTeamId: competitionTeamIdSchema,
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
				metadata: z.record(z.string(), z.unknown()),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("NOT_AUTHORIZED: You must be logged in")
		}

		await requireTeamPermission(
			data.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const db = getDb()
		const isInvitation = data.membershipId.startsWith("tinv_")
		const newMetadata = data.metadata as Record<string, unknown>
		const isApprovingStatus = newMetadata.status === "approved"

		if (isInvitation) {
			const invitation = await db.query.teamInvitationTable.findFirst({
				where: eq(teamInvitationTable.id, data.membershipId),
			})

			if (!invitation) {
				throw new Error("NOT_FOUND: Invitation not found")
			}

			const currentMetadata = invitation.metadata
				? (JSON.parse(invitation.metadata) as Record<string, unknown>)
				: {}

			const wasApproved =
				currentMetadata.status !== "approved" && isApprovingStatus

			if (wasApproved) {
				// Handle approval - create membership if user exists
				const existingUser = await db.query.userTable.findFirst({
					where: eq(userTable.email, invitation.email),
				})

				const now = new Date()
				const updatedMetadata = { ...currentMetadata, ...newMetadata }

				await db
					.update(teamInvitationTable)
					.set({
						invitedBy: session.userId,
						metadata: JSON.stringify(updatedMetadata),
						updatedAt: now,
						acceptedAt: now,
						acceptedBy: existingUser?.id ?? null,
					})
					.where(eq(teamInvitationTable.id, data.membershipId))

				if (existingUser) {
					const existingMembership =
						await db.query.teamMembershipTable.findFirst({
							where: and(
								eq(teamMembershipTable.teamId, invitation.teamId),
								eq(teamMembershipTable.userId, existingUser.id),
								eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
								eq(teamMembershipTable.isSystemRole, 1),
							),
						})

					if (!existingMembership) {
						await db.insert(teamMembershipTable).values({
							teamId: invitation.teamId,
							userId: existingUser.id,
							roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
							isSystemRole: 1,
							invitedBy: session.userId,
							invitedAt: now,
							joinedAt: now,
							isActive: 1,
							metadata: JSON.stringify(updatedMetadata),
						})
					}
				}
			} else {
				const updatedMetadata = { ...currentMetadata, ...newMetadata }
				await db
					.update(teamInvitationTable)
					.set({
						metadata: JSON.stringify(updatedMetadata),
						updatedAt: new Date(),
					})
					.where(eq(teamInvitationTable.id, data.membershipId))
			}
		} else {
			const membership = await db.query.teamMembershipTable.findFirst({
				where: eq(teamMembershipTable.id, data.membershipId),
			})

			if (!membership) {
				throw new Error("NOT_FOUND: Membership not found")
			}

			const currentMetadata = membership.metadata
				? (JSON.parse(membership.metadata) as Record<string, unknown>)
				: {}
			const updatedMetadata = { ...currentMetadata, ...newMetadata }

			await db
				.update(teamMembershipTable)
				.set({
					metadata: JSON.stringify(updatedMetadata),
					updatedAt: new Date(),
				})
				.where(eq(teamMembershipTable.id, data.membershipId))
		}

		return { success: true }
	})

/**
 * Bulk assign a role type to multiple volunteers
 */
export const bulkAssignVolunteerRoleFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				membershipIds: z
					.array(membershipOrInvitationIdSchema)
					.min(1, "Select at least one volunteer"),
				organizingTeamId: competitionTeamIdSchema,
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
				roleType: volunteerRoleTypeSchema,
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireTeamPermission(
			data.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const db = getDb()

		const results = await Promise.allSettled(
			data.membershipIds.map(async (membershipId) => {
				const isInvitation = membershipId.startsWith("tinv_")

				if (isInvitation) {
					const invitation = await db.query.teamInvitationTable.findFirst({
						where: eq(teamInvitationTable.id, membershipId),
					})
					if (!invitation) return

					let metadata: VolunteerMembershipMetadata
					try {
						metadata = invitation.metadata
							? (JSON.parse(invitation.metadata) as VolunteerMembershipMetadata)
							: { volunteerRoleTypes: [] }
					} catch {
						metadata = { volunteerRoleTypes: [] }
					}

					const currentRoleTypes = metadata.volunteerRoleTypes ?? []
					if (!currentRoleTypes.includes(data.roleType)) {
						metadata.volunteerRoleTypes = [...currentRoleTypes, data.roleType]
						await db
							.update(teamInvitationTable)
							.set({
								metadata: JSON.stringify(metadata),
								updatedAt: new Date(),
							})
							.where(eq(teamInvitationTable.id, membershipId))
					}
				} else {
					const membership = await db.query.teamMembershipTable.findFirst({
						where: eq(teamMembershipTable.id, membershipId),
					})
					if (!membership || !isVolunteer(membership)) return

					let metadata: VolunteerMembershipMetadata
					try {
						metadata = membership.metadata
							? (JSON.parse(membership.metadata) as VolunteerMembershipMetadata)
							: { volunteerRoleTypes: [] }
					} catch {
						metadata = { volunteerRoleTypes: [] }
					}

					const currentRoleTypes = metadata.volunteerRoleTypes ?? []
					if (!currentRoleTypes.includes(data.roleType)) {
						metadata.volunteerRoleTypes = [...currentRoleTypes, data.roleType]
						await db
							.update(teamMembershipTable)
							.set({ metadata: JSON.stringify(metadata) })
							.where(eq(teamMembershipTable.id, membershipId))
					}
				}
			}),
		)

		const succeeded = results.filter((r) => r.status === "fulfilled").length
		const failed = results.filter((r) => r.status === "rejected").length

		return { success: true, succeeded, failed }
	})
