import { beforeEach, describe, expect, it, vi } from "vitest"
import { FakeDrizzleDb } from "@repo/test-utils"
import { createEventResource } from "@repo/test-utils/factories"
import {
	createEventResourceFn,
	deleteEventResourceFn,
	getEventResourcesFn,
	getPublicEventResourcesFn,
	reorderEventResourcesFn,
	updateEventResourceFn,
} from "@/server-fns/event-resources-fns"

// Mock the database
const mockDb = new FakeDrizzleDb()

vi.mock("@/db", () => ({
	getDb: vi.fn(() => mockDb),
}))

// Mock auth
vi.mock("@/utils/auth", () => ({
	getSessionFromCookie: vi.fn(() =>
		Promise.resolve({
			userId: "test-user",
			teams: [
				{
					id: "team-1",
					permissions: ["manage_programming", "access_dashboard"],
				},
			],
		}),
	),
}))

// Mock TanStack createServerFn to make server functions directly callable in tests
vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => {
		let handlerFn: any
		return {
			// Handle pattern: createServerFn().inputValidator().handler()
			inputValidator: () => ({
				handler: (fn: any) => {
					handlerFn = fn
					return handlerFn
				},
			}),
			// Handle pattern: createServerFn().handler() (no inputValidator)
			handler: (fn: any) => {
				handlerFn = fn
				return handlerFn
			},
		}
	},
}))

