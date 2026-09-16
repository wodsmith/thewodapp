import {
  datetime,
  index,
  int,
  json,
  mysqlTable,
  varchar,
} from "drizzle-orm/mysql-core"
import { commonColumns } from "./common"

export const agentOAuthGrantsTable = mysqlTable(
  "agent_oauth_grants",
  {
    ...commonColumns,
    id: varchar({ length: 255 }).primaryKey(),
    userId: varchar({ length: 255 }).notNull(),
    clientId: varchar({ length: 2048 }).notNull(),
    clientName: varchar({ length: 255 }).notNull(),
    resource: varchar({ length: 2048 }).notNull(),
    scopes: json().$type<string[]>().notNull(),
    allowedTeamIds: json().$type<string[]>().notNull(),
    authGeneration: int().notNull(),
    credentialDigest: varchar({ length: 64 }).notNull(),
    expiresAt: datetime({ mode: "date", fsp: 3 }).notNull(),
    revokedAt: datetime({ mode: "date", fsp: 3 }),
    lastUsedAt: datetime({ mode: "date", fsp: 3 }),
  },
  (t) => [index("agent_oauth_grants_user_idx").on(t.userId)],
)

export const agentOAuthRequestsTable = mysqlTable("agent_oauth_requests", {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar({ length: 255 }).notNull(),
  sessionDigest: varchar({ length: 64 }).notNull(),
  authGeneration: int().notNull(),
  credentialDigest: varchar({ length: 64 }).notNull(),
  authorizationUrl: varchar({ length: 8192 }).notNull(),
  expiresAt: datetime({ mode: "date", fsp: 3 }).notNull(),
  consumedAt: datetime({ mode: "date", fsp: 3 }),
})
