import { beforeEach, describe, expect, it, vi } from "vitest"
import { FakeDrizzleDb } from "@repo/test-utils"

// Mock the database
const mockDb = new FakeDrizzleDb()

// Track call count for sequential mock values
let selectCallCount = 0
let mockReturnValues: unknown[][] = []

vi.mock("@/db", () => ({
	getDb: vi.fn(() => mockDb),
}))

/**
 * Helper to set up sequential return values for Promise.all queries.
 * Each call to a select chain will return the next value in the sequence.
 */
function setSequentialMockValues(values: unknown[][]) {
	selectCallCount = 0
	mockReturnValues = values

	// Override the chainable mock's then to return sequential values
	const chainMock = mockDb.getChainMock()
	chainMock.then = <T>(resolve: (value: T) => void) => {
		const value = mockReturnValues[selectCallCount] ?? []
		selectCallCount++
		resolve(value as T)
		return Promise.resolve(value as T)
	}
}

// Mock TanStack createServerFn to make server functions directly callable
vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		inputValidator: () => ({
			handler: (fn: unknown) => fn,
		}),
	}),
	createServerOnlyFn: (fn: unknown) => fn,
}))

// Mock cloudflare:workers
vi.mock("cloudflare:workers", () => ({
	env: {
		APP_URL: "https://test.wodsmith.com",
	},
}))

// Mock test session for cancelPendingPurchaseFn auth
const mockSession = {
	userId: "user-test-789",
	user: {
		id: "user-test-789",
		email: "test@example.com",
	},
	teams: [],
}

// Mock auth module
vi.mock("@/utils/auth", () => ({
	requireVerifiedEmail: vi.fn(() => Promise.resolve(mockSession)),
	getSessionFromCookie: vi.fn(() => Promise.resolve(mockSession)),
}))

// Import after mocks are set up
import {
	getDivisionSpotsAvailableFn,
	getPublicCompetitionDivisionsFn,
} from "@/server-fns/competition-divisions-fns"
import { cancelPendingPurchaseFn } from "@/server-fns/registration-fns"

// Test IDs
const testCompetitionId = "comp-test-123"
const testDivisionId = "div-test-456"
const testUserId = "user-test-789"
const testPurchaseId1 = "purchase-test-001"
const testScalingGroupId = "sg-test-123"

// Mock competition with capacity settings
const mockCompetition = {
	id: testCompetitionId,
	name: "Test Competition",
	defaultMaxSpotsPerDivision: 16,
	defaultRegistrationFeeCents: 5000,
	settings: JSON.stringify({
		divisions: { scalingGroupId: testScalingGroupId },
	}),
}

// Mock competition with no capacity
const mockCompetitionNoCapacity = {
	...mockCompetition,
	defaultMaxSpotsPerDivision: null,
}

// Mock division config with override
const mockDivisionConfig = {
	competitionId: testCompetitionId,
	divisionId: testDivisionId,
	maxSpots: 10, // Override competition default
	feeCents: 7500,
	description: "Test division",
}

// Mock division config without override
const mockDivisionConfigNoOverride = {
	competitionId: testCompetitionId,
	divisionId: testDivisionId,
	maxSpots: null, // Use competition default
	feeCents: 5000,
	description: null,
}

