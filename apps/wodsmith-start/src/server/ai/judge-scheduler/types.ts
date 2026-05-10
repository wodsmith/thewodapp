import type {LaneShiftPattern} from "@/db/schemas/volunteers"
import type {VolunteerAvailability} from "@/db/schemas/volunteers"
import type {CoverageStats} from "@/lib/judge-rotation-utils"

export interface SchedulingHeatInput {
  heatNumber: number
  laneCount: number
  occupiedLanes?: Set<number>
  scheduledTime: Date | null
  durationMinutes: number | null
}

export interface SchedulingJudgeInput {
  membershipId: string
  displayName: string
  availability?: VolunteerAvailability
  availabilityNotes?: string
  credentials?: string
}

export interface SchedulingRotationInput {
  id: string
  membershipId: string
  startingHeat: number
  startingLane: number
  heatsCount: number
  laneShiftPattern: LaneShiftPattern
}

export interface EventDefaults {
  minHeatBuffer: number
}

export interface ContextJudge extends SchedulingJudgeInput {
  currentRotationCount: number
}

export interface SchedulingContext {
  heats: SchedulingHeatInput[]
  judges: ContextJudge[]
  rotations: SchedulingRotationInput[]
  eventDefaults: EventDefaults
  coverage: CoverageStats
}

export type ProposalConfidence = "high" | "medium" | "low"

export interface ProposedRotation {
  membershipId: string
  startingHeat: number
  startingLane: number
  heatsCount: number
  laneShiftPattern: LaneShiftPattern
  reason: string
  confidence: ProposalConfidence
}

export type ProposalConflict =
  | {kind: "unknown_judge"; membershipId: string; message: string}
  | {kind: "invalid_heat"; heatNumber: number; message: string}
  | {kind: "invalid_lane"; laneNumber: number; message: string}
  | {
      kind: "double_booking"
      heatNumber: number
      laneNumber: number
      message: string
    }
  | {kind: "buffer_violation"; conflictingHeat: number; message: string}

export type ValidationResult =
  | {ok: true}
  | {ok: false; conflict: ProposalConflict}

export type ProposalResult =
  | {accepted: true; proposalId: string}
  | {accepted: false; conflict: ProposalConflict}
