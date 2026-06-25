/**
 * Pure helpers used by the judge-scheduling agent's tools.
 *
 * These functions never touch the database directly. The Agent class composes
 * them with DB-backed loaders to form the final tool implementations passed
 * to the AI SDK. Keeping them pure makes them straightforward to TDD.
 */

import type { CompetitionJudgeRotation, LaneShiftPattern } from "@/db/schema"
import { LANE_SHIFT_PATTERN } from "@/db/schemas/volunteers"
import { VOLUNTEER_AVAILABILITY } from "@/db/schemas/volunteers"
import { calculateCoverage, type HeatInfo } from "@/lib/judge-rotation-utils"
import type {
  CoverageReport,
  EventContextDto,
  JudgeRosterEntry,
  ProposedRotation,
} from "./schemas"

const NOTES_MAX = 280
const MORNING_CUTOFF_HOUR_UTC = 12

interface ValidateProposalArgs {
  proposal: ProposedRotation
  context: EventContextDto
  roster: JudgeRosterEntry[]
  /**
   * Other proposals already accepted in this run, used to detect
   * minHeatBuffer conflicts (a judge being assigned a second rotation
   * within `minHeatBuffer` heats of one of their existing ones).
   */
  existingProposals?: ProposedRotation[]
}

interface ValidationResult {
  violations: string[]
}

/**
 * Check a single proposed rotation against hard slot constraints and the
 * judge's stated availability. Returns soft-violation strings — they don't
 * block the proposal, but the agent should mention them in `softViolations`.
 */
export function validateProposal({
  proposal,
  context,
  roster,
  existingProposals = [],
}: ValidateProposalArgs): ValidationResult {
  const violations: string[] = []

  const judge = roster.find((j) => j.membershipId === proposal.membershipId)
  if (!judge) {
    violations.push(
      `Unknown membershipId: ${proposal.membershipId} is not in the judge roster.`,
    )
  }

  const lastHeat = proposal.startingHeat + proposal.heatsCount - 1
  if (lastHeat > context.totalHeats) {
    violations.push(
      `Rotation runs past the last heat (ends at heat ${lastHeat}, only ${context.totalHeats} heats exist).`,
    )
  }

  // Validate each (heat, lane) slot the rotation covers — not just the
  // starting lane against every heat. With laneShiftPattern="shift_right"
  // the judge moves to the next lane on each successive heat, so the
  // lane to check changes per heat.
  const heatsInRotation = context.heats.filter(
    (h) => h.heatNumber >= proposal.startingHeat && h.heatNumber <= lastHeat,
  )
  for (const heat of heatsInRotation) {
    const offset = heat.heatNumber - proposal.startingHeat
    const lane =
      proposal.laneShiftPattern === LANE_SHIFT_PATTERN.SHIFT_RIGHT
        ? ((proposal.startingLane - 1 + offset) % Math.max(heat.laneCount, 1)) +
          1
        : proposal.startingLane
    // Coverage math (computeCoverageFromProposals → calculateCoverage)
    // treats occupiedLanes as the source of truth when populated, falling
    // back to laneCount otherwise. Mirror that so the agent can fill any
    // slot coverage reports as a gap and can't propose one it doesn't track.
    if (heat.occupiedLanes.length > 0) {
      if (!heat.occupiedLanes.includes(lane)) {
        violations.push(
          `Starting lane ${proposal.startingLane} lands on lane ${lane} in heat ${heat.heatNumber}, which has no athlete (occupied: ${heat.occupiedLanes.join(", ")}).`,
        )
        break
      }
    } else if (lane > heat.laneCount) {
      violations.push(
        `Starting lane ${proposal.startingLane} lands on lane ${lane} in heat ${heat.heatNumber}, which only has ${heat.laneCount} lanes.`,
      )
      break
    }
  }

  if (
    judge?.availability &&
    judge.availability !== VOLUNTEER_AVAILABILITY.ALL_DAY
  ) {
    const judgePartOfDay = judge.availability
    const heatsInRotation = context.heats.filter(
      (h) => h.heatNumber >= proposal.startingHeat && h.heatNumber <= lastHeat,
    )
    const conflictingHeats = heatsInRotation.filter((h) => {
      if (!h.startTime) return false
      const heatPartOfDay = inferPartOfDay(h.startTime)
      return heatPartOfDay !== null && heatPartOfDay !== judgePartOfDay
    })
    if (conflictingHeats.length > 0) {
      const heatList = conflictingHeats
        .map((h) => `H${h.heatNumber}`)
        .join(", ")
      violations.push(
        `${judge.name} prefers ${judgePartOfDay} but rotation includes ${heatList}.`,
      )
    }
  }

  // Same-judge conflicts:
  //   - Overlapping heat ranges → always flagged as a soft conflict
  //   - Within minHeatBuffer (no rest) → flagged when minHeatBuffer > 0
  // Pre-existing DB rotations are out of scope here (the manual editor
  // enforces those visually).
  const judgeProposals = existingProposals.filter(
    (p) =>
      p.membershipId === proposal.membershipId &&
      p.proposalId !== proposal.proposalId,
  )
  for (const other of judgeProposals) {
    const otherLast = other.startingHeat + other.heatsCount - 1
    const judgeName = judge?.name ?? proposal.membershipId
    // Gap = number of heats strictly between the two rotations.
    // Adjacent (e.g. H1-H3 and H4-H6) → gap 0. Overlap → gap = -1.
    let gap: number
    if (proposal.startingHeat > otherLast) {
      gap = proposal.startingHeat - otherLast - 1
    } else if (other.startingHeat > lastHeat) {
      gap = other.startingHeat - lastHeat - 1
    } else {
      gap = -1
    }
    if (gap < 0) {
      violations.push(
        `${judgeName} is also scheduled at H${other.startingHeat}-${otherLast}, which overlaps this rotation.`,
      )
      continue
    }
    if (context.minHeatBuffer > 0 && gap < context.minHeatBuffer) {
      violations.push(
        `${judgeName} has another rotation at H${other.startingHeat}-${otherLast}; only ${gap} heat${gap === 1 ? "" : "s"} of rest (minHeatBuffer is ${context.minHeatBuffer}).`,
      )
    }
  }

  return { violations }
}

