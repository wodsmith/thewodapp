import 'server-only'

/**
 * Calculate the minimum number of unique judges required to achieve full coverage.
 * Uses rotation patterns to determine optimal judge count.
 *
 * @param heats - All heats for the event
 * @param rotationLength - Average number of heats per judge rotation (default: 3)
 * @returns Estimated minimum judges needed
 */
export function calculateRequiredJudges(
  heats: Array<{heatNumber: number; laneCount: number}>,
  rotationLength = 3,
): number {
  if (heats.length === 0) return 0

  // Total slots that need coverage
  const totalSlots = heats.reduce((sum, heat) => sum + heat.laneCount, 0)

  // Average lanes per heat
  const avgLanes =
    heats.reduce((sum, heat) => sum + heat.laneCount, 0) / heats.length

  // If each judge works rotationLength heats, they cover rotationLength slots
  // We need enough judges to cover avgLanes at any given time
  const judgesPerHeat = Math.ceil(avgLanes)

  // Minimum judges needed (considering rotations)
  const minJudges = Math.ceil(totalSlots / (rotationLength * avgLanes))

  return Math.max(minJudges, judgesPerHeat)
}
