/**
 * Scoring Schema Tests
 *
 * TDD: Testing Zod schemas for ScoringConfig validation.
 * Covers all algorithm types, tiebreaker methods, and status handling.
 */

import { describe, expect, it } from "vitest"
import {
	scoringConfigSchema,
	scoringAlgorithmSchema,
	tiebreakerMethodSchema,
	traditionalConfigSchema,
	pScoreConfigSchema,
	customTableConfigSchema,
	tiebreakerConfigSchema,
	statusHandlingConfigSchema,
	type ScoringConfig,
	type ScoringAlgorithm,
	type TiebreakerMethod,
} from "@/schemas/scoring.schema"

describe("ScoringAlgorithm Schema", () => {
	it("accepts 'traditional' algorithm", () => {
		const result = scoringAlgorithmSchema.safeParse("traditional")
		expect(result.success).toBe(true)
		expect(result.data).toBe("traditional")
	})

	it("accepts 'p_score' algorithm", () => {
		const result = scoringAlgorithmSchema.safeParse("p_score")
		expect(result.success).toBe(true)
		expect(result.data).toBe("p_score")
	})

	it("accepts 'custom' algorithm", () => {
		const result = scoringAlgorithmSchema.safeParse("custom")
		expect(result.success).toBe(true)
		expect(result.data).toBe("custom")
	})

	it("rejects invalid algorithm", () => {
		const result = scoringAlgorithmSchema.safeParse("invalid_algo")
		expect(result.success).toBe(false)
	})
})

describe("TiebreakerMethod Schema", () => {
	it("accepts 'countback' method", () => {
		const result = tiebreakerMethodSchema.safeParse("countback")
		expect(result.success).toBe(true)
	})

	it("accepts 'head_to_head' method", () => {
		const result = tiebreakerMethodSchema.safeParse("head_to_head")
		expect(result.success).toBe(true)
	})

	it("accepts 'none' method", () => {
		const result = tiebreakerMethodSchema.safeParse("none")
		expect(result.success).toBe(true)
	})

	it("rejects invalid tiebreaker method", () => {
		const result = tiebreakerMethodSchema.safeParse("random_pick")
		expect(result.success).toBe(false)
	})
})

describe("TraditionalConfig Schema", () => {
	it("accepts valid traditional config", () => {
		const result = traditionalConfigSchema.safeParse({
			step: 5,
			firstPlacePoints: 100,
		})
		expect(result.success).toBe(true)
		expect(result.data).toEqual({ step: 5, firstPlacePoints: 100 })
	})

	it("applies default values when not provided", () => {
		const result = traditionalConfigSchema.safeParse({})
		expect(result.success).toBe(true)
		expect(result.data).toEqual({ step: 5, firstPlacePoints: 100 })
	})

	it("rejects negative step value", () => {
		const result = traditionalConfigSchema.safeParse({
			step: -5,
			firstPlacePoints: 100,
		})
		expect(result.success).toBe(false)
	})

	it("rejects zero firstPlacePoints", () => {
		const result = traditionalConfigSchema.safeParse({
			step: 5,
			firstPlacePoints: 0,
		})
		expect(result.success).toBe(false)
	})
})

describe("PScoreConfig Schema", () => {
	it("accepts valid p_score config", () => {
		const result = pScoreConfigSchema.safeParse({
			allowNegatives: true,
			medianField: "top_half",
		})
		expect(result.success).toBe(true)
		expect(result.data).toEqual({
			allowNegatives: true,
			medianField: "top_half",
		})
	})

	it("applies default values when not provided", () => {
		const result = pScoreConfigSchema.safeParse({})
		expect(result.success).toBe(true)
		expect(result.data).toEqual({
			allowNegatives: true,
			medianField: "top_half",
		})
	})

	it("accepts 'all' for medianField", () => {
		const result = pScoreConfigSchema.safeParse({
			allowNegatives: false,
			medianField: "all",
		})
		expect(result.success).toBe(true)
		expect(result.data?.medianField).toBe("all")
	})

	it("rejects invalid medianField value", () => {
		const result = pScoreConfigSchema.safeParse({
			allowNegatives: true,
			medianField: "bottom_half",
		})
		expect(result.success).toBe(false)
	})
})

