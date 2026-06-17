import type { InferSelectModel } from "drizzle-orm"
import {
  datetime,
  index,
  int,
  mysqlTable,
  text,
  varchar,
} from "drizzle-orm/mysql-core"
import { commonColumns, createAgentImportRunId } from "./common"

/**
 * Organizer file-drop import agent.
 *
 * Each row is one dropped file on an organizer page. The row is created BEFORE
 * any model call (so an abandoned drop is still tracked) and is the durable
 * anchor for audit, retention, idempotency (checksum), and the post-apply Undo
 * receipt. The agent itself keeps its working proposals in Durable Object state;
 * this table only records the file metadata and the committed outcome.
 *
 * @see apps/wodsmith-start/src/agents/organizer-file-import-agent.ts
 */

/** Which organizer page the file was dropped on — drives the agent's intent. */
export const AGENT_IMPORT_ROUTE_KIND = {
  VOLUNTEERS: "volunteers",
  JUDGES: "judges",
  EVENTS: "events",
  EVENT_DETAIL: "event_detail",
} as const

export type AgentImportRouteKind =
  (typeof AGENT_IMPORT_ROUTE_KIND)[keyof typeof AGENT_IMPORT_ROUTE_KIND]

export const AGENT_IMPORT_ROUTE_KIND_VALUES = Object.values(
  AGENT_IMPORT_ROUTE_KIND,
) as [AgentImportRouteKind, ...AgentImportRouteKind[]]

/** Lifecycle of an import run. */
export const AGENT_IMPORT_STATUS = {
  CREATED: "created",
  UPLOADED: "uploaded",
  PARSING: "parsing",
  THINKING: "thinking",
  PROPOSALS_READY: "proposals_ready",
  APPLYING: "applying",
  APPLIED: "applied",
  REJECTED: "rejected",
  ERROR: "error",
} as const

export type AgentImportStatus =
  (typeof AGENT_IMPORT_STATUS)[keyof typeof AGENT_IMPORT_STATUS]

/**
 * One entity created or updated by a confirmed import, recorded so the Undo
 * path can reverse exactly what was written. Stored as JSON in
 * {@link agentImportRunsTable.appliedEntities}.
 */
export interface AppliedEntity {
  kind:
    | "volunteer_invite"
    | "volunteer_metadata"
    | "judge_role"
    | "event_create"
    | "event_update"
  /** id of the created/updated row (membershipId, invitationId, trackWorkoutId, …) */
  entityId: string
  /** stable key from the source row — used for idempotent re-apply */
  rowKey: string
  /** before-snapshot for updates so Undo can restore prior values */
  before?: Record<string, unknown>
}

export const agentImportRunsTable = mysqlTable(
  "agent_import_runs",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createAgentImportRunId())
      .notNull(),
    // Competition this import targets
    competitionId: varchar({ length: 255 }).notNull(),
    // Organizing (gym) team that owns the competition — denormalized for auth
    organizingTeamId: varchar({ length: 255 }).notNull(),
    // Organizer who dropped the file
    createdByUserId: varchar({ length: 255 }).notNull(),
    // Which organizer page the file was dropped on
    routeKind: varchar({ length: 32 }).$type<AgentImportRouteKind>().notNull(),
    // trackWorkoutId when routeKind = event_detail
    eventId: varchar({ length: 255 }),
    // Lifecycle status
    status: varchar({ length: 32 }).$type<AgentImportStatus>().notNull(),
    // Private R2 object key (no public URL is ever emitted — PII stays server-side)
    r2Key: varchar({ length: 1024 }),
    originalFilename: varchar({ length: 512 }),
    mimeType: varchar({ length: 128 }),
    fileSize: int(),
    // SHA-256 hex of the uploaded bytes — idempotency / duplicate-import detection
    checksum: varchar({ length: 128 }),
    // JSON: AppliedEntity[] — what the confirmed apply wrote, for the Undo receipt
    appliedEntities: text(),
    appliedByUserId: varchar({ length: 255 }),
    appliedAt: datetime(),
    errorMessage: varchar({ length: 1024 }),
  },
  (table) => [
    index("agent_import_runs_competition_idx").on(table.competitionId),
    index("agent_import_runs_created_by_idx").on(table.createdByUserId),
    // Duplicate-import detection scopes the checksum to the competition
    index("agent_import_runs_checksum_idx").on(
      table.competitionId,
      table.checksum,
    ),
  ],
)

export type AgentImportRun = InferSelectModel<typeof agentImportRunsTable>

/** Safely parse the JSON {@link AppliedEntity} list off a run row. */
export function parseAppliedEntities(raw: string | null): AppliedEntity[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as AppliedEntity[]) : []
  } catch {
    return []
  }
}
