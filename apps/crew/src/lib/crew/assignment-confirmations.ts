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

export const CREW_ASSIGNMENT_CONFIRMATION_TOKEN_BYTES = 32
export const CREW_ASSIGNMENT_CONFIRMATION_TOKEN_HASH_PREFIX = "sha256:"

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
      reason: "expired" | "cancelled" | "already_responded"
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
  const responseNote =
    nextStatus === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHANGE_REQUESTED
      ? normalizeResponseNote(note)
      : null

  if (record.status === nextStatus) {
    const existingNote =
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

function normalizeResponseNote(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, 1000) : null
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
