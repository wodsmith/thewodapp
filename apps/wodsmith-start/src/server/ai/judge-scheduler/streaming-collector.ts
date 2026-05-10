import {ProposalCollector} from "./collector"
import type {
  ProposalConflict,
  ProposalResult,
  ProposedRotation,
  SchedulingContext,
} from "./types"

export type StreamEvent =
  | {
      type: "init"
      data: {
        judges: Array<{
          membershipId: string
          displayName: string
          availability?: string
        }>
        coverageBefore: {
          coveragePercent: number
          coveredSlots: number
          totalSlots: number
        }
      }
    }
  | {
      type: "proposal"
      data: {proposalId: string; proposal: ProposedRotation}
    }
  | {
      type: "conflict"
      data: {proposal: ProposedRotation; conflict: ProposalConflict}
    }
  | {
      type: "narrative"
      data: {text: string}
    }
  | {
      type: "done"
      data: {
        proposalCount: number
        coverageBefore: {
          coveragePercent: number
          coveredSlots: number
          totalSlots: number
        }
        coverageAfterIfAllAccepted: {
          coveragePercent: number
          coveredSlots: number
          totalSlots: number
        }
      }
    }
  | {
      type: "error"
      data: {message: string}
    }

export type StreamEventListener = (event: StreamEvent) => void

/**
 * ProposalCollector that publishes a stream event for every proposal — both
 * accepted and rejected — so an SSE / streaming HTTP response can pipe each
 * proposal to the UI as the agent makes them, instead of waiting for the
 * agent to finish.
 *
 * Emits 'proposal' on accept and 'conflict' on reject. The owning route is
 * responsible for emitting the terminal 'done' / 'error' events.
 */
export class BroadcastingProposalCollector extends ProposalCollector {
  constructor(
    initialContext: SchedulingContext,
    private readonly onEvent: StreamEventListener,
  ) {
    super(initialContext)
  }

  override propose(proposal: ProposedRotation): ProposalResult {
    const result = super.propose(proposal)
    if (result.accepted) {
      this.onEvent({
        type: "proposal",
        data: {proposalId: result.proposalId, proposal},
      })
    } else {
      this.onEvent({
        type: "conflict",
        data: {proposal, conflict: result.conflict},
      })
    }
    return result
  }
}
