// @lat: [[crew#Assignment Confirmation Responses]]
// @lat: [[crew#Assignment Confirmations]]
// @lat: [[crew#Confirmation Emails And Reminders]]
import {
  CREW_ASSIGNMENT_CONFIRMATION_STATUS,
  type CrewAssignmentConfirmationStatus,
} from "../../db/schemas/crew-imports"

export type CrewAssignmentTokenState = "valid" | "missing" | "expired" | "bad"

export type CrewAssignmentResponseAction =
  | "confirm"
  | "decline"
  | "request_change"

export interface CrewAssignmentConfirmationTokenRecord {
  tokenHash?: string | null
  status?: CrewAssignmentConfirmationStatus | string | null
  expiresAt?: Date | string | null
}

export interface CrewAssignmentConfirmationResponseRecord {
  status: CrewAssignmentConfirmationStatus
  expiresAt: Date | string | null
  responseNote?: string | null
}

export interface CrewAssignmentConfirmationStatusSummary {
  pending: number
  confirmed: number
  declined: number
  changeRequested: number
  noShow: number
  cancelled: number
}

export type CrewAssignmentConfirmationOperationalState =
  | "missing"
  | "pending"
  | "sent"
  | "confirmed"
  | "declined"
  | "change_requested"
  | "no_show"
  | "replaced"

export type CrewAssignmentConfirmationOrganizerState = Exclude<
  CrewAssignmentConfirmationOperationalState,
  "missing"
>

export interface CrewAssignmentConfirmationOperationalRecord {
  status?: CrewAssignmentConfirmationStatus | string | null
  sentAt?: Date | string | null
}

export type CrewAssignmentConfirmationEmailOperationMode =
  | "confirmations"
  | "reminders"

export type CrewAssignmentConfirmationEmailOperationKind =
  | "confirmation"
  | "reminder-48-hour"
  | "reminder-24-hour"

export interface CrewAssignmentConfirmationEmailCandidate {
  confirmationId: string
  assignmentId: string
  status: CrewAssignmentConfirmationStatus
  email?: string | null
  sentAt?: Date | string | null
  respondedAt?: Date | string | null
  lastReminderAt?: Date | string | null
  reminderCount?: number | null
  shiftStartTime: Date | string
}

export interface CrewAssignmentConfirmationEmailOperation {
  kind: CrewAssignmentConfirmationEmailOperationKind
  confirmationId: string
  assignmentId: string
  email: string
  reminderCount: number
  idempotencyKey: string
}

export interface CrewAssignmentConfirmationEmailPlan {
  operations: CrewAssignmentConfirmationEmailOperation[]
  skipped: {
    responded: number
    missingEmail: number
    alreadySent: number
    notDue: number
    pastShift: number
  }
}

export interface CrewAssignmentEmailQueueMessage {
  kind: "crew-assignment-confirmation" | "crew-assignment-reminder"
  confirmationId: string
  assignmentId: string
  competitionId: string
  email: string
  subject: string
  bodyHtml: string
  idempotencyKey: string
  reminderCount: number
  queuedAtIso: string
  replyTo?: string
}

export interface CrewAssignmentConfirmationOperationalSummary {
  missing: number
  pending: number
  sent: number
  confirmed: number
  declined: number
  changeRequested: number
  noShow: number
  replaced: number
  total: number
  responseNeeded: number
  organizerActionNeeded: number
}

export interface CrewAssignmentConfirmationOrganizerStateUpdate {
  status: CrewAssignmentConfirmationStatus
  sentAt: Date | null
  respondedAt: Date | null
  responseNote: string | null
}

export const CREW_ASSIGNMENT_CONFIRMATION_TOKEN_BYTES = 32
export const CREW_ASSIGNMENT_CONFIRMATION_TOKEN_HASH_PREFIX = "sha256:"
export const CREW_ASSIGNMENT_CONFIRMATION_REMINDER_48_HOURS = 48
export const CREW_ASSIGNMENT_CONFIRMATION_REMINDER_24_HOURS = 24
export const CREW_ASSIGNMENT_CONFIRMATION_ORGANIZER_STATES = [
  "pending",
  "sent",
  "confirmed",
  "declined",
  "change_requested",
  "no_show",
  "replaced",
] as const satisfies CrewAssignmentConfirmationOrganizerState[]

