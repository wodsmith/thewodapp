import {describe, expect, it} from 'vitest'
import {LANE_SHIFT_PATTERN} from '@/db/schema'
import {VOLUNTEER_AVAILABILITY} from '@/db/schemas/volunteers'
import {
  computeCoverageFromProposals,
  proposalsToRotationInserts,
  validateProposal,
} from '@/lib/judge-scheduler/tools'
import type {
  EventContextDto,
  JudgeRosterEntry,
  ProposedRotation,
} from '@/lib/judge-scheduler/schemas'

function makeContext(
  overrides: Partial<EventContextDto> = {},
): EventContextDto {
  return {
    trackWorkoutId: 'tw_1',
    workoutName: 'Down On The Ground',
    competitionId: 'comp_1',
    totalHeats: 6,
    defaultHeatsPerRotation: 4,
    defaultLaneShiftPattern: LANE_SHIFT_PATTERN.STAY,
    minHeatBuffer: 2,
    heats: Array.from({length: 6}, (_, i) => ({
      heatNumber: i + 1,
      laneCount: 5,
      startTime: null,
      occupiedLanes: [],
    })),
    existingRotations: [],
    ...overrides,
  }
}

function makeJudge(overrides: Partial<JudgeRosterEntry> = {}): JudgeRosterEntry {
  return {
    membershipId: 'mem_1',
    name: 'Test Judge',
    availability: VOLUNTEER_AVAILABILITY.ALL_DAY,
    availabilityNotes: null,
    credentials: null,
    currentRotationCount: 0,
    ...overrides,
  }
}

function makeProposal(
  overrides: Partial<ProposedRotation> = {},
): ProposedRotation {
  return {
    proposalId: 'prop_1',
    membershipId: 'mem_1',
    startingHeat: 1,
    startingLane: 1,
    heatsCount: 4,
    laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
    confidence: 'high',
    rationale: 'Default coverage block',
    softViolations: [],
    ...overrides,
  }
}

describe('validateProposal', () => {
  it('returns no violations when judge is all_day and slot fits', () => {
    const result = validateProposal({
      proposal: makeProposal(),
      context: makeContext(),
      roster: [makeJudge()],
    })
    expect(result.violations).toEqual([])
  })

  it('flags morning judge proposed for late heats', () => {
    const ctx = makeContext({
      heats: [
        {heatNumber: 1, laneCount: 5, startTime: '2025-06-01T08:00:00Z', occupiedLanes: []},
        {heatNumber: 2, laneCount: 5, startTime: '2025-06-01T08:30:00Z', occupiedLanes: []},
        {heatNumber: 3, laneCount: 5, startTime: '2025-06-01T13:00:00Z', occupiedLanes: []},
        {heatNumber: 4, laneCount: 5, startTime: '2025-06-01T13:30:00Z', occupiedLanes: []},
      ],
      totalHeats: 4,
    })
    const morningJudge = makeJudge({
      availability: VOLUNTEER_AVAILABILITY.MORNING,
    })
    const proposal = makeProposal({
      startingHeat: 1,
      heatsCount: 4,
    })
    const result = validateProposal({
      proposal,
      context: ctx,
      roster: [morningJudge],
    })
    expect(result.violations.length).toBeGreaterThan(0)
    expect(result.violations.join(' ').toLowerCase()).toContain('morning')
  })

  it('flags rotation that runs past the last heat', () => {
    const result = validateProposal({
      proposal: makeProposal({startingHeat: 5, heatsCount: 4}),
      context: makeContext({totalHeats: 6}),
      roster: [makeJudge()],
    })
    expect(result.violations.some((v) => v.includes('past the last heat'))).toBe(
      true,
    )
  })

  it('flags lane out of range', () => {
    const result = validateProposal({
      proposal: makeProposal({startingLane: 7}),
      context: makeContext(),
      roster: [makeJudge()],
    })
    expect(result.violations.some((v) => v.includes('lane'))).toBe(true)
  })

  it('flags unknown membershipId', () => {
    const result = validateProposal({
      proposal: makeProposal({membershipId: 'mem_bogus'}),
      context: makeContext(),
      roster: [makeJudge()],
    })
    expect(
      result.violations.some((v) => v.toLowerCase().includes('unknown')),
    ).toBe(true)
  })
})

