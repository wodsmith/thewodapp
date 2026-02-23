/**
 * Event Resources Server Functions
 *
 * CRUD operations for event resources that allow organizers to attach
 * various resources (videos, text instructions, etc.) to competition events.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { createEventResourceId } from "@/db/schemas/common"
import {
	type EventResource,
	eventResourcesTable,
} from "@/db/schemas/event-resources"
import {
	programmingTracksTable,
	trackWorkoutsTable,
} from "@/db/schemas/programming"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { ROLES_ENUM } from "@/db/schemas/users"
import { getSessionFromCookie } from "@/utils/auth"

// ============================================================================
// Input Schemas
// ============================================================================

const getEventResourcesInputSchema = z.object({
	eventId: z.string().min(1, "Event ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

const getPublicEventResourcesInputSchema = z.object({
	eventId: z.string().min(1, "Event ID is required"),
})

const createEventResourceInputSchema = z.object({
	eventId: z.string().min(1, "Event ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	title: z.string().min(1, "Title is required").max(255),
	description: z.string().max(5000).optional(),
	url: z
		.string()
		.url("Must be a valid URL")
		.max(2048)
		.optional()
		.or(z.literal("")),
	sortOrder: z.number().int().min(1).optional(),
})

const updateEventResourceInputSchema = z.object({
	resourceId: z.string().min(1, "Resource ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	title: z.string().min(1, "Title is required").max(255).optional(),
	description: z.string().max(5000).nullable().optional(),
	url: z
		.string()
		.url("Must be a valid URL")
		.max(2048)
		.nullable()
		.optional()
		.or(z.literal("")),
	sortOrder: z.number().int().min(1).optional(),
})

const deleteEventResourceInputSchema = z.object({
	resourceId: z.string().min(1, "Resource ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

const reorderEventResourcesInputSchema = z.object({
	eventId: z.string().min(1, "Event ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	updates: z
		.array(
			z.object({
				resourceId: z.string().min(1),
				sortOrder: z.number().int().min(1),
			}),
		)
		.min(1, "At least one update required"),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if user has permission on a team (or is a site admin)
 */
async function hasTeamPermission(
	teamId: string,
	permission: string,
): Promise<boolean> {
	const session = await getSessionFromCookie()
	if (!session?.userId) return false

	// Site admins have all permissions
	if (session.user?.role === ROLES_ENUM.ADMIN) return true

	const team = session.teams?.find((t) => t.id === teamId)
	if (!team) return false

	return team.permissions.includes(permission)
}

/**
 * Require team permission or throw error
 */
async function requireTeamPermission(
	teamId: string,
	permission: string,
): Promise<void> {
	const hasPermission = await hasTeamPermission(teamId, permission)
	if (!hasPermission) {
		throw new Error(`Missing required permission: ${permission}`)
	}
}

/**
 * Verify that a track workout (event) belongs to a team's competition
 */
async function verifyEventBelongsToTeam(
	eventId: string,
	teamId: string,
): Promise<boolean> {
	const db = getDb()

	// Get the track workout and check its programming track's owner team
	const result = await db
		.select({
			eventId: trackWorkoutsTable.id,
			ownerTeamId: programmingTracksTable.ownerTeamId,
		})
		.from(trackWorkoutsTable)
		.innerJoin(
			programmingTracksTable,
			eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
		)
		.where(eq(trackWorkoutsTable.id, eventId))
		.limit(1)

	if (result.length === 0) return false

	return result[0].ownerTeamId === teamId
}

/**
 * Verify that a resource belongs to a team's event
 */
async function verifyResourceBelongsToTeam(
	resourceId: string,
	teamId: string,
): Promise<{ eventId: string } | null> {
	const db = getDb()

	const result = await db
		.select({
			resourceId: eventResourcesTable.id,
			eventId: eventResourcesTable.eventId,
			ownerTeamId: programmingTracksTable.ownerTeamId,
		})
		.from(eventResourcesTable)
		.innerJoin(
			trackWorkoutsTable,
			eq(eventResourcesTable.eventId, trackWorkoutsTable.id),
		)
		.innerJoin(
			programmingTracksTable,
			eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
		)
		.where(eq(eventResourcesTable.id, resourceId))
		.limit(1)

	if (result.length === 0) return null
	if (result[0].ownerTeamId !== teamId) return null

	return { eventId: result[0].eventId }
}