export function generateCrewAssignmentConfirmationToken(
  byteLength = CREW_ASSIGNMENT_CONFIRMATION_TOKEN_BYTES,
) {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return bytesToBase64Url(bytes)
}

export async function hashCrewAssignmentConfirmationToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  )
  return `${CREW_ASSIGNMENT_CONFIRMATION_TOKEN_HASH_PREFIX}${bytesToHex(
    new Uint8Array(digest),
  )}`
}

export function getCrewAssignmentConfirmationTokenState(
  record: CrewAssignmentConfirmationTokenRecord | null | undefined,
  now = new Date(),
): CrewAssignmentTokenState {
  if (!record?.tokenHash) return "missing"
  if (record.status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED) {
    return "bad"
  }
  if (!record.expiresAt) return "bad"

  const expiresAt =
    record.expiresAt instanceof Date
      ? record.expiresAt
      : new Date(record.expiresAt)
  if (Number.isNaN(expiresAt.getTime())) return "bad"
  if (
    expiresAt.getTime() <= now.getTime() &&
    record.status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING
  ) {
    return "expired"
  }

  return "valid"
}

export function statusForCrewAssignmentResponseAction(
  action: CrewAssignmentResponseAction,
): CrewAssignmentConfirmationStatus {
  if (action === "confirm") {
    return CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED
  }
  if (action === "decline") {
    return CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED
  }
  return CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHANGE_REQUESTED
}

export type CrewAssignmentConfirmationResponseResolution =
  | {
      ok: true
      outcome: "updated"
      status: CrewAssignmentConfirmationStatus
      responseNote: string | null
      respondedAt: Date
    }
  | {
      ok: true
      outcome: "idempotent"
      status: CrewAssignmentConfirmationStatus
      responseNote: string | null
      respondedAt: Date | null
    }
  | {
      ok: false
      reason: "expired" | "cancelled" | "already_responded" | "missing_note"
      status: CrewAssignmentConfirmationStatus
      message: string
    }

export function resolveCrewAssignmentConfirmationResponse(
  record: CrewAssignmentConfirmationResponseRecord,
  action: CrewAssignmentResponseAction,
  note: string | null | undefined,
  now = new Date(),
): CrewAssignmentConfirmationResponseResolution {
  const tokenState = getCrewAssignmentConfirmationTokenState(
    {
      tokenHash: "validated",
      status: record.status,
      expiresAt: record.expiresAt,
    },
    now,
  )

  if (tokenState === "expired") {
    return {
      ok: false,
      reason: "expired",
      status: record.status,
      message: "This assignment response link has expired.",
    }
  }

  if (record.status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED) {
    return {
      ok: false,
      reason: "cancelled",
      status: record.status,
      message: "This assignment confirmation has been cancelled.",
    }
  }

  const nextStatus = statusForCrewAssignmentResponseAction(action)
  const actionRequiresNote =
    nextStatus === CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED ||
    nextStatus === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHANGE_REQUESTED
  const responseNote = actionRequiresNote ? normalizeResponseNote(note) : null

  if (actionRequiresNote && !responseNote) {
    return {
      ok: false,
      reason: "missing_note",
      status: record.status,
      message:
        nextStatus === CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED
          ? "Add a note before declining this assignment."
          : "Add a note before requesting a change.",
    }
  }

  if (record.status === nextStatus) {
    const existingNote =
      nextStatus === CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED ||
      nextStatus === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHANGE_REQUESTED
        ? normalizeResponseNote(record.responseNote)
        : null
    return {
      ok: true,
      outcome: "idempotent",
      status: record.status,
      responseNote: existingNote,
      respondedAt: null,
    }
  }

  if (record.status !== CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING) {
    return {
      ok: false,
      reason: "already_responded",
      status: record.status,
      message: "This assignment response has already been submitted.",
    }
  }

  return {
    ok: true,
    outcome: "updated",
    status: nextStatus,
    responseNote,
    respondedAt: now,
  }
}

