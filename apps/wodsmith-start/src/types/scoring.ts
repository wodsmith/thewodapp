/**
 * Scoring Configuration Types
 *
 * TypeScript types for configurable competition scoring.
 * These are re-exported from the Zod schemas for convenience.
 *
 * @see docs/plans/configurable-scoring-system.md
 * @see @/schemas/scoring.schema.ts for Zod validation schemas
 */

// Re-export all types from the Zod schema file
// This provides a single import point for types without needing to import Zod
export type {
	ScoringAlgorithm,
	TiebreakerMethod,
	TraditionalConfig,
	PScoreConfig,
	CustomTableConfig,
	TiebreakerConfig,
	StatusHandlingConfig,
	ScoringConfig,
} from "@/schemas/scoring.schema"

// Re-export schemas for validation use
export {
	scoringAlgorithmSchema,
	tiebreakerMethodSchema,
	traditionalConfigSchema,
	pScoreConfigSchema,
	customTableConfigSchema,
	tiebreakerConfigSchema,
	statusHandlingConfigSchema,
	scoringConfigSchema,
} from "@/schemas/scoring.schema"
