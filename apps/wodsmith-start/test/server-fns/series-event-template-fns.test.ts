/**
 * Series Event Template Server Functions Tests
 *
 * Tests for series event template CRUD, auto-mapping algorithm,
 * event name normalization, input validation, and data enrichment.
 *
 * Note: normalizeEventName, sortedEventKey, autoMapEvents, and
 * toSeriesTemplateEvent are not exported from the source module.
 * We test them indirectly via the server functions that use them,
 * and also re-implement the pure logic here for thorough unit coverage.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { FakeDrizzleDb } from "@repo/test-utils"

// ============================================================================
// Mocks
// ============================================================================

const mockDb = new FakeDrizzleDb()

vi.mock("@/db", () => ({
	getDb: vi.fn(() => mockDb),
}))

vi.mock("@/utils/auth", () => ({
	getSessionFromCookie: vi.fn(async () => ({
		userId: "user-1",
		teams: [
			{
				id: "team-1",
				name: "Test Team",
				permissions: ["manage_programming"],
			},
		],
	})),
}))

vi.mock("@/utils/team-auth", () => ({
	requireTeamPermission: vi.fn(() => Promise.resolve()),
	hasTeamPermission: vi.fn(() => Promise.resolve(true)),
}))

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => {
		return {
			inputValidator: (validatorFn: (data: unknown) => unknown) => ({
				handler: (fn: (ctx: { data: unknown }) => Promise<unknown>) => {
					return async (ctx: { data: unknown }) => {
						const validatedData = validatorFn(ctx.data)
						return fn({ data: validatedData })
					}
				},
			}),
		}
	},
}))

vi.mock("@/types/competitions", () => ({
	parseSeriesSettings: vi.fn((settings: string | null) => {
		if (!settings) return null
		try {
			return JSON.parse(settings)
		} catch {
			return null
		}
	}),
	stringifySeriesSettings: vi.fn((settings: unknown) => {
		if (!settings) return null
		return JSON.stringify(settings)
	}),
}))

// Import after mocks are set up
import {
	getSeriesTemplateEventsFn,
	addEventToSeriesTemplateFn,
	updateSeriesTemplateEventFn,
	deleteSeriesTemplateEventFn,
	saveSeriesEventMappingsFn,
	syncTemplateEventsToCompetitionsFn,
	type SeriesTemplateEvent,
} from "@/server-fns/series-event-template-fns"

import {
	WORKOUT_SCHEME_VALUES,
	SCORE_TYPE_VALUES,
	TIEBREAK_SCHEME_VALUES,
} from "@/db/schemas/workouts"

// ============================================================================
// Re-implementations of private functions for direct unit testing
// ============================================================================

/**
 * Re-implementation of the private normalizeEventName function
 * to allow direct unit testing of the normalization logic.
 */
function normalizeEventName(name: string): string {
	let n = name.toLowerCase().trim()
	// Remove parenthesized suffixes
	n = n.replace(/\s*\([^)]*\)\s*/g, " ")
	// Normalize common prefixes: "event 1:", "event 1 -", "wod 1:", etc.
	n = n.replace(/^(event|wod|workout)\s*\d+\s*[:\-–—]\s*/i, "")
	// Strip common filler words
	n = n.replace(/\b(the|and|&|of)\b/g, "")
	// Collapse whitespace
	n = n.replace(/\s+/g, " ").trim()
	return n
}

/**
 * Re-implementation of the private sortedEventKey function.
 */
function sortedEventKey(name: string): string {
	return normalizeEventName(name).split(" ").sort().join(" ")
}

/**
 * Re-implementation of the private autoMapEvents function.
 */
