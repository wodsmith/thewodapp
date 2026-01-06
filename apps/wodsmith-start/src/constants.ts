// Site configuration
export const SITE_NAME = "WODsmith"
export const SITE_DESCRIPTION = "Track your workouts and progress."
/**
 * Default site domain - used for client-safe code
 */
export const SITE_DOMAIN = "wodsmith.com"

/**
 * @deprecated Use getSiteUrl() from @/lib/env for server code.
 * This constant exists only for backward compatibility with client code.
 * Server code should use getSiteUrl() which reads from environment variables.
 */
export const SITE_URL = `https://${SITE_DOMAIN}`

// Auth configuration
export const REDIRECT_AFTER_SIGN_IN = "/dashboard"
export const SESSION_COOKIE_NAME = "session"
export const ACTIVE_TEAM_COOKIE_NAME = "active-team"
export const PASSWORD_RESET_TOKEN_EXPIRATION_SECONDS = 24 * 60 * 60 // 24 hours
export const EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS = 24 * 60 * 60 // 24 hours
export const MAX_SESSIONS_PER_USER = 5
export const MAX_TEAMS_JOINED_PER_USER = 10

// Workout scheme UI labels
export const WORKOUT_SCHEMES = [
	{ value: "time", label: "For Time" },
	{ value: "time-with-cap", label: "For Time (with cap)" },
	{ value: "rounds-reps", label: "AMRAP (rounds + reps)" },
	{ value: "reps", label: "Max Reps" },
	{ value: "load", label: "Max Load" },
	{ value: "calories", label: "Max Calories" },
	{ value: "meters", label: "Max Distance (meters)" },
	{ value: "feet", label: "Max Distance (feet)" },
	{ value: "points", label: "Points" },
	{ value: "pass-fail", label: "Pass/Fail" },
	{ value: "emom", label: "EMOM" },
] as const

export const SCORE_TYPES = [
	{ value: "min", label: "Min (lowest single set wins)" },
	{ value: "max", label: "Max (highest single set wins)" },
	{ value: "sum", label: "Sum (total across rounds)" },
	{ value: "average", label: "Average (mean across rounds)" },
] as const

export const TIEBREAK_SCHEMES = [
	{ value: "time", label: "Time" },
	{ value: "reps", label: "Reps" },
] as const
