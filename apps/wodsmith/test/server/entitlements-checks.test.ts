/**
 * Entitlement Checking Logic Unit Tests
 *
 * Tests the three entitlement states for competition hosting:
 * 1. No entitlement - team lacks HOST_COMPETITIONS feature
 * 2. Pending - has HOST_COMPETITIONS but MAX_PUBLISHED_COMPETITIONS = 0
 * 3. Approved - has HOST_COMPETITIONS and MAX_PUBLISHED_COMPETITIONS = -1 (unlimited)
 *
 * These are characterization tests documenting existing behavior for TDD migration.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { FEATURES } from "@/config/features"
import { LIMITS } from "@/config/limits"

// Mock dependencies
vi.mock("@/db", () => ({
	getDb: vi.fn(),
}))

vi.mock("@/lib/logging/posthog-otel-logger", () => ({
	logInfo: vi.fn(),
	logWarning: vi.fn(),
}))

vi.mock("@/utils/auth", () => ({
	getSessionFromCookie: vi.fn(),
}))

import { getDb } from "@/db"
import { getSessionFromCookie } from "@/utils/auth"
import { logInfo } from "@/lib/logging/posthog-otel-logger"

// Import functions under test
import { hasFeature, getTeamLimit, getTeamPlan } from "@/server/entitlements"
import { isTeamPendingOrganizer } from "@/server/organizer-pending"
import { getUserOrganizingTeams } from "@/utils/get-user-organizing-teams"

describe("Entitlement Checking Logic", () => {
	const mockTeamId = "team-123"
	const mockUserId = "user-456"

	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("hasFeature", () => {
		describe("when team has no HOST_COMPETITIONS feature", () => {
			it("should return false", async () => {
				// ARRANGE: Mock team plan with no HOST_COMPETITIONS feature
				const mockDb = {
					query: {
						teamTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: mockTeamId,
								currentPlanId: "free",
							}),
						},
						planTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: "free",
								name: "Free",
							}),
						},
						teamEntitlementOverrideTable: {
							findFirst: vi.fn().mockResolvedValue(null),
						},
					},
					select: vi.fn().mockReturnValue({
						from: vi.fn().mockReturnValue({
							innerJoin: vi.fn().mockReturnValue({
								where: vi.fn().mockResolvedValue([]),
							}),
						}),
					}),
				}
				vi.mocked(getDb).mockReturnValue(mockDb as any)

				// ACT
				const result = await hasFeature(mockTeamId, FEATURES.HOST_COMPETITIONS)

				// ASSERT
				expect(result).toBe(false)
			})
		})

		describe("when team has HOST_COMPETITIONS feature", () => {
			it("should return true", async () => {
				// ARRANGE: Mock team plan with HOST_COMPETITIONS feature
				const mockDb = {
					query: {
						teamTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: mockTeamId,
								currentPlanId: "organizer",
							}),
						},
						planTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: "organizer",
								name: "Organizer",
							}),
						},
						teamEntitlementOverrideTable: {
							findFirst: vi.fn().mockResolvedValue(null),
						},
					},
					select: vi.fn().mockReturnValue({
						from: vi.fn().mockReturnValue({
							innerJoin: vi.fn().mockReturnValue({
								where: vi.fn().mockResolvedValue([
									{ featureKey: FEATURES.HOST_COMPETITIONS },
								]),
							}),
						}),
					}),
				}
				vi.mocked(getDb).mockReturnValue(mockDb as any)

				// ACT
				const result = await hasFeature(mockTeamId, FEATURES.HOST_COMPETITIONS)

				// ASSERT
				expect(result).toBe(true)
			})
		})

		describe("when team has feature override", () => {
			it("should respect override over plan entitlements", async () => {
				// ARRANGE: Team plan has no feature, but override grants it
				const mockDb = {
					query: {
						teamTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: mockTeamId,
								currentPlanId: "free",
							}),
						},
						planTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: "free",
								name: "Free",
							}),
						},
						teamEntitlementOverrideTable: {
							findFirst: vi.fn().mockResolvedValue({
								type: "feature",
								key: FEATURES.HOST_COMPETITIONS,
								value: "true",
							}),
						},
					},
					select: vi.fn().mockReturnValue({
						from: vi.fn().mockReturnValue({
							innerJoin: vi.fn().mockReturnValue({
								where: vi.fn().mockResolvedValue([]),
							}),
						}),
					}),
				}
				vi.mocked(getDb).mockReturnValue(mockDb as any)

				// ACT
				const result = await hasFeature(mockTeamId, FEATURES.HOST_COMPETITIONS)

				// ASSERT
				expect(result).toBe(true)
			})
		})
	})

	describe("getTeamLimit", () => {
		describe("when team has limit of 0 (pending)", () => {
			it("should return 0", async () => {
				// ARRANGE: Mock team with limit override of 0
				const mockDb = {
					query: {
						teamTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: mockTeamId,
								currentPlanId: "organizer",
							}),
						},
						planTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: "organizer",
								name: "Organizer",
							}),
						},
						teamEntitlementOverrideTable: {
							findFirst: vi.fn().mockResolvedValue({
								type: "limit",
								key: LIMITS.MAX_PUBLISHED_COMPETITIONS,
								value: "0",
							}),
						},
					},
					select: vi.fn().mockReturnValue({
						from: vi.fn().mockReturnValue({
							innerJoin: vi.fn().mockReturnValue({
								where: vi.fn().mockResolvedValue([]),
							}),
						}),
					}),
				}
				vi.mocked(getDb).mockReturnValue(mockDb as any)

				// ACT
				const result = await getTeamLimit(
					mockTeamId,
					LIMITS.MAX_PUBLISHED_COMPETITIONS,
				)

				// ASSERT
				expect(result).toBe(0)
			})
		})

		describe("when team has limit of -1 (approved/unlimited)", () => {
			it("should return -1", async () => {
				// ARRANGE: Mock team with limit override of -1
				const mockDb = {
					query: {
						teamTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: mockTeamId,
								currentPlanId: "organizer",
							}),
						},
						planTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: "organizer",
								name: "Organizer",
							}),
						},
						teamEntitlementOverrideTable: {
							findFirst: vi.fn().mockResolvedValue({
								type: "limit",
								key: LIMITS.MAX_PUBLISHED_COMPETITIONS,
								value: "-1",
							}),
						},
					},
					select: vi.fn().mockReturnValue({
						from: vi.fn().mockReturnValue({
							innerJoin: vi.fn().mockReturnValue({
								where: vi.fn().mockResolvedValue([]),
							}),
						}),
					}),
				}
				vi.mocked(getDb).mockReturnValue(mockDb as any)

				// ACT
				const result = await getTeamLimit(
					mockTeamId,
					LIMITS.MAX_PUBLISHED_COMPETITIONS,
				)

				// ASSERT
				expect(result).toBe(-1)
			})
		})

		describe("when team has no override but plan has limit", () => {
			it("should return plan limit from snapshotted entitlements", async () => {
				// ARRANGE: No override, but plan has limit in snapshot
				const mockDb = {
					query: {
						teamTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: mockTeamId,
								currentPlanId: "organizer",
							}),
						},
						planTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: "organizer",
								name: "Organizer",
							}),
						},
						teamEntitlementOverrideTable: {
							findFirst: vi.fn().mockResolvedValue(null),
						},
					},
					select: vi.fn().mockImplementation(() => ({
						from: vi.fn().mockImplementation(() => ({
							innerJoin: vi.fn().mockImplementation(() => ({
								where: vi.fn().mockImplementation(() =>
									Promise.resolve([
										{
											limitKey: LIMITS.MAX_PUBLISHED_COMPETITIONS,
											value: 5,
										},
									]),
								),
							})),
						})),
					})),
				}
				vi.mocked(getDb).mockReturnValue(mockDb as any)

				// ACT
				const result = await getTeamLimit(
					mockTeamId,
					LIMITS.MAX_PUBLISHED_COMPETITIONS,
				)

				// ASSERT
				expect(result).toBe(5)
			})
		})
	})

	describe("isTeamPendingOrganizer", () => {
		describe("when team has MAX_PUBLISHED_COMPETITIONS = 0", () => {
			it("should return true (pending status)", async () => {
				// ARRANGE: Mock getTeamLimit to return 0
				const mockDb = {
					query: {
						teamTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: mockTeamId,
								currentPlanId: "organizer",
							}),
						},
						planTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: "organizer",
								name: "Organizer",
							}),
						},
						teamEntitlementOverrideTable: {
							findFirst: vi.fn().mockResolvedValue({
								type: "limit",
								key: LIMITS.MAX_PUBLISHED_COMPETITIONS,
								value: "0",
							}),
						},
					},
					select: vi.fn().mockReturnValue({
						from: vi.fn().mockReturnValue({
							innerJoin: vi.fn().mockReturnValue({
								where: vi.fn().mockResolvedValue([]),
							}),
						}),
					}),
				}
				vi.mocked(getDb).mockReturnValue(mockDb as any)

				// ACT
				const result = await isTeamPendingOrganizer(mockTeamId)

				// ASSERT
				expect(result).toBe(true)
				expect(logInfo).toHaveBeenCalledWith({
					message: "[organizer-pending] checked team pending status",
					attributes: {
						teamId: mockTeamId,
						limit: 0,
						isPending: true,
					},
				})
			})
		})

		describe("when team has MAX_PUBLISHED_COMPETITIONS = -1", () => {
			it("should return false (approved status)", async () => {
				// ARRANGE: Mock getTeamLimit to return -1
				const mockDb = {
					query: {
						teamTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: mockTeamId,
								currentPlanId: "organizer",
							}),
						},
						planTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: "organizer",
								name: "Organizer",
							}),
						},
						teamEntitlementOverrideTable: {
							findFirst: vi.fn().mockResolvedValue({
								type: "limit",
								key: LIMITS.MAX_PUBLISHED_COMPETITIONS,
								value: "-1",
							}),
						},
					},
					select: vi.fn().mockReturnValue({
						from: vi.fn().mockReturnValue({
							innerJoin: vi.fn().mockReturnValue({
								where: vi.fn().mockResolvedValue([]),
							}),
						}),
					}),
				}
				vi.mocked(getDb).mockReturnValue(mockDb as any)

				// ACT
				const result = await isTeamPendingOrganizer(mockTeamId)

				// ASSERT
				expect(result).toBe(false)
				expect(logInfo).toHaveBeenCalledWith({
					message: "[organizer-pending] checked team pending status",
					attributes: {
						teamId: mockTeamId,
						limit: -1,
						isPending: false,
					},
				})
			})
		})

		describe("when team has MAX_PUBLISHED_COMPETITIONS > 0", () => {
			it("should return false (positive limit means approved)", async () => {
				// ARRANGE: Mock getTeamLimit to return positive number
				const mockDb = {
					query: {
						teamTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: mockTeamId,
								currentPlanId: "organizer",
							}),
						},
						planTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: "organizer",
								name: "Organizer",
							}),
						},
						teamEntitlementOverrideTable: {
							findFirst: vi.fn().mockResolvedValue({
								type: "limit",
								key: LIMITS.MAX_PUBLISHED_COMPETITIONS,
								value: "5",
							}),
						},
					},
					select: vi.fn().mockReturnValue({
						from: vi.fn().mockReturnValue({
							innerJoin: vi.fn().mockReturnValue({
								where: vi.fn().mockResolvedValue([]),
							}),
						}),
					}),
				}
				vi.mocked(getDb).mockReturnValue(mockDb as any)

				// ACT
				const result = await isTeamPendingOrganizer(mockTeamId)

				// ASSERT
				expect(result).toBe(false)
			})
		})
	})

	describe("getUserOrganizingTeams", () => {
		describe("when user has no session", () => {
			it("should return empty array", async () => {
				// ARRANGE
				vi.mocked(getSessionFromCookie).mockResolvedValue(null)

				// ACT
				const result = await getUserOrganizingTeams()

				// ASSERT
				expect(result).toEqual([])
			})
		})

		describe("when user has teams but none with MANAGE_PROGRAMMING permission", () => {
			it("should return empty array", async () => {
				// ARRANGE
				vi.mocked(getSessionFromCookie).mockResolvedValue({
					user: { id: mockUserId },
					teams: [
						{
							id: mockTeamId,
							name: "Test Team",
							slug: "test-team",
							type: "gym",
							permissions: ["view_workouts"], // No MANAGE_PROGRAMMING
						},
					],
				} as any)

				// ACT
				const result = await getUserOrganizingTeams()

				// ASSERT
				expect(result).toEqual([])
			})
		})

		describe("when user has team with MANAGE_PROGRAMMING but no HOST_COMPETITIONS feature", () => {
			it("should return empty array (no entitlement case)", async () => {
				// ARRANGE
				vi.mocked(getSessionFromCookie).mockResolvedValue({
					user: { id: mockUserId },
					teams: [
						{
							id: mockTeamId,
							name: "Test Team",
							slug: "test-team",
							type: "gym",
							permissions: ["manage_programming"],
						},
					],
				} as any)

				// Mock hasFeature to return false
				const mockDb = {
					query: {
						teamTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: mockTeamId,
								currentPlanId: "free",
							}),
						},
						planTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: "free",
								name: "Free",
							}),
						},
						teamEntitlementOverrideTable: {
							findFirst: vi.fn().mockResolvedValue(null),
						},
					},
					select: vi.fn().mockReturnValue({
						from: vi.fn().mockReturnValue({
							innerJoin: vi.fn().mockReturnValue({
								where: vi.fn().mockResolvedValue([]),
							}),
						}),
					}),
				}
				vi.mocked(getDb).mockReturnValue(mockDb as any)

				// ACT
				const result = await getUserOrganizingTeams()

				// ASSERT - Team excluded because it lacks HOST_COMPETITIONS
				expect(result).toEqual([])
			})
		})

		describe("when user has team with MANAGE_PROGRAMMING and HOST_COMPETITIONS feature", () => {
			it("should return team in organizing teams list", async () => {
				// ARRANGE
				vi.mocked(getSessionFromCookie).mockResolvedValue({
					user: { id: mockUserId },
					teams: [
						{
							id: mockTeamId,
							name: "Organizer Team",
							slug: "organizer-team",
							type: "organizer",
							permissions: ["manage_programming"],
						},
					],
				} as any)

				// Mock hasFeature to return true
				const mockDb = {
					query: {
						teamTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: mockTeamId,
								currentPlanId: "organizer",
							}),
						},
						planTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: "organizer",
								name: "Organizer",
							}),
						},
						teamEntitlementOverrideTable: {
							findFirst: vi.fn().mockResolvedValue(null),
						},
					},
					select: vi.fn().mockReturnValue({
						from: vi.fn().mockReturnValue({
							innerJoin: vi.fn().mockReturnValue({
								where: vi.fn().mockResolvedValue([
									{ featureKey: FEATURES.HOST_COMPETITIONS },
								]),
							}),
						}),
					}),
				}
				vi.mocked(getDb).mockReturnValue(mockDb as any)

				// ACT
				const result = await getUserOrganizingTeams()

				// ASSERT - Team included because it has HOST_COMPETITIONS
				expect(result).toEqual([
					{
						id: mockTeamId,
						name: "Organizer Team",
						slug: "organizer-team",
						type: "organizer",
					},
				])
			})
		})
	})

	describe("Three Entitlement States Integration", () => {
		/**
		 * State 1: NO ENTITLEMENT
		 * - Team lacks HOST_COMPETITIONS feature entirely
		 * - getUserOrganizingTeams() excludes the team
		 * - This is the "redirect" signal - user cannot access compete features
		 */
		describe("State 1: No Entitlement (redirect signal)", () => {
			it("should exclude team from organizing teams when no HOST_COMPETITIONS feature", async () => {
				// ARRANGE
				vi.mocked(getSessionFromCookie).mockResolvedValue({
					user: { id: mockUserId },
					teams: [
						{
							id: mockTeamId,
							name: "Regular Gym",
							slug: "regular-gym",
							type: "gym",
							permissions: ["manage_programming"],
						},
					],
				} as any)

				const mockDb = {
					query: {
						teamTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: mockTeamId,
								currentPlanId: "free",
							}),
						},
						planTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: "free",
								name: "Free",
							}),
						},
						teamEntitlementOverrideTable: {
							findFirst: vi.fn().mockResolvedValue(null),
						},
					},
					select: vi.fn().mockReturnValue({
						from: vi.fn().mockReturnValue({
							innerJoin: vi.fn().mockReturnValue({
								where: vi.fn().mockResolvedValue([]), // No features
							}),
						}),
					}),
				}
				vi.mocked(getDb).mockReturnValue(mockDb as any)

				// ACT
				const organizingTeams = await getUserOrganizingTeams()

				// ASSERT - redirect signal: team not in list
				expect(organizingTeams).toEqual([])
			})

			it("should return false from hasFeature when team lacks HOST_COMPETITIONS", async () => {
				// ARRANGE: Team without HOST_COMPETITIONS feature
				const mockDb = {
					query: {
						teamTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: mockTeamId,
								currentPlanId: "free",
							}),
						},
						planTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: "free",
								name: "Free",
							}),
						},
						teamEntitlementOverrideTable: {
							findFirst: vi.fn().mockResolvedValue(null),
						},
					},
					select: vi.fn().mockReturnValue({
						from: vi.fn().mockReturnValue({
							innerJoin: vi.fn().mockReturnValue({
								where: vi.fn().mockResolvedValue([]), // No features
							}),
						}),
					}),
				}
				vi.mocked(getDb).mockReturnValue(mockDb as any)

				// ACT
				const hasHostFeature = await hasFeature(
					mockTeamId,
					FEATURES.HOST_COMPETITIONS,
				)

				// ASSERT
				expect(hasHostFeature).toBe(false)
			})
		})

		/**
		 * State 2: PENDING APPROVAL
		 * - Team has HOST_COMPETITIONS feature
		 * - MAX_PUBLISHED_COMPETITIONS = 0
		 * - isTeamPendingOrganizer() returns true
		 * - This is the "private-only + banner" signal
		 *
		 * NOTE: These tests verify each signal independently because the mocking
		 * of multiple function calls with shared DB mocks is complex.
		 */
		describe("State 2: Pending Approval (private-only + banner signal)", () => {
			it("should return true from isTeamPendingOrganizer when limit is 0", async () => {
				// ARRANGE: Team with limit = 0 (pending)
				const mockDb = {
					query: {
						teamTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: mockTeamId,
								currentPlanId: "organizer",
							}),
						},
						planTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: "organizer",
								name: "Organizer",
							}),
						},
						teamEntitlementOverrideTable: {
							findFirst: vi.fn().mockResolvedValue({
								type: "limit",
								key: LIMITS.MAX_PUBLISHED_COMPETITIONS,
								value: "0",
							}),
						},
					},
					select: vi.fn().mockReturnValue({
						from: vi.fn().mockReturnValue({
							innerJoin: vi.fn().mockReturnValue({
								where: vi.fn().mockResolvedValue([]),
							}),
						}),
					}),
				}
				vi.mocked(getDb).mockReturnValue(mockDb as any)

				// ACT
				const isPending = await isTeamPendingOrganizer(mockTeamId)

				// ASSERT - pending signal (limit = 0)
				expect(isPending).toBe(true)
			})

			it("should return true from hasFeature when team has HOST_COMPETITIONS in snapshot", async () => {
				// ARRANGE: Team with HOST_COMPETITIONS feature in snapshot
				const mockDb = {
					query: {
						teamTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: mockTeamId,
								currentPlanId: "organizer",
							}),
						},
						planTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: "organizer",
								name: "Organizer",
							}),
						},
						teamEntitlementOverrideTable: {
							findFirst: vi.fn().mockResolvedValue(null),
						},
					},
					select: vi.fn().mockReturnValue({
						from: vi.fn().mockReturnValue({
							innerJoin: vi.fn().mockReturnValue({
								where: vi.fn().mockResolvedValue([
									{ featureKey: FEATURES.HOST_COMPETITIONS },
								]),
							}),
						}),
					}),
				}
				vi.mocked(getDb).mockReturnValue(mockDb as any)

				// ACT
				const hasHostFeature = await hasFeature(
					mockTeamId,
					FEATURES.HOST_COMPETITIONS,
				)

				// ASSERT - has feature signal
				expect(hasHostFeature).toBe(true)
			})
		})

		/**
		 * State 3: APPROVED
		 * - Team has HOST_COMPETITIONS feature
		 * - MAX_PUBLISHED_COMPETITIONS = -1 (unlimited)
		 * - isTeamPendingOrganizer() returns false
		 * - This is the "full access" signal
		 */
		describe("State 3: Approved (full access signal)", () => {
			it("should return false from isTeamPendingOrganizer when limit is -1", async () => {
				// ARRANGE: Team with limit = -1 (approved/unlimited)
				const mockDb = {
					query: {
						teamTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: mockTeamId,
								currentPlanId: "organizer",
							}),
						},
						planTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: "organizer",
								name: "Organizer",
							}),
						},
						teamEntitlementOverrideTable: {
							findFirst: vi.fn().mockResolvedValue({
								type: "limit",
								key: LIMITS.MAX_PUBLISHED_COMPETITIONS,
								value: "-1",
							}),
						},
					},
					select: vi.fn().mockReturnValue({
						from: vi.fn().mockReturnValue({
							innerJoin: vi.fn().mockReturnValue({
								where: vi.fn().mockResolvedValue([]),
							}),
						}),
					}),
				}
				vi.mocked(getDb).mockReturnValue(mockDb as any)

				// ACT
				const isPending = await isTeamPendingOrganizer(mockTeamId)

				// ASSERT - not pending signal (approved)
				expect(isPending).toBe(false)
			})

			it("should return -1 from getTeamLimit when approved (unlimited)", async () => {
				// ARRANGE: Team with limit = -1
				const mockDb = {
					query: {
						teamTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: mockTeamId,
								currentPlanId: "organizer",
							}),
						},
						planTable: {
							findFirst: vi.fn().mockResolvedValue({
								id: "organizer",
								name: "Organizer",
							}),
						},
						teamEntitlementOverrideTable: {
							findFirst: vi.fn().mockResolvedValue({
								type: "limit",
								key: LIMITS.MAX_PUBLISHED_COMPETITIONS,
								value: "-1",
							}),
						},
					},
					select: vi.fn().mockReturnValue({
						from: vi.fn().mockReturnValue({
							innerJoin: vi.fn().mockReturnValue({
								where: vi.fn().mockResolvedValue([]),
							}),
						}),
					}),
				}
				vi.mocked(getDb).mockReturnValue(mockDb as any)

				// ACT
				const limit = await getTeamLimit(
					mockTeamId,
					LIMITS.MAX_PUBLISHED_COMPETITIONS,
				)

				// ASSERT - unlimited signal
				expect(limit).toBe(-1)
			})
		})
	})
})
