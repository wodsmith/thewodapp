// @lat: [[crew#Day Of Operations Board]]
import {
  CREW_ASSIGNMENT_CONFIRMATION_TYPE,
  type CrewAssignmentConfirmationType,
} from "../../db/schemas/crew-imports"
import {
  VOLUNTEER_ROLE_LABELS,
  VOLUNTEER_ROLE_TYPES,
  type VolunteerRoleType,
} from "../../db/schemas/volunteers"
import {
  type CrewAssignmentConfirmationOperationalState,
  getCrewAssignmentConfirmationOperationalState,
} from "./assignment-confirmations"
import type {
  CrewStaffingConfirmationGap,
  CrewStaffingCoverageRow,
  CrewStaffingMatrix,
  CrewStaffingMatrixInput,
  CrewStaffingReport,
  CrewStaffingTimeBlock,
} from "./staffing"

export type CrewDayOfBlockTiming =
  | "current"
  | "next"
  | "upcoming"
  | "past"
  | "unscheduled"

export type CrewDayOfBlockStatus = "covered" | "attention" | "critical"

export interface CrewDayOfOperationsBoardInput {
  matrix: CrewStaffingMatrix
  report: CrewStaffingReport
  staffingInput?: CrewStaffingMatrixInput
  now?: Date | string
  responseDueSoonHours?: number
}

export interface CrewDayOfBlockCoverage {
  rowId: string
  roleType: VolunteerRoleType
  roleLabel: string
  needed: number
  filled: number
  open: number
}

export interface CrewDayOfBlockSummary {
  timeBlockId: string
  source: CrewStaffingTimeBlock["source"]
  sourceId: string
  label: string
  startsAt: string | null
  endsAt: string | null
  timing: CrewDayOfBlockTiming
  status: CrewDayOfBlockStatus
  needed: number
  filled: number
  open: number
  responseNeeded: number
  decisionNeeded: number
  noShowOrReplaced: number
  judgeLaneGaps: number
  coverage: CrewDayOfBlockCoverage[]
}

export interface CrewDayOfCriticalGap {
  rowId: string
  timeBlockId: string
  blockLabel: string
  timing: CrewDayOfBlockTiming
  roleType: VolunteerRoleType
  roleLabel: string
  needed: number
  filled: number
  open: number
  startsAt: string | null
  endsAt: string | null
}

export interface CrewDayOfResponseQueueItem {
  assignmentId: string
  assignmentType: CrewAssignmentConfirmationType
  membershipId: string
  volunteerName: string
  timeBlockId: string
  blockLabel: string
  timing: CrewDayOfBlockTiming
  reason: CrewStaffingConfirmationGap["reason"]
  startsAt: string | null
  endsAt: string | null
}

export interface CrewDayOfJudgeCoverageBlock {
  timeBlockId: string
  heatId: string | null
  blockLabel: string
  timing: CrewDayOfBlockTiming
  startsAt: string | null
  endsAt: string | null
  needed: number
  filled: number
  open: number
  judgeLaneGaps: number
}

export interface CrewDayOfJudgeCoverageSummary {
  heatBlocks: number
  activeHeatBlocks: number
  coveredHeatBlocks: number
  lanesNeeded: number
  lanesFilled: number
  openLanes: number
  currentAndNext: CrewDayOfJudgeCoverageBlock[]
}

export interface CrewDayOfStateSummary {
  checkedInTracked: boolean
  checkedIn: number
  noShow: number
  replaced: number
}

export interface CrewDayOfAssignmentActionItem {
  assignmentId: string
  assignmentType: CrewAssignmentConfirmationType
  membershipId: string
  volunteerName: string
  roleType: VolunteerRoleType
  roleLabel: string
  timeBlockId: string
  blockLabel: string
  timing: CrewDayOfBlockTiming
  startsAt: string | null
  endsAt: string | null
  state: CrewAssignmentConfirmationOperationalState
}

export interface CrewDayOfReplacementOption {
  membershipId: string
  volunteerName: string
  roleTypes: VolunteerRoleType[]
}

