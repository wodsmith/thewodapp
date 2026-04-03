import { beforeEach, describe, expect, it, vi } from "vitest"
import { FakeDrizzleDb } from "@repo/test-utils"

// Mock database
const mockDb = new FakeDrizzleDb()
vi.mock("@/db", () => ({
	getDb: vi.fn(() => mockDb),
}))

// Mock logging
vi.mock("@/lib/logging", () => ({
	logInfo: vi.fn(),
	logError: vi.fn(),
	logEntityCreated: vi.fn(),
	updateRequestContext: vi.fn(),
	addRequestContextAttribute: vi.fn(),
}))

// Mock entitlements
const mockGetTeamLimit = vi.fn()
vi.mock("@/server/entitlements", () => ({
	getTeamLimit: (...args: unknown[]) => mockGetTeamLimit(...args),
}))

// Mock auth
const mockGetSessionFromCookie = vi.fn()
vi.mock("@/utils/auth", () => ({
	getSessionFromCookie: () => mockGetSessionFromCookie(),
}))

// Mock team permission
const mockRequireTeamPermission = vi.fn()
vi.mock("@/server-fns/requireTeamMembership", () => ({
	requireTeamPermission: (...args: unknown[]) =>
		mockRequireTeamPermission(...args),
	isSiteAdmin: vi.fn().mockResolvedValue(false),
}))

// Mock react-email render
vi.mock("@react-email/render", () => ({
	render: vi.fn().mockResolvedValue("<html>test</html>"),
}))

// Mock broadcast notification email
vi.mock("@/react-email/broadcast-notification", () => ({
	BroadcastNotificationEmail: vi.fn(() => "mock-email"),
}))

// Mock broadcast queue consumer
vi.mock("@/server/broadcast-queue-consumer", () => ({}))

// Mock TanStack createServerFn
vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		handler: (fn: any) => fn,
		inputValidator: () => ({
			handler: (fn: any) => fn,
		}),
	}),
}))

// Mock cloudflare:workers
vi.mock("cloudflare:workers", () => ({
	env: {},
}))

import { sendBroadcastFn, listBroadcastsFn } from "@/server-fns/broadcast-fns"

// Cast server functions to callable form
const sendBroadcast = sendBroadcastFn as unknown as (args: {
	data: any
}) => Promise<any>
const listBroadcasts = listBroadcastsFn as unknown as (args: {
	data: any
}) => Promise<any>

const mockSession = {
	userId: "user-organizer",
	user: { id: "user-organizer", email: "organizer@test.com" },
}

const mockCompetition = {
	id: "comp-1",
	organizingTeamId: "team-1",
	competitionTeamId: "team-comp-1",
	name: "Test Competition",
	slug: "test-competition",
}

describe("Broadcast Limit Enforcement", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockDb.reset()
		mockDb.registerTable("competitionsTable")
		mockDb.registerTable("competitionBroadcastsTable")
		mockGetSessionFromCookie.mockResolvedValue(mockSession)
		mockRequireTeamPermission.mockResolvedValue(undefined)
	})

	describe("sendBroadcastFn", () => {
		it("should reject when broadcast limit is reached", async () => {
			// ARRANGE: Competition exists, limit is 5, already sent 5
			mockDb.queueMockSingleValues([mockCompetition])
			mockGetTeamLimit.mockResolvedValue(5)
			// select().from().where() returns count of 5
			mockDb.setMockReturnValue([{ count: 5 }])

			// ACT & ASSERT
			await expect(
				sendBroadcast({
					data: {
						competitionId: "comp-1",
						title: "Test Broadcast",
						body: "Test body",
					},
				}),
			).rejects.toThrow("Broadcast limit reached")
		})

		it("should allow sending when under the limit", async () => {
			// ARRANGE: Competition exists, limit is 5, already sent 3
			mockDb.queueMockSingleValues([mockCompetition])
			mockGetTeamLimit.mockResolvedValue(5)
			// Count query returns 3, then recipients query returns empty
			mockDb.setMockReturnValue([{ count: 3 }])

			// ACT & ASSERT: Should get past limit check (not throw "Broadcast limit reached")
			// It will fail later in the function since we haven't mocked the full recipient flow
			const error = await sendBroadcast({
				data: {
					competitionId: "comp-1",
					title: "Test Broadcast",
					body: "Test body",
				},
			}).catch((e: Error) => e)

			expect(error).toBeInstanceOf(Error)
			expect((error as Error).message).not.toContain("Broadcast limit reached")
		})

		it("should skip limit check when limit is -1 (unlimited)", async () => {
			// ARRANGE: Competition exists, limit is unlimited
			mockDb.queueMockSingleValues([mockCompetition])
			mockGetTeamLimit.mockResolvedValue(-1)
			// No count query should happen, goes straight to recipients
			mockDb.setMockReturnValue([])

			// ACT & ASSERT: Should get past limit, fail on no recipients
			await expect(
				sendBroadcast({
					data: {
						competitionId: "comp-1",
						title: "Test Broadcast",
						body: "Test body",
					},
				}),
			).rejects.toThrow("No recipients match the selected filter")
		})

		it("should reject when limit is 0 (blocked)", async () => {
			// ARRANGE: Competition exists, limit is 0
			mockDb.queueMockSingleValues([mockCompetition])
			mockGetTeamLimit.mockResolvedValue(0)
			mockDb.setMockReturnValue([{ count: 0 }])

			// ACT & ASSERT
			await expect(
				sendBroadcast({
					data: {
						competitionId: "comp-1",
						title: "Test Broadcast",
						body: "Test body",
					},
				}),
			).rejects.toThrow("Broadcast limit reached")
		})
	})

	describe("listBroadcastsFn", () => {
		it("should return broadcast limit and usage data", async () => {
			// ARRANGE
			mockDb.queueMockSingleValues([mockCompetition])
			mockGetTeamLimit.mockResolvedValue(5)
			mockDb.setMockReturnValue([])

			// ACT
			const result = await listBroadcasts({
				data: { competitionId: "comp-1" },
			})

			// ASSERT
			expect(result.broadcastLimit).toBe(5)
			expect(result.broadcastCount).toBe(0)
			expect(result.broadcastsRemaining).toBe(5)
		})

		it("should return null for broadcastsRemaining when unlimited", async () => {
			// ARRANGE
			mockDb.queueMockSingleValues([mockCompetition])
			mockGetTeamLimit.mockResolvedValue(-1)
			mockDb.setMockReturnValue([])

			// ACT
			const result = await listBroadcasts({
				data: { competitionId: "comp-1" },
			})

			// ASSERT
			expect(result.broadcastLimit).toBe(-1)
			expect(result.broadcastsRemaining).toBeNull()
		})
	})
})
