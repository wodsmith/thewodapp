import {
  calculateCoverage,
  type CoverageStats,
  type HeatInfo,
  type RotationLike,
} from "@/lib/judge-rotation-utils"
import type {
  ProposedRotation,
  SchedulingHeatInput,
  SchedulingRotationInput,
} from "./types"

export function projectCoverage(
  current: SchedulingRotationInput[],
  proposals: ProposedRotation[],
  heats: SchedulingHeatInput[],
): CoverageStats {
  const all: RotationLike[] = [
    ...current,
    ...proposals.map((p, i) => ({
      id: `proposal_${i}`,
      membershipId: p.membershipId,
      startingHeat: p.startingHeat,
      startingLane: p.startingLane,
      heatsCount: p.heatsCount,
      laneShiftPattern: p.laneShiftPattern,
    })),
  ]
  return calculateCoverage(all, heats.map(toHeatInfo))
}

function toHeatInfo(heat: SchedulingHeatInput): HeatInfo {
  return {
    heatNumber: heat.heatNumber,
    laneCount: heat.laneCount,
    occupiedLanes: heat.occupiedLanes,
  }
}
