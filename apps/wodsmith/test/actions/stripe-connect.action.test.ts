import { beforeEach, afterEach, describe, it, expect, vi } from "vitest"
import { createTestSession } from "@repo/test-utils/factories"
import { TEAM_PERMISSIONS } from "@/db/schema"
import type { SessionWithMeta } from "@/types"

// Mock dependencies before importing actions
vi.mock("@/utils/auth", () => ({
	requireVerifiedEmail: vi.fn(),
}))

vi.mock("@/utils/team-auth", () => ({
	requireTeamMembership: vi.fn(),
	requireTeamPermission: vi.fn(),
}))

vi.mock("@/db", () => ({
	getDb: vi.fn(),
}))

vi.mock("@/server/stripe-connect", () => ({
	createExpressAccount: vi.fn(),
	createExpressAccountLink: vi.fn(),
	getOAuthAuthorizeUrl: vi.fn(),
	syncAccountStatus: vi.fn(),
	disconnectAccount: vi.fn(),
	getStripeDashboardLink: vi.fn(),
	getAccountBalance: vi.fn(),
}))

vi.mock("@/lib/logging/posthog-otel-logger", () => ({
	logInfo: vi.fn(),
}))

vi.mock("next/headers", () => ({
	cookies: vi.fn(() => ({
		set: vi.fn(),
	})),
}))

vi.mock("@/utils/is-prod", () => ({
	default: false,
}))

vi.mock("@/utils/with-rate-limit", () => ({
	withRateLimit: vi.fn((fn) => fn()),
	RATE_LIMITS: {
		SETTINGS: "settings",
	},
}))

// Import after mocks
import { requireVerifiedEmail } from "@/utils/auth"
import { requireTeamMembership, requireTeamPermission } from "@/utils/team-auth"
import { getDb } from "@/db"
import {
	createExpressAccount,
	createExpressAccountLink,
	getOAuthAuthorizeUrl,
	syncAccountStatus,
	disconnectAccount,
	getStripeDashboardLink,
	getAccountBalance,
} from "@/server/stripe-connect"
import {
	getStripeConnectionStatus,
	initiateExpressOnboarding,
	initiateStandardOAuth,
	refreshOnboardingLink,
	disconnectStripeAccount,
	getStripeDashboardUrl,
	getStripeAccountBalance,
} from "@/actions/stripe-connect.action"

const mockSession: SessionWithMeta = createTestSession({
	userId: "user-123",
	teamId: "team-123",
	teamSlug: "test-team",
	teamRole: "owner",
	permissions: [
		TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
		TEAM_PERMISSIONS.ACCESS_BILLING,
	],
})

beforeEach(() => {
	vi.clearAllMocks()
	vi.mocked(requireVerifiedEmail).mockResolvedValue(mockSession)
	vi.mocked(requireTeamMembership).mockResolvedValue(undefined)
	vi.mocked(requireTeamPermission).mockResolvedValue(undefined)
})

afterEach(() => {
	vi.clearAllMocks()
})

