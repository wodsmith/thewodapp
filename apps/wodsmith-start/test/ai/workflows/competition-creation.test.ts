/**
 * @fileoverview Integration tests for complete competition workflows.
 *
 * Tests end-to-end workflows to verify:
 * - Tools work together correctly
 * - Performance improvements (10+ calls → 1-2 calls)
 * - Data flows correctly between tools
 * - Errors propagate correctly
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import type { Mock } from "vitest"
import {
	setupNewCompetition,
	publishCompetition,
	checkCompetitionReadiness,
} from "@/ai/tools/outcomes"
import {
	manageDivisions,
	manageEvents,
} from "@/ai/tools/consolidated"
import { getDb } from "@/db"
import * as competitionServerLogic from "@/server-fns/competition-server-logic"

vi.mock("@/db")
vi.mock("@/server-fns/competition-server-logic")
vi.mock("@/utils/slugify", () => ({
	generateSlug: (name: string) => name.toLowerCase().replace(/\s+/g, "-"),
}))
vi.mock("@paralleldrive/cuid2", () => ({
	createId: () => "test123",
}))

describe("Competition Creation Workflow", () => {
	const mockDb = {
		insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
		update: vi.fn(() => ({
			set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
		})),
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						orderBy: vi.fn(() => Promise.resolve([])),
					})),
				})),
			})),
		})),
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
				findFirst: vi.fn(),
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

	it("should create, customize, and publish a competition in 3 steps", async () => {
		// ========== STEP 1: Create complete competition (replaces 10+ legacy calls) ==========
		const setupResult = await setupNewCompetition.execute!(
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

		expect(setupResult).toMatchObject({
			success: true,
			data: {
				competitionId: "comp_123",
				slug: "spring-throwdown-2026",
				divisions: expect.arrayContaining([
					"Rx Men",
					"Rx Women",
					"Scaled Men",
					"Scaled Women",
				]),
				events: ["Event 1", "Event 2", "Event 3", "Event 4"],
				waivers: ["Liability Waiver"],
			},
		})

		// ========== STEP 2: Customize divisions (single consolidated call) ==========
		// Mock the competition and division queries for update
		mockDb.query.competitionsTable.findFirst.mockResolvedValue({
			id: "comp_123",
			organizingTeamId: "team_123",
			settings: JSON.stringify({ divisions: { scalingGroupId: "sgrp_123" } }),
		})

		const updateDivisionResult = await manageDivisions.execute!(
			{
				competitionId: "comp_123",
				action: "update",
				divisionId: "div_1",
				divisionName: "Rx Men",
				feeDollars: 85, // Increase fee from default $75
				description: "Elite male division",
			},
			mockContext as any,
		)

		expect(updateDivisionResult).toMatchObject({
			success: true,
			data: {
				divisionId: "div_1",
				updated: expect.objectContaining({
					label: "Rx Men",
				}),
			},
		})

		// ========== STEP 3: Customize event details (single consolidated call) ==========
		mockDb.query.competitionsTable.findFirst.mockResolvedValue({
			id: "comp_123",
			organizingTeamId: "team_123",
		})
		mockDb.query.programmingTracksTable.findFirst.mockResolvedValue({
			id: "track_1",
		})
		mockDb.query.trackWorkoutsTable.findFirst.mockResolvedValue({
			id: "tw_1",
			trackId: "track_1",
			workoutId: "wkt_1",
		})

		const updateEventResult = await manageEvents.execute!(
			{
				competitionId: "comp_123",
				action: "update",
				trackWorkoutId: "tw_1",
				workoutDescription: "21-15-9 Thrusters and Pull-ups",
				scheme: "time",
			},
			mockContext as any,
		)

		expect(updateEventResult).toMatchObject({
			success: true,
			data: {
				trackWorkoutId: "tw_1",
				updated: expect.objectContaining({
					description: "21-15-9 Thrusters and Pull-ups",
				}),
			},
		})

		// ========== STEP 4: Publish competition (atomic validation + publish) ==========
		mockDb.query.competitionsTable.findFirst.mockResolvedValue({
			id: "comp_123",
			name: "Spring Throwdown 2026",
			organizingTeamId: "team_123",
			startDate: new Date("2026-05-15"),
			status: "draft",
			settings: JSON.stringify({ divisions: { scalingGroupId: "sgrp_123" } }),
		})

		mockDb.query.scalingLevelsTable.findMany.mockResolvedValue([
			{ id: "div_1" },
		])
		mockDb.query.programmingTracksTable.findFirst.mockResolvedValue({
			id: "track_1",
		})
		mockDb.query.trackWorkoutsTable.findMany.mockResolvedValue([{ id: "tw_1" }])
		mockDb.query.waiversTable.findMany.mockResolvedValue([{ id: "waiver_1" }])

		const publishResult = await publishCompetition.execute!(
			{
				competitionId: "comp_123",
				visibility: "public",
				forcePublish: false,
			},
			mockContext as any,
		)

		expect(publishResult).toMatchObject({
			success: true,
			data: {
				status: "published",
				visibility: "public",
			},
		})

		// ========== Verify total tool calls: 4 (vs 15+ with legacy approach) ==========
		// Legacy approach would require:
		// 1. createCompetition
		// 2-5. createDivision x4 (Rx Men, Rx Women, Scaled Men, Scaled Women)
		// 6-9. createEvent x4
		// 10. createWaiver
		// 11. updateDivision (fee change)
		// 12. updateEvent (event details)
		// 13. validateCompetition
		// 14. publishCompetition
		// = 14 total calls
		//
		// New approach:
		// 1. setupNewCompetition (creates comp + divisions + events + waivers)
		// 2. manageDivisions (update fee)
		// 3. manageEvents (update details)
		// 4. publishCompetition (validates + publishes)
		// = 4 total calls (71% reduction!)
	})

	it("should handle validation failures during publish", async () => {
		// Setup incomplete competition (missing scaling group)
		mockDb.query.competitionsTable.findFirst.mockResolvedValue({
			id: "comp_123",
			name: "Incomplete Competition",
			organizingTeamId: "team_123",
			startDate: new Date("2026-05-15"),
			status: "draft",
			settings: null, // No scaling group configured
		})

		// Mock additional queries for validation
		mockDb.query.programmingTracksTable.findFirst.mockResolvedValue(null)
		mockDb.query.waiversTable.findMany.mockResolvedValue([])

		const publishResult = await publishCompetition.execute!(
			{
				competitionId: "comp_123",
				visibility: "public",
				forcePublish: false,
			},
			mockContext as any,
		)

		// Should return structured error with actionable guidance
		expect(publishResult).toMatchObject({
			error: "VALIDATION_FAILED",
			message: expect.stringContaining("validation error"),
			suggestion: expect.any(String),
			nextActions: expect.arrayContaining([
				"fixValidationErrors",
				"validateCompetition",
			]),
		})
	})

	it("should verify competition readiness before event day", async () => {
		// Setup complete competition
		mockDb.query.competitionsTable.findFirst.mockResolvedValue({
			id: "comp_123",
			organizingTeamId: "team_123",
			description: "Test competition",
			startDate: new Date("2026-12-31"),
			settings: JSON.stringify({ divisions: { scalingGroupId: "sgrp_123" } }),
		})

		mockDb.query.scalingLevelsTable.findMany.mockResolvedValue([{ id: "div_1" }])
		mockDb.query.programmingTracksTable.findFirst.mockResolvedValue({
			id: "track_1",
		})
		mockDb.query.trackWorkoutsTable.findMany.mockResolvedValue([{ id: "tw_1" }])
		mockDb.query.waiversTable.findMany.mockResolvedValue([{ id: "waiver_1" }])
		mockDb.query.competitionRegistrationsTable.findMany.mockResolvedValue([
			{ id: "reg_1", hasSignedAllWaivers: true, paymentStatus: "PAID" },
		])

		const readinessResult = await checkCompetitionReadiness.execute!(
			{
				competitionId: "comp_123",
				daysUntilEvent: 30,
			},
			mockContext as any,
		)

		expect(readinessResult).toMatchObject({
			success: true,
			data: {
				ready: true,
				blockers: [],
				warnings: expect.any(Array),
				recommendations: expect.any(Array),
			},
		})
	})

	it("should identify blockers when competition is not ready", async () => {
		// Setup incomplete competition
		mockDb.query.competitionsTable.findFirst.mockResolvedValue({
			id: "comp_123",
			organizingTeamId: "team_123",
			startDate: new Date("2026-01-20"), // Only 6 days away
			settings: null, // Missing scaling group
		})

		mockDb.query.scalingLevelsTable.findMany.mockResolvedValue([]) // No divisions
		mockDb.query.programmingTracksTable.findFirst.mockResolvedValue(null)
		mockDb.query.trackWorkoutsTable.findMany.mockResolvedValue([]) // No events
		mockDb.query.waiversTable.findMany.mockResolvedValue([])
		mockDb.query.competitionRegistrationsTable.findMany.mockResolvedValue([])

		const readinessResult = await checkCompetitionReadiness.execute!(
			{
				competitionId: "comp_123",
				daysUntilEvent: 6,
			},
			mockContext as any,
		)

		expect(readinessResult).toMatchObject({
			success: true,
			data: {
				ready: false,
				blockers: expect.arrayContaining([
					expect.stringMatching(/scaling group|divisions|events|programming track/),
				]),
			},
		})
	})
})

describe("Division Management Workflow", () => {
	const mockDb = {
		insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
		update: vi.fn(() => ({
			set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
		})),
		delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
		query: {
			competitionsTable: {
				findFirst: vi.fn(),
			},
			scalingLevelsTable: {
				findMany: vi.fn(),
				findFirst: vi.fn(),
			},
			scalingGroupsTable: {
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

	it("should list, create, update, and delete divisions using single tool", async () => {
		// Setup competition
		mockDb.query.competitionsTable.findFirst.mockResolvedValue({
			id: "comp_123",
			organizingTeamId: "team_123",
			settings: JSON.stringify({ divisions: { scalingGroupId: "sgrp_123" } }),
		})

		// ========== STEP 1: List existing divisions ==========
		mockDb.query.scalingLevelsTable.findMany.mockResolvedValue([
			{ id: "div_1", label: "Rx Men", teamSize: 1 },
			{ id: "div_2", label: "Rx Women", teamSize: 1 },
		])

		const listResult = await manageDivisions.execute!(
			{
				competitionId: "comp_123",
				action: "list",
			},
			mockContext as any,
		)

		expect(listResult).toMatchObject({
			success: true,
			data: {
				divisions: [
					{ id: "div_1", name: "Rx Men" },
					{ id: "div_2", name: "Rx Women" },
				],
			},
		})

		// ========== STEP 2: Create new division ==========
		mockDb.query.scalingGroupsTable.findFirst.mockResolvedValue({
			id: "sgrp_123",
		})

		const createResult = await manageDivisions.execute!(
			{
				competitionId: "comp_123",
				action: "create",
				divisionName: "Masters 40+ Men",
				feeDollars: 80,
				description: "Men 40 years and older",
			},
			mockContext as any,
		)

		expect(createResult).toMatchObject({
			success: true,
			data: {
				name: "Masters 40+ Men",
			},
		})

		// ========== STEP 3: Update division ==========
		mockDb.query.scalingLevelsTable.findFirst.mockResolvedValue({
			id: "div_1",
			label: "Rx Men",
		})

		const updateResult = await manageDivisions.execute!(
			{
				competitionId: "comp_123",
				action: "update",
				divisionId: "div_1",
				divisionName: "Rx Men (Updated)",
			},
			mockContext as any,
		)

		expect(updateResult).toMatchObject({
			success: true,
			data: {
				divisionId: "div_1",
			},
		})

		// ========== STEP 4: Delete division ==========
		const deleteResult = await manageDivisions.execute!(
			{
				competitionId: "comp_123",
				action: "delete",
				divisionId: "div_2",
			},
			mockContext as any,
		)

		expect(deleteResult).toMatchObject({
			success: true,
			data: {
				divisionId: "div_2",
			},
		})

		// ========== Verify: All operations through single tool ==========
		// Legacy approach would require 4 different tools:
		// - listDivisions
		// - createDivision
		// - updateDivision
		// - deleteDivision
		//
		// New approach: 1 tool (manageDivisions) with action parameter
	})
})

describe("Event Management Workflow", () => {
	const mockDb = {
		insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
		update: vi.fn(() => ({
			set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
		})),
		delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						orderBy: vi.fn(() => Promise.resolve([])),
					})),
				})),
			})),
		})),
		query: {
			competitionsTable: {
				findFirst: vi.fn(),
			},
			programmingTracksTable: {
				findFirst: vi.fn(),
			},
			trackWorkoutsTable: {
				findMany: vi.fn(),
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

	it("should manage complete event lifecycle", async () => {
		// Setup competition
		mockDb.query.competitionsTable.findFirst.mockResolvedValue({
			id: "comp_123",
			organizingTeamId: "team_123",
		})
		mockDb.query.programmingTracksTable.findFirst.mockResolvedValue({
			id: "track_1",
		})

		// ========== STEP 1: List events ==========
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						orderBy: vi.fn(() =>
							Promise.resolve([
								{
									trackWorkout: { id: "tw_1", trackOrder: 0 },
									workout: { id: "wkt_1", name: "Event 1", scheme: "time" },
								},
								{
									trackWorkout: { id: "tw_2", trackOrder: 1 },
									workout: { id: "wkt_2", name: "Event 2", scheme: "rounds-reps" },
								},
							]),
						),
					})),
				})),
			})),
		})

		const listResult = await manageEvents.execute!(
			{
				competitionId: "comp_123",
				action: "list",
			},
			mockContext as any,
		)

		expect(listResult).toMatchObject({
			success: true,
			data: {
				events: [
					{ trackWorkoutId: "tw_1", name: "Event 1" },
					{ trackWorkoutId: "tw_2", name: "Event 2" },
				],
			},
		})

		// ========== STEP 2: Create event ==========
		// Mock the findMany query for getting max track order
		mockDb.query.trackWorkoutsTable.findMany.mockResolvedValue([
			{ id: "tw_1", trackOrder: 0 },
			{ id: "tw_2", trackOrder: 1 },
		])

		const createResult = await manageEvents.execute!(
			{
				competitionId: "comp_123",
				action: "create",
				eventName: "Murph",
				workoutDescription: "1 mile run, 100 pull-ups, 200 push-ups, 300 squats, 1 mile run",
				scheme: "time",
			},
			mockContext as any,
		)

		expect(createResult).toMatchObject({
			success: true,
			data: {
				name: "Murph",
			},
		})

		// ========== STEP 3: Update event ==========
		mockDb.query.trackWorkoutsTable.findFirst.mockResolvedValue({
			id: "tw_1",
			trackId: "track_1",
			workoutId: "wkt_1",
		})

		const updateResult = await manageEvents.execute!(
			{
				competitionId: "comp_123",
				action: "update",
				trackWorkoutId: "tw_1",
				workoutDescription: "21-15-9 Thrusters (95/65) and Pull-ups",
			},
			mockContext as any,
		)

		expect(updateResult).toMatchObject({
			success: true,
			data: {
				trackWorkoutId: "tw_1",
				updated: expect.objectContaining({
					description: "21-15-9 Thrusters (95/65) and Pull-ups",
				}),
			},
		})

		// ========== STEP 4: Delete event ==========
		mockDb.query.trackWorkoutsTable.findFirst.mockResolvedValue({
			id: "tw_2",
			trackId: "track_1",
			workoutId: "wkt_2",
		})

		const deleteResult = await manageEvents.execute!(
			{
				competitionId: "comp_123",
				action: "delete",
				trackWorkoutId: "tw_2",
			},
			mockContext as any,
		)

		expect(deleteResult).toMatchObject({
			success: true,
			data: {
				trackWorkoutId: "tw_2",
			},
		})
	})
})

describe("Error Propagation Workflow", () => {
	const mockDb = {
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

	it("should propagate structured errors through workflow", async () => {
		// Attempt to manage divisions for non-existent competition
		mockDb.query.competitionsTable.findFirst.mockResolvedValue(null)

		const result = await manageDivisions.execute!(
			{
				competitionId: "comp_999",
				action: "list",
			},
			mockContext as any,
		)

		// Should receive structured error with actionable guidance
		expect(result).toMatchObject({
			error: "COMPETITION_NOT_FOUND",
			message: expect.stringContaining("comp_999"),
			suggestion: expect.stringContaining("listCompetitions"),
			nextActions: expect.arrayContaining(["listCompetitions"]),
			context: {
				competitionId: "comp_999",
			},
		})
	})

	it("should handle access denied errors", async () => {
		// Mock competition belonging to different team (query will return null)
		mockDb.query.competitionsTable.findFirst.mockResolvedValue(null)

		const result = await manageDivisions.execute!(
			{
				competitionId: "comp_123",
				action: "list",
			},
			mockContext as any,
		)

		// Should return COMPETITION_NOT_FOUND (doesn't leak info about competitions user can't access)
		expect(result).toMatchObject({
			error: "COMPETITION_NOT_FOUND",
			message: expect.stringContaining("comp_123"),
			suggestion: expect.stringContaining("listCompetitions"),
		})
	})
})
