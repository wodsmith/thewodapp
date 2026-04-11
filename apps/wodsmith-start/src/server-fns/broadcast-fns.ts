/**
 * Broadcast Server Functions
 *
 * Server functions for organizer broadcast messaging.
 * Handles creating, sending, and listing broadcasts.
 */
// @lat: [[organizer-dashboard#Broadcasts]]

import { createServerFn } from "@tanstack/react-start"
import { render } from "@react-email/render"
import { and, count, countDistinct, desc, eq, inArray, ne } from "drizzle-orm"
import { env } from "cloudflare:workers"
import { z } from "zod"
import { getDb } from "@/db"
import {
	BROADCAST_EMAIL_DELIVERY_STATUS,
	BROADCAST_STATUS,
	competitionBroadcastRecipientsTable,
	competitionBroadcastsTable,
} from "@/db/schemas/broadcasts"
import {
	competitionRegistrationAnswersTable,
	competitionRegistrationQuestionsTable,
	competitionRegistrationsTable,
	competitionsTable,
	REGISTRATION_STATUS,
	volunteerRegistrationAnswersTable,
} from "@/db/schemas/competitions"
import {
	SYSTEM_ROLES_ENUM,
	TEAM_PERMISSIONS,
	teamInvitationTable,
	teamMembershipTable,
	teamTable,
} from "@/db/schemas/teams"
import { userTable } from "@/db/schemas/users"
import {
	logInfo,
	logError,
	logEntityCreated,
	updateRequestContext,
	addRequestContextAttribute,
} from "@/lib/logging"
import { getSessionFromCookie } from "@/utils/auth"
import { requireTeamPermission } from "./requireTeamMembership"
import { BroadcastNotificationEmail } from "@/react-email/broadcast-notification"
import type { BroadcastEmailMessage } from "@/server/broadcast-queue-consumer"

// ============================================================================
// Input Schemas
// ============================================================================

const listBroadcastsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
})

const questionFilterSchema = z.object({
	questionId: z.string(),
	values: z.array(z.string()).min(1),
})

export type QuestionFilter = z.infer<typeof questionFilterSchema>

const audienceFilterSchema = z
	.object({
		type: z.enum([
			"all",
			"division",
			"public",
			"volunteers",
			"volunteer_role",
		]),
		divisionId: z.string().optional(),
		volunteerRole: z.string().optional(),
		questionFilters: z.array(questionFilterSchema).optional(),
	})
	.refine(
		(filter) =>
			filter.type !== "division" ||
			(filter.divisionId && filter.divisionId.length > 0),
		{ message: "Division ID is required when filtering by division" },
	)
	.refine(
		(filter) =>
			filter.type !== "volunteer_role" ||
			(filter.volunteerRole && filter.volunteerRole.length > 0),
		{ message: "Volunteer role is required when filtering by role" },
	)

const sendBroadcastInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	title: z.string().min(1, "Title is required").max(255),
	body: z.string().min(1, "Body is required"),
	audienceFilter: audienceFilterSchema.optional(),
	sendEmail: z.boolean().default(true),
})

const getBroadcastInputSchema = z.object({
	broadcastId: z.string().min(1, "Broadcast ID is required"),
})

const listAthleteBroadcastsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
})

// ============================================================================
// Question Filtering Helpers
// ============================================================================

type Recipient = {
	registrationId: string | null
	userId: string
	email: string | null
	firstName: string | null
}

/**
 * Apply question filters to a list of athlete recipients.
 * Fetches answers for matching registrations and filters in-memory.
 * AND across question filters, OR within each filter's values.
 */
