// @lat: [[crew#Judge Rotations]]
import type {
  LaneShiftPattern,
  VolunteerRoleType,
} from "@/db/schemas/volunteers"
import {
  LANE_SHIFT_PATTERN,
  VOLUNTEER_ROLE_TYPES,
} from "@/db/schemas/volunteers"

/**
 * Whether a volunteer's role types make them eligible to staff the judge grid.
 * Judge / Head Judge are obviously eligible, and — mirroring how General acts
 * as a wildcard for shift assignment ({@link isVolunteerCompatibleWithShift}) —
 * General volunteers are eligible too. Organizers routinely import a batch of
 * General volunteers intending to seat them as judges, so excluding General
 * would leave the roster empty after a bulk import.
 */
export function isCrewJudgeEligible(roleTypes: VolunteerRoleType[]): boolean {
  return (
    roleTypes.includes(VOLUNTEER_ROLE_TYPES.JUDGE) ||
    roleTypes.includes(VOLUNTEER_ROLE_TYPES.HEAD_JUDGE) ||
    roleTypes.includes(VOLUNTEER_ROLE_TYPES.GENERAL)
  )
}

export interface CrewJudgeRotationHeat {
  heatNumber: number
  laneCount: number
}

export interface CrewJudgeRotationDraft {
  id?: string
  membershipId: string
  startingHeat: number
  startingLane: number
  heatsCount: number
  laneShiftPattern: LaneShiftPattern
}

export interface CrewJudgeRotationSlot {
  rotationId: string
  membershipId: string
  heatNumber: number
  laneNumber: number
}

export interface CrewJudgeRotationValidationIssue {
  type:
    | "no_heats"
    | "missing_heat"
    | "invalid_lane"
    | "empty_rotation"
    | "duplicate_judge_heat"
    | "occupied_lane"
  severity: "error" | "warning"
  message: string
  heatNumber?: number
  laneNumber?: number
  rotationId?: string
}

export interface CrewJudgeCoverageSummary {
  totalSlots: number
  coveredSlots: number
  coveragePercent: number
  gaps: Array<{ heatNumber: number; laneNumber: number }>
  overlaps: Array<{
    heatNumber: number
    laneNumber: number
    judges: Array<{ membershipId: string; rotationId: string }>
  }>
}

export function getCrewJudgeRotationLane({
  startingLane,
  heatIndex,
  laneCount,
  laneShiftPattern,
}: {
  startingLane: number
  heatIndex: number
  laneCount: number
  laneShiftPattern: LaneShiftPattern
}) {
  if (laneShiftPattern === LANE_SHIFT_PATTERN.SHIFT_RIGHT) {
    return ((startingLane - 1 + heatIndex) % laneCount) + 1
  }

  return startingLane
}

export function expandCrewJudgeRotationDrafts({
  rotations,
  heats,
}: {
  rotations: CrewJudgeRotationDraft[]
  heats: CrewJudgeRotationHeat[]
}): CrewJudgeRotationSlot[] {
  const heatMap = new Map(heats.map((heat) => [heat.heatNumber, heat]))
  const slots: CrewJudgeRotationSlot[] = []

  rotations.forEach((rotation, index) => {
    const rotationId = rotation.id ?? `draft-${index}`

    for (let heatIndex = 0; heatIndex < rotation.heatsCount; heatIndex++) {
      const heatNumber = rotation.startingHeat + heatIndex
      const heat = heatMap.get(heatNumber)
      if (!heat) continue

      const laneNumber = getCrewJudgeRotationLane({
        startingLane: rotation.startingLane,
        heatIndex,
        laneCount: heat.laneCount,
        laneShiftPattern: rotation.laneShiftPattern,
      })

      if (laneNumber < 1 || laneNumber > heat.laneCount) continue

      slots.push({
        rotationId,
        membershipId: rotation.membershipId,
        heatNumber,
        laneNumber,
      })
    }
  })

  return slots
}