describe("CustomTableConfig Schema", () => {
	it("accepts valid custom table config", () => {
		const result = customTableConfigSchema.safeParse({
			baseTemplate: "traditional",
			overrides: { "1": 100, "2": 90, "3": 80 },
		})
		expect(result.success).toBe(true)
		expect(result.data).toEqual({
			baseTemplate: "traditional",
			overrides: { "1": 100, "2": 90, "3": 80 },
		})
	})

	it("accepts p_score as base template", () => {
		const result = customTableConfigSchema.safeParse({
			baseTemplate: "p_score",
			overrides: {},
		})
		expect(result.success).toBe(true)
	})

	it("accepts winner_takes_more as base template", () => {
		const result = customTableConfigSchema.safeParse({
			baseTemplate: "winner_takes_more",
			overrides: {},
		})
		expect(result.success).toBe(true)
	})

	it("applies default empty overrides", () => {
		const result = customTableConfigSchema.safeParse({
			baseTemplate: "traditional",
		})
		expect(result.success).toBe(true)
		expect(result.data?.overrides).toEqual({})
	})

	it("rejects invalid base template", () => {
		const result = customTableConfigSchema.safeParse({
			baseTemplate: "invalid_template",
			overrides: {},
		})
		expect(result.success).toBe(false)
	})
})

describe("TiebreakerConfig Schema", () => {
	it("accepts valid tiebreaker config with primary only", () => {
		const result = tiebreakerConfigSchema.safeParse({
			primary: "countback",
		})
		expect(result.success).toBe(true)
		expect(result.data).toEqual({ primary: "countback" })
	})

	it("accepts valid tiebreaker config with secondary", () => {
		const result = tiebreakerConfigSchema.safeParse({
			primary: "countback",
			secondary: "head_to_head",
			headToHeadEventId: "event-123",
		})
		expect(result.success).toBe(true)
		expect(result.data).toEqual({
			primary: "countback",
			secondary: "head_to_head",
			headToHeadEventId: "event-123",
		})
	})

	it("applies default primary value", () => {
		const result = tiebreakerConfigSchema.safeParse({})
		expect(result.success).toBe(true)
		expect(result.data?.primary).toBe("countback")
	})

	it("allows head_to_head as primary", () => {
		const result = tiebreakerConfigSchema.safeParse({
			primary: "head_to_head",
			headToHeadEventId: "event-456",
		})
		expect(result.success).toBe(true)
	})
})

describe("StatusHandlingConfig Schema", () => {
	it("accepts valid status handling config", () => {
		const result = statusHandlingConfigSchema.safeParse({
			dnf: "worst_performance",
			dns: "zero",
			withdrawn: "exclude",
		})
		expect(result.success).toBe(true)
		expect(result.data).toEqual({
			dnf: "worst_performance",
			dns: "zero",
			withdrawn: "exclude",
		})
	})

	it("applies default values when not provided", () => {
		const result = statusHandlingConfigSchema.safeParse({})
		expect(result.success).toBe(true)
		expect(result.data).toEqual({
			dnf: "last_place",
			dns: "zero",
			withdrawn: "exclude",
		})
	})

	it("accepts all valid dnf values", () => {
		for (const dnf of ["worst_performance", "zero", "last_place"] as const) {
			const result = statusHandlingConfigSchema.safeParse({ dnf })
			expect(result.success).toBe(true)
		}
	})

	it("accepts all valid dns values", () => {
		for (const dns of ["worst_performance", "zero", "exclude"] as const) {
			const result = statusHandlingConfigSchema.safeParse({ dns })
			expect(result.success).toBe(true)
		}
	})

	it("accepts all valid withdrawn values", () => {
		for (const withdrawn of ["zero", "exclude"] as const) {
			const result = statusHandlingConfigSchema.safeParse({ withdrawn })
			expect(result.success).toBe(true)
		}
	})

	it("rejects invalid dnf value", () => {
		const result = statusHandlingConfigSchema.safeParse({
			dnf: "invalid",
		})
		expect(result.success).toBe(false)
	})
})