async function applyAthleteQuestionFilters(
	recipients: Recipient[],
	questionFilters: QuestionFilter[],
): Promise<Recipient[]> {
	if (questionFilters.length === 0 || recipients.length === 0) return recipients

	const db = getDb()
	const registrationIds = recipients
		.map((r) => r.registrationId)
		.filter((id): id is string => id !== null)

	if (registrationIds.length === 0) return recipients

	const questionIds = questionFilters.map((f) => f.questionId)

	// Batch-load all relevant answers
	const answers = await db
		.select({
			registrationId: competitionRegistrationAnswersTable.registrationId,
			questionId: competitionRegistrationAnswersTable.questionId,
			answer: competitionRegistrationAnswersTable.answer,
		})
		.from(competitionRegistrationAnswersTable)
		.where(
			and(
				inArray(competitionRegistrationAnswersTable.registrationId, registrationIds),
				inArray(competitionRegistrationAnswersTable.questionId, questionIds),
			),
		)

	// Build lookup: registrationId -> questionId -> Set of answers
	// A registration can have multiple answers per question (e.g. team registrations)
	const answerMap = new Map<string, Map<string, Set<string>>>()
	for (const a of answers) {
		let qMap = answerMap.get(a.registrationId)
		if (!qMap) {
			qMap = new Map()
			answerMap.set(a.registrationId, qMap)
		}
		let values = qMap.get(a.questionId)
		if (!values) {
			values = new Set()
			qMap.set(a.questionId, values)
		}
		values.add(a.answer)
	}

	return recipients.filter((r) => {
		if (!r.registrationId) return false
		const qMap = answerMap.get(r.registrationId)
		if (!qMap) return false
		return questionFilters.every((f) => {
			const answers = qMap.get(f.questionId)
			return answers !== undefined && f.values.some((v) => answers.has(v))
		})
	})
}

/**
 * Apply question filters to a list of volunteer recipients.
 * Maps userId -> invitationId via teamInvitationTable, then checks answers.
 */
async function applyVolunteerQuestionFilters(
	recipients: Recipient[],
	questionFilters: QuestionFilter[],
	competitionTeamId: string,
): Promise<Recipient[]> {
	if (questionFilters.length === 0 || recipients.length === 0) return recipients

	const db = getDb()

	// Get all volunteer invitations for this competition team
	const invitations = await db
		.select({
			id: teamInvitationTable.id,
			email: teamInvitationTable.email,
			acceptedBy: teamInvitationTable.acceptedBy,
		})
		.from(teamInvitationTable)
		.where(
			and(
				eq(teamInvitationTable.teamId, competitionTeamId),
				eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
				eq(teamInvitationTable.isSystemRole, true),
			),
		)

	// Build userId -> invitationId map
	// For accepted volunteers, acceptedBy has the userId
	const userIdToInvitationId = new Map<string, string>()
	for (const inv of invitations) {
		if (inv.acceptedBy) {
			userIdToInvitationId.set(inv.acceptedBy, inv.id)
		}
	}

	const invitationIds = [...new Set(userIdToInvitationId.values())]
	if (invitationIds.length === 0) return []

	const questionIds = questionFilters.map((f) => f.questionId)

	const answers = await db
		.select({
			invitationId: volunteerRegistrationAnswersTable.invitationId,
			questionId: volunteerRegistrationAnswersTable.questionId,
			answer: volunteerRegistrationAnswersTable.answer,
		})
		.from(volunteerRegistrationAnswersTable)
		.where(
			and(
				inArray(volunteerRegistrationAnswersTable.invitationId, invitationIds),
				inArray(volunteerRegistrationAnswersTable.questionId, questionIds),
			),
		)

	// Build lookup: invitationId -> questionId -> Set of answers
	const answerMap = new Map<string, Map<string, Set<string>>>()
	for (const a of answers) {
		let qMap = answerMap.get(a.invitationId)
		if (!qMap) {
			qMap = new Map()
			answerMap.set(a.invitationId, qMap)
		}
		let values = qMap.get(a.questionId)
		if (!values) {
			values = new Set()
			qMap.set(a.questionId, values)
		}
		values.add(a.answer)
	}

	return recipients.filter((r) => {
		const invitationId = userIdToInvitationId.get(r.userId)
		if (!invitationId) return false
		const qMap = answerMap.get(invitationId)
		if (!qMap) return false
		return questionFilters.every((f) => {
			const answers = qMap.get(f.questionId)
			return answers !== undefined && f.values.some((v) => answers.has(v))
		})
	})
}