/**
 * Get the next available sort order for an event's resources
 */
async function getNextResourceSortOrder(eventId: string): Promise<number> {
	const db = getDb()

	const resources = await db
		.select({ sortOrder: eventResourcesTable.sortOrder })
		.from(eventResourcesTable)
		.where(eq(eventResourcesTable.eventId, eventId))

	if (resources.length === 0) {
		return 1
	}

	const maxOrder = Math.max(...resources.map((r) => r.sortOrder))
	return maxOrder + 1
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all resources for an event (organizer view)
 * Requires authentication and team permission
 */
export const getEventResourcesFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getEventResourcesInputSchema.parse(data))
	.handler(async ({ data }) => {
		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Check permission
		await requireTeamPermission(data.teamId, TEAM_PERMISSIONS.ACCESS_DASHBOARD)

		// Verify the event belongs to this team
		const eventBelongsToTeam = await verifyEventBelongsToTeam(
			data.eventId,
			data.teamId,
		)
		if (!eventBelongsToTeam) {
			throw new Error("Event not found or does not belong to this team")
		}

		const db = getDb()

		const resources = await db
			.select()
			.from(eventResourcesTable)
			.where(eq(eventResourcesTable.eventId, data.eventId))
			.orderBy(eventResourcesTable.sortOrder)

		return { resources }
	})

/**
 * Get published resources for an event (public view)
 * Only returns resources for events with eventStatus = 'published'
 */
export const getPublicEventResourcesFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getPublicEventResourcesInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// First verify the event is published
		const event = await db
			.select({
				eventStatus: trackWorkoutsTable.eventStatus,
			})
			.from(trackWorkoutsTable)
			.where(eq(trackWorkoutsTable.id, data.eventId))
			.limit(1)

		if (event.length === 0 || event[0].eventStatus !== "published") {
			return { resources: [] }
		}

		const resources = await db
			.select()
			.from(eventResourcesTable)
			.where(eq(eventResourcesTable.eventId, data.eventId))
			.orderBy(eventResourcesTable.sortOrder)

		return { resources }
	})

/**
 * Get resources for multiple events (batch)
 * Useful for competition pages showing all events with their resources
 */
export const getEventResourcesBatchFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				eventIds: z.array(z.string().min(1)).min(1),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		if (data.eventIds.length === 0) {
			return { resourcesByEvent: {} }
		}

		const db = getDb()

		// First, filter to only published events
		const publishedEventIds = await db
			.select({ id: trackWorkoutsTable.id })
			.from(trackWorkoutsTable)
			.where(
				and(
					inArray(trackWorkoutsTable.id, data.eventIds),
					eq(trackWorkoutsTable.eventStatus, "published"),
				),
			)

		const publishedIds = publishedEventIds.map((e) => e.id)
		if (publishedIds.length === 0) {
			return { resourcesByEvent: {} }
		}

		// Batch fetch resources for published events only
		const allResources = await db
			.select()
			.from(eventResourcesTable)
			.where(inArray(eventResourcesTable.eventId, publishedIds))
			.orderBy(eventResourcesTable.sortOrder)

		// Group by eventId
		const resourcesByEvent: Record<string, EventResource[]> = {}
		for (const resource of allResources) {
			if (!resourcesByEvent[resource.eventId]) {
				resourcesByEvent[resource.eventId] = []
			}
			resourcesByEvent[resource.eventId].push(resource)
		}

		return { resourcesByEvent }
	})

/**
 * Create a new event resource
 */
