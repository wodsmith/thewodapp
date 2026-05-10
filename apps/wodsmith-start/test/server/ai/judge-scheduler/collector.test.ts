import {describe, expect, it} from 'vitest'
import {ProposalCollector} from '@/server/ai/judge-scheduler/collector'
import {LANE_SHIFT_PATTERN} from '@/db/schema'
import {VOLUNTEER_AVAILABILITY} from '@/db/schemas/volunteers'
import type {
  ProposedRotation,
  SchedulingContext,
} from '@/server/ai/judge-scheduler/types'

function ctx(): SchedulingContext {
  return {
    heats: [
      {
        heatNumber: 1,
        laneCount: 2,
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
      totalSlots: 2,
      coveredSlots: 0,
      coveragePercent: 0,
      gaps: [],
      overlaps: [],
    },
  }
}

function proposal(over: Partial<ProposedRotation> = {}): ProposedRotation {
  return {
    membershipId: 'tmem_a',
    startingHeat: 1,
    startingLane: 1,
    heatsCount: 1,
    laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
    reason: 'covers lane 1',
    confidence: 'high',
    ...over,
  }
}

describe('ProposalCollector', () => {
  it('accepts and stores a valid proposal with a stable id', () => {
    const collector = new ProposalCollector(ctx())
    const result = collector.propose(proposal())
    expect(result.accepted).toBe(true)
    if (!result.accepted) return
    expect(result.proposalId).toBeTruthy()
    expect(collector.list()).toHaveLength(1)
  })

  it('rejects an invalid proposal and does not store it', () => {
    const collector = new ProposalCollector(ctx())
    const result = collector.propose(proposal({startingLane: 99}))
    expect(result.accepted).toBe(false)
    if (result.accepted) return
    expect(result.conflict.kind).toBe('invalid_lane')
    expect(collector.list()).toHaveLength(0)
  })

  it('treats accepted proposals as if they were rotations for subsequent validation', () => {
    const collector = new ProposalCollector(ctx())
    collector.propose(proposal({startingHeat: 1, startingLane: 1}))
    // Same judge, same slot — should now be a double booking.
    const second = collector.propose(proposal({startingHeat: 1, startingLane: 1}))
    expect(second.accepted).toBe(false)
    if (second.accepted) return
    expect(second.conflict.kind).toBe('double_booking')
  })
})