/**
 * Partition question filters into athlete and volunteer filters
 * based on the question's questionTarget field.
 */
async function partitionQuestionFilters(
	questionFilters: QuestionFilter[],
): Promise<{ athleteFilters: QuestionFilter[]; volunteerFilters: QuestionFilter[] }> {
	if (questionFilters.length === 0) {
		return { athleteFilters: [], volunteerFilters: [] }
	}

	const db = getDb()
	const questionIds = questionFilters.map((f) => f.questionId)

	const questions = await db
		.select({
			id: competitionRegistrationQuestionsTable.id,
			questionTarget: competitionRegistrationQuestionsTable.questionTarget,
		})
		.from(competitionRegistrationQuestionsTable)
		.where(inArray(competitionRegistrationQuestionsTable.id, questionIds))

	const targetMap = new Map(questions.map((q) => [q.id, q.questionTarget]))

	// Validate all filters resolved to a known question
	const unresolvedFilters = questionFilters.filter((f) => !targetMap.has(f.questionId))
	if (unresolvedFilters.length > 0) {
		throw new Error("One or more registration question filters are no longer valid")
	}

	const athleteFilters = questionFilters.filter(
		(f) => targetMap.get(f.questionId) === "athlete",
	)
	const volunteerFilters = questionFilters.filter(
		(f) => targetMap.get(f.questionId) === "volunteer",
	)

	return { athleteFilters, volunteerFilters }
}

// ============================================================================
// Organizer: Get Distinct Answer Values (for UI autocomplete)
// ============================================================================

const getDistinctAnswersInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	questionId: z.string().min(1, "Question ID is required"),
	questionTarget: z.enum(["athlete", "volunteer"]),
})

export const getDistinctAnswersFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getDistinctAnswersInputSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) throw new Error("Authentication required")

		const db = getDb()

		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, data.competitionId),
			columns: {
				id: true,
				organizingTeamId: true,
				competitionTeamId: true,
			},
		})
		if (!competition) throw new Error("Competition not found")

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		if (data.questionTarget === "athlete") {
			// Get distinct answers from athlete registrations for this competition
			const rows = await db
				.selectDistinct({
					answer: competitionRegistrationAnswersTable.answer,
				})
				.from(competitionRegistrationAnswersTable)
				.innerJoin(
					competitionRegistrationsTable,
					eq(
						competitionRegistrationAnswersTable.registrationId,
						competitionRegistrationsTable.id,
					),
				)
				.where(
					and(
						eq(competitionRegistrationAnswersTable.questionId, data.questionId),
						eq(competitionRegistrationsTable.eventId, data.competitionId),
						ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
					),
				)

			return { values: rows.map((r) => r.answer) }
		}

		// Volunteer: get distinct answers from volunteer invitations
		const invitations = await db
			.select({ id: teamInvitationTable.id })
			.from(teamInvitationTable)
			.where(
				and(
					eq(teamInvitationTable.teamId, competition.competitionTeamId),
					eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
					eq(teamInvitationTable.isSystemRole, true),
				),
			)

		const invitationIds = invitations.map((i) => i.id)
		if (invitationIds.length === 0) return { values: [] }

		const rows = await db
			.selectDistinct({
				answer: volunteerRegistrationAnswersTable.answer,
			})
			.from(volunteerRegistrationAnswersTable)
			.where(
				and(
					eq(volunteerRegistrationAnswersTable.questionId, data.questionId),
					inArray(volunteerRegistrationAnswersTable.invitationId, invitationIds),
				),
			)

		return { values: rows.map((r) => r.answer) }
	})

// ============================================================================
// Organizer: List Broadcasts
// ============================================================================

