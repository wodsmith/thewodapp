// @lat: [[crew#Role And Shift Templates]]
import type { VolunteerRoleType } from "../../../db/schemas/volunteers"

export type CrewRoleShiftTemplateSource = "built_in" | "team_preset"

export interface CrewRoleShiftTemplateRef {
  source: CrewRoleShiftTemplateSource
  templateId?: string
  presetId?: string
}

export interface CrewRoleShiftTemplateRole {
  roleType: VolunteerRoleType
  targetCount: number
  notes?: string
}

export interface CrewRoleShiftTemplateShift {
  key: string
  name: string
  roleType: VolunteerRoleType
  dayOffset: number
  startTime: string
  endTime: string
  capacity: number
  location?: string
  notes?: string
}

export interface CrewRoleShiftTemplate {
  id: string
  name: string
  description: string
  source: CrewRoleShiftTemplateSource
  presetId?: string
  roles: CrewRoleShiftTemplateRole[]
  shifts: CrewRoleShiftTemplateShift[]
  staffingAssumptions: string
}

export interface CrewTemplateExistingShift {
  id: string
  name: string
  roleType: VolunteerRoleType
  startTime: Date | string
  endTime: Date | string
  location?: string | null
  capacity: number
}

export interface CrewTemplateEventContext {
  eventId: string
  startDate: string | null
  endDate: string | null
  timezone: string
  existingShifts: CrewTemplateExistingShift[]
  existingAssumptions: string
}

export type CrewTemplateShiftPreviewStatus =
  | "new"
  | "already_exists"
  | "outside_event_dates"

export interface CrewTemplateShiftPreview {
  key: string
  name: string
  roleType: VolunteerRoleType
  date: string | null
  startTime: string
  endTime: string
  capacity: number
  location: string | null
  notes: string | null
  status: CrewTemplateShiftPreviewStatus
  existingShiftId: string | null
}

export interface CrewTemplatePreview {
  template: CrewRoleShiftTemplate
  roles: CrewRoleShiftTemplateRole[]
  shifts: CrewTemplateShiftPreview[]
  staffingAssumptions: string
  summary: {
    roles: number
    shifts: number
    newShifts: number
    duplicateShifts: number
    outsideEventDateShifts: number
    canFillAssumptions: boolean
    warnings: string[]
  }
}

export type CrewTemplateApplyMode = "append_missing"

export interface CrewTemplateApplyPlan {
  mode: CrewTemplateApplyMode
  shiftsToCreate: CrewTemplateShiftPreview[]
  assumptionsToWrite: string | null
}
