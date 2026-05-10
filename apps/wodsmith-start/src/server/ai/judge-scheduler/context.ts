import {calculateCoverage, type HeatInfo} from "@/lib/judge-rotation-utils"
import type {
  EventDefaults,
  SchedulingContext,
  SchedulingHeatInput,
  SchedulingJudgeInput,
  SchedulingRotationInput,
} from "./types"

export interface BuildSchedulingContextInput {
  heats: SchedulingHeatInput[]
  judges: SchedulingJudgeInput[]
  rotations: SchedulingRotationInput[]
  eventDefaults: EventDefaults
}

export function buildSchedulingContext(
  input: BuildSchedulingContextInput,
): SchedulingContext {
  const rotationsByMembership = new Map<string, number>()
  for (const rotation of input.rotations) {
    const current = rotationsByMembership.get(rotation.membershipId) ?? 0
    rotationsByMembership.set(rotation.membershipId, current + 1)
  }

  const judges = input.judges.map((judge) => ({
    ...judge,
    currentRotationCount: rotationsByMembership.get(judge.membershipId) ?? 0,
  }))

  const coverage = calculateCoverage(input.rotations, input.heats.map(toHeatInfo))

  return {
    heats: input.heats,
    judges,
    rotations: input.rotations,
    eventDefaults: input.eventDefaults,
    coverage,
  }
}

function toHeatInfo(heat: SchedulingHeatInput): HeatInfo {
  return {
    heatNumber: heat.heatNumber,
    laneCount: heat.laneCount,
    occupiedLanes: heat.occupiedLanes,
  }
}