export const listBroadcastsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => listBroadcastsInputSchema.parse(data))
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
	.inputValidator((data: unknown) => sendBroadcastInputSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) throw new Error("Authentication required")

		updateRequestContext({ userId: session.userId })
		addRequestContextAttribute("competitionId", data.competitionId)

		const db = getDb()

		// Get competition to verify permissions
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, data.competitionId),
			columns: {
				id: true,
				organizingTeamId: true,
				competitionTeamId: true,
				name: true,
				slug: true,
			},
		})
		if (!competition) throw new Error("Competition not found")

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const filterType = data.audienceFilter?.type ?? "all"

		// Build recipients list based on audience filter type
		let recipients: Recipient[] = []

		const includeAthletes =
			filterType === "all" ||
			filterType === "division" ||
			filterType === "public"
		const includeVolunteers =
			filterType === "public" ||
			filterType === "volunteers" ||
			filterType === "volunteer_role"

		if (includeAthletes) {
			// Note: competitionRegistrationsTable uses eventId to reference competition
			const conditions = [
				eq(competitionRegistrationsTable.eventId, data.competitionId),
				ne(
					competitionRegistrationsTable.status,
					REGISTRATION_STATUS.REMOVED,
				),
			]

			if (
				filterType === "division" &&
				data.audienceFilter?.divisionId
			) {
				conditions.push(
					eq(
						competitionRegistrationsTable.divisionId,
						data.audienceFilter.divisionId,
					),
				)
			}

			const athleteRows = await db
				.select({
					id: competitionRegistrationsTable.id,
					userId: competitionRegistrationsTable.userId,
					email: userTable.email,
					firstName: userTable.firstName,
				})
				.from(competitionRegistrationsTable)
				.innerJoin(
					userTable,
					eq(competitionRegistrationsTable.userId, userTable.id),
				)
				.where(and(...conditions))

			// Deduplicate athletes by userId — a user may have multiple registrations
			// (e.g. across divisions) but should only receive one broadcast recipient row
			const seenAthleteUserIds = new Set<string>()
			for (const r of athleteRows) {
				if (!seenAthleteUserIds.has(r.userId)) {
					seenAthleteUserIds.add(r.userId)
					recipients.push({
						registrationId: r.id as string | null,
						userId: r.userId,
						email: r.email,
						firstName: r.firstName,
					})
				}
			}
		}

		if (includeVolunteers) {
			// Volunteers are team members on the competition team with VOLUNTEER role
			const volunteerConditions = [
				eq(
					teamMembershipTable.teamId,
					competition.competitionTeamId,
				),
				eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
				eq(teamMembershipTable.isSystemRole, true),
			]

			const volunteerRows = await db
				.select({
					userId: teamMembershipTable.userId,
					email: userTable.email,
					firstName: userTable.firstName,
					metadata: teamMembershipTable.metadata,
				})
				.from(teamMembershipTable)
				.innerJoin(
					userTable,
					eq(teamMembershipTable.userId, userTable.id),
				)
				.where(and(...volunteerConditions))

			// Filter by volunteer role if specified
			let filteredVolunteers = volunteerRows
			if (
				filterType === "volunteer_role" &&
				data.audienceFilter?.volunteerRole
			) {
				const targetRole = data.audienceFilter.volunteerRole
				filteredVolunteers = volunteerRows.filter((v) => {
					try {
						const meta = JSON.parse(v.metadata || "{}") as {
							volunteerRoleTypes?: string[]
						}
						return meta.volunteerRoleTypes?.includes(targetRole)
					} catch {
						return false
					}
				})
			}

			// Deduplicate: don't add volunteers who are already in as athletes
			const existingUserIds = new Set(recipients.map((r) => r.userId))
			for (const v of filteredVolunteers) {
				if (!existingUserIds.has(v.userId)) {
					recipients.push({
						registrationId: null,
						userId: v.userId,
						email: v.email,
						firstName: v.firstName,
					})
					existingUserIds.add(v.userId)
				}
			}
		}

		// Apply question filters if present
		const questionFilters = data.audienceFilter?.questionFilters
		if (questionFilters && questionFilters.length > 0) {
			const { athleteFilters, volunteerFilters } =
				await partitionQuestionFilters(questionFilters)

			// Split recipients into athletes (have registrationId) and volunteers (no registrationId)
			const athleteRecipients = recipients.filter((r) => r.registrationId !== null)
			const volunteerRecipients = recipients.filter((r) => r.registrationId === null)

			const filteredAthletes =
				athleteFilters.length > 0
					? await applyAthleteQuestionFilters(
							athleteRecipients,
							athleteFilters,
						)
					: athleteRecipients

			const filteredVolunteers =
				volunteerFilters.length > 0
					? await applyVolunteerQuestionFilters(
							volunteerRecipients,
							volunteerFilters,
							competition.competitionTeamId,
						)
					: volunteerRecipients

			recipients = [...filteredAthletes, ...filteredVolunteers]
		}

		if (recipients.length === 0) {
			throw new Error("No recipients match the selected filter")
		}

		// Get organizer team name for email
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, competition.organizingTeamId),
			columns: { name: true },
		})

		// Generate recipient IDs upfront so we can reference them in queue messages
		const { createBroadcastRecipientId } = await import(
			"@/db/schemas/common"
		)

		// Insert broadcast + recipients atomically in a transaction
		const { broadcast, recipientValues } = await db.transaction(
			async (tx) => {
				const [broadcast] = await tx
					.insert(competitionBroadcastsTable)
					.values({
						competitionId: data.competitionId,
						teamId: competition.organizingTeamId,
						title: data.title,
						body: data.body,
						audienceFilter: data.audienceFilter
							? JSON.stringify(data.audienceFilter)
							: null,
						recipientCount: recipients.length,
						status: BROADCAST_STATUS.SENT,
						sentAt: new Date(),
						createdById: session.userId,
					})
					.$returningId()

				const recipientValues = recipients.map((r) => ({
					id: createBroadcastRecipientId(),
					broadcastId: broadcast.id,
					registrationId: r.registrationId,
					userId: r.userId,
					emailDeliveryStatus:
						BROADCAST_EMAIL_DELIVERY_STATUS.QUEUED as "queued",
				}))

				await tx
					.insert(competitionBroadcastRecipientsTable)
					.values(recipientValues)

				return { broadcast, recipientValues }
			},
		)

		logEntityCreated({
			entity: "broadcast",
			id: broadcast.id,
			parentEntity: "competition",
			parentId: data.competitionId,
			attributes: {
				title: data.title,
				audienceFilter: filterType,
				recipientCount: recipients.length,
				sendEmail: data.sendEmail,
			},
		})

		if (data.sendEmail) {
			// Pre-render the email template once for all recipients
			const bodyHtml = await render(
				BroadcastNotificationEmail({
					competitionName: competition.name,
					competitionSlug: competition.slug,
					broadcastTitle: data.title,
					broadcastBody: data.body,
					organizerTeamName: team?.name ?? "Organizer",
				}),
			)

			// Enqueue batches of up to 100 recipients into Cloudflare Queue
			const BATCH_SIZE = 100
			const queue = (env as unknown as Record<string, unknown>)
				.BROADCAST_EMAIL_QUEUE as
				| Queue<BroadcastEmailMessage>
				| undefined

			if (queue) {
				const batchCount = Math.ceil(
					recipientValues.length / BATCH_SIZE,
				)
				for (let i = 0; i < recipientValues.length; i += BATCH_SIZE) {
					const batchSlice = recipientValues.slice(
						i,
						i + BATCH_SIZE,
					)
					const message: BroadcastEmailMessage = {
						broadcastId: broadcast.id,
						competitionId: data.competitionId,
						batch: batchSlice.map((rv, idx) => ({
							recipientId: rv.id,
							email: recipients[i + idx].email ?? "",
							athleteName:
								recipients[i + idx].firstName ?? "Athlete",
						})),
						subject: `${data.title} — ${competition.name}`,
						bodyHtml,
						replyTo: "support@mail.wodsmith.com",
					}
					await queue.send(message)
				}

				logInfo({
					message: "[Broadcast] Emails queued for delivery",
					attributes: {
						broadcastId: broadcast.id,
						recipientCount: recipientValues.length,
						batchCount,
					},
				})
			} else {
				// Dev fallback: send emails directly when Queue binding is unavailable
				logInfo({
					message:
						"[Broadcast] No queue binding, sending emails directly (dev fallback)",
					attributes: {
						broadcastId: broadcast.id,
						recipientCount: recipientValues.length,
					},
				})

				const { sendEmail: sendEmailFn } = await import(
					"@/utils/email"
				)
				let sentCount = 0
				let failedCount = 0
				for (const rv of recipientValues) {
					const recipient = recipients.find(
						(r) => r.userId === rv.userId,
					)
					if (!recipient || !recipient.email) continue
					try {
						await sendEmailFn({
							to: recipient.email,
							subject: `${data.title} — ${competition.name}`,
							template: BroadcastNotificationEmail({
								competitionName: competition.name,
								competitionSlug: competition.slug,
								broadcastTitle: data.title,
								broadcastBody: data.body,
								organizerTeamName: team?.name ?? "Organizer",
							}),
							tags: [
								{
									name: "type",
									value: "competition-broadcast",
								},
							],
						})
						await db
							.update(competitionBroadcastRecipientsTable)
							.set({
								emailDeliveryStatus:
									BROADCAST_EMAIL_DELIVERY_STATUS.SENT,
							})
							.where(
								eq(
									competitionBroadcastRecipientsTable.id,
									rv.id,
								),
							)
						sentCount++
					} catch (err) {
						await db
							.update(competitionBroadcastRecipientsTable)
							.set({
								emailDeliveryStatus:
									BROADCAST_EMAIL_DELIVERY_STATUS.FAILED,
							})
							.where(
								eq(
									competitionBroadcastRecipientsTable.id,
									rv.id,
								),
							)
						failedCount++
						logError({
							message:
								"[Broadcast] Dev fallback email send failed",
							error: err,
							attributes: {
								broadcastId: broadcast.id,
								recipientId: rv.id,
							},
						})
					}
				}

				logInfo({
					message:
						"[Broadcast] Dev fallback delivery complete",
					attributes: {
						broadcastId: broadcast.id,
						sent: sentCount,
						failed: failedCount,
					},
				})
			}
		} else {
			// No email — mark all recipients as skipped (in-app only)
			const allIds = recipientValues.map((rv) => rv.id)
			if (allIds.length > 0) {
				await db
					.update(competitionBroadcastRecipientsTable)
					.set({
						emailDeliveryStatus:
							BROADCAST_EMAIL_DELIVERY_STATUS.SKIPPED,
					})
					.where(
						inArray(
							competitionBroadcastRecipientsTable.id,
							allIds,
						),
					)
			}

			logInfo({
				message: "[Broadcast] Created as in-app only (no email)",
				attributes: {
					broadcastId: broadcast.id,
					recipientCount: recipients.length,
				},
			})
		}

		return {
			broadcastId: broadcast.id,
			recipientCount: recipients.length,
		}
	})