describe("ScoringConfig Schema", () => {
	it("accepts minimal valid config with algorithm only", () => {
		const result = scoringConfigSchema.safeParse({
			algorithm: "traditional",
		})
		expect(result.success).toBe(true)
		// Should have defaults applied
		expect(result.data?.tiebreaker.primary).toBe("countback")
		expect(result.data?.statusHandling.dnf).toBe("last_place")
	})

	it("accepts full traditional config", () => {
		const config: ScoringConfig = {
			algorithm: "traditional",
			traditional: {
				step: 10,
				firstPlacePoints: 100,
			},
			tiebreaker: {
				primary: "countback",
				secondary: "head_to_head",
				headToHeadEventId: "event-final",
			},
			statusHandling: {
				dnf: "worst_performance",
				dns: "exclude",
				withdrawn: "zero",
			},
		}
		const result = scoringConfigSchema.safeParse(config)
		expect(result.success).toBe(true)
		expect(result.data).toEqual(config)
	})

	it("accepts full p_score config", () => {
		const config: ScoringConfig = {
			algorithm: "p_score",
			pScore: {
				allowNegatives: true,
				medianField: "top_half",
			},
			tiebreaker: {
				primary: "countback",
			},
			statusHandling: {
				dnf: "worst_performance",
				dns: "worst_performance",
				withdrawn: "exclude",
			},
		}
		const result = scoringConfigSchema.safeParse(config)
		expect(result.success).toBe(true)
		expect(result.data?.algorithm).toBe("p_score")
		expect(result.data?.pScore?.allowNegatives).toBe(true)
	})

	it("accepts full custom config", () => {
		const config: ScoringConfig = {
			algorithm: "custom",
			customTable: {
				baseTemplate: "winner_takes_more",
				overrides: { "1": 100, "2": 85, "3": 75 },
			},
			tiebreaker: {
				primary: "none",
			},
			statusHandling: {
				dnf: "zero",
				dns: "zero",
				withdrawn: "zero",
			},
		}
		const result = scoringConfigSchema.safeParse(config)
		expect(result.success).toBe(true)
		expect(result.data?.customTable?.baseTemplate).toBe("winner_takes_more")
	})

	it("rejects missing algorithm", () => {
		const result = scoringConfigSchema.safeParse({
			tiebreaker: { primary: "countback" },
		})
		expect(result.success).toBe(false)
	})

	it("applies nested defaults correctly", () => {
		const result = scoringConfigSchema.safeParse({
			algorithm: "traditional",
		})
		expect(result.success).toBe(true)
		// Check nested defaults
		expect(result.data?.tiebreaker).toEqual({ primary: "countback" })
		expect(result.data?.statusHandling).toEqual({
			dnf: "last_place",
			dns: "zero",
			withdrawn: "exclude",
		})
	})

	it("preserves explicit values over defaults", () => {
		const result = scoringConfigSchema.safeParse({
			algorithm: "traditional",
			tiebreaker: { primary: "none" },
			statusHandling: { dnf: "zero", dns: "exclude", withdrawn: "zero" },
		})
		expect(result.success).toBe(true)
		expect(result.data?.tiebreaker.primary).toBe("none")
		expect(result.data?.statusHandling.dnf).toBe("zero")
	})
})

describe("Type inference", () => {
	it("infers correct type for ScoringAlgorithm", () => {
		const algo: ScoringAlgorithm = "traditional"
		expect(["traditional", "p_score", "custom"]).toContain(algo)
	})

	it("infers correct type for TiebreakerMethod", () => {
		const method: TiebreakerMethod = "countback"
		expect(["countback", "head_to_head", "none"]).toContain(method)
	})

	it("infers correct type for ScoringConfig", () => {
		const config: ScoringConfig = {
			algorithm: "traditional",
			tiebreaker: { primary: "countback" },
			statusHandling: { dnf: "last_place", dns: "zero", withdrawn: "exclude" },
		}
		expect(config.algorithm).toBe("traditional")
	})
})