export interface CrewDayOfOperationsBoard {
  generatedAt: string
  responseDueSoonHours: number
  currentBlocks: CrewDayOfBlockSummary[]
  nextBlocks: CrewDayOfBlockSummary[]
  timeBlocks: CrewDayOfBlockSummary[]
  criticalGaps: CrewDayOfCriticalGap[]
  noResponsesDueSoon: CrewDayOfResponseQueueItem[]
  decisionQueue: CrewDayOfResponseQueueItem[]
  noShowReplacementQueue: CrewDayOfResponseQueueItem[]
  assignmentActions: CrewDayOfAssignmentActionItem[]
  replacementOptions: CrewDayOfReplacementOption[]
  judgeCoverage: CrewDayOfJudgeCoverageSummary
  stateSummary: CrewDayOfStateSummary
  summary: {
    openRoles: number
    criticalBlocks: number
    noResponsesDueSoon: number
    decisionNeeded: number
    noShowOrReplaced: number
    currentBlockCount: number
    nextBlockCount: number
  }
}

interface NormalizedBlock {
  block: CrewStaffingTimeBlock
  startsAt: Date | null
  endsAt: Date | null
  timing: CrewDayOfBlockTiming
  index: number
}

const DEFAULT_RESPONSE_DUE_SOON_HOURS = 48
const DECISION_REASONS = new Set<CrewStaffingConfirmationGap["reason"]>([
  "declined",
  "change_requested",
])
const NO_SHOW_REPLACEMENT_REASONS = new Set<
  CrewStaffingConfirmationGap["reason"]
>(["no_show", "replaced"])
const NO_RESPONSE_REASONS = new Set<CrewStaffingConfirmationGap["reason"]>([
  "missing_confirmation",
  "no_response",
])

export function buildCrewDayOfOperationsBoard(
  input: CrewDayOfOperationsBoardInput,
): CrewDayOfOperationsBoard {
  const now = toValidDate(input.now) ?? new Date()
  const responseDueSoonHours =
    input.responseDueSoonHours ?? DEFAULT_RESPONSE_DUE_SOON_HOURS
  const normalizedBlocks = normalizeBlocks(input.matrix.timeBlocks, now)
  const blockSummaryById = buildBlockSummaries({
    blocks: normalizedBlocks,
    matrix: input.matrix,
  })
  const timeBlocks = normalizedBlocks.map((block) =>
    blockSummaryById.get(block.block.id),
  )
  const presentTimeBlocks = timeBlocks.filter(
    (block): block is CrewDayOfBlockSummary => Boolean(block),
  )
  const currentBlocks = presentTimeBlocks.filter(
    (block) => block.timing === "current",
  )
  const nextBlocks = presentTimeBlocks.filter(
    (block) => block.timing === "next",
  )
  const criticalGaps = buildCriticalGaps({
    rows: input.report.underfilledRows,
    blockSummaryById,
  })
  const queueItems = buildResponseQueueItems({
    gaps: input.matrix.confirmationGaps,
    blockSummaryById,
  })
  const noResponsesDueSoon = queueItems.filter((item) =>
    isNoResponseDueSoon(item, now, responseDueSoonHours),
  )
  const decisionQueue = queueItems.filter((item) =>
    DECISION_REASONS.has(item.reason),
  )
  const noShowReplacementQueue = queueItems.filter((item) =>
    NO_SHOW_REPLACEMENT_REASONS.has(item.reason),
  )
  const judgeCoverage = buildJudgeCoverageSummary({
    matrix: input.matrix,
    blockSummaryById,
  })
  const assignmentActions = buildAssignmentActionItems({
    staffingInput: input.staffingInput,
    blockSummaryById,
  })

  return {
    generatedAt: now.toISOString(),
    responseDueSoonHours,
    currentBlocks,
    nextBlocks,
    timeBlocks: presentTimeBlocks,
    criticalGaps,
    noResponsesDueSoon,
    decisionQueue,
    noShowReplacementQueue,
    assignmentActions,
    replacementOptions: buildReplacementOptions(input.staffingInput),
    judgeCoverage,
    stateSummary: {
      checkedInTracked: Boolean(input.staffingInput),
      checkedIn: assignmentActions.filter((item) => item.state === "checked_in")
        .length,
      noShow: input.matrix.summary.confirmationNoShows,
      replaced: input.matrix.summary.confirmationReplaced,
    },
    summary: {
      openRoles: criticalGaps.reduce((total, gap) => total + gap.open, 0),
      criticalBlocks: presentTimeBlocks.filter(
        (block) => block.status === "critical",
      ).length,
      noResponsesDueSoon: noResponsesDueSoon.length,
      decisionNeeded: decisionQueue.length,
      noShowOrReplaced: noShowReplacementQueue.length,
      currentBlockCount: currentBlocks.length,
      nextBlockCount: nextBlocks.length,
    },
  }
}

