import { z } from "zod"
import { INVITATION_STATUS } from "../../db/schemas/teams"
import {
  VOLUNTEER_AVAILABILITY,
  VOLUNTEER_INVITE_SOURCE,
  VOLUNTEER_ROLE_TYPES,
  VOLUNTEER_ROLE_TYPE_VALUES,
  type VolunteerMembershipMetadata,
  type VolunteerRoleType,
} from "../../db/schemas/volunteers"

const volunteerAvailabilityValues = [
  VOLUNTEER_AVAILABILITY.MORNING,
  VOLUNTEER_AVAILABILITY.AFTERNOON,
  VOLUNTEER_AVAILABILITY.ALL_DAY,
] as const

export const crewVolunteerSignupInputSchema = z.object({
  eventSlug: z.string().trim().min(1, "Event slug is required").max(255),
  signupName: z.string().trim().min(1, "Name is required").max(200),
  signupEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .max(255),
  signupPhone: z.string().trim().max(50).optional(),
  credentials: z.string().trim().max(5000).optional(),
  availability: z.enum(volunteerAvailabilityValues),
  availabilityNotes: z.string().trim().max(5000).optional(),
  roleTypes: z.array(z.enum(VOLUNTEER_ROLE_TYPE_VALUES)).max(12).optional(),
  answers: z
    .array(
      z.object({
        questionId: z.string().trim().min(1),
        answer: z.string().trim().max(5000),
      }),
    )
    .max(50)
    .optional(),
  waiverIds: z.array(z.string().startsWith("waiv_")).max(50).optional(),
  website: z.string().optional(),
})

export type CrewVolunteerSignupInput = z.infer<
  typeof crewVolunteerSignupInputSchema
>

export interface CrewVolunteerRequiredQuestion {
  id: string
  label: string
  required: boolean
}

export interface ExistingCrewVolunteerInvitation {
  id: string
  email: string
  acceptedAt?: Date | null
  status?: string | null
  metadata?: string | null
}

export interface ExistingCrewVolunteerMembership {
  id: string
  email: string
  isActive?: boolean | null
}

export type CrewVolunteerSignupPlan =
  | {
      action: "create_invitation"
      targetId: null
    }
  | {
      action: "update_invitation"
      targetId: string
    }
  | {
      action: "reject"
      targetId: string | null
      reason:
        | "accepted_invitation"
        | "active_membership"
        | "inactive_membership"
      message: string
    }

export interface CrewVolunteerTokenRecord {
  token?: string | null
  expiresAt?: Date | string | null
  status?: string | null
}

export type CrewVolunteerTokenState = "valid" | "missing" | "expired" | "bad"

export type CrewVolunteerSignupMetadata = VolunteerMembershipMetadata & {
  signupWaiverIds?: string[]
  signupWaiverAgreedAt?: string
  signupSubmittedAt?: string
  crewSignupSource?: "public_no_password"
}

export function normalizeVolunteerSignupEmail(value: string) {
  return value.trim().toLowerCase()
}

export function isCrewVolunteerSignupSpam(
  input: Pick<CrewVolunteerSignupInput, "website">,
) {
  return !!input.website?.trim()
}

export function normalizeCrewVolunteerRoleTypes(
  roleTypes: VolunteerRoleType[] | undefined,
): VolunteerRoleType[] {
  const normalized = [...new Set(roleTypes ?? [])].filter((roleType) =>
    VOLUNTEER_ROLE_TYPE_VALUES.includes(roleType),
  )

  return normalized.length > 0 ? normalized : [VOLUNTEER_ROLE_TYPES.GENERAL]
}

export function validateCrewVolunteerSignupRequirements(
  input: Pick<CrewVolunteerSignupInput, "answers" | "waiverIds">,
  requirements: {
    questions: CrewVolunteerRequiredQuestion[]
    requiredWaiverIds: string[]
  },
) {
  const errors: string[] = []
  const answersByQuestionId = new Map(
    (input.answers ?? [])
      .map((answer) => [answer.questionId, answer.answer.trim()] as const)
      .filter(([, answer]) => answer.length > 0),
  )

  for (const question of requirements.questions) {
    if (!question.required) continue
    if (!answersByQuestionId.has(question.id)) {
      errors.push(`Please answer the required question: "${question.label}"`)
    }
  }

  const agreedWaiverIds = new Set(input.waiverIds ?? [])
  for (const waiverId of requirements.requiredWaiverIds) {
    if (!agreedWaiverIds.has(waiverId)) {
      errors.push("Please agree to all required waivers before volunteering")
      break
    }
  }

  return errors
}

