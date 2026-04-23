/**
 * Cohost Management Server Functions for TanStack Start
 * Functions for managing competition co-hosts and their permissions
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray, isNull } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  competitionGroupsTable,
  competitionsTable,
  SYSTEM_ROLES_ENUM,
  teamInvitationTable,
  teamMembershipTable,
  userTable,
} from "@/db/schema"
import { createTeamMembershipId } from "@/db/schemas/common"
import type { CohostMembershipMetadata } from "@/db/schemas/cohost"
import { DEFAULT_COHOST_PERMISSIONS, parseCohostMetadata } from "@/db/schemas/cohost"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { inviteUserToTeam } from "@/server/team-members"
import { getSessionFromCookie } from "@/utils/auth"
import { sendCohostInviteEmail } from "@/utils/email"
import { updateAllSessionsOfUser } from "@/utils/kv-session"
import { requireTeamPermission } from "@/utils/team-auth"

// ============================================================================
// Input Schemas
// ============================================================================

const teamIdSchema = z.string().startsWith("team_", "Invalid team ID")

const competitionIdSchema = z
  .string()
  .startsWith("comp_", "Invalid competition ID")

const membershipIdSchema = z
  .string()
  .startsWith("tmem_", "Invalid membership ID")

const cohostPermissionsSchema = z.object({
  divisions: z.boolean(),
  editEvents: z.boolean(),
  scoringConfig: z.boolean(),
  viewRegistrations: z.boolean(),
  editRegistrations: z.boolean(),
  waivers: z.boolean(),
  schedule: z.boolean(),
  locations: z.boolean(),
  volunteers: z.boolean(),
  results: z.boolean(),
  leaderboardPreview: z.boolean(),
  pricing: z.boolean(),
  revenue: z.boolean(),
  coupons: z.boolean(),
  sponsors: z.boolean(),
})

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Retrieve a cohost invitation by token (for acceptance page — no auth required)
 */
export const getCohostInviteFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ token: z.string().min(1, "Token is required") }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    const invitation = await db.query.teamInvitationTable.findFirst({
      where: and(
        eq(teamInvitationTable.token, data.token),
        eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.COHOST),
        eq(teamInvitationTable.isSystemRole, true),
      ),
    })

    if (!invitation) return null

    // Look up competition name from metadata stored on invitation
    let competitionName: string | null = null
    let competitionId: string | null = null
    let competitionSlug: string | null = null
    let seriesGroupId: string | null = null

    try {
      const meta = invitation.metadata
        ? (JSON.parse(invitation.metadata) as { competitionId?: string; seriesGroupId?: string })
        : {}
      seriesGroupId = meta.seriesGroupId ?? null
      if (meta.competitionId) {
        competitionId = meta.competitionId
        const competition = await db.query.competitionsTable.findFirst({
          where: eq(competitionsTable.id, meta.competitionId),
          columns: { name: true, slug: true },
        })
        competitionName = competition?.name ?? null
        competitionSlug = competition?.slug ?? null
      }
    } catch {
      // Invalid metadata, skip
    }

    // Parse permissions from metadata
    const permissions = parseCohostMetadata(invitation.metadata)

    // For series invitations, find all sibling competitions this invite covers
    let seriesCompetitions: Array<{ competitionId: string; competitionName: string }> = []
    let seriesName: string | null = null

    if (seriesGroupId) {
      // Get series name
      const group = await db.query.competitionGroupsTable.findFirst({
        where: eq(competitionGroupsTable.id, seriesGroupId),
        columns: { name: true },
      })
      seriesName = group?.name ?? null

      // Find all pending invitations for this email with same seriesGroupId
      const allPendingInvitations = await db.query.teamInvitationTable.findMany({
        where: and(
          eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.COHOST),
          eq(teamInvitationTable.isSystemRole, true),
          isNull(teamInvitationTable.acceptedAt),
        ),
        columns: { id: true, email: true, metadata: true },
      })

      const emailLower = invitation.email.toLowerCase()
      const siblingCompetitionIds: string[] = []
      for (const inv of allPendingInvitations) {
        if (inv.email.toLowerCase() !== emailLower) continue
        try {
          const meta = inv.metadata
            ? (JSON.parse(inv.metadata) as { seriesGroupId?: string; competitionId?: string })
            : {}
          if (meta.seriesGroupId === seriesGroupId && meta.competitionId) {
            siblingCompetitionIds.push(meta.competitionId)
          }
        } catch {
          // skip
        }
      }

      if (siblingCompetitionIds.length > 0) {
        const competitions = await db.query.competitionsTable.findMany({
          where: inArray(competitionsTable.id, siblingCompetitionIds),
          columns: { id: true, name: true },
        })
        seriesCompetitions = competitions.map((c) => ({
          competitionId: c.id,
          competitionName: c.name,
        }))
      }
    }

    return {
      id: invitation.id,
      token: invitation.token,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      teamId: invitation.teamId,
      competitionId,
      competitionName,
      competitionSlug,
      permissions,
      seriesGroupId,
      seriesName,
      seriesCompetitions,
    }
  })

