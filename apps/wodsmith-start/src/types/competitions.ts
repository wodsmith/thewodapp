/**
 * Competition Settings Types
 *
 * Types for competition configuration stored in competitions.settings JSON column.
 * Includes the new configurable scoring system (ScoringConfig).
 *
 * @see docs/plans/configurable-scoring-system.md
 */

import type { ScoringConfig } from "./scoring"

/**
 * Legacy scoring settings for backwards compatibility
 * TODO: Migrate existing competitions to use ScoringConfig
 */
export type LegacyScoringSettings =
	| {
			type: "winner_takes_more"
	  }
	| {
			type: "even_spread"
	  }
	| {
			type: "fixed_step"
			step: number
	  }

/**
 * Competition Settings
 *
 * Stored as JSON in the competitions.settings column.
 */
export interface CompetitionSettings {
	/**
	 * Division configuration
	 * References a scaling group to use as competition divisions
	 */
	divisions?: {
		scalingGroupId: string
	}

	/**
	 * Legacy scoring settings (backwards compatible)
	 * @deprecated Use scoringConfig instead
	 */
	scoring?: LegacyScoringSettings

	/**
	 * New configurable scoring system
	 * Takes precedence over legacy `scoring` if present
	 */
	scoringConfig?: ScoringConfig

	/**
	 * Per-event, per-division results publishing state.
	 * Controls leaderboard visibility — unpublished divisions are hidden from athletes.
	 * Key structure: divisionResults[trackWorkoutId][divisionId].publishedAt
	 */
	divisionResults?: Record<
		string,
		Record<string, { publishedAt: number | null }>
	>
}

/**
 * Parse competition settings from JSON string
 */
export function parseCompetitionSettings(
	settingsJson: string | null | undefined,
): CompetitionSettings | null {
	if (!settingsJson) return null

	try {
		return JSON.parse(settingsJson) as CompetitionSettings
	} catch (error) {
		console.error("Failed to parse competition settings:", error)
		return null
	}
}

/**
 * Stringify competition settings to JSON
 */
export function stringifyCompetitionSettings(
	settings: CompetitionSettings | null | undefined,
): string | null {
	if (!settings) return null

	try {
		return JSON.stringify(settings)
	} catch (error) {
		console.error("Failed to stringify competition settings:", error)
		return null
	}
}

/**
 * Get effective ScoringConfig from CompetitionSettings
 *
 * Handles migration from legacy scoring settings to new ScoringConfig.
 * Returns null if no scoring is configured.
 */
export function getEffectiveScoringConfig(
	settings: CompetitionSettings | null,
): ScoringConfig | null {
	if (!settings) return null

	// New config takes precedence
	if (settings.scoringConfig) {
		return settings.scoringConfig
	}

	// Convert legacy settings to ScoringConfig
	if (settings.scoring) {
		return convertLegacyToScoringConfig(settings.scoring)
	}

	return null
}

/**
 * Convert legacy ScoringSettings to new ScoringConfig format
 */
export function convertLegacyToScoringConfig(
	legacy: LegacyScoringSettings,
): ScoringConfig {
	switch (legacy.type) {
		case "winner_takes_more":
			return {
				algorithm: "custom",
				customTable: {
					baseTemplate: "winner_takes_more",
					overrides: {},
				},
				tiebreaker: {
					primary: "countback",
				},
				statusHandling: {
					dnf: "last_place",
					dns: "zero",
					withdrawn: "exclude",
				},
			}

		case "even_spread":
			// even_spread needs athlete count at runtime, so we use traditional
			// with step calculated dynamically (this is an approximation)
			return {
				algorithm: "traditional",
				traditional: {
					step: 5, // Default, will be overridden dynamically
					firstPlacePoints: 100,
				},
				tiebreaker: {
					primary: "countback",
				},
				statusHandling: {
					dnf: "last_place",
					dns: "zero",
					withdrawn: "exclude",
				},
			}

		case "fixed_step":
			return {
				algorithm: "traditional",
				traditional: {
					step: legacy.step,
					firstPlacePoints: 100,
				},
				tiebreaker: {
					primary: "countback",
				},
				statusHandling: {
					dnf: "last_place",
					dns: "zero",
					withdrawn: "exclude",
				},
			}
	}
}
