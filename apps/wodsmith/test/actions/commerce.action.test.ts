import { beforeEach, afterEach, describe, it, expect, vi } from "vitest"
import { createTestSession } from "@repo/test-utils/factories"
import { TEAM_PERMISSIONS } from "@/db/schema"
import type { SessionWithMeta } from "@/types"

// Import the actions under test
import {
	getCompetitionDivisionFees,
	getRegistrationFeeBreakdown,
	updateCompetitionFeeConfig,
	updateDivisionFee,
} from "@/actions/commerce.action"

// Mock dependencies
vi.mock("@/utils/auth", () => ({
	requireVerifiedEmail: vi.fn(),
}))

vi.mock("@/utils/team-auth", () => ({
	requireTeamPermission: vi.fn(),
}))

vi.mock("@/utils/with-rate-limit", () => ({
	withRateLimit: vi.fn(
		async (action: () => Promise<unknown>) => await action(),
	),
	RATE_LIMITS: {
		SETTINGS: {
			identifier: "settings",
			limit: 15,
			windowInSeconds: 300,
		},
		PURCHASE: {
			identifier: "purchase",
			limit: 25,
			windowInSeconds: 300,
		},
	},
}))

vi.mock("@/server/commerce", () => ({
	buildFeeConfig: vi.fn(),
	calculateCompetitionFees: vi.fn(),
	getRegistrationFee: vi.fn(),
}))

vi.mock("@/db", () => ({
	getDb: vi.fn(),
}))

// Create mock session with organizer permissions
const mockSession: SessionWithMeta = createTestSession({
	userId: "user-123",
	teamId: "team-123",
	teamSlug: "test-team",
	teamRole: "owner",
	permissions: [
		TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		TEAM_PERMISSIONS.ACCESS_DASHBOARD,
	],
})

// Test data
const testCompetitionId = "comp-123"
const testDivisionId = "div-456"
const testOrganizingTeamId = "team-123"

// Mock competition object
const mockCompetition = {
	id: testCompetitionId,
	name: "Test Competition",
	organizingTeamId: testOrganizingTeamId,
	defaultRegistrationFeeCents: 5000,
	platformFeePercentage: null,
	platformFeeFixed: null,
	passStripeFeesToCustomer: false,
	passPlatformFeesToCustomer: true,
}

// Mock division fees
const mockDivisionFees = [
	{
		divisionId: "div-1",
		feeCents: 4000,
		division: { label: "Rx" },
	},
	{
		divisionId: "div-2",
		feeCents: 3500,
		division: { label: "Scaled" },
	},
]

beforeEach(async () => {
	vi.clearAllMocks()

	// Setup default mocks
	const { requireVerifiedEmail } = await import("@/utils/auth")
	vi.mocked(requireVerifiedEmail).mockResolvedValue(mockSession)

	const { requireTeamPermission } = await import("@/utils/team-auth")
	vi.mocked(requireTeamPermission).mockResolvedValue(undefined)

	const { getDb } = await import("@/db")
	vi.mocked(getDb).mockReturnValue({
		query: {
			competitionsTable: {
				findFirst: vi.fn().mockResolvedValue(mockCompetition),
			},
			competitionDivisionsTable: {
				findMany: vi.fn().mockResolvedValue(mockDivisionFees),
				findFirst: vi.fn().mockResolvedValue(null),
			},
		},
		update: vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(undefined),
			}),
		}),
		insert: vi.fn().mockReturnValue({
			values: vi.fn().mockResolvedValue(undefined),
		}),
		delete: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue(undefined),
		}),
	} as any)

	// Setup commerce server function mocks
	const { getRegistrationFee, buildFeeConfig, calculateCompetitionFees } =
		await import("@/server/commerce")
	vi.mocked(getRegistrationFee).mockResolvedValue(5000)
	vi.mocked(buildFeeConfig).mockReturnValue({
		platformPercentageBasisPoints: 250,
		platformFixedCents: 200,
		stripePercentageBasisPoints: 290,
		stripeFixedCents: 30,
		passStripeFeesToCustomer: false,
		passPlatformFeesToCustomer: true,
	})
	vi.mocked(calculateCompetitionFees).mockReturnValue({
		registrationFeeCents: 5000,
		platformFeeCents: 325,
		stripeFeeCents: 184,
		totalChargeCents: 5325,
		organizerNetCents: 4816,
		stripeFeesPassedToCustomer: false,
		platformFeesPassedToCustomer: true,
	})
})