/**
 * Check if the current user already has cohost membership for a competition team.
 * Returns existing permissions if found, null otherwise.
 */
export const checkExistingCohostMembershipFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ teamId: z.string().min(1, "Team ID is required") }).parse(data),
  )
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session) return null

    const db = getDb()
    const membership = await db.query.teamMembershipTable.findFirst({
      where: and(
        eq(teamMembershipTable.teamId, data.teamId),
        eq(teamMembershipTable.userId, session.userId),
        eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.COHOST),
        eq(teamMembershipTable.isSystemRole, true),
      ),
    })

    if (!membership) return null

    return { permissions: parseCohostMetadata(membership.metadata) }
  })

/**
 * List cohosts (memberships) for a competition team.
 * Accessible to organizer admins/owners AND cohosts themselves.
 */
export const getCohostsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        competitionTeamId: teamIdSchema,
        organizingTeamId: teamIdSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireTeamPermission(
      data.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    const db = getDb()

    // Verify that the competition team belongs to a competition owned by the organizing team
    const competition = await db.query.competitionsTable.findFirst({
      where: and(
        eq(competitionsTable.competitionTeamId, data.competitionTeamId),
        eq(competitionsTable.organizingTeamId, data.organizingTeamId),
      ),
      columns: { id: true },
    })
    if (!competition) {
      throw new Error("FORBIDDEN: Competition team does not belong to this organizing team")
    }

    const memberships = await db.query.teamMembershipTable.findMany({
      where: and(
        eq(teamMembershipTable.teamId, data.competitionTeamId),
        eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.COHOST),
        eq(teamMembershipTable.isSystemRole, true),
      ),
      with: {
        user: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    })

    // Also get pending invitations (not yet accepted)
    const pendingInvitations = await db.query.teamInvitationTable.findMany({
      where: and(
        eq(teamInvitationTable.teamId, data.competitionTeamId),
        eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.COHOST),
        eq(teamInvitationTable.isSystemRole, true),
        isNull(teamInvitationTable.acceptedAt),
      ),
    })

    return {
      memberships: memberships.map((m) => {
        const permissions = parseCohostMetadata(m.metadata)
        return {
          id: m.id,
          userId: m.userId,
          user: m.user as { id: string; firstName: string | null; lastName: string | null; email: string; avatar: string | null } | null,
          permissions,
          joinedAt: m.joinedAt,
        }
      }),
      pendingInvitations: pendingInvitations.map((inv) => {
        return {
          id: inv.id,
          token: inv.token,
          email: inv.email,
          permissions: parseCohostMetadata(inv.metadata),
          createdAt: inv.createdAt,
          expiresAt: inv.expiresAt,
        }
      }),
    }
  })

// ============================================================================
// Mutation Functions
// ============================================================================

/**
 * Invite a cohost to a competition (organizer admin/owner only)
 */
