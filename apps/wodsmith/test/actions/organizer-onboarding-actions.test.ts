import {
	submitOrganizerRequestAction,
	getOrganizerRequestStatusAction,
} from "@/actions/organizer-onboarding-actions"
import { ZSAError } from "@repo/zsa"
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest"
import { getSessionFromCookie } from "@/utils/auth"
import { hasTeamPermission } from "@/utils/team-auth"
import { validateTurnstileToken } from "@/utils/validate-captcha"
import {
	getOrganizerRequest,
	hasPendingOrganizerRequest,
	isApprovedOrganizer,
	submitOrganizerRequest,
} from "@/server/organizer-onboarding"
import type { SessionWithMeta } from "@/types"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { createTestSession } from "@repo/test-utils/factories"

// Mock dependencies
vi.mock("@/utils/auth", () => ({
	getSessionFromCookie: vi.fn(),
}))

vi.mock("@/utils/team-auth", () => ({
	hasTeamPermission: vi.fn(),
}))

vi.mock("@/utils/validate-captcha", () => ({
	validateTurnstileToken: vi.fn(),
}))

vi.mock("@/server/organizer-onboarding", () => ({
	getOrganizerRequest: vi.fn(),
	hasPendingOrganizerRequest: vi.fn(),
	isApprovedOrganizer: vi.fn(),
	submitOrganizerRequest: vi.fn(),
}))

vi.mock("@/db", () => ({
	getDb: vi.fn(() => ({
		query: {
			teamMembershipTable: {
				findFirst: vi.fn(),
			},
		},
	})),
}))

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}))

const mockSession: SessionWithMeta = createTestSession({
	userId: "user-123",
	teamId: "team-123",
	teamSlug: "test-team",
	teamRole: "owner",
	permissions: [
		TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
		TEAM_PERMISSIONS.ACCESS_DASHBOARD,
	],
})

beforeEach(async () => {
	vi.clearAllMocks()
	vi.mocked(getSessionFromCookie).mockResolvedValue(mockSession)
	vi.mocked(hasTeamPermission).mockResolvedValue(true)
	vi.mocked(validateTurnstileToken).mockResolvedValue(true)
	vi.mocked(submitOrganizerRequest).mockResolvedValue({
		id: "request-123",
		teamId: "team-123",
		userId: "user-123",
		reason: "Want to organize competitions",
		status: "pending",
		createdAt: new Date(),
		updatedAt: new Date(),
	} as any)
	vi.mocked(getOrganizerRequest).mockResolvedValue({
		id: "request-123",
		teamId: "team-123",
		userId: "user-123",
		reason: "Want to organize competitions",
		status: "pending",
		createdAt: new Date(),
		updatedAt: new Date(),
	} as any)
	vi.mocked(hasPendingOrganizerRequest).mockResolvedValue(true)
	vi.mocked(isApprovedOrganizer).mockResolvedValue(false)

	// Setup default DB mock
	const { getDb } = await import("@/db")
	vi.mocked(getDb).mockReturnValue({
		query: {
			teamMembershipTable: {
				findFirst: vi.fn().mockResolvedValue(null),
			},
		},
	} as any)
})

afterEach(() => {
	vi.clearAllMocks()
})

