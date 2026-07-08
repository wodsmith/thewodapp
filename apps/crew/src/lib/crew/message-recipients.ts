// @lat: [[crew#Volunteer Messaging Composer#Filtered recipient selection]]
import {
  CREW_ASSIGNMENT_CONFIRMATION_STATUS,
  type CrewAssignmentConfirmationStatus,
} from "../../db/schemas/crew-imports"
import type { VolunteerRoleType } from "../../db/schemas/volunteers"
import {
  getCrewAssignmentReminderOperationKind,
  normalizeConfirmationEmailForSend,
} from "./assignment-confirmations"

/**
 * Mode for a crew message send. `assignment_confirmation` and `reminder` map to
 * the existing confirmation-email machinery (per-assignment, token-backed);
 * `custom_broadcast` is a free-form message deduplicated by volunteer email.
 */
export type CrewMessageMode =
  | "assignment_confirmation"
  | "reminder"
  | "custom_broadcast"

/**
 * Operational state of a volunteer's assignment. Mirrors the communication
 * dashboard states — `not_ready` stands in for a missing confirmation row.
 */
export const CREW_MESSAGE_RECIPIENT_STATES = [
  "not_ready",
  "pending",
  "sent",
  "confirmed",
  "checked_in",
  "declined",
  "change_requested",
  "no_show",
  "replaced",
] as const

export type CrewMessageRecipientState =
  (typeof CREW_MESSAGE_RECIPIENT_STATES)[number]

export type CrewMessageRecipientSkipReason =
  | "missing_email"
  | "already_sent"
  | "responded"
  | "not_due"
  | "past_shift"

export interface CrewMessageRecipient {
  /** Stable key: confirmationId for assignment sends, `email:<address>` for broadcasts. */
  key: string
  volunteerName: string
  volunteerEmail: string | null
  shiftName: string
  roleLabel: string
  startsAt: Date
  state: CrewMessageRecipientState
  eligible: boolean
  skipReason: CrewMessageRecipientSkipReason | null
}

export interface CrewMessageRecipientSkipSummary {
  missingEmail: number
  alreadySent: number
  responded: number
  notDue: number
  pastShift: number
}

/**
 * Per-assignment candidate row used to derive confirmation/reminder recipients.
 * Sourced from crew assignments joined to their confirmation record.
 */
export interface CrewMessageAssignmentCandidate {
  assignmentId: string
  confirmationId: string
  membershipId: string | null
  invitationId: string | null
  volunteerName: string
  volunteerEmail: string | null
  shiftId: string
  shiftName: string
  roleType: VolunteerRoleType
  roleLabel: string
  startsAt: Date
  state: CrewMessageRecipientState
  status: CrewAssignmentConfirmationStatus
  sentAt: Date | null
  reminderCount: number
}

export interface CrewMessageFilters {
  states?: CrewMessageRecipientState[]
  roles?: string[]
  shiftIds?: string[]
  includeAlreadySent?: boolean
  search?: string
}

export interface CrewMessageRecipientClassification {
  eligible: boolean
  skipReason: CrewMessageRecipientSkipReason | null
  /** Reminder count the send should record (0 for confirmations, 1/2 for reminders). */
  reminderCount: number
}

/**
 * Classify a candidate for a confirmation or reminder send. The ordering of
 * checks matches `buildCrewAssignmentConfirmationEmailPlan` so preview and send
 * agree on eligibility.
 */
export function classifyCrewMessageRecipient(params: {
  candidate: CrewMessageAssignmentCandidate
  mode: "assignment_confirmation" | "reminder"
  now: Date
}): CrewMessageRecipientClassification {
  const { candidate, mode, now } = params
  const email = normalizeConfirmationEmailForSend(candidate.volunteerEmail)

  if (candidate.status !== CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING) {
    return { eligible: false, skipReason: "responded", reminderCount: 0 }
  }

  if (!email) {
    return { eligible: false, skipReason: "missing_email", reminderCount: 0 }
  }

  if (candidate.startsAt.getTime() <= now.getTime()) {
    return { eligible: false, skipReason: "past_shift", reminderCount: 0 }
  }

  if (mode === "assignment_confirmation") {
    if (candidate.sentAt) {
      return { eligible: false, skipReason: "already_sent", reminderCount: 0 }
    }
    return { eligible: true, skipReason: null, reminderCount: 0 }
  }

  if (!candidate.sentAt) {
    return { eligible: false, skipReason: "not_due", reminderCount: 0 }
  }

  const reminder = getCrewAssignmentReminderOperationKind({
    shiftStartTime: candidate.startsAt,
    reminderCount: candidate.reminderCount,
    now,
  })
  if (!reminder) {
    return { eligible: false, skipReason: "not_due", reminderCount: 0 }
  }

  return {
    eligible: true,
    skipReason: null,
    reminderCount: reminder.reminderCount,
  }
}

/**
 * Apply the composer's filter controls to the candidate pool. Filters are ANDed;
 * a filter with no values is treated as "no constraint".
 */
