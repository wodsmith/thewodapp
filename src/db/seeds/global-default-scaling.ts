import { GLOBAL_DEFAULT_SCALING_GROUP_ID } from "../schemas/scaling"

/**
 * Global default scaling group seed data
 * This creates the system-wide default scaling group used for legacy data migration
 * and as the ultimate fallback in the 4-level scaling resolution system.
 */

export const globalDefaultScalingGroup = {
	id: GLOBAL_DEFAULT_SCALING_GROUP_ID,
	title: "Standard Scaling",
	description: "Default Rx+, Rx, and Scaled levels for backward compatibility",
	teamId: null, // System-owned, not team-specific
	isDefault: 1,
	isSystem: 1, // Marks this as the global system default
}

export const globalDefaultScalingLevels = [
	{
		id: "slvl_global_rxplus",
		scalingGroupId: GLOBAL_DEFAULT_SCALING_GROUP_ID,
		label: "Rx+",
		position: 0, // Hardest
	},
	{
		id: "slvl_global_rx",
		scalingGroupId: GLOBAL_DEFAULT_SCALING_GROUP_ID,
		label: "Rx",
		position: 1, // Middle
	},
	{
		id: "slvl_global_scaled",
		scalingGroupId: GLOBAL_DEFAULT_SCALING_GROUP_ID,
		label: "Scaled",
		position: 2, // Easiest
	},
]

/**
 * Migration mapping for converting legacy scale enum values to new scaling level IDs
 */
export const legacyScaleMapping = {
	"rx+": {
		scalingLevelId: "slvl_global_rxplus",
		asRx: true,
	},
	rx: {
		scalingLevelId: "slvl_global_rx",
		asRx: true,
	},
	scaled: {
		scalingLevelId: "slvl_global_scaled",
		asRx: false, // Scaled is considered modified by default
	},
} as const

/**
 * Helper function to get the global default scaling group ID
 * This is used as the ultimate fallback in the scaling resolution chain
 */
export function getGlobalDefaultScalingGroupId(): string {
	return GLOBAL_DEFAULT_SCALING_GROUP_ID
}

/**
 * Helper function to map legacy scale enum to new scaling level
 */
export function mapLegacyScaleToScalingLevel(scale: "rx" | "scaled" | "rx+") {
	return legacyScaleMapping[scale]
}
