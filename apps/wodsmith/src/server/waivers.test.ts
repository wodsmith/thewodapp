import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Competition } from "@/db/schemas/competitions"
import type { Waiver, WaiverSignature } from "@/db/schemas/waivers"
import {
	getCompetitionWaivers,
	getWaiver,
	getWaiverSignaturesForRegistration,
	getWaiverSignaturesForUser,
	validateCompetitionOwnership,
} from "./waivers"

// Mock dependencies
vi.mock("@/db", () => ({
	getDb: vi.fn(),
}))

vi.mock("@/utils/batch-query", () => ({
	autochunk: vi.fn((config, fn) => {
		// Simple mock: just call fn with all items
		return fn(config.items)
	}),
}))

import { getDb } from "@/db"

describe("Waiver Server Functions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("getCompetitionWaivers", () => {
		it("should return waivers ordered by position", async () => {
			const mockWaivers: Waiver[] = [
				{
					id: "waiver-1",
					competitionId: "comp-123",
					title: "General Liability Waiver",
					content: "You agree to...",
					position: 0,
					required: true,
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-01"),
					updateCounter: null,
				},
				{
					id: "waiver-2",
					competitionId: "comp-123",
					title: "Photo Release",
					content: "We may take photos...",
					position: 1,
					required: false,
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-01"),
					updateCounter: null,
				},
			]

			const mockDb = {
				query: {
					waiversTable: {
						findMany: vi.fn().mockResolvedValue(mockWaivers),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const result = await getCompetitionWaivers("comp-123")

			expect(result).toEqual(mockWaivers)
			expect(mockDb.query.waiversTable.findMany).toHaveBeenCalledWith({
				where: expect.anything(),
				orderBy: expect.anything(),
			})
		})

		it("should return empty array when no waivers exist", async () => {
			const mockDb = {
				query: {
					waiversTable: {
						findMany: vi.fn().mockResolvedValue([]),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const result = await getCompetitionWaivers("comp-no-waivers")

			expect(result).toEqual([])
			expect(result.length).toBe(0)
		})

		it("should query with correct competition ID", async () => {
			const mockDb = {
				query: {
					waiversTable: {
						findMany: vi.fn().mockResolvedValue([]),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await getCompetitionWaivers("comp-specific-123")

			const findManyCall = mockDb.query.waiversTable.findMany.mock.calls[0]![0]
			expect(findManyCall).toHaveProperty("where")
			expect(findManyCall).toHaveProperty("orderBy")
		})

		it("should return waivers in position order (0, 1, 2)", async () => {
			const mockWaivers: Waiver[] = [
				{
					id: "waiver-1",
					competitionId: "comp-123",
					title: "First Waiver",
					content: "Content 1",
					position: 0,
					required: true,
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-01"),
					updateCounter: null,
				},
				{
					id: "waiver-2",
					competitionId: "comp-123",
					title: "Second Waiver",
					content: "Content 2",
					position: 1,
					required: true,
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-01"),
					updateCounter: null,
				},
				{
					id: "waiver-3",
					competitionId: "comp-123",
					title: "Third Waiver",
					content: "Content 3",
					position: 2,
					required: false,
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-01"),
					updateCounter: null,
				},
			]

			const mockDb = {
				query: {
					waiversTable: {
						findMany: vi.fn().mockResolvedValue(mockWaivers),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const result = await getCompetitionWaivers("comp-123")

			expect(result[0]!.position).toBe(0)
			expect(result[1]!.position).toBe(1)
			expect(result[2]!.position).toBe(2)
		})
	})

	describe("getWaiver", () => {
		it("should return waiver when found", async () => {
			const mockWaiver: Waiver = {
				id: "waiver-123",
				competitionId: "comp-456",
				title: "Test Waiver",
				content: "Waiver content here",
				position: 0,
				required: true,
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date("2024-01-01"),
				updateCounter: null,
			}

			const mockDb = {
				query: {
					waiversTable: {
						findFirst: vi.fn().mockResolvedValue(mockWaiver),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const result = await getWaiver("waiver-123")

			expect(result).toEqual(mockWaiver)
			expect(mockDb.query.waiversTable.findFirst).toHaveBeenCalledWith({
				where: expect.anything(),
			})
		})

		it("should return null when waiver not found", async () => {
			const mockDb = {
				query: {
					waiversTable: {
						findFirst: vi.fn().mockResolvedValue(undefined),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const result = await getWaiver("non-existent-waiver")

			expect(result).toBeNull()
		})

		it("should query with correct waiver ID", async () => {
			const mockDb = {
				query: {
					waiversTable: {
						findFirst: vi.fn().mockResolvedValue(null),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await getWaiver("specific-waiver-id")

			const findFirstCall = mockDb.query.waiversTable.findFirst.mock.calls[0]![0]
			expect(findFirstCall).toHaveProperty("where")
		})
	})

	describe("getWaiverSignaturesForRegistration", () => {
		it("should return signatures with waiver relation", async () => {
			const mockSignatures: Array<
				WaiverSignature & { waiver: Waiver }
			> = [
				{
					id: "sig-1",
					waiverId: "waiver-1",
					userId: "user-123",
					registrationId: "reg-456",
					signedAt: new Date("2024-01-15"),
					ipAddress: "192.168.1.1",
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-01"),
					updateCounter: null,
					waiver: {
						id: "waiver-1",
						competitionId: "comp-123",
						title: "Liability Waiver",
						content: "Content...",
						position: 0,
						required: true,
						createdAt: new Date("2024-01-01"),
						updatedAt: new Date("2024-01-01"),
						updateCounter: null,
					},
				},
			]

			const mockDb = {
				query: {
					waiverSignaturesTable: {
						findMany: vi.fn().mockResolvedValue(mockSignatures),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const result = await getWaiverSignaturesForRegistration("reg-456")

			expect(result).toEqual(mockSignatures)
			expect((result[0] as typeof mockSignatures[0])!.waiver).toBeDefined()
			expect((result[0] as typeof mockSignatures[0])!.waiver?.title).toBe("Liability Waiver")
			expect(mockDb.query.waiverSignaturesTable.findMany).toHaveBeenCalledWith({
				where: expect.anything(),
				with: { waiver: true },
			})
		})

		it("should return empty array when no signatures exist", async () => {
			const mockDb = {
				query: {
					waiverSignaturesTable: {
						findMany: vi.fn().mockResolvedValue([]),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const result = await getWaiverSignaturesForRegistration("reg-no-sigs")

			expect(result).toEqual([])
			expect(result.length).toBe(0)
		})

		it("should query with correct registration ID", async () => {
			const mockDb = {
				query: {
					waiverSignaturesTable: {
						findMany: vi.fn().mockResolvedValue([]),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await getWaiverSignaturesForRegistration("specific-reg-id")

			const findManyCall =
				mockDb.query.waiverSignaturesTable.findMany.mock.calls[0]![0]
			expect(findManyCall).toHaveProperty("where")
			expect(findManyCall).toHaveProperty("with")
		})

		it("should include waiver relation for each signature", async () => {
			const mockSignatures: Array<
				WaiverSignature & { waiver: Waiver }
			> = [
				{
					id: "sig-1",
					waiverId: "waiver-1",
					userId: "user-123",
					registrationId: "reg-456",
					signedAt: new Date("2024-01-15"),
					ipAddress: "192.168.1.1",
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-01"),
					updateCounter: null,
					waiver: {
						id: "waiver-1",
						competitionId: "comp-123",
						title: "Waiver 1",
						content: "Content 1",
						position: 0,
						required: true,
						createdAt: new Date("2024-01-01"),
						updatedAt: new Date("2024-01-01"),
						updateCounter: null,
					},
				},
				{
					id: "sig-2",
					waiverId: "waiver-2",
					userId: "user-123",
					registrationId: "reg-456",
					signedAt: new Date("2024-01-15"),
					ipAddress: "192.168.1.1",
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-01"),
					updateCounter: null,
					waiver: {
						id: "waiver-2",
						competitionId: "comp-123",
						title: "Waiver 2",
						content: "Content 2",
						position: 1,
						required: false,
						createdAt: new Date("2024-01-01"),
						updatedAt: new Date("2024-01-01"),
						updateCounter: null,
					},
				},
			]

			const mockDb = {
				query: {
					waiverSignaturesTable: {
						findMany: vi.fn().mockResolvedValue(mockSignatures),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const result = await getWaiverSignaturesForRegistration("reg-456")

			expect(result).toHaveLength(2)
			expect((result[0] as typeof mockSignatures[0])!.waiver).toBeDefined()
			expect((result[1] as typeof mockSignatures[1])!.waiver).toBeDefined()
			expect((result[0] as typeof mockSignatures[0])!.waiver?.id).toBe("waiver-1")
			expect((result[1] as typeof mockSignatures[1])!.waiver?.id).toBe("waiver-2")
		})
	})

	describe("getWaiverSignaturesForUser", () => {
		it("should return signatures for user in competition", async () => {
			const mockWaivers: Waiver[] = [
				{
					id: "waiver-1",
					competitionId: "comp-123",
					title: "Waiver 1",
					content: "Content 1",
					position: 0,
					required: true,
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-01"),
					updateCounter: null,
				},
			]

			const mockSignatures: Array<
				WaiverSignature & { waiver: Waiver }
			> = [
				{
					id: "sig-1",
					waiverId: "waiver-1",
					userId: "user-123",
					registrationId: "reg-456",
					signedAt: new Date("2024-01-15"),
					ipAddress: "192.168.1.1",
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-01"),
					updateCounter: null,
					waiver: mockWaivers[0]!,
				},
			]

			const mockDb = {
				query: {
					waiversTable: {
						findMany: vi.fn().mockResolvedValue(mockWaivers),
					},
					waiverSignaturesTable: {
						findMany: vi.fn().mockResolvedValue(mockSignatures),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const result = await getWaiverSignaturesForUser("user-123", "comp-123")

			expect(result).toEqual(mockSignatures)
			expect((result[0] as typeof mockSignatures[0])!.waiver).toBeDefined()
		})

		it("should return empty array when no waivers exist for competition", async () => {
			const mockDb = {
				query: {
					waiversTable: {
						findMany: vi.fn().mockResolvedValue([]),
					},
					waiverSignaturesTable: {
						findMany: vi.fn(),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const result = await getWaiverSignaturesForUser(
				"user-123",
				"comp-no-waivers",
			)

			expect(result).toEqual([])
			// Should not query signatures if no waivers
			expect(mockDb.query.waiverSignaturesTable.findMany).not.toHaveBeenCalled()
		})

		it("should handle user with no signatures for competition", async () => {
			const mockWaivers: Waiver[] = [
				{
					id: "waiver-1",
					competitionId: "comp-123",
					title: "Waiver 1",
					content: "Content 1",
					position: 0,
					required: true,
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-01"),
					updateCounter: null,
				},
			]

			const mockDb = {
				query: {
					waiversTable: {
						findMany: vi.fn().mockResolvedValue(mockWaivers),
					},
					waiverSignaturesTable: {
						findMany: vi.fn().mockResolvedValue([]),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const result = await getWaiverSignaturesForUser(
				"user-unsigned",
				"comp-123",
			)

			expect(result).toEqual([])
		})

		it("should use autochunk for waiver IDs query (D1 100-param limit)", async () => {
			const mockWaivers: Waiver[] = Array.from({ length: 150 }, (_, i) => ({
				id: `waiver-${i}`,
				competitionId: "comp-123",
				title: `Waiver ${i}`,
				content: `Content ${i}`,
				position: i,
				required: true,
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date("2024-01-01"),
				updateCounter: null,
			}))

			const mockDb = {
				query: {
					waiversTable: {
						findMany: vi.fn().mockResolvedValue(mockWaivers),
					},
					waiverSignaturesTable: {
						findMany: vi.fn().mockResolvedValue([]),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const { autochunk } = await import("@/utils/batch-query")

			await getWaiverSignaturesForUser("user-123", "comp-123")

			// Verify autochunk was called
			expect(autochunk).toHaveBeenCalledWith(
				expect.objectContaining({
					items: expect.arrayContaining([expect.stringMatching(/^waiver-/)]),
					otherParametersCount: 1, // userId parameter
				}),
				expect.any(Function),
			)
		})

		it("should query signatures with correct user ID and waiver IDs", async () => {
			const mockWaivers: Waiver[] = [
				{
					id: "waiver-1",
					competitionId: "comp-123",
					title: "Waiver 1",
					content: "Content 1",
					position: 0,
					required: true,
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-01"),
					updateCounter: null,
				},
				{
					id: "waiver-2",
					competitionId: "comp-123",
					title: "Waiver 2",
					content: "Content 2",
					position: 1,
					required: true,
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-01"),
					updateCounter: null,
				},
			]

			const mockDb = {
				query: {
					waiversTable: {
						findMany: vi.fn().mockResolvedValue(mockWaivers),
					},
					waiverSignaturesTable: {
						findMany: vi.fn().mockResolvedValue([]),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await getWaiverSignaturesForUser("user-specific-123", "comp-456")

			// Verify waivers were queried first
			expect(mockDb.query.waiversTable.findMany).toHaveBeenCalled()
			// Verify signatures query was made
			expect(mockDb.query.waiverSignaturesTable.findMany).toHaveBeenCalled()
		})

		it("should return flattened array of signatures from autochunk", async () => {
			const mockWaivers: Waiver[] = [
				{
					id: "waiver-1",
					competitionId: "comp-123",
					title: "Waiver 1",
					content: "Content 1",
					position: 0,
					required: true,
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-01"),
					updateCounter: null,
				},
				{
					id: "waiver-2",
					competitionId: "comp-123",
					title: "Waiver 2",
					content: "Content 2",
					position: 1,
					required: true,
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-01"),
					updateCounter: null,
				},
			]

			const mockSignatures: Array<
				WaiverSignature & { waiver: Waiver }
			> = [
				{
					id: "sig-1",
					waiverId: "waiver-1",
					userId: "user-123",
					registrationId: "reg-1",
					signedAt: new Date("2024-01-15"),
					ipAddress: "192.168.1.1",
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-01"),
					updateCounter: null,
					waiver: mockWaivers[0]!,
				},
				{
					id: "sig-2",
					waiverId: "waiver-2",
					userId: "user-123",
					registrationId: "reg-1",
					signedAt: new Date("2024-01-15"),
					ipAddress: "192.168.1.1",
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-01"),
					updateCounter: null,
					waiver: mockWaivers[1]!,
				},
			]

			const mockDb = {
				query: {
					waiversTable: {
						findMany: vi.fn().mockResolvedValue(mockWaivers),
					},
					waiverSignaturesTable: {
						findMany: vi.fn().mockResolvedValue(mockSignatures),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			const result = await getWaiverSignaturesForUser("user-123", "comp-123")

			expect(result).toHaveLength(2)
			expect(result[0]!.id).toBe("sig-1")
			expect(result[1]!.id).toBe("sig-2")
		})
	})

	describe("validateCompetitionOwnership", () => {
		it("should pass validation when competition belongs to team", async () => {
			const mockCompetition = {
				id: "comp-123",
				organizingTeamId: "team-456",
			} as Competition

			const mockDb = {
				query: {
					competitionsTable: {
						findFirst: vi.fn().mockResolvedValue(mockCompetition),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await expect(
				validateCompetitionOwnership("comp-123", "team-456"),
			).resolves.toBeUndefined()
		})

		it("should throw error when competition not found", async () => {
			const mockDb = {
				query: {
					competitionsTable: {
						findFirst: vi.fn().mockResolvedValue(undefined),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await expect(
				validateCompetitionOwnership("comp-nonexistent", "team-456"),
			).rejects.toThrow("Competition not found")
		})

		it("should throw error when competition belongs to different team", async () => {
			const mockCompetition = {
				id: "comp-123",
				organizingTeamId: "team-other",
			} as Competition

			const mockDb = {
				query: {
					competitionsTable: {
						findFirst: vi.fn().mockResolvedValue(mockCompetition),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await expect(
				validateCompetitionOwnership("comp-123", "team-456"),
			).rejects.toThrow("Competition does not belong to this team")
		})

		it("should query with correct competition ID", async () => {
			const mockCompetition = {
				id: "comp-specific-789",
				organizingTeamId: "team-456",
			} as Competition

			const mockDb = {
				query: {
					competitionsTable: {
						findFirst: vi.fn().mockResolvedValue(mockCompetition),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await validateCompetitionOwnership("comp-specific-789", "team-456")

			const findFirstCall =
				mockDb.query.competitionsTable.findFirst.mock.calls[0]![0]
			expect(findFirstCall).toHaveProperty("where")
		})

		it("should not throw when organizingTeamId matches exactly", async () => {
			const mockCompetition = {
				id: "comp-123",
				organizingTeamId: "team-exact-match",
			} as Competition

			const mockDb = {
				query: {
					competitionsTable: {
						findFirst: vi.fn().mockResolvedValue(mockCompetition),
					},
				},
			}

			vi.mocked(getDb).mockReturnValue(mockDb as any)

			await expect(
				validateCompetitionOwnership("comp-123", "team-exact-match"),
			).resolves.toBeUndefined()
		})
	})
})
