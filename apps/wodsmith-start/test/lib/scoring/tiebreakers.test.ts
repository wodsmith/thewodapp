/**
 * Tiebreaker Logic Tests
 *
 * Tests for configurable tiebreaker implementations:
 * - countback: Most 1st places, then 2nd, etc.
 * - head_to_head: Compare placement in designated event
 * - none: Ties remain as ties
 *
 * @see docs/plans/configurable-scoring-system.md
 */

import { describe, expect, it } from "vitest"
import {
	applyTiebreakers,
	type TiebreakerInput,
} from "@/lib/scoring/tiebreakers"

describe("applyTiebreakers", () => {
	describe("basic ranking (no ties)", () => {
		it("ranks athletes by total points in descending order", () => {
			const input: TiebreakerInput = {
				athletes: [
					{ userId: "athlete-1", totalPoints: 100, eventPlacements: new Map() },
					{ userId: "athlete-2", totalPoints: 200, eventPlacements: new Map() },
					{ userId: "athlete-3", totalPoints: 150, eventPlacements: new Map() },
				],
				config: { primary: "none" },
			}

			const result = applyTiebreakers(input)

			expect(result).toEqual([
				{ userId: "athlete-2", totalPoints: 200, rank: 1 },
				{ userId: "athlete-3", totalPoints: 150, rank: 2 },
				{ userId: "athlete-1", totalPoints: 100, rank: 3 },
			])
		})

		it("returns empty array for empty input", () => {
			const input: TiebreakerInput = {
				athletes: [],
				config: { primary: "none" },
			}

			const result = applyTiebreakers(input)

			expect(result).toEqual([])
		})

		it("handles single athlete", () => {
			const input: TiebreakerInput = {
				athletes: [
					{ userId: "solo", totalPoints: 100, eventPlacements: new Map() },
				],
				config: { primary: "none" },
			}

			const result = applyTiebreakers(input)

			expect(result).toEqual([{ userId: "solo", totalPoints: 100, rank: 1 }])
		})
	})

	describe("tiebreaker: none", () => {
		it("assigns same rank to athletes with equal points", () => {
			const input: TiebreakerInput = {
				athletes: [
					{ userId: "athlete-1", totalPoints: 150, eventPlacements: new Map() },
					{ userId: "athlete-2", totalPoints: 200, eventPlacements: new Map() },
					{ userId: "athlete-3", totalPoints: 150, eventPlacements: new Map() },
				],
				config: { primary: "none" },
			}

			const result = applyTiebreakers(input)

			expect(result).toEqual([
				{ userId: "athlete-2", totalPoints: 200, rank: 1 },
				{ userId: "athlete-1", totalPoints: 150, rank: 2 },
				{ userId: "athlete-3", totalPoints: 150, rank: 2 },
			])
		})

		it("skips ranks after ties (standard competition ranking)", () => {
			const input: TiebreakerInput = {
				athletes: [
					{ userId: "athlete-1", totalPoints: 100, eventPlacements: new Map() },
					{ userId: "athlete-2", totalPoints: 200, eventPlacements: new Map() },
					{ userId: "athlete-3", totalPoints: 200, eventPlacements: new Map() },
					{ userId: "athlete-4", totalPoints: 150, eventPlacements: new Map() },
				],
				config: { primary: "none" },
			}

			const result = applyTiebreakers(input)

			// Two 1st places, next is 3rd (not 2nd)
			expect(result).toEqual([
				{ userId: "athlete-2", totalPoints: 200, rank: 1 },
				{ userId: "athlete-3", totalPoints: 200, rank: 1 },
				{ userId: "athlete-4", totalPoints: 150, rank: 3 },
				{ userId: "athlete-1", totalPoints: 100, rank: 4 },
			])
		})

		it("handles all athletes tied", () => {
			const input: TiebreakerInput = {
				athletes: [
					{ userId: "athlete-1", totalPoints: 100, eventPlacements: new Map() },
					{ userId: "athlete-2", totalPoints: 100, eventPlacements: new Map() },
					{ userId: "athlete-3", totalPoints: 100, eventPlacements: new Map() },
				],
				config: { primary: "none" },
			}

			const result = applyTiebreakers(input)

			expect(result).toEqual([
				{ userId: "athlete-1", totalPoints: 100, rank: 1 },
				{ userId: "athlete-2", totalPoints: 100, rank: 1 },
				{ userId: "athlete-3", totalPoints: 100, rank: 1 },
			])
		})
	})

	describe("tiebreaker: countback", () => {
		it("breaks tie using most 1st place finishes", () => {
			const input: TiebreakerInput = {
				athletes: [
					{
						userId: "athlete-1",
						totalPoints: 200,
						eventPlacements: new Map([
							["event-1", 2],
							["event-2", 1],
						]),
					},
					{
						userId: "athlete-2",
						totalPoints: 200,
						eventPlacements: new Map([
							["event-1", 1],
							["event-2", 2],
						]),
					},
					{
						userId: "athlete-3",
						totalPoints: 200,
						eventPlacements: new Map([
							["event-1", 1],
							["event-2", 1],
						]),
					},
				],
				config: { primary: "countback" },
			}

			const result = applyTiebreakers(input)

			// athlete-3 has 2x 1st place (wins)
			// athlete-1 and athlete-2 each have 1x 1st place (still tied)
			expect(result[0]).toEqual({
				userId: "athlete-3",
				totalPoints: 200,
				rank: 1,
			})
			// The remaining two should be rank 2 (still tied on countback)
			expect(result[1].rank).toBe(2)
			expect(result[2].rank).toBe(2)
		})

		it("falls back to 2nd places when 1st places are equal", () => {
			const input: TiebreakerInput = {
				athletes: [
					{
						userId: "athlete-1",
						totalPoints: 300,
						eventPlacements: new Map([
							["event-1", 1],
							["event-2", 3],
							["event-3", 2],
						]),
					},
					{
						userId: "athlete-2",
						totalPoints: 300,
						eventPlacements: new Map([
							["event-1", 1],
							["event-2", 2],
							["event-3", 2],
						]),
					},
				],
				config: { primary: "countback" },
			}

			const result = applyTiebreakers(input)

			// Both have 1x 1st place
			// athlete-2 has 2x 2nd place, athlete-1 has 1x 2nd place
			expect(result).toEqual([
				{ userId: "athlete-2", totalPoints: 300, rank: 1 },
				{ userId: "athlete-1", totalPoints: 300, rank: 2 },
			])
		})

		it("continues through all place levels until tie is broken", () => {
			const input: TiebreakerInput = {
				athletes: [
					{
						userId: "athlete-1",
						totalPoints: 300,
						eventPlacements: new Map([
							["event-1", 1],
							["event-2", 2],
							["event-3", 4], // 4th here
						]),
					},
					{
						userId: "athlete-2",
						totalPoints: 300,
						eventPlacements: new Map([
							["event-1", 1],
							["event-2", 2],
							["event-3", 3], // 3rd here
						]),
					},
				],
				config: { primary: "countback" },
			}

			const result = applyTiebreakers(input)

			// Equal 1st places (1 each), equal 2nd places (1 each)
			// athlete-2 has 1x 3rd place, athlete-1 has 0x 3rd place
			expect(result).toEqual([
				{ userId: "athlete-2", totalPoints: 300, rank: 1 },
				{ userId: "athlete-1", totalPoints: 300, rank: 2 },
			])
		})

		it("leaves tie if countback cannot resolve", () => {
			const input: TiebreakerInput = {
				athletes: [
					{
						userId: "athlete-1",
						totalPoints: 200,
						eventPlacements: new Map([
							["event-1", 1],
							["event-2", 2],
						]),
					},
					{
						userId: "athlete-2",
						totalPoints: 200,
						eventPlacements: new Map([
							["event-1", 2],
							["event-2", 1],
						]),
					},
				],
				config: { primary: "countback" },
			}

			const result = applyTiebreakers(input)

			// Both have exactly 1x 1st and 1x 2nd - unbreakable tie
			expect(result[0].rank).toBe(1)
			expect(result[1].rank).toBe(1)
		})

		it("handles athletes with no event placements", () => {
			const input: TiebreakerInput = {
				athletes: [
					{ userId: "athlete-1", totalPoints: 100, eventPlacements: new Map() },
					{ userId: "athlete-2", totalPoints: 100, eventPlacements: new Map() },
				],
				config: { primary: "countback" },
			}

			const result = applyTiebreakers(input)

			// No placements to count - tie remains
			expect(result[0].rank).toBe(1)
			expect(result[1].rank).toBe(1)
		})
	})

	describe("tiebreaker: head_to_head", () => {
		it("breaks tie using placement in designated event", () => {
			const input: TiebreakerInput = {
				athletes: [
					{
						userId: "athlete-1",
						totalPoints: 200,
						eventPlacements: new Map([
							["event-1", 2],
							["tiebreaker-event", 3],
						]),
					},
					{
						userId: "athlete-2",
						totalPoints: 200,
						eventPlacements: new Map([
							["event-1", 1],
							["tiebreaker-event", 1],
						]),
					},
					{
						userId: "athlete-3",
						totalPoints: 200,
						eventPlacements: new Map([
							["event-1", 3],
							["tiebreaker-event", 2],
						]),
					},
				],
				config: {
					primary: "head_to_head",
					headToHeadEventId: "tiebreaker-event",
				},
			}

			const result = applyTiebreakers(input)

			// Better placement in tiebreaker-event wins
			expect(result).toEqual([
				{ userId: "athlete-2", totalPoints: 200, rank: 1 },
				{ userId: "athlete-3", totalPoints: 200, rank: 2 },
				{ userId: "athlete-1", totalPoints: 200, rank: 3 },
			])
		})

		it("leaves tie if athlete missing from head_to_head event", () => {
			const input: TiebreakerInput = {
				athletes: [
					{
						userId: "athlete-1",
						totalPoints: 200,
						eventPlacements: new Map([["event-1", 1]]), // No tiebreaker event
					},
					{
						userId: "athlete-2",
						totalPoints: 200,
						eventPlacements: new Map([
							["event-1", 2],
							["tiebreaker-event", 1],
						]),
					},
				],
				config: {
					primary: "head_to_head",
					headToHeadEventId: "tiebreaker-event",
				},
			}

			const result = applyTiebreakers(input)

			// athlete-1 has no placement in tiebreaker event - treated as worse
			expect(result[0]).toEqual({
				userId: "athlete-2",
				totalPoints: 200,
				rank: 1,
			})
			expect(result[1]).toEqual({
				userId: "athlete-1",
				totalPoints: 200,
				rank: 2,
			})
		})

		it("leaves tie if both athletes missing from head_to_head event", () => {
			const input: TiebreakerInput = {
				athletes: [
					{
						userId: "athlete-1",
						totalPoints: 200,
						eventPlacements: new Map([["event-1", 1]]),
					},
					{
						userId: "athlete-2",
						totalPoints: 200,
						eventPlacements: new Map([["event-1", 2]]),
					},
				],
				config: {
					primary: "head_to_head",
					headToHeadEventId: "tiebreaker-event",
				},
			}

			const result = applyTiebreakers(input)

			// Neither has tiebreaker placement - tie remains
			expect(result[0].rank).toBe(1)
			expect(result[1].rank).toBe(1)
		})

		it("handles tied placement in head_to_head event", () => {
			const input: TiebreakerInput = {
				athletes: [
					{
						userId: "athlete-1",
						totalPoints: 200,
						eventPlacements: new Map([["tiebreaker-event", 2]]),
					},
					{
						userId: "athlete-2",
						totalPoints: 200,
						eventPlacements: new Map([["tiebreaker-event", 2]]),
					},
				],
				config: {
					primary: "head_to_head",
					headToHeadEventId: "tiebreaker-event",
				},
			}

			const result = applyTiebreakers(input)

			// Same placement in tiebreaker - tie remains
			expect(result[0].rank).toBe(1)
			expect(result[1].rank).toBe(1)
		})

		it("throws error when headToHeadEventId is missing for head_to_head method", () => {
			const input: TiebreakerInput = {
				athletes: [
					{ userId: "athlete-1", totalPoints: 200, eventPlacements: new Map() },
				],
				config: {
					primary: "head_to_head",
					// headToHeadEventId deliberately missing
				},
			}

			expect(() => applyTiebreakers(input)).toThrow(
				"headToHeadEventId is required for head_to_head tiebreaker"
			)
		})
	})

	describe("secondary tiebreaker", () => {
		it("falls back to secondary when primary cannot break tie", () => {
			const input: TiebreakerInput = {
				athletes: [
					{
						userId: "athlete-1",
						totalPoints: 200,
						eventPlacements: new Map([
							["event-1", 1],
							["event-2", 2],
							["tiebreaker-event", 2],
						]),
					},
					{
						userId: "athlete-2",
						totalPoints: 200,
						eventPlacements: new Map([
							["event-1", 2],
							["event-2", 1],
							["tiebreaker-event", 1],
						]),
					},
				],
				config: {
					primary: "countback",
					secondary: "head_to_head",
					headToHeadEventId: "tiebreaker-event",
				},
			}

			const result = applyTiebreakers(input)

			// Countback: both have 1x 1st, 1x 2nd - tie
			// Head-to-head: athlete-2 placed 1st in tiebreaker-event
			expect(result).toEqual([
				{ userId: "athlete-2", totalPoints: 200, rank: 1 },
				{ userId: "athlete-1", totalPoints: 200, rank: 2 },
			])
		})

		it("does not use secondary when primary breaks tie", () => {
			const input: TiebreakerInput = {
				athletes: [
					{
						userId: "athlete-1",
						totalPoints: 200,
						eventPlacements: new Map([
							["event-1", 1],
							["event-2", 1], // 2x 1st
							["tiebreaker-event", 2], // Would lose on h2h
						]),
					},
					{
						userId: "athlete-2",
						totalPoints: 200,
						eventPlacements: new Map([
							["event-1", 2],
							["event-2", 2], // 0x 1st
							["tiebreaker-event", 1], // Would win on h2h
						]),
					},
				],
				config: {
					primary: "countback",
					secondary: "head_to_head",
					headToHeadEventId: "tiebreaker-event",
				},
			}

			const result = applyTiebreakers(input)

			// Countback resolves: athlete-1 has 2x 1st vs 0x 1st
			// Secondary not needed
			expect(result).toEqual([
				{ userId: "athlete-1", totalPoints: 200, rank: 1 },
				{ userId: "athlete-2", totalPoints: 200, rank: 2 },
			])
		})
	})

	describe("edge cases", () => {
		it("handles large numbers of athletes", () => {
			const athletes = Array.from({ length: 100 }, (_, i) => ({
				userId: `athlete-${i}`,
				totalPoints: 1000 - i, // Unique points, descending
				eventPlacements: new Map<string, number>(),
			}))

			const input: TiebreakerInput = {
				athletes,
				config: { primary: "none" },
			}

			const result = applyTiebreakers(input)

			expect(result).toHaveLength(100)
			expect(result[0]).toEqual({
				userId: "athlete-0",
				totalPoints: 1000,
				rank: 1,
			})
			expect(result[99]).toEqual({
				userId: "athlete-99",
				totalPoints: 901,
				rank: 100,
			})
		})

		it("preserves order stability for equal athletes", () => {
			const input: TiebreakerInput = {
				athletes: [
					{ userId: "z-last", totalPoints: 100, eventPlacements: new Map() },
					{ userId: "a-first", totalPoints: 100, eventPlacements: new Map() },
					{ userId: "m-middle", totalPoints: 100, eventPlacements: new Map() },
				],
				config: { primary: "none" },
			}

			const result = applyTiebreakers(input)

			// All tied - should maintain original order
			expect(result.map((r) => r.userId)).toEqual([
				"z-last",
				"a-first",
				"m-middle",
			])
		})

		it("handles athletes with zero points", () => {
			const input: TiebreakerInput = {
				athletes: [
					{ userId: "athlete-1", totalPoints: 0, eventPlacements: new Map() },
					{ userId: "athlete-2", totalPoints: 100, eventPlacements: new Map() },
					{ userId: "athlete-3", totalPoints: 0, eventPlacements: new Map() },
				],
				config: { primary: "none" },
			}

			const result = applyTiebreakers(input)

			expect(result).toEqual([
				{ userId: "athlete-2", totalPoints: 100, rank: 1 },
				{ userId: "athlete-1", totalPoints: 0, rank: 2 },
				{ userId: "athlete-3", totalPoints: 0, rank: 2 },
			])
		})

		it("handles negative points", () => {
			const input: TiebreakerInput = {
				athletes: [
					{ userId: "athlete-1", totalPoints: -50, eventPlacements: new Map() },
					{ userId: "athlete-2", totalPoints: 100, eventPlacements: new Map() },
					{
						userId: "athlete-3",
						totalPoints: -100,
						eventPlacements: new Map(),
					},
				],
				config: { primary: "none" },
			}

			const result = applyTiebreakers(input)

			expect(result).toEqual([
				{ userId: "athlete-2", totalPoints: 100, rank: 1 },
				{ userId: "athlete-1", totalPoints: -50, rank: 2 },
				{ userId: "athlete-3", totalPoints: -100, rank: 3 },
			])
		})
	})
})
