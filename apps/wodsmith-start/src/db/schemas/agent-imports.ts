import type { InferSelectModel } from "drizzle-orm"
import {
	datetime,
	index,
	int,
	json,
	mysqlTable,
	text,
	varchar,
} from "drizzle-orm/mysql-core"
import { commonColumns, createAgentImportRunId } from "./common"

/**
 * Which organizer page a file was dropped onto. Drives the agent's intent
 * (what kind of proposals to draft) and disambiguation prompts.
 */
export const AGENT_IMPORT_ROUTE_KIND = {
	VOLUNTEERS: "volunteers",
	JUDGES: "judges",
	EVENTS: "events",
	EVENT_DETAIL: "event_detail",
} as const
export type AgentImportRouteKind =
	(typeof AGENT_IMPORT_ROUTE_KIND)[keyof typeof AGENT_IMPORT_ROUTE_KIND]

/**
 * Lifecycle of a single dropped-file import run. A row is created the moment a
 * file is dropped (status=created), before any model call, so an abandoned drop
 * is still tracked for audit + retention.
 */
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
 * One entity created/updated by a confirmed import, recorded so the Undo path
 * can reverse exactly what was written. `before` holds a pre-update snapshot so
 * updates (not just creates) can be undone.
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
		competitionId: varchar({ length: 255 }).notNull(),
		organizingTeamId: varchar({ length: 255 }).notNull(),
		createdByUserId: varchar({ length: 255 }).notNull(),
		routeKind: varchar({ length: 32 })
			.$type<AgentImportRouteKind>()
			.notNull(),
		// trackWorkoutId when routeKind=event_detail
		eventId: varchar({ length: 255 }),
		status: varchar({ length: 32 })
			.$type<AgentImportStatus>()
			.default("created")
			.notNull(),
		// File metadata — private key only, never a public URL (PII stays server-side).
		r2Key: varchar({ length: 1024 }),
		originalFilename: varchar({ length: 512 }),
		mimeType: varchar({ length: 128 }),
		// stored as int; file size in bytes
		fileSize: int(),
		// sha-256 hex, for idempotency / duplicate-import detection
		checksum: varchar({ length: 128 }),
		appliedEntities: json().$type<AppliedEntity[]>(),
		appliedByUserId: varchar({ length: 255 }),
		appliedAt: datetime(),
		errorMessage: text(),
	},
	(table) => [
		index("aimp_competition_idx").on(table.competitionId),
		index("aimp_checksum_idx").on(table.competitionId, table.checksum),
	],
)

export type AgentImportRun = InferSelectModel<typeof agentImportRunsTable>
