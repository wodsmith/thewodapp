import { env } from "cloudflare:workers"
import { snapshotGameDayPush } from "@repo/wodsmith-db/gameday-push"
import {
  gameDayPushDeliveriesTable as deliveries,
  gameDayDevicesTable as devices,
} from "@repo/wodsmith-db/schema"
import { and, eq, gt, lte, sql } from "drizzle-orm"
import { z } from "zod"
import { type Database, getDb } from "@/db"
import {
  competitionBroadcastsTable as broadcasts,
  competitionBroadcastRecipientsTable as recipients,
} from "@/db/schemas/broadcasts"
import { getSessionFromBearer } from "@/utils/bearer-auth"
import { getKVSession } from "@/utils/kv-session"
import { getGameDayRegistrations } from "./gameday"
import { createAPNsJWT, sendAPNsAnnouncement } from "./gameday-apns"

const pushEnv = () =>
  env as typeof env & {
    GAMEDAY_PUSH_ENABLED?: string
    APNS_KEY_ID?: string
    APNS_TEAM_ID?: string
    APNS_PRIVATE_KEY?: string
  }
export const isGameDayPushEnabled = () =>
  pushEnv().GAMEDAY_PUSH_ENABLED === "true"
const deviceInput = z
  .object({
    token: z
      .string()
      .regex(/^[a-fA-F0-9]{64,512}$/)
      .transform((s) => s.toLowerCase()),
    environment: z.enum(["sandbox", "production"]),
    subscriptionId: z.uuid(),
  })
  .strict()

