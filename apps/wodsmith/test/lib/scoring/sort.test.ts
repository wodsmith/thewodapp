import { describe, expect, it } from "vitest"
import {
	compareScores,
	computeSortKey,
	computeSortKeyWithDirection,
	extractFromSortKey,
	getSortDirection,
	isLowerBetter,
	sortScores,
	findRank,
	sortKeyToString,
	type Score,
} from "@/lib/scoring"

describe("getSortDirection", () => {
	it("should return asc for time-based schemes", () => {
		expect(getSortDirection("time")).toBe("asc")
		expect(getSortDirection("time-with-cap")).toBe("asc")
		expect(getSortDirection("emom")).toBe("desc") // EMOM is higher is better
	})

	it("should return desc for max-is-better schemes", () => {
		expect(getSortDirection("rounds-reps")).toBe("desc")
		expect(getSortDirection("reps")).toBe("desc")
		expect(getSortDirection("load")).toBe("desc")
		expect(getSortDirection("calories")).toBe("desc")
		expect(getSortDirection("meters")).toBe("desc")
		expect(getSortDirection("points")).toBe("desc")
	})

	it("should override with explicit scoreType", () => {
		expect(getSortDirection("time", "max")).toBe("desc")
		expect(getSortDirection("reps", "min")).toBe("asc")
	})
})

describe("isLowerBetter", () => {
	it("should identify lower-is-better schemes", () => {
		expect(isLowerBetter("time")).toBe(true)
		expect(isLowerBetter("time-with-cap")).toBe(true)
	})

	it("should identify higher-is-better schemes", () => {
		expect(isLowerBetter("rounds-reps")).toBe(false)
		expect(isLowerBetter("reps")).toBe(false)
		expect(isLowerBetter("load")).toBe(false)
	})
})

describe("computeSortKey", () => {
	it("should compute sort key for scored results", () => {
		const score: Score = {
			scheme: "time",
			scoreType: "min",
			value: 754000,
			status: "scored",
		}
		const sortKey = computeSortKey(score)
		expect(sortKey).toBeGreaterThan(0n)
	})

	it("should compute higher sort key for capped results", () => {
		const scored: Score = {
			scheme: "time",
			scoreType: "min",
			value: 754000,
			status: "scored",
		}
		const capped: Score = {
			scheme: "time",
			scoreType: "min",
			value: null,
			status: "cap",
		}
		const scoredKey = computeSortKey(scored)
		const cappedKey = computeSortKey(capped)
		expect(cappedKey).toBeGreaterThan(scoredKey)
	})

	it("should maintain order for time (lower is better)", () => {
		const faster: Score = {
			scheme: "time",
			scoreType: "min",
			value: 510000, // 8:30
			status: "scored",
		}
		const slower: Score = {
			scheme: "time",
			scoreType: "min",
			value: 720000, // 12:00
			status: "scored",
		}
		const fasterKey = computeSortKey(faster)
		const slowerKey = computeSortKey(slower)
		expect(fasterKey).toBeLessThan(slowerKey)
	})

	it("should maintain order for reps (higher is better)", () => {
		const moreReps: Score = {
			scheme: "reps",
			scoreType: "max",
			value: 150,
			status: "scored",
		}
		const fewerReps: Score = {
			scheme: "reps",
			scoreType: "max",
			value: 100,
			status: "scored",
		}
		const moreKey = computeSortKey(moreReps)
		const fewerKey = computeSortKey(fewerReps)
		expect(moreKey).toBeLessThan(fewerKey) // Lower sort key = better position
	})
})

describe("computeSortKeyWithDirection", () => {
	it("should compute with ascending direction", () => {
		const key1 = computeSortKeyWithDirection(100, "scored", "asc")
		const key2 = computeSortKeyWithDirection(200, "scored", "asc")
		expect(key1).toBeLessThan(key2)
	})

	it("should compute with descending direction", () => {
		const key1 = computeSortKeyWithDirection(100, "scored", "desc")
		const key2 = computeSortKeyWithDirection(200, "scored", "desc")
		expect(key1).toBeGreaterThan(key2)
	})
})

describe("extractFromSortKey", () => {
	it("should extract status and value", () => {
		const key = computeSortKeyWithDirection(754000, "scored", "asc")
		const extracted = extractFromSortKey(key, "asc")
		expect(extracted.statusOrder).toBe(0)
		expect(extracted.value).toBe(754000)
	})

	it("should handle null values", () => {
		const key = computeSortKeyWithDirection(null, "scored", "asc")
		const extracted = extractFromSortKey(key, "asc")
		expect(extracted.value).toBeNull()
	})
})

