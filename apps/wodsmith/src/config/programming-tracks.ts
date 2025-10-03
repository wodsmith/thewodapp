/**
 * Environment-aware programming track configuration
 * These track IDs will differ between development and production
 */

interface ProgrammingTrackConfig {
	girls: string
	heroes: string
	open: string
}

/**
 * Get the programming track IDs for the current environment
 * In production, these will be different from development
 */
export function getDefaultProgrammingTracks(): ProgrammingTrackConfig {
	// In development, use the seed script IDs
	if (process.env.NODE_ENV === "development") {
		return {
			girls: "ptrk_girls",
			heroes: "ptrk_heroes",
			open: "ptrk_open",
		}
	}

	// Production track IDs - these should be updated with actual production IDs
	// For now, using the same as development, but these should be replaced
	// with the actual production track IDs once they're known
	return {
		girls: process.env.PRODUCTION_GIRLS_TRACK_ID || "ptrk_girls",
		heroes: process.env.PRODUCTION_HEROES_TRACK_ID || "ptrk_heroes",
		open: process.env.PRODUCTION_OPEN_TRACK_ID || "ptrk_open",
	}
}