export const inviteCohostFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().email("Invalid email address"),
        name: z.string().optional(),
        competitionTeamId: teamIdSchema,
        organizingTeamId: teamIdSchema,
        competitionId: competitionIdSchema,
        permissions: cohostPermissionsSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    // Only organizers (admin/owner) can invite cohosts
    await requireTeamPermission(
      data.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    const metadata: CohostMembershipMetadata & { inviteName?: string; inviteEmail: string } = {
      divisions: data.permissions.divisions,
      editEvents: data.permissions.editEvents,
      scoringConfig: data.permissions.scoringConfig,
      viewRegistrations: data.permissions.viewRegistrations,
      editRegistrations: data.permissions.editRegistrations,
      waivers: data.permissions.waivers,
      schedule: data.permissions.schedule,
      locations: data.permissions.locations,
      volunteers: data.permissions.volunteers,
      results: data.permissions.results,
      leaderboardPreview: data.permissions.leaderboardPreview,
      pricing: data.permissions.pricing,
      revenue: data.permissions.revenue,
      coupons: data.permissions.coupons,
      sponsors: data.permissions.sponsors,
      inviteEmail: data.email,
      competitionId: data.competitionId,
    } as CohostMembershipMetadata & { inviteName?: string; inviteEmail: string; competitionId: string }

    if (data.name) {
      metadata.inviteName = data.name
    }

    const db = getDb()

    // Check for existing cohost invitation
    const existingInvitations = await db.query.teamInvitationTable.findMany({
      where: and(
        eq(teamInvitationTable.teamId, data.competitionTeamId),
        eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.COHOST),
        eq(teamInvitationTable.isSystemRole, true),
      ),
      columns: { email: true },
    })

    if (
      existingInvitations.some(
        (inv) => inv.email.toLowerCase() === data.email.toLowerCase(),
      )
    ) {
      throw new Error(
        "This person has already been invited as a cohost for this competition.",
      )
    }

    // Check for existing cohost membership
    const existingUser = await db.query.userTable.findFirst({
      where: eq(userTable.email, data.email.toLowerCase()),
      columns: { id: true },
    })

    if (existingUser) {
      const existingMembership = await db.query.teamMembershipTable.findFirst({
        where: and(
          eq(teamMembershipTable.teamId, data.competitionTeamId),
          eq(teamMembershipTable.userId, existingUser.id),
          eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.COHOST),
          eq(teamMembershipTable.isSystemRole, true),
        ),
      })
      if (existingMembership) {
        throw new Error("This person is already a cohost for this competition.")
      }
    }

    // Look up competition name for the invite email
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
      columns: { name: true },
    })
    const competitionName = competition?.name ?? "a competition"

    await inviteUserToTeam({
      teamId: data.competitionTeamId,
      email: data.email,
      roleId: SYSTEM_ROLES_ENUM.COHOST,
      isSystemRole: true,
      metadata: JSON.stringify(metadata),
      skipPermissionCheck: true,
      // Always create an invitation so the invitee receives an email
      forceInvitation: true,
      emailOverrideFn: async ({ email, token, inviterName }) => {
        await sendCohostInviteEmail({
          email,
          invitationToken: token,
          competitionName,
          inviterName,
        })
      },
    })

    return { success: true }
  })

/**
 * Accept a cohost invitation (requires authenticated user)
 */
