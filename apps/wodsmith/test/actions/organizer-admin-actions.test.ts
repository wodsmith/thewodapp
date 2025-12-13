import {
	getPendingOrganizerRequestsAction,
	approveOrganizerRequestAction,
	rejectOrganizerRequestAction,
} from "@/app/(admin)/admin/_actions/organizer-admin-actions"
import { requireAdmin } from "@/utils/auth"
import {
	getPendingOrganizerRequests,
	approveOrganizerRequest,
	rejectOrganizerRequest,
} from "@/server/organizer-onboarding"
import { revalidatePath } from "next/cache"
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest"
import { ZSAError } from "@repo/zsa"
import type { SessionWithMeta } from "@/types"

// Mock dependencies
vi.mock("@/utils/auth", () => ({
	requireAdmin: vi.fn(),
}))

vi.mock("@/server/organizer-onboarding", () => ({
	getPendingOrganizerRequests: vi.fn(),
	approveOrganizerRequest: vi.fn(),
	rejectOrganizerRequest: vi.fn(),
}))

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}))

// Mock session for admin user
const mockAdminSession: SessionWithMeta = {
	id: "session-admin-123",
	userId: "admin-user-123",
	expiresAt: Date.now() + 86400000,
	createdAt: Date.now(),
	isCurrentSession: true,
	user: {
		id: "admin-user-123",
		email: "admin@example.com",
		firstName: "Admin",
		lastName: "User",
		emailVerified: new Date(),
		role: "admin",
		avatar: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		currentCredits: 100,
		lastCreditRefreshAt: null,
	},
	teams: [],
}

const mockPendingRequest = {
	id: "request-123",
	userId: "user-123",
	email: "organizer@example.com",
	organizationName: "Test Org",
	reason: "Want to run competitions",
	status: "pending" as const,
	createdAt: new Date(),
}

beforeEach(() => {
	vi.clearAllMocks()
	vi.mocked(requireAdmin).mockResolvedValue(mockAdminSession)
	vi.mocked(getPendingOrganizerRequests).mockResolvedValue([])
	vi.mocked(approveOrganizerRequest).mockResolvedValue({ success: true })
	vi.mocked(rejectOrganizerRequest).mockResolvedValue({ success: true })
})

afterEach(() => {
	vi.clearAllMocks()
})

