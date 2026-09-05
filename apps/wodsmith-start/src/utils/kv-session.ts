import { env } from "cloudflare:workers"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { eq } from "drizzle-orm"
import { MAX_SESSIONS_PER_USER } from "@/constants"
import { getDb } from "@/db"
import { teamMembershipTable, userTable } from "@/db/schema"
import { getUserEntitlements } from "@/server/entitlements"
import { getUserFromDB, getUserTeamsWithPermissions } from "@/utils/auth"
import { getIP } from "./get-IP"

const SESSION_PREFIX = "session:"

function getSessionRevocationKey(userId: string): string {
  return `session-revoked-before:${userId}`
}

export function getSessionKey(userId: string, sessionId: string): string {
  return `${SESSION_PREFIX}${userId}:${sessionId}`
}

type KVSessionUser = Exclude<
  Awaited<ReturnType<typeof getUserFromDB>>,
  undefined
>

export interface KVSession {
  id: string
  userId: string
  expiresAt: number
  createdAt: number
  user: KVSessionUser & {
    initials?: string
  }
  country?: string
  city?: string
  continent?: string
  ip?: string | null
  userAgent?: string | null
  authenticationType?: "passkey" | "password" | "google-oauth"
  passkeyCredentialId?: string
  /**
   * Teams data - contains list of teams the user is a member of
   * along with role and permissions data
   */
  teams?: {
    id: string
    name: string
    slug: string
    type: string
    isPersonalTeam: boolean
    role: {
      id: string
      name: string
      isSystemRole: boolean
    }
    permissions: string[]
    /** Team's current plan with features and limits */
    plan?: {
      id: string
      name: string
      features: string[]
      limits: Record<string, number>
    }
  }[]
  /**
   * User-level entitlements (individual purchases, grants, trials)
   * Cached from database for fast access checks
   */
  entitlements?: {
    id: string
    type: string
    metadata: Record<string, any>
    expiresAt: Date | null
  }[]
  /**
   *  !!!!!!!!!!!!!!!!!!!!!
   *  !!!   IMPORTANT   !!!
   *  !!!!!!!!!!!!!!!!!!!!!
   *
   *  IF YOU MAKE ANY CHANGES TO THIS OBJECT DON'T FORGET TO INCREMENT "CURRENT_SESSION_VERSION" BELOW
   *  IF YOU FORGET, THE SESSION WILL NOT BE UPDATED IN THE DATABASE
   */
  version?: number
}

/**
 *  !!!!!!!!!!!!!!!!!!!!!
 *  !!!   IMPORTANT   !!!
 *  !!!!!!!!!!!!!!!!!!!!!
 *
 * IF YOU MAKE ANY CHANGES TO THE KVSESSION TYPE ABOVE, YOU NEED TO INCREMENT THIS VERSION.
 * THIS IS HOW WE TRACK WHEN WE NEED TO UPDATE THE SESSIONS IN THE KV STORE.
 */
export const CURRENT_SESSION_VERSION = 6

/**
 * Get KV namespace from Cloudflare environment
 * Uses cloudflare:workers import for proper binding access
 */
export function getKV(): KVNamespace | null {
  // Access KV via cloudflare:workers env
  // The binding name is KV_SESSION in wrangler.jsonc
  return env.KV_SESSION ?? null
}

export interface CreateKVSessionParams
  extends Omit<KVSession, "id" | "createdAt" | "expiresAt"> {
  sessionId: string
  expiresAt: Date
  authenticatedAt?: number
}

