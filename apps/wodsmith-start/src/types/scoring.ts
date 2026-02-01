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
	CustomTableConfig,
	PScoreConfig,
	ScoringAlgorithm,
	ScoringConfig,
	StatusHandlingConfig,
	TiebreakerConfig,
	TiebreakerMethod,
	TraditionalConfig,
} from "@/schemas/scoring.schema"

// Re-export schemas for validation use
export {
	customTableConfigSchema,
	pScoreConfigSchema,
	scoringAlgorithmSchema,
	scoringConfigSchema,
	statusHandlingConfigSchema,
	tiebreakerConfigSchema,
	tiebreakerMethodSchema,
	traditionalConfigSchema,
} from "@/schemas/scoring.schema"
