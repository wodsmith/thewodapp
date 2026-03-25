import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
	datetime,
	index,
	int,
	mysqlTable,
	text,
	uniqueIndex,
	varchar,
} from "drizzle-orm/mysql-core"
import {
	commonColumns,
	createBroadcastId,
	createBroadcastRecipientId,
} from "./common"
import { competitionsTable, competitionRegistrationsTable } from "./competitions"
import { teamTable } from "./teams"
import { userTable } from "./users"

// ============================================================================
// Broadcast Status
// ============================================================================

export const BROADCAST_STATUS = {
	DRAFT: "draft",
	SENT: "sent",
	SCHEDULED: "scheduled",
	FAILED: "failed",
} as const

export type BroadcastStatus =
	(typeof BROADCAST_STATUS)[keyof typeof BROADCAST_STATUS]

// ============================================================================
// Broadcast Email Delivery Status
// ============================================================================

export const BROADCAST_EMAIL_DELIVERY_STATUS = {
	QUEUED: "queued",
	SENT: "sent",
	FAILED: "failed",
	SKIPPED: "skipped",
} as const

export type BroadcastEmailDeliveryStatus =
	(typeof BROADCAST_EMAIL_DELIVERY_STATUS)[keyof typeof BROADCAST_EMAIL_DELIVERY_STATUS]

// ============================================================================
// Competition Broadcasts Table
// ============================================================================

/**
 * One-way broadcast messages from organizers to athletes.
 * Each broadcast targets a filtered subset of competition registrants.
 * Email delivery is handled asynchronously via Cloudflare Queue.
 */
export const competitionBroadcastsTable = mysqlTable(
	"competition_broadcasts",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createBroadcastId())
			.notNull(),
		// The competition this broadcast belongs to
		competitionId: varchar({ length: 255 }).notNull(),
		// The organizer team that owns this competition
		teamId: varchar({ length: 255 }).notNull(),
		// Broadcast content
		title: varchar({ length: 255 }).notNull(),
		body: text().notNull(),
		// JSON: audience filter criteria (divisions, registration questions, status)
		audienceFilter: text(),
		// Number of recipients at send time
		recipientCount: int().default(0).notNull(),
		// Broadcast lifecycle status
		status: varchar({ length: 20 })
			.$type<BroadcastStatus>()
			.default("draft")
			.notNull(),
		// When the broadcast is scheduled to send (null if not scheduled)
		scheduledAt: datetime(),
		// When the broadcast was actually sent
		sentAt: datetime(),
		// The organizer user who created this broadcast
		createdById: varchar({ length: 255 }).notNull(),
	},
	(table) => [
		index("competition_broadcasts_competition_idx").on(table.competitionId),
		index("competition_broadcasts_team_idx").on(table.teamId),
		index("competition_broadcasts_status_idx").on(table.status),
	],
)

export type CompetitionBroadcast = InferSelectModel<
	typeof competitionBroadcastsTable
>

// ============================================================================
// Competition Broadcast Recipients Table
// ============================================================================

/**
 * Tracks each recipient of a broadcast for delivery status.
 * Rows are inserted at send time and updated by the Cloudflare Queue consumer
 * as emails are delivered via Resend.
 */
export const competitionBroadcastRecipientsTable = mysqlTable(
	"competition_broadcast_recipients",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createBroadcastRecipientId())
			.notNull(),
		// The broadcast this recipient belongs to
		broadcastId: varchar({ length: 255 }).notNull(),
		// The athlete's registration (null for volunteer recipients)
		registrationId: varchar({ length: 255 }),
		// The recipient user
		userId: varchar({ length: 255 }).notNull(),
		// Email delivery status (updated by queue consumer)
		emailDeliveryStatus: varchar({ length: 20 })
			.$type<BroadcastEmailDeliveryStatus>()
			.default("queued")
			.notNull(),
	},
	(table) => [
		uniqueIndex("broadcast_recipients_broadcast_user_idx").on(
			table.broadcastId,
			table.userId,
		),
		index("broadcast_recipients_broadcast_idx").on(table.broadcastId),
		index("broadcast_recipients_user_idx").on(table.userId),
		index("broadcast_recipients_status_idx").on(table.emailDeliveryStatus),
	],
)

export type CompetitionBroadcastRecipient = InferSelectModel<
	typeof competitionBroadcastRecipientsTable
>

// ============================================================================
// Relations
// ============================================================================

export const competitionBroadcastsRelations = relations(
	competitionBroadcastsTable,
	({ one, many }) => ({
		competition: one(competitionsTable, {
			fields: [competitionBroadcastsTable.competitionId],
			references: [competitionsTable.id],
		}),
		team: one(teamTable, {
			fields: [competitionBroadcastsTable.teamId],
			references: [teamTable.id],
		}),
		createdBy: one(userTable, {
			fields: [competitionBroadcastsTable.createdById],
			references: [userTable.id],
		}),
		recipients: many(competitionBroadcastRecipientsTable),
	}),
)

export const competitionBroadcastRecipientsRelations = relations(
	competitionBroadcastRecipientsTable,
	({ one }) => ({
		broadcast: one(competitionBroadcastsTable, {
			fields: [competitionBroadcastRecipientsTable.broadcastId],
			references: [competitionBroadcastsTable.id],
		}),
		registration: one(competitionRegistrationsTable, {
			fields: [competitionBroadcastRecipientsTable.registrationId],
			references: [competitionRegistrationsTable.id],
		}),
		user: one(userTable, {
			fields: [competitionBroadcastRecipientsTable.userId],
			references: [userTable.id],
		}),
	}),
)
