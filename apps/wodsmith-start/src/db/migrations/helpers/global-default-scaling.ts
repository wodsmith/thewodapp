import { GLOBAL_DEFAULT_SCALING_GROUP_ID } from "../../schemas/scaling"

/**
 * Global default scaling group seed data for migrations.
 *
 * This provides the canonical default scaling group that all teams use unless
 * they create custom scaling configurations. The structure mirrors CrossFit's
 * traditional Rx/Scaled categories.
 */

/**
 * The system-wide default scaling group.
 * - teamId is null because it's a system group (not owned by any team)
 * - isDefault and isSystem are both true to mark it as the global default
 */
export const globalDefaultScalingGroup = {
	id: GLOBAL_DEFAULT_SCALING_GROUP_ID,
	title: "Default Scaling",
	description: "Global default scaling group",
	teamId: null,
	isDefault: true,
	isSystem: true,
} as const

/**
 * Scaling level IDs for the global default group.
 * These are deterministic IDs (not CUID-generated) for migration stability.
 */
export const GLOBAL_SCALING_LEVEL_IDS = {
	RX_PLUS: "slvl_global_rx_plus",
	RX: "slvl_global_rx",
	SCALED: "slvl_global_scaled",
} as const

/**
 * The default scaling levels: Rx+, Rx, and Scaled.
 * Position 0 is the hardest (Rx+), position 2 is the easiest (Scaled).
 */
export const globalDefaultScalingLevels = [
	{
		id: GLOBAL_SCALING_LEVEL_IDS.RX_PLUS,
		scalingGroupId: GLOBAL_DEFAULT_SCALING_GROUP_ID,
		label: "Rx+",
		position: 0,
	},
	{
		id: GLOBAL_SCALING_LEVEL_IDS.RX,
		scalingGroupId: GLOBAL_DEFAULT_SCALING_GROUP_ID,
		label: "Rx",
		position: 1,
	},
	{
		id: GLOBAL_SCALING_LEVEL_IDS.SCALED,
		scalingGroupId: GLOBAL_DEFAULT_SCALING_GROUP_ID,
		label: "Scaled",
		position: 2,
	},
] as const

/**
 * Maps legacy scale enum values to the new scaling level IDs.
 * Used to migrate existing results from the old scale column.
 */
export const legacyScaleMapping = {
	"rx+": { scalingLevelId: GLOBAL_SCALING_LEVEL_IDS.RX_PLUS, asRx: true },
	rx: { scalingLevelId: GLOBAL_SCALING_LEVEL_IDS.RX, asRx: true },
	scaled: { scalingLevelId: GLOBAL_SCALING_LEVEL_IDS.SCALED, asRx: false },
} as const

export type LegacyScaleValue = keyof typeof legacyScaleMapping
