import { LANE_SHIFT_PATTERN } from "@/db/schemas/volunteers"
import {
  type CrewJudgeRotationDraft,
  expandCrewJudgeRotationDrafts,
} from "@/lib/crew/judge-rotations"
import type {
  CrewJudgeHeat,
  CrewJudgeRotationsPageData,
  CrewJudgeVolunteer,
} from "@/server-fns/crew-judge-rotations-fns"

/**
 * A single judge-grid cell: one judge occupying one heat + lane. The
 * wodsmith-start judging grid assigns judges directly to heat lanes; Crew
 * persists per-volunteer rotation rows. We bridge the two by treating every
 * cell as a one-heat rotation (heatsCount = 1, pattern = stay), so the grid
 * UX matches wodsmith-start while saving/publishing through Crew's existing
 * rotation + version data layer.
 */
export interface JudgeGridCell {
  membershipId: string
  heatNumber: number
  laneNumber: number
}

export type CrewJudgeRotation = CrewJudgeRotationsPageData["rotations"][number]

export function getCrewJudgeName(
  judge: Pick<CrewJudgeVolunteer, "firstName" | "lastName"> & {
    email?: string | null
  } | null | undefined,
): string {
  if (!judge) return "Unknown judge"
  return (
    [judge.firstName, judge.lastName].filter(Boolean).join(" ") ||
    judge.email ||
    "Unknown judge"
  )
}

function toRotationDraft(rotation: CrewJudgeRotation): CrewJudgeRotationDraft {
  return {
    id: rotation.id,
    // A rotation references either a membership (account-backed judge) or an
    // invitation (imported / manual judge). The grid keys cells off this
    // canonical assignee id, matching CrewJudgeVolunteer.membershipId.
    membershipId: rotation.membershipId ?? rotation.invitationId ?? "",
    startingHeat: rotation.startingHeat,
    startingLane: rotation.startingLane,
    heatsCount: rotation.heatsCount,
    laneShiftPattern: rotation.laneShiftPattern,
  }
}

/**
 * Expand the saved rotations for a workout into individual judge-grid cells
 * (one per heat + lane), respecting each rotation's lane-shift pattern.
 */
export function rotationsToGridCells(
  rotations: CrewJudgeRotation[],
  heats: CrewJudgeHeat[],
): JudgeGridCell[] {
  return expandCrewJudgeRotationDrafts({
    heats: heats.map((heat) => ({
      heatNumber: heat.heatNumber,
      laneCount: heat.laneCount,
    })),
    rotations: rotations.map(toRotationDraft),
  }).map((slot) => ({
    membershipId: slot.membershipId,
    heatNumber: slot.heatNumber,
    laneNumber: slot.laneNumber,
  }))
}

/**
 * Convert a judge's grid cells back into the per-cell rotation rows expected
 * by saveCrewJudgeRotationsForVolunteerFn. Every cell becomes a one-heat
 * rotation so the grid can express arbitrary heat/lane placements.
 */
export function gridCellsToRotationRows(
  cells: JudgeGridCell[],
): Array<{
  startingHeat: number
  startingLane: number
  heatsCount: number
  notes?: string | null
}> {
  return cells
    .slice()
    .sort((a, b) => a.heatNumber - b.heatNumber || a.laneNumber - b.laneNumber)
    .map((cell) => ({
      startingHeat: cell.heatNumber,
      startingLane: cell.laneNumber,
      heatsCount: 1,
      notes: null,
    }))
}

/**
 * Lane-shift pattern always saved for grid-authored rotations. Each grid cell
 * is a single heat, so the pattern is irrelevant for materialization, but the
 * save fn requires a value — "stay" keeps the saved lane exactly as placed.
 */
export const JUDGE_GRID_LANE_SHIFT_PATTERN = LANE_SHIFT_PATTERN.STAY

export interface JudgeGridFillResult {
  /** The full next cell set after the fill. */
  cells: JudgeGridCell[]
  /** Membership IDs whose cell set changed (those needing a re-save). */
  touched: string[]
}

/**
 * Seat available judges into a single heat's open lanes. Judges already placed
 * in this heat keep their lane; remaining open lanes are filled from
 * `judgeOrder` (least-assigned first) skipping judges already in the heat.
 */
export function fillHeatWithAvailableJudges({
  cells,
  heat,
  judgeOrder,
}: {
  cells: JudgeGridCell[]
  heat: CrewJudgeHeat
  judgeOrder: string[]
}): JudgeGridFillResult {
  const occupiedLanes = new Set(
    cells
      .filter((cell) => cell.heatNumber === heat.heatNumber)
      .map((cell) => cell.laneNumber),
  )
  const judgesInHeat = new Set(
    cells
      .filter((cell) => cell.heatNumber === heat.heatNumber)
      .map((cell) => cell.membershipId),
  )
  const openLanes = Array.from(
    { length: heat.laneCount },
    (_, i) => i + 1,
  ).filter((lane) => !occupiedLanes.has(lane))
  const candidates = judgeOrder.filter((id) => !judgesInHeat.has(id))

  const next = cells.slice()
  const touched: string[] = []
  for (let i = 0; i < openLanes.length && i < candidates.length; i++) {
    const membershipId = candidates[i]
    const laneNumber = openLanes[i]
    if (!membershipId || laneNumber === undefined) continue
    next.push({ membershipId, heatNumber: heat.heatNumber, laneNumber })
    touched.push(membershipId)
  }

  return { cells: next, touched }
}

/**
 * Auto-distribute available judges across every open lane of a workout's heats.
 * Judges are seated heat-by-heat from `judgeOrder`, rotating the start index so
 * the same few judges don't always land in the first lanes. Existing
 * placements are preserved.
 */
export function autoFillWorkout({
  cells,
  heats,
  judgeOrder,
}: {
  cells: JudgeGridCell[]
  heats: CrewJudgeHeat[]
  judgeOrder: string[]
}): JudgeGridFillResult {
  let next = cells.slice()
  const touched: string[] = []
  const sortedHeats = heats
    .slice()
    .sort((a, b) => a.heatNumber - b.heatNumber)

  sortedHeats.forEach((heat, heatIndex) => {
    const occupiedLanes = new Set(
      next
        .filter((cell) => cell.heatNumber === heat.heatNumber)
        .map((cell) => cell.laneNumber),
    )
    const judgesInHeat = new Set(
      next
        .filter((cell) => cell.heatNumber === heat.heatNumber)
        .map((cell) => cell.membershipId),
    )
    const openLanes = Array.from(
      { length: heat.laneCount },
      (_, i) => i + 1,
    ).filter((lane) => !occupiedLanes.has(lane))
    if (openLanes.length === 0) return

    // Rotate candidate order per heat so coverage spreads across judges.
    const rotated =
      judgeOrder.length > 0
        ? [
            ...judgeOrder.slice(heatIndex % judgeOrder.length),
            ...judgeOrder.slice(0, heatIndex % judgeOrder.length),
          ]
        : []
    const candidates = rotated.filter((id) => !judgesInHeat.has(id))

    for (let i = 0; i < openLanes.length && i < candidates.length; i++) {
      const membershipId = candidates[i]
      const laneNumber = openLanes[i]
      if (!membershipId || laneNumber === undefined) continue
      next = next.concat({
        membershipId,
        heatNumber: heat.heatNumber,
        laneNumber,
      })
      touched.push(membershipId)
    }
  })

  return { cells: next, touched: Array.from(new Set(touched)) }
}