export const acceptCohostInviteFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ token: z.string().min(1, "Token is required") }).parse(data),
  )
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session) {
      throw new Error("NOT_AUTHORIZED: You must be logged in to accept this invitation")
    }

    const db = getDb()

    const invitation = await db.query.teamInvitationTable.findFirst({
      where: and(
        eq(teamInvitationTable.token, data.token),
        eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.COHOST),
        eq(teamInvitationTable.isSystemRole, true),
      ),
    })

    if (!invitation) {
      throw new Error("NOT_FOUND: Invitation not found")
    }

    if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
      throw new Error("ERROR: Invitation has expired")
    }

    if (invitation.acceptedAt) {
      throw new Error("CONFLICT: Invitation has already been accepted")
    }

    // Parse permissions from invitation metadata
    const permissions = parseCohostMetadata(invitation.metadata)
    let competitionId: string | null = null
    let seriesGroupId: string | null = null
    try {
      if (invitation.metadata) {
        const raw = JSON.parse(invitation.metadata)
        competitionId = typeof raw?.competitionId === "string" ? raw.competitionId : null
        seriesGroupId = typeof raw?.seriesGroupId === "string" ? raw.seriesGroupId : null
      }
    } catch {
      // Invalid metadata
    }

    // Check if user already has cohost membership
    const existingMembership = await db.query.teamMembershipTable.findFirst({
      where: and(
        eq(teamMembershipTable.teamId, invitation.teamId),
        eq(teamMembershipTable.userId, session.userId),
        eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.COHOST),
        eq(teamMembershipTable.isSystemRole, true),
      ),
    })

    const now = new Date()

    if (existingMembership) {
      // Mark invitation as accepted even if membership exists
      await db
        .update(teamInvitationTable)
        .set({ acceptedAt: now, acceptedBy: session.userId, updatedAt: now })
        .where(eq(teamInvitationTable.id, invitation.id))
    } else {
      // Create cohost membership
      await db.insert(teamMembershipTable).values({
        id: createTeamMembershipId(),
        teamId: invitation.teamId,
        userId: session.userId,
        roleId: SYSTEM_ROLES_ENUM.COHOST,
        isSystemRole: true,
        invitedBy: invitation.invitedBy,
        invitedAt: invitation.createdAt ? new Date(invitation.createdAt) : now,
        joinedAt: now,
        isActive: true,
        metadata: JSON.stringify(permissions),
      })

      // Mark invitation as accepted
      await db
        .update(teamInvitationTable)
        .set({ acceptedAt: now, acceptedBy: session.userId, updatedAt: now })
        .where(eq(teamInvitationTable.id, invitation.id))
    }

    // Auto-accept sibling series invitations
    if (seriesGroupId) {
      // Find all competitions in this series to get their team IDs
      const seriesCompetitions = await db.query.competitionsTable.findMany({
        where: eq(competitionsTable.groupId, seriesGroupId),
        columns: { id: true, competitionTeamId: true },
      })

      const siblingTeamIds = seriesCompetitions
        .map((c) => c.competitionTeamId)
        .filter((teamId) => teamId !== invitation.teamId)

      if (siblingTeamIds.length > 0) {
        // Find all pending cohost invitations on sibling teams for this email
        const siblingInvitations = await db.query.teamInvitationTable.findMany({
          where: and(
            inArray(teamInvitationTable.teamId, siblingTeamIds),
            eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.COHOST),
            eq(teamInvitationTable.isSystemRole, true),
            isNull(teamInvitationTable.acceptedAt),
          ),
        })

        // Filter to matching email (case-insensitive) and matching seriesGroupId in metadata
        const invitationEmail = invitation.email.toLowerCase()
        const matchingSiblings = siblingInvitations.filter((inv) => {
          if (inv.email.toLowerCase() !== invitationEmail) return false
          try {
            const meta = inv.metadata
              ? (JSON.parse(inv.metadata) as { seriesGroupId?: string })
              : {}
            return meta.seriesGroupId === seriesGroupId
          } catch {
            return false
          }
        })

        for (const siblingInv of matchingSiblings) {
          const siblingPermissions = parseCohostMetadata(siblingInv.metadata)

          // Check if user already has membership on this sibling team
          const existingSiblingMembership = await db.query.teamMembershipTable.findFirst({
            where: and(
              eq(teamMembershipTable.teamId, siblingInv.teamId),
              eq(teamMembershipTable.userId, session.userId),
              eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.COHOST),
              eq(teamMembershipTable.isSystemRole, true),
            ),
          })

          if (!existingSiblingMembership) {
            await db.insert(teamMembershipTable).values({
              id: createTeamMembershipId(),
              teamId: siblingInv.teamId,
              userId: session.userId,
              roleId: SYSTEM_ROLES_ENUM.COHOST,
              isSystemRole: true,
              invitedBy: siblingInv.invitedBy,
              invitedAt: siblingInv.createdAt ? new Date(siblingInv.createdAt) : now,
              joinedAt: now,
              isActive: true,
              metadata: JSON.stringify(siblingPermissions),
            })
          }

          // Mark sibling invitation as accepted
          await db
            .update(teamInvitationTable)
            .set({ acceptedAt: now, acceptedBy: session.userId, updatedAt: now })
            .where(eq(teamInvitationTable.id, siblingInv.id))
        }
      }
    }

    // Update user sessions so new memberships are reflected immediately
    await updateAllSessionsOfUser(session.userId)

    return { success: true, competitionId, seriesGroupId }
  })

