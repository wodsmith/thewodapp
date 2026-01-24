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
 */
export const traditionalConfigSchema = z.object({
	/** Points decrease per place (default: 5) */
	step: z.number().positive().default(5),
	/** Points for first place (default: 100) */
	firstPlacePoints: z.number().positive().default(100),
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

	/** P-Score algorithm settings (optional) */
	pScore: pScoreConfigSchema.optional(),

	/** Custom points table settings (optional) */
	customTable: customTableConfigSchema.optional(),

	/** Tiebreaker configuration */
	tiebreaker: tiebreakerConfigSchema,

	/** DNF/DNS/Withdrawn handling */
	statusHandling: statusHandlingConfigSchema,
})
export type ScoringConfig = z.infer<typeof scoringConfigSchema>
