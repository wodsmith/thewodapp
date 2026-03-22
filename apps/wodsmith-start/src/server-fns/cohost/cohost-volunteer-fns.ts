/**
 * Cohost Volunteer Server Functions
 * Mirrors organizer volunteer-fns, volunteer-shift-fns, and judge-scheduling-fns
 * for cohost access. Uses requireCohostPermission instead of requireTeamPermission.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq, inArray, isNull } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import type { TeamMembership, User } from "@/db/schema"
import {
  competitionHeatsTable,
  competitionsTable,
  entitlementTable,
  entitlementTypeTable,
  judgeHeatAssignmentsTable,
  SYSTEM_ROLES_ENUM,
  teamInvitationTable,
  teamMembershipTable,
  trackWorkoutsTable,
  userTable,
  volunteerShiftAssignmentsTable,
  volunteerShiftsTable,
  workouts,
} from "@/db/schema"
import {
  createVolunteerShiftAssignmentId,
  createVolunteerShiftId,
} from "@/db/schemas/common"
import type { VolunteerMembershipMetadata } from "@/db/schemas/volunteers"
import { createEntitlement } from "@/server/entitlements"
import { inviteUserToTeam } from "@/server/team-members"
import { sendVolunteerDirectInviteEmail } from "@/utils/email"
import {
  calculateInviteStatus,
  isDirectInvite,
  isVolunteer,
} from "@/server/volunteers"
import { getSessionFromCookie } from "@/utils/auth"
import { requireCohostPermission } from "@/utils/cohost-auth"

// ============================================================================
// Constants
// ============================================================================

const SCORE_INPUT_TYPE_ID = "competition_score_input"

// ============================================================================
// Types
// ============================================================================

export type TeamMembershipWithUser = TeamMembership & {
  user: User | null
}

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

const cohostBaseSchema = z.object({
  competitionTeamId: z.string().startsWith("team_", "Invalid team ID"),
})

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
  "athlete_control",
  "equipment_team",
])

const membershipOrInvitationIdSchema = z
  .string()
  .refine(
    (val) => val.startsWith("tmem_") || val.startsWith("tinv_"),
    "Invalid membership or invitation ID",
  )

const shiftIdSchema = z
  .string()
  .startsWith("vshf_", "Invalid volunteer shift ID")

const membershipIdSchema = z
  .string()
  .startsWith("tmem_", "Invalid team membership ID")

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all team members with volunteer role for a competition team (cohost)
 */
export const cohostGetCompetitionVolunteersFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) => cohostBaseSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)

    const db = getDb()
    return db.query.teamMembershipTable.findMany({
      where: and(
        eq(teamMembershipTable.teamId, data.competitionTeamId),
        eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
        eq(teamMembershipTable.isSystemRole, true),
      ),
      with: {
        user: true,
      },
    }) as unknown as Promise<TeamMembershipWithUser[]>
  })

/**
 * Get pending volunteer invitations (cohost)
 */
export const cohostGetPendingVolunteerInvitationsFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) => cohostBaseSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)

    const db = getDb()
    return db.query.teamInvitationTable.findMany({
      where: and(
        eq(teamInvitationTable.teamId, data.competitionTeamId),
        eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
        eq(teamInvitationTable.isSystemRole, true),
        isNull(teamInvitationTable.acceptedAt),
      ),
    })
  })

/**
 * Get direct volunteer invitations (cohost)
 */
export const cohostGetDirectVolunteerInvitesFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) => cohostBaseSchema.parse(data))
  .handler(async ({ data }): Promise<DirectVolunteerInvite[]> => {
    await requireCohostPermission(data.competitionTeamId)

    const db = getDb()

    const invitations = await db.query.teamInvitationTable.findMany({
      where: and(
        eq(teamInvitationTable.teamId, data.competitionTeamId),
        eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
        eq(teamInvitationTable.isSystemRole, true),
      ),
    })

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
          // Invalid metadata
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
 * Get all volunteer assignments (shifts and judge heats) for a competition (cohost)
 */
export const cohostGetVolunteerAssignmentsFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    cohostBaseSchema
      .extend({
        competitionId: z
          .string()
          .startsWith("comp_", "Invalid competition ID"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)

    const db = getDb()

    // Get all shift IDs for this competition
    const shifts = await db.query.volunteerShiftsTable.findMany({
      where: eq(volunteerShiftsTable.competitionId, data.competitionId),
      columns: { id: true },
    })
    const shiftIds = shifts.map((s) => s.id)

    // Get all heat IDs for this competition
    const heats = await db.query.competitionHeatsTable.findMany({
      where: eq(competitionHeatsTable.competitionId, data.competitionId),
    })
    const heatIds = heats.map((h) => h.id)

    const heatDetailsMap = new Map(
      heats.map((h) => [
        h.id,
        {
          heatNumber: h.heatNumber,
          trackWorkoutId: h.trackWorkoutId,
          scheduledTime: h.scheduledTime,
        },
      ]),
    )

    // Get track workout details for event names
    const trackWorkoutIds = [...new Set(heats.map((h) => h.trackWorkoutId))]
    const trackWorkoutsData =
      trackWorkoutIds.length > 0
        ? await db
            .select({
              id: trackWorkoutsTable.id,
              workoutName: workouts.name,
            })
            .from(trackWorkoutsTable)
            .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
            .where(inArray(trackWorkoutsTable.id, trackWorkoutIds))
        : []

    const eventNameMap = new Map(
      trackWorkoutsData.map((tw) => [tw.id, tw.workoutName]),
    )

    // Query shift assignments
    const shiftAssignments =
      shiftIds.length > 0
        ? await db.query.volunteerShiftAssignmentsTable.findMany({
            where: inArray(volunteerShiftAssignmentsTable.shiftId, shiftIds),
            with: {
              shift: true,
            },
          })
        : []

    // Query judge heat assignments
    const judgeAssignments =
      heatIds.length > 0
        ? await db.query.judgeHeatAssignmentsTable.findMany({
            where: inArray(judgeHeatAssignmentsTable.heatId, heatIds),
          })
        : []

    // Build the map
    const assignmentMap: Record<
      string,
      {
        shifts: Array<{
          id: string
          shiftId: string
          name: string
          roleType: string
          startTime: Date
          endTime: Date
          location: string | null
          notes: string | null
        }>
        judgeHeats: Array<{
          id: string
          heatId: string
          eventName: string
          heatNumber: number
          scheduledTime: Date | null
          laneNumber: number | null
          position: string | null
        }>
      }
    > = {}

    for (const assignment of shiftAssignments) {
      if (!assignmentMap[assignment.membershipId]) {
        assignmentMap[assignment.membershipId] = { shifts: [], judgeHeats: [] }
      }
      assignmentMap[assignment.membershipId].shifts.push({
        id: assignment.id,
        shiftId: assignment.shiftId,
        name: assignment.shift.name,
        roleType: assignment.shift.roleType,
        startTime: assignment.shift.startTime,
        endTime: assignment.shift.endTime,
        location: assignment.shift.location,
        notes: assignment.shift.notes,
      })
    }

    for (const assignment of judgeAssignments) {
      const heatDetails = heatDetailsMap.get(assignment.heatId)
      if (!heatDetails) continue

      const eventName =
        eventNameMap.get(heatDetails.trackWorkoutId) || "Unknown Event"

      if (!assignmentMap[assignment.membershipId]) {
        assignmentMap[assignment.membershipId] = { shifts: [], judgeHeats: [] }
      }
      assignmentMap[assignment.membershipId].judgeHeats.push({
        id: assignment.id,
        heatId: assignment.heatId,
        eventName,
        heatNumber: heatDetails.heatNumber,
        scheduledTime: heatDetails.scheduledTime,
        laneNumber: assignment.laneNumber,
        position: assignment.position,
      })
    }

    return assignmentMap
  })

// ============================================================================
// Mutation Functions
// ============================================================================

/**
 * Invite a volunteer to a competition (cohost action)
 */
export const cohostInviteVolunteerFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        name: z.string().optional(),
        email: z.string().email("Invalid email address"),
        competitionTeamId: z
          .string()
          .startsWith("team_", "Invalid team ID"),
        competitionId: z
          .string()
          .startsWith("comp_", "Invalid competition ID"),
        roleTypes: z
          .array(volunteerRoleTypeSchema)
          .min(1, "Select at least one role"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "canManageVolunteers")

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

    if (data.name) {
      metadata.inviteName = data.name
    }

    const db = getDb()

    // Check for existing volunteer invitation
    const existingInvitations = await db.query.teamInvitationTable.findMany({
      where: and(
        eq(teamInvitationTable.teamId, data.competitionTeamId),
        eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
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
        "This person has already been invited or has applied to volunteer for this competition.",
      )
    }

    // Check for existing approved volunteer membership
    const existingUser = await db.query.userTable.findFirst({
      where: eq(userTable.email, data.email.toLowerCase()),
      columns: { id: true },
    })

    if (existingUser) {
      const existingMembership = await db.query.teamMembershipTable.findFirst({
        where: and(
          eq(teamMembershipTable.teamId, data.competitionTeamId),
          eq(teamMembershipTable.userId, existingUser.id),
          eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
          eq(teamMembershipTable.isSystemRole, true),
        ),
      })
      if (existingMembership) {
        throw new Error(
          "This person is already a volunteer for this competition.",
        )
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
      roleId: "volunteer",
      isSystemRole: true,
      metadata: JSON.stringify(metadata),
      skipPermissionCheck: true,
      forceInvitation: true,
      emailOverrideFn: async ({ email, token, inviterName }) => {
        await sendVolunteerDirectInviteEmail({
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
 * Add a volunteer role type to a membership (cohost)
 */
export const cohostAddVolunteerRoleTypeFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        membershipId: membershipOrInvitationIdSchema,
        competitionTeamId: z
          .string()
          .startsWith("team_", "Invalid team ID"),
        competitionId: z
          .string()
          .startsWith("comp_", "Invalid competition ID"),
        roleType: volunteerRoleTypeSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "canManageVolunteers")

    const db = getDb()
    const isInvitation = data.membershipId.startsWith("tinv_")

    if (isInvitation) {
      const invitation = await db.query.teamInvitationTable.findFirst({
        where: eq(teamInvitationTable.id, data.membershipId),
      })

      if (!invitation) {
        throw new Error(`Invitation ${data.membershipId} not found`)
      }

      let meta: VolunteerMembershipMetadata
      try {
        meta = invitation.metadata
          ? (JSON.parse(invitation.metadata) as VolunteerMembershipMetadata)
          : { volunteerRoleTypes: [] }
      } catch {
        meta = { volunteerRoleTypes: [] }
      }

      const currentRoleTypes = meta.volunteerRoleTypes ?? []
      if (currentRoleTypes.includes(data.roleType)) {
        return { success: true }
      }

      meta.volunteerRoleTypes = [...currentRoleTypes, data.roleType]

      await db
        .update(teamInvitationTable)
        .set({ metadata: JSON.stringify(meta), updatedAt: new Date() })
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

      let meta: VolunteerMembershipMetadata
      try {
        meta = membership.metadata
          ? (JSON.parse(membership.metadata) as VolunteerMembershipMetadata)
          : { volunteerRoleTypes: [] }
      } catch {
        meta = { volunteerRoleTypes: [] }
      }

      const currentRoleTypes = meta.volunteerRoleTypes ?? []
      if (currentRoleTypes.includes(data.roleType)) {
        return { success: true }
      }

      meta.volunteerRoleTypes = [...currentRoleTypes, data.roleType]

      await db
        .update(teamMembershipTable)
        .set({ metadata: JSON.stringify(meta) })
        .where(eq(teamMembershipTable.id, data.membershipId))
    }

    return { success: true }
  })

/**
 * Remove a volunteer role type from a membership (cohost)
 */
export const cohostRemoveVolunteerRoleTypeFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        membershipId: membershipOrInvitationIdSchema,
        competitionTeamId: z
          .string()
          .startsWith("team_", "Invalid team ID"),
        competitionId: z
          .string()
          .startsWith("comp_", "Invalid competition ID"),
        roleType: volunteerRoleTypeSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "canManageVolunteers")

    const db = getDb()
    const isInvitation = data.membershipId.startsWith("tinv_")

    if (isInvitation) {
      const invitation = await db.query.teamInvitationTable.findFirst({
        where: eq(teamInvitationTable.id, data.membershipId),
      })

      if (!invitation) {
        throw new Error(`Invitation ${data.membershipId} not found`)
      }

      let meta: VolunteerMembershipMetadata
      try {
        meta = invitation.metadata
          ? (JSON.parse(invitation.metadata) as VolunteerMembershipMetadata)
          : { volunteerRoleTypes: [] }
      } catch {
        meta = { volunteerRoleTypes: [] }
      }

      const currentRoleTypes = meta.volunteerRoleTypes ?? []
      if (!currentRoleTypes.includes(data.roleType)) {
        return { success: true }
      }

      meta.volunteerRoleTypes = currentRoleTypes.filter(
        (r) => r !== data.roleType,
      )

      await db
        .update(teamInvitationTable)
        .set({ metadata: JSON.stringify(meta), updatedAt: new Date() })
        .where(eq(teamInvitationTable.id, data.membershipId))
    } else {
      const membership = await db.query.teamMembershipTable.findFirst({
        where: eq(teamMembershipTable.id, data.membershipId),
      })

      if (!membership) {
        throw new Error(`Membership ${data.membershipId} not found`)
      }

      let meta: VolunteerMembershipMetadata
      try {
        meta = membership.metadata
          ? (JSON.parse(membership.metadata) as VolunteerMembershipMetadata)
          : { volunteerRoleTypes: [] }
      } catch {
        meta = { volunteerRoleTypes: [] }
      }

      const currentRoleTypes = meta.volunteerRoleTypes ?? []
      if (!currentRoleTypes.includes(data.roleType)) {
        return { success: true }
      }

      meta.volunteerRoleTypes = currentRoleTypes.filter(
        (r) => r !== data.roleType,
      )

      await db
        .update(teamMembershipTable)
        .set({ metadata: JSON.stringify(meta) })
        .where(eq(teamMembershipTable.id, data.membershipId))
    }

    return { success: true }
  })

/**
 * Update volunteer membership metadata (cohost)
 */
export const cohostUpdateVolunteerMetadataFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        membershipId: membershipOrInvitationIdSchema,
        competitionTeamId: z
          .string()
          .startsWith("team_", "Invalid team ID"),
        competitionId: z
          .string()
          .startsWith("comp_", "Invalid competition ID"),
        metadata: z.record(z.string(), z.unknown()),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "canManageVolunteers")

    const session = await getSessionFromCookie()
    if (!session) {
      throw new Error("NOT_AUTHORIZED: You must be logged in")
    }

    const db = getDb()
    const isInvitation = data.membershipId.startsWith("tinv_")
    const newMetadata = data.metadata as Record<string, unknown>

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
      const updatedMetadata = { ...currentMetadata, ...newMetadata }

      await db
        .update(teamInvitationTable)
        .set({
          metadata: JSON.stringify(updatedMetadata),
          updatedAt: new Date(),
        })
        .where(eq(teamInvitationTable.id, data.membershipId))
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
 * Grant score input access to a volunteer (cohost)
 */
export const cohostGrantScoreAccessFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        volunteerId: z.string().min(1, "Volunteer ID is required"),
        competitionTeamId: z
          .string()
          .startsWith("team_", "Invalid team ID"),
        competitionId: z
          .string()
          .startsWith("comp_", "Invalid competition ID"),
        grantedBy: z.string().min(1, "Granter ID is required"),
        expiresAt: z.date().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "canManageVolunteers")

    const db = getDb()

    // Ensure the entitlement type exists
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
 * Revoke score input access from a user (cohost)
 */
export const cohostRevokeScoreAccessFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().min(1, "User ID is required"),
        competitionTeamId: z
          .string()
          .startsWith("team_", "Invalid team ID"),
        competitionId: z
          .string()
          .startsWith("comp_", "Invalid competition ID"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "canManageVolunteers")

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

    await db
      .update(entitlementTable)
      .set({ deletedAt: new Date() })
      .where(inArray(entitlementTable.id, entitlementIds))

    return { success: true }
  })

// ============================================================================
// Shift Functions
// ============================================================================

/**
 * Get all shifts for a competition (cohost)
 */
export const cohostGetCompetitionShiftsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    cohostBaseSchema
      .extend({
        competitionId: z
          .string()
          .startsWith("comp_", "Invalid competition ID"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)

    const db = getDb()

    const shifts = await db.query.volunteerShiftsTable.findMany({
      where: eq(volunteerShiftsTable.competitionId, data.competitionId),
      orderBy: [asc(volunteerShiftsTable.startTime)],
      with: {
        assignments: {
          with: {
            membership: {
              with: {
                user: true,
              },
            },
          },
        },
      },
    })

    return shifts
  })

/**
 * Create a new volunteer shift (cohost)
 */
export const cohostCreateShiftFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        competitionTeamId: z
          .string()
          .startsWith("team_", "Invalid team ID"),
        competitionId: z
          .string()
          .startsWith("comp_", "Invalid competition ID"),
        name: z.string().min(1, "Name is required").max(200),
        roleType: volunteerRoleTypeSchema,
        startTime: z.coerce.date(),
        endTime: z.coerce.date(),
        location: z.string().max(200).optional(),
        capacity: z.number().int().min(1).default(1),
        notes: z.string().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "canManageVolunteers")

    if (data.endTime <= data.startTime) {
      throw new Error("VALIDATION_ERROR: End time must be after start time")
    }

    const db = getDb()

    const newShiftId = createVolunteerShiftId()

    await db.insert(volunteerShiftsTable).values({
      id: newShiftId,
      competitionId: data.competitionId,
      name: data.name,
      roleType: data.roleType,
      startTime: data.startTime,
      endTime: data.endTime,
      location: data.location,
      capacity: data.capacity,
      notes: data.notes,
    })

    const newShift = await db.query.volunteerShiftsTable.findFirst({
      where: eq(volunteerShiftsTable.id, newShiftId),
    })

    if (!newShift) {
      throw new Error("Failed to create volunteer shift")
    }

    return newShift
  })