export function filterCrewMessageCandidates(
  candidates: CrewMessageAssignmentCandidate[],
  filters: CrewMessageFilters,
): CrewMessageAssignmentCandidate[] {
  const states =
    filters.states && filters.states.length > 0 ? new Set(filters.states) : null
  const roles =
    filters.roles && filters.roles.length > 0 ? new Set(filters.roles) : null
  const shiftIds =
    filters.shiftIds && filters.shiftIds.length > 0
      ? new Set(filters.shiftIds)
      : null
  const search = filters.search?.trim().toLowerCase()

  return candidates.filter((candidate) => {
    if (states && !states.has(candidate.state)) return false
    if (roles && !roles.has(candidate.roleType)) return false
    if (shiftIds && !shiftIds.has(candidate.shiftId)) return false
    if (search) {
      const haystack = `${candidate.volunteerName} ${
        candidate.volunteerEmail ?? ""
      }`.toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })
}

/**
 * Build a per-recipient list plus aggregate skip counts for a confirmation or
 * reminder preview. Already-sent rows are hidden unless `includeAlreadySent`.
 */
export function buildCrewAssignmentMessageRecipients(params: {
  candidates: CrewMessageAssignmentCandidate[]
  mode: "assignment_confirmation" | "reminder"
  includeAlreadySent: boolean
  now: Date
}): {
  recipients: CrewMessageRecipient[]
  skipped: CrewMessageRecipientSkipSummary
} {
  const classified: CrewMessageRecipient[] = []
  for (const candidate of params.candidates) {
    const classification = classifyCrewMessageRecipient({
      candidate,
      mode: params.mode,
      now: params.now,
    })
    classified.push({
      key: candidate.confirmationId,
      volunteerName: candidate.volunteerName,
      volunteerEmail: candidate.volunteerEmail,
      shiftName: candidate.shiftName,
      roleLabel: candidate.roleLabel,
      startsAt: candidate.startsAt,
      state: candidate.state,
      eligible: classification.eligible,
      skipReason: classification.skipReason,
    })
  }
  // Already-sent rows are hidden from the list unless requested, but still
  // counted in the skip summary so the totals reflect every candidate.
  const recipients = params.includeAlreadySent
    ? classified
    : classified.filter((recipient) => recipient.skipReason !== "already_sent")
  return {
    recipients,
    skipped: summarizeCrewMessageSkips(classified),
  }
}

export function summarizeCrewMessageSkips(
  recipients: CrewMessageRecipient[],
): CrewMessageRecipientSkipSummary {
  const summary: CrewMessageRecipientSkipSummary = {
    missingEmail: 0,
    alreadySent: 0,
    responded: 0,
    notDue: 0,
    pastShift: 0,
  }
  for (const recipient of recipients) {
    switch (recipient.skipReason) {
      case "missing_email":
        summary.missingEmail += 1
        break
      case "already_sent":
        summary.alreadySent += 1
        break
      case "responded":
        summary.responded += 1
        break
      case "not_due":
        summary.notDue += 1
        break
      case "past_shift":
        summary.pastShift += 1
        break
      default:
        break
    }
  }
  return summary
}

/**
 * Deduplicate candidates into unique-by-email broadcast recipients. Filters are
 * applied at the assignment level before dedup, so a volunteer with any matching
 * shift is included once. Eligibility only requires a usable email.
 */
export function buildCrewBroadcastMessageRecipients(
  candidates: CrewMessageAssignmentCandidate[],
): {
  recipients: CrewMessageRecipient[]
  skipped: CrewMessageRecipientSkipSummary
} {
  const byEmail = new Map<string, CrewMessageRecipient>()
  const noEmail: CrewMessageRecipient[] = []

  for (const candidate of candidates) {
    const email = normalizeConfirmationEmailForSend(candidate.volunteerEmail)
    if (!email) {
      noEmail.push({
        key: `assignment:${candidate.assignmentId}`,
        volunteerName: candidate.volunteerName,
        volunteerEmail: candidate.volunteerEmail,
        shiftName: candidate.shiftName,
        roleLabel: candidate.roleLabel,
        startsAt: candidate.startsAt,
        state: candidate.state,
        eligible: false,
        skipReason: "missing_email",
      })
      continue
    }
    if (byEmail.has(email)) {
      // Keep the earliest shift for display context.
      const existing = byEmail.get(email)
      if (existing && candidate.startsAt < existing.startsAt) {
        existing.shiftName = candidate.shiftName
        existing.roleLabel = candidate.roleLabel
        existing.startsAt = candidate.startsAt
        existing.state = candidate.state
      }
      continue
    }
    byEmail.set(email, {
      key: `email:${email}`,
      volunteerName: candidate.volunteerName,
      volunteerEmail: candidate.volunteerEmail,
      shiftName: candidate.shiftName,
      roleLabel: candidate.roleLabel,
      startsAt: candidate.startsAt,
      state: candidate.state,
      eligible: true,
      skipReason: null,
    })
  }

  const recipients = [...byEmail.values(), ...noEmail]
  return {
    recipients,
    skipped: summarizeCrewMessageSkips(recipients),
  }
}