function normalizeBlocks(
  timeBlocks: CrewStaffingTimeBlock[],
  now: Date,
): NormalizedBlock[] {
  const withDates = timeBlocks.map((block, index) => ({
    block,
    startsAt: toValidDate(block.startTime),
    endsAt: toValidDate(block.endTime),
    timing: "unscheduled" as CrewDayOfBlockTiming,
    index,
  }))
  const currentIds = new Set(
    withDates
      .filter(
        ({ startsAt, endsAt }) =>
          startsAt &&
          startsAt.getTime() <= now.getTime() &&
          (!endsAt || endsAt.getTime() > now.getTime()),
      )
      .map(({ block }) => block.id),
  )
  const nextStartMs = withDates
    .filter(({ startsAt }) => startsAt && startsAt.getTime() > now.getTime())
    .reduce<number | null>((nextMs, { startsAt }) => {
      if (!startsAt) return nextMs
      const startMs = startsAt.getTime()
      return nextMs === null ? startMs : Math.min(nextMs, startMs)
    }, null)

  return withDates
    .map((entry) => ({
      ...entry,
      timing: getBlockTiming(entry, currentIds, nextStartMs, now),
    }))
    .sort(compareNormalizedBlock)
}

function getBlockTiming(
  entry: Omit<NormalizedBlock, "timing">,
  currentIds: Set<string>,
  nextStartMs: number | null,
  now: Date,
): CrewDayOfBlockTiming {
  if (!entry.startsAt) return "unscheduled"
  if (currentIds.has(entry.block.id)) return "current"
  if (nextStartMs !== null && entry.startsAt.getTime() === nextStartMs) {
    return "next"
  }
  if (entry.startsAt.getTime() > now.getTime()) return "upcoming"
  return "past"
}

function buildBlockSummaries(input: {
  blocks: NormalizedBlock[]
  matrix: CrewStaffingMatrix
}) {
  const coverageRowsByBlockId = groupBy(
    input.matrix.coverageRows,
    (row) => row.timeBlockId,
  )
  const confirmationGapsByBlockId = groupBy(
    input.matrix.confirmationGaps,
    (gap) => gap.timeBlockId,
  )
  const judgeLaneGapsByBlockId = groupBy(
    input.matrix.judgeLaneGaps,
    (gap) => gap.timeBlockId,
  )

  return new Map(
    input.blocks.map((entry) => {
      const coverageRows = coverageRowsByBlockId.get(entry.block.id) ?? []
      const confirmationGaps =
        confirmationGapsByBlockId.get(entry.block.id) ?? []
      const judgeLaneGaps = judgeLaneGapsByBlockId.get(entry.block.id) ?? []
      const open = sum(coverageRows, "open")
      const responseNeeded = confirmationGaps.filter((gap) =>
        NO_RESPONSE_REASONS.has(gap.reason),
      ).length
      const decisionNeeded = confirmationGaps.filter((gap) =>
        DECISION_REASONS.has(gap.reason),
      ).length
      const noShowOrReplaced = confirmationGaps.filter((gap) =>
        NO_SHOW_REPLACEMENT_REASONS.has(gap.reason),
      ).length
      const status = getBlockStatus({
        open,
        judgeLaneGaps: judgeLaneGaps.length,
        decisionNeeded,
        noShowOrReplaced,
        responseNeeded,
      })
      const summary: CrewDayOfBlockSummary = {
        timeBlockId: entry.block.id,
        source: entry.block.source,
        sourceId: entry.block.sourceId,
        label: entry.block.label,
        startsAt: toIso(entry.startsAt),
        endsAt: toIso(entry.endsAt),
        timing: entry.timing,
        status,
        needed: sum(coverageRows, "needed"),
        filled: sum(coverageRows, "filled"),
        open,
        responseNeeded,
        decisionNeeded,
        noShowOrReplaced,
        judgeLaneGaps: judgeLaneGaps.length,
        coverage: coverageRows.map(toBlockCoverage),
      }
      return [entry.block.id, summary] as const
    }),
  )
}