/**
 * Update a volunteer shift (cohost)
 */
export const cohostUpdateShiftFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        competitionTeamId: z
          .string()
          .startsWith("team_", "Invalid team ID"),
        shiftId: shiftIdSchema,
        name: z.string().min(1, "Name is required").max(200).optional(),
        roleType: volunteerRoleTypeSchema.optional(),
        startTime: z.coerce.date().optional(),
        endTime: z.coerce.date().optional(),
        location: z.string().max(200).nullable().optional(),
        capacity: z.number().int().min(1).optional(),
        notes: z.string().max(1000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "canManageVolunteers")

    const db = getDb()

    const existingShift = await db.query.volunteerShiftsTable.findFirst({
      where: eq(volunteerShiftsTable.id, data.shiftId),
    })

    if (!existingShift) {
      throw new Error("NOT_FOUND: Volunteer shift not found")
    }

    const updateValues: Partial<typeof volunteerShiftsTable.$inferInsert> = {}

    if (data.name !== undefined) updateValues.name = data.name
    if (data.roleType !== undefined) updateValues.roleType = data.roleType
    if (data.startTime !== undefined) updateValues.startTime = data.startTime
    if (data.endTime !== undefined) updateValues.endTime = data.endTime
    if (data.location !== undefined)
      updateValues.location = data.location ?? undefined
    if (data.capacity !== undefined) updateValues.capacity = data.capacity
    if (data.notes !== undefined) updateValues.notes = data.notes ?? undefined

    const newStartTime = data.startTime ?? existingShift.startTime
    const newEndTime = data.endTime ?? existingShift.endTime

    if (newEndTime <= newStartTime) {
      throw new Error("VALIDATION_ERROR: End time must be after start time")
    }

    updateValues.updatedAt = new Date()

    await db
      .update(volunteerShiftsTable)
      .set(updateValues)
      .where(eq(volunteerShiftsTable.id, data.shiftId))

    const updatedShift = await db.query.volunteerShiftsTable.findFirst({
      where: eq(volunteerShiftsTable.id, data.shiftId),
    })

    if (!updatedShift) {
      throw new Error("Failed to update volunteer shift")
    }

    return updatedShift
  })