afterEach(() => {
	vi.clearAllMocks()
})

describe("commerce.action", () => {
	describe("getCompetitionDivisionFees", () => {
		it("should return division fees and default fee for a competition", async () => {
			const result = await getCompetitionDivisionFees(testCompetitionId)

			expect(result).toBeDefined()
			expect(result.defaultFeeCents).toBe(5000)
			expect(result.divisionFees).toHaveLength(2)
			expect(result.divisionFees[0]).toEqual({
				divisionId: "div-1",
				divisionLabel: "Rx",
				feeCents: 4000,
			})
		})

		it("should return 0 as default fee when competition has no default set", async () => {
			const { getDb } = await import("@/db")
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findFirst: vi.fn().mockResolvedValue({
							...mockCompetition,
							defaultRegistrationFeeCents: null,
						}),
					},
					competitionDivisionsTable: {
						findMany: vi.fn().mockResolvedValue([]),
					},
				},
			} as any)

			const result = await getCompetitionDivisionFees(testCompetitionId)

			expect(result.defaultFeeCents).toBe(0)
			expect(result.divisionFees).toHaveLength(0)
		})

		it("should return empty division fees when no divisions configured", async () => {
			const { getDb } = await import("@/db")
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findFirst: vi.fn().mockResolvedValue(mockCompetition),
					},
					competitionDivisionsTable: {
						findMany: vi.fn().mockResolvedValue([]),
					},
				},
			} as any)

			const result = await getCompetitionDivisionFees(testCompetitionId)

			expect(result.divisionFees).toHaveLength(0)
		})

		it("should handle null division label gracefully", async () => {
			const { getDb } = await import("@/db")
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findFirst: vi.fn().mockResolvedValue(mockCompetition),
					},
					competitionDivisionsTable: {
						findMany: vi.fn().mockResolvedValue([
							{
								divisionId: "div-1",
								feeCents: 4000,
								division: null,
							},
						]),
					},
				},
			} as any)

			const result = await getCompetitionDivisionFees(testCompetitionId)

			expect(result.divisionFees[0].divisionLabel).toBeUndefined()
		})
	})

	describe("getRegistrationFeeBreakdown", () => {
		it("should return fee breakdown for a paid division", async () => {
			const result = await getRegistrationFeeBreakdown(
				testCompetitionId,
				testDivisionId,
			)

			expect(result).toBeDefined()
			expect(result.isFree).toBe(false)
			if (!result.isFree) {
				expect(result.registrationFeeCents).toBe(5000)
				expect(result.platformFeeCents).toBe(325)
				expect(result.totalChargeCents).toBe(5325)
				expect(result.organizerNetCents).toBe(4816)
			}
		})

		it("should return free breakdown when registration fee is 0", async () => {
			const { getRegistrationFee } = await import("@/server/commerce")
			vi.mocked(getRegistrationFee).mockResolvedValue(0)

			const result = await getRegistrationFeeBreakdown(
				testCompetitionId,
				testDivisionId,
			)

			expect(result.isFree).toBe(true)
			expect(result.totalCents).toBe(0)
			expect(result.registrationFeeCents).toBe(0)
		})

		it("should throw error when competition not found", async () => {
			const { getDb } = await import("@/db")
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findFirst: vi.fn().mockResolvedValue(null),
					},
				},
			} as any)

			await expect(
				getRegistrationFeeBreakdown(testCompetitionId, testDivisionId),
			).rejects.toThrow("Competition not found")
		})

		it("should call buildFeeConfig with competition settings", async () => {
			const { buildFeeConfig } = await import("@/server/commerce")

			await getRegistrationFeeBreakdown(testCompetitionId, testDivisionId)

			expect(buildFeeConfig).toHaveBeenCalledWith(mockCompetition)
		})

		it("should call calculateCompetitionFees with registration fee and config", async () => {
			const { calculateCompetitionFees, getRegistrationFee, buildFeeConfig } =
				await import("@/server/commerce")

			await getRegistrationFeeBreakdown(testCompetitionId, testDivisionId)

			expect(getRegistrationFee).toHaveBeenCalledWith(
				testCompetitionId,
				testDivisionId,
			)
			expect(calculateCompetitionFees).toHaveBeenCalledWith(
				5000,
				expect.objectContaining({
					platformPercentageBasisPoints: 250,
				}),
			)
		})
	})

	describe("updateCompetitionFeeConfig", () => {
		it("should successfully update competition fee config with valid input", async () => {
			const { getDb } = await import("@/db")
			const mockUpdate = vi.fn().mockReturnValue({
				set: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue(undefined),
				}),
			})
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findFirst: vi.fn().mockResolvedValue(mockCompetition),
					},
				},
				update: mockUpdate,
			} as any)

			const result = await updateCompetitionFeeConfig({
				competitionId: testCompetitionId,
				defaultRegistrationFeeCents: 7500,
				platformFeePercentage: 300,
				platformFeeFixed: 250,
				passStripeFeesToCustomer: true,
				passPlatformFeesToCustomer: false,
			})

			expect(result).toEqual({ success: true })
			expect(mockUpdate).toHaveBeenCalled()
		})

		it("should require authentication", async () => {
			const { requireVerifiedEmail } = await import("@/utils/auth")
			vi.mocked(requireVerifiedEmail).mockResolvedValue(null)

			await expect(
				updateCompetitionFeeConfig({
					competitionId: testCompetitionId,
				}),
			).rejects.toThrow("Unauthorized")
		})

		it("should throw when competition not found", async () => {
			const { getDb } = await import("@/db")
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findFirst: vi.fn().mockResolvedValue(null),
					},
				},
			} as any)

			await expect(
				updateCompetitionFeeConfig({
					competitionId: "nonexistent-comp",
				}),
			).rejects.toThrow("Competition not found")
		})

		it("should require MANAGE_PROGRAMMING permission", async () => {
			const { requireTeamPermission } = await import("@/utils/team-auth")

			await updateCompetitionFeeConfig({
				competitionId: testCompetitionId,
			})

			expect(requireTeamPermission).toHaveBeenCalledWith(
				testOrganizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)
		})

		it("should throw when user lacks permission", async () => {
			const { requireTeamPermission } = await import("@/utils/team-auth")
			vi.mocked(requireTeamPermission).mockRejectedValue(
				new Error("You don't have permission to manage programming"),
			)

			await expect(
				updateCompetitionFeeConfig({
					competitionId: testCompetitionId,
				}),
			).rejects.toThrow("permission")
		})

		it("should update only provided fields", async () => {
			const { getDb } = await import("@/db")
			const mockSetFn = vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(undefined),
			})
			const mockUpdate = vi.fn().mockReturnValue({
				set: mockSetFn,
			})
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findFirst: vi.fn().mockResolvedValue(mockCompetition),
					},
				},
				update: mockUpdate,
			} as any)

			await updateCompetitionFeeConfig({
				competitionId: testCompetitionId,
				defaultRegistrationFeeCents: 6000,
			})

			expect(mockSetFn).toHaveBeenCalledWith(
				expect.objectContaining({
					defaultRegistrationFeeCents: 6000,
					updatedAt: expect.any(Date),
				}),
			)
		})

		it("should allow null values for optional fee settings", async () => {
			const { getDb } = await import("@/db")
			const mockSetFn = vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(undefined),
			})
			const mockUpdate = vi.fn().mockReturnValue({
				set: mockSetFn,
			})
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findFirst: vi.fn().mockResolvedValue(mockCompetition),
					},
				},
				update: mockUpdate,
			} as any)

			await updateCompetitionFeeConfig({
				competitionId: testCompetitionId,
				platformFeePercentage: null,
				platformFeeFixed: null,
			})

			expect(mockSetFn).toHaveBeenCalledWith(
				expect.objectContaining({
					platformFeePercentage: null,
					platformFeeFixed: null,
				}),
			)
		})
	})

	describe("updateDivisionFee", () => {
		it("should successfully create a new division fee", async () => {
			const { getDb } = await import("@/db")
			const mockInsert = vi.fn().mockReturnValue({
				values: vi.fn().mockResolvedValue(undefined),
			})
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findFirst: vi.fn().mockResolvedValue(mockCompetition),
					},
					competitionDivisionsTable: {
						findFirst: vi.fn().mockResolvedValue(null),
					},
				},
				insert: mockInsert,
			} as any)

			const result = await updateDivisionFee({
				competitionId: testCompetitionId,
				divisionId: testDivisionId,
				feeCents: 4500,
			})

			expect(result).toEqual({ success: true })
			expect(mockInsert).toHaveBeenCalled()
		})

		it("should update an existing division fee", async () => {
			const { getDb } = await import("@/db")
			const mockSetFn = vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(undefined),
			})
			const mockUpdate = vi.fn().mockReturnValue({
				set: mockSetFn,
			})
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findFirst: vi.fn().mockResolvedValue(mockCompetition),
					},
					competitionDivisionsTable: {
						findFirst: vi.fn().mockResolvedValue({
							id: "existing-fee-id",
							competitionId: testCompetitionId,
							divisionId: testDivisionId,
							feeCents: 3000,
						}),
					},
				},
				update: mockUpdate,
			} as any)

			const result = await updateDivisionFee({
				competitionId: testCompetitionId,
				divisionId: testDivisionId,
				feeCents: 4500,
			})

			expect(result).toEqual({ success: true })
			expect(mockUpdate).toHaveBeenCalled()
			expect(mockSetFn).toHaveBeenCalledWith(
				expect.objectContaining({
					feeCents: 4500,
					updatedAt: expect.any(Date),
				}),
			)
		})

		it("should delete division fee when feeCents is null", async () => {
			const { getDb } = await import("@/db")
			const mockWhereFn = vi.fn().mockResolvedValue(undefined)
			const mockDelete = vi.fn().mockReturnValue({
				where: mockWhereFn,
			})
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findFirst: vi.fn().mockResolvedValue(mockCompetition),
					},
				},
				delete: mockDelete,
			} as any)

			const result = await updateDivisionFee({
				competitionId: testCompetitionId,
				divisionId: testDivisionId,
				feeCents: null,
			})

			expect(result).toEqual({ success: true })
			expect(mockDelete).toHaveBeenCalled()
		})

		it("should require authentication", async () => {
			const { requireVerifiedEmail } = await import("@/utils/auth")
			vi.mocked(requireVerifiedEmail).mockResolvedValue(null)

			await expect(
				updateDivisionFee({
					competitionId: testCompetitionId,
					divisionId: testDivisionId,
					feeCents: 5000,
				}),
			).rejects.toThrow("Unauthorized")
		})

		it("should throw when competition not found", async () => {
			const { getDb } = await import("@/db")
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findFirst: vi.fn().mockResolvedValue(null),
					},
				},
			} as any)

			await expect(
				updateDivisionFee({
					competitionId: "nonexistent-comp",
					divisionId: testDivisionId,
					feeCents: 5000,
				}),
			).rejects.toThrow("Competition not found")
		})

		it("should require MANAGE_PROGRAMMING permission", async () => {
			const { requireTeamPermission } = await import("@/utils/team-auth")
			const { getDb } = await import("@/db")
			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findFirst: vi.fn().mockResolvedValue(mockCompetition),
					},
					competitionDivisionsTable: {
						findFirst: vi.fn().mockResolvedValue(null),
					},
				},
				insert: vi.fn().mockReturnValue({
					values: vi.fn().mockResolvedValue(undefined),
				}),
			} as any)

			await updateDivisionFee({
				competitionId: testCompetitionId,
				divisionId: testDivisionId,
				feeCents: 5000,
			})

			expect(requireTeamPermission).toHaveBeenCalledWith(
				testOrganizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)
		})

		it("should throw when user lacks permission", async () => {
			const { requireTeamPermission } = await import("@/utils/team-auth")
			vi.mocked(requireTeamPermission).mockRejectedValue(
				new Error("You don't have permission to manage programming"),
			)

			await expect(
				updateDivisionFee({
					competitionId: testCompetitionId,
					divisionId: testDivisionId,
					feeCents: 5000,
				}),
			).rejects.toThrow("permission")
		})
	})

	describe("Edge Cases", () => {
		describe("getRegistrationFeeBreakdown edge cases", () => {
			it("should handle very small fees (minimum viable)", async () => {
				const { getRegistrationFee, calculateCompetitionFees } = await import(
					"@/server/commerce"
				)
				vi.mocked(getRegistrationFee).mockResolvedValue(100) // $1.00
				vi.mocked(calculateCompetitionFees).mockReturnValue({
					registrationFeeCents: 100,
					platformFeeCents: 203,
					stripeFeeCents: 39,
					totalChargeCents: 303,
					organizerNetCents: 61,
					stripeFeesPassedToCustomer: false,
					platformFeesPassedToCustomer: true,
				})

				const result = await getRegistrationFeeBreakdown(
					testCompetitionId,
					testDivisionId,
				)

				expect(result.isFree).toBe(false)
				if (!result.isFree) {
					expect(result.registrationFeeCents).toBe(100)
				}
			})

			it("should handle large fees", async () => {
				const { getRegistrationFee, calculateCompetitionFees } = await import(
					"@/server/commerce"
				)
				vi.mocked(getRegistrationFee).mockResolvedValue(50000) // $500
				vi.mocked(calculateCompetitionFees).mockReturnValue({
					registrationFeeCents: 50000,
					platformFeeCents: 1450,
					stripeFeeCents: 1523,
					totalChargeCents: 51450,
					organizerNetCents: 48477,
					stripeFeesPassedToCustomer: false,
					platformFeesPassedToCustomer: true,
				})

				const result = await getRegistrationFeeBreakdown(
					testCompetitionId,
					testDivisionId,
				)

				expect(result.isFree).toBe(false)
				if (!result.isFree) {
					expect(result.registrationFeeCents).toBe(50000)
				}
			})
		})

		describe("updateDivisionFee edge cases", () => {
			it("should handle zero fee (making division free)", async () => {
				const { getDb } = await import("@/db")
				const mockInsert = vi.fn().mockReturnValue({
					values: vi.fn().mockResolvedValue(undefined),
				})
				vi.mocked(getDb).mockReturnValue({
					query: {
						competitionsTable: {
							findFirst: vi.fn().mockResolvedValue(mockCompetition),
						},
						competitionDivisionsTable: {
							findFirst: vi.fn().mockResolvedValue(null),
						},
					},
					insert: mockInsert,
				} as any)

				const result = await updateDivisionFee({
					competitionId: testCompetitionId,
					divisionId: testDivisionId,
					feeCents: 0,
				})

				expect(result).toEqual({ success: true })
				// Should insert, not delete - 0 is a valid fee (free)
				expect(mockInsert).toHaveBeenCalled()
			})
		})

		describe("updateCompetitionFeeConfig edge cases", () => {
			it("should handle updating all boolean flags together", async () => {
				const { getDb } = await import("@/db")
				const mockSetFn = vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue(undefined),
				})
				const mockUpdate = vi.fn().mockReturnValue({
					set: mockSetFn,
				})
				vi.mocked(getDb).mockReturnValue({
					query: {
						competitionsTable: {
							findFirst: vi.fn().mockResolvedValue(mockCompetition),
						},
					},
					update: mockUpdate,
				} as any)

				await updateCompetitionFeeConfig({
					competitionId: testCompetitionId,
					passStripeFeesToCustomer: true,
					passPlatformFeesToCustomer: false,
				})

				expect(mockSetFn).toHaveBeenCalledWith(
					expect.objectContaining({
						passStripeFeesToCustomer: true,
						passPlatformFeesToCustomer: false,
					}),
				)
			})
		})
	})

	describe("Integration scenarios", () => {
		it("should support typical organizer workflow: set default fee, then override division", async () => {
			const { getDb } = await import("@/db")

			// First: update competition default fee
			const mockSetFn = vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(undefined),
			})
			const mockUpdate = vi.fn().mockReturnValue({
				set: mockSetFn,
			})
			const mockInsert = vi.fn().mockReturnValue({
				values: vi.fn().mockResolvedValue(undefined),
			})

			vi.mocked(getDb).mockReturnValue({
				query: {
					competitionsTable: {
						findFirst: vi.fn().mockResolvedValue(mockCompetition),
					},
					competitionDivisionsTable: {
						findFirst: vi.fn().mockResolvedValue(null),
					},
				},
				update: mockUpdate,
				insert: mockInsert,
			} as any)

			const feeConfigResult = await updateCompetitionFeeConfig({
				competitionId: testCompetitionId,
				defaultRegistrationFeeCents: 7500,
			})
			expect(feeConfigResult.success).toBe(true)

			// Second: add division-specific override
			const divisionResult = await updateDivisionFee({
				competitionId: testCompetitionId,
				divisionId: testDivisionId,
				feeCents: 6000,
			})
			expect(divisionResult.success).toBe(true)
		})
	})
})
