import {describe, expect, it} from 'vitest'
import {projectCoverage} from '@/server/ai/judge-scheduler/projector'
import {LANE_SHIFT_PATTERN} from '@/db/schema'
import type {
  ProposedRotation,
  SchedulingHeatInput,
  SchedulingRotationInput,
} from '@/server/ai/judge-scheduler/types'

function heat(n: number): SchedulingHeatInput {
  return {
    heatNumber: n,
    laneCount: 2,
    occupiedLanes: undefined,
    scheduledTime: null,
    durationMinutes: 15,
  }
}

const baseProposal: ProposedRotation = {
  membershipId: 'tmem_a',
  startingHeat: 1,
  startingLane: 1,
  heatsCount: 2,
  laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
  reason: 'covers lane 1',
  confidence: 'high',
}

describe('projectCoverage', () => {
  it('reports unchanged coverage when there are no proposals', () => {
    const heats = [heat(1), heat(2)]
    const projection = projectCoverage([], [], heats)
    expect(projection.coveragePercent).toBe(0)
    expect(projection.coveredSlots).toBe(0)
  })

  it('counts proposals as adding coverage on top of existing rotations', () => {
    const heats = [heat(1), heat(2)] // 4 total slots
    const existing: SchedulingRotationInput[] = [
      {
        id: 'rot_existing',
        membershipId: 'tmem_b',
        startingHeat: 1,
        startingLane: 2,
        heatsCount: 2,
        laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
      },
    ] // covers H1L2 + H2L2
    const projection = projectCoverage(existing, [baseProposal], heats)
    // Existing covers 2 of 4. Proposal adds H1L1 + H2L1 → 4 of 4.
    expect(projection.coveredSlots).toBe(4)
    expect(projection.coveragePercent).toBe(100)
  })

  it('flags overlaps when proposals collide with existing rotations', () => {
    const heats = [heat(1), heat(2)]
    const existing: SchedulingRotationInput[] = [
      {
        id: 'rot_existing',
        membershipId: 'tmem_b',
        startingHeat: 1,
        startingLane: 1,
        heatsCount: 1,
        laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
      },
    ]
    // proposal also wants H1L1 → overlap.
    const projection = projectCoverage(existing, [baseProposal], heats)
    expect(projection.overlaps.length).toBeGreaterThan(0)
  })
})
