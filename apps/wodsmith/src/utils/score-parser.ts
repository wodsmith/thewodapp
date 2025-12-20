import type { TiebreakScheme, WorkoutScheme } from "@/db/schema"

export interface ParseResult {
	formatted: string
	rawValue: number | null // Seconds for time, reps for AMRAP, lbs for load, etc.
	isValid: boolean
	needsTieBreak: boolean
	scoreStatus: "scored" | "dns" | "dnf" | "cap" | null
	error?: string
}

/**
 * Smart score parser that handles all workout schemes
 *
 * Examples:
 * - "1234" → "12:34" (time/time-with-cap)
 * - "150" → "150 reps" (reps/rounds-reps)
 * - "225" → "225 lbs" (load)
 * - "cap" or "c" → "CAP" (time-with-cap only)
 * - "dns" → "DNS" (Did Not Start)
 * - "dnf" → "DNF" (Did Not Finish)
 */
export function parseScore(
	input: string,
	scheme: WorkoutScheme,
	timeCap?: number,
	tiebreakScheme?: TiebreakScheme | null,
): ParseResult {
	const normalized = input.toLowerCase().trim()

	// Handle empty input
	if (!normalized) {
		return {
			formatted: "",
			rawValue: null,
			isValid: false,
			needsTieBreak: false,
			scoreStatus: null,
			error: undefined,
		}
	}

	// Handle special statuses
	if (normalized === "dns" || normalized === "did not start") {
		return {
			formatted: "DNS",
			rawValue: null,
			isValid: true,
			needsTieBreak: false,
			scoreStatus: "dns",
		}
	}
	if (normalized === "dnf" || normalized === "did not finish") {
		return {
			formatted: "DNF",
			rawValue: null,
			isValid: true,
			needsTieBreak: false,
			scoreStatus: "dnf",
		}
	}
	if (normalized === "cap" || normalized === "c") {
		// CAP only valid for time-based schemes
		if (scheme !== "time-with-cap" && scheme !== "time") {
			return {
				formatted: input,
				rawValue: null,
				isValid: false,
				needsTieBreak: false,
				scoreStatus: null,
				error: "CAP is only valid for timed workouts",
			}
		}

		const formatted = timeCap ? `CAP (${formatTime(timeCap)})` : "CAP"

		return {
			formatted,
			rawValue: timeCap ?? null,
			isValid: true,
			needsTieBreak: tiebreakScheme != null, // Need tie-break if workout has one configured
			scoreStatus: "cap",
		}
	}

	// Parse numeric input based on workout scheme
	const numericOnly = normalized.replace(/[^0-9.+-]/g, "")

	if (!numericOnly) {
		return {
			formatted: input,
			rawValue: null,
			isValid: false,
			needsTieBreak: false,
			scoreStatus: null,
			error: "Invalid input",
		}
	}

	switch (scheme) {
		case "time":
		case "time-with-cap":
			return parseTimeScore(numericOnly, timeCap)
		case "rounds-reps":
			return parseRoundsRepsScore(normalized, tiebreakScheme)
		case "reps":
			return parseRepScore(numericOnly, tiebreakScheme)
		case "load":
			return parseLoadScore(numericOnly)
		case "calories":
			return parseCaloriesScore(numericOnly)
		case "meters":
			return parseDistanceScore(numericOnly, "m")
		case "feet":
			return parseDistanceScore(numericOnly, "ft")
		case "points":
			return parsePointsScore(numericOnly)
		case "emom":
			return parseRepScore(numericOnly, tiebreakScheme)
		case "pass-fail":
			return parsePassFailScore(normalized)
		default:
			return {
				formatted: input,
				rawValue: null,
				isValid: false,
				needsTieBreak: false,
				scoreStatus: null,
				error: `Unknown workout scheme: ${scheme}`,
			}
	}
}

