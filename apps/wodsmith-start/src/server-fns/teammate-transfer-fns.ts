/**
 * Teammate Transfer Server Functions for TanStack Start
 *
 * Allows captains or organizers to replace a teammate (confirmed member
 * or pending invitation) on a competition registration with a different
 * email address. The old member/invitation is removed and a new invitation
 * is sent to the replacement email.
 *
 * OBSERVABILITY:
 * - All transfer operations are logged with request context
 * - Registration IDs, competition IDs, and transfer details are tracked
 */

import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  competitionRegistrationsTable,
  competitionsTable,
  ROLES_ENUM,
  SYSTEM_ROLES_ENUM,
  TEAM_PERMISSIONS,
  teamInvitationTable,
  teamMembershipTable,
  userTable,
} from "@/db/schema"
import {
  addRequestContextAttribute,
  logInfo,
  updateRequestContext,
} from "@/lib/logging"
import { getSessionFromCookie } from "@/utils/auth"
import { updateAllSessionsOfUser } from "@/utils/kv-session"
import { inviteUserToTeam } from "@/server/team-members"

// ============================================================================
// Transfer Teammate
// ============================================================================

const transferTeammateInputSchema = z.object({
  registrationId: z.string().min(1),
  type: z.enum(["member", "invitation"]),
  targetId: z.string().min(1),
  newEmail: z.string().email(),
})

/**
 * Replace a teammate on a competition registration with a different email.
 *
 * - For confirmed members: deactivates the membership and sends a new invitation
 * - For pending invitations: deletes the old invitation and sends a new one
 * - Captains can transfer teammates while registration is still open
 * - Organizers (MANAGE_COMPETITIONS or ADMIN) can transfer teammates any time
 */
