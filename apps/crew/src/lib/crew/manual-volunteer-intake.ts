// @lat: [[crew#Manual Volunteer Intake]]
import { INVITATION_STATUS } from "../../db/schemas/teams"
import type {
  VolunteerAvailability,
  VolunteerMembershipMetadata,
  VolunteerRoleType,
} from "../../db/schemas/volunteers"
import { VOLUNTEER_INVITE_SOURCE } from "../../db/schemas/volunteers"
import {
  getCrewRosterRoleTypes,
  parseCrewRosterMetadata,
} from "./roster-shifts"

export const MANUAL_VOLUNTEER_PASTE_BATCH_LIMIT = 500

export interface ManualVolunteerMetadataInput {
  email: string
  name?: string
  phone?: string
  roleTypes?: VolunteerRoleType[]
  availability?: VolunteerAvailability | ""
  availabilityNotes?: string
  notes?: string
}

export type ManualVolunteerMetadata = VolunteerMembershipMetadata & {
  crewSignupSource?: "manual_operator"
  manualCreatedAt?: string
}

export interface ManualVolunteerPasteValidRow {
  rowNumber: number
  email: string
}

export interface ManualVolunteerPasteSkippedRow {
  rowNumber: number
  email: string
  reason: "duplicate_in_paste"
}

export interface ManualVolunteerPasteInvalidRow {
  rowNumber: number
  value: string
  reason: "invalid_email" | "batch_limit"
}

export interface ManualVolunteerPasteParseResult {
  valid: ManualVolunteerPasteValidRow[]
  skipped: ManualVolunteerPasteSkippedRow[]
  invalid: ManualVolunteerPasteInvalidRow[]
}

export interface ExistingManualVolunteerInvitation {
  id: string
  email: string
  acceptedAt?: Date | string | null
  status?: string | null
  metadata?: string | null
}

export interface ExistingManualVolunteerMembership {
  id: string
  email?: string | null
  isActive?: boolean | null
  metadata?: string | null
}

export type ManualVolunteerIntakePlan =
  | {
      action: "create_invitation"
      targetId: null
    }
  | {
      action: "skip"
      targetId: string
      reason:
        | "pending_invitation"
        | "accepted_invitation"
        | "active_membership"
        | "inactive_membership"
      message: string
    }

export function normalizeManualVolunteerEmail(value: string) {
  return value.trim().toLowerCase()
}

export function parseManualVolunteerEmailPaste(
  pasteText: string,
  limit = MANUAL_VOLUNTEER_PASTE_BATCH_LIMIT,
): ManualVolunteerPasteParseResult {
  const result: ManualVolunteerPasteParseResult = {
    valid: [],
    skipped: [],
    invalid: [],
  }
  const seenEmails = new Set<string>()
  const values = pasteText
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean)

  values.forEach((value, index) => {
    const rowNumber = index + 1
    const email = normalizeManualVolunteerEmail(value)

    if (!isValidVolunteerEmail(email)) {
      result.invalid.push({ rowNumber, value, reason: "invalid_email" })
      return
    }

    if (seenEmails.has(email)) {
      result.skipped.push({ rowNumber, email, reason: "duplicate_in_paste" })
      return
    }

    if (result.valid.length >= limit) {
      result.invalid.push({ rowNumber, value, reason: "batch_limit" })
      return
    }

    seenEmails.add(email)
    result.valid.push({ rowNumber, email })
  })

  return result
}

export function buildManualVolunteerMetadata(
  input: ManualVolunteerMetadataInput,
  createdAt = new Date(),
): ManualVolunteerMetadata {
  const availability = input.availability || undefined

  return removeUndefined({
    volunteerRoleTypes: getCrewRosterRoleTypes(input.roleTypes),
    availability,
    availabilityNotes: emptyToUndefined(input.availabilityNotes),
    internalNotes: emptyToUndefined(input.notes),
    status: "pending" as const,
    inviteSource: VOLUNTEER_INVITE_SOURCE.DIRECT,
    signupEmail: normalizeManualVolunteerEmail(input.email),
    signupName: emptyToUndefined(input.name),
    signupPhone: emptyToUndefined(input.phone),
    crewSignupSource: "manual_operator" as const,
    manualCreatedAt: createdAt.toISOString(),
  })
}

export function planManualVolunteerIntake(
  emailInput: string,
  context: {
    existingInvitations: ExistingManualVolunteerInvitation[]
    existingMemberships: ExistingManualVolunteerMembership[]
  },
): ManualVolunteerIntakePlan {
  const email = normalizeManualVolunteerEmail(emailInput)
  const matchingMembership = context.existingMemberships.find((membership) =>
    getExistingMembershipEmails(membership).includes(email),
  )

  if (matchingMembership) {
    if (matchingMembership.isActive === false) {
      return {
        action: "skip",
        targetId: matchingMembership.id,
        reason: "inactive_membership",
        message: "A matching inactive volunteer membership already exists.",
      }
    }

    return {
      action: "skip",
      targetId: matchingMembership.id,
      reason: "active_membership",
      message: "A matching volunteer membership already exists.",
    }
  }

  const matchingInvitation = context.existingInvitations.find((invitation) =>
    getExistingInvitationEmails(invitation).includes(email),
  )

  if (matchingInvitation) {
    if (
      matchingInvitation.acceptedAt ||
      matchingInvitation.status === INVITATION_STATUS.ACCEPTED
    ) {
      return {
        action: "skip",
        targetId: matchingInvitation.id,
        reason: "accepted_invitation",
        message: "A matching accepted volunteer invitation already exists.",
      }
    }

    return {
      action: "skip",
      targetId: matchingInvitation.id,
      reason: "pending_invitation",
      message: "A matching pending volunteer invitation already exists.",
    }
  }

  return { action: "create_invitation", targetId: null }
}

export function getExistingInvitationEmails(
  invitation: ExistingManualVolunteerInvitation,
) {
  return normalizeExistingEmails(invitation.email, invitation.metadata)
}

export function getExistingMembershipEmails(
  membership: ExistingManualVolunteerMembership,
) {
  return normalizeExistingEmails(membership.email, membership.metadata)
}

function normalizeExistingEmails(
  email: string | null | undefined,
  metadata: string | null | undefined,
) {
  const parsed = parseCrewRosterMetadata(metadata)
  return [
    normalizeManualVolunteerEmail(email ?? ""),
    normalizeManualVolunteerEmail(parsed.signupEmail ?? ""),
  ].filter(Boolean)
}

function isValidVolunteerEmail(email: string) {
  if (email.length === 0 || email.length > 255) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function emptyToUndefined(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function removeUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T
}