function getBlockStatus(params: {
  open: number
  judgeLaneGaps: number
  responseNeeded: number
  decisionNeeded: number
  noShowOrReplaced: number
}): CrewDayOfBlockStatus {
  if (
    params.open > 0 ||
    params.judgeLaneGaps > 0 ||
    params.decisionNeeded > 0 ||
    params.noShowOrReplaced > 0
  ) {
    return "critical"
  }
  if (params.responseNeeded > 0) return "attention"
  return "covered"
}

function buildCriticalGaps(input: {
  rows: CrewStaffingCoverageRow[]
  blockSummaryById: Map<string, CrewDayOfBlockSummary>
}): CrewDayOfCriticalGap[] {
  return input.rows
    .filter((row) => row.open > 0)
    .map((row) => {
      const block = input.blockSummaryById.get(row.timeBlockId)
      return {
        rowId: row.id,
        timeBlockId: row.timeBlockId,
        blockLabel: block?.label ?? row.timeBlockId,
        timing: block?.timing ?? "unscheduled",
        roleType: row.roleType,
        roleLabel: formatRole(row.roleType),
        needed: row.needed,
        filled: row.filled,
        open: row.open,
        startsAt: block?.startsAt ?? null,
        endsAt: block?.endsAt ?? null,
      }
    })
    .sort(compareCriticalGap)
}

function buildResponseQueueItems(input: {
  gaps: CrewStaffingConfirmationGap[]
  blockSummaryById: Map<string, CrewDayOfBlockSummary>
}): CrewDayOfResponseQueueItem[] {
  return input.gaps
    .map((gap) => {
      const block = input.blockSummaryById.get(gap.timeBlockId)
      return {
        assignmentId: gap.assignmentId,
        assignmentType: gap.type,
        membershipId: gap.membershipId,
        volunteerName: gap.volunteerName,
        timeBlockId: gap.timeBlockId,
        blockLabel: block?.label ?? gap.timeBlockId,
        timing: block?.timing ?? "unscheduled",
        reason: gap.reason,
        startsAt: block?.startsAt ?? null,
        endsAt: block?.endsAt ?? null,
      }
    })
    .sort(compareQueueItem)
}