describe("stripe-connect.action", () => {
	describe("getStripeConnectionStatus", () => {
		const validInput = { teamId: "team-123" }

		it("should return isConnected: false when team has no Stripe account", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							stripeConnectedAccountId: null,
							stripeAccountStatus: null,
							stripeAccountType: null,
							stripeOnboardingCompletedAt: null,
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const result = await getStripeConnectionStatus(validInput)

			expect(result.isConnected).toBe(false)
			expect(result.status).toBeNull()
			expect(result.accountType).toBeNull()
		})

		it("should return isConnected: true when team has VERIFIED status", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							stripeConnectedAccountId: "acct_123",
							stripeAccountStatus: "VERIFIED",
							stripeAccountType: "express",
							stripeOnboardingCompletedAt: new Date("2024-01-01"),
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const result = await getStripeConnectionStatus(validInput)

			expect(result.isConnected).toBe(true)
			expect(result.status).toBe("VERIFIED")
			expect(result.accountType).toBe("express")
			expect(result.onboardingCompletedAt).toBeInstanceOf(Date)
		})

		it("should return isConnected: false when team has PENDING status", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							stripeConnectedAccountId: "acct_123",
							stripeAccountStatus: "PENDING",
							stripeAccountType: "standard",
							stripeOnboardingCompletedAt: null,
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const result = await getStripeConnectionStatus(validInput)

			expect(result.isConnected).toBe(false)
			expect(result.status).toBe("PENDING")
		})

		it("should sync status from Stripe when account is PENDING", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi
							.fn()
							// First call: returns PENDING
							.mockResolvedValueOnce({
								stripeConnectedAccountId: "acct_123",
								stripeAccountStatus: "PENDING",
								stripeAccountType: "express",
								stripeOnboardingCompletedAt: null,
							})
							// Second call after sync: returns VERIFIED
							.mockResolvedValueOnce({
								stripeAccountStatus: "VERIFIED",
								stripeOnboardingCompletedAt: new Date("2024-01-01"),
							}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)
			vi.mocked(syncAccountStatus).mockResolvedValue(undefined)

			const result = await getStripeConnectionStatus(validInput)

			expect(syncAccountStatus).toHaveBeenCalledWith("team-123")
			expect(result.isConnected).toBe(true)
			expect(result.status).toBe("VERIFIED")
		})

		it("should not sync status when account is already VERIFIED", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							stripeConnectedAccountId: "acct_123",
							stripeAccountStatus: "VERIFIED",
							stripeAccountType: "standard",
							stripeOnboardingCompletedAt: new Date("2024-01-01"),
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await getStripeConnectionStatus(validInput)

			expect(syncAccountStatus).not.toHaveBeenCalled()
		})

		it("should require team membership", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							stripeConnectedAccountId: null,
							stripeAccountStatus: null,
							stripeAccountType: null,
							stripeOnboardingCompletedAt: null,
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await getStripeConnectionStatus(validInput)

			expect(requireTeamMembership).toHaveBeenCalledWith("team-123")
		})

		it("should throw error when team is not found", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue(null),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await expect(getStripeConnectionStatus(validInput)).rejects.toThrow(
				"Team not found",
			)
		})
	})

	describe("initiateExpressOnboarding", () => {
		const validInput = { teamId: "team-123" }

		it("should create new Express account when team has none", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							id: "team-123",
							name: "Test Team",
							slug: "test-team",
							stripeConnectedAccountId: null,
							stripeAccountStatus: null,
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)
			vi.mocked(createExpressAccount).mockResolvedValue({
				accountId: "acct_new",
				onboardingUrl: "https://connect.stripe.com/express/onboard/acct_new",
			})

			const result = await initiateExpressOnboarding(validInput)

			expect(createExpressAccount).toHaveBeenCalledWith(
				"team-123",
				mockSession.user.email,
				"Test Team",
			)
			expect(result.onboardingUrl).toContain("stripe.com")
		})

		it("should create new onboarding link for existing Express account", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							id: "team-123",
							name: "Test Team",
							slug: "test-team",
							stripeConnectedAccountId: "acct_existing",
							stripeAccountStatus: "PENDING",
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)
			vi.mocked(createExpressAccountLink).mockResolvedValue({
				url: "https://connect.stripe.com/express/onboard/acct_existing",
			})

			const result = await initiateExpressOnboarding(validInput)

			expect(createExpressAccount).not.toHaveBeenCalled()
			expect(createExpressAccountLink).toHaveBeenCalledWith(
				"acct_existing",
				"team-123",
			)
			expect(result.onboardingUrl).toContain("stripe.com")
		})

		it("should require authentication", async () => {
			vi.mocked(requireVerifiedEmail).mockResolvedValue(null as any)

			await expect(initiateExpressOnboarding(validInput)).rejects.toThrow(
				"Unauthorized",
			)
		})

		it("should require EDIT_TEAM_SETTINGS permission", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							id: "team-123",
							name: "Test Team",
							slug: "test-team",
							stripeConnectedAccountId: null,
							stripeAccountStatus: null,
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)
			vi.mocked(createExpressAccount).mockResolvedValue({
				accountId: "acct_new",
				onboardingUrl: "https://connect.stripe.com/express/onboard/acct_new",
			})

			await initiateExpressOnboarding(validInput)

			expect(requireTeamPermission).toHaveBeenCalledWith(
				"team-123",
				TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
			)
		})

		it("should throw error when permission is denied", async () => {
			vi.mocked(requireTeamPermission).mockRejectedValue(
				new Error("Permission denied"),
			)

			await expect(initiateExpressOnboarding(validInput)).rejects.toThrow(
				"Permission denied",
			)
		})

		it("should throw error when team is not found", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue(null),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await expect(initiateExpressOnboarding(validInput)).rejects.toThrow(
				"Team not found",
			)
		})
	})

	describe("initiateStandardOAuth", () => {
		const validInput = { teamId: "team-123" }

		it("should generate OAuth authorization URL", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							id: "team-123",
							slug: "test-team",
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)
			vi.mocked(getOAuthAuthorizeUrl).mockReturnValue(
				"https://connect.stripe.com/oauth/authorize?state=xyz",
			)

			const result = await initiateStandardOAuth(validInput)

			expect(getOAuthAuthorizeUrl).toHaveBeenCalledWith(
				"team-123",
				"test-team",
				mockSession.userId,
				expect.any(String), // CSRF token
			)
			expect(result.authorizationUrl).toContain("stripe.com")
		})

		it("should set CSRF state cookie", async () => {
			const { cookies } = await import("next/headers")
			const mockCookieStore = {
				set: vi.fn(),
			}
			vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							id: "team-123",
							slug: "test-team",
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)
			vi.mocked(getOAuthAuthorizeUrl).mockReturnValue(
				"https://connect.stripe.com/oauth/authorize",
			)

			await initiateStandardOAuth(validInput)

			expect(mockCookieStore.set).toHaveBeenCalledWith(
				expect.any(String), // STRIPE_OAUTH_STATE_COOKIE_NAME
				expect.any(String), // CSRF token
				expect.objectContaining({
					httpOnly: true,
					path: "/",
					sameSite: "lax",
				}),
			)
		})

		it("should require authentication", async () => {
			vi.mocked(requireVerifiedEmail).mockResolvedValue(null as any)

			await expect(initiateStandardOAuth(validInput)).rejects.toThrow(
				"Unauthorized",
			)
		})

		it("should require EDIT_TEAM_SETTINGS permission", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							id: "team-123",
							slug: "test-team",
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)
			vi.mocked(getOAuthAuthorizeUrl).mockReturnValue(
				"https://connect.stripe.com/oauth/authorize",
			)

			await initiateStandardOAuth(validInput)

			expect(requireTeamPermission).toHaveBeenCalledWith(
				"team-123",
				TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
			)
		})

		it("should throw error when team is not found", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue(null),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await expect(initiateStandardOAuth(validInput)).rejects.toThrow(
				"Team not found",
			)
		})

		it("should include userId in OAuth state for session binding", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							id: "team-123",
							slug: "test-team",
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)
			vi.mocked(getOAuthAuthorizeUrl).mockReturnValue(
				"https://connect.stripe.com/oauth/authorize",
			)

			await initiateStandardOAuth(validInput)

			expect(getOAuthAuthorizeUrl).toHaveBeenCalledWith(
				"team-123",
				"test-team",
				"user-123", // userId from session
				expect.any(String),
			)
		})
	})

	describe("refreshOnboardingLink", () => {
		const validInput = { teamId: "team-123" }

		it("should create new onboarding link for Express account", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							id: "team-123",
							stripeConnectedAccountId: "acct_123",
							stripeAccountType: "express",
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)
			vi.mocked(createExpressAccountLink).mockResolvedValue({
				url: "https://connect.stripe.com/express/onboard/acct_123",
			})

			const result = await refreshOnboardingLink(validInput)

			expect(createExpressAccountLink).toHaveBeenCalledWith("acct_123", "team-123")
			expect(result.onboardingUrl).toContain("stripe.com")
		})

		it("should throw error when no Stripe account is connected", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							id: "team-123",
							stripeConnectedAccountId: null,
							stripeAccountType: null,
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await expect(refreshOnboardingLink(validInput)).rejects.toThrow(
				"No Stripe account connected",
			)
		})

		it("should throw error for Standard accounts", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							id: "team-123",
							stripeConnectedAccountId: "acct_123",
							stripeAccountType: "standard",
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await expect(refreshOnboardingLink(validInput)).rejects.toThrow(
				"Can only refresh onboarding for Express accounts",
			)
		})

		it("should require authentication", async () => {
			vi.mocked(requireVerifiedEmail).mockResolvedValue(null as any)

			await expect(refreshOnboardingLink(validInput)).rejects.toThrow(
				"Unauthorized",
			)
		})

		it("should require EDIT_TEAM_SETTINGS permission", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							id: "team-123",
							stripeConnectedAccountId: "acct_123",
							stripeAccountType: "express",
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)
			vi.mocked(createExpressAccountLink).mockResolvedValue({
				url: "https://connect.stripe.com/express/onboard/acct_123",
			})

			await refreshOnboardingLink(validInput)

			expect(requireTeamPermission).toHaveBeenCalledWith(
				"team-123",
				TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
			)
		})
	})

	describe("disconnectStripeAccount", () => {
		const validInput = { teamId: "team-123" }

		it("should disconnect Stripe account successfully", async () => {
			vi.mocked(disconnectAccount).mockResolvedValue(undefined)

			const result = await disconnectStripeAccount(validInput)

			expect(disconnectAccount).toHaveBeenCalledWith("team-123")
			expect(result.success).toBe(true)
		})

		it("should require authentication", async () => {
			vi.mocked(requireVerifiedEmail).mockResolvedValue(null as any)

			await expect(disconnectStripeAccount(validInput)).rejects.toThrow(
				"Unauthorized",
			)
		})

		it("should require EDIT_TEAM_SETTINGS permission", async () => {
			vi.mocked(disconnectAccount).mockResolvedValue(undefined)

			await disconnectStripeAccount(validInput)

			expect(requireTeamPermission).toHaveBeenCalledWith(
				"team-123",
				TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
			)
		})
	})

	describe("getStripeDashboardUrl", () => {
		const validInput = { teamId: "team-123" }

		it("should return login link for Express accounts", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							stripeConnectedAccountId: "acct_123",
							stripeAccountType: "express",
							stripeAccountStatus: "VERIFIED",
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)
			vi.mocked(getStripeDashboardLink).mockResolvedValue(
				"https://dashboard.stripe.com/express/acct_123",
			)

			const result = await getStripeDashboardUrl(validInput)

			expect(getStripeDashboardLink).toHaveBeenCalledWith("acct_123")
			expect(result.dashboardUrl).toContain("stripe.com")
		})

		it("should return direct Stripe dashboard URL for Standard accounts", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							stripeConnectedAccountId: "acct_123",
							stripeAccountType: "standard",
							stripeAccountStatus: "VERIFIED",
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const result = await getStripeDashboardUrl(validInput)

			expect(getStripeDashboardLink).not.toHaveBeenCalled()
			expect(result.dashboardUrl).toBe("https://dashboard.stripe.com")
		})

		it("should throw error when no Stripe account is connected", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							stripeConnectedAccountId: null,
							stripeAccountType: null,
							stripeAccountStatus: null,
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await expect(getStripeDashboardUrl(validInput)).rejects.toThrow(
				"No Stripe account connected",
			)
		})

		it("should throw error when account is not VERIFIED", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							stripeConnectedAccountId: "acct_123",
							stripeAccountType: "express",
							stripeAccountStatus: "PENDING",
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await expect(getStripeDashboardUrl(validInput)).rejects.toThrow(
				"Stripe account not verified",
			)
		})

		it("should require ACCESS_BILLING permission", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							stripeConnectedAccountId: "acct_123",
							stripeAccountType: "express",
							stripeAccountStatus: "VERIFIED",
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)
			vi.mocked(getStripeDashboardLink).mockResolvedValue(
				"https://dashboard.stripe.com/express/acct_123",
			)

			await getStripeDashboardUrl(validInput)

			expect(requireTeamPermission).toHaveBeenCalledWith(
				"team-123",
				TEAM_PERMISSIONS.ACCESS_BILLING,
			)
		})
	})

	describe("getStripeAccountBalance", () => {
		const validInput = { teamId: "team-123" }

		it("should return balance for verified account", async () => {
			const mockBalance = {
				available: [{ currency: "usd", amount: 10000 }],
				pending: [{ currency: "usd", amount: 5000 }],
			}
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							stripeConnectedAccountId: "acct_123",
							stripeAccountStatus: "VERIFIED",
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)
			vi.mocked(getAccountBalance).mockResolvedValue(mockBalance)

			const result = await getStripeAccountBalance(validInput)

			expect(getAccountBalance).toHaveBeenCalledWith("acct_123")
			expect(result).toEqual(mockBalance)
		})

		it("should return null when no Stripe account is connected", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							stripeConnectedAccountId: null,
							stripeAccountStatus: null,
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const result = await getStripeAccountBalance(validInput)

			expect(result).toBeNull()
			expect(getAccountBalance).not.toHaveBeenCalled()
		})

		it("should return null when account is not VERIFIED", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							stripeConnectedAccountId: "acct_123",
							stripeAccountStatus: "PENDING",
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const result = await getStripeAccountBalance(validInput)

			expect(result).toBeNull()
			expect(getAccountBalance).not.toHaveBeenCalled()
		})

		it("should require ACCESS_BILLING permission", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							stripeConnectedAccountId: "acct_123",
							stripeAccountStatus: "VERIFIED",
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)
			vi.mocked(getAccountBalance).mockResolvedValue({
				available: [],
				pending: [],
			})

			await getStripeAccountBalance(validInput)

			expect(requireTeamPermission).toHaveBeenCalledWith(
				"team-123",
				TEAM_PERMISSIONS.ACCESS_BILLING,
			)
		})

		it("should require authentication", async () => {
			vi.mocked(requireVerifiedEmail).mockResolvedValue(null as any)

			await expect(getStripeAccountBalance(validInput)).rejects.toThrow(
				"Unauthorized",
			)
		})
	})

	describe("Permission edge cases", () => {
		it("should fail fast when permission check throws", async () => {
			vi.mocked(requireTeamPermission).mockRejectedValue(
				new Error("Not authorized"),
			)

			await expect(
				initiateExpressOnboarding({ teamId: "team-123" }),
			).rejects.toThrow("Not authorized")

			// Should not have proceeded to DB query
			expect(getDb).not.toHaveBeenCalled()
		})

		it("should handle database errors gracefully", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockRejectedValue(new Error("Database error")),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await expect(
				getStripeConnectionStatus({ teamId: "team-123" }),
			).rejects.toThrow("Database error")
		})
	})

	describe("Security: OAuth state validation", () => {
		it("should generate unique CSRF token for each OAuth request", async () => {
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							id: "team-123",
							slug: "test-team",
						}),
					},
				},
			}
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const capturedStates: string[] = []
			vi.mocked(getOAuthAuthorizeUrl).mockImplementation(
				(_teamId, _slug, _userId, csrfToken) => {
					capturedStates.push(csrfToken)
					return "https://connect.stripe.com/oauth/authorize"
				},
			)

			await initiateStandardOAuth({ teamId: "team-123" })
			await initiateStandardOAuth({ teamId: "team-123" })

			expect(capturedStates[0]).toBeDefined()
			expect(capturedStates[1]).toBeDefined()
			expect(capturedStates[0]).not.toBe(capturedStates[1])
		})
	})
})
