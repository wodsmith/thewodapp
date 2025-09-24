import type { WorkoutResultWithWorkoutName } from "@/types"

// Legacy scale values that might be stored in scalingLevelId
const LEGACY_SCALE_VALUES = {
	rx: "Rx",
	"rx+": "Rx+",
	scaled: "Scaled",
} as const

// Default scaling group labels
const DEFAULT_SCALING_LABELS = ["Rx+", "Rx", "Scaled"] as const

type BadgeVariant = "default" | "secondary" | "outline" | "destructive"

interface ScalingDisplayInfo {
	label: string | null
	variant: BadgeVariant
	showScaledSuffix: boolean
}

/**
 * Determines the scaling display information for a workout result
 */
export function getScalingDisplayInfo(
	logEntry: WorkoutResultWithWorkoutName,
): ScalingDisplayInfo | null {
	// Priority 1: Use proper scaling level label if available
	if (logEntry.scalingLevelLabel) {
		return {
			label: logEntry.scalingLevelLabel,
			variant: getVariantForLabel(logEntry.scalingLevelLabel, logEntry.asRx),
			showScaledSuffix: shouldShowScaledSuffix(
				logEntry.scalingLevelLabel,
				logEntry.asRx,
			),
		}
	}

	// Priority 2: Handle legacy scalingLevelId that contains old enum values
	const legacyLabel = getLegacyScaleLabel(logEntry.scalingLevelId)
	if (legacyLabel) {
		return {
			label: legacyLabel,
			variant: getVariantForLabel(legacyLabel, logEntry.asRx),
			showScaledSuffix: false, // Legacy entries don't need suffix
		}
	}

	// Priority 3: Fall back to deprecated scale field
	if (logEntry.scale) {
		const label = logEntry.scale.toUpperCase()
		return {
			label,
			variant: getVariantForLegacyScale(logEntry.scale),
			showScaledSuffix: false,
		}
	}

	// No scaling information available
	return null
}

/**
 * Gets the label for legacy scale values that might be in scalingLevelId
 */
function getLegacyScaleLabel(
	scalingLevelId: string | null | undefined,
): string | null {
	if (!scalingLevelId) return null
	// Only treat as legacy if it exactly matches one of the old enum values
	const lowerCaseId = scalingLevelId.toLowerCase()
	if (lowerCaseId === "rx") return "Rx"
	if (lowerCaseId === "rx+") return "Rx+"
	if (lowerCaseId === "scaled") return "Scaled"
	return null
}

/**
 * Determines the badge variant based on the scaling label and whether it was performed as Rx
 */
function getVariantForLabel(label: string, asRx: boolean): BadgeVariant {
	// Check if this is a default scaling group label
	if (DEFAULT_SCALING_LABELS.includes(label as any)) {
		switch (label) {
			case "Rx+":
				return "default"
			case "Rx":
				return "default" // Rx always shows as default (blue)
			case "Scaled":
				return "outline"
			default:
				return "secondary"
		}
	}

	// Custom scaling group - use asRx to determine variant
	return asRx ? "default" : "secondary"
}

/**
 * Determines the badge variant for legacy scale field
 */
function getVariantForLegacyScale(
	scale: "rx" | "scaled" | "rx+" | null,
): BadgeVariant {
	switch (scale) {
		case "rx+":
		case "rx":
			return "default"
		case "scaled":
			return "outline"
		default:
			return "secondary"
	}
}

/**
 * Determines whether to show "(Scaled)" suffix
 */
function shouldShowScaledSuffix(label: string, asRx: boolean): boolean {
	// Never show suffix for default scaling group labels
	if (DEFAULT_SCALING_LABELS.includes(label as any)) {
		return false
	}

	// Show suffix for custom scaling when not performed as Rx
	return !asRx
}