function buildAssignmentActionItems(input: {
  staffingInput: CrewStaffingMatrixInput | undefined
  blockSummaryById: Map<string, CrewDayOfBlockSummary>
}): CrewDayOfAssignmentActionItem[] {
  if (!input.staffingInput) return []

  const rosterByMembershipId = new Map(
    (input.staffingInput.roster ?? []).map((volunteer) => [
      volunteer.membershipId,
      volunteer,
    ]),
  )
  const items: CrewDayOfAssignmentActionItem[] = []

  for (const shift of input.staffingInput.shifts ?? []) {
    const block = input.blockSummaryById.get(`shift:${shift.id}`)
    if (!block || block.timing === "past") continue

    for (const assignment of shift.assignments) {
      const volunteer = rosterByMembershipId.get(assignment.membershipId)
      items.push({
        assignmentId: assignment.id,
        assignmentType: CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
        membershipId: assignment.membershipId,
        volunteerName: volunteer?.name ?? "Volunteer",
        roleType: shift.roleType,
        roleLabel: formatRole(shift.roleType),
        timeBlockId: block.timeBlockId,
        blockLabel: block.label,
        timing: block.timing,
        startsAt: block.startsAt,
        endsAt: block.endsAt,
        state: getCrewAssignmentConfirmationOperationalState(
          assignment.confirmation,
        ),
      })
    }
  }

  for (const assignment of input.staffingInput.judgeAssignments ?? []) {
    const block = input.blockSummaryById.get(`heat:${assignment.heatId}`)
    if (!block || block.timing === "past") continue

    const roleType = assignment.position ?? VOLUNTEER_ROLE_TYPES.JUDGE
    const volunteer = rosterByMembershipId.get(assignment.membershipId)
    items.push({
      assignmentId: assignment.id,
      assignmentType: CREW_ASSIGNMENT_CONFIRMATION_TYPE.JUDGE_HEAT,
      membershipId: assignment.membershipId,
      volunteerName: volunteer?.name ?? "Volunteer",
      roleType,
      roleLabel: formatRole(roleType),
      timeBlockId: block.timeBlockId,
      blockLabel: block.label,
      timing: block.timing,
      startsAt: block.startsAt,
      endsAt: block.endsAt,
      state: getCrewAssignmentConfirmationOperationalState(
        assignment.confirmation,
      ),
    })
  }

  return items.sort(compareAssignmentActionItem)
}

function buildReplacementOptions(
  input: CrewStaffingMatrixInput | undefined,
): CrewDayOfReplacementOption[] {
  return (input?.roster ?? [])
    .filter((volunteer) => volunteer.isActive !== false)
    .map((volunteer) => ({
      membershipId: volunteer.membershipId,
      volunteerName: volunteer.name,
      roleTypes: volunteer.roleTypes,
    }))
    .sort((left, right) =>
      left.volunteerName.localeCompare(right.volunteerName),
    )
}

function isNoResponseDueSoon(
  item: CrewDayOfResponseQueueItem,
  now: Date,
  dueSoonHours: number,
) {
  if (!NO_RESPONSE_REASONS.has(item.reason)) return false
  if (item.timing === "past" || !item.startsAt) return false
  const startsAt = toValidDate(item.startsAt)
  if (!startsAt) return false
  const dueSoonMs = now.getTime() + dueSoonHours * 60 * 60 * 1000
  return startsAt.getTime() <= dueSoonMs
}

function buildJudgeCoverageSummary(input: {
  matrix: CrewStaffingMatrix
  blockSummaryById: Map<string, CrewDayOfBlockSummary>
}): CrewDayOfJudgeCoverageSummary {
  const judgeRows = input.matrix.coverageRows.filter((row) => {
    const block = input.blockSummaryById.get(row.timeBlockId)
    return (
      row.roleType === VOLUNTEER_ROLE_TYPES.JUDGE && block?.source === "heat"
    )
  })
  const blocks = judgeRows
    .map((row) => {
      const block = input.blockSummaryById.get(row.timeBlockId)
      return {
        timeBlockId: row.timeBlockId,
        heatId: block?.source === "heat" ? block.sourceId : null,
        blockLabel: block?.label ?? row.timeBlockId,
        timing: block?.timing ?? "unscheduled",
        startsAt: block?.startsAt ?? null,
        endsAt: block?.endsAt ?? null,
        needed: row.needed,
        filled: row.filled,
        open: row.open,
        judgeLaneGaps: input.matrix.judgeLaneGaps.filter(
          (gap) => gap.timeBlockId === row.timeBlockId,
        ).length,
      } satisfies CrewDayOfJudgeCoverageBlock
    })
    .sort(compareJudgeCoverageBlock)

  return {
    heatBlocks: blocks.length,
    activeHeatBlocks: blocks.filter(
      (block) => block.timing === "current" || block.timing === "next",
    ).length,
    coveredHeatBlocks: blocks.filter((block) => block.open === 0).length,
    lanesNeeded: sum(blocks, "needed"),
    lanesFilled: sum(blocks, "filled"),
    openLanes: sum(blocks, "open"),
    currentAndNext: blocks.filter(
      (block) => block.timing === "current" || block.timing === "next",
    ),
  }
}