export function summarizeCrewAssignmentConfirmations(
  statuses: Array<CrewAssignmentConfirmationStatus | null | undefined>,
): CrewAssignmentConfirmationStatusSummary {
  return statuses.reduce<CrewAssignmentConfirmationStatusSummary>(
    (summary, status) => {
      if (status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED) {
        summary.confirmed += 1
      } else if (status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED) {
        summary.declined += 1
      } else if (
        status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHANGE_REQUESTED
      ) {
        summary.changeRequested += 1
      } else if (status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.NO_SHOW) {
        summary.noShow += 1
      } else if (status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED) {
        summary.cancelled += 1
      } else {
        summary.pending += 1
      }
      return summary
    },
    {
      pending: 0,
      confirmed: 0,
      declined: 0,
      changeRequested: 0,
      noShow: 0,
      cancelled: 0,
    },
  )
}

export function getCrewAssignmentConfirmationOperationalState(
  record: CrewAssignmentConfirmationOperationalRecord | null | undefined,
): CrewAssignmentConfirmationOperationalState {
  if (!record?.status) return "missing"
  if (record.status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED) {
    return "confirmed"
  }
  if (record.status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED) {
    return "declined"
  }
  if (record.status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHANGE_REQUESTED) {
    return "change_requested"
  }
  if (record.status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.NO_SHOW) {
    return "no_show"
  }
  if (record.status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED) {
    return "replaced"
  }
  return record.sentAt ? "sent" : "pending"
}

export function summarizeCrewAssignmentConfirmationOperationalStates(
  confirmations: Array<
    CrewAssignmentConfirmationOperationalRecord | null | undefined
  >,
): CrewAssignmentConfirmationOperationalSummary {
  return confirmations.reduce<CrewAssignmentConfirmationOperationalSummary>(
    (summary, confirmation) => {
      const state = getCrewAssignmentConfirmationOperationalState(confirmation)
      if (state === "missing") summary.missing += 1
      else if (state === "pending") summary.pending += 1
      else if (state === "sent") summary.sent += 1
      else if (state === "confirmed") summary.confirmed += 1
      else if (state === "declined") summary.declined += 1
      else if (state === "change_requested") summary.changeRequested += 1
      else if (state === "no_show") summary.noShow += 1
      else summary.replaced += 1

      summary.total += 1
      summary.responseNeeded = summary.missing + summary.pending + summary.sent
      summary.organizerActionNeeded =
        summary.missing +
        summary.pending +
        summary.sent +
        summary.declined +
        summary.changeRequested +
        summary.noShow +
        summary.replaced
      return summary
    },
    {
      missing: 0,
      pending: 0,
      sent: 0,
      confirmed: 0,
      declined: 0,
      changeRequested: 0,
      noShow: 0,
      replaced: 0,
      total: 0,
      responseNeeded: 0,
      organizerActionNeeded: 0,
    },
  )
}

export function buildCrewAssignmentConfirmationEmailPlan(params: {
  candidates: CrewAssignmentConfirmationEmailCandidate[]
  mode: CrewAssignmentConfirmationEmailOperationMode
  now?: Date
}): CrewAssignmentConfirmationEmailPlan {
  const now = params.now ?? new Date()
  const plan: CrewAssignmentConfirmationEmailPlan = {
    operations: [],
    skipped: {
      responded: 0,
      missingEmail: 0,
      alreadySent: 0,
      notDue: 0,
      pastShift: 0,
    },
  }

  for (const candidate of params.candidates) {
    const email = normalizeConfirmationEmailForSend(candidate.email)
    if (candidate.status !== CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING) {
      plan.skipped.responded += 1
      continue
    }
    if (!email) {
      plan.skipped.missingEmail += 1
      continue
    }

    const sentAt = toValidDate(candidate.sentAt)
    const shiftStartTime = toValidDate(candidate.shiftStartTime)

    if (!shiftStartTime || shiftStartTime.getTime() <= now.getTime()) {
      plan.skipped.pastShift += 1
      continue
    }

    if (params.mode === "confirmations") {
      if (sentAt) {
        plan.skipped.alreadySent += 1
        continue
      }
      plan.operations.push({
        kind: "confirmation",
        confirmationId: candidate.confirmationId,
        assignmentId: candidate.assignmentId,
        email,
        reminderCount: 0,
        idempotencyKey: buildCrewAssignmentEmailIdempotencyKey(
          candidate.confirmationId,
          0,
        ),
      })
      continue
    }

    if (!sentAt) {
      plan.skipped.notDue += 1
      continue
    }

    const reminder = getCrewAssignmentReminderOperationKind({
      shiftStartTime,
      reminderCount: candidate.reminderCount ?? 0,
      now,
    })

    if (!reminder) {
      plan.skipped.notDue += 1
      continue
    }

    plan.operations.push({
      kind: reminder.kind,
      confirmationId: candidate.confirmationId,
      assignmentId: candidate.assignmentId,
      email,
      reminderCount: reminder.reminderCount,
      idempotencyKey: buildCrewAssignmentEmailIdempotencyKey(
        candidate.confirmationId,
        reminder.reminderCount,
      ),
    })
  }

  return plan
}

