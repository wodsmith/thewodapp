import {
  INVITATION_STATUS,
  type InvitationStatus,
} from "../../db/schemas/teams"
import {
  VOLUNTEER_AVAILABILITY,
  VOLUNTEER_ROLE_LABELS,
  VOLUNTEER_ROLE_TYPES,
  VOLUNTEER_ROLE_TYPE_VALUES,
  type VolunteerAvailability,
  type VolunteerMembershipMetadata,
  type VolunteerRoleType,
} from "../../db/schemas/volunteers"
import { parseTimeInTimezone } from "../../utils/timezone-utils"

export type CrewRosterStatus =
  | "pending"
  | "accepted"
  | "active"
  | "inactive"
  | "expired"

export interface CrewRosterMetadata
  extends Partial<VolunteerMembershipMetadata> {
  signupName?: string
  signupEmail?: string
  signupPhone?: string
  inviteName?: string
  crewImportId?: string
  crewSignupSource?: string
}

export interface CrewVolunteerInvitationRecord {
  id: string
  email: string
  acceptedAt?: Date | string | null
  expiresAt?: Date | string | null
  status?: InvitationStatus | string | null
  metadata?: string | null
  createdAt?: Date | string | null
  updatedAt?: Date | string | null
}

export interface CrewVolunteerMembershipRecord {
  id: string
  isActive?: boolean | null
  metadata?: string | null
  user?: {
    firstName?: string | null
    lastName?: string | null
    email?: string | null
  } | null
  createdAt?: Date | string | null
  updatedAt?: Date | string | null
}

export interface CrewRosterVolunteer {
  id: string
  source: "team_invitation" | "team_membership"
  sourceId: string
  membershipId: string | null
  invitationId: string | null
  email: string
  name: string
  phone: string | null
  status: CrewRosterStatus
  roleTypes: VolunteerRoleType[]
  availability: VolunteerAvailability | null
  availabilityNotes: string | null
  credentials: string | null
  imported: boolean
  signupSource: string | null
  createdAt: Date | null
  updatedAt: Date | null
}

export interface CrewRosterSummary {
  total: number
  pending: number
  accepted: number
  active: number
  inactive: number
  expired: number
  assignable: number
}

export interface ShiftAssignmentCandidate {
  membershipId: string
  roleTypes: VolunteerRoleType[]
  isActive: boolean
}

export interface ShiftAssignmentValidationInput {
  shiftRoleType: VolunteerRoleType
  capacity: number
  currentAssignmentMembershipIds: string[]
  volunteer: ShiftAssignmentCandidate | null
}

export type ShiftAssignmentValidationResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | "missing_volunteer"
        | "inactive_volunteer"
        | "duplicate"
        | "capacity"
        | "role_mismatch"
      message: string
    }

export interface NormalizedShiftTimeInput {
  date: string
  startTime: string
  endTime: string
  timezone: string
}

export interface NormalizedShiftTimes {
  startTime: Date
  endTime: Date
}

const statusWeight: Record<CrewRosterStatus, number> = {
  active: 0,
  accepted: 1,
  pending: 2,
  inactive: 3,
  expired: 4,
}

