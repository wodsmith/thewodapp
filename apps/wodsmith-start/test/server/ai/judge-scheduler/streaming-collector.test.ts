import {describe, expect, it, vi} from 'vitest'
import {BroadcastingProposalCollector} from '@/server/ai/judge-scheduler/streaming-collector'
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
      {
        heatNumber: 2,
        laneCount: 2,
        occupiedLanes: undefined,
        scheduledTime: null,
        durationMinutes: 15,
      },
    ],
    judges: [
      {
        membershipId: 'tmem_a',
        displayName: 'Hannah',
        availability: VOLUNTEER_AVAILABILITY.ALL_DAY,
        availabilityNotes: undefined,
        credentials: undefined,
        currentRotationCount: 0,
      },
    ],
    rotations: [],
    eventDefaults: {minHeatBuffer: 1},
    coverage: {
      totalSlots: 4,
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
    reason: 'covers L1',
    confidence: 'high',
    ...over,
  }
}

describe('BroadcastingProposalCollector', () => {
  it('emits a "proposal" event when a proposal is accepted', () => {
    const onEvent = vi.fn()
    const collector = new BroadcastingProposalCollector(ctx(), onEvent)

    const result = collector.propose(proposal())

    expect(result.accepted).toBe(true)
    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith({
      type: 'proposal',
      data: expect.objectContaining({
        proposalId: expect.any(String),
        proposal: expect.objectContaining({membershipId: 'tmem_a'}),
      }),
    })
  })

  it('emits a "conflict" event when a proposal is rejected', () => {
    const onEvent = vi.fn()
    const collector = new BroadcastingProposalCollector(ctx(), onEvent)

    const result = collector.propose(proposal({startingLane: 99}))

    expect(result.accepted).toBe(false)
    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith({
      type: 'conflict',
      data: expect.objectContaining({
        proposal: expect.any(Object),
        conflict: expect.objectContaining({kind: 'invalid_lane'}),
      }),
    })
  })

  it('still inherits collection state so list() reflects accepted proposals', () => {
    const onEvent = vi.fn()
    const collector = new BroadcastingProposalCollector(ctx(), onEvent)

    collector.propose(proposal())
    collector.propose(proposal({startingHeat: 2}))

    expect(collector.list()).toHaveLength(2)
  })
})
