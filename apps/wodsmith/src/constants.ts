import type { Route } from "next"

// Re-export workout types from DB schema for type safety
export type {
	WorkoutScheme,
	ScoreType,
	TiebreakScheme,
	SecondaryScheme,
} from "@/db/schemas/workouts"

export const SITE_NAME = "WODsmith"
export const SITE_DESCRIPTION = "Track your workouts and progress."
export const SITE_URL =
	process.env.NODE_ENV === "development"
		? "http://localhost:3000"
		: process.env.NEXT_PUBLIC_SITE_URL || "https://thewodapp.com"
export const GITHUB_REPO_URL = "https://github.com/zacjones93/spicy-wod-3"

export const SITE_DOMAIN = new URL(SITE_URL).hostname
export const PASSWORD_RESET_TOKEN_EXPIRATION_SECONDS = 24 * 60 * 60 // 24 hours
export const EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS = 24 * 60 * 60 // 24 hours
export const MAX_SESSIONS_PER_USER = 5
export const MAX_TEAMS_JOINED_PER_USER = 10
export const SESSION_COOKIE_NAME = "session"
export const ACTIVE_TEAM_COOKIE_NAME = "active-team"
export const GOOGLE_OAUTH_STATE_COOKIE_NAME = "google-oauth-state"
export const GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME =
	"google-oauth-code-verifier"

export const CREDIT_PACKAGES = [
	{ id: "package-1", credits: 500, price: 5 },
	{ id: "package-2", credits: 1200, price: 10 },
	{ id: "package-3", credits: 3000, price: 20 },
] as const

export const CREDITS_EXPIRATION_YEARS = 2

export const FREE_MONTHLY_CREDITS = CREDIT_PACKAGES[0].credits * 0.1
export const MAX_TRANSACTIONS_PER_PAGE = 10
export const REDIRECT_AFTER_SIGN_IN = "/workouts" as Route

// Workout scheme constants (derived from database schema)
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

export const SECONDARY_SCHEMES = [
	{ value: "time", label: "For Time" },
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