export function validateCrewJudgeRotationDrafts({
  rotations,
  heats,
  occupiedSlots = [],
}: {
  rotations: CrewJudgeRotationDraft[]
  heats: CrewJudgeRotationHeat[]
  occupiedSlots?: CrewJudgeRotationSlot[]
}): CrewJudgeRotationValidationIssue[] {
  const issues: CrewJudgeRotationValidationIssue[] = []
  const heatMap = new Map(heats.map((heat) => [heat.heatNumber, heat]))
  const seenJudgeHeat = new Map<string, CrewJudgeRotationSlot>()
  const seenLane = new Map<string, CrewJudgeRotationSlot>()

  if (heats.length === 0) {
    return [
      {
        type: "no_heats",
        severity: "error",
        message: "Add heats before creating judge rotations.",
      },
    ]
  }

  for (const occupied of occupiedSlots) {
    seenLane.set(`${occupied.heatNumber}:${occupied.laneNumber}`, occupied)
  }

  rotations.forEach((rotation, index) => {
    const rotationId = rotation.id ?? `draft-${index}`
    let matchedHeats = 0

    for (let heatIndex = 0; heatIndex < rotation.heatsCount; heatIndex++) {
      const heatNumber = rotation.startingHeat + heatIndex
      const heat = heatMap.get(heatNumber)

      if (!heat) {
        issues.push({
          type: "missing_heat",
          severity: "warning",
          message: `Heat ${heatNumber} does not exist and will be skipped.`,
          heatNumber,
          rotationId,
        })
        continue
      }

      matchedHeats++
      const laneNumber = getCrewJudgeRotationLane({
        startingLane: rotation.startingLane,
        heatIndex,
        laneCount: heat.laneCount,
        laneShiftPattern: rotation.laneShiftPattern,
      })

      if (laneNumber < 1 || laneNumber > heat.laneCount) {
        issues.push({
          type: "invalid_lane",
          severity: "error",
          message: `Lane ${laneNumber} is outside heat ${heatNumber}'s ${heat.laneCount} lanes.`,
          heatNumber,
          laneNumber,
          rotationId,
        })
        continue
      }

      const slot: CrewJudgeRotationSlot = {
        rotationId,
        membershipId: rotation.membershipId,
        heatNumber,
        laneNumber,
      }
      const judgeHeatKey = `${slot.membershipId}:${slot.heatNumber}`
      const existingJudgeHeat = seenJudgeHeat.get(judgeHeatKey)
      if (existingJudgeHeat) {
        issues.push({
          type: "duplicate_judge_heat",
          severity: "error",
          message: `Judge already has a rotation on heat ${slot.heatNumber}.`,
          heatNumber: slot.heatNumber,
          laneNumber: slot.laneNumber,
          rotationId,
        })
      }
      seenJudgeHeat.set(judgeHeatKey, slot)

      const laneKey = `${slot.heatNumber}:${slot.laneNumber}`
      const existingLane = seenLane.get(laneKey)
      if (existingLane && existingLane.membershipId !== slot.membershipId) {
        issues.push({
          type: "occupied_lane",
          severity: "error",
          message: `Heat ${slot.heatNumber} lane ${slot.laneNumber} already has a judge rotation.`,
          heatNumber: slot.heatNumber,
          laneNumber: slot.laneNumber,
          rotationId,
        })
      }
      seenLane.set(laneKey, slot)
    }

    if (matchedHeats === 0) {
      issues.push({
        type: "empty_rotation",
        severity: "error",
        message: "Rotation does not match any existing heats.",
        rotationId,
      })
    }
  })

  return issues
}

export function hasCrewJudgeRotationErrors(
  issues: CrewJudgeRotationValidationIssue[],
) {
  return issues.some((issue) => issue.severity === "error")
}

export function getCrewJudgeHeatLaneCount({
  venueLaneCount,
  occupiedLanes = [],
}: {
  venueLaneCount?: number | null
  occupiedLanes?: number[]
}) {
  return Math.max(
    venueLaneCount ?? 10,
    occupiedLanes.length > 0 ? Math.max(...occupiedLanes) : 0,
    1,
  )
}

export function summarizeCrewJudgeCoverage({
  rotations,
  heats,
}: {
  rotations: CrewJudgeRotationDraft[]
  heats: CrewJudgeRotationHeat[]
}): CrewJudgeCoverageSummary {
  const coverage = new Map<string, CrewJudgeRotationSlot[]>()

  for (const heat of heats) {
    for (let laneNumber = 1; laneNumber <= heat.laneCount; laneNumber++) {
      coverage.set(`${heat.heatNumber}:${laneNumber}`, [])
    }
  }

  for (const slot of expandCrewJudgeRotationDrafts({ rotations, heats })) {
    const key = `${slot.heatNumber}:${slot.laneNumber}`
    coverage.set(key, [...(coverage.get(key) ?? []), slot])
  }

  const gaps: CrewJudgeCoverageSummary["gaps"] = []
  const overlaps: CrewJudgeCoverageSummary["overlaps"] = []
  let coveredSlots = 0

  for (const [key, slots] of coverage.entries()) {
    const [heatRaw, laneRaw] = key.split(":")
    const heatNumber = Number(heatRaw)
    const laneNumber = Number(laneRaw)

    if (slots.length === 0) {
      gaps.push({ heatNumber, laneNumber })
      continue
    }

    coveredSlots++
    if (slots.length > 1) {
      overlaps.push({
        heatNumber,
        laneNumber,
        judges: slots.map((slot) => ({
          membershipId: slot.membershipId,
          rotationId: slot.rotationId,
        })),
      })
    }
  }

  const totalSlots = coverage.size
  return {
    totalSlots,
    coveredSlots,
    coveragePercent:
      totalSlots > 0 ? Math.round((coveredSlots / totalSlots) * 100) : 0,
    gaps,
    overlaps,
  }
}