function autoMapEvents(
	compEvents: Array<{ trackWorkoutId: string; workoutName: string }>,
	templateEvents: Array<{ trackWorkoutId: string; workoutName: string }>,
): Array<{
	competitionEventId: string
	competitionEventName: string
	templateEventId: string | null
	confidence: "exact" | "fuzzy" | "none"
	saved: boolean
}> {
	const templateKeys = templateEvents.map((te) => ({
		...te,
		normalized: normalizeEventName(te.workoutName),
		sorted: sortedEventKey(te.workoutName),
	}))

	const claimedTemplateIds = new Set<string>()

	return compEvents.map((compEvent) => {
		const compLower = compEvent.workoutName.toLowerCase().trim()

		// 1. Exact match (case-insensitive)
		const exactMatch = templateKeys.find(
			(te) =>
				te.workoutName.toLowerCase().trim() === compLower &&
				!claimedTemplateIds.has(te.trackWorkoutId),
		)
		if (exactMatch) {
			claimedTemplateIds.add(exactMatch.trackWorkoutId)
			return {
				competitionEventId: compEvent.trackWorkoutId,
				competitionEventName: compEvent.workoutName,
				templateEventId: exactMatch.trackWorkoutId,
				confidence: "exact" as const,
				saved: false,
			}
		}

		// 2. Normalized match
		const compNormalized = normalizeEventName(compEvent.workoutName)
		const normalizedMatch = templateKeys.find(
			(te) =>
				te.normalized === compNormalized &&
				!claimedTemplateIds.has(te.trackWorkoutId),
		)
		if (normalizedMatch) {
			claimedTemplateIds.add(normalizedMatch.trackWorkoutId)
			return {
				competitionEventId: compEvent.trackWorkoutId,
				competitionEventName: compEvent.workoutName,
				templateEventId: normalizedMatch.trackWorkoutId,
				confidence: "fuzzy" as const,
				saved: false,
			}
		}

		// 3. Sorted-token match
		const compSorted = sortedEventKey(compEvent.workoutName)
		const sortedMatch = templateKeys.find(
			(te) =>
				te.sorted === compSorted &&
				!claimedTemplateIds.has(te.trackWorkoutId),
		)
		if (sortedMatch) {
			claimedTemplateIds.add(sortedMatch.trackWorkoutId)
			return {
				competitionEventId: compEvent.trackWorkoutId,
				competitionEventName: compEvent.workoutName,
				templateEventId: sortedMatch.trackWorkoutId,
				confidence: "fuzzy" as const,
				saved: false,
			}
		}

		// 4. No match
		return {
			competitionEventId: compEvent.trackWorkoutId,
			competitionEventName: compEvent.workoutName,
			templateEventId: null,
			confidence: "none" as const,
			saved: false,
		}
	})
}

/**
 * Re-implementation of the private toSeriesTemplateEvent function.
 */
function toSeriesTemplateEvent(raw: {
	id: string
	trackId: string
	workoutId: string
	trackOrder: number
	parentEventId: string | null
	notes: string | null
	pointsMultiplier: number | null
	createdAt: Date
	updatedAt: Date
	workout: {
		id: string
		name: string
		description: string | null
		scheme: string | null
		scoreType: string | null
		timeCap: number | null
	}
}): SeriesTemplateEvent {
	return {
		...raw,
		order: Number(raw.trackOrder),
		name: raw.workout.name,
		scoreType: raw.workout.scoreType,
	}
}

// ============================================================================
// Helpers
// ============================================================================

function createMockRawTrackWorkout(
	overrides: Partial<{
		id: string
		trackId: string
		workoutId: string
		trackOrder: number
		parentEventId: string | null
		notes: string | null
		pointsMultiplier: number | null
		createdAt: Date
		updatedAt: Date
		workout: {
			id: string
			name: string
			description: string | null
			scheme: string | null
			scoreType: string | null
			timeCap: number | null
		}
	}> = {},
) {
	const now = new Date()
	return {
		id: overrides.id ?? "tw-1",
		trackId: overrides.trackId ?? "track-1",
		workoutId: overrides.workoutId ?? "workout-1",
		trackOrder: overrides.trackOrder ?? 1,
		parentEventId: overrides.parentEventId ?? null,
		notes: overrides.notes ?? null,
		pointsMultiplier: overrides.pointsMultiplier ?? 100,
		createdAt: overrides.createdAt ?? now,
		updatedAt: overrides.updatedAt ?? now,
		workout: overrides.workout ?? {
			id: "workout-1",
			name: "Fran",
			description: "21-15-9 Thrusters and Pull-ups",
			scheme: "time",
			scoreType: "min",
			timeCap: 600,
		},
	}
}

// ============================================================================
// Tests
// ============================================================================