describe("Event Resources Server Functions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockDb.reset()
		mockDb.registerTable("eventResourcesTable")
	})

	describe("getEventResourcesFn", () => {
		it("returns resources ordered by sortOrder", async () => {
			const resource1 = createEventResource({
				id: "eres-1",
				eventId: "event-1",
				title: "Movement Standards",
				sortOrder: 1,
			})
			const resource2 = createEventResource({
				id: "eres-2",
				eventId: "event-1",
				title: "Workout Flow",
				sortOrder: 2,
			})

			// Mock: verify event belongs to team (first query)
			// The FakeDrizzleDb returns mockReturnValue at any await point
			mockDb.setMockReturnValue([
				{ eventId: "event-1", ownerTeamId: "team-1" },
			])

			// Mock: get resources (second query)
			const orderByMock = mockDb.getChainMock().orderBy as any
			orderByMock.mockResolvedValueOnce([resource1, resource2])

			const result = await getEventResourcesFn({
				data: { eventId: "event-1", teamId: "team-1" },
			})

			expect(result.resources).toHaveLength(2)
			expect(result.resources[0].title).toBe("Movement Standards")
			expect(result.resources[1].title).toBe("Workout Flow")
		})

		it("returns empty array when no resources exist", async () => {
			// Mock: verify event belongs to team
			mockDb.setMockReturnValue([
				{ eventId: "event-1", ownerTeamId: "team-1" },
			])

			// Mock: get resources (empty)
			const orderByMock = mockDb.getChainMock().orderBy as any
			orderByMock.mockResolvedValueOnce([])

			const result = await getEventResourcesFn({
				data: { eventId: "event-1", teamId: "team-1" },
			})

			expect(result.resources).toEqual([])
		})

		it("throws when event does not belong to team", async () => {
			// Mock: event not found or wrong team
			mockDb.setMockReturnValue([])

			await expect(
				getEventResourcesFn({
					data: { eventId: "event-1", teamId: "team-1" },
				}),
			).rejects.toThrow("Event not found or does not belong to this team")
		})
	})

	describe("getPublicEventResourcesFn", () => {
		it("returns resources for published events", async () => {
			const resource = createEventResource({
				id: "eres-1",
				eventId: "event-1",
				title: "Public Resource",
			})

			// Mock: check event status (published)
			mockDb.setMockReturnValue([{ eventStatus: "published" }])

			// Mock: get resources
			const orderByMock = mockDb.getChainMock().orderBy as any
			orderByMock.mockResolvedValueOnce([resource])

			const result = await getPublicEventResourcesFn({
				data: { eventId: "event-1" },
			})

			expect(result.resources).toHaveLength(1)
			expect(result.resources[0].title).toBe("Public Resource")
		})

		it("returns empty array for unpublished events", async () => {
			// Mock: check event status (draft)
			mockDb.setMockReturnValue([{ eventStatus: "draft" }])

			const result = await getPublicEventResourcesFn({
				data: { eventId: "event-1" },
			})

			expect(result.resources).toEqual([])
		})

		it("returns empty array when event not found", async () => {
			// Mock: event not found
			mockDb.setMockReturnValue([])

			const result = await getPublicEventResourcesFn({
				data: { eventId: "nonexistent" },
			})

			expect(result.resources).toEqual([])
		})
	})

	describe("createEventResourceFn", () => {
		it("creates a resource successfully", async () => {
			const created = createEventResource({
				id: "eres-new",
				eventId: "event-1",
				title: "New Resource",
				sortOrder: 1,
			})

			// Mock: verify event belongs to team (returns via setMockReturnValue)
			mockDb.setMockReturnValue([
				{ eventId: "event-1", ownerTeamId: "team-1" },
			])

			// Mock: insert returning
			mockDb.getChainMock().returning.mockResolvedValueOnce([created])

			const result = await createEventResourceFn({
				data: {
					eventId: "event-1",
					teamId: "team-1",
					title: "New Resource",
				},
			})

			expect(result.resource).toEqual(created)
			expect(mockDb.insert).toHaveBeenCalled()
		})

		it("throws when event does not belong to team", async () => {
			// Mock: event not found
			mockDb.setMockReturnValue([])

			await expect(
				createEventResourceFn({
					data: {
						eventId: "event-1",
						teamId: "team-1",
						title: "Test",
					},
				}),
			).rejects.toThrow("Event not found or does not belong to this team")
		})
	})

	describe("updateEventResourceFn", () => {
		it("updates resource successfully", async () => {
			const updated = createEventResource({
				id: "eres-1",
				eventId: "event-1",
				title: "Updated Title",
			})

			// Both queries end with .limit(1), so we need to mock limit twice:
			// 1. First call: verifyResourceBelongsToTeam - returns verification data
			// 2. Second call: select after update - returns the updated resource
			const limitMock = mockDb.getChainMock().limit as any
			limitMock
				.mockResolvedValueOnce([
					{
						resourceId: "eres-1",
						eventId: "event-1",
						ownerTeamId: "team-1",
					},
				])
				.mockResolvedValueOnce([updated])

			const result = await updateEventResourceFn({
				data: {
					resourceId: "eres-1",
					teamId: "team-1",
					title: "Updated Title",
				},
			})

			expect(result.resource?.title).toBe("Updated Title")
			expect(mockDb.update).toHaveBeenCalled()
		})

		it("throws when resource does not belong to team", async () => {
			// Mock: resource not found
			mockDb.setMockReturnValue([])

			await expect(
				updateEventResourceFn({
					data: {
						resourceId: "eres-1",
						teamId: "team-1",
						title: "Test",
					},
				}),
			).rejects.toThrow("Resource not found or does not belong to this team")
		})
	})

	describe("deleteEventResourceFn", () => {
		it("deletes resource successfully", async () => {
			// Mock: verify resource belongs to team
			mockDb.setMockReturnValue([
				{
					resourceId: "eres-1",
					eventId: "event-1",
					ownerTeamId: "team-1",
				},
			])

			const result = await deleteEventResourceFn({
				data: {
					resourceId: "eres-1",
					teamId: "team-1",
				},
			})

			expect(result.success).toBe(true)
			expect(mockDb.delete).toHaveBeenCalled()
		})

		it("throws when resource does not belong to team", async () => {
			// Mock: resource not found
			mockDb.setMockReturnValue([])

			await expect(
				deleteEventResourceFn({
					data: {
						resourceId: "eres-1",
						teamId: "team-1",
					},
				}),
			).rejects.toThrow("Resource not found or does not belong to this team")
		})
	})

	describe("reorderEventResourcesFn", () => {
		it("reorders resources successfully", async () => {
			// Mock: get existing resources for autochunk validation query
			// This uses setMockReturnValue which returns via then() when awaited
			const existingResources = [
				{ id: "eres-1" },
				{ id: "eres-2" },
				{ id: "eres-3" },
			]
			mockDb.setMockReturnValue(existingResources)

			// Mock: verify event belongs to team (uses .limit(1) at end)
			const limitMock = mockDb.getChainMock().limit as any
			limitMock.mockResolvedValueOnce([
				{ eventId: "event-1", ownerTeamId: "team-1" },
			])

			const result = await reorderEventResourcesFn({
				data: {
					eventId: "event-1",
					teamId: "team-1",
					updates: [
						{ resourceId: "eres-3", sortOrder: 1 },
						{ resourceId: "eres-1", sortOrder: 2 },
						{ resourceId: "eres-2", sortOrder: 3 },
					],
				},
			})

			expect(result.updateCount).toBe(3)
			expect(mockDb.update).toHaveBeenCalledTimes(3)
		})

		it("throws when event does not belong to team", async () => {
			// Mock: event not found
			mockDb.setMockReturnValue([])

			await expect(
				reorderEventResourcesFn({
					data: {
						eventId: "event-1",
						teamId: "team-1",
						updates: [{ resourceId: "eres-1", sortOrder: 1 }],
					},
				}),
			).rejects.toThrow("Event not found or does not belong to this team")
		})
	})
})
