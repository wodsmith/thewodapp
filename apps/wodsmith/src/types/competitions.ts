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
	 * Additional settings can be added here in the future
	 * Examples:
	 * - scoring?: { type: 'points' | 'time' | 'reps', ...  }
	 * - rules?: { ... }
	 * - payment?: { ... }
	 */
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