describe('computeCoverageFromProposals', () => {
  it('reports 100% coverage when proposals fill every lane', () => {
    const ctx = makeContext({
      totalHeats: 2,
      heats: [
        {heatNumber: 1, laneCount: 3, startTime: null, occupiedLanes: []},
        {heatNumber: 2, laneCount: 3, startTime: null, occupiedLanes: []},
      ],
    })
    const proposals: ProposedRotation[] = [
      makeProposal({proposalId: 'p1', startingLane: 1, heatsCount: 2}),
      makeProposal({proposalId: 'p2', startingLane: 2, heatsCount: 2}),
      makeProposal({proposalId: 'p3', startingLane: 3, heatsCount: 2}),
    ]

    const report = computeCoverageFromProposals(proposals, ctx)
    expect(report.totalSlots).toBe(6)
    expect(report.coveredSlots).toBe(6)
    expect(report.coveragePercent).toBe(100)
    expect(report.gaps).toEqual([])
    expect(report.overlaps).toEqual([])
  })

  it('reports gaps when lanes are uncovered', () => {
    const ctx = makeContext({
      totalHeats: 1,
      heats: [
        {heatNumber: 1, laneCount: 3, startTime: null, occupiedLanes: []},
      ],
    })
    const proposals: ProposedRotation[] = [
      makeProposal({proposalId: 'p1', startingLane: 1, heatsCount: 1}),
    ]

    const report = computeCoverageFromProposals(proposals, ctx)
    expect(report.gaps).toEqual([
      {heatNumber: 1, laneNumber: 2},
      {heatNumber: 1, laneNumber: 3},
    ])
  })

  it('reports overlaps with proposalIds when two judges target the same slot', () => {
    const ctx = makeContext({
      totalHeats: 1,
      heats: [
        {heatNumber: 1, laneCount: 2, startTime: null, occupiedLanes: []},
      ],
    })
    const proposals: ProposedRotation[] = [
      makeProposal({proposalId: 'p1', membershipId: 'mem_1', startingLane: 1, heatsCount: 1}),
      makeProposal({proposalId: 'p2', membershipId: 'mem_2', startingLane: 1, heatsCount: 1}),
      makeProposal({proposalId: 'p3', membershipId: 'mem_3', startingLane: 2, heatsCount: 1}),
    ]

    const report = computeCoverageFromProposals(proposals, ctx)
    expect(report.overlaps).toHaveLength(1)
    expect(report.overlaps[0]?.heatNumber).toBe(1)
    expect(report.overlaps[0]?.laneNumber).toBe(1)
    expect(report.overlaps[0]?.proposalIds.sort()).toEqual(['p1', 'p2'])
  })

  it('only counts occupied lanes when present (matches calculateCoverage semantics)', () => {
    const ctx = makeContext({
      totalHeats: 1,
      heats: [
        {heatNumber: 1, laneCount: 5, startTime: null, occupiedLanes: [1, 2, 3]},
      ],
    })
    const report = computeCoverageFromProposals([], ctx)
    expect(report.totalSlots).toBe(3)
  })
})

describe('proposalsToRotationInserts', () => {
  it('maps an accepted proposal to a rotation insert payload', () => {
    const proposal = makeProposal({
      proposalId: 'prop_xyz',
      membershipId: 'mem_42',
      startingHeat: 2,
      startingLane: 3,
      heatsCount: 4,
      laneShiftPattern: LANE_SHIFT_PATTERN.SHIFT_RIGHT,
      rationale: 'AI: morning judge, lane 3 onward',
    })

    const inserts = proposalsToRotationInserts({
      proposals: [proposal],
      competitionId: 'comp_99',
      trackWorkoutId: 'tw_77',
    })

    expect(inserts).toEqual([
      {
        competitionId: 'comp_99',
        trackWorkoutId: 'tw_77',
        membershipId: 'mem_42',
        startingHeat: 2,
        startingLane: 3,
        heatsCount: 4,
        laneShiftPattern: LANE_SHIFT_PATTERN.SHIFT_RIGHT,
        notes: 'AI: morning judge, lane 3 onward',
      },
    ])
  })

  it('truncates long rationales when stuffing them into notes', () => {
    const longRationale = 'x'.repeat(500)
    const inserts = proposalsToRotationInserts({
      proposals: [makeProposal({rationale: longRationale})],
      competitionId: 'comp_1',
      trackWorkoutId: 'tw_1',
    })
    expect(inserts[0]?.notes?.length ?? 0).toBeLessThanOrEqual(280)
  })
})
