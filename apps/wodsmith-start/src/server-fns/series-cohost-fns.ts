/**
 * Series-level Cohost Management Server Functions
 * Manages co-hosts across all competitions in a series (competition group)
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
import type { CohostMembershipMetadata } from "@/db/schemas/cohost"
import { DEFAULT_COHOST_PERMISSIONS } from "@/db/schemas/cohost"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { inviteUserToTeam } from "@/server/team-members"
import { sendCohostInviteEmail } from "@/utils/email"
import { updateAllSessionsOfUser } from "@/utils/kv-session"
import { requireTeamPermission } from "@/utils/team-auth"

// ============================================================================
// Input Schemas
// ============================================================================

const teamIdSchema = z.string().startsWith("team_", "Invalid team ID")
const groupIdSchema = z.string().startsWith("cgrp_", "Invalid group ID")

const cohostPermissionsSchema = z.object({
  divisions: z.boolean(),
  events: z.boolean(),
  scoring: z.boolean(),
  viewRegistrations: z.boolean(),
  editRegistrations: z.boolean(),
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
// Helpers
// ============================================================================

/** Fetch all competitions in a series owned by the given organizing team. */
async function getSeriesCompetitions(groupId: string, organizingTeamId: string) {
  const db = getDb()
  return db.query.competitionsTable.findMany({
    where: and(
      eq(competitionsTable.groupId, groupId),
      eq(competitionsTable.organizingTeamId, organizingTeamId),
    ),
    columns: { id: true, name: true, competitionTeamId: true },
  })
}