export const transferTeammateFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    transferTeammateInputSchema.parse(data),
  )
  .handler(async ({ data: input }) => {
    const session = await getSessionFromCookie()
    if (!session) {
      throw new Error("NOT_AUTHORIZED: Not authenticated")
    }

    const db = getDb()

    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("registrationId", input.registrationId)

    // 1. Load the registration
    const registration =
      await db.query.competitionRegistrationsTable.findFirst({
        where: eq(
          competitionRegistrationsTable.id,
          input.registrationId,
        ),
      })

    if (!registration) throw new Error("Registration not found")
    if (!registration.athleteTeamId) {
      throw new Error(
        "This registration does not have a team — teammate transfer is not applicable",
      )
    }

    addRequestContextAttribute("competitionId", registration.eventId)

    // 2. Determine if caller is captain or organizer
    const isCaptain = registration.captainUserId === session.userId

    let isOrganizer = false
    if (session.user?.role === ROLES_ENUM.ADMIN) {
      isOrganizer = true
    }

    // Load competition for organizer check and registration window validation
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, registration.eventId),
      columns: {
        id: true,
        organizingTeamId: true,
        registrationClosesAt: true,
        timezone: true,
      },
    })

    if (!competition) throw new Error("Competition not found")

    if (!isOrganizer) {
      const team = session.teams?.find(
        (t) => t.id === competition.organizingTeamId,
      )
      if (
        team?.permissions.includes(TEAM_PERMISSIONS.MANAGE_COMPETITIONS)
      ) {
        isOrganizer = true
      }
    }

    // 3. Authorization check
    if (!isCaptain && !isOrganizer) {
      throw new Error(
        "NOT_AUTHORIZED: Only the team captain or a competition organizer can transfer teammates",
      )
    }

    // 4. If caller is captain (not organizer), check registration window
    if (isCaptain && !isOrganizer) {
      if (competition.registrationClosesAt) {
        const closesAt = new Date(competition.registrationClosesAt)
        if (closesAt < new Date()) {
          throw new Error("Registration is closed")
        }
      }
    }

    logInfo({
      message: "[TeammateTransfer] Starting teammate transfer",
      attributes: {
        registrationId: input.registrationId,
        type: input.type,
        targetId: input.targetId,
        newEmail: input.newEmail,
        callerIsCaptain: String(isCaptain),
        callerIsOrganizer: String(isOrganizer),
      },
    })

    if (input.type === "member") {
      // ================================================================
      // Transfer confirmed member
      // ================================================================

      // 1. Load the membership
      const membership = await db.query.teamMembershipTable.findFirst({
        where: eq(teamMembershipTable.id, input.targetId),
      })

      if (!membership) throw new Error("Team membership not found")

      // 2. Verify membership belongs to the registration's athlete team
      if (membership.teamId !== registration.athleteTeamId) {
        throw new Error(
          "Membership does not belong to this registration's team",
        )
      }

      // 3. Verify the member is not the captain
      if (membership.userId === registration.captainUserId) {
        throw new Error(
          "Cannot transfer the team captain — use purchase transfer instead",
        )
      }

      // 4. Verify newEmail is different from the current member's email
      const currentUser = await db.query.userTable.findFirst({
        where: eq(userTable.id, membership.userId),
        columns: { id: true, email: true },
      })

      if (
        currentUser?.email &&
        currentUser.email.toLowerCase() === input.newEmail.toLowerCase()
      ) {
        throw new Error(
          "The new email is the same as the current teammate's email",
        )
      }

      // 5. Deactivate the membership
      await db
        .update(teamMembershipTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(teamMembershipTable.id, input.targetId))

      logInfo({
        message:
          "[TeammateTransfer] Deactivated athlete team membership",
        attributes: {
          membershipId: input.targetId,
          userId: membership.userId,
        },
      })

      // 6. Update the removed user's sessions
      await updateAllSessionsOfUser(membership.userId)

      // 7. Create a new invitation for the replacement
      await inviteUserToTeam({
        teamId: registration.athleteTeamId,
        email: input.newEmail,
        roleId: SYSTEM_ROLES_ENUM.MEMBER,
        isSystemRole: true,
        skipPermissionCheck: true,
        forceInvitation: true,
      })

      logInfo({
        message:
          "[TeammateTransfer] Confirmed member transfer completed",
        attributes: {
          registrationId: input.registrationId,
          removedUserId: membership.userId,
          newEmail: input.newEmail,
        },
      })
    } else {
      // ================================================================
      // Transfer pending invitation
      // ================================================================

      // 1. Load the invitation
      const invitation = await db.query.teamInvitationTable.findFirst({
        where: eq(teamInvitationTable.id, input.targetId),
      })

      if (!invitation) throw new Error("Invitation not found")

      // 2. Verify the invitation belongs to the registration's athlete team
      if (invitation.teamId !== registration.athleteTeamId) {
        throw new Error(
          "Invitation does not belong to this registration's team",
        )
      }

      // 3. Verify the invitation hasn't been accepted
      if (invitation.acceptedAt) {
        throw new Error(
          "This invitation has already been accepted — use member transfer instead",
        )
      }

      // 4. Verify newEmail is different from the invitation's email
      if (
        invitation.email.toLowerCase() === input.newEmail.toLowerCase()
      ) {
        throw new Error(
          "The new email is the same as the current invitation email",
        )
      }

      // 5. Delete the old invitation
      await db
        .delete(teamInvitationTable)
        .where(eq(teamInvitationTable.id, input.targetId))

      logInfo({
        message: "[TeammateTransfer] Deleted old invitation",
        attributes: {
          invitationId: input.targetId,
          oldEmail: invitation.email,
        },
      })

      // 6. Create a new invitation for the replacement
      await inviteUserToTeam({
        teamId: registration.athleteTeamId,
        email: input.newEmail,
        roleId: SYSTEM_ROLES_ENUM.MEMBER,
        isSystemRole: true,
        skipPermissionCheck: true,
        forceInvitation: true,
      })

      logInfo({
        message:
          "[TeammateTransfer] Pending invitation transfer completed",
        attributes: {
          registrationId: input.registrationId,
          oldEmail: invitation.email,
          newEmail: input.newEmail,
        },
      })
    }

    return { success: true }
  })
