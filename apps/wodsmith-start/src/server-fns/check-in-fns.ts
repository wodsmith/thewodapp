/**
 * Competition Check-In Server Functions
 *
 * Day-of check-in for in-person competitions. Volunteers (with the volunteer
 * role on the competition team) and organizers (MANAGE_COMPETITIONS) can:
 *   - Search registrations by team name, member name, or member email
 *   - Mark a registration as checked in
 *   - Sign a waiver on behalf of a teammate (when handing the iPad to them)
 *
 * Per-team check-in: a single timestamp on competitionRegistrationsTable.
 * Per-athlete waiver status is read from waiverSignaturesTable.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  competitionRegistrationsTable,
  competitionsTable,
  REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import {
  SYSTEM_ROLES_ENUM,
  TEAM_PERMISSIONS,
  teamMembershipTable,
} from "@/db/schemas/teams"
import { ROLES_ENUM } from "@/db/schemas/users"
import {
  createWaiverSignatureId,
  waiverSignaturesTable,
  waiversTable,
} from "@/db/schemas/waivers"
import { getSessionFromCookie } from "@/utils/auth"
import { hasTeamPermission } from "@/utils/team-auth"

// ============================================================================
// Auth helper
// ============================================================================

/**
 * Require check-in access for a competition.
 * Allows: site admin, organizer (MANAGE_COMPETITIONS on organizing team),
 * or any member of the competition team with the volunteer role.
 *
 * Returns the loaded competition + the calling userId for audit trails.
 */
async function requireCheckInAccess(competitionId: string): Promise<{
  competition: {
    id: string
    organizingTeamId: string
    competitionTeamId: string | null
    competitionType: "in-person" | "online"
  }
  userId: string
}> {
  const session = await getSessionFromCookie()
  if (!session?.userId) {
    throw new Error("NOT_AUTHORIZED: Not authenticated")
  }

  const db = getDb()
  const competition = await db.query.competitionsTable.findFirst({
    where: eq(competitionsTable.id, competitionId),
    columns: {
      id: true,
      organizingTeamId: true,
      competitionTeamId: true,
      competitionType: true,
    },
  })

  if (!competition) {
    throw new Error("NOT_FOUND: Competition not found")
  }

  if (session.user.role === ROLES_ENUM.ADMIN) {
    return { competition, userId: session.userId }
  }

  const isOrganizer = await hasTeamPermission(
    competition.organizingTeamId,
    TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
  )
  if (isOrganizer) {
    return { competition, userId: session.userId }
  }

  // Fall back: volunteer role on the competition team
  const isVolunteer =
    competition.competitionTeamId &&
    !!session.teams?.some(
      (t) =>
        t.id === competition.competitionTeamId &&
        t.role.id === SYSTEM_ROLES_ENUM.VOLUNTEER,
    )
  if (isVolunteer) {
    return { competition, userId: session.userId }
  }

  throw new Error("FORBIDDEN: You don't have check-in access for this competition")
}

// ============================================================================
// Types
// ============================================================================

export interface CheckInTeammate {
  membershipId: string
  userId: string
  firstName: string | null
  lastName: string | null
  email: string | null
  avatar: string | null
  isCaptain: boolean
  /** Map of waiverId -> signedAt date. Missing key = unsigned. */
  signedWaivers: Record<string, string>
}

export interface CheckInRegistration {
  id: string
  teamName: string | null
  divisionId: string | null
  divisionLabel: string | null
  status: string
  checkedInAt: string | null
  checkedInBy: string | null
  registeredAt: string
  members: CheckInTeammate[]
  pendingTeammates: Array<{ email: string; firstName?: string; lastName?: string }>
}

export interface CheckInWaiver {
  id: string
  title: string
  required: boolean
  position: number
  content: string
}

// ============================================================================
// Search registrations
// ============================================================================

const searchInputSchema = z.object({
  competitionId: z.string().min(1),
  query: z.string().max(200).optional(),
})

/**
 * Returns up to 50 registrations for a competition, optionally filtered by a
 * substring match against team name, member name, member email, or pending
 * teammate email. Empty/short query returns all registrations.
 */
export const searchCompetitionRegistrationsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => searchInputSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{ registrations: CheckInRegistration[] }> => {
      const { competition } = await requireCheckInAccess(data.competitionId)

      const db = getDb()
      const rawQuery = data.query?.trim() ?? ""

      // Pull all active registrations with members and division.
      const registrations =
        await db.query.competitionRegistrationsTable.findMany({
          where: and(
            eq(competitionRegistrationsTable.eventId, competition.id),
            eq(competitionRegistrationsTable.status, REGISTRATION_STATUS.ACTIVE),
          ),
          with: {
            division: { columns: { id: true, label: true } },
            athleteTeam: {
              with: {
                memberships: {
                  where: eq(teamMembershipTable.isActive, true),
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
                },
              },
            },
            // For solo registrations there is no athleteTeam — fetch the captain.
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

      // Collect every userId so we can fetch their waiver signatures in one query.
      const allUserIds = new Set<string>()
      for (const reg of registrations) {
        if (reg.athleteTeam?.memberships) {
          for (const m of reg.athleteTeam.memberships) {
            if (m.userId) allUserIds.add(m.userId)
          }
        } else if (reg.userId) {
          allUserIds.add(reg.userId)
        }
      }

      const competitionWaivers = await db.query.waiversTable.findMany({
        where: eq(waiversTable.competitionId, competition.id),
        columns: { id: true },
      })
      const waiverIds = competitionWaivers.map((w) => w.id)

      const signaturesByUser: Map<string, Map<string, Date>> = new Map()
      if (allUserIds.size > 0 && waiverIds.length > 0) {
        const sigs = await db
          .select({
            userId: waiverSignaturesTable.userId,
            waiverId: waiverSignaturesTable.waiverId,
            signedAt: waiverSignaturesTable.signedAt,
          })
          .from(waiverSignaturesTable)
          .where(
            and(
              inArray(waiverSignaturesTable.userId, Array.from(allUserIds)),
              inArray(waiverSignaturesTable.waiverId, waiverIds),
            ),
          )
        for (const sig of sigs) {
          let userMap = signaturesByUser.get(sig.userId)
          if (!userMap) {
            userMap = new Map()
            signaturesByUser.set(sig.userId, userMap)
          }
          userMap.set(sig.waiverId, sig.signedAt)
        }
      }

      const shaped: CheckInRegistration[] = registrations.map((reg) => {
        const members: CheckInTeammate[] = []

        if (reg.athleteTeam?.memberships?.length) {
          for (const m of reg.athleteTeam.memberships) {
            if (!m.user) continue
            const sigMap = signaturesByUser.get(m.userId) ?? new Map()
            members.push({
              membershipId: m.id,
              userId: m.userId,
              firstName: m.user.firstName,
              lastName: m.user.lastName,
              email: m.user.email,
              avatar: m.user.avatar,
              isCaptain: m.userId === reg.captainUserId || m.userId === reg.userId,
              signedWaivers: Object.fromEntries(
                Array.from(sigMap.entries()).map(([wid, d]) => [
                  wid,
                  d.toISOString(),
                ]),
              ),
            })
          }
        } else if (reg.user) {
          const sigMap = signaturesByUser.get(reg.user.id) ?? new Map()
          members.push({
            membershipId: reg.teamMemberId,
            userId: reg.user.id,
            firstName: reg.user.firstName,
            lastName: reg.user.lastName,
            email: reg.user.email,
            avatar: reg.user.avatar,
            isCaptain: true,
            signedWaivers: Object.fromEntries(
              Array.from(sigMap.entries()).map(([wid, d]) => [
                wid,
                d.toISOString(),
              ]),
            ),
          })
        }

        let pendingTeammates: CheckInRegistration["pendingTeammates"] = []
        if (reg.pendingTeammates) {
          try {
            pendingTeammates = JSON.parse(reg.pendingTeammates) as CheckInRegistration["pendingTeammates"]
          } catch {
            pendingTeammates = []
          }
        }

        return {
          id: reg.id,
          teamName: reg.teamName,
          divisionId: reg.divisionId,
          divisionLabel: reg.division?.label ?? null,
          status: reg.status,
          checkedInAt: reg.checkedInAt?.toISOString() ?? null,
          checkedInBy: reg.checkedInBy,
          registeredAt: reg.registeredAt.toISOString(),
          members,
          pendingTeammates,
        }
      })

      // Filter in JS — registrations are typically <500 per competition and
      // we need to search across nested arrays (members, pending teammates).
      const filtered = rawQuery
        ? shaped.filter((reg) => matchesQuery(reg, rawQuery.toLowerCase()))
        : shaped

      // Sort: not-checked-in first, then alphabetical by team name / first member name.
      filtered.sort((a, b) => {
        if (!!a.checkedInAt !== !!b.checkedInAt) {
          return a.checkedInAt ? 1 : -1
        }
        return registrationLabel(a).localeCompare(registrationLabel(b))
      })

      return { registrations: filtered.slice(0, 50) }
    },
  )

function registrationLabel(r: CheckInRegistration): string {
  if (r.teamName) return r.teamName
  const first = r.members[0]
  if (!first) return ""
  const name = `${first.firstName ?? ""} ${first.lastName ?? ""}`.trim()
  return name || first.email || ""
}

function matchesQuery(reg: CheckInRegistration, q: string): boolean {
  if (reg.teamName?.toLowerCase().includes(q)) return true
  for (const m of reg.members) {
    if (m.email?.toLowerCase().includes(q)) return true
    if (m.firstName?.toLowerCase().includes(q)) return true
    if (m.lastName?.toLowerCase().includes(q)) return true
    const full = `${m.firstName ?? ""} ${m.lastName ?? ""}`.toLowerCase().trim()
    if (full?.includes(q)) return true
  }
  for (const p of reg.pendingTeammates) {
    if (p.email.toLowerCase().includes(q)) return true
    if (p.firstName?.toLowerCase().includes(q)) return true
    if (p.lastName?.toLowerCase().includes(q)) return true
  }
  return false
}

// ============================================================================
// Toggle check-in
// ============================================================================

const checkInInputSchema = z.object({
  competitionId: z.string().min(1),
  registrationId: z.string().startsWith("creg_"),
  checkedIn: z.boolean(),
})

export const checkInRegistrationFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => checkInInputSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{
      success: true
      checkedInAt: string | null
      checkedInBy: string | null
    }> => {
      const { competition, userId } = await requireCheckInAccess(
        data.competitionId,
      )

      if (competition.competitionType === "online") {
        throw new Error(
          "Check-in is only available for in-person competitions",
        )
      }

      const db = getDb()

      // Verify the registration belongs to this competition.
      const reg = await db.query.competitionRegistrationsTable.findFirst({
        where: and(
          eq(competitionRegistrationsTable.id, data.registrationId),
          eq(competitionRegistrationsTable.eventId, competition.id),
        ),
        columns: { id: true },
      })
      if (!reg) {
        throw new Error("NOT_FOUND: Registration not found for this competition")
      }

      const now = new Date()
      await db
        .update(competitionRegistrationsTable)
        .set({
          checkedInAt: data.checkedIn ? now : null,
          checkedInBy: data.checkedIn ? userId : null,
        })
        .where(eq(competitionRegistrationsTable.id, data.registrationId))

      return {
        success: true,
        checkedInAt: data.checkedIn ? now.toISOString() : null,
        checkedInBy: data.checkedIn ? userId : null,
      }
    },
  )

// ============================================================================
// Sign waiver at check-in (volunteer hands iPad to athlete)
// ============================================================================

const signAtCheckInInputSchema = z.object({
  competitionId: z.string().min(1),
  registrationId: z.string().startsWith("creg_"),
  athleteUserId: z.string().min(1),
  waiverId: z.string().startsWith("waiv_"),
})

/**
 * Records a waiver signature on behalf of an athlete during check-in.
 *
 * The signature's userId is the athlete (so the legal record reflects who
 * agreed). The volunteer/organizer who operated the iPad is implicitly
 * audited via session, but no separate field is recorded for now.
 *
 * Idempotent: if the athlete already signed this waiver, returns success
 * without creating a duplicate.
 */
export const signWaiverAtCheckInFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => signAtCheckInInputSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{ success: true; signedAt: string }> => {
      const { competition } = await requireCheckInAccess(data.competitionId)

      const db = getDb()

      // Validate the waiver belongs to this competition.
      const waiver = await db.query.waiversTable.findFirst({
        where: and(
          eq(waiversTable.id, data.waiverId),
          eq(waiversTable.competitionId, competition.id),
        ),
        columns: { id: true },
      })
      if (!waiver) {
        throw new Error("NOT_FOUND: Waiver not found for this competition")
      }

      // Validate the athlete is part of this registration (captain, team
      // member, or solo registrant).
      const registration =
        await db.query.competitionRegistrationsTable.findFirst({
          where: and(
            eq(competitionRegistrationsTable.id, data.registrationId),
            eq(competitionRegistrationsTable.eventId, competition.id),
          ),
          with: {
            athleteTeam: {
              with: {
                memberships: {
                  columns: { userId: true, isActive: true },
                },
              },
            },
          },
        })
      if (!registration) {
        throw new Error("NOT_FOUND: Registration not found for this competition")
      }

      const memberUserIds = new Set<string>()
      if (registration.userId) memberUserIds.add(registration.userId)
      if (registration.captainUserId)
        memberUserIds.add(registration.captainUserId)
      for (const m of registration.athleteTeam?.memberships ?? []) {
        if (m.isActive && m.userId) memberUserIds.add(m.userId)
      }
      if (!memberUserIds.has(data.athleteUserId)) {
        throw new Error(
          "FORBIDDEN: Athlete is not a member of this registration",
        )
      }

      // Idempotent: short-circuit if already signed.
      const existing = await db.query.waiverSignaturesTable.findFirst({
        where: and(
          eq(waiverSignaturesTable.waiverId, data.waiverId),
          eq(waiverSignaturesTable.userId, data.athleteUserId),
        ),
        columns: { signedAt: true },
      })
      if (existing) {
        return { success: true, signedAt: existing.signedAt.toISOString() }
      }

      const now = new Date()
      await db.insert(waiverSignaturesTable).values({
        id: createWaiverSignatureId(),
        waiverId: data.waiverId,
        userId: data.athleteUserId,
        registrationId: data.registrationId,
        signedAt: now,
      })

      return { success: true, signedAt: now.toISOString() }
    },
  )