/**
 * Delete a volunteer shift (cohost)
 */
export const cohostDeleteShiftFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        competitionTeamId: z
          .string()
          .startsWith("team_", "Invalid team ID"),
        shiftId: shiftIdSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "canManageVolunteers")

    const db = getDb()

    const existingShift = await db.query.volunteerShiftsTable.findFirst({
      where: eq(volunteerShiftsTable.id, data.shiftId),
    })

    if (!existingShift) {
      throw new Error("NOT_FOUND: Volunteer shift not found")
    }

    await db
      .delete(volunteerShiftsTable)
      .where(eq(volunteerShiftsTable.id, data.shiftId))

    return { success: true }
  })

/**
 * Assign a volunteer to a shift (cohost)
 */
export const cohostAssignVolunteerToShiftFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        competitionTeamId: z
          .string()
          .startsWith("team_", "Invalid team ID"),
        shiftId: shiftIdSchema,
        membershipId: membershipIdSchema,
        notes: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "canManageVolunteers")

    const db = getDb()

    const shift = await db.query.volunteerShiftsTable.findFirst({
      where: eq(volunteerShiftsTable.id, data.shiftId),
      with: {
        assignments: true,
      },
    })

    if (!shift) {
      throw new Error("NOT_FOUND: Volunteer shift not found")
    }

    const existingAssignment = shift.assignments.find(
      (a) => a.membershipId === data.membershipId,
    )
    if (existingAssignment) {
      throw new Error(
        "VALIDATION_ERROR: Volunteer is already assigned to this shift",
      )
    }

    if (shift.assignments.length >= shift.capacity) {
      throw new Error(
        `VALIDATION_ERROR: Shift capacity (${shift.capacity}) has been reached`,
      )
    }

    const membership = await db.query.teamMembershipTable.findFirst({
      where: eq(teamMembershipTable.id, data.membershipId),
    })

    if (!membership) {
      throw new Error("NOT_FOUND: Team membership not found")
    }

    const newAssignmentId = createVolunteerShiftAssignmentId()

    await db.insert(volunteerShiftAssignmentsTable).values({
      id: newAssignmentId,
      shiftId: data.shiftId,
      membershipId: data.membershipId,
      notes: data.notes,
    })

    const assignment = await db.query.volunteerShiftAssignmentsTable.findFirst({
      where: eq(volunteerShiftAssignmentsTable.id, newAssignmentId),
    })

    if (!assignment) {
      throw new Error("Failed to create shift assignment")
    }

    return assignment
  })

