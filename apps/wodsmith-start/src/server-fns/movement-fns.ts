/**
 * Movement Server Functions for TanStack Start
 */

import {createServerFn} from '@tanstack/react-start'
import {getDb} from '@/db'
import {movements} from '@/db/schemas/workouts'
import {getSessionFromCookie} from '@/utils/auth'

/**
 * Get all movements available in the system
 */
export const getAllMovementsFn = createServerFn({method: 'GET'}).handler(
  async () => {
    const db = getDb()

    // Verify authentication
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error('Not authenticated')
    }

    const allMovements = await db.select().from(movements)

    return {movements: allMovements}
  },
)