describe("organizer-onboarding-actions", () => {
	describe("submitOrganizerRequestAction", () => {
		const validInput = {
			teamId: "team-123",
			reason: "I want to organize competitions for my gym",
			captchaToken: "valid-captcha-token",
		}

		it("should successfully submit an organizer request with valid input", async () => {
			const [data, err] = await submitOrganizerRequestAction(validInput)

			expect(err).toBeNull()
			expect(data).toBeDefined()
			expect(data?.success).toBe(true)
			expect(data?.data.id).toBe("request-123")
			expect(submitOrganizerRequest).toHaveBeenCalledWith({
				teamId: "team-123",
				userId: "user-123",
				reason: "I want to organize competitions for my gym",
			})
		})

		it("should validate captcha token if provided", async () => {
			await submitOrganizerRequestAction(validInput)

			expect(validateTurnstileToken).toHaveBeenCalledWith("valid-captcha-token")
		})

		it("should reject request with invalid captcha token", async () => {
			vi.mocked(validateTurnstileToken).mockResolvedValue(false)

			const [data, err] = await submitOrganizerRequestAction(validInput)

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.message).toContain("Invalid captcha")
		})

		it("should skip captcha validation if token not provided", async () => {
			const inputWithoutCaptcha = {
				teamId: "team-123",
				reason: "I want to organize competitions for my gym",
			}

			await submitOrganizerRequestAction(inputWithoutCaptcha)

			expect(validateTurnstileToken).not.toHaveBeenCalled()
			expect(submitOrganizerRequest).toHaveBeenCalled()
		})

		it("should reject request when user is not authenticated", async () => {
			vi.mocked(getSessionFromCookie).mockResolvedValue(null)

			const [data, err] = await submitOrganizerRequestAction(validInput)

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.message).toContain("You must be logged in")
		})

		it("should reject request when session has no user", async () => {
			vi.mocked(getSessionFromCookie).mockResolvedValue({
				...mockSession,
				user: null,
			} as any)

			const [data, err] = await submitOrganizerRequestAction(validInput)

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.message).toContain("You must be logged in")
		})

		it("should reject request when user lacks EDIT_TEAM_SETTINGS permission", async () => {
			vi.mocked(hasTeamPermission).mockResolvedValue(false)
			const { getDb } = await import("@/db")
			vi.mocked(getDb).mockReturnValue({
				query: {
					teamMembershipTable: {
						findFirst: vi.fn().mockResolvedValue(null),
					},
				},
			} as any)

			const [data, err] = await submitOrganizerRequestAction(validInput)

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.message).toContain("don't have permission")
			expect(hasTeamPermission).toHaveBeenCalledWith(
				"team-123",
				TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
			)
		})

		it("should check team permission for EDIT_TEAM_SETTINGS", async () => {
			await submitOrganizerRequestAction(validInput)

			expect(hasTeamPermission).toHaveBeenCalledWith(
				"team-123",
				TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
			)
		})

		it("should validate reason field - too short", async () => {
			const [data, err] = await submitOrganizerRequestAction({
				...validInput,
				reason: "Short",
			})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.message).toContain("Please provide more detail")
		})

		it("should validate reason field - too long", async () => {
			const longReason = "a".repeat(2001)
			const [data, err] = await submitOrganizerRequestAction({
				...validInput,
				reason: longReason,
			})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.message).toContain("too long")
		})

		it("should validate teamId is required", async () => {
			const [data, err] = await submitOrganizerRequestAction({
				...validInput,
				teamId: "",
			})

			expect(data).toBeNull()
			expect(err).toBeDefined()
		})

		it("should handle error from submitOrganizerRequest server function", async () => {
			vi.mocked(submitOrganizerRequest).mockRejectedValue(
				new Error("Database error"),
			)

			const [data, err] = await submitOrganizerRequestAction(validInput)

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.message).toContain("Database error")
		})

		it("should handle ZSAError from submitOrganizerRequest", async () => {
			vi.mocked(submitOrganizerRequest).mockRejectedValue(
				new ZSAError("CONFLICT", "Request already exists"),
			)

			const [data, err] = await submitOrganizerRequestAction(validInput)

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.message).toContain("Request already exists")
		})

		it("should call revalidatePath after successful submission", async () => {
			const { revalidatePath } = await import("next/cache")

			await submitOrganizerRequestAction(validInput)

			expect(revalidatePath).toHaveBeenCalledWith("/compete/organizer")
			expect(revalidatePath).toHaveBeenCalledWith("/compete/organizer/onboard")
		})

		it("should not call submitOrganizerRequest if permission check fails", async () => {
			vi.mocked(hasTeamPermission).mockResolvedValue(false)
			const { getDb } = await import("@/db")
			vi.mocked(getDb).mockReturnValue({
				query: {
					teamMembershipTable: {
						findFirst: vi.fn().mockResolvedValue(null),
					},
				},
			} as any)

			await submitOrganizerRequestAction(validInput)

			expect(submitOrganizerRequest).not.toHaveBeenCalled()
		})

		it("should not call submitOrganizerRequest if captcha validation fails", async () => {
			vi.mocked(validateTurnstileToken).mockResolvedValue(false)

			await submitOrganizerRequestAction(validInput)

			expect(submitOrganizerRequest).not.toHaveBeenCalled()
		})

		it("should include userId from session in server function call", async () => {
			await submitOrganizerRequestAction(validInput)

			expect(submitOrganizerRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
				}),
			)
		})

		it("should include reason from input in server function call", async () => {
			const reasonText = "I want to organize competitions for my gym"
			await submitOrganizerRequestAction({
				...validInput,
				reason: reasonText,
			})

			expect(submitOrganizerRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					reason: reasonText,
				}),
			)
		})
	})

	describe("getOrganizerRequestStatusAction", () => {
		const validInput = {
			teamId: "team-123",
		}

		it("should successfully get organizer request status", async () => {
			const [data, err] = await getOrganizerRequestStatusAction(validInput)

			expect(err).toBeNull()
			expect(data).toBeDefined()
			expect(data?.success).toBe(true)
			expect(data?.data.request.id).toBe("request-123")
			expect(data?.data.isPending).toBe(true)
			expect(data?.data.isApproved).toBe(false)
			expect(data?.data.hasNoRequest).toBe(false)
		})

		it("should reject request when user is not authenticated", async () => {
			vi.mocked(getSessionFromCookie).mockResolvedValue(null)

			const [data, err] = await getOrganizerRequestStatusAction(validInput)

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.message).toContain("You must be logged in")
		})

		it("should reject request when session has no user", async () => {
			vi.mocked(getSessionFromCookie).mockResolvedValue({
				...mockSession,
				user: null,
			} as any)

			const [data, err] = await getOrganizerRequestStatusAction(validInput)

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.message).toContain("You must be logged in")
		})

		it("should reject request when user lacks ACCESS_DASHBOARD permission", async () => {
			vi.mocked(hasTeamPermission).mockResolvedValue(false)

			const [data, err] = await getOrganizerRequestStatusAction(validInput)

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.message).toContain("don't have permission")
		})

		it("should check team permission for ACCESS_DASHBOARD", async () => {
			await getOrganizerRequestStatusAction(validInput)

			expect(hasTeamPermission).toHaveBeenCalledWith(
				"team-123",
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)
		})

		it("should return isPending true when request is pending", async () => {
			vi.mocked(hasPendingOrganizerRequest).mockResolvedValue(true)

			const [data, err] = await getOrganizerRequestStatusAction(validInput)

			expect(err).toBeNull()
			expect(data?.data.isPending).toBe(true)
		})

		it("should return isPending false when request is not pending", async () => {
			vi.mocked(hasPendingOrganizerRequest).mockResolvedValue(false)

			const [data, err] = await getOrganizerRequestStatusAction(validInput)

			expect(err).toBeNull()
			expect(data?.data.isPending).toBe(false)
		})

		it("should return isApproved true when organizer is approved", async () => {
			vi.mocked(isApprovedOrganizer).mockResolvedValue(true)

			const [data, err] = await getOrganizerRequestStatusAction(validInput)

			expect(err).toBeNull()
			expect(data?.data.isApproved).toBe(true)
		})

		it("should return isApproved false when organizer is not approved", async () => {
			vi.mocked(isApprovedOrganizer).mockResolvedValue(false)

			const [data, err] = await getOrganizerRequestStatusAction(validInput)

			expect(err).toBeNull()
			expect(data?.data.isApproved).toBe(false)
		})

		it("should return hasNoRequest true when there is no request", async () => {
			vi.mocked(getOrganizerRequest).mockResolvedValue(null)

			const [data, err] = await getOrganizerRequestStatusAction(validInput)

			expect(err).toBeNull()
			expect(data?.data.hasNoRequest).toBe(true)
			expect(data?.data.request).toBeNull()
		})

		it("should return hasNoRequest false when there is a request", async () => {
			vi.mocked(getOrganizerRequest).mockResolvedValue({
				id: "request-123",
			} as any)

			const [data, err] = await getOrganizerRequestStatusAction(validInput)

			expect(err).toBeNull()
			expect(data?.data.hasNoRequest).toBe(false)
		})

		it("should call all three server functions", async () => {
			await getOrganizerRequestStatusAction(validInput)

			expect(getOrganizerRequest).toHaveBeenCalledWith("team-123")
			expect(hasPendingOrganizerRequest).toHaveBeenCalledWith("team-123")
			expect(isApprovedOrganizer).toHaveBeenCalledWith("team-123")
		})

		it("should validate teamId is required", async () => {
			const [data, err] = await getOrganizerRequestStatusAction({
				teamId: "",
			})

			expect(data).toBeNull()
			expect(err).toBeDefined()
		})

		it("should handle error from getOrganizerRequest", async () => {
			vi.mocked(getOrganizerRequest).mockRejectedValue(new Error("DB error"))

			const [data, err] = await getOrganizerRequestStatusAction(validInput)

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.message).toContain("Failed to get organizer request status")
		})

		it("should handle error from hasPendingOrganizerRequest", async () => {
			vi.mocked(hasPendingOrganizerRequest).mockRejectedValue(
				new Error("DB error"),
			)

			const [data, err] = await getOrganizerRequestStatusAction(validInput)

			expect(data).toBeNull()
			expect(err).toBeDefined()
		})

		it("should handle error from isApprovedOrganizer", async () => {
			vi.mocked(isApprovedOrganizer).mockRejectedValue(new Error("DB error"))

			const [data, err] = await getOrganizerRequestStatusAction(validInput)

			expect(data).toBeNull()
			expect(err).toBeDefined()
		})

		it("should handle ZSAError thrown by permission check", async () => {
			vi.mocked(hasTeamPermission).mockRejectedValue(
				new ZSAError("FORBIDDEN", "Not authorized"),
			)

			const [data, err] = await getOrganizerRequestStatusAction(validInput)

			expect(data).toBeNull()
			expect(err).toBeDefined()
		})

		it("should not call server functions if permission check fails", async () => {
			vi.mocked(hasTeamPermission).mockResolvedValue(false)

			await getOrganizerRequestStatusAction(validInput)

			expect(getOrganizerRequest).not.toHaveBeenCalled()
			expect(hasPendingOrganizerRequest).not.toHaveBeenCalled()
			expect(isApprovedOrganizer).not.toHaveBeenCalled()
		})

		it("should return all status flags in data object", async () => {
			const [data, err] = await getOrganizerRequestStatusAction(validInput)

			expect(err).toBeNull()
			expect(data?.data).toHaveProperty("request")
			expect(data?.data).toHaveProperty("isPending")
			expect(data?.data).toHaveProperty("isApproved")
			expect(data?.data).toHaveProperty("hasNoRequest")
		})

		it("should handle case where request exists but status is approved", async () => {
			vi.mocked(getOrganizerRequest).mockResolvedValue({
				id: "request-123",
				status: "approved",
			} as any)
			vi.mocked(isApprovedOrganizer).mockResolvedValue(true)
			vi.mocked(hasPendingOrganizerRequest).mockResolvedValue(false)

			const [data, err] = await getOrganizerRequestStatusAction(validInput)

			expect(err).toBeNull()
			expect(data?.data.request).toBeDefined()
			expect(data?.data.isApproved).toBe(true)
			expect(data?.data.isPending).toBe(false)
			expect(data?.data.hasNoRequest).toBe(false)
		})

		it("should handle case where request exists but status is pending", async () => {
			vi.mocked(getOrganizerRequest).mockResolvedValue({
				id: "request-123",
				status: "pending",
			} as any)
			vi.mocked(isApprovedOrganizer).mockResolvedValue(false)
			vi.mocked(hasPendingOrganizerRequest).mockResolvedValue(true)

			const [data, err] = await getOrganizerRequestStatusAction(validInput)

			expect(err).toBeNull()
			expect(data?.data.request).toBeDefined()
			expect(data?.data.isPending).toBe(true)
			expect(data?.data.isApproved).toBe(false)
			expect(data?.data.hasNoRequest).toBe(false)
		})
	})
})
