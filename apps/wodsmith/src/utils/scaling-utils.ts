/**
 * Utility functions for scaling levels and descriptions
 */

interface ScalingLevel {
	id: string
	label: string
	position: number
}

interface ScalingDescription {
	scalingLevelId: string
	description: string | null
}

/**
 * Filters scaling levels to only include those that have descriptions defined.
 * This ensures we only show levels that have actual scaling information available.
 *
 * @param scalingLevels - Array of scaling levels
 * @param scalingDescriptions - Array of scaling descriptions
 * @returns Filtered array of scaling levels that have descriptions
 */
export function getDefinedScalingLevels(
	scalingLevels: ScalingLevel[] = [],
	scalingDescriptions: ScalingDescription[] = [],
): ScalingLevel[] {
	// If no scaling levels exist, return empty array
	if (scalingLevels.length === 0) {
		return []
	}

	// If no descriptions exist at all, show all scaling levels (backward compatibility)
	if (scalingDescriptions.length === 0) {
		return scalingLevels
	}

	// Filter levels to only include those that have non-null descriptions
	const definedDescriptions = scalingDescriptions.filter(
		(desc) => desc.description !== null && desc.description?.trim() !== "",
	)

	// If no descriptions are actually defined (all are null/empty), show all levels
	if (definedDescriptions.length === 0) {
		return scalingLevels
	}

	const definedLevelIds = new Set(
		definedDescriptions.map((desc) => desc.scalingLevelId),
	)

	const result = scalingLevels.filter((level) => definedLevelIds.has(level.id))

	return result
}

/**
 * Checks if a scaling level has a defined description
 *
 * @param levelId - The scaling level ID to check
 * @param scalingDescriptions - Array of scaling descriptions
 * @returns True if the level has a non-null, non-empty description
 */
export function hasDefinedDescription(
	levelId: string,
	scalingDescriptions: ScalingDescription[] = [],
): boolean {
	const description = scalingDescriptions.find(
		(desc) => desc.scalingLevelId === levelId,
	)?.description

	return (
		description !== null &&
		description !== undefined &&
		description.trim() !== ""
	)
}

/**
 * Gets the description for a scaling level, falling back to base workout description
 *
 * @param levelId - The scaling level ID
 * @param scalingDescriptions - Array of scaling descriptions
 * @param baseDescription - The base workout description to fall back to
 * @returns The description for the level or base description
 */
export function getDescriptionForLevel(
	levelId: string,
	scalingDescriptions: ScalingDescription[] = [],
	baseDescription: string = "",
): string {
	const customDescription = scalingDescriptions.find(
		(desc) => desc.scalingLevelId === levelId,
	)?.description

	return customDescription || baseDescription
}
