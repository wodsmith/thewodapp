/**
 * Organizer Onboarding Server Functions
 * Handles the workflow for teams to request and receive competition organizing access
 */
import "server-only"

import { and, desc, eq } from "drizzle-orm"
import { FEATURES } from "@/config/features"
import { LIMITS } from "@/config/limits"
import { getDb } from "@/db"
import {
	ORGANIZER_REQUEST_STATUS,
	type OrganizerRequest,
	organizerRequestTable,
	teamTable,
	userTable,
} from "@/db/schema"
import { logInfo } from "@/lib/logging/posthog-otel-logger"
import {
	grantTeamFeature,
	revokeTeamFeature,
	setTeamLimitOverride,
} from "./entitlements"

export interface OrganizerRequestWithDetails extends OrganizerRequest {
	team: {
		id: string
		name: string
		slug: string
	}
	user: {
		id: string
		firstName: string | null
		lastName: string | null
		email: string | null
	}
	reviewer?: {
		id: string
		firstName: string | null
		lastName: string | null
	} | null
}

/**
 * Submit an organizer request for a team
 * Grants HOST_COMPETITIONS feature immediately, but sets MAX_PUBLISHED_COMPETITIONS to 0
 * (pending approval)
 */
export async function submitOrganizerRequest({
	teamId,
	userId,
	reason,
}: {
	teamId: string
	userId: string
	reason: string
}): Promise<OrganizerRequest> {
	const db = getDb()

	// Check if there's already a pending or approved request for this team
	const existingRequest = await db.query.organizerRequestTable.findFirst({
		where: and(
			eq(organizerRequestTable.teamId, teamId),
			eq(organizerRequestTable.status, ORGANIZER_REQUEST_STATUS.PENDING),
		),
	})

	if (existingRequest) {
		throw new Error("A pending organizer request already exists for this team")
	}

	// Check if already approved
	const approvedRequest = await db.query.organizerRequestTable.findFirst({
		where: and(
			eq(organizerRequestTable.teamId, teamId),
			eq(organizerRequestTable.status, ORGANIZER_REQUEST_STATUS.APPROVED),
		),
	})

	if (approvedRequest) {
		throw new Error("This team is already approved as an organizer")
	}

	// Create the request
	const [request] = await db
		.insert(organizerRequestTable)
		.values({
			teamId,
			userId,
			reason,
			status: ORGANIZER_REQUEST_STATUS.PENDING,
		})
		.returning()

	if (!request) {
		throw new Error("Failed to create organizer request")
	}

	// Grant HOST_COMPETITIONS feature (allows creating private competitions)
	await grantTeamFeature(teamId, FEATURES.HOST_COMPETITIONS)

	// Set MAX_PUBLISHED_COMPETITIONS to 0 (pending approval - can't publish yet)
	await setTeamLimitOverride(
		teamId,
		LIMITS.MAX_PUBLISHED_COMPETITIONS,
		0,
		"Organizer request pending approval",
	)

	logInfo({
		message: "[organizer-onboarding] Organizer request submitted",
		attributes: { teamId, userId, requestId: request.id },
	})

	return request
}

/**
 * Get the organizer request for a team
 */
export async function getOrganizerRequest(
	teamId: string,
): Promise<OrganizerRequest | null> {
	const db = getDb()

	// Get the most recent request for this team
	const request = await db.query.organizerRequestTable.findFirst({
		where: eq(organizerRequestTable.teamId, teamId),
		orderBy: desc(organizerRequestTable.createdAt),
	})

	return request ?? null
}

/**
 * Get all pending organizer requests (for admin review)
 */
export async function getPendingOrganizerRequests(): Promise<
	OrganizerRequestWithDetails[]
> {
	return getAllOrganizerRequests({ statusFilter: "pending" })
}

/**
 * Get all organizer requests with optional status filter (for admin review)
 */
export async function getAllOrganizerRequests({
	statusFilter,
}: {
	statusFilter?: "pending" | "approved" | "rejected" | "all"
} = {}): Promise<OrganizerRequestWithDetails[]> {
	const db = getDb()

	const requests = await db
		.select({
			id: organizerRequestTable.id,
			teamId: organizerRequestTable.teamId,
			userId: organizerRequestTable.userId,
			reason: organizerRequestTable.reason,
			status: organizerRequestTable.status,
			adminNotes: organizerRequestTable.adminNotes,
			reviewedBy: organizerRequestTable.reviewedBy,
			reviewedAt: organizerRequestTable.reviewedAt,
			createdAt: organizerRequestTable.createdAt,
			updatedAt: organizerRequestTable.updatedAt,
			updateCounter: organizerRequestTable.updateCounter,
			teamName: teamTable.name,
			teamSlug: teamTable.slug,
			userFirstName: userTable.firstName,
			userLastName: userTable.lastName,
			userEmail: userTable.email,
		})
		.from(organizerRequestTable)
		.innerJoin(teamTable, eq(organizerRequestTable.teamId, teamTable.id))
		.innerJoin(userTable, eq(organizerRequestTable.userId, userTable.id))
		.where(
			statusFilter && statusFilter !== "all"
				? eq(organizerRequestTable.status, statusFilter)
				: undefined,
		)
		.orderBy(desc(organizerRequestTable.createdAt))

	// Fetch reviewer details separately for requests that have reviewedBy
	const reviewerIds = [
		...new Set(
			requests
				.filter((r) => r.reviewedBy)
				.map((r) => r.reviewedBy)
				.filter((id): id is string => id !== null),
		),
	]
	const reviewerMap = new Map<
		string,
		{ id: string; firstName: string | null; lastName: string | null }
	>()

	if (reviewerIds.length > 0) {
		const { inArray } = await import("drizzle-orm")
		const reviewers = await db
			.select({
				id: userTable.id,
				firstName: userTable.firstName,
				lastName: userTable.lastName,
			})
			.from(userTable)
			.where(inArray(userTable.id, reviewerIds))
		for (const r of reviewers) {
			reviewerMap.set(r.id, r)
		}
	}

	return requests.map((r) => ({
		id: r.id,
		teamId: r.teamId,
		userId: r.userId,
		reason: r.reason,
		status: r.status,
		adminNotes: r.adminNotes,
		reviewedBy: r.reviewedBy,
		reviewedAt: r.reviewedAt,
		createdAt: r.createdAt,
		updatedAt: r.updatedAt,
		updateCounter: r.updateCounter,
		team: {
			id: r.teamId,
			name: r.teamName,
			slug: r.teamSlug,
		},
		user: {
			id: r.userId,
			firstName: r.userFirstName,
			lastName: r.userLastName,
			email: r.userEmail,
		},
		reviewer: r.reviewedBy ? (reviewerMap.get(r.reviewedBy) ?? null) : null,
	}))
}