describe("organizer admin actions", () => {
	describe("getPendingOrganizerRequestsAction", () => {
		it("should return pending organizer requests when user is admin", async () => {
			const mockRequests = [mockPendingRequest]
			vi.mocked(getPendingOrganizerRequests).mockResolvedValue(mockRequests)

			const [data, err] = await getPendingOrganizerRequestsAction({})

			expect(err).toBeNull()
			expect(data).toBeDefined()
			expect(data?.success).toBe(true)
			expect(data?.data).toEqual(mockRequests)
			expect(requireAdmin).toHaveBeenCalledOnce()
			expect(getPendingOrganizerRequests).toHaveBeenCalledOnce()
		})

		it("should return empty list when there are no pending requests", async () => {
			vi.mocked(getPendingOrganizerRequests).mockResolvedValue([])

			const [data, err] = await getPendingOrganizerRequestsAction({})

			expect(err).toBeNull()
			expect(data?.success).toBe(true)
			expect(data?.data).toEqual([])
		})

		it("should throw error when user is not admin", async () => {
			vi.mocked(requireAdmin).mockRejectedValue(
				new ZSAError("FORBIDDEN", "Not authorized")
			)

			const [data, err] = await getPendingOrganizerRequestsAction({})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.code).toBe("FORBIDDEN")
			expect(getPendingOrganizerRequests).not.toHaveBeenCalled()
		})

		it("should handle database errors and convert to INTERNAL_SERVER_ERROR", async () => {
			vi.mocked(getPendingOrganizerRequests).mockRejectedValue(
				new Error("Database connection failed")
			)

			const [data, err] = await getPendingOrganizerRequestsAction({})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.code).toBe("INTERNAL_SERVER_ERROR")
			expect(err?.message).toBe("Failed to get pending organizer requests")
		})

		it("should propagate ZSAError from server function", async () => {
			const zsaError = new ZSAError("NOT_FOUND", "No requests found")
			vi.mocked(getPendingOrganizerRequests).mockRejectedValue(zsaError)

			const [data, err] = await getPendingOrganizerRequestsAction({})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.code).toBe("NOT_FOUND")
			expect(err?.message).toBe("No requests found")
		})

		it("should return multiple pending requests", async () => {
			const mockRequests = [
				mockPendingRequest,
				{
					...mockPendingRequest,
					id: "request-124",
					email: "organizer2@example.com",
				},
			]
			vi.mocked(getPendingOrganizerRequests).mockResolvedValue(mockRequests)

			const [data, err] = await getPendingOrganizerRequestsAction({})

			expect(err).toBeNull()
			expect(data?.data).toHaveLength(2)
			expect(data?.data).toEqual(mockRequests)
		})
	})

	describe("approveOrganizerRequestAction", () => {
		it("should approve organizer request with valid input", async () => {
			const mockResult = { ...mockPendingRequest, status: "approved" as const }
			vi.mocked(approveOrganizerRequest).mockResolvedValue(mockResult)

			const [data, err] = await approveOrganizerRequestAction({
				requestId: "request-123",
				adminNotes: "Approved - legitimate organizer",
			})

			expect(err).toBeNull()
			expect(data?.success).toBe(true)
			expect(data?.data).toEqual(mockResult)
			expect(approveOrganizerRequest).toHaveBeenCalledWith({
				requestId: "request-123",
				adminUserId: "admin-user-123",
				adminNotes: "Approved - legitimate organizer",
			})
			expect(revalidatePath).toHaveBeenCalledWith("/admin/organizer-requests")
			expect(revalidatePath).toHaveBeenCalledWith("/compete/organizer")
		})

		it("should approve request without optional adminNotes", async () => {
			const mockResult = { ...mockPendingRequest, status: "approved" as const }
			vi.mocked(approveOrganizerRequest).mockResolvedValue(mockResult)

			const [data, err] = await approveOrganizerRequestAction({
				requestId: "request-123",
			})

			expect(err).toBeNull()
			expect(data?.success).toBe(true)
			expect(approveOrganizerRequest).toHaveBeenCalledWith({
				requestId: "request-123",
				adminUserId: "admin-user-123",
				adminNotes: undefined,
			})
		})

		it("should reject approval when user is not admin", async () => {
			vi.mocked(requireAdmin).mockRejectedValue(
				new ZSAError("FORBIDDEN", "Not authorized")
			)

			const [data, err] = await approveOrganizerRequestAction({
				requestId: "request-123",
			})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.code).toBe("FORBIDDEN")
			expect(approveOrganizerRequest).not.toHaveBeenCalled()
		})

		it("should reject approval with missing requestId", async () => {
			const [data, err] = await approveOrganizerRequestAction({
				requestId: "",
			})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.code).toBe("INPUT_PARSE_ERROR")
		})

		it("should reject approval with notes exceeding max length", async () => {
			const longNotes = "a".repeat(2001)

			const [data, err] = await approveOrganizerRequestAction({
				requestId: "request-123",
				adminNotes: longNotes,
			})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.code).toBe("INPUT_PARSE_ERROR")
		})

		it("should handle server function errors", async () => {
			vi.mocked(approveOrganizerRequest).mockRejectedValue(
				new Error("Request not found")
			)

			const [data, err] = await approveOrganizerRequestAction({
				requestId: "nonexistent-123",
			})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.code).toBe("INTERNAL_SERVER_ERROR")
			expect(err?.message).toBe("Request not found")
		})

		it("should propagate ZSAError from server function", async () => {
			const zsaError = new ZSAError("NOT_FOUND", "Request not found")
			vi.mocked(approveOrganizerRequest).mockRejectedValue(zsaError)

			const [data, err] = await approveOrganizerRequestAction({
				requestId: "nonexistent-123",
			})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.code).toBe("NOT_FOUND")
			expect(err?.message).toBe("Request not found")
		})

		it("should revalidate all relevant paths on success", async () => {
			vi.mocked(approveOrganizerRequest).mockResolvedValue({
				success: true,
			} as any)

			await approveOrganizerRequestAction({
				requestId: "request-123",
			})

			expect(revalidatePath).toHaveBeenNthCalledWith(
				1,
				"/admin/organizer-requests"
			)
			expect(revalidatePath).toHaveBeenNthCalledWith(2, "/compete/organizer")
			expect(revalidatePath).toHaveBeenCalledTimes(2)
		})

		it("should pass correct admin user ID from session", async () => {
			vi.mocked(approveOrganizerRequest).mockResolvedValue({ success: true } as any)

			await approveOrganizerRequestAction({
				requestId: "request-123",
			})

			expect(approveOrganizerRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					adminUserId: "admin-user-123",
				})
			)
		})
	})

	describe("rejectOrganizerRequestAction", () => {
		it("should reject organizer request with valid input", async () => {
			const mockResult = { ...mockPendingRequest, status: "rejected" as const }
			vi.mocked(rejectOrganizerRequest).mockResolvedValue(mockResult)

			const [data, err] = await rejectOrganizerRequestAction({
				requestId: "request-123",
				adminNotes: "Rejected - insufficient credentials",
				revokeFeature: false,
			})

			expect(err).toBeNull()
			expect(data?.success).toBe(true)
			expect(data?.data).toEqual(mockResult)
			expect(rejectOrganizerRequest).toHaveBeenCalledWith({
				requestId: "request-123",
				adminUserId: "admin-user-123",
				adminNotes: "Rejected - insufficient credentials",
				revokeFeature: false,
			})
			expect(revalidatePath).toHaveBeenCalledWith("/admin/organizer-requests")
			expect(revalidatePath).toHaveBeenCalledWith("/compete/organizer")
		})

		it("should reject request without optional adminNotes", async () => {
			const mockResult = { ...mockPendingRequest, status: "rejected" as const }
			vi.mocked(rejectOrganizerRequest).mockResolvedValue(mockResult)

			const [data, err] = await rejectOrganizerRequestAction({
				requestId: "request-123",
				revokeFeature: false,
			})

			expect(err).toBeNull()
			expect(data?.success).toBe(true)
			expect(rejectOrganizerRequest).toHaveBeenCalledWith({
				requestId: "request-123",
				adminUserId: "admin-user-123",
				adminNotes: undefined,
				revokeFeature: false,
			})
		})

		it("should use default revokeFeature value of false", async () => {
			vi.mocked(rejectOrganizerRequest).mockResolvedValue({ success: true } as any)

			const [data, err] = await rejectOrganizerRequestAction({
				requestId: "request-123",
			})

			expect(err).toBeNull()
			expect(rejectOrganizerRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					revokeFeature: false,
				})
			)
		})

		it("should reject request with revokeFeature=true", async () => {
			vi.mocked(rejectOrganizerRequest).mockResolvedValue({ success: true } as any)

			const [data, err] = await rejectOrganizerRequestAction({
				requestId: "request-123",
				revokeFeature: true,
			})

			expect(err).toBeNull()
			expect(rejectOrganizerRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					revokeFeature: true,
				})
			)
		})

		it("should reject rejection when user is not admin", async () => {
			vi.mocked(requireAdmin).mockRejectedValue(
				new ZSAError("FORBIDDEN", "Not authorized")
			)

			const [data, err] = await rejectOrganizerRequestAction({
				requestId: "request-123",
			})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.code).toBe("FORBIDDEN")
			expect(rejectOrganizerRequest).not.toHaveBeenCalled()
		})

		it("should reject rejection with missing requestId", async () => {
			const [data, err] = await rejectOrganizerRequestAction({
				requestId: "",
			})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.code).toBe("INPUT_PARSE_ERROR")
		})

		it("should reject rejection with notes exceeding max length", async () => {
			const longNotes = "a".repeat(2001)

			const [data, err] = await rejectOrganizerRequestAction({
				requestId: "request-123",
				adminNotes: longNotes,
			})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.code).toBe("INPUT_PARSE_ERROR")
		})

		it("should handle server function errors", async () => {
			vi.mocked(rejectOrganizerRequest).mockRejectedValue(
				new Error("Request not found")
			)

			const [data, err] = await rejectOrganizerRequestAction({
				requestId: "nonexistent-123",
			})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.code).toBe("INTERNAL_SERVER_ERROR")
			expect(err?.message).toBe("Request not found")
		})

		it("should propagate ZSAError from server function", async () => {
			const zsaError = new ZSAError("NOT_FOUND", "Request not found")
			vi.mocked(rejectOrganizerRequest).mockRejectedValue(zsaError)

			const [data, err] = await rejectOrganizerRequestAction({
				requestId: "nonexistent-123",
			})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.code).toBe("NOT_FOUND")
			expect(err?.message).toBe("Request not found")
		})

		it("should revalidate all relevant paths on success", async () => {
			vi.mocked(rejectOrganizerRequest).mockResolvedValue({
				success: true,
			} as any)

			await rejectOrganizerRequestAction({
				requestId: "request-123",
			})

			expect(revalidatePath).toHaveBeenNthCalledWith(
				1,
				"/admin/organizer-requests"
			)
			expect(revalidatePath).toHaveBeenNthCalledWith(2, "/compete/organizer")
			expect(revalidatePath).toHaveBeenCalledTimes(2)
		})

		it("should pass correct admin user ID from session", async () => {
			vi.mocked(rejectOrganizerRequest).mockResolvedValue({ success: true } as any)

			await rejectOrganizerRequestAction({
				requestId: "request-123",
			})

			expect(rejectOrganizerRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					adminUserId: "admin-user-123",
				})
			)
		})

		it("should handle revoke feature flag correctly when set", async () => {
			vi.mocked(rejectOrganizerRequest).mockResolvedValue({ success: true } as any)

			await rejectOrganizerRequestAction({
				requestId: "request-123",
				adminNotes: "Revoking access due to violation",
				revokeFeature: true,
			})

			expect(rejectOrganizerRequest).toHaveBeenCalledWith({
				requestId: "request-123",
				adminUserId: "admin-user-123",
				adminNotes: "Revoking access due to violation",
				revokeFeature: true,
			})
		})

		it("should handle multiple rejections with different revokeFeature values", async () => {
			vi.mocked(rejectOrganizerRequest).mockResolvedValue({ success: true } as any)

			// First rejection without revoke
			await rejectOrganizerRequestAction({
				requestId: "request-123",
				revokeFeature: false,
			})

			expect(rejectOrganizerRequest).toHaveBeenLastCalledWith(
				expect.objectContaining({
					revokeFeature: false,
				})
			)

			// Second rejection with revoke
			await rejectOrganizerRequestAction({
				requestId: "request-124",
				revokeFeature: true,
			})

			expect(rejectOrganizerRequest).toHaveBeenLastCalledWith(
				expect.objectContaining({
					revokeFeature: true,
				})
			)
		})
	})

	describe("error handling across all actions", () => {
		it("should log errors to console", async () => {
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			vi.mocked(getPendingOrganizerRequests).mockRejectedValue(
				new Error("Test error")
			)

			await getPendingOrganizerRequestsAction({})

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Failed to get pending organizer requests:",
				expect.any(Error)
			)

			consoleErrorSpy.mockRestore()
		})

		it("should handle unknown error types", async () => {
			vi.mocked(approveOrganizerRequest).mockRejectedValue("String error")

			const [data, err] = await approveOrganizerRequestAction({
				requestId: "request-123",
			})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.code).toBe("INTERNAL_SERVER_ERROR")
		})
	})
})
