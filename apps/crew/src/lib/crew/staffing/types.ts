// @lat: [[crew#Staffing Matrix Core]]
import type {
  CrewAssignmentConfirmationStatus,
  CrewAssignmentConfirmationType,
} from "../../../db/schemas/crew-imports"
import type {
  VolunteerAvailability,
  VolunteerRoleType,
} from "../../../db/schemas/volunteers"

export interface CrewStaffingEventInput {
  id: string
  name?: string | null
  timezone?: string | null
  startDate?: string | null
  endDate?: string | null
}

export interface CrewStaffingVenueInput {
  id: string
  name: string
  laneCount: number
  sortOrder?: number | null
}

export interface CrewStaffingWorkoutInput {
  id: string
  name: string
  sortOrder?: number | null
}

export interface CrewStaffingHeatInput {
  id: string
  trackWorkoutId: string
  heatNumber: number
  venueId?: string | null
  scheduledTime?: Date | string | null
  durationMinutes?: number | null
  laneCount?: number | null
}

export interface CrewStaffingHeatLaneAssignmentInput {
  heatId: string
  laneNumber: number
}

export interface CrewStaffingVolunteerInput {
  membershipId: string
  name: string
  email?: string | null
  roleTypes: VolunteerRoleType[]
  availability?: VolunteerAvailability | null
  credentials?: string | null
  isActive?: boolean | null
  isAccountless?: boolean | null
}

export interface CrewStaffingShiftAssignmentInput {
  id: string
  membershipId: string
  confirmation?: CrewStaffingConfirmationInput | null
}

export interface CrewStaffingShiftInput {
  id: string
  name: string
  roleType: VolunteerRoleType
  startTime: Date | string
  endTime: Date | string
  capacity: number
  location?: string | null
  assignments: CrewStaffingShiftAssignmentInput[]
}

export interface CrewStaffingJudgeAssignmentInput {
  id: string
  heatId: string
  membershipId: string
  laneNumber?: number | null
  position?: VolunteerRoleType | null
  versionId?: string | null
  rotationId?: string | null
  confirmation?: CrewStaffingConfirmationInput | null
}

export interface CrewStaffingConfirmationInput {
  type: CrewAssignmentConfirmationType
  status: CrewAssignmentConfirmationStatus
  sentAt?: Date | string | null
  respondedAt?: Date | string | null
  responseNote?: string | null
}

export interface CrewStaffingMatrixInput {
  event: CrewStaffingEventInput
  venues?: CrewStaffingVenueInput[]
  workouts?: CrewStaffingWorkoutInput[]
  heats?: CrewStaffingHeatInput[]
  heatLaneAssignments?: CrewStaffingHeatLaneAssignmentInput[]
  roster?: CrewStaffingVolunteerInput[]
  shifts?: CrewStaffingShiftInput[]
  judgeAssignments?: CrewStaffingJudgeAssignmentInput[]
}

export type CrewStaffingTimeBlockSource = "shift" | "heat"

export interface CrewStaffingTimeBlock {
  id: string
  source: CrewStaffingTimeBlockSource
  sourceId: string
  label: string
  startTime: Date | null
  endTime: Date | null
  workoutId: string | null
  heatId: string | null
  venueId: string | null
}

export interface CrewStaffingCoverageRow {
  id: string
  timeBlockId: string
  roleType: VolunteerRoleType
  needed: number
  filled: number
  open: number
  assignmentIds: string[]
}

export interface CrewStaffingJudgeLaneGap {
  heatId: string
  heatNumber: number
  laneNumber: number
  timeBlockId: string
}

export interface CrewStaffingDoubleBookedVolunteer {
  membershipId: string
  volunteerName: string
  assignmentIds: string[]
  timeBlockIds: string[]
}

export interface CrewStaffingOutsideAvailabilityAssignment {
  membershipId: string
  volunteerName: string
  availability: VolunteerAvailability
  assignmentId: string
  timeBlockId: string
}

export interface CrewStaffingCredentialWarning {
  membershipId: string
  volunteerName: string
  assignmentId: string
  timeBlockId: string
  requiredRoleType: VolunteerRoleType
  volunteerRoleTypes: VolunteerRoleType[]
  reason: "inactive_volunteer" | "missing_volunteer" | "role_mismatch"
}

export interface CrewStaffingConfirmationGap {
  assignmentId: string
  membershipId: string
  volunteerName: string
  timeBlockId: string
  type: CrewAssignmentConfirmationType
  status: CrewAssignmentConfirmationStatus | null
  reason:
    | "missing_confirmation"
    | "no_response"
    | "declined"
    | "change_requested"
    | "no_show"
    | "replaced"
}

export interface CrewStaffingMatrixSummary {
  timeBlocks: number
  roles: number
  totalNeeded: number
  totalFilled: number
  totalOpen: number
  underfilledRows: number
  openCapacity: number
  judgeLaneGaps: number
  doubleBookedVolunteers: number
  outsideAvailabilityAssignments: number
  credentialWarnings: number
  confirmationNoResponses: number
  confirmationDeclines: number
  confirmationChangeRequests: number
  confirmationNoShows: number
  confirmationReplaced: number
}

export interface CrewStaffingMatrix {
  timeBlocks: CrewStaffingTimeBlock[]
  coverageRows: CrewStaffingCoverageRow[]
  judgeLaneGaps: CrewStaffingJudgeLaneGap[]
  doubleBookedVolunteers: CrewStaffingDoubleBookedVolunteer[]
  outsideAvailabilityAssignments: CrewStaffingOutsideAvailabilityAssignment[]
  credentialWarnings: CrewStaffingCredentialWarning[]
  confirmationGaps: CrewStaffingConfirmationGap[]
  summary: CrewStaffingMatrixSummary
}
