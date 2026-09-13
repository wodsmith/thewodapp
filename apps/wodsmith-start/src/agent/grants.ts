import { type AgentActor, grantIdentitySchema } from "@repo/agent-auth"
import { type AgentOAuthConfig, oauthApi } from "@repo/agent-auth/provider"
import { teamMembershipTable, teamTable, userTable } from "@repo/wodsmith-db"
import {
  agentOAuthGrantsTable,
  agentOAuthRequestsTable,
} from "@repo/wodsmith-db/schemas/agent-oauth"
import { and, eq, gt, isNull, or } from "drizzle-orm"
import { getDb } from "../db"

export async function digest(value: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  )
  return [...new Uint8Array(hash)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")
}
export async function eligibleAgentTeams(userId: string) {
  return getDb()
    .select({ id: teamTable.id, name: teamTable.name })
    .from(teamMembershipTable)
    .innerJoin(teamTable, eq(teamTable.id, teamMembershipTable.teamId))
    .where(
      and(
        eq(teamMembershipTable.userId, userId),
        eq(teamMembershipTable.isActive, true),
        or(
          isNull(teamMembershipTable.expiresAt),
          gt(teamMembershipTable.expiresAt, new Date()),
        ),
      ),
    )
}
// Live SQL authority is deliberately separate from the provider's eventually consistent KV.
export async function resolveAgentActor(
  token: string,
  env: AgentOAuthConfig,
): Promise<AgentActor | null> {
  if (!env.AGENT_RESOURCE || !env.AGENT_AUTH_ORIGIN) return null
  const summary = await oauthApi(env).unwrapToken<unknown>(token)
  if (
    !summary ||
    summary.expiresAt <= Date.now() / 1000 ||
    summary.audience !== env.AGENT_RESOURCE
  )
    return null
  const identity = grantIdentitySchema.safeParse(summary.grant.props)
  if (
    !identity.success ||
    identity.data.userId !== summary.userId ||
    identity.data.clientId !== summary.grant.clientId
  )
    return null
  const db = getDb()
  const [row] = await db
    .select()
    .from(agentOAuthGrantsTable)
    .where(eq(agentOAuthGrantsTable.id, identity.data.grantId))
    .limit(1)
  if (
    !row ||
    row.revokedAt ||
    row.expiresAt <= new Date() ||
    row.resource !== env.AGENT_RESOURCE ||
    row.userId !== summary.userId ||
    row.clientId !== summary.grant.clientId
  )
    return null
  const [user] = await db
    .select({
      authGeneration: userTable.authGeneration,
      passwordHash: userTable.passwordHash,
    })
    .from(userTable)
    .where(eq(userTable.id, row.userId))
    .limit(1)
  if (
    !user ||
    user.authGeneration !== row.authGeneration ||
    (await digest(user.passwordHash ?? "")) !== row.credentialDigest
  )
    return null
  const teams = await eligibleAgentTeams(row.userId)
  const scopes = row.scopes.filter((scope) => summary.scope.includes(scope))
  const allowedTeamIds = row.allowedTeamIds.filter((id) =>
    teams.some((team) => team.id === id),
  )
  await db
    .update(agentOAuthGrantsTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(agentOAuthGrantsTable.id, row.id))
  return { ...identity.data, scopes, allowedTeamIds }
}
export async function consumeConsentRequest(
  id: string,
  userId: string,
  sessionDigest: string,
) {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(agentOAuthRequestsTable)
      .where(eq(agentOAuthRequestsTable.id, id))
      .for("update")
    if (
      !row ||
      row.userId !== userId ||
      row.sessionDigest !== sessionDigest ||
      row.consumedAt ||
      row.expiresAt <= new Date()
    )
      return null
    await tx
      .update(agentOAuthRequestsTable)
      .set({ consumedAt: new Date() })
      .where(eq(agentOAuthRequestsTable.id, id))
    return row
  })
}

/** Revalidate inside a domain transaction; shared locks serialize consent revocation with commit. */
export async function assertLiveAgentGrant(
  db:
    | ReturnType<typeof getDb>
    | Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  actor: {
    userId: string
    grantId?: string
    clientId?: string
    scopes?: readonly string[]
    allowedTeamIds?: readonly string[]
  },
  permission: string,
) {
  if (
    !actor.grantId ||
    !actor.clientId ||
    !actor.scopes?.includes(permission) ||
    !actor.allowedTeamIds
  )
    throw new Error(
      "NOT_AUTHORIZED: The connection no longer authorizes this action",
    )
  const [grant] = await db
    .select()
    .from(agentOAuthGrantsTable)
    .where(eq(agentOAuthGrantsTable.id, actor.grantId))
    .for("share")
  if (
    !grant ||
    grant.revokedAt ||
    grant.expiresAt <= new Date() ||
    grant.userId !== actor.userId ||
    grant.clientId !== actor.clientId ||
    !grant.scopes.includes(permission) ||
    actor.allowedTeamIds.some((id) => !grant.allowedTeamIds.includes(id))
  )
    throw new Error(
      "NOT_AUTHORIZED: The connection no longer authorizes this action",
    )
  const [user] = await db
    .select({
      passwordHash: userTable.passwordHash,
      authGeneration: userTable.authGeneration,
    })
    .from(userTable)
    .where(eq(userTable.id, actor.userId))
    .for("share")
  if (
    !user ||
    user.authGeneration !== grant.authGeneration ||
    (await digest(user.passwordHash ?? "")) !== grant.credentialDigest
  )
    throw new Error("NOT_AUTHORIZED: Reconnect to WodSmith")
  const memberships = await db
    .select({ teamId: teamMembershipTable.teamId })
    .from(teamMembershipTable)
    .where(
      and(
        eq(teamMembershipTable.userId, actor.userId),
        eq(teamMembershipTable.isActive, true),
        or(
          isNull(teamMembershipTable.expiresAt),
          gt(teamMembershipTable.expiresAt, new Date()),
        ),
      ),
    )
    .for("share")
  if (
    actor.allowedTeamIds.some(
      (id) => !memberships.some((membership) => membership.teamId === id),
    )
  )
    throw new Error("FORBIDDEN: Workspace access changed")
}
