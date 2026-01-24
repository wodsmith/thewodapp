/**
 * Scoring Configuration Schemas
 *
 * Zod validation schemas for configurable competition scoring.
 * Supports traditional, P-Score, and custom scoring algorithms.
 *
 * @see docs/plans/configurable-scoring-system.md
 */

import { z } from "zod"

/**
 * Scoring algorithm types
 * - traditional: Fixed step points (default: 100, 95, 90...)
 * - p_score: Performance-based scoring (margin of victory)
 * - winner_takes_more: Top positions get disproportionately more points (like CrossFit Games)
 * - online: Place-based scoring (1st=1pt, 2nd=2pts...) - lowest total wins
 * - custom: User-defined points table with overrides
 */
export const scoringAlgorithmSchema = z.enum([
	"traditional",
	"p_score",
	"winner_takes_more",
	"online",
	"custom",
])
export type ScoringAlgorithm = z.infer<typeof scoringAlgorithmSchema>

/**
 * Tiebreaker methods for resolving tied scores
 * - countback: Most 1st places, then 2nd, etc.
 * - head_to_head: Compare placement in designated event
 * - none: Ties remain as ties
 */
export const tiebreakerMethodSchema = z.enum([
	"countback",
	"head_to_head",
	"none",
])
export type TiebreakerMethod = z.infer<typeof tiebreakerMethodSchema>

/**
 * Traditional scoring configuration
 * Points decrease by fixed step from first place
 * New fields (minPoints, autoScale) are optional for backward compatibility
 */
export const traditionalConfigSchema = z.object({
	/** Points decrease per place (default: 5) */
	step: z.number().positive().default(5),
	/** Points for first place (default: 100) */
	firstPlacePoints: z.number().positive().default(100),
	/**
	 * Minimum points for last place (default: 0)
	 * When autoScale is true, step is calculated to ensure last place gets at least this amount
	 */
	minPoints: z.number().min(0).optional(),
	/**
	 * Auto-scale step based on division size
	 * When true, step is calculated as: (firstPlacePoints - minPoints) / (divisionSize - 1)
	 * This ensures points are evenly distributed across all positions in the division
	 */
	autoScale: z.boolean().optional(),
})
export type TraditionalConfig = z.infer<typeof traditionalConfigSchema>

/**
 * P-Score (performance-based) configuration
 * Rewards margin of victory, not just placement
 */
export const pScoreConfigSchema = z.object({
	/** Allow negative scores (default: true) */
	allowNegatives: z.boolean().default(true),
	/** Field for median calculation (default: top_half) */
	medianField: z.enum(["top_half", "all"]).default("top_half"),
})
export type PScoreConfig = z.infer<typeof pScoreConfigSchema>

/**
 * Winner Takes More scoring configuration
 * Uses a front-loaded points table that rewards top finishers more heavily
 * All fields are optional for backward compatibility
 */
export const winnerTakesMoreConfigSchema = z.object({
	/**
	 * Auto-scale the points table based on division size
	 * When true, interpolates the 30-position table to fit the division size
	 * This ensures all positions in the division receive meaningful points
	 */
	autoScale: z.boolean().optional(),
	/** Minimum points for last place when auto-scaling (default: 5) */
	minPoints: z.number().min(0).optional(),
})
export type WinnerTakesMoreConfig = z.infer<typeof winnerTakesMoreConfigSchema>

/**
 * Custom points table configuration
 * Based on a template with optional overrides
 */
export const customTableConfigSchema = z.object({
	/** Base template to start from (traditional or winner_takes_more - P-Score can't be customized) */
	baseTemplate: z.enum(["traditional", "winner_takes_more"]),
	/** Place → points overrides (e.g., { "1": 100, "2": 90 }) - keys are string numbers */
	overrides: z.record(z.string(), z.number()).default({}),
})
export type CustomTableConfig = z.infer<typeof customTableConfigSchema>

/**
 * Tiebreaker configuration (base schema without default)
 */
const tiebreakerConfigBaseSchema = z.object({
	/** Primary tiebreaker method (default: countback) */
	primary: tiebreakerMethodSchema.default("countback"),
	/** Secondary tiebreaker (optional) */
	secondary: tiebreakerMethodSchema.optional(),
	/** Event ID for head-to-head comparison (required if secondary is head_to_head) */
	headToHeadEventId: z.string().optional(),
})

/**
 * Tiebreaker configuration with default
 */
export const tiebreakerConfigSchema = tiebreakerConfigBaseSchema.default({
	primary: "countback",
})
export type TiebreakerConfig = z.infer<typeof tiebreakerConfigSchema>

/**
 * Status handling configuration for DNF/DNS/Withdrawn athletes (base schema)
 */
const statusHandlingConfigBaseSchema = z.object({
	/** DNF handling: worst_performance | zero | last_place */
	dnf: z.enum(["worst_performance", "zero", "last_place"]).default("zero"),
	/** DNS handling: worst_performance | zero | exclude */
	dns: z.enum(["worst_performance", "zero", "exclude"]).default("zero"),
	/** Withdrawn handling: zero | exclude */
	withdrawn: z.enum(["zero", "exclude"]).default("zero"),
})

/**
 * Status handling configuration with default
 */
export const statusHandlingConfigSchema =
	statusHandlingConfigBaseSchema.default({
		dnf: "zero",
		dns: "zero",
		withdrawn: "zero",
	})
export type StatusHandlingConfig = z.infer<typeof statusHandlingConfigSchema>

/**
 * Complete scoring configuration
 */
export const scoringConfigSchema = z.object({
	/** Scoring algorithm to use */
	algorithm: scoringAlgorithmSchema,

	/** Traditional algorithm settings (optional) */
	traditional: traditionalConfigSchema.optional(),

	/** Winner Takes More algorithm settings (optional) */
	winnerTakesMore: winnerTakesMoreConfigSchema.optional(),

	/** P-Score algorithm settings (optional) */
	pScore: pScoreConfigSchema.optional(),

	/** Custom points table settings (optional) */
	customTable: customTableConfigSchema.optional(),

	/** Tiebreaker configuration */
	tiebreaker: tiebreakerConfigSchema,

	/** DNF/DNS/Withdrawn handling */
	statusHandling: statusHandlingConfigSchema,

	/**
	 * Default division size for points preview (optional)
	 * When set, the points preview will show this many positions
	 * Divisions can override this with their own size
	 */
	defaultDivisionSize: z.number().int().min(1).max(500).optional(),
})
export type ScoringConfig = z.infer<typeof scoringConfigSchema>
