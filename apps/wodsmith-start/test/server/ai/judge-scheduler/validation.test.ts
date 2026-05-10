import {describe, expect, it} from 'vitest'
import {validateProposal} from '@/server/ai/judge-scheduler/validation'
import {LANE_SHIFT_PATTERN} from '@/db/schema'
import {VOLUNTEER_AVAILABILITY} from '@/db/schemas/volunteers'
import type {
  ProposedRotation,
  SchedulingContext,
} from '@/server/ai/judge-scheduler/types'

function makeContext(
  overrides: Partial<SchedulingContext> = {},
): SchedulingContext {
  return {
    heats: [
      {
        heatNumber: 1,
        laneCount: 4,
        occupiedLanes: undefined,
        scheduledTime: null,
        durationMinutes: 15,
      },
      {
        heatNumber: 2,
        laneCount: 4,
        occupiedLanes: undefined,
        scheduledTime: null,
        durationMinutes: 15,
      },
      {
        heatNumber: 3,
        laneCount: 4,
        occupiedLanes: undefined,
        scheduledTime: null,
        durationMinutes: 15,
      },
    ],
    judges: [
      {
        membershipId: 'tmem_a',
        displayName: 'Hannah Frakes',
        availability: VOLUNTEER_AVAILABILITY.ALL_DAY,
        availabilityNotes: undefined,
        credentials: undefined,
        currentRotationCount: 0,
      },
    ],
    rotations: [],
    eventDefaults: {minHeatBuffer: 1},
    coverage: {
      totalSlots: 12,
      coveredSlots: 0,
      coveragePercent: 0,
      gaps: [],
      overlaps: [],
    },
    ...overrides,
  }
}

function makeProposal(
  overrides: Partial<ProposedRotation> = {},
): ProposedRotation {
  return {
    membershipId: 'tmem_a',
    startingHeat: 1,
    startingLane: 1,
    heatsCount: 2,
    laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
    reason: 'Hannah is available all day, covers lane 1.',
    confidence: 'high',
    ...overrides,
  }
}

describe('validateProposal', () => {
  it('accepts a valid proposal', () => {
    const result = validateProposal(makeProposal(), makeContext())
    expect(result.ok).toBe(true)
  })

  it('rejects when the membership is not in the judge roster', () => {
    const result = validateProposal(
      makeProposal({membershipId: 'tmem_unknown'}),
      makeContext(),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.conflict.kind).toBe('unknown_judge')
  })

  it('rejects when the starting heat does not exist', () => {
    const result = validateProposal(
      makeProposal({startingHeat: 99}),
      makeContext(),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.conflict.kind).toBe('invalid_heat')
  })

  it('rejects when the lane number exceeds the heat lane count', () => {
    const result = validateProposal(
      makeProposal({startingLane: 99}),
      makeContext(),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.conflict.kind).toBe('invalid_lane')
  })

  it('rejects when the same judge already has a rotation overlapping the proposal', () => {
    const ctx = makeContext({
      rotations: [
        {
          id: 'rot_existing',
          membershipId: 'tmem_a',
          startingHeat: 1,
          startingLane: 1,
          heatsCount: 1,
          laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
        },
      ],
    })
    const result = validateProposal(
      makeProposal({startingHeat: 1, startingLane: 1, heatsCount: 1}),
      ctx,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.conflict.kind).toBe('double_booking')
  })

  it('rejects when buffer between same-judge rotations is violated', () => {
    const ctx = makeContext({
      eventDefaults: {minHeatBuffer: 2},
      rotations: [
        {
          id: 'rot_existing',
          membershipId: 'tmem_a',
          startingHeat: 1,
          startingLane: 1,
          heatsCount: 1,
          laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
        },
      ],
    })
    // Existing covers heat 1; with buffer 2, next allowed is heat 4.
    const result = validateProposal(
      makeProposal({
        startingHeat: 2,
        startingLane: 2,
        heatsCount: 1,
      }),
      ctx,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.conflict.kind).toBe('buffer_violation')
  })

  it('does not block when judge availability mismatches the heat time bucket (soft constraint)', () => {
    const ctx = makeContext({
      judges: [
        {
          membershipId: 'tmem_a',
          displayName: 'Hannah Frakes',
          availability: VOLUNTEER_AVAILABILITY.MORNING,
          availabilityNotes: undefined,
          credentials: undefined,
          currentRotationCount: 0,
        },
      ],
      heats: [
        {
          heatNumber: 1,
          laneCount: 4,
          occupiedLanes: undefined,
          scheduledTime: new Date('2025-01-01T20:00:00Z'),
          durationMinutes: 15,
        },
      ],
    })
    const result = validateProposal(makeProposal({heatsCount: 1}), ctx)
    expect(result.ok).toBe(true)
  })
})
