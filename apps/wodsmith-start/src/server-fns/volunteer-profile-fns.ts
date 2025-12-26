/**
 * Volunteer Profile Server Functions for TanStack Start
 * Self-service actions for volunteers to update their own profile information
 */

import {createServerFn} from '@tanstack/react-start'
import {eq} from 'drizzle-orm'
import {z} from 'zod'
import {getDb} from '@/db'
import {teamMembershipTable} from '@/db/schemas/teams'
import {VOLUNTEER_AVAILABILITY} from '@/db/schemas/volunteers'
import {getSessionFromCookie} from '@/utils/auth'

// ============================================================================
// Input Schemas
// ============================================================================

const updateVolunteerProfileInputSchema = z.object({
  membershipId: z.string().startsWith('tmem_', 'Invalid membership ID'),
  competitionSlug: z.string().min(1, 'Competition slug is required'),
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

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Update volunteer's own profile information
 * Self-service action for volunteers to update their availability and credentials
 */
export const updateVolunteerProfileFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) =>
    updateVolunteerProfileInputSchema.parse(data),
  )
  .handler(async ({data}) => {
    const session = await getSessionFromCookie()

    if (!session) {
      throw new Error('NOT_AUTHORIZED: You must be logged in')
    }

    const db = getDb()

    // Get the membership to verify ownership
    const membership = await db.query.teamMembershipTable.findFirst({
      where: eq(teamMembershipTable.id, data.membershipId),
    })

    if (!membership) {
      throw new Error('NOT_FOUND: Membership not found')
    }

    // Verify the user owns this membership
    if (membership.userId !== session.userId) {
      throw new Error('FORBIDDEN: You can only update your own profile')
    }

    // Parse current metadata
    const currentMetadata = membership.metadata
      ? (JSON.parse(membership.metadata) as Record<string, unknown>)
      : {}

    // Merge with new data - always update all fields (undefined = clear the field)
    const updatedMetadata = {
      ...currentMetadata,
      availability: data.availability || currentMetadata.availability,
      credentials: data.credentials || undefined,
      availabilityNotes: data.availabilityNotes || undefined,
    }

    // Update membership
    await db
      .update(teamMembershipTable)
      .set({
        metadata: JSON.stringify(updatedMetadata),
        updatedAt: new Date(),
      })
      .where(eq(teamMembershipTable.id, data.membershipId))

    // Note: In TanStack Start, we don't have revalidatePath like Next.js
    // The router handles revalidation differently

    return {success: true}
  })
