/**
 * Cohost Management Server Functions for TanStack Start
 * Functions for managing competition co-hosts and their permissions
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  competitionsTable,
  SYSTEM_ROLES_ENUM,
  teamInvitationTable,
  teamMembershipTable,
  userTable,
} from "@/db/schema"
import { createTeamMembershipId } from "@/db/schemas/common"
import type { CohostMembershipMetadata } from "@/db/schemas/cohost"
import { DEFAULT_COHOST_PERMISSIONS } from "@/db/schemas/cohost"
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
  events: z.boolean(),
  scoring: z.boolean(),
  registrations: z.boolean(),
  waivers: z.boolean(),
  schedule: z.boolean(),
  locations: z.boolean(),
  volunteers: z.boolean(),
  results: z.boolean(),
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

    try {
      const meta = invitation.metadata
        ? (JSON.parse(invitation.metadata) as { competitionId?: string })
        : {}
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
    let permissions: CohostMembershipMetadata
    try {
      const meta = invitation.metadata
        ? (JSON.parse(invitation.metadata) as Partial<CohostMembershipMetadata>)
        : {}
      permissions = {
        divisions: meta.divisions ?? DEFAULT_COHOST_PERMISSIONS.divisions,
        events: meta.events ?? DEFAULT_COHOST_PERMISSIONS.events,
        scoring: meta.scoring ?? DEFAULT_COHOST_PERMISSIONS.scoring,
        registrations: meta.registrations ?? DEFAULT_COHOST_PERMISSIONS.registrations,
        waivers: meta.waivers ?? DEFAULT_COHOST_PERMISSIONS.waivers,
        schedule: meta.schedule ?? DEFAULT_COHOST_PERMISSIONS.schedule,
        locations: meta.locations ?? DEFAULT_COHOST_PERMISSIONS.locations,
        volunteers: meta.volunteers ?? DEFAULT_COHOST_PERMISSIONS.volunteers,
        results: meta.results ?? DEFAULT_COHOST_PERMISSIONS.results,
        pricing: meta.pricing ?? DEFAULT_COHOST_PERMISSIONS.pricing,
        revenue: meta.revenue ?? DEFAULT_COHOST_PERMISSIONS.revenue,
        coupons: meta.coupons ?? DEFAULT_COHOST_PERMISSIONS.coupons,
        sponsors: meta.sponsors ?? DEFAULT_COHOST_PERMISSIONS.sponsors,
        inviteNotes: meta.inviteNotes,
      }
    } catch {
      permissions = { ...DEFAULT_COHOST_PERMISSIONS }
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
    }
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
        let permissions: CohostMembershipMetadata = { ...DEFAULT_COHOST_PERMISSIONS }
        try {
          if (m.metadata) {
            const meta = JSON.parse(m.metadata) as Partial<CohostMembershipMetadata>
            permissions = {
              divisions: meta.divisions ?? DEFAULT_COHOST_PERMISSIONS.divisions,
              events: meta.events ?? DEFAULT_COHOST_PERMISSIONS.events,
              scoring: meta.scoring ?? DEFAULT_COHOST_PERMISSIONS.scoring,
              registrations: meta.registrations ?? DEFAULT_COHOST_PERMISSIONS.registrations,
              waivers: meta.waivers ?? DEFAULT_COHOST_PERMISSIONS.waivers,
              schedule: meta.schedule ?? DEFAULT_COHOST_PERMISSIONS.schedule,
              locations: meta.locations ?? DEFAULT_COHOST_PERMISSIONS.locations,
              volunteers: meta.volunteers ?? DEFAULT_COHOST_PERMISSIONS.volunteers,
              results: meta.results ?? DEFAULT_COHOST_PERMISSIONS.results,
              pricing: meta.pricing ?? DEFAULT_COHOST_PERMISSIONS.pricing,
              revenue: meta.revenue ?? DEFAULT_COHOST_PERMISSIONS.revenue,
              coupons: meta.coupons ?? DEFAULT_COHOST_PERMISSIONS.coupons,
              sponsors: meta.sponsors ?? DEFAULT_COHOST_PERMISSIONS.sponsors,
              inviteNotes: meta.inviteNotes,
            }
          }
        } catch {
          // Invalid metadata
        }
        return {
          id: m.id,
          userId: m.userId,
          user: m.user as { id: string; firstName: string | null; lastName: string | null; email: string; avatar: string | null } | null,
          permissions,
          joinedAt: m.joinedAt,
        }
      }),
      pendingInvitations: pendingInvitations.map((inv) => {
        let permissions: CohostMembershipMetadata = { ...DEFAULT_COHOST_PERMISSIONS }
        try {
          if (inv.metadata) {
            const meta = JSON.parse(inv.metadata) as Partial<CohostMembershipMetadata>
            permissions = {
              divisions: meta.divisions ?? DEFAULT_COHOST_PERMISSIONS.divisions,
              events: meta.events ?? DEFAULT_COHOST_PERMISSIONS.events,
              scoring: meta.scoring ?? DEFAULT_COHOST_PERMISSIONS.scoring,
              registrations: meta.registrations ?? DEFAULT_COHOST_PERMISSIONS.registrations,
              waivers: meta.waivers ?? DEFAULT_COHOST_PERMISSIONS.waivers,
              schedule: meta.schedule ?? DEFAULT_COHOST_PERMISSIONS.schedule,
              locations: meta.locations ?? DEFAULT_COHOST_PERMISSIONS.locations,
              volunteers: meta.volunteers ?? DEFAULT_COHOST_PERMISSIONS.volunteers,
              results: meta.results ?? DEFAULT_COHOST_PERMISSIONS.results,
              pricing: meta.pricing ?? DEFAULT_COHOST_PERMISSIONS.pricing,
              revenue: meta.revenue ?? DEFAULT_COHOST_PERMISSIONS.revenue,
              coupons: meta.coupons ?? DEFAULT_COHOST_PERMISSIONS.coupons,
              sponsors: meta.sponsors ?? DEFAULT_COHOST_PERMISSIONS.sponsors,
              inviteNotes: meta.inviteNotes,
            }
          }
        } catch {
          // Invalid metadata
        }
        return {
          id: inv.id,
          token: inv.token,
          email: inv.email,
          permissions,
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
      events: data.permissions.events,
      scoring: data.permissions.scoring,
      registrations: data.permissions.registrations,
      waivers: data.permissions.waivers,
      schedule: data.permissions.schedule,
      locations: data.permissions.locations,
      volunteers: data.permissions.volunteers,
      results: data.permissions.results,
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
    let permissions: CohostMembershipMetadata = { ...DEFAULT_COHOST_PERMISSIONS }
    let competitionId: string | null = null
    try {
      if (invitation.metadata) {
        const meta = JSON.parse(invitation.metadata) as Partial<CohostMembershipMetadata> & { competitionId?: string }
        permissions = {
          divisions: meta.divisions ?? DEFAULT_COHOST_PERMISSIONS.divisions,
          events: meta.events ?? DEFAULT_COHOST_PERMISSIONS.events,
          scoring: meta.scoring ?? DEFAULT_COHOST_PERMISSIONS.scoring,
          registrations: meta.registrations ?? DEFAULT_COHOST_PERMISSIONS.registrations,
          waivers: meta.waivers ?? DEFAULT_COHOST_PERMISSIONS.waivers,
          schedule: meta.schedule ?? DEFAULT_COHOST_PERMISSIONS.schedule,
          locations: meta.locations ?? DEFAULT_COHOST_PERMISSIONS.locations,
          volunteers: meta.volunteers ?? DEFAULT_COHOST_PERMISSIONS.volunteers,
          results: meta.results ?? DEFAULT_COHOST_PERMISSIONS.results,
          pricing: meta.pricing ?? DEFAULT_COHOST_PERMISSIONS.pricing,
          revenue: meta.revenue ?? DEFAULT_COHOST_PERMISSIONS.revenue,
          coupons: meta.coupons ?? DEFAULT_COHOST_PERMISSIONS.coupons,
          sponsors: meta.sponsors ?? DEFAULT_COHOST_PERMISSIONS.sponsors,
          inviteNotes: meta.inviteNotes,
        }
        competitionId = meta.competitionId ?? null
      }
    } catch {
      // Invalid metadata — use defaults
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

    if (existingMembership) {
      // Mark invitation as accepted even if membership exists
      await db
        .update(teamInvitationTable)
        .set({ acceptedAt: new Date(), acceptedBy: session.userId, updatedAt: new Date() })
        .where(eq(teamInvitationTable.id, invitation.id))
      return { success: true, competitionId }
    }

    const now = new Date()

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

    // Update user sessions so new membership is reflected immediately
    await updateAllSessionsOfUser(session.userId)

    return { success: true, competitionId }
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