/**
 * Approve an organizer request
 * Sets MAX_PUBLISHED_COMPETITIONS to -1 (unlimited)
 */
export async function approveOrganizerRequest({
	requestId,
	adminUserId,
	adminNotes,
}: {
	requestId: string
	adminUserId: string
	adminNotes?: string
}): Promise<OrganizerRequest> {
	const db = getDb()

	// Get the request
	const request = await db.query.organizerRequestTable.findFirst({
		where: eq(organizerRequestTable.id, requestId),
	})

	if (!request) {
		throw new Error("Organizer request not found")
	}

	if (request.status !== ORGANIZER_REQUEST_STATUS.PENDING) {
		throw new Error("Request has already been processed")
	}

	// Update the request
	const [updatedRequest] = await db
		.update(organizerRequestTable)
		.set({
			status: ORGANIZER_REQUEST_STATUS.APPROVED,
			reviewedBy: adminUserId,
			reviewedAt: new Date(),
			adminNotes,
		})
		.where(eq(organizerRequestTable.id, requestId))
		.returning()

	if (!updatedRequest) {
		throw new Error("Failed to update organizer request")
	}

	// Set MAX_PUBLISHED_COMPETITIONS to -1 (unlimited)
	await setTeamLimitOverride(
		request.teamId,
		LIMITS.MAX_PUBLISHED_COMPETITIONS,
		-1,
		"Organizer request approved",
	)

	logInfo({
		message: "[organizer-onboarding] Organizer request approved",
		attributes: {
			teamId: request.teamId,
			requestId,
			adminUserId,
		},
	})

	// TODO: Send approval email to requester

	return updatedRequest
}

/**
 * Reject an organizer request
 * Optionally revokes HOST_COMPETITIONS feature
 */
export async function rejectOrganizerRequest({
	requestId,
	adminUserId,
	adminNotes,
	revokeFeature = false,
}: {
	requestId: string
	adminUserId: string
	adminNotes?: string
	revokeFeature?: boolean
}): Promise<OrganizerRequest> {
	const db = getDb()

	// Get the request
	const request = await db.query.organizerRequestTable.findFirst({
		where: eq(organizerRequestTable.id, requestId),
	})

	if (!request) {
		throw new Error("Organizer request not found")
	}

	if (request.status !== ORGANIZER_REQUEST_STATUS.PENDING) {
		throw new Error("Request has already been processed")
	}

	// Update the request
	const [updatedRequest] = await db
		.update(organizerRequestTable)
		.set({
			status: ORGANIZER_REQUEST_STATUS.REJECTED,
			reviewedBy: adminUserId,
			reviewedAt: new Date(),
			adminNotes,
		})
		.where(eq(organizerRequestTable.id, requestId))
		.returning()

	if (!updatedRequest) {
		throw new Error("Failed to update organizer request")
	}

	// Optionally revoke the HOST_COMPETITIONS feature
	if (revokeFeature) {
		await revokeTeamFeature(request.teamId, FEATURES.HOST_COMPETITIONS)
	}

	logInfo({
		message: "[organizer-onboarding] Organizer request rejected",
		attributes: {
			teamId: request.teamId,
			requestId,
			adminUserId,
			revokeFeature,
		},
	})

	// TODO: Send rejection email to requester

	return updatedRequest
}

/**
 * Check if a team has an approved organizer request
 */
export async function isApprovedOrganizer(teamId: string): Promise<boolean> {
	const db = getDb()

	const request = await db.query.organizerRequestTable.findFirst({
		where: and(
			eq(organizerRequestTable.teamId, teamId),
			eq(organizerRequestTable.status, ORGANIZER_REQUEST_STATUS.APPROVED),
		),
	})

	return !!request
}

/**
 * Check if a team has a pending organizer request
 */
export async function hasPendingOrganizerRequest(
	teamId: string,
): Promise<boolean> {
	const db = getDb()

	const request = await db.query.organizerRequestTable.findFirst({
		where: and(
			eq(organizerRequestTable.teamId, teamId),
			eq(organizerRequestTable.status, ORGANIZER_REQUEST_STATUS.PENDING),
		),
	})

	return !!request
}
