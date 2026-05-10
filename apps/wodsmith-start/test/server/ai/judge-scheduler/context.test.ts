import {describe, expect, it} from 'vitest'
import {buildSchedulingContext} from '@/server/ai/judge-scheduler/context'
import {LANE_SHIFT_PATTERN} from '@/db/schema'
import {VOLUNTEER_AVAILABILITY} from '@/db/schemas/volunteers'
import type {
  SchedulingHeatInput,
  SchedulingJudgeInput,
  SchedulingRotationInput,
} from '@/server/ai/judge-scheduler/types'

function heat(
  overrides: Partial<SchedulingHeatInput> = {},
): SchedulingHeatInput {
  return {
    heatNumber: 1,
    laneCount: 4,
    occupiedLanes: undefined,
    scheduledTime: null,
    durationMinutes: 15,
    ...overrides,
  }
}

function judge(
  overrides: Partial<SchedulingJudgeInput> = {},
): SchedulingJudgeInput {
  return {
    membershipId: 'tmem_a',
    displayName: 'Hannah Frakes',
    availability: VOLUNTEER_AVAILABILITY.ALL_DAY,
    availabilityNotes: undefined,
    credentials: undefined,
    ...overrides,
  }
}

function rotation(
  overrides: Partial<SchedulingRotationInput> = {},
): SchedulingRotationInput {
  return {
    id: 'rot_1',
    membershipId: 'tmem_a',
    startingHeat: 1,
    startingLane: 1,
    heatsCount: 2,
    laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
    ...overrides,
  }
}

describe('buildSchedulingContext', () => {
  it('returns a context object with heats, judges, rotations, and coverage stats', () => {
    const ctx = buildSchedulingContext({
      heats: [heat({heatNumber: 1}), heat({heatNumber: 2})],
      judges: [judge()],
      rotations: [rotation()],
      eventDefaults: {minHeatBuffer: 1},
    })

    expect(ctx.heats).toHaveLength(2)
    expect(ctx.judges).toHaveLength(1)
    expect(ctx.rotations).toHaveLength(1)
    expect(ctx.coverage.totalSlots).toBe(8) // 2 heats * 4 lanes
    expect(ctx.coverage.coveredSlots).toBe(2) // rotation covers H1L1 + H2L1
    expect(ctx.coverage.gaps).toHaveLength(6)
  })

  it('annotates each judge with their current rotation count', () => {
    const ctx = buildSchedulingContext({
      heats: [heat({heatNumber: 1}), heat({heatNumber: 2})],
      judges: [
        judge({membershipId: 'tmem_a'}),
        judge({membershipId: 'tmem_b'}),
      ],
      rotations: [
        rotation({id: 'rot_1', membershipId: 'tmem_a'}),
        rotation({id: 'rot_2', membershipId: 'tmem_a'}),
      ],
      eventDefaults: {minHeatBuffer: 1},
    })

    const judgeA = ctx.judges.find(j => j.membershipId === 'tmem_a')
    const judgeB = ctx.judges.find(j => j.membershipId === 'tmem_b')
    expect(judgeA?.currentRotationCount).toBe(2)
    expect(judgeB?.currentRotationCount).toBe(0)
  })

  it('respects occupiedLanes when provided so empty lanes do not count as gaps', () => {
    const ctx = buildSchedulingContext({
      heats: [
        heat({
          heatNumber: 1,
          laneCount: 4,
          occupiedLanes: new Set([1, 2]),
        }),
      ],
      judges: [judge()],
      rotations: [],
      eventDefaults: {minHeatBuffer: 1},
    })

    expect(ctx.coverage.totalSlots).toBe(2)
    expect(ctx.coverage.gaps).toHaveLength(2)
  })

  it('passes through eventDefaults so the agent and validators see the same buffer config', () => {
    const ctx = buildSchedulingContext({
      heats: [heat()],
      judges: [],
      rotations: [],
      eventDefaults: {minHeatBuffer: 3},
    })
    expect(ctx.eventDefaults.minHeatBuffer).toBe(3)
  })
})