export const createEventResourceFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createEventResourceInputSchema.parse(data))
	.handler(async ({ data }) => {
		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Check permission
		await requireTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		// Verify the event belongs to this team
		const eventBelongsToTeam = await verifyEventBelongsToTeam(
			data.eventId,
			data.teamId,
		)
		if (!eventBelongsToTeam) {
			throw new Error("Event not found or does not belong to this team")
		}

		const db = getDb()

		// Get next sort order if not provided
		const sortOrder =
			data.sortOrder ?? (await getNextResourceSortOrder(data.eventId))

		// Normalize empty string URL to null
		const url = data.url === "" ? null : data.url

		// Generate ID first, insert, then select back
		const id = createEventResourceId()
		await db.insert(eventResourcesTable).values({
			id,
			eventId: data.eventId,
			title: data.title,
			description: data.description ?? null,
			url: url ?? null,
			sortOrder,
		})

		const resource = await db.query.eventResourcesTable.findFirst({
			where: eq(eventResourcesTable.id, id),
		})

		if (!resource) {
			throw new Error("Failed to create resource")
		}

		return { resource }
	})

/**
 * Update an existing event resource
 */
export const updateEventResourceFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => updateEventResourceInputSchema.parse(data))
	.handler(async ({ data }) => {
		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Check permission
		await requireTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		// Verify the resource belongs to this team
		const resourceInfo = await verifyResourceBelongsToTeam(
			data.resourceId,
			data.teamId,
		)
		if (!resourceInfo) {
			throw new Error("Resource not found or does not belong to this team")
		}

		const db = getDb()

		const updateData: Record<string, unknown> = {
			updatedAt: new Date(),
		}

		if (data.title !== undefined) {
			updateData.title = data.title
		}
		if (data.description !== undefined) {
			updateData.description = data.description
		}
		if (data.url !== undefined) {
			// Normalize empty string to null
			updateData.url = data.url === "" ? null : data.url
		}
		if (data.sortOrder !== undefined) {
			updateData.sortOrder = data.sortOrder
		}

		await db
			.update(eventResourcesTable)
			.set(updateData)
			.where(eq(eventResourcesTable.id, data.resourceId))

		// Fetch and return the updated resource
		const [updatedResource] = await db
			.select()
			.from(eventResourcesTable)
			.where(eq(eventResourcesTable.id, data.resourceId))
			.limit(1)

		return { resource: updatedResource }
	})

/**
 * Delete an event resource
 */
export const deleteEventResourceFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => deleteEventResourceInputSchema.parse(data))
	.handler(async ({ data }) => {
		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Check permission
		await requireTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		// Verify the resource belongs to this team
		const resourceInfo = await verifyResourceBelongsToTeam(
			data.resourceId,
			data.teamId,
		)
		if (!resourceInfo) {
			throw new Error("Resource not found or does not belong to this team")
		}

		const db = getDb()

		await db
			.delete(eventResourcesTable)
			.where(eq(eventResourcesTable.id, data.resourceId))

		return { success: true }
	})

/**
 * Reorder event resources
 * Updates sort order for multiple resources in a single operation
 */
export const reorderEventResourcesFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		reorderEventResourcesInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Check permission
		await requireTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		// Verify the event belongs to this team
		const eventBelongsToTeam = await verifyEventBelongsToTeam(
			data.eventId,
			data.teamId,
		)
		if (!eventBelongsToTeam) {
			throw new Error("Event not found or does not belong to this team")
		}

		const db = getDb()

		// Validate all resources belong to this event
		const resourceIds = data.updates.map((u) => u.resourceId)
		const existingResources = await db
			.select({ id: eventResourcesTable.id })
			.from(eventResourcesTable)
			.where(
				and(
					eq(eventResourcesTable.eventId, data.eventId),
					inArray(eventResourcesTable.id, resourceIds),
				),
			)

		const existingIds = new Set(existingResources.map((r) => r.id))

		for (const update of data.updates) {
			if (!existingIds.has(update.resourceId)) {
				throw new Error(
					`Resource ${update.resourceId} does not belong to this event`,
				)
			}
		}

		// Perform updates
		let updateCount = 0
		for (const update of data.updates) {
			await db
				.update(eventResourcesTable)
				.set({ sortOrder: update.sortOrder, updatedAt: new Date() })
				.where(eq(eventResourcesTable.id, update.resourceId))
			updateCount++
		}

		return { updateCount }
	})