// ============================================================================
// Organizer: Get Broadcast Detail
// ============================================================================

export const getBroadcastFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getBroadcastInputSchema.parse(data))
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
				firstName: userTable.firstName,
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
	.inputValidator((data: unknown) =>
		listAthleteBroadcastsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		const db = getDb()

		// Public broadcasts are visible to everyone (no auth required)
		const publicBroadcasts =
			await db.query.competitionBroadcastsTable.findMany({
				where: and(
					eq(
						competitionBroadcastsTable.competitionId,
						data.competitionId,
					),
					eq(competitionBroadcastsTable.status, BROADCAST_STATUS.SENT),
					eq(competitionBroadcastsTable.audienceFilter, JSON.stringify({ type: "public" })),
				),
				orderBy: [desc(competitionBroadcastsTable.sentAt)],
			})

		// Targeted broadcasts require auth — only show if user is a recipient
		let targetedBroadcasts: typeof publicBroadcasts = []
		if (session?.userId) {
			const recipientBroadcasts = await db
				.select({
					broadcastId:
						competitionBroadcastRecipientsTable.broadcastId,
				})
				.from(competitionBroadcastRecipientsTable)
				.where(
					eq(
						competitionBroadcastRecipientsTable.userId,
						session.userId,
					),
				)

			if (recipientBroadcasts.length > 0) {
				const broadcastIds = recipientBroadcasts.map(
					(r) => r.broadcastId,
				)
				targetedBroadcasts =
					await db.query.competitionBroadcastsTable.findMany({
						where: and(
							eq(
								competitionBroadcastsTable.competitionId,
								data.competitionId,
							),
							inArray(competitionBroadcastsTable.id, broadcastIds),
							eq(
								competitionBroadcastsTable.status,
								BROADCAST_STATUS.SENT,
							),
						),
						orderBy: [desc(competitionBroadcastsTable.sentAt)],
					})
			}
		}

		// Merge and deduplicate, sorted by sentAt descending
		const seenIds = new Set<string>()
		const broadcasts = [...publicBroadcasts, ...targetedBroadcasts]
			.filter((b) => {
				if (seenIds.has(b.id)) return false
				seenIds.add(b.id)
				return true
			})
			.sort(
				(a, b) =>
					(b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0),
			)

		return { broadcasts }
	})

