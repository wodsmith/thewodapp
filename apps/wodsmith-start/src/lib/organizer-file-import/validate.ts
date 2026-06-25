/**
 * Deterministic, LLM-free validation/classification helpers for the file-drop
 * import agent. These run in BOTH the agent's proposal tools and the apply
 * server function so the model is never trusted to gate a write — exactly like
 * src/lib/judge-scheduler/tools.ts.
 */

import type { VolunteerProposal } from "./schemas"

/** Flat view of an existing volunteer (membership or pending invitation). */
export interface ExistingVolunteer {
	membershipId: string
	email: string | null
	name: string | null
	/** true when this is a pending invitation rather than an accepted member */
	isInvite: boolean
}

export interface VolunteerClassification {
	matchKind: VolunteerProposal["matchKind"]
	matchedMembershipId: string | null
	warnings: string[]
}

/**
 * Classify a proposed volunteer against existing data: dedup by email
 * (case-insensitive) and surface blocking warnings. Pure — no I/O, no LLM.
 */
export function classifyVolunteer(
	proposal: Pick<VolunteerProposal, "email" | "name">,
	existing: ExistingVolunteer[],
): VolunteerClassification {
	const warnings: string[] = []
	const email = proposal.email?.trim().toLowerCase() || null

	if (!email) {
		warnings.push(
			"No email — cannot send an invitation; provide one to import.",
		)
	}

	const byEmail = email
		? existing.find((e) => e.email?.trim().toLowerCase() === email)
		: undefined

	if (byEmail) {
		return {
			matchKind: byEmail.isInvite ? "existing_invite" : "existing_member",
			matchedMembershipId: byEmail.membershipId,
			warnings,
		}
	}

	return { matchKind: "new", matchedMembershipId: null, warnings }
}

/**
 * A proposal that cannot be applied as-is. A `create` with no email can't send
 * an invitation, so it is excluded from confirm by default (surfaced as
 * "needs email").
 */
export function isBlockedVolunteer(
	proposal: Pick<VolunteerProposal, "action" | "email">,
): boolean {
	return proposal.action === "create" && !proposal.email?.trim()
}

/**
 * Whether a proposal should actually write on confirm. `skip`/`needs_input`
 * never write; an existing match downgrades a `create` to a no-op skip.
 */
export function isApplicableVolunteer(proposal: VolunteerProposal): boolean {
	if (proposal.action !== "create") return false
	if (isBlockedVolunteer(proposal)) return false
	if (proposal.action === "create" && proposal.matchKind !== "new") {
		// already exists — treat as a skip rather than a duplicate invite
		return false
	}
	return true
}
