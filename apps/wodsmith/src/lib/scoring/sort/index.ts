/**
 * Sorting module: comparison functions and sort key computation
 */

// Re-export all sort functions
export {
	getSortDirection,
	isLowerBetter,
	getDefaultScoreType,
} from "./direction"

export {
	computeSortKey,
	computeSortKeyWithDirection,
	extractFromSortKey,
	statusFromOrder,
	sortKeyToString,
} from "./sort-key"

export {
	compareScores,
	createComparator,
	sortScores,
	findRank,
} from "./compare"
