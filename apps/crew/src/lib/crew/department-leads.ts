// @lat: [[crew#Department Leads]]
import type { VolunteerRoleType } from "@/db/schemas/volunteers"

export interface CrewDepartmentLeadScopeRecord {
  id: string
  roleType?: VolunteerRoleType | null
  venueId?: string | null
  startsAt?: Date | string | null
  endsAt?: Date | string | null
  scope?: Record<string, unknown> | null
}

export interface CrewDepartmentLeadScope {
  id: string
  roleTypes: VolunteerRoleType[]
  floorNames: string[]
  venueIds: string[]
  startsAt: Date | null
  endsAt: Date | null
}

export interface CrewDepartmentLeadShiftTarget {
  id?: string
  roleType: VolunteerRoleType
  location?: string | null
  venueId?: string | null
  startTime: Date | string
  endTime: Date | string
}

export interface CrewDepartmentLeadRosterTarget {
  membershipId?: string | null
  roleTypes: VolunteerRoleType[]
}

export interface CrewDepartmentLeadAccess {
  kind: "full" | "department_lead"
  scopes: CrewDepartmentLeadScope[]
}

export function normalizeCrewDepartmentLeadScope(
  record: CrewDepartmentLeadScopeRecord,
): CrewDepartmentLeadScope {
  const scope = isRecord(record.scope) ? record.scope : {}
  const roleTypes = uniqueStrings([
    ...parseStringList(scope.roleTypes),
    ...parseStringList(scope.roles),
    ...(record.roleType ? [record.roleType] : []),
  ]) as VolunteerRoleType[]
  const floorNames = uniqueStrings([
    ...parseStringList(scope.floorNames),
    ...parseStringList(scope.floors),
    ...parseStringList(scope.locations),
  ]).map(normalizeDepartmentLeadText)
  const venueIds = uniqueStrings([
    ...parseStringList(scope.venueIds),
    ...(record.venueId ? [record.venueId] : []),
  ])

  return {
    id: record.id,
    roleTypes,
    floorNames,
    venueIds,
    startsAt: toValidDate(record.startsAt),
    endsAt: toValidDate(record.endsAt),
  }
}

export function crewDepartmentLeadCanManageShift(
  scope: CrewDepartmentLeadScope,
  shift: CrewDepartmentLeadShiftTarget,
): boolean {
  if (scope.roleTypes.length > 0 && !scope.roleTypes.includes(shift.roleType)) {
    return false
  }

  if (
    scope.venueIds.length > 0 &&
    !scope.venueIds.includes(shift.venueId ?? "")
  ) {
    return false
  }

  if (scope.floorNames.length > 0) {
    const location = normalizeDepartmentLeadText(shift.location)
    if (!location || !scope.floorNames.includes(location)) {
      return false
    }
  }

  const startTime = toValidDate(shift.startTime)
  const endTime = toValidDate(shift.endTime)
  if (!startTime || !endTime) return false

  if (scope.startsAt && endTime <= scope.startsAt) return false
  if (scope.endsAt && startTime >= scope.endsAt) return false

  return true
}

export function crewDepartmentLeadCanManageRosterTarget(
  scope: CrewDepartmentLeadScope,
  target: CrewDepartmentLeadRosterTarget,
): boolean {
  if (scope.roleTypes.length === 0) return true
  return target.roleTypes.some((roleType) => scope.roleTypes.includes(roleType))
}

export function filterCrewDepartmentLeadShifts<
  T extends CrewDepartmentLeadShiftTarget,
>(shifts: T[], access: CrewDepartmentLeadAccess): T[] {
  if (access.kind === "full") return shifts
  return shifts.filter((shift) =>
    access.scopes.some((scope) =>
      crewDepartmentLeadCanManageShift(scope, shift),
    ),
  )
}

export function filterCrewDepartmentLeadRoster<
  T extends CrewDepartmentLeadRosterTarget,
>(
  roster: T[],
  access: CrewDepartmentLeadAccess,
  visibleShiftAssignments: Array<{
    assignments: Array<{ membershipId: string }>
  }>,
): T[] {
  if (access.kind === "full") return roster

  const visibleMembershipIds = new Set(
    visibleShiftAssignments.flatMap((shift) =>
      shift.assignments.map((assignment) => assignment.membershipId),
    ),
  )

  return roster.filter((volunteer) => {
    if (
      volunteer.membershipId &&
      visibleMembershipIds.has(volunteer.membershipId)
    ) {
      return true
    }

    return access.scopes.some((scope) =>
      crewDepartmentLeadCanManageRosterTarget(scope, volunteer),
    )
  })
}

export function assertCrewDepartmentLeadCanManageShift(
  access: CrewDepartmentLeadAccess,
  shift: CrewDepartmentLeadShiftTarget,
) {
  if (access.kind === "full") return
  if (
    access.scopes.some((scope) =>
      crewDepartmentLeadCanManageShift(scope, shift),
    )
  ) {
    return
  }

  throw new Error("Department lead scope does not include this shift.")
}

export function assertCrewDepartmentLeadCanManageRosterTarget(
  access: CrewDepartmentLeadAccess,
  target: CrewDepartmentLeadRosterTarget,
) {
  if (access.kind === "full") return
  if (
    access.scopes.some((scope) =>
      crewDepartmentLeadCanManageRosterTarget(scope, target),
    )
  ) {
    return
  }

  throw new Error("Department lead scope does not include this volunteer.")
}

export function normalizeDepartmentLeadText(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/\s+/g, " ")
    : ""
}

function parseStringList(value: unknown) {
  if (typeof value === "string") return value.trim() ? [value.trim()] : []
  if (!Array.isArray(value)) return []
  return value.flatMap((item) =>
    typeof item === "string" && item.trim() ? [item.trim()] : [],
  )
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)]
}

function toValidDate(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