/**
 * Unassign a volunteer from a shift (cohost)
 */
export const cohostUnassignVolunteerFromShiftFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        competitionTeamId: z
          .string()
          .startsWith("team_", "Invalid team ID"),
        shiftId: shiftIdSchema,
        membershipId: membershipIdSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "canManageVolunteers")

    const db = getDb()

    const existingAssignment =
      await db.query.volunteerShiftAssignmentsTable.findFirst({
        where: and(
          eq(volunteerShiftAssignmentsTable.shiftId, data.shiftId),
          eq(volunteerShiftAssignmentsTable.membershipId, data.membershipId),
        ),
      })

    if (!existingAssignment) {
      throw new Error("NOT_FOUND: Assignment not found")
    }

    await db
      .delete(volunteerShiftAssignmentsTable)
      .where(eq(volunteerShiftAssignmentsTable.id, existingAssignment.id))

    return { success: true }
  })

/**
 * Bulk assign a role type to multiple volunteers (cohost)
 */
export const cohostBulkAssignVolunteerRoleFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        membershipIds: z
          .array(membershipOrInvitationIdSchema)
          .min(1, "Select at least one volunteer"),
        competitionTeamId: z
          .string()
          .startsWith("team_", "Invalid team ID"),
        competitionId: z
          .string()
          .startsWith("comp_", "Invalid competition ID"),
        roleType: volunteerRoleTypeSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "canManageVolunteers")

    const db = getDb()

    const results = await Promise.allSettled(
      data.membershipIds.map(async (membershipId) => {
        const isInvitation = membershipId.startsWith("tinv_")

        if (isInvitation) {
          const invitation = await db.query.teamInvitationTable.findFirst({
            where: eq(teamInvitationTable.id, membershipId),
          })
          if (!invitation) return

          let meta: VolunteerMembershipMetadata
          try {
            meta = invitation.metadata
              ? (JSON.parse(invitation.metadata) as VolunteerMembershipMetadata)
              : { volunteerRoleTypes: [] }
          } catch {
            meta = { volunteerRoleTypes: [] }
          }

          const currentRoleTypes = meta.volunteerRoleTypes ?? []
          if (!currentRoleTypes.includes(data.roleType)) {
            meta.volunteerRoleTypes = [...currentRoleTypes, data.roleType]
            await db
              .update(teamInvitationTable)
              .set({
                metadata: JSON.stringify(meta),
                updatedAt: new Date(),
              })
              .where(eq(teamInvitationTable.id, membershipId))
          }
        } else {
          const membership = await db.query.teamMembershipTable.findFirst({
            where: eq(teamMembershipTable.id, membershipId),
          })
          if (!membership || !isVolunteer(membership)) return

          let meta: VolunteerMembershipMetadata
          try {
            meta = membership.metadata
              ? (JSON.parse(membership.metadata) as VolunteerMembershipMetadata)
              : { volunteerRoleTypes: [] }
          } catch {
            meta = { volunteerRoleTypes: [] }
          }

          const currentRoleTypes = meta.volunteerRoleTypes ?? []
          if (!currentRoleTypes.includes(data.roleType)) {
            meta.volunteerRoleTypes = [...currentRoleTypes, data.roleType]
            await db
              .update(teamMembershipTable)
              .set({ metadata: JSON.stringify(meta) })
              .where(eq(teamMembershipTable.id, membershipId))
          }
        }
      }),
    )

    const succeeded = results.filter((r) => r.status === "fulfilled").length
    const failed = results.filter((r) => r.status === "rejected").length

    return { success: true, succeeded, failed }
  })