export function parseCrewRosterMetadata(
  metadata: string | null | undefined,
): CrewRosterMetadata {
  if (!metadata) return {}

  try {
    const parsed = JSON.parse(metadata) as CrewRosterMetadata
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

export function normalizeCrewRosterRoleTypes(
  roleTypes: unknown,
): VolunteerRoleType[] {
  if (!Array.isArray(roleTypes)) return []

  return [...new Set(roleTypes)].filter(
    (roleType): roleType is VolunteerRoleType =>
      typeof roleType === "string" &&
      VOLUNTEER_ROLE_TYPE_VALUES.includes(roleType as VolunteerRoleType),
  )
}

export function getCrewRosterStatus(
  record:
    | ({ source: "team_membership" } & Pick<
        CrewVolunteerMembershipRecord,
        "isActive"
      >)
    | ({ source: "team_invitation" } & Pick<
        CrewVolunteerInvitationRecord,
        "acceptedAt" | "expiresAt" | "status"
      >),
  now = new Date(),
): CrewRosterStatus {
  if (record.source === "team_membership") {
    return record.isActive === false ? "inactive" : "active"
  }

  if (record.acceptedAt || record.status === INVITATION_STATUS.ACCEPTED) {
    return "accepted"
  }

  if (isPast(record.expiresAt, now)) {
    return "expired"
  }

  return "pending"
}

export function buildCrewRoster(
  invitations: CrewVolunteerInvitationRecord[],
  memberships: CrewVolunteerMembershipRecord[],
  now = new Date(),
): CrewRosterVolunteer[] {
  const invitationRows = invitations.map((invitation) =>
    toInvitationRosterRow(invitation, now),
  )
  const membershipRows = memberships.map((membership) =>
    toMembershipRosterRow(membership, now),
  )
  const membershipEmails = new Set(
    membershipRows.map((row) => row.email.toLowerCase()).filter(Boolean),
  )

  return [
    ...membershipRows,
    ...invitationRows.filter(
      (row) => !membershipEmails.has(row.email.toLowerCase()),
    ),
  ].sort(compareCrewRosterRows)
}

export function summarizeCrewRoster(
  roster: CrewRosterVolunteer[],
): CrewRosterSummary {
  return roster.reduce<CrewRosterSummary>(
    (summary, volunteer) => {
      summary.total += 1
      summary[volunteer.status] += 1
      if (volunteer.membershipId && volunteer.status === "active") {
        summary.assignable += 1
      }
      return summary
    },
    {
      total: 0,
      pending: 0,
      accepted: 0,
      active: 0,
      inactive: 0,
      expired: 0,
      assignable: 0,
    },
  )
}

export function validateShiftAssignment(
  input: ShiftAssignmentValidationInput,
): ShiftAssignmentValidationResult {
  const { volunteer } = input

  if (!volunteer) {
    return {
      ok: false,
      reason: "missing_volunteer",
      message: "Volunteer record was not found for this event.",
    }
  }

  if (!volunteer.isActive) {
    return {
      ok: false,
      reason: "inactive_volunteer",
      message: "Only active volunteers can be assigned to shifts.",
    }
  }

  if (input.currentAssignmentMembershipIds.includes(volunteer.membershipId)) {
    return {
      ok: false,
      reason: "duplicate",
      message: "Volunteer is already assigned to this shift.",
    }
  }

  if (input.currentAssignmentMembershipIds.length >= input.capacity) {
    return {
      ok: false,
      reason: "capacity",
      message: `Shift capacity (${input.capacity}) has been reached.`,
    }
  }

  if (
    !isVolunteerCompatibleWithShift(input.shiftRoleType, volunteer.roleTypes)
  ) {
    return {
      ok: false,
      reason: "role_mismatch",
      message: `Volunteer is not tagged for ${formatVolunteerRole(input.shiftRoleType)}.`,
    }
  }

  return { ok: true }
}

export function isVolunteerCompatibleWithShift(
  shiftRoleType: VolunteerRoleType,
  volunteerRoleTypes: VolunteerRoleType[],
) {
  return (
    volunteerRoleTypes.includes(shiftRoleType) ||
    volunteerRoleTypes.includes(VOLUNTEER_ROLE_TYPES.GENERAL)
  )
}

export function normalizeCrewShiftTimes(
  input: NormalizedShiftTimeInput,
): NormalizedShiftTimes {
  const startTime = parseTimeInTimezone(
    input.startTime,
    input.date,
    input.timezone,
  )
  const endTime = parseTimeInTimezone(input.endTime, input.date, input.timezone)

  if (!startTime || !endTime) {
    throw new Error("Enter a valid shift date and time.")
  }

  if (endTime <= startTime) {
    throw new Error("Shift end time must be after the start time.")
  }

  return { startTime, endTime }
}

export function formatVolunteerRole(roleType: VolunteerRoleType) {
  return VOLUNTEER_ROLE_LABELS[roleType] ?? roleType
}

export function formatVolunteerAvailability(
  availability: VolunteerAvailability | null,
) {
  if (availability === VOLUNTEER_AVAILABILITY.MORNING) return "Morning"
  if (availability === VOLUNTEER_AVAILABILITY.AFTERNOON) return "Afternoon"
  if (availability === VOLUNTEER_AVAILABILITY.ALL_DAY) return "All day"
  return "Not set"
}

function toInvitationRosterRow(
  invitation: CrewVolunteerInvitationRecord,
  now: Date,
): CrewRosterVolunteer {
  const metadata = parseCrewRosterMetadata(invitation.metadata)
  const roleTypes = normalizeCrewRosterRoleTypes(metadata.volunteerRoleTypes)

  return {
    id: `invitation:${invitation.id}`,
    source: "team_invitation",
    sourceId: invitation.id,
    membershipId: null,
    invitationId: invitation.id,
    email: metadata.signupEmail ?? invitation.email,
    name: getMetadataName(metadata) || invitation.email,
    phone: metadata.signupPhone ?? null,
    status: getCrewRosterStatus(
      { source: "team_invitation", ...invitation },
      now,
    ),
    roleTypes:
      roleTypes.length > 0 ? roleTypes : [VOLUNTEER_ROLE_TYPES.GENERAL],
    availability: metadata.availability ?? null,
    availabilityNotes: metadata.availabilityNotes ?? null,
    credentials: metadata.credentials ?? null,
    imported: Boolean(metadata.crewImportId),
    signupSource: metadata.crewSignupSource ?? metadata.inviteSource ?? null,
    createdAt: toNullableDate(invitation.createdAt),
    updatedAt: toNullableDate(invitation.updatedAt),
  }
}

function toMembershipRosterRow(
  membership: CrewVolunteerMembershipRecord,
  now: Date,
): CrewRosterVolunteer {
  const metadata = parseCrewRosterMetadata(membership.metadata)
  const roleTypes = normalizeCrewRosterRoleTypes(metadata.volunteerRoleTypes)
  const userName = [membership.user?.firstName, membership.user?.lastName]
    .filter(Boolean)
    .join(" ")
  const email = metadata.signupEmail ?? membership.user?.email ?? ""

  return {
    id: `membership:${membership.id}`,
    source: "team_membership",
    sourceId: membership.id,
    membershipId: membership.id,
    invitationId: null,
    email,
    name: getMetadataName(metadata) || userName || email || "Unknown",
    phone: metadata.signupPhone ?? null,
    status: getCrewRosterStatus(
      { source: "team_membership", ...membership },
      now,
    ),
    roleTypes:
      roleTypes.length > 0 ? roleTypes : [VOLUNTEER_ROLE_TYPES.GENERAL],
    availability: metadata.availability ?? null,
    availabilityNotes: metadata.availabilityNotes ?? null,
    credentials: metadata.credentials ?? null,
    imported: Boolean(metadata.crewImportId),
    signupSource: metadata.crewSignupSource ?? metadata.inviteSource ?? null,
    createdAt: toNullableDate(membership.createdAt),
    updatedAt: toNullableDate(membership.updatedAt),
  }
}

function getMetadataName(metadata: CrewRosterMetadata) {
  return metadata.signupName?.trim() || metadata.inviteName?.trim() || ""
}

function compareCrewRosterRows(
  left: CrewRosterVolunteer,
  right: CrewRosterVolunteer,
) {
  const statusDelta = statusWeight[left.status] - statusWeight[right.status]
  if (statusDelta !== 0) return statusDelta
  return (left.name || left.email).localeCompare(right.name || right.email)
}

function isPast(value: Date | string | null | undefined, now: Date) {
  const date = toNullableDate(value)
  return date ? date < now : false
}

function toNullableDate(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
