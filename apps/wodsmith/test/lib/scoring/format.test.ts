import { describe, expect, it } from "vitest"
import {
	formatScore,
	formatScoreCompact,
	formatRounds,
	formatScoreWithTiebreak,
	formatStatus,
	formatStatusFull,
	isSpecialStatus,
	type Score,
} from "@/lib/scoring"

describe("formatStatus", () => {
	it("should format status codes", () => {
		expect(formatStatus("scored")).toBe("")
		expect(formatStatus("cap")).toBe("CAP")
		expect(formatStatus("dq")).toBe("DQ")
		expect(formatStatus("withdrawn")).toBe("WD")
	})
})

describe("formatStatusFull", () => {
	it("should format full status text", () => {
		expect(formatStatusFull("scored")).toBe("Scored")
		expect(formatStatusFull("cap")).toBe("Time Cap")
		expect(formatStatusFull("dq")).toBe("Disqualified")
		expect(formatStatusFull("withdrawn")).toBe("Withdrawn")
	})
})

describe("isSpecialStatus", () => {
	it("should identify special statuses", () => {
		expect(isSpecialStatus("scored")).toBe(false)
		expect(isSpecialStatus("cap")).toBe(true)
		expect(isSpecialStatus("dq")).toBe(true)
		expect(isSpecialStatus("withdrawn")).toBe(true)
	})
})

describe("formatScore", () => {
	it("should format time scores", () => {
		const score: Score = {
			scheme: "time",
			scoreType: "min",
			value: 754567,
			status: "scored",
		}
		expect(formatScore(score)).toBe("12:34.567")
	})

	it("should format rounds-reps scores", () => {
		const score: Score = {
			scheme: "rounds-reps",
			scoreType: "max",
			value: 500012,
			status: "scored",
		}
		expect(formatScore(score)).toBe("05+12")
	})

	it("should format load scores with unit", () => {
		const score: Score = {
			scheme: "load",
			scoreType: "max",
			value: Math.round(225 * 453.592),
			status: "scored",
		}
		expect(formatScore(score, { weightUnit: "lbs", includeUnit: true })).toBe("225 lbs")
	})

	it("should format capped scores with secondary value", () => {
		const score: Score = {
			scheme: "time-with-cap",
			scoreType: "min",
			value: null,
			status: "cap",
			timeCap: {
				ms: 900000,
				secondaryScheme: "reps",
				secondaryValue: 142,
			},
		}
		expect(formatScore(score)).toBe("CAP (142 reps)")
	})

	it("should format capped scores without status prefix", () => {
		const score: Score = {
			scheme: "time-with-cap",
			scoreType: "min",
			value: null,
			status: "cap",
			timeCap: {
				ms: 900000,
				secondaryScheme: "reps",
				secondaryValue: 142,
			},
		}
		expect(formatScore(score, { showStatus: false })).toBe("142 reps")
	})

	it("should format DQ status", () => {
		const score: Score = {
			scheme: "time",
			scoreType: "min",
			value: null,
			status: "dq",
		}
		expect(formatScore(score)).toBe("DQ")
	})

	it("should format withdrawn status", () => {
		const score: Score = {
			scheme: "time",
			scoreType: "min",
			value: null,
			status: "withdrawn",
		}
		expect(formatScore(score)).toBe("WD")
	})

	it("should format null scores as N/A", () => {
		const score: Score = {
			scheme: "time",
			scoreType: "min",
			value: null,
			status: "scored",
		}
		expect(formatScore(score)).toBe("N/A")
	})
})

describe("formatScoreCompact", () => {
	it("should format without milliseconds", () => {
		const score: Score = {
			scheme: "time",
			scoreType: "min",
			value: 754000,
			status: "scored",
		}
		expect(formatScoreCompact(score)).toBe("12:34")
	})

	it("should show milliseconds when non-zero", () => {
		const score: Score = {
			scheme: "time",
			scoreType: "min",
			value: 754567,
			status: "scored",
		}
		// Compact mode still shows ms if they're non-zero
		expect(formatScoreCompact(score)).toBe("12:34.567")
	})
})

describe("formatRounds", () => {
	it("should format multiple rounds", () => {
		const rounds = [
			{ roundNumber: 1, value: Math.round(225 * 453.592) },
			{ roundNumber: 2, value: Math.round(235 * 453.592) },
			{ roundNumber: 3, value: Math.round(245 * 453.592) },
		]
		const formatted = formatRounds(rounds, "load", { weightUnit: "lbs", includeUnit: true })
		expect(formatted).toEqual(["225 lbs", "235 lbs", "245 lbs"])
	})

	it("should handle rounds with different schemes", () => {
		const rounds = [
			{ roundNumber: 1, value: 754000 },
			{ roundNumber: 2, value: 755000 },
		]
		const formatted = formatRounds(rounds, "time")
		expect(formatted).toEqual(["12:34", "12:35"])
	})

	it("should handle rounds with special status", () => {
		const rounds = [
			{ roundNumber: 1, value: 754000 },
			{ roundNumber: 2, value: 0, status: "cap" as const, secondaryValue: 50 },
		]
		const formatted = formatRounds(rounds, "time")
		expect(formatted[0]).toBe("12:34")
		expect(formatted[1]).toBe("CAP (50)")
	})
})

describe("formatScoreWithTiebreak", () => {
	it("should format score with time tiebreak", () => {
		const score: Score = {
			scheme: "rounds-reps",
			scoreType: "max",
			value: 500012,
			status: "scored",
			tiebreak: {
				scheme: "time",
				value: 510000, // 8:30
			},
		}
		expect(formatScoreWithTiebreak(score)).toBe("05+12 (TB: 8:30)")
	})

	it("should format score with reps tiebreak", () => {
		const score: Score = {
			scheme: "time",
			scoreType: "min",
			value: 754000,
			status: "scored",
			tiebreak: {
				scheme: "reps",
				value: 150,
			},
		}
		expect(formatScoreWithTiebreak(score)).toBe("12:34 (TB: 150)")
	})

	it("should format score without tiebreak", () => {
		const score: Score = {
			scheme: "time",
			scoreType: "min",
			value: 754000,
			status: "scored",
		}
		expect(formatScoreWithTiebreak(score)).toBe("12:34")
	})
})