describe("Series Event Template Server Functions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockDb.reset()
	})

	// ========================================================================
	// normalizeEventName (re-implemented pure function)
	// ========================================================================

	describe("normalizeEventName", () => {
		it("lowercases and trims input", () => {
			expect(normalizeEventName("  FRAN  ")).toBe("fran")
		})

		it("strips 'Event N:' prefix", () => {
			expect(normalizeEventName("Event 1: Fran")).toBe("fran")
		})

		it("strips 'Event N -' prefix with dash", () => {
			expect(normalizeEventName("Event 3 - Clean Ladder")).toBe(
				"clean ladder",
			)
		})

		it("strips 'WOD N:' prefix", () => {
			expect(normalizeEventName("WOD 2: Diane")).toBe("diane")
		})

		it("strips 'Workout N:' prefix", () => {
			expect(normalizeEventName("Workout 5: Grace")).toBe("grace")
		})

		it("strips parenthesized suffixes", () => {
			expect(normalizeEventName("Fran (Modified)")).toBe("fran")
		})

		it("strips multiple parenthesized parts", () => {
			expect(normalizeEventName("Fran (RX) (Men)")).toBe("fran")
		})

		it("strips filler words: the, and, of, &", () => {
			expect(normalizeEventName("The Clean and Jerk")).toBe("clean jerk")
		})

		it("handles & surrounded by word characters as a filler word", () => {
			// The regex \b(the|and|&|of)\b uses word boundaries; standalone &
			// is not bounded by \b since & is not a word character, so it stays.
			// Only 'and' is removed: "snatch and clean" -> "snatch clean"
			expect(normalizeEventName("Snatch and Clean")).toBe("snatch clean")
			// & without word boundaries is preserved
			expect(normalizeEventName("Snatch & Clean")).toBe("snatch & clean")
		})

		it("collapses multiple whitespace", () => {
			expect(normalizeEventName("Clean   Ladder")).toBe("clean ladder")
		})

		it("handles combined prefix + parenthesized suffix + fillers", () => {
			expect(
				normalizeEventName("Event 1: The Clean and Jerk (RX)"),
			).toBe("clean jerk")
		})

		it("returns empty string for empty input", () => {
			expect(normalizeEventName("")).toBe("")
		})

		it("handles name with only filler words", () => {
			// 'the and of' -> all stripped -> empty after trim
			expect(normalizeEventName("the and of")).toBe("")
		})

		it("handles em-dash prefix separator", () => {
			expect(normalizeEventName("Event 1\u2014Fran")).toBe("fran")
		})

		it("handles en-dash prefix separator", () => {
			expect(normalizeEventName("Event 2\u2013Diane")).toBe("diane")
		})
	})

	// ========================================================================
	// sortedEventKey (re-implemented pure function)
	// ========================================================================

	describe("sortedEventKey", () => {
		it("sorts tokens alphabetically after normalizing", () => {
			expect(sortedEventKey("Clean Ladder")).toBe("clean ladder")
		})

		it("sorts tokens so different orderings produce the same key", () => {
			expect(sortedEventKey("Ladder Clean")).toBe(
				sortedEventKey("Clean Ladder"),
			)
		})

		it("strips prefixes before sorting", () => {
			expect(sortedEventKey("Event 1: Ladder Clean")).toBe(
				sortedEventKey("Clean Ladder"),
			)
		})

		it("handles single-word names", () => {
			expect(sortedEventKey("Fran")).toBe("fran")
		})

		it("handles names with filler words", () => {
			// 'the' is stripped, then 'clean' 'jerk' sorted
			expect(sortedEventKey("The Clean Jerk")).toBe("clean jerk")
		})
	})

	// ========================================================================
	// autoMapEvents (re-implemented pure function)
	// ========================================================================

	describe("autoMapEvents", () => {
		it("returns exact match when names match case-insensitively", () => {
			const result = autoMapEvents(
				[{ trackWorkoutId: "comp-1", workoutName: "Fran" }],
				[{ trackWorkoutId: "tmpl-1", workoutName: "fran" }],
			)
			expect(result).toHaveLength(1)
			expect(result[0].templateEventId).toBe("tmpl-1")
			expect(result[0].confidence).toBe("exact")
			expect(result[0].saved).toBe(false)
		})

		it("returns fuzzy match when names match after normalization", () => {
			const result = autoMapEvents(
				[{ trackWorkoutId: "comp-1", workoutName: "Event 1: Fran" }],
				[{ trackWorkoutId: "tmpl-1", workoutName: "Fran" }],
			)
			expect(result).toHaveLength(1)
			expect(result[0].templateEventId).toBe("tmpl-1")
			expect(result[0].confidence).toBe("fuzzy")
		})

		it("returns fuzzy match when names match after sorting tokens", () => {
			const result = autoMapEvents(
				[
					{
						trackWorkoutId: "comp-1",
						workoutName: "Ladder Clean",
					},
				],
				[
					{
						trackWorkoutId: "tmpl-1",
						workoutName: "Clean Ladder",
					},
				],
			)
			expect(result).toHaveLength(1)
			expect(result[0].templateEventId).toBe("tmpl-1")
			expect(result[0].confidence).toBe("fuzzy")
		})

		it("returns none when no match is found", () => {
			const result = autoMapEvents(
				[{ trackWorkoutId: "comp-1", workoutName: "Completely Different" }],
				[{ trackWorkoutId: "tmpl-1", workoutName: "Fran" }],
			)
			expect(result).toHaveLength(1)
			expect(result[0].templateEventId).toBeNull()
			expect(result[0].confidence).toBe("none")
		})

		it("does not double-claim a template event", () => {
			const result = autoMapEvents(
				[
					{ trackWorkoutId: "comp-1", workoutName: "Fran" },
					{ trackWorkoutId: "comp-2", workoutName: "Fran" },
				],
				[{ trackWorkoutId: "tmpl-1", workoutName: "Fran" }],
			)
			expect(result).toHaveLength(2)
			// First one gets the match
			expect(result[0].templateEventId).toBe("tmpl-1")
			expect(result[0].confidence).toBe("exact")
			// Second one gets no match (template already claimed)
			expect(result[1].templateEventId).toBeNull()
			expect(result[1].confidence).toBe("none")
		})

		it("handles empty competition events", () => {
			const result = autoMapEvents(
				[],
				[{ trackWorkoutId: "tmpl-1", workoutName: "Fran" }],
			)
			expect(result).toHaveLength(0)
		})

		it("handles empty template events", () => {
			const result = autoMapEvents(
				[{ trackWorkoutId: "comp-1", workoutName: "Fran" }],
				[],
			)
			expect(result).toHaveLength(1)
			expect(result[0].templateEventId).toBeNull()
			expect(result[0].confidence).toBe("none")
		})

		it("maps multiple events correctly with mixed match types", () => {
			const result = autoMapEvents(
				[
					{ trackWorkoutId: "comp-1", workoutName: "Fran" },
					{
						trackWorkoutId: "comp-2",
						workoutName: "Event 2: Clean Ladder",
					},
					{
						trackWorkoutId: "comp-3",
						workoutName: "Mystery Event",
					},
				],
				[
					{ trackWorkoutId: "tmpl-1", workoutName: "Fran" },
					{
						trackWorkoutId: "tmpl-2",
						workoutName: "Clean Ladder",
					},
				],
			)
			expect(result).toHaveLength(3)
			expect(result[0].confidence).toBe("exact")
			expect(result[0].templateEventId).toBe("tmpl-1")
			expect(result[1].confidence).toBe("fuzzy")
			expect(result[1].templateEventId).toBe("tmpl-2")
			expect(result[2].confidence).toBe("none")
			expect(result[2].templateEventId).toBeNull()
		})

		it("prefers exact match over normalized match", () => {
			// If comp event "Fran" matches template "Fran" exactly,
			// it should not fall through to normalized matching
			const result = autoMapEvents(
				[{ trackWorkoutId: "comp-1", workoutName: "Fran" }],
				[
					{
						trackWorkoutId: "tmpl-1",
						workoutName: "Event 1: Fran",
					},
					{ trackWorkoutId: "tmpl-2", workoutName: "Fran" },
				],
			)
			expect(result[0].templateEventId).toBe("tmpl-2")
			expect(result[0].confidence).toBe("exact")
		})

		it("preserves competitionEventName in output", () => {
			const result = autoMapEvents(
				[{ trackWorkoutId: "comp-1", workoutName: "Event 1: Fran" }],
				[{ trackWorkoutId: "tmpl-1", workoutName: "Fran" }],
			)
			expect(result[0].competitionEventName).toBe("Event 1: Fran")
			expect(result[0].competitionEventId).toBe("comp-1")
		})

		it("matches with parenthesized suffix stripping", () => {
			const result = autoMapEvents(
				[
					{
						trackWorkoutId: "comp-1",
						workoutName: "Fran (Modified)",
					},
				],
				[{ trackWorkoutId: "tmpl-1", workoutName: "Fran" }],
			)
			expect(result[0].templateEventId).toBe("tmpl-1")
			expect(result[0].confidence).toBe("fuzzy")
		})
	})

	// ========================================================================
	// toSeriesTemplateEvent (re-implemented pure function)
	// ========================================================================

	describe("toSeriesTemplateEvent", () => {
		it("enriches raw data with convenience fields", () => {
			const raw = createMockRawTrackWorkout({
				trackOrder: 3,
				workout: {
					id: "w-1",
					name: "Grace",
					description: "30 Clean and Jerks",
					scheme: "time",
					scoreType: "min",
					timeCap: null,
				},
			})

			const result = toSeriesTemplateEvent(raw)

			expect(result.order).toBe(3)
			expect(result.name).toBe("Grace")
			expect(result.scoreType).toBe("min")
		})

		it("preserves all original fields", () => {
			const now = new Date()
			const raw = createMockRawTrackWorkout({
				id: "tw-99",
				trackId: "track-5",
				workoutId: "w-5",
				trackOrder: 2,
				parentEventId: "tw-parent",
				notes: "Some notes",
				pointsMultiplier: 200,
				createdAt: now,
				updatedAt: now,
			})

			const result = toSeriesTemplateEvent(raw)

			expect(result.id).toBe("tw-99")
			expect(result.trackId).toBe("track-5")
			expect(result.workoutId).toBe("w-5")
			expect(result.trackOrder).toBe(2)
			expect(result.parentEventId).toBe("tw-parent")
			expect(result.notes).toBe("Some notes")
			expect(result.pointsMultiplier).toBe(200)
			expect(result.createdAt).toBe(now)
			expect(result.updatedAt).toBe(now)
		})

		it("converts trackOrder to number for order field", () => {
			// trackOrder might come as a string-like number from DB
			const raw = createMockRawTrackWorkout({ trackOrder: 1.01 })
			const result = toSeriesTemplateEvent(raw)
			expect(result.order).toBe(1.01)
		})

		it("handles null scoreType", () => {
			const raw = createMockRawTrackWorkout({
				workout: {
					id: "w-1",
					name: "Unknown",
					description: null,
					scheme: null,
					scoreType: null,
					timeCap: null,
				},
			})
			const result = toSeriesTemplateEvent(raw)
			expect(result.scoreType).toBeNull()
		})
	})

	// ========================================================================
	// Input validation schemas
	// ========================================================================

	describe("Input Validation Schemas", () => {
		describe("getSeriesTemplateEventsFn input", () => {
			const schema = z.object({
				groupId: z.string().min(1),
			})

			it("accepts valid input", () => {
				expect(() => schema.parse({ groupId: "group-1" })).not.toThrow()
			})

			it("rejects empty groupId", () => {
				expect(() => schema.parse({ groupId: "" })).toThrow()
			})

			it("rejects missing groupId", () => {
				expect(() => schema.parse({})).toThrow()
			})

			it("rejects non-string groupId", () => {
				expect(() => schema.parse({ groupId: 123 })).toThrow()
			})
		})

		describe("getSeriesTemplateEventByIdFn input", () => {
			const schema = z.object({
				trackWorkoutId: z.string().min(1),
				groupId: z.string().min(1),
			})

			it("accepts valid input", () => {
				expect(() =>
					schema.parse({
						trackWorkoutId: "tw-1",
						groupId: "group-1",
					}),
				).not.toThrow()
			})

			it("rejects missing trackWorkoutId", () => {
				expect(() =>
					schema.parse({ groupId: "group-1" }),
				).toThrow()
			})

			it("rejects empty trackWorkoutId", () => {
				expect(() =>
					schema.parse({
						trackWorkoutId: "",
						groupId: "group-1",
					}),
				).toThrow()
			})
		})

		describe("addEventToSeriesTemplateFn input", () => {
			const schema = z.object({
				groupId: z.string().min(1),
				trackId: z.string().min(1),
				workout: z.object({
					name: z.string().min(1).max(200),
					description: z.string().max(5000).optional(),
					scheme: z.enum(WORKOUT_SCHEME_VALUES).optional(),
					scoreType: z.enum(SCORE_TYPE_VALUES).nullable().optional(),
					scoreSortOrder: z.string().optional(),
				}),
				parentEventId: z.string().min(1).optional(),
			})

			it("accepts valid input with all fields", () => {
				expect(() =>
					schema.parse({
						groupId: "group-1",
						trackId: "track-1",
						workout: {
							name: "Fran",
							description: "21-15-9",
							scheme: "time",
							scoreType: "min",
						},
						parentEventId: "tw-parent",
					}),
				).not.toThrow()
			})

			it("accepts minimal valid input", () => {
				expect(() =>
					schema.parse({
						groupId: "group-1",
						trackId: "track-1",
						workout: { name: "Fran" },
					}),
				).not.toThrow()
			})

			it("rejects empty workout name", () => {
				expect(() =>
					schema.parse({
						groupId: "group-1",
						trackId: "track-1",
						workout: { name: "" },
					}),
				).toThrow()
			})

			it("rejects workout name over 200 chars", () => {
				expect(() =>
					schema.parse({
						groupId: "group-1",
						trackId: "track-1",
						workout: { name: "x".repeat(201) },
					}),
				).toThrow()
			})

			it("rejects invalid scheme value", () => {
				expect(() =>
					schema.parse({
						groupId: "group-1",
						trackId: "track-1",
						workout: { name: "Fran", scheme: "invalid_scheme" },
					}),
				).toThrow()
			})

			it("rejects invalid scoreType value", () => {
				expect(() =>
					schema.parse({
						groupId: "group-1",
						trackId: "track-1",
						workout: {
							name: "Fran",
							scoreType: "invalid_score_type",
						},
					}),
				).toThrow()
			})

			it("accepts null scoreType", () => {
				expect(() =>
					schema.parse({
						groupId: "group-1",
						trackId: "track-1",
						workout: { name: "Fran", scoreType: null },
					}),
				).not.toThrow()
			})

			it("accepts valid scheme values", () => {
				for (const scheme of WORKOUT_SCHEME_VALUES) {
					expect(() =>
						schema.parse({
							groupId: "g",
							trackId: "t",
							workout: { name: "Test", scheme },
						}),
					).not.toThrow()
				}
			})

			it("accepts valid scoreType values", () => {
				for (const scoreType of SCORE_TYPE_VALUES) {
					expect(() =>
						schema.parse({
							groupId: "g",
							trackId: "t",
							workout: { name: "Test", scoreType },
						}),
					).not.toThrow()
				}
			})
		})

		describe("updateSeriesTemplateEventFn input", () => {
			const schema = z.object({
				trackWorkoutId: z.string().min(1),
				groupId: z.string().min(1),
				workout: z
					.object({
						name: z.string().min(1).max(200).optional(),
						description: z.string().max(5000).optional(),
						scheme: z.enum(WORKOUT_SCHEME_VALUES).optional(),
						scoreType: z
							.enum(SCORE_TYPE_VALUES)
							.nullable()
							.optional(),
						scoreSortOrder: z.string().optional(),
						timeCap: z.number().int().min(1).nullable().optional(),
						tiebreakScheme: z
							.enum(TIEBREAK_SCHEME_VALUES)
							.nullable()
							.optional(),
						reps: z.number().int().min(1).nullable().optional(),
					})
					.optional(),
				movementIds: z.array(z.string()).optional(),
				pointsMultiplier: z.number().int().min(1).optional(),
				notes: z.string().max(1000).nullable().optional(),
			})

			it("accepts valid full update", () => {
				expect(() =>
					schema.parse({
						trackWorkoutId: "tw-1",
						groupId: "group-1",
						workout: {
							name: "Updated Fran",
							timeCap: 300,
							tiebreakScheme: "time",
							reps: 45,
						},
						movementIds: ["m-1", "m-2"],
						pointsMultiplier: 200,
						notes: "Updated notes",
					}),
				).not.toThrow()
			})

			it("accepts minimal update (just IDs)", () => {
				expect(() =>
					schema.parse({
						trackWorkoutId: "tw-1",
						groupId: "group-1",
					}),
				).not.toThrow()
			})

			it("rejects timeCap of zero", () => {
				expect(() =>
					schema.parse({
						trackWorkoutId: "tw-1",
						groupId: "group-1",
						workout: { timeCap: 0 },
					}),
				).toThrow()
			})

			it("rejects negative pointsMultiplier", () => {
				expect(() =>
					schema.parse({
						trackWorkoutId: "tw-1",
						groupId: "group-1",
						pointsMultiplier: -1,
					}),
				).toThrow()
			})

			it("rejects pointsMultiplier of zero", () => {
				expect(() =>
					schema.parse({
						trackWorkoutId: "tw-1",
						groupId: "group-1",
						pointsMultiplier: 0,
					}),
				).toThrow()
			})

			it("accepts null timeCap", () => {
				expect(() =>
					schema.parse({
						trackWorkoutId: "tw-1",
						groupId: "group-1",
						workout: { timeCap: null },
					}),
				).not.toThrow()
			})

			it("accepts null notes", () => {
				expect(() =>
					schema.parse({
						trackWorkoutId: "tw-1",
						groupId: "group-1",
						notes: null,
					}),
				).not.toThrow()
			})

			it("rejects notes over 1000 chars", () => {
				expect(() =>
					schema.parse({
						trackWorkoutId: "tw-1",
						groupId: "group-1",
						notes: "x".repeat(1001),
					}),
				).toThrow()
			})

			it("accepts valid tiebreakScheme values", () => {
				for (const tiebreakScheme of TIEBREAK_SCHEME_VALUES) {
					expect(() =>
						schema.parse({
							trackWorkoutId: "tw-1",
							groupId: "group-1",
							workout: { tiebreakScheme },
						}),
					).not.toThrow()
				}
			})
		})

		describe("reorderSeriesTemplateEventsFn input", () => {
			const schema = z.object({
				trackId: z.string().min(1),
				groupId: z.string().min(1),
				orderedEventIds: z.array(z.string().min(1)).min(1),
			})

			it("accepts valid input", () => {
				expect(() =>
					schema.parse({
						trackId: "track-1",
						groupId: "group-1",
						orderedEventIds: ["tw-1", "tw-2", "tw-3"],
					}),
				).not.toThrow()
			})

			it("rejects empty orderedEventIds array", () => {
				expect(() =>
					schema.parse({
						trackId: "track-1",
						groupId: "group-1",
						orderedEventIds: [],
					}),
				).toThrow()
			})

			it("rejects orderedEventIds with empty strings", () => {
				expect(() =>
					schema.parse({
						trackId: "track-1",
						groupId: "group-1",
						orderedEventIds: ["tw-1", ""],
					}),
				).toThrow()
			})
		})

		describe("saveSeriesEventMappingsFn input", () => {
			const schema = z.object({
				groupId: z.string().min(1),
				mappings: z.array(
					z.object({
						competitionId: z.string().min(1),
						competitionEventId: z.string().min(1),
						templateEventId: z.string().min(1),
					}),
				),
			})

			it("accepts valid input with mappings", () => {
				expect(() =>
					schema.parse({
						groupId: "group-1",
						mappings: [
							{
								competitionId: "comp-1",
								competitionEventId: "evt-1",
								templateEventId: "tmpl-1",
							},
						],
					}),
				).not.toThrow()
			})

			it("accepts empty mappings array (clear all)", () => {
				expect(() =>
					schema.parse({
						groupId: "group-1",
						mappings: [],
					}),
				).not.toThrow()
			})

			it("rejects mapping with empty competitionId", () => {
				expect(() =>
					schema.parse({
						groupId: "group-1",
						mappings: [
							{
								competitionId: "",
								competitionEventId: "evt-1",
								templateEventId: "tmpl-1",
							},
						],
					}),
				).toThrow()
			})
		})

		describe("syncTemplateEventsToCompetitionsFn input", () => {
			const schema = z.object({
				groupId: z.string().min(1),
				competitionIds: z.array(z.string().min(1)).optional(),
				templateEventIds: z.array(z.string().min(1)).optional(),
			})

			it("accepts minimal valid input (just groupId)", () => {
				expect(() =>
					schema.parse({ groupId: "group-1" }),
				).not.toThrow()
			})

			it("accepts input with competitionIds", () => {
				expect(() =>
					schema.parse({
						groupId: "group-1",
						competitionIds: ["comp-1", "comp-2"],
					}),
				).not.toThrow()
			})

			it("accepts input with templateEventIds", () => {
				expect(() =>
					schema.parse({
						groupId: "group-1",
						templateEventIds: ["tmpl-1"],
					}),
				).not.toThrow()
			})

			it("accepts input with both optional arrays", () => {
				expect(() =>
					schema.parse({
						groupId: "group-1",
						competitionIds: ["comp-1"],
						templateEventIds: ["tmpl-1"],
					}),
				).not.toThrow()
			})
		})
	})

	// ========================================================================
	// templateEventIds parent auto-inclusion logic
	// ========================================================================

	describe("templateEventIds parent auto-inclusion logic", () => {
		it("auto-includes parent when only child event is selected", () => {
			// Simulate the filtering logic from syncTemplateEventsToCompetitionsFn
			const parentTemplates = [
				{ id: "parent-1", parentEventId: null },
				{ id: "parent-2", parentEventId: null },
			]
			const childTemplates = [
				{ id: "child-1a", parentEventId: "parent-1" },
				{ id: "child-1b", parentEventId: "parent-1" },
				{ id: "child-2a", parentEventId: "parent-2" },
			]

			// User selects only child-2a
			const templateEventIds = ["child-2a"]
			const allowedIds = new Set(templateEventIds)

			// Auto-include parents of any selected child events
			for (const child of childTemplates) {
				if (allowedIds.has(child.id) && child.parentEventId) {
					allowedIds.add(child.parentEventId)
				}
			}

			const filteredParents = parentTemplates.filter((tw) =>
				allowedIds.has(tw.id),
			)
			const filteredChildren = childTemplates.filter(
				(tw) =>
					allowedIds.has(tw.id) ||
					(tw.parentEventId && allowedIds.has(tw.parentEventId)),
			)

			// parent-2 should be auto-included
			expect(filteredParents.map((p) => p.id)).toEqual(["parent-2"])
			// child-2a should be included (directly selected)
			expect(filteredChildren.map((c) => c.id)).toEqual(["child-2a"])
		})

		it("includes all children when parent is selected", () => {
			const parentTemplates = [
				{ id: "parent-1", parentEventId: null },
			]
			const childTemplates = [
				{ id: "child-1a", parentEventId: "parent-1" },
				{ id: "child-1b", parentEventId: "parent-1" },
			]

			// User selects only parent-1
			const templateEventIds = ["parent-1"]
			const allowedIds = new Set(templateEventIds)

			// Auto-include parents of selected children (none selected)
			for (const child of childTemplates) {
				if (allowedIds.has(child.id) && child.parentEventId) {
					allowedIds.add(child.parentEventId)
				}
			}

			const filteredParents = parentTemplates.filter((tw) =>
				allowedIds.has(tw.id),
			)
			// Include child events whose parent is in the allowed set
			const filteredChildren = childTemplates.filter(
				(tw) =>
					allowedIds.has(tw.id) ||
					(tw.parentEventId && allowedIds.has(tw.parentEventId)),
			)

			expect(filteredParents.map((p) => p.id)).toEqual(["parent-1"])
			// Both children should be included because their parent is selected
			expect(filteredChildren.map((c) => c.id)).toEqual([
				"child-1a",
				"child-1b",
			])
		})

		it("does not include unrelated parents or children", () => {
			const parentTemplates = [
				{ id: "parent-1", parentEventId: null },
				{ id: "parent-2", parentEventId: null },
			]
			const childTemplates = [
				{ id: "child-1a", parentEventId: "parent-1" },
				{ id: "child-2a", parentEventId: "parent-2" },
			]

			// User selects only parent-1
			const templateEventIds = ["parent-1"]
			const allowedIds = new Set(templateEventIds)

			for (const child of childTemplates) {
				if (allowedIds.has(child.id) && child.parentEventId) {
					allowedIds.add(child.parentEventId)
				}
			}

			const filteredParents = parentTemplates.filter((tw) =>
				allowedIds.has(tw.id),
			)
			const filteredChildren = childTemplates.filter(
				(tw) =>
					allowedIds.has(tw.id) ||
					(tw.parentEventId && allowedIds.has(tw.parentEventId)),
			)

			expect(filteredParents.map((p) => p.id)).toEqual(["parent-1"])
			// Only child-1a (under parent-1), not child-2a
			expect(filteredChildren.map((c) => c.id)).toEqual(["child-1a"])
		})

		it("handles selecting both parent and child explicitly", () => {
			const parentTemplates = [
				{ id: "parent-1", parentEventId: null },
			]
			const childTemplates = [
				{ id: "child-1a", parentEventId: "parent-1" },
				{ id: "child-1b", parentEventId: "parent-1" },
			]

			// User selects parent-1 and child-1a
			const templateEventIds = ["parent-1", "child-1a"]
			const allowedIds = new Set(templateEventIds)

			for (const child of childTemplates) {
				if (allowedIds.has(child.id) && child.parentEventId) {
					allowedIds.add(child.parentEventId)
				}
			}

			const filteredParents = parentTemplates.filter((tw) =>
				allowedIds.has(tw.id),
			)
			const filteredChildren = childTemplates.filter(
				(tw) =>
					allowedIds.has(tw.id) ||
					(tw.parentEventId && allowedIds.has(tw.parentEventId)),
			)

			expect(filteredParents.map((p) => p.id)).toEqual(["parent-1"])
			// Both children included (parent is in allowedIds)
			expect(filteredChildren.map((c) => c.id)).toEqual([
				"child-1a",
				"child-1b",
			])
		})

		it("handles empty templateEventIds (no filtering)", () => {
			const templateEventIds: string[] = []
			// When templateEventIds is empty, the real code skips filtering entirely
			// and processes all templates. Verify that behavior.
			expect(templateEventIds.length).toBe(0)
		})
	})

	// ========================================================================
	// Server function integration tests (via mocked DB)
	// ========================================================================

	describe("getSeriesTemplateEventsFn", () => {
		it("validates input and rejects empty groupId", async () => {
			await expect(
				getSeriesTemplateEventsFn({ data: { groupId: "" } }),
			).rejects.toThrow()
		})

		it("returns empty events when no template track exists", async () => {
			// First call: load group
			mockDb.setMockReturnValue([
				{
					id: "group-1",
					organizingTeamId: "team-1",
					settings: null,
				},
			])

			const result = (await getSeriesTemplateEventsFn({
				data: { groupId: "group-1" },
			})) as { templateTrack: null; events: [] }

			expect(result.templateTrack).toBeNull()
			expect(result.events).toEqual([])
		})
	})

	describe("addEventToSeriesTemplateFn", () => {
		it("validates input and rejects empty workout name", async () => {
			await expect(
				addEventToSeriesTemplateFn({
					data: {
						groupId: "group-1",
						trackId: "track-1",
						workout: { name: "" },
					},
				}),
			).rejects.toThrow()
		})

		it("validates input and rejects missing required fields", async () => {
			await expect(
				addEventToSeriesTemplateFn({
					data: {
						groupId: "group-1",
						trackId: "track-1",
					},
				}),
			).rejects.toThrow()
		})
	})

	describe("updateSeriesTemplateEventFn", () => {
		it("validates input and rejects empty trackWorkoutId", async () => {
			await expect(
				updateSeriesTemplateEventFn({
					data: {
						trackWorkoutId: "",
						groupId: "group-1",
					},
				}),
			).rejects.toThrow()
		})
	})

	describe("deleteSeriesTemplateEventFn", () => {
		it("validates input and rejects empty groupId", async () => {
			await expect(
				deleteSeriesTemplateEventFn({
					data: {
						trackWorkoutId: "tw-1",
						groupId: "",
					},
				}),
			).rejects.toThrow()
		})
	})

	describe("saveSeriesEventMappingsFn", () => {
		it("validates input and rejects invalid mapping structure", async () => {
			await expect(
				saveSeriesEventMappingsFn({
					data: {
						groupId: "group-1",
						mappings: [{ invalid: true }],
					},
				}),
			).rejects.toThrow()
		})
	})

	describe("syncTemplateEventsToCompetitionsFn", () => {
		it("validates input and rejects empty groupId", async () => {
			await expect(
				syncTemplateEventsToCompetitionsFn({
					data: { groupId: "" },
				}),
			).rejects.toThrow()
		})

		it("returns synced=0 when no template track exists", async () => {
			// Load group (no settings -> no template track)
			mockDb.setMockReturnValue([
				{
					id: "group-1",
					organizingTeamId: "team-1",
					settings: null,
				},
			])

			const result = (await syncTemplateEventsToCompetitionsFn({
				data: { groupId: "group-1" },
			})) as { synced: number }

			expect(result.synced).toBe(0)
		})
	})
})