export function buildCrewVolunteerSignupMetadata(
  input: CrewVolunteerSignupInput,
  submittedAt = new Date(),
): CrewVolunteerSignupMetadata {
  const waiverIds = [...new Set(input.waiverIds ?? [])]
  return removeUndefined({
    volunteerRoleTypes: normalizeCrewVolunteerRoleTypes(input.roleTypes),
    credentials: emptyToUndefined(input.credentials),
    availability: input.availability,
    availabilityNotes: emptyToUndefined(input.availabilityNotes),
    status: "pending" as const,
    inviteSource: VOLUNTEER_INVITE_SOURCE.APPLICATION,
    signupEmail: normalizeVolunteerSignupEmail(input.signupEmail),
    signupName: input.signupName.trim(),
    signupPhone: emptyToUndefined(input.signupPhone),
    signupWaiverIds: waiverIds.length > 0 ? waiverIds : undefined,
    signupWaiverAgreedAt:
      waiverIds.length > 0 ? submittedAt.toISOString() : undefined,
    signupSubmittedAt: submittedAt.toISOString(),
    crewSignupSource: "public_no_password" as const,
  })
}

export function mergeCrewVolunteerSignupMetadata(
  existingMetadata: string | null | undefined,
  signupMetadata: CrewVolunteerSignupMetadata,
) {
  if (!existingMetadata) return JSON.stringify(signupMetadata)

  try {
    const existing = JSON.parse(existingMetadata) as Record<string, unknown>
    return JSON.stringify({
      ...existing,
      ...signupMetadata,
      internalNotes: existing.internalNotes,
      crewImportId: existing.crewImportId,
    })
  } catch {
    return JSON.stringify(signupMetadata)
  }
}

export function planCrewVolunteerSignup(
  input: Pick<CrewVolunteerSignupInput, "signupEmail">,
  context: {
    existingInvitations: ExistingCrewVolunteerInvitation[]
    existingMemberships: ExistingCrewVolunteerMembership[]
  },
): CrewVolunteerSignupPlan {
  const email = normalizeVolunteerSignupEmail(input.signupEmail)
  const existingMembership = context.existingMemberships.find(
    (membership) => normalizeVolunteerSignupEmail(membership.email) === email,
  )

  if (existingMembership) {
    if (existingMembership.isActive === false) {
      return {
        action: "reject",
        targetId: existingMembership.id,
        reason: "inactive_membership",
        message:
          "This email is already tied to an inactive volunteer record. Please contact the organizer.",
      }
    }

    return {
      action: "reject",
      targetId: existingMembership.id,
      reason: "active_membership",
      message: "This email is already on the volunteer roster for this event.",
    }
  }

  const existingInvitation = context.existingInvitations.find(
    (invitation) => normalizeVolunteerSignupEmail(invitation.email) === email,
  )

  if (!existingInvitation) {
    return { action: "create_invitation", targetId: null }
  }

  if (
    existingInvitation.acceptedAt ||
    existingInvitation.status === INVITATION_STATUS.ACCEPTED
  ) {
    return {
      action: "reject",
      targetId: existingInvitation.id,
      reason: "accepted_invitation",
      message:
        "This email has already accepted a volunteer invitation for this event.",
    }
  }

  return {
    action: "update_invitation",
    targetId: existingInvitation.id,
  }
}

export function getCrewVolunteerTokenState(
  record: CrewVolunteerTokenRecord | null | undefined,
  now = new Date(),
): CrewVolunteerTokenState {
  if (!record?.token) return "missing"
  if (record.status === INVITATION_STATUS.CANCELLED) return "bad"
  if (!record.expiresAt) return "bad"

  const expiresAt =
    record.expiresAt instanceof Date
      ? record.expiresAt
      : new Date(record.expiresAt)
  if (Number.isNaN(expiresAt.getTime())) return "bad"
  if (expiresAt.getTime() <= now.getTime()) return "expired"

  return "valid"
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
