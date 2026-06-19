export type StaffingRoleGroup = "judge" | "volunteer"

export type StaffingRoleBasis = "event" | "floor" | "lane" | "lanePerFloor"

export interface StaffingRoleAssumption {
  id: string
  label: string
  group: StaffingRoleGroup
  basis: StaffingRoleBasis
  peoplePerUnit: number
}

export interface StaffingCalculatorInputs {
  lanes: number
  floors: number
  heats: number
  heatDurationMinutes: number
  shiftLengthHours: number
  roleAssumptions: StaffingRoleAssumption[]
}

export interface StaffingRoleEstimate {
  id: string
  label: string
  group: StaffingRoleGroup
  basis: StaffingRoleBasis
  peoplePerUnit: number
  concurrentPeople: number
  personMinutes: number
  shiftSlots: number
}

export interface StaffingCalculatorEstimate {
  eventMinutes: number
  shiftLengthMinutes: number
  totalConcurrentPeople: number
  totalShiftSlots: number
  judgeConcurrentPeople: number
  judgeShiftSlots: number
  volunteerConcurrentPeople: number
  volunteerShiftSlots: number
  roleEstimates: StaffingRoleEstimate[]
}

export const defaultStaffingRoleAssumptions: StaffingRoleAssumption[] = [
  {
    id: "lane-judges",
    label: "Lane judges",
    group: "judge",
    basis: "lanePerFloor",
    peoplePerUnit: 1,
  },
  {
    id: "floor-leads",
    label: "Floor leads",
    group: "judge",
    basis: "floor",
    peoplePerUnit: 1,
  },
  {
    id: "score-runners",
    label: "Score runners",
    group: "volunteer",
    basis: "floor",
    peoplePerUnit: 1,
  },
  {
    id: "equipment-reset",
    label: "Equipment reset",
    group: "volunteer",
    basis: "lanePerFloor",
    peoplePerUnit: 0.5,
  },
  {
    id: "athlete-control",
    label: "Athlete control",
    group: "volunteer",
    basis: "event",
    peoplePerUnit: 2,
  },
  {
    id: "check-in",
    label: "Check-in",
    group: "volunteer",
    basis: "event",
    peoplePerUnit: 2,
  },
]

export const defaultStaffingCalculatorInputs: StaffingCalculatorInputs = {
  lanes: 8,
  floors: 1,
  heats: 24,
  heatDurationMinutes: 12,
  shiftLengthHours: 4,
  roleAssumptions: defaultStaffingRoleAssumptions,
}

export function estimateCrewStaffing(
  inputs: StaffingCalculatorInputs,
): StaffingCalculatorEstimate {
  const normalizedInputs = normalizeStaffingCalculatorInputs(inputs)
  const eventMinutes =
    normalizedInputs.heats * normalizedInputs.heatDurationMinutes
  const shiftLengthMinutes = normalizedInputs.shiftLengthHours * 60

  const roleEstimates = normalizedInputs.roleAssumptions.map((role) => {
    const concurrentPeople = Math.ceil(
      role.peoplePerUnit * getRoleBasisUnits(role.basis, normalizedInputs),
    )
    const personMinutes = concurrentPeople * eventMinutes

    return {
      ...role,
      concurrentPeople,
      personMinutes,
      shiftSlots: Math.ceil(personMinutes / shiftLengthMinutes),
    }
  })

  return {
    eventMinutes,
    shiftLengthMinutes,
    totalConcurrentPeople: sumRoleValue(roleEstimates, "concurrentPeople"),
    totalShiftSlots: sumRoleValue(roleEstimates, "shiftSlots"),
    judgeConcurrentPeople: sumRoleValue(
      roleEstimates.filter((role) => role.group === "judge"),
      "concurrentPeople",
    ),
    judgeShiftSlots: sumRoleValue(
      roleEstimates.filter((role) => role.group === "judge"),
      "shiftSlots",
    ),
    volunteerConcurrentPeople: sumRoleValue(
      roleEstimates.filter((role) => role.group === "volunteer"),
      "concurrentPeople",
    ),
    volunteerShiftSlots: sumRoleValue(
      roleEstimates.filter((role) => role.group === "volunteer"),
      "shiftSlots",
    ),
    roleEstimates,
  }
}

export function formatStaffingDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours === 0) return `${remainingMinutes}m`
  if (remainingMinutes === 0) return `${hours}h`

  return `${hours}h ${remainingMinutes}m`
}

function normalizeStaffingCalculatorInputs(
  inputs: StaffingCalculatorInputs,
): StaffingCalculatorInputs {
  return {
    lanes: clampWholeNumber(inputs.lanes, 1),
    floors: clampWholeNumber(inputs.floors, 1),
    heats: clampWholeNumber(inputs.heats, 1),
    heatDurationMinutes: clampWholeNumber(inputs.heatDurationMinutes, 1),
    shiftLengthHours: clampDecimal(inputs.shiftLengthHours, 0.25),
    roleAssumptions: inputs.roleAssumptions.map((role) => ({
      ...role,
      peoplePerUnit: clampDecimal(role.peoplePerUnit, 0),
    })),
  }
}

function getRoleBasisUnits(
  basis: StaffingRoleBasis,
  inputs: StaffingCalculatorInputs,
) {
  switch (basis) {
    case "event":
      return 1
    case "floor":
      return inputs.floors
    case "lane":
      return inputs.lanes
    case "lanePerFloor":
      return inputs.lanes * inputs.floors
  }
}

function sumRoleValue(
  roles: StaffingRoleEstimate[],
  key: "concurrentPeople" | "shiftSlots",
) {
  return roles.reduce((total, role) => total + role[key], 0)
}

function clampWholeNumber(value: number, minimum: number) {
  if (!Number.isFinite(value)) return minimum
  return Math.max(minimum, Math.round(value))
}

function clampDecimal(value: number, minimum: number) {
  if (!Number.isFinite(value)) return minimum
  return Math.max(minimum, value)
}
