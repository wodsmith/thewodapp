import type { WorkoutType } from "./types"

export interface ParseResult {
  formatted: string
  isValid: boolean
  needsTieBreak: boolean
  error?: string
}

/**
 * Smart score parser that handles all workout types
 * Examples:
 * - "1234" → "12:34" (for-time)
 * - "150" → "150 reps" (amrap)
 * - "225" → "225 lbs" (max-load)
 * - "cap" or "c" → "CAP"
 * - "dns" → "DNS" (Did Not Start)
 * - "dnf" → "DNF" (Did Not Finish)
 */
export function parseScore(input: string, workoutType: WorkoutType, timeCap: number): ParseResult {
  const normalized = input.toLowerCase().trim()

  // Handle special statuses
  if (normalized === "dns" || normalized === "did not start") {
    return { formatted: "DNS", isValid: true, needsTieBreak: false }
  }
  if (normalized === "dnf" || normalized === "did not finish") {
    return { formatted: "DNF", isValid: true, needsTieBreak: false }
  }
  if (normalized === "cap" || normalized === "c") {
    const minutes = Math.floor(timeCap / 60)
    const seconds = timeCap % 60
    const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`
    return {
      formatted: `CAP (${timeStr})`,
      isValid: true,
      needsTieBreak: workoutType === "for-time", // Need reps completed
    }
  }

  // Parse numeric input based on workout type
  const numericOnly = normalized.replace(/[^0-9]/g, "")

  if (!numericOnly) {
    return {
      formatted: input,
      isValid: false,
      needsTieBreak: false,
      error: "Invalid input",
    }
  }

  switch (workoutType) {
    case "for-time":
      return parseTimeScore(numericOnly, timeCap)
    case "amrap":
      return parseRepScore(numericOnly)
    case "max-load":
      return parseLoadScore(numericOnly)
    default:
      return {
        formatted: input,
        isValid: false,
        needsTieBreak: false,
        error: "Unknown workout type",
      }
  }
}

function parseTimeScore(input: string, timeCap: number): ParseResult {
  // Handle different input formats
  // "1234" → "12:34"
  // "234" → "2:34"
  // "34" → "0:34"

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

  if (isNaN(minutes) || isNaN(seconds) || seconds >= 60) {
    return {
      formatted: input,
      isValid: false,
      needsTieBreak: false,
      error: "Invalid time format",
    }
  }

  const totalSeconds = minutes * 60 + seconds
  const formatted = `${minutes}:${seconds.toString().padStart(2, "0")}`

  // Check if time exceeds cap
  if (totalSeconds > timeCap) {
    return {
      formatted,
      isValid: false,
      needsTieBreak: false,
      error: `Time exceeds cap of ${Math.floor(timeCap / 60)}:${(timeCap % 60).toString().padStart(2, "0")}`,
    }
  }

  return {
    formatted,
    isValid: true,
    needsTieBreak: false,
  }
}

function parseRepScore(input: string): ParseResult {
  const reps = Number.parseInt(input, 10)

  if (isNaN(reps) || reps < 0) {
    return {
      formatted: input,
      isValid: false,
      needsTieBreak: false,
      error: "Invalid rep count",
    }
  }

  return {
    formatted: `${reps} reps`,
    isValid: true,
    needsTieBreak: true, // AMRAPs always need tie-break time
  }
}

function parseLoadScore(input: string): ParseResult {
  const load = Number.parseInt(input, 10)

  if (isNaN(load) || load < 0) {
    return {
      formatted: input,
      isValid: false,
      needsTieBreak: false,
      error: "Invalid load",
    }
  }

  return {
    formatted: `${load} lbs`,
    isValid: true,
    needsTieBreak: false,
  }
}

/**
 * Calculate if a score is an outlier (>2 standard deviations from mean)
 */
export function isOutlier(scoreSeconds: number, divisionScores: number[]): boolean {
  if (divisionScores.length < 3) return false // Need minimum sample

  const mean = divisionScores.reduce((sum, s) => sum + s, 0) / divisionScores.length
  const variance = divisionScores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / divisionScores.length
  const stdDev = Math.sqrt(variance)

  return Math.abs(scoreSeconds - mean) > 2 * stdDev
}