function toBlockCoverage(row: CrewStaffingCoverageRow): CrewDayOfBlockCoverage {
  return {
    rowId: row.id,
    roleType: row.roleType,
    roleLabel: formatRole(row.roleType),
    needed: row.needed,
    filled: row.filled,
    open: row.open,
  }
}

function compareNormalizedBlock(left: NormalizedBlock, right: NormalizedBlock) {
  return (
    timingRank(left.timing) - timingRank(right.timing) ||
    compareNullableDate(left.startsAt, right.startsAt) ||
    left.index - right.index ||
    left.block.id.localeCompare(right.block.id)
  )
}

function compareCriticalGap(
  left: CrewDayOfCriticalGap,
  right: CrewDayOfCriticalGap,
) {
  return (
    timingRank(left.timing) - timingRank(right.timing) ||
    compareNullableIso(left.startsAt, right.startsAt) ||
    right.open - left.open ||
    left.roleLabel.localeCompare(right.roleLabel) ||
    left.rowId.localeCompare(right.rowId)
  )
}

function compareQueueItem(
  left: CrewDayOfResponseQueueItem,
  right: CrewDayOfResponseQueueItem,
) {
  return (
    timingRank(left.timing) - timingRank(right.timing) ||
    compareNullableIso(left.startsAt, right.startsAt) ||
    left.volunteerName.localeCompare(right.volunteerName) ||
    left.assignmentId.localeCompare(right.assignmentId)
  )
}

function compareAssignmentActionItem(
  left: CrewDayOfAssignmentActionItem,
  right: CrewDayOfAssignmentActionItem,
) {
  return (
    timingRank(left.timing) - timingRank(right.timing) ||
    compareNullableIso(left.startsAt, right.startsAt) ||
    left.blockLabel.localeCompare(right.blockLabel) ||
    left.volunteerName.localeCompare(right.volunteerName) ||
    left.assignmentId.localeCompare(right.assignmentId)
  )
}

function compareJudgeCoverageBlock(
  left: CrewDayOfJudgeCoverageBlock,
  right: CrewDayOfJudgeCoverageBlock,
) {
  return (
    timingRank(left.timing) - timingRank(right.timing) ||
    compareNullableIso(left.startsAt, right.startsAt) ||
    left.blockLabel.localeCompare(right.blockLabel) ||
    left.timeBlockId.localeCompare(right.timeBlockId)
  )
}

function timingRank(timing: CrewDayOfBlockTiming) {
  if (timing === "current") return 0
  if (timing === "next") return 1
  if (timing === "upcoming") return 2
  if (timing === "unscheduled") return 3
  return 4
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K) {
  const grouped = new Map<K, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    const existing = grouped.get(key) ?? []
    existing.push(item)
    grouped.set(key, existing)
  }
  return grouped
}

function sum<T>(items: T[], key: keyof T) {
  return items.reduce((total, item) => {
    const value = item[key]
    return total + (typeof value === "number" ? value : 0)
  }, 0)
}

function formatRole(roleType: VolunteerRoleType) {
  return VOLUNTEER_ROLE_LABELS[roleType] ?? roleType
}

function toValidDate(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toIso(date: Date | null) {
  return date ? date.toISOString() : null
}

function compareNullableDate(left: Date | null, right: Date | null) {
  if (left && right) return left.getTime() - right.getTime()
  if (left) return -1
  if (right) return 1
  return 0
}

function compareNullableIso(left: string | null, right: string | null) {
  return compareNullableDate(toValidDate(left), toValidDate(right))
}