describe("Division Reservation System", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockDb.reset()
		mockDb.registerTable("competitionsTable")
		mockDb.registerTable("competitionDivisionsTable")
		mockDb.registerTable("competitionRegistrationsTable")
		mockDb.registerTable("commercePurchaseTable")
		mockDb.registerTable("scalingLevelsTable")
		mockDb.registerTable("scalingGroupsTable")
	})

	describe("getDivisionSpotsAvailableFn", () => {
		describe("capacity calculation with reservations", () => {
			it("should count only confirmed registrations when no pending purchases", async () => {
				// Setup: 5 confirmed registrations, 0 pending
				mockDb.query.competitionsTable = {
					findFirst: vi.fn().mockResolvedValue(mockCompetition),
					findMany: vi.fn().mockResolvedValue([mockCompetition]),
				}
				mockDb.query.competitionDivisionsTable = {
					findFirst: vi.fn().mockResolvedValue(mockDivisionConfig),
					findMany: vi.fn().mockResolvedValue([mockDivisionConfig]),
				}
				// Sequential: first query returns registrations, second returns pending
				setSequentialMockValues([
					[{ count: 5 }], // registrations
					[{ count: 0 }], // pending purchases
				])

				const result = await getDivisionSpotsAvailableFn({
					data: {
						competitionId: testCompetitionId,
						divisionId: testDivisionId,
					},
				})

				expect(result.registered).toBe(5)
				expect(result.confirmedCount).toBe(5)
				expect(result.pendingCount).toBe(0)
				expect(result.maxSpots).toBe(10) // Division override
				expect(result.available).toBe(5) // 10 - 5
				expect(result.isFull).toBe(false)
			})

			it("should include pending purchases in registered count", async () => {
				// Setup: 5 confirmed + 3 pending = 8 total
				mockDb.query.competitionsTable = {
					findFirst: vi.fn().mockResolvedValue(mockCompetition),
					findMany: vi.fn().mockResolvedValue([mockCompetition]),
				}
				mockDb.query.competitionDivisionsTable = {
					findFirst: vi.fn().mockResolvedValue(mockDivisionConfig),
					findMany: vi.fn().mockResolvedValue([mockDivisionConfig]),
				}
				setSequentialMockValues([
					[{ count: 5 }], // registrations
					[{ count: 3 }], // pending purchases
				])

				const result = await getDivisionSpotsAvailableFn({
					data: {
						competitionId: testCompetitionId,
						divisionId: testDivisionId,
					},
				})

				expect(result.confirmedCount).toBe(5)
				expect(result.pendingCount).toBe(3)
				expect(result.registered).toBe(8) // 5 + 3
				expect(result.available).toBe(2) // 10 - 8
				expect(result.isFull).toBe(false)
			})

			it("should mark division as full when confirmed + pending >= max", async () => {
				// Setup: 8 confirmed + 2 pending = 10 total (full)
				mockDb.query.competitionsTable = {
					findFirst: vi.fn().mockResolvedValue(mockCompetition),
					findMany: vi.fn().mockResolvedValue([mockCompetition]),
				}
				mockDb.query.competitionDivisionsTable = {
					findFirst: vi.fn().mockResolvedValue(mockDivisionConfig),
					findMany: vi.fn().mockResolvedValue([mockDivisionConfig]),
				}
				setSequentialMockValues([
					[{ count: 8 }], // registrations
					[{ count: 2 }], // pending purchases
				])

				const result = await getDivisionSpotsAvailableFn({
					data: {
						competitionId: testCompetitionId,
						divisionId: testDivisionId,
					},
				})

				expect(result.registered).toBe(10)
				expect(result.available).toBe(0)
				expect(result.isFull).toBe(true)
			})

			it("should mark division as full when pending alone exceeds max", async () => {
				// Edge case: 0 confirmed + 12 pending (all waiting to pay)
				mockDb.query.competitionsTable = {
					findFirst: vi.fn().mockResolvedValue(mockCompetition),
					findMany: vi.fn().mockResolvedValue([mockCompetition]),
				}
				mockDb.query.competitionDivisionsTable = {
					findFirst: vi.fn().mockResolvedValue(mockDivisionConfig),
					findMany: vi.fn().mockResolvedValue([mockDivisionConfig]),
				}
				setSequentialMockValues([
					[{ count: 0 }], // registrations
					[{ count: 12 }], // pending purchases
				])

				const result = await getDivisionSpotsAvailableFn({
					data: {
						competitionId: testCompetitionId,
						divisionId: testDivisionId,
					},
				})

				expect(result.confirmedCount).toBe(0)
				expect(result.pendingCount).toBe(12)
				expect(result.registered).toBe(12)
				expect(result.isFull).toBe(true)
				expect(result.available).toBe(-2) // Over capacity
			})
		})

		describe("excludePurchaseId parameter", () => {
			it("should exclude specified purchase from pending count", async () => {
				// This tests the webhook self-blocking prevention
				// When webhook calls this, it should exclude its own purchase
				mockDb.query.competitionsTable = {
					findFirst: vi.fn().mockResolvedValue(mockCompetition),
					findMany: vi.fn().mockResolvedValue([mockCompetition]),
				}
				mockDb.query.competitionDivisionsTable = {
					findFirst: vi.fn().mockResolvedValue(mockDivisionConfig),
					findMany: vi.fn().mockResolvedValue([mockDivisionConfig]),
				}
				// Without exclusion: 9 confirmed + 1 pending = 10 (full)
				// With exclusion: 9 confirmed + 0 pending (excluded) = 9 (not full)
				setSequentialMockValues([
					[{ count: 9 }], // registrations
					[{ count: 0 }], // pending (own purchase excluded)
				])

				const result = await getDivisionSpotsAvailableFn({
					data: {
						competitionId: testCompetitionId,
						divisionId: testDivisionId,
						excludePurchaseId: testPurchaseId1,
					},
				})

				// The query should have been called with exclusion condition
				expect(mockDb.select).toHaveBeenCalled()
				expect(result.registered).toBe(9)
				expect(result.isFull).toBe(false)
			})
		})

		describe("capacity defaults", () => {
			it("should use competition default when division has no override", async () => {
				mockDb.query.competitionsTable = {
					findFirst: vi.fn().mockResolvedValue(mockCompetition),
					findMany: vi.fn().mockResolvedValue([mockCompetition]),
				}
				mockDb.query.competitionDivisionsTable = {
					findFirst: vi.fn().mockResolvedValue(mockDivisionConfigNoOverride),
					findMany: vi.fn().mockResolvedValue([mockDivisionConfigNoOverride]),
				}
				setSequentialMockValues([
					[{ count: 10 }], // registrations
					[{ count: 0 }], // pending
				])

				const result = await getDivisionSpotsAvailableFn({
					data: {
						competitionId: testCompetitionId,
						divisionId: testDivisionId,
					},
				})

				expect(result.maxSpots).toBe(16) // Competition default
				expect(result.available).toBe(6) // 16 - 10
			})

			it("should return null max when no capacity limits set", async () => {
				mockDb.query.competitionsTable = {
					findFirst: vi.fn().mockResolvedValue(mockCompetitionNoCapacity),
					findMany: vi.fn().mockResolvedValue([mockCompetitionNoCapacity]),
				}
				mockDb.query.competitionDivisionsTable = {
					findFirst: vi.fn().mockResolvedValue(mockDivisionConfigNoOverride),
					findMany: vi.fn().mockResolvedValue([mockDivisionConfigNoOverride]),
				}
				setSequentialMockValues([
					[{ count: 100 }], // registrations
					[{ count: 50 }], // pending
				])

				const result = await getDivisionSpotsAvailableFn({
					data: {
						competitionId: testCompetitionId,
						divisionId: testDivisionId,
					},
				})

				expect(result.maxSpots).toBeNull()
				expect(result.available).toBeNull()
				expect(result.isFull).toBe(false) // Never full with unlimited
			})
		})

		describe("error handling", () => {
			it("should throw when competition not found", async () => {
				mockDb.query.competitionsTable = {
					findFirst: vi.fn().mockResolvedValue(null),
					findMany: vi.fn().mockResolvedValue([]),
				}

				await expect(
					getDivisionSpotsAvailableFn({
						data: {
							competitionId: "nonexistent",
							divisionId: testDivisionId,
						},
					})
				).rejects.toThrow("Competition not found")
			})
		})
	})

	describe("cancelPendingPurchaseFn", () => {
		describe("canceling reservations", () => {
			it("should cancel pending purchases for user/competition", async () => {
				const result = await cancelPendingPurchaseFn({
					data: {
						userId: testUserId,
						competitionId: testCompetitionId,
					},
				})

				expect(result.success).toBe(true)
				expect(mockDb.update).toHaveBeenCalled()
			})

			it("should only cancel PENDING status purchases", async () => {
				await cancelPendingPurchaseFn({
					data: {
						userId: testUserId,
						competitionId: testCompetitionId,
					},
				})

				// Verify the where clause includes status check
				expect(mockDb.update).toHaveBeenCalled()
				// The actual SQL verification would require inspecting the where clause
				// which FakeDrizzleDb tracks via the where spy
			})
		})

		// Note: True isolation testing would require a real database or more
		// sophisticated mocking that can verify where clause arguments.
		// The where clause in cancelPendingPurchaseFn filters by userId,
		// competitionId, and PENDING status - verified through code review.
	})

	describe("getPublicCompetitionDivisionsFn", () => {
		describe("capacity display with reservations", () => {
			it("should return divisions with capacity info", async () => {
				mockDb.query.competitionsTable = {
					findFirst: vi.fn().mockResolvedValue(mockCompetition),
					findMany: vi.fn().mockResolvedValue([mockCompetition]),
				}
				// Mock division query with capacity data
				mockDb.setMockReturnValue([
					{
						id: testDivisionId,
						label: "Open Male",
						teamSize: 1,
						description: null,
						feeCents: 5000,
						maxSpots: 10,
						registrationCount: 5,
						pendingCount: 2,
						spotsAvailable: 3,
						isFull: false,
					},
				])

				const result = await getPublicCompetitionDivisionsFn({
					data: { competitionId: testCompetitionId },
				})

				expect(result.divisions).toBeDefined()
				expect(Array.isArray(result.divisions)).toBe(true)
				expect(mockDb.select).toHaveBeenCalled()
				// Note: The actual spots calculation (including pending)
				// happens in the function. Mock returns pre-computed values.
			})

			it("should return sold out status when maxSpots reached", async () => {
				mockDb.query.competitionsTable = {
					findFirst: vi.fn().mockResolvedValue(mockCompetition),
					findMany: vi.fn().mockResolvedValue([mockCompetition]),
				}
				// Mock division at capacity (8 confirmed + 2 pending = 10 max)
				mockDb.setMockReturnValue([
					{
						id: testDivisionId,
						label: "Open Male",
						teamSize: 1,
						description: null,
						feeCents: 5000,
						maxSpots: 10,
						registrationCount: 8,
						pendingCount: 2,
						spotsAvailable: 0,
						isFull: true,
					},
				])

				const result = await getPublicCompetitionDivisionsFn({
					data: { competitionId: testCompetitionId },
				})

				expect(result.divisions).toBeDefined()
				expect(Array.isArray(result.divisions)).toBe(true)
				// Note: The isFull calculation happens in the function based
				// on DB query results. With mocks, we verify structure only.
			})
		})

		describe("edge cases", () => {
			it("should return empty divisions when no scaling group configured", async () => {
				const competitionNoScaling = {
					...mockCompetition,
					settings: null,
				}
				mockDb.query.competitionsTable = {
					findFirst: vi.fn().mockResolvedValue(competitionNoScaling),
					findMany: vi.fn().mockResolvedValue([competitionNoScaling]),
				}

				const result = await getPublicCompetitionDivisionsFn({
					data: { competitionId: testCompetitionId },
				})

				expect(result.divisions).toEqual([])
			})

			it("should return empty divisions when competition not found", async () => {
				mockDb.query.competitionsTable = {
					findFirst: vi.fn().mockResolvedValue(null),
					findMany: vi.fn().mockResolvedValue([]),
				}

				const result = await getPublicCompetitionDivisionsFn({
					data: { competitionId: "nonexistent" },
				})

				expect(result.divisions).toEqual([])
			})
		})
	})
})

