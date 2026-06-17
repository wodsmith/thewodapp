/**
 * Pure, deterministic validation for organizer file-drop proposals.
 *
 * These run in BOTH the agent's proposal tools (to attach match info + warnings
 * before streaming) and the apply server fn (to gate writes). The model is never
 * trusted to decide what is safe to write — these functions are the gate.
 *
 * Kept free of DB / LLM / Durable Object imports so they are unit-testable.
 */

import type { EventProposal, MatchKind, VolunteerProposal } from "./schemas"

/** Minimal shape of an existing volunteer/invite used for dedup matching. */
export interface ExistingVolunteer {
  membershipId: string
  email: string | null
  name: string | null
  /** true for a pending invitation, false for a confirmed membership */
  isInvite: boolean
}

/** Minimal shape of an existing competition event used for update targeting. */
export interface ExistingEvent {
  trackWorkoutId: string
  name: string
}

export interface VolunteerClassification {
  matchKind: MatchKind
  matchedMembershipId: string | null
  warnings: string[]
}

function normalizeEmail(email: string | null | undefined): string | null {
  return email ? email.trim().toLowerCase() : null
}

/**
 * Classify a proposed volunteer against existing volunteers/invites.
 *
 * Email is the primary key (case-insensitive). A name-only collision is surfaced
 * as a soft warning, not a hard match, because names are not unique.
 */
export function classifyVolunteer(
  proposal: Pick<VolunteerProposal, "email" | "name">,
  existing: ExistingVolunteer[],
): VolunteerClassification {
  const warnings: string[] = []
  const email = normalizeEmail(proposal.email)

  if (!email) {
    warnings.push(
      "No email — cannot send an invitation. Add an email to import.",
    )
  }

  if (email) {
    const byEmail = existing.find((e) => normalizeEmail(e.email) === email)
    if (byEmail) {
      return {
        matchKind: byEmail.isInvite ? "existing_invite" : "existing_member",
        matchedMembershipId: byEmail.membershipId,
        warnings,
      }
    }
  }

  // Soft name collision (informational only).
  const proposalName = proposal.name?.trim().toLowerCase()
  if (proposalName) {
    const nameClash = existing.find(
      (e) => e.name?.trim().toLowerCase() === proposalName,
    )
    if (nameClash) {
      warnings.push(
        `A volunteer named "${proposal.name}" already exists — verify this isn't the same person.`,
      )
    }
  }

  return { matchKind: "new", matchedMembershipId: null, warnings }
}

/**
 * Apply the classification onto a proposal, downgrading the action when the row
 * can't be created (no email) or is a duplicate. Pure — returns a new object.
 */
export function reconcileVolunteerProposal(
  proposal: VolunteerProposal,
  existing: ExistingVolunteer[],
): VolunteerProposal {
  const { matchKind, matchedMembershipId, warnings } = classifyVolunteer(
    proposal,
    existing,
  )
  const mergedWarnings = dedupe([...proposal.warnings, ...warnings])

  let action = proposal.action
  if (matchKind !== "new" && action === "create") {
    // Already exists — propose a metadata update rather than a duplicate invite.
    action = "update"
  }
  if (action === "create" && !proposal.email) {
    action = "needs_input"
  }

  return {
    ...proposal,
    action,
    matchKind,
    matchedMembershipId,
    warnings: mergedWarnings,
  }
}

/** A volunteer proposal that cannot be applied as a create (no email). */
export function isBlockedVolunteer(proposal: VolunteerProposal): boolean {
  return proposal.action === "create" && !proposal.email
}

/** Whether a volunteer proposal should actually write something on confirm. */
export function isActionableVolunteer(proposal: VolunteerProposal): boolean {
  return (
    (proposal.action === "create" && !!proposal.email) ||
    (proposal.action === "update" && !!proposal.matchedMembershipId)
  )
}

/**
 * Per-row decision for the apply path. Pure: decides what should happen to each
 * volunteer proposal so the server fn only performs the IO (invite + record).
 */
export type VolunteerApplyDecision =
  | {
      rowKey: string
      outcome: "invite"
      email: string
      name: string | null
      roleTypes: VolunteerProposal["roleTypes"]
    }
  | { rowKey: string; outcome: "skip"; reason: string }
  | { rowKey: string; outcome: "fail"; reason: string }

export interface PlanVolunteerApplyOptions {
  /** rowKeys already written by a prior apply of this run (idempotency). */
  alreadyAppliedRowKeys: ReadonlySet<string>
  /** false when the competition has no volunteer team to invite into. */
  hasCompetitionTeam: boolean
  /** roles to use when a proposal carries none (e.g. ["judge"] on the judges page). */
  defaultRoleTypes: VolunteerProposal["roleTypes"]
}

/**
 * Decide, per proposal, whether to invite / skip / fail — without touching the
 * DB. Mirrors the human-in-the-loop contract: only `create` proposals with an
 * email and a competition team become writes; duplicates and no-email rows are
 * surfaced, never silently invited.
 */
export function planVolunteerApply(
  proposals: VolunteerProposal[],
  options: PlanVolunteerApplyOptions,
): VolunteerApplyDecision[] {
  return proposals.map((proposal): VolunteerApplyDecision => {
    if (options.alreadyAppliedRowKeys.has(proposal.rowKey)) {
      return {
        rowKey: proposal.rowKey,
        outcome: "skip",
        reason: "Already imported",
      }
    }
    if (proposal.action !== "create") {
      return {
        rowKey: proposal.rowKey,
        outcome: "skip",
        reason:
          proposal.matchKind === "existing_member"
            ? "Already a volunteer — skipped"
            : proposal.matchKind === "existing_invite"
              ? "Already invited — skipped"
              : "Skipped (no action)",
      }
    }
    if (!proposal.email) {
      return {
        rowKey: proposal.rowKey,
        outcome: "fail",
        reason: "No email — cannot send an invitation",
      }
    }
    if (!options.hasCompetitionTeam) {
      return {
        rowKey: proposal.rowKey,
        outcome: "fail",
        reason: "Competition has no volunteer team",
      }
    }
    return {
      rowKey: proposal.rowKey,
      outcome: "invite",
      email: proposal.email,
      name: proposal.name,
      roleTypes:
        proposal.roleTypes.length > 0
          ? proposal.roleTypes
          : options.defaultRoleTypes,
    }
  })
}

export interface EventValidationResult {
  ok: boolean
  errors: string[]
}

/**
 * Validate an event proposal before applying. `allowedSchemes` comes from the
 * server (WORKOUT_SCHEME_VALUES) so the lib stays free of DB imports.
 */
export function validateEventProposal(
  proposal: EventProposal,
  existing: ExistingEvent[],
  allowedSchemes: readonly string[],
): EventValidationResult {
  const errors: string[] = []

  if (proposal.action === "create") {
    if (proposal.scheme && !allowedSchemes.includes(proposal.scheme)) {
      errors.push(`Unknown scoring scheme "${proposal.scheme}".`)
    }
  }

  if (proposal.action === "update") {
    if (!proposal.targetTrackWorkoutId) {
      errors.push("Update proposal is missing the event it should change.")
    } else if (
      !existing.some((e) => e.trackWorkoutId === proposal.targetTrackWorkoutId)
    ) {
      errors.push("Update target event does not belong to this competition.")
    }
    if (proposal.scheme && !allowedSchemes.includes(proposal.scheme)) {
      errors.push(`Unknown scoring scheme "${proposal.scheme}".`)
    }
  }

  return { ok: errors.length === 0, errors }
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values))
}