// ============================================================================
// Organizer: Preview Audience Count
// ============================================================================

const previewAudienceInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	audienceFilter: audienceFilterSchema.optional(),
})

export const previewAudienceFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => previewAudienceInputSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) throw new Error("Authentication required")

		const db = getDb()

		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, data.competitionId),
			columns: {
				id: true,
				organizingTeamId: true,
				competitionTeamId: true,
			},
		})
		if (!competition) throw new Error("Competition not found")

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const filterType = data.audienceFilter?.type ?? "all"
		const hasQuestionFilters =
			data.audienceFilter?.questionFilters &&
			data.audienceFilter.questionFilters.length > 0

		const includeAthletes =
			filterType === "all" ||
			filterType === "division" ||
			filterType === "public"
		const includeVolunteers =
			filterType === "public" ||
			filterType === "volunteers" ||
			filterType === "volunteer_role"

		// When question filters are active, we need full recipient rows to filter by answers
		if (hasQuestionFilters) {
			let recipients: Recipient[] = []

			if (includeAthletes) {
				const conditions = [
					eq(competitionRegistrationsTable.eventId, data.competitionId),
					ne(
						competitionRegistrationsTable.status,
						REGISTRATION_STATUS.REMOVED,
					),
				]
				if (filterType === "division" && data.audienceFilter?.divisionId) {
					conditions.push(
						eq(
							competitionRegistrationsTable.divisionId,
							data.audienceFilter.divisionId,
						),
					)
				}
				const athleteRows = await db
					.select({
						id: competitionRegistrationsTable.id,
						userId: competitionRegistrationsTable.userId,
						email: userTable.email,
						firstName: userTable.firstName,
					})
					.from(competitionRegistrationsTable)
					.innerJoin(
						userTable,
						eq(competitionRegistrationsTable.userId, userTable.id),
					)
					.where(and(...conditions))

				// Deduplicate athletes by userId — a user may have multiple registrations
				const seenAthleteUserIds = new Set<string>()
				for (const r of athleteRows) {
					if (!seenAthleteUserIds.has(r.userId)) {
						seenAthleteUserIds.add(r.userId)
						recipients.push({
							registrationId: r.id as string | null,
							userId: r.userId,
							email: r.email,
							firstName: r.firstName,
						})
					}
				}
			}

			if (includeVolunteers) {
				const volunteerRows = await db
					.select({
						userId: teamMembershipTable.userId,
						email: userTable.email,
						firstName: userTable.firstName,
						metadata: teamMembershipTable.metadata,
					})
					.from(teamMembershipTable)
					.innerJoin(
						userTable,
						eq(teamMembershipTable.userId, userTable.id),
					)
					.where(
						and(
							eq(teamMembershipTable.teamId, competition.competitionTeamId),
							eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
							eq(teamMembershipTable.isSystemRole, true),
						),
					)

				let filteredVolunteers = volunteerRows
				if (filterType === "volunteer_role" && data.audienceFilter?.volunteerRole) {
					const targetRole = data.audienceFilter.volunteerRole
					filteredVolunteers = volunteerRows.filter((v) => {
						try {
							const meta = JSON.parse(v.metadata || "{}") as {
								volunteerRoleTypes?: string[]
							}
							return meta.volunteerRoleTypes?.includes(targetRole)
						} catch {
							return false
						}
					})
				}

				const existingUserIds = new Set(recipients.map((r) => r.userId))
				for (const v of filteredVolunteers) {
					if (!existingUserIds.has(v.userId)) {
						recipients.push({
							registrationId: null,
							userId: v.userId,
							email: v.email,
							firstName: v.firstName,
						})
						existingUserIds.add(v.userId)
					}
				}
			}

			// Apply question filters
			const { athleteFilters, volunteerFilters } =
				await partitionQuestionFilters(data.audienceFilter!.questionFilters!)

			const athleteRecipients = recipients.filter((r) => r.registrationId !== null)
			const volunteerRecipients = recipients.filter((r) => r.registrationId === null)

			const filteredAthletes =
				athleteFilters.length > 0
					? await applyAthleteQuestionFilters(
							athleteRecipients,
							athleteFilters,
						)
					: athleteRecipients

			const filteredVolunteers =
				volunteerFilters.length > 0
					? await applyVolunteerQuestionFilters(
							volunteerRecipients,
							volunteerFilters,
							competition.competitionTeamId,
						)
					: volunteerRecipients

			return { count: filteredAthletes.length + filteredVolunteers.length }
		}

		// Fast path: no question filters, use count queries
		let athleteCount = 0
		let volunteerCount = 0

		if (includeAthletes) {
			const conditions = [
				eq(competitionRegistrationsTable.eventId, data.competitionId),
				ne(
					competitionRegistrationsTable.status,
					REGISTRATION_STATUS.REMOVED,
				),
			]
			if (
				filterType === "division" &&
				data.audienceFilter?.divisionId
			) {
				conditions.push(
					eq(
						competitionRegistrationsTable.divisionId,
						data.audienceFilter.divisionId,
					),
				)
			}
			const [result] = await db
				.select({ count: countDistinct(competitionRegistrationsTable.userId) })
				.from(competitionRegistrationsTable)
				.where(and(...conditions))
			athleteCount = Number(result?.count ?? 0)
		}

		if (includeVolunteers) {
			const volunteerRows = await db
				.select({
					userId: teamMembershipTable.userId,
					metadata: teamMembershipTable.metadata,
				})
				.from(teamMembershipTable)
				.where(
					and(
						eq(
							teamMembershipTable.teamId,
							competition.competitionTeamId,
						),
						eq(
							teamMembershipTable.roleId,
							SYSTEM_ROLES_ENUM.VOLUNTEER,
						),
						eq(teamMembershipTable.isSystemRole, true),
					),
				)

			if (
				filterType === "volunteer_role" &&
				data.audienceFilter?.volunteerRole
			) {
				const targetRole = data.audienceFilter.volunteerRole
				volunteerCount = volunteerRows.filter((v) => {
					try {
						const meta = JSON.parse(v.metadata || "{}") as {
							volunteerRoleTypes?: string[]
						}
						return meta.volunteerRoleTypes?.includes(targetRole)
					} catch {
						return false
					}
				}).length
			} else {
				volunteerCount = volunteerRows.length
			}
		}

		// For public, there may be overlap (volunteer who is also an athlete)
		// Return the sum as an approximation — exact dedup happens at send time
		return { count: athleteCount + volunteerCount }
	})
