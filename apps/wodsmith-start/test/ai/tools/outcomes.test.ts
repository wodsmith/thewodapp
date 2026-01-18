/**
 * @fileoverview Unit tests for high-impact outcome tools
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import type { Mock } from "vitest"
import {
	setupNewCompetition,
	duplicateCompetition,
	publishCompetition,
	checkCompetitionReadiness,
	scheduleAllHeats,
} from "@/ai/tools/outcomes"
import { getDb } from "@/db"
import * as competitionServerLogic from "@/server-fns/competition-server-logic"

// Mock dependencies
vi.mock("@/db")
vi.mock("@/server-fns/competition-server-logic")
vi.mock("@/utils/slugify", () => ({
	generateSlug: (name: string) => name.toLowerCase().replace(/\s+/g, "-"),
}))
vi.mock("@paralleldrive/cuid2", () => ({
	createId: () => "test123",
}))

describe("setupNewCompetition", () => {
	const mockDb = {
		insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
		update: vi.fn(() => ({
			set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
		})),
		query: {
			competitionsTable: {
				findFirst: vi.fn(),
			},
			scalingLevelsTable: {
				findMany: vi.fn(),
			},
		},
	}

	const mockContext = {
		requestContext: {
			get: vi.fn((key: string) => (key === "team-id" ? "team_123" : undefined)),
		},
	}

	beforeEach(() => {
		vi.clearAllMocks()
		;(getDb as Mock).mockReturnValue(mockDb)
		;(competitionServerLogic.createCompetition as Mock).mockResolvedValue({
			competitionId: "comp_123",
			competitionTeamId: "team_456",
		})
	})

	it("should create a complete competition with all dependencies", async () => {
		const result = await setupNewCompetition.execute(
			{
				name: "Spring Throwdown 2026",
				startDate: "2026-05-15",
				competitionType: "individual",
				expectedAthletes: 100,
				includeScaled: true,
				includeMasters: false,
				includeTeens: false,
				eventCount: 4,
			},
			mockContext as any,
		)

		expect(result).toMatchObject({
			success: true,
			data: {
				competitionId: "comp_123",
				slug: "spring-throwdown-2026",
				divisions: expect.arrayContaining(["Rx Men", "Rx Women", "Scaled Men", "Scaled Women"]),
				events: ["Event 1", "Event 2", "Event 3", "Event 4"],
				waivers: ["Liability Waiver"],
			},
		})

		// Verify createCompetition was called
		expect(competitionServerLogic.createCompetition).toHaveBeenCalledWith({
			organizingTeamId: "team_123",
			name: "Spring Throwdown 2026",
			slug: "spring-throwdown-2026",
			startDate: expect.any(Date),
			endDate: expect.any(Date),
			description: undefined,
		})

		// Verify scaling group and levels were created
		expect(mockDb.insert).toHaveBeenCalled()
	})

	it("should return error when team context is missing", async () => {
		const noTeamContext = {
			requestContext: {
				get: vi.fn(() => undefined),
			},
		}

		const result = await setupNewCompetition.execute(
			{
				name: "Test Competition",
				startDate: "2026-05-15",
				competitionType: "individual",
				expectedAthletes: 100,
				includeScaled: true,
				includeMasters: false,
				includeTeens: false,
				eventCount: 4,
			},
			noTeamContext as any,
		)

		expect(result).toMatchObject({
			error: "NO_TEAM_CONTEXT",
			message: "This operation requires a team context.",
			nextActions: ["listCompetitions", "askUserForTeam"],
		})
	})

	it("should return structured error for invalid date format", async () => {
		const result = await setupNewCompetition.execute(
			{
				name: "Test Competition",
				startDate: "invalid-date",
				competitionType: "individual",
				expectedAthletes: 100,
				includeScaled: true,
				includeMasters: false,
				includeTeens: false,
				eventCount: 4,
			},
			mockContext as any,
		)

		expect(result).toMatchObject({
			error: "INVALID_DATE_FORMAT",
			message: expect.stringContaining("invalid-date"),
			suggestion: expect.stringContaining("YYYY-MM-DD"),
			nextActions: expect.arrayContaining(["retryWithCorrectFormat"]),
		})
	})

	it("should create team competition with team divisions", async () => {
		const result = await setupNewCompetition.execute(
			{
				name: "Team Throwdown 2026",
				startDate: "2026-05-15",
				competitionType: "team",
				expectedAthletes: 40,
				includeScaled: true,
				includeMasters: false,
				includeTeens: false,
				eventCount: 3,
			},
			mockContext as any,
		)

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data?.divisions).toContain("Rx Teams")
			expect(result.data?.divisions).toContain("Scaled Teams")
			expect(result.data?.events).toHaveLength(3)
		}
	})
})

describe("publishCompetition", () => {
	const mockDb = {
		update: vi.fn(() => ({
			set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
		})),
		query: {
			competitionsTable: {
				findFirst: vi.fn(),
			},
			scalingLevelsTable: {
				findMany: vi.fn(() => Promise.resolve([{ id: "div_1", label: "Rx Men" }])),
			},
			programmingTracksTable: {
				findFirst: vi.fn(() => Promise.resolve({ id: "track_1" })),
			},
			trackWorkoutsTable: {
				findMany: vi.fn(() =>
					Promise.resolve([
						{ id: "tw_1" },
						{ id: "tw_2" },
					]),
				),
			},
			waiversTable: {
				findMany: vi.fn(() => Promise.resolve([{ id: "waiver_1" }])),
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

	it("should publish competition when validation passes", async () => {
		mockDb.query.competitionsTable.findFirst.mockResolvedValue({
			id: "comp_123",
			name: "Test Competition",
			organizingTeamId: "team_123",
			startDate: new Date("2026-05-15"),
			status: "draft",
			settings: JSON.stringify({ divisions: { scalingGroupId: "sgrp_123" } }),
		})

		const result = await publishCompetition.execute(
			{
				competitionId: "comp_123",
				visibility: "public",
				forcePublish: false,
			},
			mockContext as any,
		)

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data?.status).toBe("published")
			expect(result.data?.visibility).toBe("public")
		}

		expect(mockDb.update).toHaveBeenCalled()
	})

	it("should return validation errors when competition is not ready", async () => {
		mockDb.query.competitionsTable.findFirst.mockResolvedValue({
			id: "comp_123",
			name: "Test Competition",
			organizingTeamId: "team_123",
			startDate: new Date("2026-05-15"),
			status: "draft",
			settings: null, // No scaling group
		})

		const result = await publishCompetition.execute(
			{
				competitionId: "comp_123",
				visibility: "public",
				forcePublish: false,
			},
			mockContext as any,
		)

		expect(result).toMatchObject({
			error: "VALIDATION_FAILED",
			message: expect.stringContaining("validation error"),
		})
	})
})

describe("scheduleAllHeats", () => {
	const mockDb = {
		insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
		query: {
			competitionsTable: {
				findFirst: vi.fn(),
			},
			competitionVenuesTable: {
				findFirst: vi.fn(),
			},
			competitionRegistrationsTable: {
				findMany: vi.fn(),
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

	it("should create heats and assign athletes", async () => {
		mockDb.query.competitionsTable.findFirst.mockResolvedValue({
			id: "comp_123",
			organizingTeamId: "team_123",
		})

		mockDb.query.competitionVenuesTable.findFirst.mockResolvedValue({
			id: "venue_123",
			laneCount: 10,
		})

		mockDb.query.competitionRegistrationsTable.findMany.mockResolvedValue([
			{
				id: "reg_1",
				divisionId: "div_1",
				division: { label: "Rx Men" },
				user: { firstName: "John", lastName: "Doe" },
			},
			{
				id: "reg_2",
				divisionId: "div_1",
				division: { label: "Rx Men" },
				user: { firstName: "Jane", lastName: "Doe" },
			},
		])

		const result = await scheduleAllHeats.execute(
			{
				competitionId: "comp_123",
				trackWorkoutId: "twkt_123",
				venueId: "venue_123",
				startTime: "2026-05-15T09:00:00Z",
				athletesPerHeat: 10,
				minutesBetweenHeats: 12,
				groupByDivision: true,
			},
			mockContext as any,
		)

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data?.heatsCreated).toBeGreaterThan(0)
			expect(result.data?.athletesScheduled).toBe(2)
		}

		expect(mockDb.insert).toHaveBeenCalled()
	})

	it("should return error when no athletes registered", async () => {
		mockDb.query.competitionsTable.findFirst.mockResolvedValue({
			id: "comp_123",
			organizingTeamId: "team_123",
		})

		mockDb.query.competitionVenuesTable.findFirst.mockResolvedValue({
			id: "venue_123",
			laneCount: 10,
		})

		mockDb.query.competitionRegistrationsTable.findMany.mockResolvedValue([])

		const result = await scheduleAllHeats.execute(
			{
				competitionId: "comp_123",
				trackWorkoutId: "twkt_123",
				venueId: "venue_123",
				startTime: "2026-05-15T09:00:00Z",
				athletesPerHeat: 10,
				minutesBetweenHeats: 12,
				groupByDivision: true,
			},
			mockContext as any,
		)

		expect(result).toMatchObject({
			error: "INSUFFICIENT_DATA",
			message: "No athletes registered for this competition",
		})
	})
})

describe("checkCompetitionReadiness", () => {
	const mockDb = {
		query: {
			competitionsTable: {
				findFirst: vi.fn(),
			},
			scalingLevelsTable: {
				findMany: vi.fn(),
			},
			programmingTracksTable: {
				findFirst: vi.fn(),
			},
			trackWorkoutsTable: {
				findMany: vi.fn(),
			},
			waiversTable: {
				findMany: vi.fn(),
			},
			competitionRegistrationsTable: {
				findMany: vi.fn(),
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

	it("should return ready when all requirements met", async () => {
		mockDb.query.competitionsTable.findFirst.mockResolvedValue({
			id: "comp_123",
			organizingTeamId: "team_123",
			description: "Test competition",
			startDate: new Date("2026-12-31"),
			settings: JSON.stringify({ divisions: { scalingGroupId: "sgrp_123" } }),
		})

		mockDb.query.scalingLevelsTable.findMany.mockResolvedValue([{ id: "div_1" }])
		mockDb.query.programmingTracksTable.findFirst.mockResolvedValue({ id: "track_1" })
		mockDb.query.trackWorkoutsTable.findMany.mockResolvedValue([{ id: "tw_1" }])
		mockDb.query.waiversTable.findMany.mockResolvedValue([{ id: "waiver_1" }])
		mockDb.query.competitionRegistrationsTable.findMany.mockResolvedValue([
			{ id: "reg_1", hasSignedAllWaivers: true, paymentStatus: "PAID" },
		])

		const result = await checkCompetitionReadiness.execute(
			{
				competitionId: "comp_123",
				daysUntilEvent: 30,
			},
			mockContext as any,
		)

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data?.ready).toBe(true)
			expect(result.data?.blockers).toHaveLength(0)
		}
	})

	it("should return blockers when requirements not met", async () => {
		mockDb.query.competitionsTable.findFirst.mockResolvedValue({
			id: "comp_123",
			organizingTeamId: "team_123",
			startDate: new Date("2026-12-31"),
			settings: null, // No scaling group
		})

		// Mock validation queries
		mockDb.query.programmingTracksTable.findFirst.mockResolvedValue(null)
		mockDb.query.trackWorkoutsTable.findMany.mockResolvedValue([])
		mockDb.query.waiversTable.findMany.mockResolvedValue([])
		mockDb.query.competitionRegistrationsTable.findMany.mockResolvedValue([])

		const result = await checkCompetitionReadiness.execute(
			{
				competitionId: "comp_123",
				daysUntilEvent: 7,
			},
			mockContext as any,
		)

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data?.ready).toBe(false)
			expect(result.data?.blockers.length).toBeGreaterThan(0)
		}
	})
})
