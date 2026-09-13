import { and, eq, gt } from "drizzle-orm"
import type { WodsmithDb } from "./mysql"
import { gameDayDevicesTable as devices, gameDayPushDeliveriesTable as deliveries } from "./schemas/gameday-push"
import { competitionBroadcastRecipientsTable as recipients } from "./schemas/broadcasts"

// Both organizer applications record the same transactional outbox; WODsmith delivers it.
export async function snapshotGameDayPush(db: Pick<WodsmithDb, "select" | "insert">, broadcastId: string) {
  const now = new Date()
  const targets = await db.select({ deviceId: devices.id, userId: devices.userId, subscriptionId: devices.subscriptionId })
    .from(devices).innerJoin(recipients, and(eq(recipients.userId, devices.userId), eq(recipients.broadcastId, broadcastId)))
    .where(gt(devices.expiresAt, now))
  for (let i = 0; i < targets.length; i += 100) {
    await db.insert(deliveries).values(targets.slice(i, i + 100).map((target) => ({
      ...target, id: crypto.randomUUID(), broadcastId, availableAt: now, expiresAt: new Date(now.getTime() + 86400000),
    })))
  }
}
