/**
 * Broadcast Server Functions
 *
 * Server functions for organizer broadcast messaging.
 * Handles creating, sending, and listing broadcasts.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, count, desc, eq, inArray, ne } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	BROADCAST_EMAIL_DELIVERY_STATUS,
	BROADCAST_STATUS,
	competitionBroadcastRecipientsTable,
	competitionBroadcastsTable,
} from "@/db/schemas/broadcasts"
import {
	competitionRegistrationsTable,
	competitionsTable,
	REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import { TEAM_PERMISSIONS, teamTable } from "@/db/schemas/teams"
import { userTable } from "@/db/schemas/users"
import { getSessionFromCookie } from "@/utils/auth"
import { requireTeamPermission } from "./requireTeamMembership"
import { BroadcastNotificationEmail } from "@/react-email/broadcast-notification"
import { sendEmail } from "@/utils/email"

// ============================================================================
// Input Schemas
// ============================================================================

const listBroadcastsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
})

const sendBroadcastInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	title: z.string().min(1, "Title is required").max(255),
	body: z.string().min(1, "Body is required"),
	audienceFilter: z
		.object({
			type: z.enum(["all", "division", "status"]),
			divisionId: z.string().optional(),
			registrationStatus: z.enum(["unpaid", "waiver_unsigned"]).optional(),
		})
		.optional(),
})

const getBroadcastInputSchema = z.object({
	broadcastId: z.string().min(1, "Broadcast ID is required"),
})

const listAthleteBroadcastsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
})

// ============================================================================
// Organizer: List Broadcasts
// ============================================================================

export const listBroadcastsFn = createServerFn({ method: "GET" })
	.validator((data: unknown) => listBroadcastsInputSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) throw new Error("Authentication required")

		const db = getDb()

		// Get competition to verify permissions
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, data.competitionId),
			columns: { id: true, organizingTeamId: true },
		})
		if (!competition) throw new Error("Competition not found")

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const broadcasts = await db.query.competitionBroadcastsTable.findMany({
			where: eq(
				competitionBroadcastsTable.competitionId,
				data.competitionId,
			),
			orderBy: [desc(competitionBroadcastsTable.createdAt)],
		})

		// Get delivery stats for each broadcast
		const broadcastsWithStats = await Promise.all(
			broadcasts.map(async (broadcast) => {
				const [sentCount] = await db
					.select({ count: count() })
					.from(competitionBroadcastRecipientsTable)
					.where(
						and(
							eq(
								competitionBroadcastRecipientsTable.broadcastId,
								broadcast.id,
							),
							eq(
								competitionBroadcastRecipientsTable.emailDeliveryStatus,
								BROADCAST_EMAIL_DELIVERY_STATUS.SENT,
							),
						),
					)
				const [failedCount] = await db
					.select({ count: count() })
					.from(competitionBroadcastRecipientsTable)
					.where(
						and(
							eq(
								competitionBroadcastRecipientsTable.broadcastId,
								broadcast.id,
							),
							eq(
								competitionBroadcastRecipientsTable.emailDeliveryStatus,
								BROADCAST_EMAIL_DELIVERY_STATUS.FAILED,
							),
						),
					)

				return {
					...broadcast,
					deliveryStats: {
						sent: sentCount?.count ?? 0,
						failed: failedCount?.count ?? 0,
					},
				}
			}),
		)

		return { broadcasts: broadcastsWithStats }
	})

// ============================================================================
// Organizer: Send Broadcast
// ============================================================================

export const sendBroadcastFn = createServerFn({ method: "POST" })
	.validator((data: unknown) => sendBroadcastInputSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) throw new Error("Authentication required")

		const db = getDb()

		// Get competition to verify permissions
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, data.competitionId),
			columns: {
				id: true,
				organizingTeamId: true,
				name: true,
				slug: true,
			},
		})
		if (!competition) throw new Error("Competition not found")

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		// Build registration query conditions
		// Note: competitionRegistrationsTable uses eventId to reference competition
		const conditions = [
			eq(competitionRegistrationsTable.eventId, data.competitionId),
			ne(
				competitionRegistrationsTable.status,
				REGISTRATION_STATUS.REMOVED,
			),
		]

		if (data.audienceFilter?.type === "division" && data.audienceFilter.divisionId) {
			conditions.push(
				eq(
					competitionRegistrationsTable.divisionId,
					data.audienceFilter.divisionId,
				),
			)
		}

		// Get matching registrations with user emails
		const registrations = await db
			.select({
				id: competitionRegistrationsTable.id,
				userId: competitionRegistrationsTable.userId,
				email: userTable.email,
				username: userTable.username,
			})
			.from(competitionRegistrationsTable)
			.innerJoin(
				userTable,
				eq(competitionRegistrationsTable.userId, userTable.id),
			)
			.where(and(...conditions))

		if (registrations.length === 0) {
			throw new Error("No athletes match the selected filter")
		}

		// Get organizer team name for email
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, competition.organizingTeamId),
			columns: { name: true },
		})

		// Insert broadcast record
		const [broadcast] = await db
			.insert(competitionBroadcastsTable)
			.values({
				competitionId: data.competitionId,
				teamId: competition.organizingTeamId,
				title: data.title,
				body: data.body,
				audienceFilter: data.audienceFilter
					? JSON.stringify(data.audienceFilter)
					: null,
				recipientCount: registrations.length,
				status: BROADCAST_STATUS.SENT,
				sentAt: new Date(),
				createdById: session.userId,
			})
			.$returningId()

		// Insert recipient rows
		const recipientValues = registrations.map((reg) => ({
			broadcastId: broadcast.id,
			registrationId: reg.id,
			userId: reg.userId,
			emailDeliveryStatus:
				BROADCAST_EMAIL_DELIVERY_STATUS.QUEUED as "queued",
		}))

		await db
			.insert(competitionBroadcastRecipientsTable)
			.values(recipientValues)

		// Send emails (fire-and-forget per recipient for now)
		// TODO: Replace with Cloudflare Queue when queue infrastructure is set up
		const emailPromises = registrations.map(async (reg) => {
			try {
				await sendEmail({
					to: reg.email,
					subject: `${data.title} — ${competition.name}`,
					template: BroadcastNotificationEmail({
						competitionName: competition.name,
						competitionSlug: competition.slug,
						broadcastTitle: data.title,
						broadcastBody: data.body,
						organizerTeamName: team?.name ?? "Organizer",
					}),
					tags: [{ name: "type", value: "competition-broadcast" }],
				})

				// Update delivery status to sent
				await db
					.update(competitionBroadcastRecipientsTable)
					.set({
						emailDeliveryStatus: BROADCAST_EMAIL_DELIVERY_STATUS.SENT,
					})
					.where(
						and(
							eq(
								competitionBroadcastRecipientsTable.broadcastId,
								broadcast.id,
							),
							eq(
								competitionBroadcastRecipientsTable.userId,
								reg.userId,
							),
						),
					)
			} catch {
				// Update delivery status to failed
				await db
					.update(competitionBroadcastRecipientsTable)
					.set({
						emailDeliveryStatus:
							BROADCAST_EMAIL_DELIVERY_STATUS.FAILED,
					})
					.where(
						and(
							eq(
								competitionBroadcastRecipientsTable.broadcastId,
								broadcast.id,
							),
							eq(
								competitionBroadcastRecipientsTable.userId,
								reg.userId,
							),
						),
					)
			}
		})

		// Don't block the response on email delivery
		Promise.allSettled(emailPromises)

		return {
			broadcastId: broadcast.id,
			recipientCount: registrations.length,
		}
	})

// ============================================================================
// Organizer: Get Broadcast Detail
// ============================================================================

export const getBroadcastFn = createServerFn({ method: "GET" })
	.validator((data: unknown) => getBroadcastInputSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) throw new Error("Authentication required")

		const db = getDb()

		const broadcast = await db.query.competitionBroadcastsTable.findFirst({
			where: eq(competitionBroadcastsTable.id, data.broadcastId),
		})
		if (!broadcast) throw new Error("Broadcast not found")

		await requireTeamPermission(
			broadcast.teamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		// Get recipients with delivery status
		const recipients = await db
			.select({
				id: competitionBroadcastRecipientsTable.id,
				userId: competitionBroadcastRecipientsTable.userId,
				emailDeliveryStatus:
					competitionBroadcastRecipientsTable.emailDeliveryStatus,
				username: userTable.username,
				email: userTable.email,
			})
			.from(competitionBroadcastRecipientsTable)
			.innerJoin(
				userTable,
				eq(competitionBroadcastRecipientsTable.userId, userTable.id),
			)
			.where(
				eq(
					competitionBroadcastRecipientsTable.broadcastId,
					data.broadcastId,
				),
			)

		return { broadcast, recipients }
	})

// ============================================================================
// Athlete: List Broadcasts for Competition
// ============================================================================

export const listAthleteBroadcastsFn = createServerFn({ method: "GET" })
	.validator((data: unknown) =>
		listAthleteBroadcastsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) throw new Error("Authentication required")

		const db = getDb()

		// Get broadcasts where this user is a recipient
		const recipientBroadcasts = await db
			.select({
				broadcastId: competitionBroadcastRecipientsTable.broadcastId,
			})
			.from(competitionBroadcastRecipientsTable)
			.where(
				eq(competitionBroadcastRecipientsTable.userId, session.userId),
			)

		if (recipientBroadcasts.length === 0) {
			return { broadcasts: [] }
		}

		const broadcastIds = recipientBroadcasts.map((r) => r.broadcastId)

		const broadcasts = await db.query.competitionBroadcastsTable.findMany({
			where: and(
				eq(
					competitionBroadcastsTable.competitionId,
					data.competitionId,
				),
				inArray(competitionBroadcastsTable.id, broadcastIds),
				eq(competitionBroadcastsTable.status, BROADCAST_STATUS.SENT),
			),
			orderBy: [desc(competitionBroadcastsTable.sentAt)],
		})

		return { broadcasts }
	})

// ============================================================================
// Organizer: Preview Audience Count
// ============================================================================

const previewAudienceInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	audienceFilter: z
		.object({
			type: z.enum(["all", "division", "status"]),
			divisionId: z.string().optional(),
			registrationStatus: z.enum(["unpaid", "waiver_unsigned"]).optional(),
		})
		.optional(),
})

export const previewAudienceFn = createServerFn({ method: "GET" })
	.validator((data: unknown) => previewAudienceInputSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) throw new Error("Authentication required")

		const db = getDb()

		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, data.competitionId),
			columns: { id: true, organizingTeamId: true },
		})
		if (!competition) throw new Error("Competition not found")

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const conditions = [
			eq(competitionRegistrationsTable.eventId, data.competitionId),
			ne(
				competitionRegistrationsTable.status,
				REGISTRATION_STATUS.REMOVED,
			),
		]

		if (data.audienceFilter?.type === "division" && data.audienceFilter.divisionId) {
			conditions.push(
				eq(
					competitionRegistrationsTable.divisionId,
					data.audienceFilter.divisionId,
				),
			)
		}

		const [result] = await db
			.select({ count: count() })
			.from(competitionRegistrationsTable)
			.where(and(...conditions))

		return { count: result?.count ?? 0 }
	})