/** Parse cohost permissions from a JSON metadata string. */
function parsePermissions(metadata: string | null): CohostMembershipMetadata {
  try {
    if (metadata) {
      const meta = JSON.parse(metadata) as Partial<CohostMembershipMetadata>
      return {
        divisions: meta.divisions ?? DEFAULT_COHOST_PERMISSIONS.divisions,
        events: meta.events ?? DEFAULT_COHOST_PERMISSIONS.events,
        scoring: meta.scoring ?? DEFAULT_COHOST_PERMISSIONS.scoring,
        viewRegistrations: meta.viewRegistrations ?? DEFAULT_COHOST_PERMISSIONS.viewRegistrations,
        editRegistrations: meta.editRegistrations ?? DEFAULT_COHOST_PERMISSIONS.editRegistrations,
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
  return { ...DEFAULT_COHOST_PERMISSIONS }
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * List all cohosts across every competition in a series, deduplicated by email.
 */
export const getSeriesCohostsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: groupIdSchema,
        organizingTeamId: teamIdSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireTeamPermission(
      data.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    const competitions = await getSeriesCompetitions(data.groupId, data.organizingTeamId)

    if (competitions.length === 0) {
      return { cohosts: [], pendingInvitations: [], totalCompetitions: 0 }
    }

    const competitionTeamIds = competitions.map((c) => c.competitionTeamId)
    const db = getDb()

    // Fetch all cohost memberships across competition teams
    const memberships = await db.query.teamMembershipTable.findMany({
      where: and(
        inArray(teamMembershipTable.teamId, competitionTeamIds),
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

    // Fetch all pending cohost invitations across competition teams
    const pendingInvitations = await db.query.teamInvitationTable.findMany({
      where: and(
        inArray(teamInvitationTable.teamId, competitionTeamIds),
        eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.COHOST),
        eq(teamInvitationTable.isSystemRole, true),
        isNull(teamInvitationTable.acceptedAt),
      ),
    })

    // Deduplicate memberships by email (lowercase)
    const cohostMap = new Map<
      string,
      {
        email: string
        userId: string | null
        user: {
          id: string
          firstName: string | null
          lastName: string | null
          email: string
          avatar: string | null
        } | null
        permissions: CohostMembershipMetadata
        competitionCount: number
        membershipIds: string[]
      }
    >()

    for (const m of memberships) {
      const email = (m.user?.email ?? "").toLowerCase()
      if (!email) continue

      const existing = cohostMap.get(email)
      if (existing) {
        existing.competitionCount += 1
        existing.membershipIds.push(m.id)
      } else {
        cohostMap.set(email, {
          email,
          userId: m.userId,
          user: m.user as {
            id: string
            firstName: string | null
            lastName: string | null
            email: string
            avatar: string | null
          } | null,
          permissions: parsePermissions(m.metadata),
          competitionCount: 1,
          membershipIds: [m.id],
        })
      }
    }

    // Deduplicate pending invitations by email (lowercase)
    const pendingMap = new Map<
      string,
      {
        email: string
        permissions: CohostMembershipMetadata
        competitionCount: number
        firstToken: string | null
      }
    >()

    for (const inv of pendingInvitations) {
      const email = inv.email.toLowerCase()
      // Skip if already an active cohost
      if (cohostMap.has(email)) continue

      const existing = pendingMap.get(email)
      if (existing) {
        existing.competitionCount += 1
      } else {
        pendingMap.set(email, {
          email,
          permissions: parsePermissions(inv.metadata),
          competitionCount: 1,
          firstToken: inv.token,
        })
      }
    }

    return {
      cohosts: Array.from(cohostMap.values()),
      pendingInvitations: Array.from(pendingMap.values()),
      totalCompetitions: competitions.length,
    }
  })

// ============================================================================
// Mutation Functions
// ============================================================================

/**
 * Invite a cohost to every competition in a series. Sends one email
 * (for the first competition) and silently creates invitations for the rest.
 */
export const inviteSeriesCohostFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().email("Invalid email address"),
        name: z.string().optional(),
        organizingTeamId: teamIdSchema,
        groupId: groupIdSchema,
        /** When provided, only invite to these competitions (must belong to the series). Omit to invite to all. */
        competitionIds: z.array(z.string().startsWith("comp_")).optional(),
        permissions: cohostPermissionsSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireTeamPermission(
      data.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    let competitions = await getSeriesCompetitions(data.groupId, data.organizingTeamId)

    if (competitions.length === 0) {
      throw new Error("This series has no competitions yet")
    }

    // Filter to selected competitions when provided
    if (data.competitionIds && data.competitionIds.length > 0) {
      const selectedIds = new Set(data.competitionIds)
      competitions = competitions.filter((c) => selectedIds.has(c.id))
      if (competitions.length === 0) {
        throw new Error("None of the selected competitions belong to this series")
      }
    }

    const db = getDb()

    // Get series name for the email
    const group = await db.query.competitionGroupsTable.findFirst({
      where: eq(competitionGroupsTable.id, data.groupId),
      columns: { name: true },
    })
    const seriesName = group?.name ?? "a series"

    // Pre-fetch existing invitations & memberships for all competition teams
    const competitionTeamIds = competitions.map((c) => c.competitionTeamId)

    const existingInvitations = await db.query.teamInvitationTable.findMany({
      where: and(
        inArray(teamInvitationTable.teamId, competitionTeamIds),
        eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.COHOST),
        eq(teamInvitationTable.isSystemRole, true),
      ),
      columns: { email: true, teamId: true },
    })

    // Build a set of teamIds that already have an invitation for this email
    const invitedTeamIds = new Set(
      existingInvitations
        .filter((inv) => inv.email.toLowerCase() === data.email.toLowerCase())
        .map((inv) => inv.teamId),
    )

    // Check for existing memberships
    const existingUser = await db.query.userTable.findFirst({
      where: eq(userTable.email, data.email.toLowerCase()),
      columns: { id: true },
    })

    const memberTeamIds = new Set<string>()
    if (existingUser) {
      const existingMemberships = await db.query.teamMembershipTable.findMany({
        where: and(
          inArray(teamMembershipTable.teamId, competitionTeamIds),
          eq(teamMembershipTable.userId, existingUser.id),
          eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.COHOST),
          eq(teamMembershipTable.isSystemRole, true),
        ),
        columns: { teamId: true },
      })
      for (const m of existingMemberships) {
        memberTeamIds.add(m.teamId)
      }
    }

    let invitedCount = 0
    let skippedCount = 0
    let isFirstEmail = true

    for (const comp of competitions) {
      // Skip if already invited or already a cohost for this competition
      if (
        invitedTeamIds.has(comp.competitionTeamId) ||
        memberTeamIds.has(comp.competitionTeamId)
      ) {
        skippedCount += 1
        continue
      }

      const metadata: CohostMembershipMetadata & {
        inviteName?: string
        inviteEmail: string
        competitionId: string
        seriesGroupId: string
      } = {
        divisions: data.permissions.divisions,
        events: data.permissions.events,
        scoring: data.permissions.scoring,
        viewRegistrations: data.permissions.viewRegistrations,
        editRegistrations: data.permissions.editRegistrations,
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
        competitionId: comp.id,
        seriesGroupId: data.groupId,
      }

      if (data.name) {
        metadata.inviteName = data.name
      }

      // Only send the actual email for the first competition
      const emailOverrideFn = isFirstEmail
        ? async ({ email, token, inviterName }: { email: string; token: string; inviterName: string }) => {
            await sendCohostInviteEmail({
              email,
              invitationToken: token,
              competitionName: `${seriesName} (${competitions.length} competitions)`,
              inviterName,
            })
          }
        : async () => {
            // No-op — suppress default email for subsequent competitions
          }

      await inviteUserToTeam({
        teamId: comp.competitionTeamId,
        email: data.email,
        roleId: SYSTEM_ROLES_ENUM.COHOST,
        isSystemRole: true,
        metadata: JSON.stringify(metadata),
        skipPermissionCheck: true,
        forceInvitation: true,
        emailOverrideFn,
      })

      invitedCount += 1
      isFirstEmail = false
    }

    return { success: true, invitedCount, skippedCount }
  })

/**
 * Remove a cohost from every competition in a series — deletes memberships
 * and pending invitations for the given email.
 */
export const removeSeriesCohostFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().email("Invalid email address"),
        groupId: groupIdSchema,
        organizingTeamId: teamIdSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireTeamPermission(
      data.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    const competitions = await getSeriesCompetitions(data.groupId, data.organizingTeamId)

    if (competitions.length === 0) {
      return { success: true, removedCount: 0 }
    }

    const competitionTeamIds = competitions.map((c) => c.competitionTeamId)
    const db = getDb()
    let removedCount = 0

    // Find the user by email
    const user = await db.query.userTable.findFirst({
      where: eq(userTable.email, data.email.toLowerCase()),
      columns: { id: true },
    })

    // Delete active memberships
    if (user) {
      const memberships = await db.query.teamMembershipTable.findMany({
        where: and(
          inArray(teamMembershipTable.teamId, competitionTeamIds),
          eq(teamMembershipTable.userId, user.id),
          eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.COHOST),
          eq(teamMembershipTable.isSystemRole, true),
        ),
        columns: { id: true },
      })

      if (memberships.length > 0) {
        const membershipIds = memberships.map((m) => m.id)
        await db
          .delete(teamMembershipTable)
          .where(inArray(teamMembershipTable.id, membershipIds))
        removedCount += memberships.length
      }

      await updateAllSessionsOfUser(user.id)
    }

    // Delete/cancel pending invitations for this email across all competition teams
    const pendingInvitations = await db.query.teamInvitationTable.findMany({
      where: and(
        inArray(teamInvitationTable.teamId, competitionTeamIds),
        eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.COHOST),
        eq(teamInvitationTable.isSystemRole, true),
        isNull(teamInvitationTable.acceptedAt),
      ),
      columns: { id: true, email: true },
    })

    const invitationIdsToDelete = pendingInvitations
      .filter((inv) => inv.email.toLowerCase() === data.email.toLowerCase())
      .map((inv) => inv.id)

    if (invitationIdsToDelete.length > 0) {
      await db
        .delete(teamInvitationTable)
        .where(inArray(teamInvitationTable.id, invitationIdsToDelete))
      removedCount += invitationIdsToDelete.length
    }

    return { success: true, removedCount }
  })