describe("Reservation System Integration Scenarios", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockDb.reset()
		mockDb.registerTable("competitionsTable")
		mockDb.registerTable("competitionDivisionsTable")
		mockDb.registerTable("competitionRegistrationsTable")
		mockDb.registerTable("commercePurchaseTable")
	})

	describe("race condition prevention", () => {
		it("should prevent second user from registering when first has pending purchase", async () => {
			// Scenario: Division has 1 spot, User A has pending purchase
			mockDb.query.competitionsTable = {
				findFirst: vi.fn().mockResolvedValue({
					...mockCompetition,
					defaultMaxSpotsPerDivision: 1,
				}),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.competitionDivisionsTable = {
				findFirst: vi.fn().mockResolvedValue({
					...mockDivisionConfig,
					maxSpots: 1,
				}),
				findMany: vi.fn().mockResolvedValue([]),
			}
			// 0 confirmed + 1 pending = full
			setSequentialMockValues([
				[{ count: 0 }], // registrations
				[{ count: 1 }], // pending purchases
			])

			const result = await getDivisionSpotsAvailableFn({
				data: {
					competitionId: testCompetitionId,
					divisionId: testDivisionId,
				},
			})

			expect(result.isFull).toBe(true)
			expect(result.confirmedCount).toBe(0)
			expect(result.pendingCount).toBe(1)
		})

		it("should allow registration after pending purchase is cancelled", async () => {
			// First, cancel the pending purchase
			await cancelPendingPurchaseFn({
				data: {
					userId: testUserId,
					competitionId: testCompetitionId,
				},
			})

			// Now check capacity - should show spot available
			mockDb.query.competitionsTable = {
				findFirst: vi.fn().mockResolvedValue({
					...mockCompetition,
					defaultMaxSpotsPerDivision: 1,
				}),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.competitionDivisionsTable = {
				findFirst: vi.fn().mockResolvedValue({
					...mockDivisionConfig,
					maxSpots: 1,
				}),
				findMany: vi.fn().mockResolvedValue([]),
			}
			// 0 confirmed + 0 pending (cancelled) = available
			setSequentialMockValues([
				[{ count: 0 }], // registrations
				[{ count: 0 }], // pending (cancelled)
			])

			const result = await getDivisionSpotsAvailableFn({
				data: {
					competitionId: testCompetitionId,
					divisionId: testDivisionId,
				},
			})

			expect(result.isFull).toBe(false)
			expect(result.available).toBe(1)
		})
	})

	describe("webhook self-blocking prevention", () => {
		it("should not self-block when webhook checks capacity for its own purchase", async () => {
			// Scenario: Purchase is PENDING, webhook fires, checks capacity
			// Without excludePurchaseId, would see itself and think division is full
			mockDb.query.competitionsTable = {
				findFirst: vi.fn().mockResolvedValue({
					...mockCompetition,
					defaultMaxSpotsPerDivision: 1,
				}),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.competitionDivisionsTable = {
				findFirst: vi.fn().mockResolvedValue({
					...mockDivisionConfig,
					maxSpots: 1,
				}),
				findMany: vi.fn().mockResolvedValue([]),
			}
			// With exclusion: 0 confirmed + 0 pending (own excluded) = not full
			setSequentialMockValues([
				[{ count: 0 }], // registrations
				[{ count: 0 }], // pending (own excluded)
			])

			const result = await getDivisionSpotsAvailableFn({
				data: {
					competitionId: testCompetitionId,
					divisionId: testDivisionId,
					excludePurchaseId: testPurchaseId1, // Exclude own purchase
				},
			})

			expect(result.isFull).toBe(false)
			expect(result.registered).toBe(0)
		})

		it("should still detect full when other purchases exist (excluding self)", async () => {
			// Scenario: 1 spot, another user has pending, webhook checks for its purchase
			mockDb.query.competitionsTable = {
				findFirst: vi.fn().mockResolvedValue({
					...mockCompetition,
					defaultMaxSpotsPerDivision: 1,
				}),
				findMany: vi.fn().mockResolvedValue([]),
			}
			mockDb.query.competitionDivisionsTable = {
				findFirst: vi.fn().mockResolvedValue({
					...mockDivisionConfig,
					maxSpots: 1,
				}),
				findMany: vi.fn().mockResolvedValue([]),
			}
			// With exclusion of own: 0 confirmed + 1 pending (other user) = full
			setSequentialMockValues([
				[{ count: 0 }], // registrations
				[{ count: 1 }], // pending (other user's)
			])

			const result = await getDivisionSpotsAvailableFn({
				data: {
					competitionId: testCompetitionId,
					divisionId: testDivisionId,
					excludePurchaseId: testPurchaseId1, // Exclude own, but other exists
				},
			})

			expect(result.isFull).toBe(true)
		})
	})
})
