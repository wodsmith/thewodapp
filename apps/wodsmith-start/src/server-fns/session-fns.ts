/**
 * Session Management Server Functions for TanStack Start
 * Handles listing and revoking user sessions
 */
import {createServerFn} from '@tanstack/react-start'
import {UAParser} from 'ua-parser-js'
import {z} from 'zod'
import {getSessionFromCookie} from '@/utils/auth'
import {
  deleteKVSession,
  getAllSessionIdsOfUser,
  getKVSession,
  type KVSession,
} from '@/utils/kv-session'

// ============================================================================
// Type Definitions
// ============================================================================

export interface ParsedUserAgent {
  ua: string
  browser: {
    name: string | undefined
    version: string | undefined
    major: string | undefined
  }
  device: {
    model: string | undefined
    type: string | undefined
    vendor: string | undefined
  }
  engine: {
    name: string | undefined
    version: string | undefined
  }
  os: {
    name: string | undefined
    version: string | undefined
  }
}

export interface SessionWithMeta extends KVSession {
  isCurrentSession: boolean
  expiration?: Date
  createdAt: number
  userAgent?: string | null
  parsedUserAgent?: ParsedUserAgent
}

// ============================================================================
// Input Schemas
// ============================================================================

const revokeSessionInputSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
})

// ============================================================================
// Helper Functions
// ============================================================================

function isValidSession(session: unknown): session is SessionWithMeta {
  if (!session || typeof session !== 'object') return false
  const sessionObj = session as Record<string, unknown>
  return 'createdAt' in sessionObj && typeof sessionObj.createdAt === 'number'
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all sessions for the current user
 */
export const getUserSessionsFn = createServerFn({method: 'GET'}).handler(
  async () => {
    const session = await getSessionFromCookie()

    if (!session?.user?.id) {
      throw new Error('Not authenticated')
    }

    if (!session.user.emailVerified) {
      throw new Error('Email not verified')
    }

    const sessionIds = await getAllSessionIdsOfUser(session.user.id)
    const sessions = await Promise.all(
      sessionIds.map(async ({key, absoluteExpiration}) => {
        const sessionId = key.split(':')[2] // Format is "session:userId:sessionId"
        if (!sessionId) {
          return null
        }
        const sessionData = await getKVSession(sessionId, session.user.id)
        if (!sessionData) return null

        // Parse user agent on the server
        const result = new UAParser(sessionData.userAgent ?? '').getResult()

        return {
          ...sessionData,
          isCurrentSession: sessionId === session.id,
          expiration: absoluteExpiration,
          createdAt: sessionData.createdAt ?? 0,
          parsedUserAgent: {
            ua: result.ua,
            browser: {
              name: result.browser.name,
              version: result.browser.version,
              major: result.browser.major,
            },
            device: {
              model: result.device.model,
              type: result.device.type,
              vendor: result.device.vendor,
            },
            engine: {
              name: result.engine.name,
              version: result.engine.version,
            },
            os: {
              name: result.os.name,
              version: result.os.version,
            },
          },
        } as SessionWithMeta
      }),
    )

    // Filter out any null sessions and sort by creation date
    return sessions
      .filter(isValidSession)
      .sort((a, b) => b.createdAt - a.createdAt)
  },
)

/**
 * Revoke (delete) a specific session
 */
export const revokeSessionFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) => revokeSessionInputSchema.parse(data))
  .handler(async ({data}) => {
    const session = await getSessionFromCookie()

    if (!session?.user?.id) {
      throw new Error('Not authenticated')
    }

    // Delete the session from KV
    await deleteKVSession(data.sessionId, session.user.id)

    return {success: true}
  })