export async function createKVSession({
  sessionId,
  userId,
  expiresAt,
  user,
  authenticationType,
  passkeyCredentialId,
  teams,
  authenticatedAt = Date.now(),
}: CreateKVSessionParams): Promise<KVSession> {
  const kv = await getKV()

  if (!kv) {
    throw new Error("Can't connect to KV store")
  }

  // Get request headers for geo and user agent info
  let headers: Headers | null = null
  try {
    headers = getRequestHeaders()
  } catch {
    // Headers may not be available in all contexts
  }

  // Load user's active entitlements
  const entitlements = await getUserEntitlements(userId)

  // Get Cloudflare geo info from headers (set by CF)
  const cfCountry = headers?.get("cf-ipcountry") ?? undefined
  const cfCity = headers?.get("cf-ipcity") ?? undefined
  const cfContinent = headers?.get("cf-ipcontinent") ?? undefined

  const session: KVSession = {
    id: sessionId,
    userId,
    expiresAt: expiresAt.getTime(),
    createdAt: authenticatedAt,
    country: cfCountry,
    city: cfCity,
    continent: cfContinent,
    ip: await getIP(),
    userAgent: headers?.get("user-agent") ?? null,
    user,
    authenticationType,
    passkeyCredentialId,
    teams,
    entitlements: entitlements.map((e) => ({
      id: e.id,
      type: e.entitlementTypeId,
      metadata: e.metadata ?? {},
      expiresAt: e.expiresAt,
    })),
    version: CURRENT_SESSION_VERSION,
  }

  // Check if user has reached the session limit
  const existingSessions = await getAllSessionIdsOfUser(userId)

  // If user has MAX_SESSIONS_PER_USER or more sessions, delete the oldest one
  if (existingSessions.length >= MAX_SESSIONS_PER_USER) {
    // Sort sessions by expiration time (oldest first)
    const sortedSessions = [...existingSessions].sort((a, b) => {
      // If a session has no expiration, treat it as oldest
      if (!a.absoluteExpiration) return -1
      if (!b.absoluteExpiration) return 1
      return a.absoluteExpiration.getTime() - b.absoluteExpiration.getTime()
    })

    // Delete the oldest session
    const oldestSessionKey = sortedSessions?.[0]?.key
    const oldestSessionId = oldestSessionKey?.split(":")?.[2] // Extract sessionId from key

    if (oldestSessionId) {
      await deleteKVSession(oldestSessionId, userId)
    }
  }

  await kv.put(getSessionKey(userId, sessionId), JSON.stringify(session), {
    expirationTtl: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
  })

  return session
}

export async function getKVSession(
  sessionId: string,
  userId: string,
): Promise<KVSession | null> {
  const kv = await getKV()

  if (!kv) {
    throw new Error("Can't connect to KV store")
  }

  const sessionStr = await kv.get(getSessionKey(userId, sessionId))
  if (!sessionStr) return null

  const session = JSON.parse(sessionStr) as KVSession

  // A refresh can rewrite an old record after deletion. Keep its immutable
  // authentication timestamp behind a persistent cutoff so it stays revoked.
  const revokedBefore = await kv.get(getSessionRevocationKey(userId))
  if (
    revokedBefore !== null &&
    (!Number.isFinite(session.createdAt) ||
      !Number.isFinite(Number(revokedBefore)) ||
      session.createdAt <= Number(revokedBefore))
  ) {
    return null
  }

  if (session?.user?.createdAt) {
    session.user.createdAt = new Date(session.user.createdAt)
  }

  if (session?.user?.updatedAt) {
    session.user.updatedAt = new Date(session.user.updatedAt)
  }

  if (session?.user?.lastCreditRefreshAt) {
    session.user.lastCreditRefreshAt = new Date(
      session.user.lastCreditRefreshAt,
    )
  }

  if (session?.user?.emailVerified) {
    session.user.emailVerified = new Date(session.user.emailVerified)
  }

  return session
}

export async function updateKVSession(
  sessionId: string,
  userId: string,
  expiresAt: Date,
): Promise<KVSession | null> {
  const session = await getKVSession(sessionId, userId)
  if (!session) return null

  const updatedUser = await getUserFromDB(userId)

  if (!updatedUser) {
    throw new Error("User not found")
  }

  // Get updated teams data with permissions
  const teamsWithPermissions = await getUserTeamsWithPermissions(userId)

  // Load user's active entitlements
  const entitlements = await getUserEntitlements(userId)

  const updatedSession: KVSession = {
    ...session,
    version: CURRENT_SESSION_VERSION,
    expiresAt: expiresAt.getTime(),
    user: updatedUser,
    teams: teamsWithPermissions,
    entitlements: entitlements.map((e) => ({
      id: e.id,
      type: e.entitlementTypeId,
      metadata: e.metadata ?? {},
      expiresAt: e.expiresAt,
    })),
  }

  const kv = await getKV()

  if (!kv) {
    throw new Error("Can't connect to KV store")
  }

  await kv.put(
    getSessionKey(userId, sessionId),
    JSON.stringify(updatedSession),
    {
      expirationTtl: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    },
  )

  return updatedSession
}