function formatTime(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function parseTimeScore(input: string, timeCap?: number): ParseResult {
	// Handle different input formats
	// "1234" → "12:34" (12 minutes 34 seconds)
	// "234" → "2:34" (2 minutes 34 seconds)
	// "34" → "0:34" (34 seconds)

	let minutes: number
	let seconds: number

	if (input.length <= 2) {
		minutes = 0
		seconds = Number.parseInt(input, 10)
	} else if (input.length === 3) {
		minutes = Number.parseInt(input.charAt(0), 10)
		seconds = Number.parseInt(input.slice(1), 10)
	} else {
		const splitPoint = input.length - 2
		minutes = Number.parseInt(input.slice(0, splitPoint), 10)
		seconds = Number.parseInt(input.slice(splitPoint), 10)
	}

	if (Number.isNaN(minutes) || Number.isNaN(seconds) || seconds >= 60) {
		return {
			formatted: input,
			rawValue: null,
			isValid: false,
			needsTieBreak: false,
			scoreStatus: null,
			error: "Invalid time format",
		}
	}

	const totalSeconds = minutes * 60 + seconds
	const formatted = formatTime(totalSeconds)

	// Check if time equals cap (treat as CAP)
	if (timeCap && totalSeconds === timeCap) {
		return {
			formatted: `CAP (${formatted})`,
			rawValue: totalSeconds,
			isValid: true,
			needsTieBreak: false,
			scoreStatus: "cap",
		}
	}

	// Check if time exceeds cap - still valid but with warning
	if (timeCap && totalSeconds > timeCap) {
		return {
			formatted,
			rawValue: totalSeconds,
			isValid: true,
			needsTieBreak: false,
			scoreStatus: "scored",
			error: `Time exceeds cap of ${formatTime(timeCap)}`,
		}
	}

	return {
		formatted,
		rawValue: totalSeconds,
		isValid: true,
		needsTieBreak: false,
		scoreStatus: "scored",
	}
}

function parseRoundsRepsScore(
	input: string,
	tiebreakScheme?: TiebreakScheme | null,
): ParseResult {
	// Handle formats like "3+15" or "315" (3 rounds + 15 reps)
	// Also handle just "150" as total reps

	// Check for explicit + format
	if (input.includes("+")) {
		const parts = input.split("+")
		const roundsPart = parts[0]
		const repsPart = parts[1]
		if (!roundsPart || !repsPart) {
			return {
				formatted: input,
				rawValue: null,
				isValid: false,
				needsTieBreak: false,
				scoreStatus: null,
				error: "Invalid rounds+reps format",
			}
		}
		const rounds = Number.parseInt(roundsPart.trim(), 10)
		const reps = Number.parseInt(repsPart.trim(), 10)

		if (Number.isNaN(rounds) || Number.isNaN(reps) || rounds < 0 || reps < 0) {
			return {
				formatted: input,
				rawValue: null,
				isValid: false,
				needsTieBreak: false,
				scoreStatus: null,
				error: "Invalid rounds+reps format",
			}
		}

		return {
			formatted: `${rounds}+${reps}`,
			rawValue: rounds * 1000 + reps, // Encode as rounds*1000 + reps for sorting
			isValid: true,
			needsTieBreak: tiebreakScheme != null,
			scoreStatus: "scored",
		}
	}

	// Parse as total reps
	const numericOnly = input.replace(/[^0-9]/g, "")
	const totalReps = Number.parseInt(numericOnly, 10)

	if (Number.isNaN(totalReps) || totalReps < 0) {
		return {
			formatted: input,
			rawValue: null,
			isValid: false,
			needsTieBreak: false,
			scoreStatus: null,
			error: "Invalid rep count",
		}
	}

	return {
		formatted: `${totalReps} reps`,
		rawValue: totalReps,
		isValid: true,
		needsTieBreak: tiebreakScheme != null,
		scoreStatus: "scored",
	}
}

function parseRepScore(
	input: string,
	tiebreakScheme?: TiebreakScheme | null,
): ParseResult {
	const reps = Number.parseInt(input, 10)

	if (Number.isNaN(reps) || reps < 0) {
		return {
			formatted: input,
			rawValue: null,
			isValid: false,
			needsTieBreak: false,
			scoreStatus: null,
			error: "Invalid rep count",
		}
	}

	return {
		formatted: `${reps} reps`,
		rawValue: reps,
		isValid: true,
		needsTieBreak: tiebreakScheme != null,
		scoreStatus: "scored",
	}
}

function parseLoadScore(input: string): ParseResult {
	const load = Number.parseInt(input, 10)

	if (Number.isNaN(load) || load < 0) {
		return {
			formatted: input,
			rawValue: null,
			isValid: false,
			needsTieBreak: false,
			scoreStatus: null,
			error: "Invalid load",
		}
	}

	return {
		formatted: `${load} lbs`,
		rawValue: load,
		isValid: true,
		needsTieBreak: false,
		scoreStatus: "scored",
	}
}

function parseCaloriesScore(input: string): ParseResult {
	const calories = Number.parseInt(input, 10)

	if (Number.isNaN(calories) || calories < 0) {
		return {
			formatted: input,
			rawValue: null,
			isValid: false,
			needsTieBreak: false,
			scoreStatus: null,
			error: "Invalid calorie count",
		}
	}

	return {
		formatted: `${calories} cal`,
		rawValue: calories,
		isValid: true,
		needsTieBreak: false,
		scoreStatus: "scored",
	}
}

function parseDistanceScore(input: string, unit: "m" | "ft"): ParseResult {
	const distance = Number.parseInt(input, 10)

	if (Number.isNaN(distance) || distance < 0) {
		return {
			formatted: input,
			rawValue: null,
			isValid: false,
			needsTieBreak: false,
			scoreStatus: null,
			error: "Invalid distance",
		}
	}

	return {
		formatted: `${distance}${unit}`,
		rawValue: distance,
		isValid: true,
		needsTieBreak: false,
		scoreStatus: "scored",
	}
}

function parsePointsScore(input: string): ParseResult {
	const points = Number.parseInt(input, 10)

	if (Number.isNaN(points)) {
		return {
			formatted: input,
			rawValue: null,
			isValid: false,
			needsTieBreak: false,
			scoreStatus: null,
			error: "Invalid points",
		}
	}

	return {
		formatted: `${points} pts`,
		rawValue: points,
		isValid: true,
		needsTieBreak: false,
		scoreStatus: "scored",
	}
}

function parsePassFailScore(input: string): ParseResult {
	const normalized = input.toLowerCase().trim()

	if (normalized === "pass" || normalized === "p" || normalized === "1") {
		return {
			formatted: "Pass",
			rawValue: 1,
			isValid: true,
			needsTieBreak: false,
			scoreStatus: "scored",
		}
	}
	if (normalized === "fail" || normalized === "f" || normalized === "0") {
		return {
			formatted: "Fail",
			rawValue: 0,
			isValid: true,
			needsTieBreak: false,
			scoreStatus: "scored",
		}
	}

	return {
		formatted: input,
		rawValue: null,
		isValid: false,
		needsTieBreak: false,
		scoreStatus: null,
		error: "Enter 'pass' or 'fail'",
	}
}

/**
 * Parse a tie-break score based on the tie-break scheme
 */
export function parseTieBreakScore(
	input: string,
	tiebreakScheme: TiebreakScheme,
): ParseResult {
	const normalized = input.toLowerCase().trim()

	if (!normalized) {
		return {
			formatted: "",
			rawValue: null,
			isValid: false,
			needsTieBreak: false,
			scoreStatus: null,
		}
	}

	switch (tiebreakScheme) {
		case "time":
			return parseTimeScore(normalized.replace(/[^0-9]/g, ""))
		case "reps":
			return parseRepScore(normalized.replace(/[^0-9]/g, ""), null)
		default:
			return {
				formatted: input,
				rawValue: null,
				isValid: false,
				needsTieBreak: false,
				scoreStatus: null,
				error: `Unknown tie-break scheme: ${tiebreakScheme}`,
			}
	}
}

/**
 * Calculate if a score is an outlier (>2 standard deviations from mean)
 */
export function isOutlier(
	scoreValue: number,
	divisionScores: number[],
): boolean {
	if (divisionScores.length < 3) return false // Need minimum sample

	const mean =
		divisionScores.reduce((sum, s) => sum + s, 0) / divisionScores.length
	const variance =
		divisionScores.reduce((sum, s) => sum + (s - mean) ** 2, 0) /
		divisionScores.length
	const stdDev = Math.sqrt(variance)

	return Math.abs(scoreValue - mean) > 2 * stdDev
}
