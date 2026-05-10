import {validateProposal} from "./validation"
import type {
  ProposalResult,
  ProposedRotation,
  SchedulingContext,
} from "./types"

interface StoredProposal {
  proposalId: string
  proposal: ProposedRotation
}

export class ProposalCollector {
  private readonly proposals: StoredProposal[] = []
  private readonly context: SchedulingContext
  private nextId = 1

  constructor(initialContext: SchedulingContext) {
    this.context = {
      ...initialContext,
      rotations: [...initialContext.rotations],
    }
  }

  propose(proposal: ProposedRotation): ProposalResult {
    const result = validateProposal(proposal, this.context)
    if (!result.ok) {
      return {accepted: false, conflict: result.conflict}
    }
    const proposalId = `prop_${this.nextId++}`
    this.proposals.push({proposalId, proposal})
    this.context.rotations.push({
      id: proposalId,
      membershipId: proposal.membershipId,
      startingHeat: proposal.startingHeat,
      startingLane: proposal.startingLane,
      heatsCount: proposal.heatsCount,
      laneShiftPattern: proposal.laneShiftPattern,
    })
    return {accepted: true, proposalId}
  }

  list(): StoredProposal[] {
    return [...this.proposals]
  }
}
