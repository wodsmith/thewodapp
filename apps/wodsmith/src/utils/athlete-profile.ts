import type { z } from "zod"
import type { athleteProfileExtendedSchema } from "@/schemas/settings.schema"

export type AthleteProfileData = z.infer<typeof athleteProfileExtendedSchema>

/**
 * Parse athleteProfile JSON field safely
 */
export function parseAthleteProfile(
	athleteProfileJson: string | null,
): AthleteProfileData | null {
	if (!athleteProfileJson) return null

	try {
		return JSON.parse(athleteProfileJson) as AthleteProfileData
	} catch (error) {
		console.error("Failed to parse athleteProfile JSON:", error)
		return null
	}
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: Date | number | null): number | null {
	if (!dateOfBirth) return null

	const dob =
		typeof dateOfBirth === "number" ? new Date(dateOfBirth) : dateOfBirth
	const today = new Date()
	let age = today.getFullYear() - dob.getFullYear()
	const monthDiff = today.getMonth() - dob.getMonth()

	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
		age--
	}

	return age
}

/**
 * Convert cm to feet and inches
 */
export function cmToFeetInches(cm: number): string {
	const totalInches = cm / 2.54
	const feet = Math.floor(totalInches / 12)
	const inches = Math.round(totalInches % 12)
	return `${feet}'${inches}"`
}

/**
 * Convert kg to lbs
 */
export function kgToLbs(kg: number): number {
	return Math.round(kg * 2.20462)
}

/**
 * Convert lbs to kg
 */
export function lbsToKg(lbs: number): number {
	return Math.round(lbs / 2.20462)
}

/**
 * Convert feet and inches to cm
 */
export function feetInchesToCm(feet: number, inches: number): number {
	return Math.round((feet * 12 + inches) * 2.54)
}

/**
 * Format height based on unit preference
 */
export function formatHeight(
	heightCm: number | undefined,
	preferredUnits: "imperial" | "metric" = "imperial",
): string {
	if (!heightCm) return "Not set"

	if (preferredUnits === "imperial") {
		return cmToFeetInches(heightCm)
	}
	return `${heightCm} cm`
}

/**
 * Format weight based on unit preference
 */
export function formatWeight(
	weightKg: number | undefined,
	preferredUnits: "imperial" | "metric" = "imperial",
): string {
	if (!weightKg) return "Not set"

	if (preferredUnits === "imperial") {
		return `${kgToLbs(weightKg)} lbs`
	}
	return `${weightKg} kg`
}

/**
 * Format lift weight based on unit preference
 */
export function formatLiftWeight(
	weight: number,
	unit: "kg" | "lbs",
	preferredUnits: "imperial" | "metric" = "imperial",
): string {
	// Map preferred units to unit codes
	const preferredUnitCode = preferredUnits === "metric" ? "kg" : "lbs"

	// If the stored unit matches preference, return as-is
	if (unit === preferredUnitCode) {
		return `${weight} ${unit.toUpperCase()}`
	}

	// Convert if needed
	if (preferredUnits === "imperial" && unit === "kg") {
		return `${kgToLbs(weight)} LBS`
	}
	if (preferredUnits === "metric" && unit === "lbs") {
		return `${lbsToKg(weight)} KG`
	}

	return `${weight} ${unit.toUpperCase()}`
}
