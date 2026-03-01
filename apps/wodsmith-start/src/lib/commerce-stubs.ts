/**
 * Commerce function re-exports for TanStack Start
 *
 * This file re-exports the full commerce implementation from @/server/commerce.
 * The functions have been fully ported from apps/wodsmith/src/server/commerce.
 *
 * @see @/server/commerce/fee-calculator.ts - FeeConfiguration, FeeBreakdown interfaces, getRegistrationFee
 * @see @/server/commerce/utils.ts - buildFeeConfig, calculateCompetitionFees, PLATFORM_DEFAULTS
 */

// Re-export types
export type {
	FeeBreakdown,
	FeeConfiguration,
} from "@/server/commerce/fee-calculator"

// Re-export functions
export {
	getCompetitionRevenueStats,
	getRegistrationFee,
} from "@/server/commerce/fee-calculator"
export type { TeamFeeOverrides } from "@/server/commerce/utils"
export {
	buildFeeConfig,
	calculateCompetitionFees,
	FOUNDING_ORGANIZER_DEFAULTS,
	formatCents,
	getTeamPlatformFee,
	PLATFORM_DEFAULTS,
} from "@/server/commerce/utils"