export async function deleteKVSession(
  sessionId: string,
  userId: string,
): Promise<void> {
  const kv = await getKV()

  if (!kv) {
    throw new Error("Can't connect to KV store")
  }

  await kv.delete(getSessionKey(userId, sessionId))
}

export async function getAllSessionIdsOfUser(userId: string) {
  const kv = await getKV()

  if (!kv) {
    throw new Error("Can't connect to KV store")
  }

  const sessions: Array<{ key: string; absoluteExpiration: Date | undefined }> =
    []
  let cursor: string | undefined
  do {
    const page = await kv.list({ prefix: getSessionKey(userId, ""), cursor })
    sessions.push(
      ...page.keys.map((session) => ({
        key: session.name,
        absoluteExpiration: session.expiration
          ? new Date(session.expiration * 1000)
          : undefined,
      })),
    )
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  return sessions
}

/** Revoke authentication; entitlement refresh deliberately remains separate. */
export async function revokeUserAuthentication(userId: string): Promise<void> {
  const kv = getKV()
  if (!kv) throw new Error("Can't connect to KV store")

  // Serialize only marker writes. The password update is already committed,
  // so concurrent login cannot read the old password after this cutoff.
  const revokedBefore = await getDb().transaction(async (tx) => {
    const [user] = await tx
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .for("update")
    if (!user) throw new Error("User not found")

    const cutoff = Date.now()
    // No TTL: a late session refresh must never outlive the revocation marker.
    await kv.put(getSessionRevocationKey(userId), String(cutoff))
    return cutoff
  })

  // Collect every page before deleting so pagination does not move under us.
  const sessions = await getAllSessionIdsOfUser(userId)
  for (const { key } of sessions) {
    const stored = await kv.get(key)
    if (!stored) continue
    const session = JSON.parse(stored) as KVSession
    if (
      !Number.isFinite(session.createdAt) ||
      session.createdAt <= revokedBefore
    ) {
      await kv.delete(key)
    }
  }
}

/**
 * Update all sessions of a user. It can only be called in a server actions and api routes.
 * @param userId
 */
export async function updateAllSessionsOfUser(userId: string) {
  const sessions = await getAllSessionIdsOfUser(userId)
  const kv = await getKV()

  if (!kv) {
    throw new Error("Can't connect to KV store")
  }

  const newUserData = await getUserFromDB(userId)

  if (!newUserData) return

  // Get updated teams data with permissions
  const teamsWithPermissions = await getUserTeamsWithPermissions(userId)

  // Load user's active entitlements
  const entitlements = await getUserEntitlements(userId)

  for (const sessionObj of sessions) {
    const session = await kv.get(sessionObj.key)
    if (!session) continue

    const sessionData = JSON.parse(session) as KVSession

    // Only update non-expired sessions
    if (
      sessionObj.absoluteExpiration &&
      sessionObj.absoluteExpiration.getTime() > Date.now()
    ) {
      const ttlInSeconds = Math.floor(
        (sessionObj.absoluteExpiration.getTime() - Date.now()) / 1000,
      )

      await kv.put(
        sessionObj.key,
        JSON.stringify({
          ...sessionData,
          version: CURRENT_SESSION_VERSION,
          user: newUserData,
          teams: teamsWithPermissions,
          entitlements: entitlements.map((e) => ({
            id: e.id,
            type: e.entitlementTypeId,
            metadata: e.metadata ?? {},
            expiresAt: e.expiresAt,
          })),
        }),
        { expirationTtl: ttlInSeconds },
      )
    }
  }
}

/**
 * Invalidate a user's sessions by refreshing entitlements and team data
 * Used when entitlements change (purchases, grants, revocations)
 * @param userId - User whose sessions should be invalidated
 */
export async function invalidateUserSessions(userId: string): Promise<void> {
  await updateAllSessionsOfUser(userId)
}

/**
 * Invalidate sessions for all members of a team
 * Used when team plan changes
 * @param teamId - Team whose members' sessions should be invalidated
 */
export async function invalidateTeamMembersSessions(
  teamId: string,
): Promise<void> {
  const db = getDb()

  // Get all team members
  const members = await db.query.teamMembershipTable.findMany({
    where: eq(teamMembershipTable.teamId, teamId),
  })

  // Update all their sessions in parallel
  await Promise.all(
    members.map((member) => updateAllSessionsOfUser(member.userId)),
  )
}
