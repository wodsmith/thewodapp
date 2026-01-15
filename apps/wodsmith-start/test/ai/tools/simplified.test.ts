/**
 * @fileoverview Unit tests for simplified tools
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import type { Mock } from "vitest"
import { createWaiverSimple, enterResultSimple } from "@/ai/tools/simplified"
import { getDb } from "@/db"

vi.mock("@/db")
vi.mock("@paralleldrive/cuid2", () => ({
	createId: () => "test123",
}))

describe("createWaiverSimple", () => {
	const mockDb = {
		insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
		query: {
			competitionsTable: {
				findFirst: vi.fn(),
			},
		},
	}

	const mockContext = {
		requestContext: {
			get: vi.fn(() => "team_123"),
		},
	}

	beforeEach(() => {
		vi.clearAllMocks()
		;(getDb as Mock).mockReturnValue(mockDb)
	})

	it("should create liability waiver with template", async () => {
		mockDb.query.competitionsTable.findFirst.mockResolvedValue({
			id: "comp_123",
			organizingTeamId: "team_123",
			competitionTeamId: "team_456",
		})

		const result = await createWaiverSimple.execute(
			{
				competitionId: "comp_123",
				waiverType: "liability",
				customText: "No refunds after registration closes",
				isRequired: true,
			},
			mockContext as any,
		)

		expect(result).toMatchObject({
			success: true,
			data: {
				waiverId: expect.stringContaining("wvr_"),
				title: "Liability Waiver",
				waiverType: "liability",
			},
		})

		expect(mockDb.insert).toHaveBeenCalled()
	})

	it("should create photo release waiver", async () => {
		mockDb.query.competitionsTable.findFirst.mockResolvedValue({
			id: "comp_123",
			organizingTeamId: "team_123",
			competitionTeamId: "team_456",
		})

		const result = await createWaiverSimple.execute(
			{
				competitionId: "comp_123",
				waiverType: "photo",
				customText: "",
				isRequired: false,
			},
			mockContext as any,
		)

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data?.title).toBe("Photo Release")
		}
	})

	it("should return error for non-existent competition", async () => {
		mockDb.query.competitionsTable.findFirst.mockResolvedValue(null)

		const result = await createWaiverSimple.execute(
			{
				competitionId: "comp_999",
				waiverType: "liability",
				customText: "",
				isRequired: true,
			},
			mockContext as any,
		)

		expect(result).toMatchObject({
			error: "COMPETITION_NOT_FOUND",
		})
	})
})

describe("enterResultSimple", () => {
	const mockDb = {
		insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() => Promise.resolve([])),
					})),
				})),
			})),
		})),
		query: {
			competitionRegistrationsTable: {
				findFirst: vi.fn(),
			},
		},
	}

	const mockContext = {
		requestContext: {
			get: vi.fn(() => "team_123"),
		},
	}

	beforeEach(() => {
		vi.clearAllMocks()
		;(getDb as Mock).mockReturnValue(mockDb)
	})

	it("should encode time-based workout correctly", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() =>
							Promise.resolve([
								{
									trackWorkout: { id: "twkt_123" },
									workout: { scheme: "time" },
								},
							]),
						),
					})),
				})),
			})),
		})

		mockDb.query.competitionRegistrationsTable.findFirst.mockResolvedValue({
			id: "reg_123",
		})

		const result = await enterResultSimple.execute(
			{
				registrationId: "reg_123",
				trackWorkoutId: "twkt_123",
				finishTimeMinutes: 5,
				finishTimeSeconds: 30,
				roundsCompleted: 0,
				repsCompleted: 0,
				loadPounds: 0,
				status: "scored",
			},
			mockContext as any,
		)

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data?.encodedScore).toBe(330000) // 5:30 = 330 seconds = 330000 ms
			expect(result.data?.displayValue).toBe("5:30")
		}
	})

	it("should encode AMRAP workout correctly", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() =>
							Promise.resolve([
								{
									trackWorkout: { id: "twkt_123" },
									workout: { scheme: "rounds-reps" },
								},
							]),
						),
					})),
				})),
			})),
		})

		mockDb.query.competitionRegistrationsTable.findFirst.mockResolvedValue({
			id: "reg_123",
		})

		const result = await enterResultSimple.execute(
			{
				registrationId: "reg_123",
				trackWorkoutId: "twkt_123",
				finishTimeMinutes: 0,
				finishTimeSeconds: 0,
				roundsCompleted: 4,
				repsCompleted: 15,
				loadPounds: 0,
				status: "scored",
			},
			mockContext as any,
		)

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data?.encodedScore).toBe(400015) // 4 rounds * 100000 + 15 reps
			expect(result.data?.displayValue).toBe("4 rounds + 15 reps")
		}
	})

	it("should encode load workout correctly", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() =>
							Promise.resolve([
								{
									trackWorkout: { id: "twkt_123" },
									workout: { scheme: "load" },
								},
							]),
						),
					})),
				})),
			})),
		})

		mockDb.query.competitionRegistrationsTable.findFirst.mockResolvedValue({
			id: "reg_123",
		})

		const result = await enterResultSimple.execute(
			{
				registrationId: "reg_123",
				trackWorkoutId: "twkt_123",
				finishTimeMinutes: 0,
				finishTimeSeconds: 0,
				roundsCompleted: 0,
				repsCompleted: 0,
				loadPounds: 225,
				status: "scored",
			},
			mockContext as any,
		)

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data?.encodedScore).toBe(Math.round(225 * 453.592)) // 225 lbs to grams
			expect(result.data?.displayValue).toBe("225 lbs")
		}
	})

	it("should return error for non-existent track workout", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() => Promise.resolve([])),
					})),
				})),
			})),
		})

		const result = await enterResultSimple.execute(
			{
				registrationId: "reg_123",
				trackWorkoutId: "twkt_999",
				finishTimeMinutes: 5,
				finishTimeSeconds: 30,
				roundsCompleted: 0,
				repsCompleted: 0,
				loadPounds: 0,
				status: "scored",
			},
			mockContext as any,
		)

		expect(result).toMatchObject({
			error: "RESOURCE_NOT_FOUND",
			message: expect.stringContaining("twkt_999"),
		})
	})
})
