/**
 * Registration function stubs for TanStack Start migration
 * TODO: Port these functions from apps/wodsmith/src/server/competitions.ts
 */

import {getDb} from '@/db'
import {competitionRegistrationsTable} from '@/db/schema'

interface RegisterForCompetitionParams {
  competitionId: string
  userId: string
  divisionId: string
  teamName?: string
  affiliateName?: string
  teammates?: Array<{
    email: string
    firstName?: string
    lastName?: string
    affiliateName?: string
  }>
}

/**
 * Register a user for a competition
 * TODO: Port full implementation from apps/wodsmith/src/server/competitions.ts
 */
export async function registerForCompetition(
  params: RegisterForCompetitionParams,
): Promise<{registrationId: string}> {
  const db = getDb()

  // Create registration record
  const [registration] = await db
    .insert(competitionRegistrationsTable)
    .values({
      eventId: params.competitionId,
      userId: params.userId,
      divisionId: params.divisionId,
      teamName: params.teamName,
      affiliateName: params.affiliateName,
      // TODO: Handle team creation and invitations for team registrations
    })
    .returning()

  if (!registration) {
    throw new Error('Failed to create registration')
  }

  return {registrationId: registration.id}
}

interface NotifyRegistrationConfirmedParams {
  userId: string
  registrationId: string
  competitionId: string
  isPaid: boolean
}

/**
 * Send registration confirmation notification
 * TODO: Port full implementation from apps/wodsmith/src/server/notifications.ts
 */
export async function notifyRegistrationConfirmed(
  _params: NotifyRegistrationConfirmedParams,
): Promise<void> {
  // TODO: Implement email notification
  console.log('TODO: Send registration confirmation email')
}
