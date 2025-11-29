/**
 * Scoring configuration - three types available
 * 1st place always = 100 points (normalized)
 */
export type ScoringSettings =
	| {
			type: "winner_takes_more"
			// Points: 100, 85, 75, 67, 60, 54... (decreasing increments favor top finishers)
	  }
	| {
			type: "even_spread"
			// Points distributed linearly: for 5 athletes → 100, 75, 50, 25, 0
	  }
	| {
			type: "fixed_step"
			step: number // Default: 5
			// Points: 100, 95, 90, 85... (fixed decrement per place)
	  }

/**
 * Competition Settings Type
 *
 * Stored as JSON in the competitions.settings column.
 * This interface defines the structure of competition-specific configuration.
 */
export interface CompetitionSettings {
	/**
	 * Division configuration
	 * References a scaling group to use as competition divisions
	 */
	divisions?: {
		/**
		 * ID of the scaling group to use for divisions
		 * Athletes will select a scaling level (division) from this group when registering
		 */
		scalingGroupId: string
	}

	/**
	 * Scoring configuration for the competition
	 * Determines how points are awarded based on placement
	 */
	scoring?: ScoringSettings
}

/**
 * Helper function to parse competition settings from JSON string
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
 * Helper function to stringify competition settings to JSON
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