export function buildCrewAssignmentEmailIdempotencyKey(
  confirmationId: string,
  reminderCount: number,
) {
  return `crew-confirmation-${confirmationId}-${reminderCount}`
}

export function normalizeConfirmationEmailForSend(
  value: string | null | undefined,
) {
  const trimmed = value?.trim().toLowerCase()
  if (!trimmed || !trimmed.includes("@")) return null
  return trimmed
}

function getCrewAssignmentReminderOperationKind(params: {
  shiftStartTime: Date
  reminderCount: number
  now: Date
}): {
  kind: "reminder-48-hour" | "reminder-24-hour"
  reminderCount: number
} | null {
  const hoursUntilShift =
    (params.shiftStartTime.getTime() - params.now.getTime()) / (60 * 60 * 1000)

  if (
    hoursUntilShift <= CREW_ASSIGNMENT_CONFIRMATION_REMINDER_24_HOURS &&
    params.reminderCount < 2
  ) {
    return { kind: "reminder-24-hour", reminderCount: 2 }
  }

  if (
    hoursUntilShift <= CREW_ASSIGNMENT_CONFIRMATION_REMINDER_48_HOURS &&
    params.reminderCount < 1
  ) {
    return { kind: "reminder-48-hour", reminderCount: 1 }
  }

  return null
}

function toValidDate(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function resolveCrewAssignmentConfirmationOrganizerStateUpdate(
  state: CrewAssignmentConfirmationOrganizerState,
  note: string | null | undefined,
  now = new Date(),
  current?: CrewAssignmentConfirmationOperationalRecord | null,
): CrewAssignmentConfirmationOrganizerStateUpdate {
  if (state === "pending") {
    return {
      status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
      sentAt: null,
      respondedAt: null,
      responseNote: null,
    }
  }

  if (state === "sent") {
    return {
      status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
      sentAt: now,
      respondedAt: null,
      responseNote: null,
    }
  }

  if (state === "replaced") {
    return {
      status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED,
      sentAt: normalizeDateOrNull(current?.sentAt),
      respondedAt: null,
      responseNote: normalizeResponseNote(note),
    }
  }

  const status =
    state === "confirmed"
      ? CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED
      : state === "declined"
        ? CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED
        : state === "no_show"
          ? CREW_ASSIGNMENT_CONFIRMATION_STATUS.NO_SHOW
          : CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHANGE_REQUESTED

  return {
    status,
    sentAt: normalizeDateOrNull(current?.sentAt),
    respondedAt: now,
    responseNote:
      status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHANGE_REQUESTED
        ? normalizeResponseNote(note)
        : null,
  }
}

export function buildCrewAssignmentConfirmationUrls(params: {
  appUrl: string
  slug: string
  token: string
}) {
  const base = params.appUrl.replace(/\/$/, "")
  const slug = encodeURIComponent(params.slug)
  const token = encodeURIComponent(params.token)
  return {
    confirmUrl: `${base}/e/${slug}/confirm/${token}`,
    scheduleUrl: `${base}/e/${slug}/schedule/${token}`,
  }
}

export function normalizeResponseNote(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, 1000) : null
}

function normalizeDateOrNull(value: Date | string | null | undefined) {
  if (!value) return null
  if (value instanceof Date) return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "")
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  )
}