function inferPartOfDay(isoTime: string): "morning" | "afternoon" | null {
  const date = new Date(isoTime)
  if (Number.isNaN(date.getTime())) return null
  return date.getUTCHours() < MORNING_CUTOFF_HOUR_UTC ? "morning" : "afternoon"
}

/**
 * Build a coverage report from the agent's current proposal set.
 * Wraps the existing calculateCoverage utility so coverage math stays in one place.
 */
export function computeCoverageFromProposals(
  proposals: ProposedRotation[],
  context: EventContextDto,
): CoverageReport {
  const heats: HeatInfo[] = context.heats.map((h) => ({
    heatNumber: h.heatNumber,
    laneCount: h.laneCount,
    occupiedLanes:
      h.occupiedLanes.length > 0 ? new Set(h.occupiedLanes) : undefined,
  }))

  const syntheticRotations = proposals.map(
    (p) =>
      ({
        id: p.proposalId,
        competitionId: context.competitionId,
        trackWorkoutId: context.trackWorkoutId,
        membershipId: p.membershipId,
        invitationId: null,
        startingHeat: p.startingHeat,
        startingLane: p.startingLane,
        heatsCount: p.heatsCount,
        laneShiftPattern: p.laneShiftPattern as LaneShiftPattern,
        notes: null,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        updateCounter: 0,
      }) satisfies CompetitionJudgeRotation,
  )

  const coverage = calculateCoverage(syntheticRotations, heats)

  return {
    totalSlots: coverage.totalSlots,
    coveredSlots: coverage.coveredSlots,
    coveragePercent: coverage.coveragePercent,
    gaps: coverage.gaps.map((g) => ({
      heatNumber: g.heatNumber,
      laneNumber: g.laneNumber,
    })),
    overlaps: coverage.overlaps.map((o) => ({
      heatNumber: o.heatNumber,
      laneNumber: o.laneNumber,
      proposalIds: o.judges.map((j) => j.rotationId),
    })),
  }
}

interface ProposalsToInsertsArgs {
  proposals: ProposedRotation[]
  competitionId: string
  trackWorkoutId: string
}

export interface RotationInsertPayload {
  competitionId: string
  trackWorkoutId: string
  membershipId: string
  startingHeat: number
  startingLane: number
  heatsCount: number
  laneShiftPattern: LaneShiftPattern
  notes: string | null
}

/**
 * Convert accepted proposals into insert payloads for competition_judge_rotations.
 * The rationale becomes the rotation's notes (truncated to fit the column).
 */
export function proposalsToRotationInserts({
  proposals,
  competitionId,
  trackWorkoutId,
}: ProposalsToInsertsArgs): RotationInsertPayload[] {
  return proposals.map((p) => ({
    competitionId,
    trackWorkoutId,
    membershipId: p.membershipId,
    startingHeat: p.startingHeat,
    startingLane: p.startingLane,
    heatsCount: p.heatsCount,
    laneShiftPattern: p.laneShiftPattern as LaneShiftPattern,
    notes: truncate(p.rationale, NOTES_MAX),
  }))
}

function truncate(input: string, max: number): string {
  if (input.length <= max) return input
  return `${input.slice(0, max - 1)}…`
}
