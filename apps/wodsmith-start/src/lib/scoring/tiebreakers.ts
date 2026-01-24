/**
 * Tiebreaker Logic
 *
 * Configurable tiebreaker implementations for resolving tied scores.
 *
 * Methods:
 * - countback: Most 1st places wins, then 2nd, etc.
 * - head_to_head: Compare placement in designated event
 * - none: Ties remain as ties (same rank)
 *
 * @see docs/plans/configurable-scoring-system.md
 */

import type { ScoringAlgorithm, TiebreakerConfig } from "@/types/scoring"

/**
 * Input for tiebreaker calculation
 */
export interface TiebreakerInput {
	athletes: Array<{
		userId: string
		totalPoints: number
		/** Map of eventId → placement (1-indexed) */
		eventPlacements: Map<string, number>
	}>
	config: TiebreakerConfig
	/** Scoring algorithm - determines sort direction */
	scoringAlgorithm?: ScoringAlgorithm
}

/**
 * Result of tiebreaker calculation
 */
export interface RankedAthlete {
	userId: string
	totalPoints: number
	/** 1-indexed rank (standard competition ranking) */
	rank: number
}

/**
 * Internal working type with original index for stability
 */
interface AthleteWithIndex {
	userId: string
	totalPoints: number
	eventPlacements: Map<string, number>
	originalIndex: number
}

/**
 * Apply tiebreakers to determine final rankings.
 *
 * Uses standard competition ranking (1224) where ties share the same rank
 * and subsequent ranks are skipped.
 *
 * @example
 * ```ts
 * const result = applyTiebreakers({
 *   athletes: [
 *     { userId: "a", totalPoints: 200, eventPlacements: new Map([["e1", 1]]) },
 *     { userId: "b", totalPoints: 200, eventPlacements: new Map([["e1", 2]]) },
 *   ],
 *   config: { primary: "countback" }
 * })
 * // → [{ userId: "a", totalPoints: 200, rank: 1 }, { userId: "b", totalPoints: 200, rank: 2 }]
 * ```
 */
export function applyTiebreakers(input: TiebreakerInput): RankedAthlete[] {
	const { athletes, config, scoringAlgorithm } = input

	if (athletes.length === 0) {
		return []
	}

	// Validate config
	if (config.primary === "head_to_head" && !config.headToHeadEventId) {
		throw new Error("headToHeadEventId is required for head_to_head tiebreaker")
	}
	if (config.secondary === "head_to_head" && !config.headToHeadEventId) {
		throw new Error("headToHeadEventId is required for head_to_head tiebreaker")
	}

	// For online scoring, lower points = better (ascending sort)
	// For all other algorithms, higher points = better (descending sort)
	const lowerIsBetter = scoringAlgorithm === "online"

	// Add original index for stable sorting
	const athletesWithIndex: AthleteWithIndex[] = athletes.map((a, i) => ({
		...a,
		originalIndex: i,
	}))

	// Sort by total points (direction depends on algorithm)
	athletesWithIndex.sort((a, b) => {
		if (a.totalPoints !== b.totalPoints) {
			return lowerIsBetter
				? a.totalPoints - b.totalPoints // ascending for online
				: b.totalPoints - a.totalPoints // descending for traditional
		}
		return a.originalIndex - b.originalIndex
	})

	// Group athletes by total points
	const groups = groupByPoints(athletesWithIndex)

	// Apply tiebreakers within each group
	const ranked: RankedAthlete[] = []
	let currentRank = 1

	for (const group of groups) {
		if (group.length === 1) {
			// Single athlete in group - no tie to break
			ranked.push({
				userId: group[0].userId,
				totalPoints: group[0].totalPoints,
				rank: currentRank,
			})
			currentRank++
		} else {
			// Multiple athletes tied - apply tiebreakers
			const resolved = resolveTies(group, config)
			for (const athlete of resolved) {
				ranked.push({
					userId: athlete.userId,
					totalPoints: athlete.totalPoints,
					rank: currentRank + athlete.tieRank,
				})
			}
			// Skip ranks based on group size (standard competition ranking)
			currentRank += group.length
		}
	}

	return ranked
}

/**
 * Group athletes by total points (already sorted)
 */
function groupByPoints(athletes: AthleteWithIndex[]): AthleteWithIndex[][] {
	const groups: AthleteWithIndex[][] = []
	let currentGroup: AthleteWithIndex[] = []
	let currentPoints: number | null = null

	for (const athlete of athletes) {
		if (currentPoints === null || athlete.totalPoints === currentPoints) {
			currentGroup.push(athlete)
			currentPoints = athlete.totalPoints
		} else {
			groups.push(currentGroup)
			currentGroup = [athlete]
			currentPoints = athlete.totalPoints
		}
	}

	if (currentGroup.length > 0) {
		groups.push(currentGroup)
	}

	return groups
}

