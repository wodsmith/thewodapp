import {describe, expect, it} from 'vitest'
import {
  agentStateSchema,
  initialAgentState,
  markCompleteInputSchema,
  proposeRotationInputSchema,
  revokeProposalInputSchema,
  startSchedulingInputSchema,
} from '@/lib/judge-scheduler/schemas'

describe('proposeRotationInputSchema', () => {
  const validProposal = {
    proposalId: 'prop_001',
    membershipId: 'mem_abc',
    startingHeat: 1,
    startingLane: 2,
    heatsCount: 4,
    laneShiftPattern: 'shift_right' as const,
    confidence: 'high' as const,
    rationale: 'Judge prefers morning heats; this fills lanes 2-5 across H1-H4.',
    softViolations: [],
  }

  it('accepts a well-formed proposal', () => {
    expect(() => proposeRotationInputSchema.parse(validProposal)).not.toThrow()
  })

  it('rejects negative heat numbers', () => {
    expect(() =>
      proposeRotationInputSchema.parse({...validProposal, startingHeat: 0}),
    ).toThrow()
  })

  it('rejects unknown lane shift patterns', () => {
    expect(() =>
      proposeRotationInputSchema.parse({
        ...validProposal,
        laneShiftPattern: 'spiral',
      }),
    ).toThrow()
  })

  it('caps softViolations at 10 entries', () => {
    expect(() =>
      proposeRotationInputSchema.parse({
        ...validProposal,
        softViolations: Array.from({length: 11}, () => 'violation'),
      }),
    ).toThrow()
  })

  it('caps rationale length to keep prompts compact', () => {
    expect(() =>
      proposeRotationInputSchema.parse({
        ...validProposal,
        rationale: 'x'.repeat(281),
      }),
    ).toThrow()
  })
})

describe('revokeProposalInputSchema', () => {
  it('requires both proposalId and reason', () => {
    expect(() =>
      revokeProposalInputSchema.parse({proposalId: 'p1', reason: 'overlap'}),
    ).not.toThrow()
    expect(() =>
      revokeProposalInputSchema.parse({proposalId: 'p1'}),
    ).toThrow()
    expect(() =>
      revokeProposalInputSchema.parse({proposalId: 'p1', reason: ''}),
    ).toThrow()
  })
})

describe('markCompleteInputSchema', () => {
  it('rejects empty summaries', () => {
    expect(() => markCompleteInputSchema.parse({summary: ''})).toThrow()
  })

  it('rejects oversized summaries', () => {
    expect(() =>
      markCompleteInputSchema.parse({summary: 'x'.repeat(601)}),
    ).toThrow()
  })
})

describe('startSchedulingInputSchema', () => {
  it('defaults reset to true', () => {
    const result = startSchedulingInputSchema.parse({
      trackWorkoutId: 'tw_1',
      competitionId: 'comp_1',
    })
    expect(result.reset).toBe(true)
  })
})

describe('agentStateSchema', () => {
  it('parses the initial state', () => {
    expect(() => agentStateSchema.parse(initialAgentState)).not.toThrow()
  })

  it('rejects an unknown status', () => {
    expect(() =>
      agentStateSchema.parse({...initialAgentState, status: 'cancelled'}),
    ).toThrow()
  })
})