describe("compareScores", () => {
	it("should sort by status first", () => {
		const scored: Score = {
			scheme: "time",
			scoreType: "min",
			value: 900000, // Slower time
			status: "scored",
		}
		const capped: Score = {
			scheme: "time",
			scoreType: "min",
			value: 500000, // Would be faster, but capped
			status: "cap",
		}
		expect(compareScores(scored, capped)).toBeLessThan(0)
	})

	it("should sort time scores (lower is better)", () => {
		const faster: Score = {
			scheme: "time",
			scoreType: "min",
			value: 510000,
			status: "scored",
		}
		const slower: Score = {
			scheme: "time",
			scoreType: "min",
			value: 720000,
			status: "scored",
		}
		expect(compareScores(faster, slower)).toBeLessThan(0)
		expect(compareScores(slower, faster)).toBeGreaterThan(0)
	})

	it("should sort reps scores (higher is better)", () => {
		const more: Score = {
			scheme: "reps",
			scoreType: "max",
			value: 150,
			status: "scored",
		}
		const less: Score = {
			scheme: "reps",
			scoreType: "max",
			value: 100,
			status: "scored",
		}
		expect(compareScores(more, less)).toBeLessThan(0)
		expect(compareScores(less, more)).toBeGreaterThan(0)
	})

	it("should sort capped scores by secondary value", () => {
		const moreReps: Score = {
			scheme: "time-with-cap",
			scoreType: "min",
			value: null,
			status: "cap",
			timeCap: { ms: 900000, secondaryScheme: "reps", secondaryValue: 150 },
		}
		const fewerReps: Score = {
			scheme: "time-with-cap",
			scoreType: "min",
			value: null,
			status: "cap",
			timeCap: { ms: 900000, secondaryScheme: "reps", secondaryValue: 100 },
		}
		expect(compareScores(moreReps, fewerReps)).toBeLessThan(0)
	})

	it("should use tiebreak for equal scores", () => {
		const fasterTiebreak: Score = {
			scheme: "rounds-reps",
			scoreType: "max",
			value: 500012,
			status: "scored",
			tiebreak: { scheme: "time", value: 510000 }, // 8:30
		}
		const slowerTiebreak: Score = {
			scheme: "rounds-reps",
			scoreType: "max",
			value: 500012,
			status: "scored",
			tiebreak: { scheme: "time", value: 600000 }, // 10:00
		}
		expect(compareScores(fasterTiebreak, slowerTiebreak)).toBeLessThan(0)
	})

	it("should handle null values", () => {
		const withValue: Score = {
			scheme: "time",
			scoreType: "min",
			value: 754000,
			status: "scored",
		}
		const withoutValue: Score = {
			scheme: "time",
			scoreType: "min",
			value: null,
			status: "scored",
		}
		expect(compareScores(withValue, withoutValue)).toBeLessThan(0)
	})
})

describe("sortScores", () => {
	it("should sort an array of scores", () => {
		const scores: Score[] = [
			{ scheme: "time", scoreType: "min", value: 720000, status: "scored" },
			{ scheme: "time", scoreType: "min", value: 510000, status: "scored" },
			{ scheme: "time", scoreType: "min", value: null, status: "cap" },
			{ scheme: "time", scoreType: "min", value: 600000, status: "scored" },
		]

		const sorted = sortScores([...scores])

		expect(sorted[0]?.value).toBe(510000) // Fastest
		expect(sorted[1]?.value).toBe(600000)
		expect(sorted[2]?.value).toBe(720000)
		expect(sorted[3]?.status).toBe("cap") // Capped last
	})
})

describe("findRank", () => {
	it("should find the rank of a score", () => {
		const scores: Score[] = [
			{ scheme: "time", scoreType: "min", value: 720000, status: "scored" },
			{ scheme: "time", scoreType: "min", value: 510000, status: "scored" },
			{ scheme: "time", scoreType: "min", value: 600000, status: "scored" },
		]

		const targetScore: Score = {
			scheme: "time",
			scoreType: "min",
			value: 600000,
			status: "scored",
		}

		const rank = findRank(targetScore, scores)
		expect(rank).toBe(2) // Second place (after 510000)
	})
})

describe("sortKeyToString", () => {
	it("should zero-pad sortKey to 19 digits", () => {
		const sortKey = 510000n
		const str = sortKeyToString(sortKey)
		expect(str).toBe("0000000000000510000")
		expect(str.length).toBe(19)
	})

	it("should handle large sort keys", () => {
		const sortKey = 1152921504606846975n // Status 1 << 60 + MAX_VALUE
		const str = sortKeyToString(sortKey)
		expect(str).toBe("1152921504606846975")
		expect(str.length).toBe(19)
	})

	it("should maintain lexicographic ordering for time-based scores", () => {
		// Time scheme: lower is better (asc)
		const faster: Score = {
			scheme: "time",
			scoreType: "min",
			value: 510000, // 8:30
			status: "scored",
		}
		const slower: Score = {
			scheme: "time",
			scoreType: "min",
			value: 720000, // 12:00
			status: "scored",
		}

		const fasterKey = sortKeyToString(computeSortKey(faster))
		const slowerKey = sortKeyToString(computeSortKey(slower))

		// Lexicographic comparison should match numeric comparison
		expect(fasterKey < slowerKey).toBe(true)
	})

	it("should maintain lexicographic ordering for reps-based scores", () => {
		// Reps scheme: higher is better (desc)
		const moreReps: Score = {
			scheme: "reps",
			scoreType: "max",
			value: 150,
			status: "scored",
		}
		const fewerReps: Score = {
			scheme: "reps",
			scoreType: "max",
			value: 100,
			status: "scored",
		}

		const moreKey = sortKeyToString(computeSortKey(moreReps))
		const fewerKey = sortKeyToString(computeSortKey(fewerReps))

		// Lexicographic comparison should match numeric comparison
		// (more reps gets lower sort key = better position)
		expect(moreKey < fewerKey).toBe(true)
	})

	it("should maintain status ordering in string form", () => {
		const scored: Score = {
			scheme: "time",
			scoreType: "min",
			value: 900000, // Slower time
			status: "scored",
		}
		const capped: Score = {
			scheme: "time",
			scoreType: "min",
			value: 500000, // Would be faster, but capped
			status: "cap",
		}

		const scoredKey = sortKeyToString(computeSortKey(scored))
		const cappedKey = sortKeyToString(computeSortKey(capped))

		// Scored should always sort before capped
		expect(scoredKey < cappedKey).toBe(true)
	})
})
