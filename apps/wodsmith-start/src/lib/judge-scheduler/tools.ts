/**
 * Pure helpers used by the judge-scheduling agent's tools.
 *
 * These functions never touch the database directly. The Agent class composes
 * them with DB-backed loaders to form the final tool implementations passed
 * to the AI SDK. Keeping them pure makes them straightforward to TDD.
 */

import type { CompetitionJudgeRotation, LaneShiftPattern } from "@/db/schema"
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

  for (const heat of context.heats) {
    if (
      heat.heatNumber >= proposal.startingHeat &&
      heat.heatNumber <= lastHeat &&
      proposal.startingLane > heat.laneCount
    ) {
      violations.push(
        `Starting lane ${proposal.startingLane} exceeds heat ${heat.heatNumber}'s lane count (${heat.laneCount}).`,
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