/**
 * Update cohost permissions (organizer admin/owner only)
 */
export const updateCohostPermissionsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        membershipId: membershipIdSchema,
        organizingTeamId: teamIdSchema,
        permissions: cohostPermissionsSchema.partial(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireTeamPermission(
      data.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    const db = getDb()

    const membership = await db.query.teamMembershipTable.findFirst({
      where: and(
        eq(teamMembershipTable.id, data.membershipId),
        eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.COHOST),
        eq(teamMembershipTable.isSystemRole, true),
      ),
    })

    if (!membership) {
      throw new Error("NOT_FOUND: Cohost membership not found")
    }

    // Verify this membership's team belongs to a competition owned by the organizing team
    const competition = await db.query.competitionsTable.findFirst({
      where: and(
        eq(competitionsTable.competitionTeamId, membership.teamId),
        eq(competitionsTable.organizingTeamId, data.organizingTeamId),
      ),
      columns: { id: true },
    })
    if (!competition) {
      throw new Error("FORBIDDEN: Membership does not belong to a competition you manage")
    }

    let currentMetadata: CohostMembershipMetadata
    try {
      currentMetadata = membership.metadata
        ? (JSON.parse(membership.metadata) as CohostMembershipMetadata)
        : { ...DEFAULT_COHOST_PERMISSIONS }
    } catch {
      currentMetadata = { ...DEFAULT_COHOST_PERMISSIONS }
    }

    const updatedMetadata: CohostMembershipMetadata = {
      ...currentMetadata,
      ...data.permissions,
    }

    await db
      .update(teamMembershipTable)
      .set({ metadata: JSON.stringify(updatedMetadata), updatedAt: new Date() })
      .where(eq(teamMembershipTable.id, data.membershipId))

    // Update sessions of the cohost so permissions are reflected immediately
    if (membership.userId) {
      await updateAllSessionsOfUser(membership.userId)
    }

    return { success: true }
  })

/**
 * Remove a cohost from a competition (organizer admin/owner only)
 */
export const removeCohostFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        membershipId: membershipIdSchema,
        organizingTeamId: teamIdSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireTeamPermission(
      data.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    const db = getDb()

    const membership = await db.query.teamMembershipTable.findFirst({
      where: and(
        eq(teamMembershipTable.id, data.membershipId),
        eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.COHOST),
        eq(teamMembershipTable.isSystemRole, true),
      ),
    })

    if (!membership) {
      throw new Error("NOT_FOUND: Cohost membership not found")
    }

    // Verify this membership's team belongs to a competition owned by the organizing team
    const competition = await db.query.competitionsTable.findFirst({
      where: and(
        eq(competitionsTable.competitionTeamId, membership.teamId),
        eq(competitionsTable.organizingTeamId, data.organizingTeamId),
      ),
      columns: { id: true },
    })
    if (!competition) {
      throw new Error("FORBIDDEN: Membership does not belong to a competition you manage")
    }

    await db
      .delete(teamMembershipTable)
      .where(eq(teamMembershipTable.id, data.membershipId))

    // Update sessions so the removed cohost loses access immediately
    if (membership.userId) {
      await updateAllSessionsOfUser(membership.userId)
    }

    return { success: true }
  })
