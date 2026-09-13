import { datetime, index, int, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core"

// Device tokens are credentials: never return them in organizer or athlete reads.
export const gameDayDevicesTable = mysqlTable("gameday_devices", {
  id: varchar({ length: 64 }).primaryKey(), // SHA-256(environment + APNs token)
  token: varchar({ length: 512 }).notNull(),
  environment: varchar({ length: 16 }).notNull(),
  userId: varchar({ length: 255 }).notNull(),
  sessionId: varchar({ length: 255 }).notNull(),
  subscriptionId: varchar({ length: 36 }).notNull(),
  registeredAt: datetime({ mode: "date", fsp: 3 }).notNull(),
  expiresAt: datetime({ mode: "date", fsp: 3 }).notNull(),
}, (t) => [index("gameday_devices_user_idx").on(t.userId)])

export const gameDayPushDeliveriesTable = mysqlTable("gameday_push_deliveries", {
  id: varchar({ length: 36 }).primaryKey(),
  broadcastId: varchar({ length: 255 }).notNull(),
  deviceId: varchar({ length: 64 }).notNull(),
  userId: varchar({ length: 255 }).notNull(),
  subscriptionId: varchar({ length: 36 }).notNull(),
  status: varchar({ length: 16 }).notNull().default("pending"),
  attempts: int().notNull().default(0),
  availableAt: datetime({ mode: "date", fsp: 3 }).notNull(),
  expiresAt: datetime({ mode: "date", fsp: 3 }).notNull(),
  leaseId: varchar({ length: 36 }),
  lastReason: varchar({ length: 64 }),
}, (t) => [
  uniqueIndex("gameday_push_broadcast_device_idx").on(t.broadcastId, t.deviceId),
  index("gameday_push_pending_idx").on(t.status, t.availableAt),
])
