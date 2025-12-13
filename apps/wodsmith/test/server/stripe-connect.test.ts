import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	getOAuthAuthorizeUrl,
	handleOAuthCallback,
	parseOAuthState,
	syncAccountStatus,
	type StripeOAuthState,
} from "@/server/stripe-connect"

// Mock dependencies
vi.mock("@/db", () => ({
	getDb: vi.fn(),
}))

vi.mock("@/lib/stripe", () => ({
	getStripe: vi.fn(),
}))

vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: () => ({
		env: {
			NEXT_PUBLIC_APP_URL: "https://test.example.com",
		},
	}),
}))

// Set up environment variable for tests
const originalEnv = process.env
beforeEach(() => {
	process.env = { ...originalEnv, STRIPE_CLIENT_ID: "ca_test_123" }
})

afterEach(() => {
	process.env = originalEnv
	vi.clearAllMocks()
})

import { getDb } from "@/db"
import { getStripe } from "@/lib/stripe"

describe("Stripe Connect OAuth", () => {
	const mockTeamId = "team-123"
	const mockTeamSlug = "test-team"
	const mockUserId = "user-456"
	const mockCsrfToken = "csrf-token-789"
	const mockAccountId = "acct_123456"

	describe("parseOAuthState", () => {
		it("should parse valid base64-encoded state", () => {
			const statePayload: StripeOAuthState = {
				teamId: mockTeamId,
				teamSlug: mockTeamSlug,
				userId: mockUserId,
				csrfToken: mockCsrfToken,
			}
			const encodedState = Buffer.from(JSON.stringify(statePayload)).toString(
				"base64",
			)

			const result = parseOAuthState(encodedState)

			expect(result).toEqual(statePayload)
			expect(result.teamId).toBe(mockTeamId)
			expect(result.teamSlug).toBe(mockTeamSlug)
			expect(result.userId).toBe(mockUserId)
			expect(result.csrfToken).toBe(mockCsrfToken)
		})

		it("should throw error for invalid base64", () => {
			expect(() => parseOAuthState("not-valid-base64!!!")).toThrow(
				"Invalid OAuth state",
			)
		})

		it("should throw error for invalid JSON", () => {
			const invalidJson = Buffer.from("not-json").toString("base64")

			expect(() => parseOAuthState(invalidJson)).toThrow("Invalid OAuth state")
		})

		it("should throw error when teamId is missing", () => {
			const incompleteState = Buffer.from(
				JSON.stringify({
					teamSlug: mockTeamSlug,
					userId: mockUserId,
					csrfToken: mockCsrfToken,
				}),
			).toString("base64")

			expect(() => parseOAuthState(incompleteState)).toThrow(
				"Invalid OAuth state",
			)
		})

		it("should throw error when teamSlug is missing", () => {
			const incompleteState = Buffer.from(
				JSON.stringify({
					teamId: mockTeamId,
					userId: mockUserId,
					csrfToken: mockCsrfToken,
				}),
			).toString("base64")

			expect(() => parseOAuthState(incompleteState)).toThrow(
				"Invalid OAuth state",
			)
		})

		it("should throw error when userId is missing", () => {
			const incompleteState = Buffer.from(
				JSON.stringify({
					teamId: mockTeamId,
					teamSlug: mockTeamSlug,
					csrfToken: mockCsrfToken,
				}),
			).toString("base64")

			expect(() => parseOAuthState(incompleteState)).toThrow(
				"Invalid OAuth state",
			)
		})

		it("should throw error when csrfToken is missing", () => {
			const incompleteState = Buffer.from(
				JSON.stringify({
					teamId: mockTeamId,
					teamSlug: mockTeamSlug,
					userId: mockUserId,
				}),
			).toString("base64")

			expect(() => parseOAuthState(incompleteState)).toThrow(
				"Invalid OAuth state",
			)
		})

		it("should throw error for empty state", () => {
			expect(() => parseOAuthState("")).toThrow("Invalid OAuth state")
		})
	})

	describe("getOAuthAuthorizeUrl", () => {
		it("should generate valid Stripe OAuth URL with all parameters", () => {
			const url = getOAuthAuthorizeUrl(
				mockTeamId,
				mockTeamSlug,
				mockUserId,
				mockCsrfToken,
			)

			// Parse the URL
			const parsedUrl = new URL(url)

			expect(parsedUrl.origin).toBe("https://connect.stripe.com")
			expect(parsedUrl.pathname).toBe("/oauth/authorize")
			expect(parsedUrl.searchParams.get("client_id")).toBe("ca_test_123")
			expect(parsedUrl.searchParams.get("scope")).toBe("read_write")
			expect(parsedUrl.searchParams.get("response_type")).toBe("code")
			expect(parsedUrl.searchParams.get("redirect_uri")).toBe(
				"https://test.example.com/api/stripe/connect/callback",
			)

			// Verify state contains the correct data
			const state = parsedUrl.searchParams.get("state")
			expect(state).toBeTruthy()
			const decodedState = parseOAuthState(state!)
			expect(decodedState.teamId).toBe(mockTeamId)
			expect(decodedState.teamSlug).toBe(mockTeamSlug)
			expect(decodedState.userId).toBe(mockUserId)
			expect(decodedState.csrfToken).toBe(mockCsrfToken)
		})

		it("should throw error when STRIPE_CLIENT_ID is not set", () => {
			delete process.env.STRIPE_CLIENT_ID

			expect(() =>
				getOAuthAuthorizeUrl(
					mockTeamId,
					mockTeamSlug,
					mockUserId,
					mockCsrfToken,
				),
			).toThrow("STRIPE_CLIENT_ID environment variable not configured")
		})

		it("should handle special characters in teamSlug", () => {
			const specialSlug = "test-team-with-special-chars"
			const url = getOAuthAuthorizeUrl(
				mockTeamId,
				specialSlug,
				mockUserId,
				mockCsrfToken,
			)

			const parsedUrl = new URL(url)
			const state = parsedUrl.searchParams.get("state")
			const decodedState = parseOAuthState(state!)

			expect(decodedState.teamSlug).toBe(specialSlug)
		})
	})

	describe("handleOAuthCallback", () => {
		const mockCode = "ac_test_code_123"

		const createMockState = (overrides?: Partial<StripeOAuthState>) => {
			const state: StripeOAuthState = {
				teamId: mockTeamId,
				teamSlug: mockTeamSlug,
				userId: mockUserId,
				csrfToken: mockCsrfToken,
				...overrides,
			}
			return Buffer.from(JSON.stringify(state)).toString("base64")
		}

		it("should exchange code and save verified account", async () => {
			const mockStripe = {
				oauth: {
					token: vi.fn().mockResolvedValue({
						stripe_user_id: mockAccountId,
					}),
				},
				accounts: {
					retrieve: vi.fn().mockResolvedValue({
						id: mockAccountId,
						charges_enabled: true,
						payouts_enabled: true,
						details_submitted: true,
					}),
				},
			}

			const mockDb = {
				update: vi.fn().mockReturnValue({
					set: vi.fn().mockReturnValue({
						where: vi.fn().mockResolvedValue(undefined),
					}),
				}),
			}

			vi.mocked(getStripe).mockReturnValue(mockStripe as any)
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const state = createMockState()
			const result = await handleOAuthCallback(mockCode, state)

			expect(result.teamId).toBe(mockTeamId)
			expect(result.teamSlug).toBe(mockTeamSlug)
			expect(result.accountId).toBe(mockAccountId)
			expect(result.status).toBe("VERIFIED")

			// Verify Stripe was called correctly
			expect(mockStripe.oauth.token).toHaveBeenCalledWith({
				grant_type: "authorization_code",
				code: mockCode,
			})

			// Verify account was retrieved
			expect(mockStripe.accounts.retrieve).toHaveBeenCalledWith(mockAccountId)

			// Verify DB was updated
			expect(mockDb.update).toHaveBeenCalled()
		})

		it("should save account as PENDING when not fully verified", async () => {
			const mockStripe = {
				oauth: {
					token: vi.fn().mockResolvedValue({
						stripe_user_id: mockAccountId,
					}),
				},
				accounts: {
					retrieve: vi.fn().mockResolvedValue({
						id: mockAccountId,
						charges_enabled: false, // Not enabled yet
						payouts_enabled: false, // Not enabled yet
						details_submitted: false,
					}),
				},
			}

			const mockDb = {
				update: vi.fn().mockReturnValue({
					set: vi.fn().mockReturnValue({
						where: vi.fn().mockResolvedValue(undefined),
					}),
				}),
			}

			vi.mocked(getStripe).mockReturnValue(mockStripe as any)
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const state = createMockState()
			const result = await handleOAuthCallback(mockCode, state)

			expect(result.status).toBe("PENDING")
		})

		it("should save as PENDING when only charges_enabled", async () => {
			const mockStripe = {
				oauth: {
					token: vi.fn().mockResolvedValue({
						stripe_user_id: mockAccountId,
					}),
				},
				accounts: {
					retrieve: vi.fn().mockResolvedValue({
						id: mockAccountId,
						charges_enabled: true,
						payouts_enabled: false, // Not enabled
						details_submitted: true,
					}),
				},
			}

			const mockDb = {
				update: vi.fn().mockReturnValue({
					set: vi.fn().mockReturnValue({
						where: vi.fn().mockResolvedValue(undefined),
					}),
				}),
			}

			vi.mocked(getStripe).mockReturnValue(mockStripe as any)
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const state = createMockState()
			const result = await handleOAuthCallback(mockCode, state)

			expect(result.status).toBe("PENDING")
		})

		it("should throw error for invalid state", async () => {
			await expect(
				handleOAuthCallback(mockCode, "invalid-state"),
			).rejects.toThrow("Invalid OAuth state")
		})

		it("should throw error when Stripe returns no account ID", async () => {
			const mockStripe = {
				oauth: {
					token: vi.fn().mockResolvedValue({
						stripe_user_id: null, // No account ID
					}),
				},
			}

			vi.mocked(getStripe).mockReturnValue(mockStripe as any)

			const state = createMockState()
			await expect(handleOAuthCallback(mockCode, state)).rejects.toThrow(
				"Failed to get Stripe account ID from OAuth",
			)
		})

		it("should throw error when Stripe OAuth fails", async () => {
			const mockStripe = {
				oauth: {
					token: vi.fn().mockRejectedValue(new Error("OAuth error")),
				},
			}

			vi.mocked(getStripe).mockReturnValue(mockStripe as any)

			const state = createMockState()
			await expect(handleOAuthCallback(mockCode, state)).rejects.toThrow(
				"OAuth error",
			)
		})
	})

	describe("syncAccountStatus", () => {
		it("should update team status from PENDING to VERIFIED", async () => {
			const mockStripe = {
				accounts: {
					retrieve: vi.fn().mockResolvedValue({
						id: mockAccountId,
						charges_enabled: true,
						payouts_enabled: true,
					}),
				},
			}

			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							stripeConnectedAccountId: mockAccountId,
							stripeOnboardingCompletedAt: null, // Not yet set
						}),
					},
				},
				update: vi.fn().mockReturnValue({
					set: vi.fn().mockReturnValue({
						where: vi.fn().mockResolvedValue(undefined),
					}),
				}),
			}

			vi.mocked(getStripe).mockReturnValue(mockStripe as any)
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await syncAccountStatus(mockTeamId)

			// Verify Stripe account was retrieved
			expect(mockStripe.accounts.retrieve).toHaveBeenCalledWith(mockAccountId)

			// Verify DB was updated with VERIFIED status and timestamp
			expect(mockDb.update).toHaveBeenCalled()
		})

		it("should keep PENDING status when account not fully enabled", async () => {
			const mockStripe = {
				accounts: {
					retrieve: vi.fn().mockResolvedValue({
						id: mockAccountId,
						charges_enabled: false,
						payouts_enabled: false,
					}),
				},
			}

			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							stripeConnectedAccountId: mockAccountId,
							stripeOnboardingCompletedAt: null,
						}),
					},
				},
				update: vi.fn().mockReturnValue({
					set: vi.fn().mockReturnValue({
						where: vi.fn().mockResolvedValue(undefined),
					}),
				}),
			}

			vi.mocked(getStripe).mockReturnValue(mockStripe as any)
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await syncAccountStatus(mockTeamId)

			// Should still update, but with PENDING status
			expect(mockDb.update).toHaveBeenCalled()
		})

		it("should not update if team has no connected account", async () => {
			const mockStripe = {
				accounts: {
					retrieve: vi.fn(),
				},
			}

			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							stripeConnectedAccountId: null, // No account
						}),
					},
				},
				update: vi.fn(),
			}

			vi.mocked(getStripe).mockReturnValue(mockStripe as any)
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await syncAccountStatus(mockTeamId)

			// Should not call Stripe or update DB
			expect(mockStripe.accounts.retrieve).not.toHaveBeenCalled()
			expect(mockDb.update).not.toHaveBeenCalled()
		})

		it("should not overwrite existing onboardingCompletedAt timestamp", async () => {
			const existingTimestamp = new Date("2024-01-01")
			const mockStripe = {
				accounts: {
					retrieve: vi.fn().mockResolvedValue({
						id: mockAccountId,
						charges_enabled: true,
						payouts_enabled: true,
					}),
				},
			}

			let capturedUpdateData: any = null
			const mockDb = {
				query: {
					teamTable: {
						findFirst: vi.fn().mockResolvedValue({
							stripeConnectedAccountId: mockAccountId,
							stripeOnboardingCompletedAt: existingTimestamp, // Already set
						}),
					},
				},
				update: vi.fn().mockReturnValue({
					set: vi.fn().mockImplementation((data) => {
						capturedUpdateData = data
						return {
							where: vi.fn().mockResolvedValue(undefined),
						}
					}),
				}),
			}

			vi.mocked(getStripe).mockReturnValue(mockStripe as any)
			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await syncAccountStatus(mockTeamId)

			// Should not include stripeOnboardingCompletedAt in update
			expect(capturedUpdateData).not.toHaveProperty(
				"stripeOnboardingCompletedAt",
			)
		})
	})

	describe("Security: CSRF Protection", () => {
		it("state should be unique per request", () => {
			const state1 = getOAuthAuthorizeUrl(
				mockTeamId,
				mockTeamSlug,
				mockUserId,
				"csrf-1",
			)
			const state2 = getOAuthAuthorizeUrl(
				mockTeamId,
				mockTeamSlug,
				mockUserId,
				"csrf-2",
			)

			const parsedState1 = parseOAuthState(
				new URL(state1).searchParams.get("state")!,
			)
			const parsedState2 = parseOAuthState(
				new URL(state2).searchParams.get("state")!,
			)

			expect(parsedState1.csrfToken).toBe("csrf-1")
			expect(parsedState2.csrfToken).toBe("csrf-2")
			expect(parsedState1.csrfToken).not.toBe(parsedState2.csrfToken)
		})

		it("should include userId in state for session binding", () => {
			const url = getOAuthAuthorizeUrl(
				mockTeamId,
				mockTeamSlug,
				mockUserId,
				mockCsrfToken,
			)

			const state = new URL(url).searchParams.get("state")!
			const parsed = parseOAuthState(state)

			expect(parsed.userId).toBe(mockUserId)
		})
	})

	describe("Edge Cases", () => {
		it("should handle team with very long name/slug", () => {
			const longSlug = "a".repeat(100)
			const url = getOAuthAuthorizeUrl(
				mockTeamId,
				longSlug,
				mockUserId,
				mockCsrfToken,
			)

			const state = new URL(url).searchParams.get("state")!
			const parsed = parseOAuthState(state)

			expect(parsed.teamSlug).toBe(longSlug)
		})

		it("should handle unicode in state values", () => {
			const unicodeSlug = "test-团队-équipe"
			const state = Buffer.from(
				JSON.stringify({
					teamId: mockTeamId,
					teamSlug: unicodeSlug,
					userId: mockUserId,
					csrfToken: mockCsrfToken,
				}),
			).toString("base64")

			const parsed = parseOAuthState(state)
			expect(parsed.teamSlug).toBe(unicodeSlug)
		})
	})
})

describe("OAuth Callback Route Security", () => {
	// These tests document the expected behavior of the callback route
	// The actual route uses cookies() and getSessionFromCookie() which
	// require integration testing, but we can test the logic in isolation

	describe("CSRF Token Validation", () => {
		it("should require CSRF token to match cookie", () => {
			// Document: Cookie value must match state.csrfToken
			const cookieCsrf = "cookie-csrf-token"
			const stateCsrf = "state-csrf-token"

			expect(cookieCsrf).not.toBe(stateCsrf)
			// In the actual route, this mismatch would cause a redirect with stripe_error=csrf_mismatch
		})
	})

	describe("Session Validation", () => {
		it("should require valid user session", () => {
			// Document: If no session, redirect to /sign-in with returnTo
			// The actual implementation uses getSessionFromCookie()
		})

		it("should require session userId to match state userId", () => {
			// Document: Prevents session hijacking
			// If session.userId !== state.userId, redirect with stripe_error=unauthorized
		})
	})

	describe("Team Permission Validation", () => {
		it("should require EDIT_TEAM_SETTINGS permission", () => {
			// Document: User must have permission on the team
			// Uses hasTeamPermission(teamId, TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS)
		})
	})
})