/**
 * Update permissions for a cohost across all their memberships in a series.
 * Finds all cohost memberships for the given email and updates their metadata.
 */
export const updateSeriesCohostPermissionsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().email("Invalid email address"),
        groupId: groupIdSchema,
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

    const competitions = await getSeriesCompetitions(data.groupId, data.organizingTeamId)

    if (competitions.length === 0) {
      return { success: true, updatedCount: 0 }
    }

    const competitionTeamIds = competitions.map((c) => c.competitionTeamId)
    const db = getDb()

    // Find the user by email
    const user = await db.query.userTable.findFirst({
      where: eq(userTable.email, data.email.toLowerCase()),
      columns: { id: true },
    })

    if (!user) {
      throw new Error("NOT_FOUND: User not found")
    }

    // Find all cohost memberships for this user across series competitions
    const memberships = await db.query.teamMembershipTable.findMany({
      where: and(
        inArray(teamMembershipTable.teamId, competitionTeamIds),
        eq(teamMembershipTable.userId, user.id),
        eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.COHOST),
        eq(teamMembershipTable.isSystemRole, true),
      ),
    })

    if (memberships.length === 0) {
      throw new Error("NOT_FOUND: No cohost memberships found for this user in the series")
    }

    // Update each membership with merged permissions
    for (const membership of memberships) {
      const currentMetadata = parsePermissions(membership.metadata)
      const updatedMetadata = { ...currentMetadata, ...data.permissions }

      await db
        .update(teamMembershipTable)
        .set({ metadata: JSON.stringify(updatedMetadata), updatedAt: new Date() })
        .where(eq(teamMembershipTable.id, membership.id))
    }

    // Update sessions so permissions reflect immediately
    await updateAllSessionsOfUser(user.id)

    return { success: true, updatedCount: memberships.length }
  })
