import {
  expandRotationToAssignments,
  type HeatInfo,
  type RotationLike,
} from "@/lib/judge-rotation-utils"
import type {
  ProposedRotation,
  SchedulingContext,
  SchedulingHeatInput,
  ValidationResult,
} from "./types"

const PROPOSAL_PSEUDO_ID = "__proposal__"

export function validateProposal(
  proposal: ProposedRotation,
  context: SchedulingContext,
): ValidationResult {
  const judge = context.judges.find(
    (j) => j.membershipId === proposal.membershipId,
  )
  if (!judge) {
    return {
      ok: false,
      conflict: {
        kind: "unknown_judge",
        membershipId: proposal.membershipId,
        message: `Judge ${proposal.membershipId} is not in the roster.`,
      },
    }
  }

  const startingHeat = context.heats.find(
    (h) => h.heatNumber === proposal.startingHeat,
  )
  if (!startingHeat) {
    return {
      ok: false,
      conflict: {
        kind: "invalid_heat",
        heatNumber: proposal.startingHeat,
        message: `Heat ${proposal.startingHeat} does not exist for this event.`,
      },
    }
  }

  // Lane validation must run before expansion: expandRotationToAssignments
  // silently drops slots whose lane is out of range, which would otherwise be
  // misreported as "no covered heats" downstream.
  if (proposal.startingLane < 1 || proposal.startingLane > startingHeat.laneCount) {
    return {
      ok: false,
      conflict: {
        kind: "invalid_lane",
        laneNumber: proposal.startingLane,
        message: `Lane ${proposal.startingLane} is out of range for heat ${proposal.startingHeat} (1..${startingHeat.laneCount}).`,
      },
    }
  }

  const heatInfos = context.heats.map(toHeatInfo)
  const proposedSlots = expandRotationToAssignments(
    toRotationLike(proposal),
    heatInfos,
  )

  if (proposedSlots.length === 0) {
    return {
      ok: false,
      conflict: {
        kind: "invalid_heat",
        heatNumber: proposal.startingHeat,
        message: `Proposal does not cover any valid heats.`,
      },
    }
  }

  const occupiedSlots = new Map<string, number>()
  for (const rotation of context.rotations) {
    const slots = expandRotationToAssignments(rotation, heatInfos)
    for (const s of slots) {
      const key = `${s.heatNumber}:${s.laneNumber}`
      occupiedSlots.set(key, (occupiedSlots.get(key) ?? 0) + 1)
    }
  }
  for (const slot of proposedSlots) {
    const key = `${slot.heatNumber}:${slot.laneNumber}`
    if ((occupiedSlots.get(key) ?? 0) > 0) {
      return {
        ok: false,
        conflict: {
          kind: "double_booking",
          heatNumber: slot.heatNumber,
          laneNumber: slot.laneNumber,
          message: `Heat ${slot.heatNumber} lane ${slot.laneNumber} is already covered by another judge.`,
        },
      }
    }
  }

  const buffer = context.eventDefaults.minHeatBuffer
  const proposedHeats = proposedSlots.map((s) => s.heatNumber)
  for (const existing of context.rotations) {
    if (existing.membershipId !== proposal.membershipId) continue
    const existingHeats = expandRotationToAssignments(existing, heatInfos).map(
      (s) => s.heatNumber,
    )
    for (const eHeat of existingHeats) {
      for (const pHeat of proposedHeats) {
        if (Math.abs(eHeat - pHeat) < buffer) {
          return {
            ok: false,
            conflict: {
              kind: "buffer_violation",
              conflictingHeat: eHeat,
              message: `Judge ${proposal.membershipId} already covers heat ${eHeat}; minimum buffer of ${buffer} heat(s) violated by proposed heat ${pHeat}.`,
            },
          }
        }
      }
    }
  }

  return {ok: true}
}

function toHeatInfo(heat: SchedulingHeatInput): HeatInfo {
  return {
    heatNumber: heat.heatNumber,
    laneCount: heat.laneCount,
    occupiedLanes: heat.occupiedLanes,
  }
}

function toRotationLike(proposal: ProposedRotation): RotationLike {
  return {
    id: PROPOSAL_PSEUDO_ID,
    membershipId: proposal.membershipId,
    startingHeat: proposal.startingHeat,
    startingLane: proposal.startingLane,
    heatsCount: proposal.heatsCount,
    laneShiftPattern: proposal.laneShiftPattern,
  }
}
