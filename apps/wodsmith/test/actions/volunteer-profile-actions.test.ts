import { beforeEach, describe, expect, it, vi } from "vitest"
import { ZSAError } from "@repo/zsa"
import type { SessionWithMeta } from "@/types"

// Mock dependencies before importing the action
vi.mock("@/db", () => ({
	getDb: vi.fn(),
}))

vi.mock("@/utils/auth", () => ({
	getSessionFromCookie: vi.fn(),
}))

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}))

// Import after mocks are set up
import { updateVolunteerProfileAction } from "@/actions/volunteer-actions"
import { getDb } from "@/db"
import { getSessionFromCookie } from "@/utils/auth"
import { revalidatePath } from "next/cache"

// Mock session for volunteer user
const mockVolunteerSession: SessionWithMeta = {
	id: "session-volunteer-123",
	userId: "volunteer-user-123",
	expiresAt: Date.now() + 86400000,
	createdAt: Date.now(),
	isCurrentSession: true,
	user: {
		id: "volunteer-user-123",
		email: "volunteer@example.com",
		firstName: "Volunteer",
		lastName: "User",
		emailVerified: new Date(),
		role: "user",
		avatar: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		currentCredits: 0,
		lastCreditRefreshAt: null,
	},
	teams: [],
}

// Mock session for different user (to test forbidden scenario)
const mockOtherUserSession: SessionWithMeta = {
	...mockVolunteerSession,
	id: "session-other-123",
	userId: "other-user-123",
	user: {
		...mockVolunteerSession.user,
		id: "other-user-123",
		email: "other@example.com",
	},
}

const mockMembership = {
	id: "tmem_volunteer123",
	teamId: "team-123",
	userId: "volunteer-user-123",
	roleId: "volunteer",
	isSystemRole: 1,
	invitedBy: null,
	invitedAt: null,
	joinedAt: new Date(),
	expiresAt: null,
	isActive: 1,
	metadata: JSON.stringify({
		volunteerRoleTypes: ["judge"],
		availability: "morning",
		credentials: "L1 Judge",
	}),
	createdAt: new Date(),
	updatedAt: new Date(),
}

const mockDb = {
	query: {
		teamMembershipTable: {
			findFirst: vi.fn(),
		},
	},
	update: vi.fn().mockReturnThis(),
	set: vi.fn().mockReturnThis(),
	where: vi.fn().mockResolvedValue([mockMembership]),
}

beforeEach(() => {
	vi.clearAllMocks()
	vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)
	vi.mocked(getSessionFromCookie).mockResolvedValue(mockVolunteerSession)
	mockDb.query.teamMembershipTable.findFirst.mockResolvedValue(mockMembership)
})