// @lat: [[gameday-push#Device ownership]]
export async function handleGameDayDeviceRequest(
  request: Request,
): Promise<Response> {
  const reply = (body: unknown, status = 200) =>
    Response.json(body, {
      status,
      headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
    })
  const session = await getSessionFromBearer(request)
  if (!session) return reply({ error: "Please sign in" }, 401)
  if (!["PUT", "DELETE"].includes(request.method))
    return reply({ error: "Method not allowed" }, 405)
  const parsed = deviceInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success)
    return reply({ error: "Invalid device registration" }, 400)
  const input = parsed.data
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${input.environment}:${input.token}`),
  )
  const id = Array.from(new Uint8Array(hash), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("")
  const db = getDb()
  if (request.method === "DELETE") {
    // An old account's delayed sign-out must never delete the new account's subscription.
    await db
      .delete(devices)
      .where(
        and(
          eq(devices.id, id),
          eq(devices.userId, session.userId),
          eq(devices.sessionId, session.id),
          eq(devices.subscriptionId, input.subscriptionId),
        ),
      )
    return reply({ registered: false })
  }
  if (!isGameDayPushEnabled())
    return reply(
      {
        error:
          "Announcement notifications are not available yet. Try again later.",
      },
      503,
    )
  const now = new Date()
  const values = {
    id,
    ...input,
    userId: session.userId,
    sessionId: session.id,
    registeredAt: now,
    expiresAt: new Date(
      Math.min(session.expiresAt, now.getTime() + 7 * 86400000),
    ),
  }
  await db.insert(devices).values(values).onDuplicateKeyUpdate({ set: values })
  return reply({ registered: true })
}

// Called inside the broadcast + recipient transaction: either everything commits or nothing does.
export async function recordGameDayPushDeliveries(
  db: Pick<Database, "select" | "insert">,
  broadcastId: string,
) {
  if (!isGameDayPushEnabled()) return
  await snapshotGameDayPush(db, broadcastId)
}

export async function dispatchGameDayPush() {
  if (!isGameDayPushEnabled()) return
  const queue = (env as typeof env & { BROADCAST_EMAIL_QUEUE?: Queue })
    .BROADCAST_EMAIL_QUEUE
  if (!queue) throw new Error("Game Day push queue is not configured")
  const db = getDb()
  await db.delete(devices).where(lte(devices.expiresAt, new Date()))
  await db
    .delete(deliveries)
    .where(lte(deliveries.expiresAt, new Date(Date.now() - 30 * 86400000)))
  const pending = await db
    .select({ id: deliveries.id })
    .from(deliveries)
    .where(
      and(
        eq(deliveries.status, "pending"),
        lte(deliveries.availableAt, new Date()),
      ),
    )
    .orderBy(deliveries.availableAt)
    .limit(500)
  for (let i = 0; i < pending.length; i += 100) {
    await queue.sendBatch(
      pending
        .slice(i, i + 100)
        .map(({ id }) => ({ body: { kind: "gameday-push", deliveryId: id } })),
    )
  }
}

// @lat: [[gameday-push#Recipient access]]
export async function deliverGameDayPush(id: string): Promise<void> {
  if (!isGameDayPushEnabled()) return
  const db = getDb()
  const now = new Date()
  const leaseId = crypto.randomUUID()
  // Compare-and-set lease serializes duplicate queue messages; crashes recover after two minutes.
  await db
    .update(deliveries)
    .set({
      leaseId,
      availableAt: new Date(now.getTime() + 120000),
    })
    .where(
      and(
        eq(deliveries.id, id),
        eq(deliveries.status, "pending"),
        lte(deliveries.availableAt, now),
      ),
    )
  const [job] = await db
    .select()
    .from(deliveries)
    .where(and(eq(deliveries.id, id), eq(deliveries.leaseId, leaseId)))
  if (!job) return
  const finish = async (status: string, reason: string) => {
    await db
      .update(deliveries)
      .set({
        status,
        lastReason: reason.slice(0, 64),
        leaseId: null,
        availableAt: new Date(
          Date.now() +
            Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7)) * 1000,
        ),
      })
      .where(and(eq(deliveries.id, id), eq(deliveries.leaseId, leaseId)))
  }
  try {
    if (job.expiresAt <= now || job.attempts >= 10) {
      await finish("expired", "RetryLimit")
      return
    }
    const [device] = await db
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.id, job.deviceId),
          eq(devices.userId, job.userId),
          eq(devices.subscriptionId, job.subscriptionId),
          gt(devices.expiresAt, now),
        ),
      )
    if (!device) {
      await finish("skipped", "SubscriptionEnded")
      return
    }
    const session = await getKVSession(device.sessionId, device.userId)
    if (!session || session.expiresAt <= Date.now()) {
      await finish("skipped", "SessionEnded")
      return
    }
    const [broadcast] = await db
      .select({ id: broadcasts.id, competitionId: broadcasts.competitionId })
      .from(broadcasts)
      .innerJoin(
        recipients,
        and(
          eq(recipients.broadcastId, broadcasts.id),
          eq(recipients.userId, device.userId),
        ),
      )
      .where(
        and(eq(broadcasts.id, job.broadcastId), eq(broadcasts.status, "sent")),
      )
    if (
      !broadcast ||
      !(await getGameDayRegistrations(device.userId)).some(
        (r) => r.competitionId === broadcast.competitionId,
      )
    ) {
      await finish("skipped", "NotRegisteredRecipient")
      return
    }
    const config = pushEnv()
    if (
      !config.APNS_KEY_ID ||
      !config.APNS_TEAM_ID ||
      !config.APNS_PRIVATE_KEY
    ) {
      await finish("pending", "APNsNotConfigured")
      return
    }
    const jwt = await createAPNsJWT({
      keyId: config.APNS_KEY_ID,
      teamId: config.APNS_TEAM_ID,
      privateKey: config.APNS_PRIVATE_KEY,
    })
    // Configuration/signing failures do not consume the provider retry budget.
    await db
      .update(deliveries)
      .set({ attempts: sql`${deliveries.attempts} + 1` })
      .where(
        and(
          eq(deliveries.id, id),
          eq(deliveries.leaseId, leaseId),
          gt(deliveries.availableAt, new Date(Date.now() + 15000)),
        ),
      )
    job.attempts += 1
    // Recheck ownership after asynchronous session/registration lookups and signing.
    const [current] = await db
      .select({ id: devices.id })
      .from(devices)
      .innerJoin(
        deliveries,
        and(
          eq(deliveries.id, id),
          eq(deliveries.leaseId, leaseId),
          gt(deliveries.availableAt, new Date(Date.now() + 15000)),
        ),
      )
      .where(
        and(
          eq(devices.id, device.id),
          eq(devices.subscriptionId, device.subscriptionId),
          eq(devices.sessionId, device.sessionId),
          gt(devices.expiresAt, new Date()),
        ),
      )
    if (!current) {
      await finish("skipped", "SubscriptionEnded")
      return
    }
    const result = await sendAPNsAnnouncement({
      jwt,
      token: device.token,
      environment: device.environment,
      deliveryId: id,
      broadcastId: broadcast.id,
      competitionId: broadcast.competitionId,
      expiresAt: job.expiresAt,
    })
    if (result.kind === "invalid") {
      // Do not invalidate a token refreshed since Apple's invalidation timestamp / this attempt.
      await db
        .delete(devices)
        .where(
          and(
            eq(devices.id, device.id),
            eq(devices.subscriptionId, device.subscriptionId),
            lte(
              devices.registeredAt,
              result.invalidAt
                ? new Date(result.invalidAt)
                : device.registeredAt,
            ),
          ),
        )
    }
    await finish(
      result.kind === "retry"
        ? "pending"
        : result.kind === "invalid"
          ? "skipped"
          : result.kind,
      result.reason,
    )
  } catch {
    // Never log token/session material or provider payloads. A DB failure leaves the lease recoverable.
    await finish("pending", "DeliveryError")
  }
}
