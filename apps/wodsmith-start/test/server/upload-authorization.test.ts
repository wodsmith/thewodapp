/**
 * Upload Authorization Tests
 *
 * Tests permission checks for file uploads based on purpose and entity.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FakeDrizzleDb } from "@repo/test-utils"

// Mock the database
const mockDb = new FakeDrizzleDb()

vi.mock("@/db", () => ({
	getDb: vi.fn(() => mockDb),
}))

// Test data
const userId = "user-123"
const otherUserId = "user-other-456"
const teamId = "team-abc"
const competitionId = "comp-test-123"

// Mock team permission function
const mockHasTeamPermission = vi.fn()

vi.mock("@/utils/team-auth", () => ({
	hasTeamPermission: (...args: unknown[]) => mockHasTeamPermission(...args),
}))

// Import after mocks
import { checkUploadAuthorization } from "@/server/upload-authorization"

// Factory for mock competition
function createMockCompetition(
	overrides: Partial<{
		id: string
		organizingTeamId: string
	}> = {},
) {
	return {
		id: overrides.id ?? competitionId,
		organizingTeamId: overrides.organizingTeamId ?? teamId,
	}
}

// Helper to set up competition query mock
function setupCompetitionQuery(returnValue: unknown) {
	mockDb.query.competitionsTable = {
		findFirst: vi.fn().mockResolvedValue(returnValue),
		findMany: vi.fn().mockResolvedValue(returnValue ? [returnValue] : []),
	}
}

describe("checkUploadAuthorization", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockDb.reset()
		mockDb.registerTable("competitionsTable")
		mockHasTeamPermission.mockResolvedValue(true)
	})

	describe("judging-sheet uploads", () => {
		it("requires entityId (competitionId) for judging-sheet uploads", async () => {
			const result = await checkUploadAuthorization(
				"judging-sheet",
				null,
				userId,
			)

			expect(result.authorized).toBe(false)
			expect(result.error).toBe(
				"Competition ID is required for judging sheet uploads",
			)
		})

		it("rejects judging-sheet upload when competition not found", async () => {
			setupCompetitionQuery(undefined)

			const result = await checkUploadAuthorization(
				"judging-sheet",
				"nonexistent-comp",
				userId,
			)

			expect(result.authorized).toBe(false)
			expect(result.error).toBe("Competition not found")
		})

		it("rejects judging-sheet upload when user lacks permission", async () => {
			setupCompetitionQuery(createMockCompetition())
			mockHasTeamPermission.mockResolvedValue(false)

			const result = await checkUploadAuthorization(
				"judging-sheet",
				competitionId,
				userId,
			)

			expect(result.authorized).toBe(false)
			expect(result.error).toBe(
				"Not authorized to upload judging sheets for this competition",
			)
		})

		it("authorizes judging-sheet upload when user has permission", async () => {
			setupCompetitionQuery(createMockCompetition())
			mockHasTeamPermission.mockResolvedValue(true)

			const result = await checkUploadAuthorization(
				"judging-sheet",
				competitionId,
				userId,
			)

			expect(result.authorized).toBe(true)
			expect(result.error).toBeUndefined()
		})
	})

	describe("competition-* uploads", () => {
		it("rejects competition upload when competition not found", async () => {
			setupCompetitionQuery(undefined)

			const result = await checkUploadAuthorization(
				"competition-profile",
				"nonexistent-comp",
				userId,
			)

			expect(result.authorized).toBe(false)
			expect(result.error).toBe("Competition not found")
		})

		it("rejects competition upload when user lacks permission", async () => {
			setupCompetitionQuery(createMockCompetition())
			mockHasTeamPermission.mockResolvedValue(false)

			const result = await checkUploadAuthorization(
				"competition-banner",
				competitionId,
				userId,
			)

			expect(result.authorized).toBe(false)
			expect(result.error).toBe("Not authorized to upload for this competition")
		})

		it("authorizes competition upload when user has permission", async () => {
			setupCompetitionQuery(createMockCompetition())
			mockHasTeamPermission.mockResolvedValue(true)

			const result = await checkUploadAuthorization(
				"competition-sponsor-logo",
				competitionId,
				userId,
			)

			expect(result.authorized).toBe(true)
		})

		it("allows competition upload without entityId (falls through to default)", async () => {
			const result = await checkUploadAuthorization(
				"competition-profile",
				null,
				userId,
			)

			expect(result.authorized).toBe(true)
		})
	})

	describe("athlete-* uploads", () => {
		it("rejects athlete upload when entityId does not match userId", async () => {
			const result = await checkUploadAuthorization(
				"athlete-profile",
				otherUserId,
				userId,
			)

			expect(result.authorized).toBe(false)
			expect(result.error).toBe("Not authorized to upload for this athlete")
		})

		it("authorizes athlete upload when entityId matches userId", async () => {
			const result = await checkUploadAuthorization(
				"athlete-profile",
				userId,
				userId,
			)

			expect(result.authorized).toBe(true)
		})

		it("authorizes athlete upload when no entityId provided", async () => {
			const result = await checkUploadAuthorization(
				"athlete-cover",
				null,
				userId,
			)

			expect(result.authorized).toBe(true)
		})
	})

	describe("sponsor-logo uploads", () => {
		it("rejects sponsor-logo upload when entityId does not match userId", async () => {
			const result = await checkUploadAuthorization(
				"sponsor-logo",
				otherUserId,
				userId,
			)

			expect(result.authorized).toBe(false)
			expect(result.error).toBe("Not authorized to upload sponsor logo")
		})

		it("authorizes sponsor-logo upload when entityId matches userId", async () => {
			const result = await checkUploadAuthorization(
				"sponsor-logo",
				userId,
				userId,
			)

			expect(result.authorized).toBe(true)
		})

		it("authorizes sponsor-logo upload when no entityId provided", async () => {
			const result = await checkUploadAuthorization(
				"sponsor-logo",
				null,
				userId,
			)

			expect(result.authorized).toBe(true)
		})
	})

	describe("unknown purpose", () => {
		it("authorizes unknown purpose by default", async () => {
			const result = await checkUploadAuthorization(
				"unknown-purpose",
				null,
				userId,
			)

			expect(result.authorized).toBe(true)
		})
	})
})