describe("updateVolunteerProfileAction", () => {
	describe("input validation", () => {
		it("should reject invalid membership ID format", async () => {
			const [data, err] = await updateVolunteerProfileAction({
				membershipId: "invalid-id", // Should start with tmem_
				competitionSlug: "test-competition",
				availability: "morning",
			})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.code).toBe("INPUT_PARSE_ERROR")
		})

		it("should reject empty competition slug", async () => {
			const [data, err] = await updateVolunteerProfileAction({
				membershipId: "tmem_valid123",
				competitionSlug: "",
				availability: "morning",
			})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.code).toBe("INPUT_PARSE_ERROR")
		})

		it("should reject invalid availability value", async () => {
			const [data, err] = await updateVolunteerProfileAction({
				membershipId: "tmem_valid123",
				competitionSlug: "test-competition",
				// @ts-expect-error - Testing invalid input
				availability: "invalid_availability",
			})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.code).toBe("INPUT_PARSE_ERROR")
		})

		it("should accept valid morning availability", async () => {
			const [data, err] = await updateVolunteerProfileAction({
				membershipId: "tmem_volunteer123",
				competitionSlug: "test-competition",
				availability: "morning",
			})

			expect(err).toBeNull()
			expect(data?.success).toBe(true)
		})

		it("should accept valid afternoon availability", async () => {
			const [data, err] = await updateVolunteerProfileAction({
				membershipId: "tmem_volunteer123",
				competitionSlug: "test-competition",
				availability: "afternoon",
			})

			expect(err).toBeNull()
			expect(data?.success).toBe(true)
		})

		it("should accept valid all_day availability", async () => {
			const [data, err] = await updateVolunteerProfileAction({
				membershipId: "tmem_volunteer123",
				competitionSlug: "test-competition",
				availability: "all_day",
			})

			expect(err).toBeNull()
			expect(data?.success).toBe(true)
		})
	})

	describe("authentication", () => {
		it("should reject unauthenticated users", async () => {
			vi.mocked(getSessionFromCookie).mockResolvedValue(null)

			const [data, err] = await updateVolunteerProfileAction({
				membershipId: "tmem_volunteer123",
				competitionSlug: "test-competition",
				availability: "morning",
			})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.code).toBe("NOT_AUTHORIZED")
			expect(err?.message).toBe("You must be logged in")
		})
	})

	describe("authorization", () => {
		it("should reject updates to memberships owned by other users", async () => {
			// User trying to update someone else's membership
			vi.mocked(getSessionFromCookie).mockResolvedValue(mockOtherUserSession)

			const [data, err] = await updateVolunteerProfileAction({
				membershipId: "tmem_volunteer123",
				competitionSlug: "test-competition",
				availability: "morning",
			})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.code).toBe("FORBIDDEN")
			expect(err?.message).toBe("You can only update your own profile")
		})

		it("should allow updates to own membership", async () => {
			const [data, err] = await updateVolunteerProfileAction({
				membershipId: "tmem_volunteer123",
				competitionSlug: "test-competition",
				availability: "all_day",
			})

			expect(err).toBeNull()
			expect(data?.success).toBe(true)
		})
	})

	describe("membership not found", () => {
		it("should return NOT_FOUND when membership does not exist", async () => {
			mockDb.query.teamMembershipTable.findFirst.mockResolvedValue(null)

			const [data, err] = await updateVolunteerProfileAction({
				membershipId: "tmem_nonexistent",
				competitionSlug: "test-competition",
				availability: "morning",
			})

			expect(data).toBeNull()
			expect(err).toBeDefined()
			expect(err?.code).toBe("NOT_FOUND")
			expect(err?.message).toBe("Membership not found")
		})
	})

	describe("metadata updates", () => {
		it("should update availability in metadata", async () => {
			const [data, err] = await updateVolunteerProfileAction({
				membershipId: "tmem_volunteer123",
				competitionSlug: "test-competition",
				availability: "afternoon",
			})

			expect(err).toBeNull()
			expect(data?.success).toBe(true)
			expect(mockDb.update).toHaveBeenCalled()
		})

		it("should update credentials in metadata", async () => {
			const [data, err] = await updateVolunteerProfileAction({
				membershipId: "tmem_volunteer123",
				competitionSlug: "test-competition",
				credentials: "L2 Judge, EMT Certified",
			})

			expect(err).toBeNull()
			expect(data?.success).toBe(true)
			expect(mockDb.update).toHaveBeenCalled()
		})

		it("should update availabilityNotes in metadata", async () => {
			const [data, err] = await updateVolunteerProfileAction({
				membershipId: "tmem_volunteer123",
				competitionSlug: "test-competition",
				availabilityNotes: "Can only work Saturday morning",
			})

			expect(err).toBeNull()
			expect(data?.success).toBe(true)
			expect(mockDb.update).toHaveBeenCalled()
		})

		it("should update multiple fields at once", async () => {
			const [data, err] = await updateVolunteerProfileAction({
				membershipId: "tmem_volunteer123",
				competitionSlug: "test-competition",
				availability: "all_day",
				credentials: "L1 Judge",
				availabilityNotes: "Available both days",
			})

			expect(err).toBeNull()
			expect(data?.success).toBe(true)
			expect(mockDb.update).toHaveBeenCalled()
		})

		it("should handle membership with null metadata", async () => {
			mockDb.query.teamMembershipTable.findFirst.mockResolvedValue({
				...mockMembership,
				metadata: null,
			})

			const [data, err] = await updateVolunteerProfileAction({
				membershipId: "tmem_volunteer123",
				competitionSlug: "test-competition",
				availability: "morning",
			})

			expect(err).toBeNull()
			expect(data?.success).toBe(true)
		})
	})

	describe("cache invalidation", () => {
		it("should revalidate the my-schedule page", async () => {
			await updateVolunteerProfileAction({
				membershipId: "tmem_volunteer123",
				competitionSlug: "summer-throwdown-2024",
				availability: "morning",
			})

			expect(revalidatePath).toHaveBeenCalledWith(
				"/compete/summer-throwdown-2024/my-schedule"
			)
		})

		it("should use correct competition slug in revalidation path", async () => {
			await updateVolunteerProfileAction({
				membershipId: "tmem_volunteer123",
				competitionSlug: "winter-games",
				availability: "afternoon",
			})

			expect(revalidatePath).toHaveBeenCalledWith(
				"/compete/winter-games/my-schedule"
			)
		})
	})
})
