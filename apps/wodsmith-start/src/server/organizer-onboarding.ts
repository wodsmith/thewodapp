/**
 * Organizer Onboarding Server Functions
 * Handles the workflow for teams to request and receive competition organizing access
 */
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

/**
 * Grant a feature entitlement to a team
 * Inserts into teamFeatureEntitlementTable with source 'override'
 * Uses onConflictDoUpdate to handle duplicates
 */
export async function grantTeamFeature(
	teamId: string,
	featureKey: string,
): Promise<void> {
	const db = getDb()
	const { eq } = await import("drizzle-orm")
	const { featureTable, teamFeatureEntitlementTable } = await import(
		"@/db/schema"
	)

	// Look up feature by key to get its ID
	const feature = await db.query.featureTable.findFirst({
		where: eq(featureTable.key, featureKey),
	})

	if (!feature) {
		throw new Error(`Feature not found: ${featureKey}`)
	}

	await db
		.insert(teamFeatureEntitlementTable)
		.values({
			teamId,
			featureId: feature.id,
			source: "override",
			isActive: 1,
		})
		.onConflictDoUpdate({
			target: [
				teamFeatureEntitlementTable.teamId,
				teamFeatureEntitlementTable.featureId,
			],
			set: {
				isActive: 1,
				source: "override",
			},
		})

	// Invalidate sessions for all team members so they get the new feature
	// This ensures team.plan.features is updated in their cached session
	const { invalidateTeamMembersSessions } = await import("@/utils/kv-session")
	await invalidateTeamMembersSessions(teamId)
}

/**
 * Revoke a feature entitlement from a team
 * Sets isActive = 0 on the teamFeatureEntitlementTable entry
 */
export async function revokeTeamFeature(
	teamId: string,
	featureKey: string,
): Promise<void> {
	const db = getDb()
	const { eq, and } = await import("drizzle-orm")
	const { featureTable, teamFeatureEntitlementTable } = await import(
		"@/db/schema"
	)

	// Look up feature by key to get its ID
	const feature = await db.query.featureTable.findFirst({
		where: eq(featureTable.key, featureKey),
	})

	if (!feature) {
		throw new Error(`Feature not found: ${featureKey}`)
	}

	// Deactivate the feature entitlement (set isActive = 0)
	await db
		.update(teamFeatureEntitlementTable)
		.set({ isActive: 0 })
		.where(
			and(
				eq(teamFeatureEntitlementTable.teamId, teamId),
				eq(teamFeatureEntitlementTable.featureId, feature.id),
			),
		)

	// Invalidate sessions for all team members so they lose the feature
	// This ensures team.plan.features is updated in their cached session
	const { invalidateTeamMembersSessions } = await import("@/utils/kv-session")
	await invalidateTeamMembersSessions(teamId)
}

/**
 * Set a limit override for a team
 * Inserts into teamEntitlementOverrideTable with type 'limit'
 * Uses onConflictDoUpdate to handle duplicates
 */
export async function setTeamLimitOverride(
	teamId: string,
	limitKey: string,
	value: number,
	reason?: string,
): Promise<void> {
	const db = getDb()
	const { teamEntitlementOverrideTable } = await import("@/db/schema")

	await db
		.insert(teamEntitlementOverrideTable)
		.values({
			teamId,
			type: "limit",
			key: limitKey,
			value: String(value),
			reason,
		})
		.onConflictDoUpdate({
			target: [
				teamEntitlementOverrideTable.teamId,
				teamEntitlementOverrideTable.type,
				teamEntitlementOverrideTable.key,
			],
			set: {
				value: String(value),
				reason,
			},
		})
}

// Dynamic import helper for logging (avoids Vite bundling issues)
async function getLogger() {
	const { logInfo, logError } = await import(
		"@/lib/logging/posthog-otel-logger"
	)
	return { logInfo, logError }
}

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

	const { logInfo } = await getLogger()
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

	const { logInfo } = await getLogger()
	logInfo({
		message: "[organizer-onboarding] Organizer request approved",
		attributes: {
			teamId: request.teamId,
			requestId,
			adminUserId,
		},
	})

	// Get requester and team info for email
	const requester = await db.query.userTable.findFirst({
		where: eq(userTable.id, request.userId),
		columns: { firstName: true, lastName: true, email: true },
	})

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, request.teamId),
		columns: { name: true, slug: true },
	})

	if (requester?.email && team) {
		const { sendOrganizerApprovalEmail } = await import("@/utils/email")
		await sendOrganizerApprovalEmail({
			email: requester.email,
			recipientName:
				`${requester.firstName || ""} ${requester.lastName || ""}`.trim() ||
				"there",
			teamName: team.name,
			teamSlug: team.slug,
			adminNotes,
		})
	}

	return updatedRequest
}

/**
 * Reject an organizer request
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

	const { logInfo } = await getLogger()
	logInfo({
		message: "[organizer-onboarding] Organizer request rejected",
		attributes: {
			teamId: request.teamId,
			requestId,
			adminUserId,
			revokeFeature,
		},
	})

	// Get requester and team info for email
	const requester = await db.query.userTable.findFirst({
		where: eq(userTable.id, request.userId),
		columns: { firstName: true, lastName: true, email: true },
	})

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, request.teamId),
		columns: { name: true },
	})

	if (requester?.email && team) {
		const { sendOrganizerRejectionEmail } = await import("@/utils/email")
		await sendOrganizerRejectionEmail({
			email: requester.email,
			recipientName:
				`${requester.firstName || ""} ${requester.lastName || ""}`.trim() ||
				"there",
			teamName: team.name,
			adminNotes,
		})
	}

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
