import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { ROLES_ENUM } from "@/db/schemas/users"
import type { SessionValidationResult } from "@/types"
import { getSessionFromCookie } from "@/utils/auth"

// @lat: [[auth#Sessions]]
// @lat: [[crew#Event Setup Dashboard]]
export type CrewAuthSession = NonNullable<SessionValidationResult>

// @lat: [[auth#Sessions]]
// @lat: [[crew#Event Setup Dashboard]]
export interface CrewAuthState {
  session: SessionValidationResult
  isAdmin: boolean
  canManageCrewEvents: boolean
}

// @lat: [[crew#Event Setup Dashboard]]
export interface CrewManageableEvent {
  organizingTeamId: string
  competitionTeamId?: string | null
}

// @lat: [[auth#Sessions]]
// @lat: [[crew#Event Setup Dashboard]]
export async function getCrewAuthState(): Promise<CrewAuthState> {
  const session = await getSessionFromCookie().catch(() => null)
  const isAdmin = Boolean(session && isCrewAdminSession(session))
  const canManageCrewEvents = Boolean(
    session && (isAdmin || getCrewManageCompetitionTeamIds(session).size > 0),
  )

  return {
    session,
    isAdmin,
    canManageCrewEvents,
  }
}

// @lat: [[auth#Sessions]]
// @lat: [[crew#Event Setup Dashboard]]
export async function requireCrewSignedIn(featureName = "Crew") {
  const session = await getSessionFromCookie().catch(() => null)

  if (!session?.userId) {
    throw new Error(`NOT_AUTHORIZED: ${featureName} requires sign-in`)
  }

  return session
}

// @lat: [[crew#Event Setup Dashboard]]
export async function requireCrewEventManagerAccess(
  event: CrewManageableEvent,
  featureName = "Crew event",
) {
  const session = await requireCrewSignedIn(featureName)

  if (!canManageCrewEvent(session, event)) {
    throw new Error(`FORBIDDEN: ${featureName} organizer access is required`)
  }

  return session
}

// @lat: [[auth#Sessions]]
// @lat: [[crew#Crew Admin Shell]]
export function isCrewAdminSession(session: CrewAuthSession) {
  return session.user.role === ROLES_ENUM.ADMIN
}

// @lat: [[crew#Event Setup Dashboard]]
export function canManageCrewEvent(
  session: CrewAuthSession,
  event: CrewManageableEvent,
) {
  if (isCrewAdminSession(session)) return true

  const teamIds = getCrewManageCompetitionTeamIds(session)
  return (
    teamIds.has(event.organizingTeamId) ||
    Boolean(event.competitionTeamId && teamIds.has(event.competitionTeamId))
  )
}

// @lat: [[crew#Event Setup Dashboard]]
export function getCrewManageCompetitionTeamIds(session: CrewAuthSession) {
  return new Set(
    (session.teams ?? [])
      .filter((team) =>
        team.permissions.includes(TEAM_PERMISSIONS.MANAGE_COMPETITIONS),
      )
      .map((team) => team.id),
  )
}