/**
 * Resolve ties within a group using configured tiebreakers.
 * Returns athletes with relative tieRank (0 = first in group, etc.)
 */
function resolveTies(
	group: AthleteWithIndex[],
	config: TiebreakerConfig,
): Array<AthleteWithIndex & { tieRank: number }> {
	// Start with all athletes at rank 0 (tied)
	let athletes = group.map((a) => ({ ...a, tieRank: 0 }))

	// Apply primary tiebreaker
	athletes = applyTiebreakerMethod(athletes, config.primary, config)

	// Apply secondary tiebreaker if still tied
	if (config.secondary && hasTies(athletes)) {
		athletes = applyTiebreakerMethod(athletes, config.secondary, config)
	}

	return athletes
}

/**
 * Check if there are still ties in the group
 */
function hasTies(
	athletes: Array<AthleteWithIndex & { tieRank: number }>,
): boolean {
	const ranks = new Set(athletes.map((a) => a.tieRank))
	return ranks.size < athletes.length
}

/**
 * Apply a specific tiebreaker method
 */
function applyTiebreakerMethod(
	athletes: Array<AthleteWithIndex & { tieRank: number }>,
	method: "countback" | "head_to_head" | "none",
	config: TiebreakerConfig,
): Array<AthleteWithIndex & { tieRank: number }> {
	switch (method) {
		case "none":
			return athletes
		case "countback":
			return applyCountback(athletes)
		case "head_to_head":
			return applyHeadToHead(athletes, config.headToHeadEventId!)
	}
}

/**
 * Countback tiebreaker: most 1st places wins, then 2nd, etc.
 */
function applyCountback(
	athletes: Array<AthleteWithIndex & { tieRank: number }>,
): Array<AthleteWithIndex & { tieRank: number }> {
	// Find the maximum placement to check
	let maxPlacement = 0
	for (const athlete of athletes) {
		for (const placement of athlete.eventPlacements.values()) {
			maxPlacement = Math.max(maxPlacement, placement)
		}
	}

	if (maxPlacement === 0) {
		// No placements to compare
		return athletes
	}

	// Build countback arrays: how many 1st, 2nd, 3rd, etc.
	const countbacks = athletes.map((athlete) => {
		const counts: number[] = []
		for (let place = 1; place <= maxPlacement; place++) {
			let count = 0
			for (const placement of athlete.eventPlacements.values()) {
				if (placement === place) {
					count++
				}
			}
			counts.push(count)
		}
		return { athlete, counts }
	})

	// Sort by countback (compare place by place)
	countbacks.sort((a, b) => {
		for (let i = 0; i < maxPlacement; i++) {
			const diff = b.counts[i] - a.counts[i] // More of each place is better
			if (diff !== 0) {
				return diff
			}
		}
		// Still tied - maintain original order
		return a.athlete.originalIndex - b.athlete.originalIndex
	})

	// Assign relative ranks
	const result: Array<AthleteWithIndex & { tieRank: number }> = []
	let currentRank = 0
	let prevCounts: number[] | null = null

	for (let i = 0; i < countbacks.length; i++) {
		const { athlete, counts } = countbacks[i]

		// Check if counts match previous (still tied)
		const sameAsPrevious = prevCounts && arraysEqual(counts, prevCounts)

		if (!sameAsPrevious) {
			currentRank = i // Rank skips to position
		}

		result.push({ ...athlete, tieRank: currentRank })
		prevCounts = counts
	}

	return result
}

/**
 * Head-to-head tiebreaker: compare placement in designated event
 */
function applyHeadToHead(
	athletes: Array<AthleteWithIndex & { tieRank: number }>,
	eventId: string,
): Array<AthleteWithIndex & { tieRank: number }> {
	// Get placements in the head-to-head event
	const withPlacements = athletes.map((athlete) => ({
		athlete,
		placement: athlete.eventPlacements.get(eventId) ?? Infinity,
	}))

	// Sort by placement (lower is better), maintain stability
	withPlacements.sort((a, b) => {
		if (a.placement !== b.placement) {
			return a.placement - b.placement
		}
		return a.athlete.originalIndex - b.athlete.originalIndex
	})

	// Assign relative ranks
	const result: Array<AthleteWithIndex & { tieRank: number }> = []
	let currentRank = 0
	let prevPlacement: number | null = null

	for (let i = 0; i < withPlacements.length; i++) {
		const { athlete, placement } = withPlacements[i]

		// Check if placement matches previous (still tied)
		const sameAsPrevious = prevPlacement === placement

		if (!sameAsPrevious) {
			currentRank = i // Rank skips to position
		}

		result.push({ ...athlete, tieRank: currentRank })
		prevPlacement = placement
	}

	return result
}

/**
 * Compare two arrays for equality
 */
function arraysEqual(a: number[], b: number[]): boolean {
	if (a.length !== b.length) return false
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false
	}
	return true
}
