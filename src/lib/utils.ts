import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

export type Prettify<T> = {
	[K in keyof T]: T[K]
} & {}

export function parseTimeScoreToSeconds(timeStr: string): number | null {
	const trimmedTimeStr = timeStr.trim()
	if (!trimmedTimeStr) return null

	// Check if it's just a number (already in seconds)
	if (/^\d+$/.test(trimmedTimeStr)) {
		const seconds = Number.parseInt(trimmedTimeStr, 10)
		return !Number.isNaN(seconds) ? seconds : null
	}

	// Check for MM:SS or HH:MM:SS format
	const timeParts = trimmedTimeStr.split(":")
	if (
		timeParts.length < 2 ||
		timeParts.length > 3 ||
		timeParts.some(
			(part) =>
				!/^\d{1,2}$/.test(part) &&
				!(timeParts.indexOf(part) === 0 && /^\d+$/.test(part)),
		)
	) {
		// first part can be more than 2 digits if it's like 120:30
		if (
			!(
				timeParts.length === 2 &&
				/^\d+$/.test(timeParts[0]) &&
				/^\d{1,2}$/.test(timeParts[1]) &&
				Number.parseInt(timeParts[1], 10) < 60
			)
		) {
			if (
				!(
					timeParts.length === 3 &&
					/^\d+$/.test(timeParts[0]) &&
					/^\d{1,2}$/.test(timeParts[1]) &&
					Number.parseInt(timeParts[1], 10) < 60 &&
					/^\d{1,2}$/.test(timeParts[2]) &&
					Number.parseInt(timeParts[2], 10) < 60
				)
			) {
				console.warn(
					`[Action] Invalid time format for parsing: ${trimmedTimeStr}`,
				)
				return null
			}
		}
	}

	let seconds = 0
	if (timeParts.length === 2) {
		// MM:SS
		seconds =
			Number.parseInt(timeParts[0], 10) * 60 + Number.parseInt(timeParts[1], 10)
	} else if (timeParts.length === 3) {
		// HH:MM:SS
		seconds =
			Number.parseInt(timeParts[0], 10) * 3600 +
			Number.parseInt(timeParts[1], 10) * 60 +
			Number.parseInt(timeParts[2], 10)
	} else {
		const purelyNumeric = Number.parseInt(trimmedTimeStr, 10)
		if (!Number.isNaN(purelyNumeric)) return purelyNumeric
		return null
	}
	if (Number.isNaN(seconds)) return null
	return seconds // Added explicit return for calculated seconds
}

// Helper function to format total seconds to HH:MM:SS or MM:SS string
export function formatSecondsToTime(totalSeconds: number): string {
	if (totalSeconds < 0) return "00:00" // Or handle error appropriately

	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60

	const pad = (num: number) => num.toString().padStart(2, "0")

	if (hours > 0) {
		return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
	}
	return `${pad(minutes)}:${pad(seconds)}`
}
