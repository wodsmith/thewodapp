import { describe, expect, it } from "vitest"
import type { VolunteerProposal } from "@/lib/organizer-file-import/schemas"
import {
	classifyVolunteer,
	type ExistingVolunteer,
	isApplicableVolunteer,
	isBlockedVolunteer,
} from "@/lib/organizer-file-import/validate"

const EXISTING: ExistingVolunteer[] = [
	{ membershipId: "tmem_1", email: "ada@example.com", name: "Ada", isInvite: false },
	{ membershipId: "tinv_2", email: "grace@example.com", name: "Grace", isInvite: true },
]

function proposal(overrides: Partial<VolunteerProposal> = {}): VolunteerProposal {
	return {
		proposalId: "v1",
		rowKey: "v1",
		action: "create",
		name: "New Person",
		email: "new@example.com",
		phone: null,
		roleTypes: [],
		credentials: null,
		shirtSize: null,
		availability: null,
		matchKind: "new",
		matchedMembershipId: null,
		confidence: "high",
		rationale: "test",
		warnings: [],
		status: "pending",
		...overrides,
	}
}

describe("classifyVolunteer", () => {
	it("warns when there is no email", () => {
		const result = classifyVolunteer({ email: null, name: "No Email" }, EXISTING)
		expect(result.matchKind).toBe("new")
		expect(result.warnings.length).toBeGreaterThan(0)
	})

	it("matches an existing member by email, case-insensitively", () => {
		const result = classifyVolunteer(
			{ email: "ADA@example.com", name: "Ada" },
			EXISTING,
		)
		expect(result.matchKind).toBe("existing_member")
		expect(result.matchedMembershipId).toBe("tmem_1")
	})

	it("distinguishes an existing pending invitation", () => {
		const result = classifyVolunteer(
			{ email: "grace@example.com", name: "Grace" },
			EXISTING,
		)
		expect(result.matchKind).toBe("existing_invite")
		expect(result.matchedMembershipId).toBe("tinv_2")
	})

	it("classifies an unknown email as new", () => {
		const result = classifyVolunteer(
			{ email: "fresh@example.com", name: "Fresh" },
			EXISTING,
		)
		expect(result.matchKind).toBe("new")
		expect(result.matchedMembershipId).toBeNull()
	})
})

describe("isBlockedVolunteer", () => {
	it("blocks a create with no email", () => {
		expect(isBlockedVolunteer({ action: "create", email: null })).toBe(true)
		expect(isBlockedVolunteer({ action: "create", email: "  " })).toBe(true)
	})

	it("does not block a create with an email", () => {
		expect(isBlockedVolunteer({ action: "create", email: "a@b.com" })).toBe(false)
	})
})

describe("isApplicableVolunteer", () => {
	it("applies a new create with an email", () => {
		expect(isApplicableVolunteer(proposal())).toBe(true)
	})

	it("skips a create with no email", () => {
		expect(isApplicableVolunteer(proposal({ email: null }))).toBe(false)
	})

	it("skips a duplicate (already a member)", () => {
		expect(
			isApplicableVolunteer(
				proposal({ matchKind: "existing_member", matchedMembershipId: "tmem_1" }),
			),
		).toBe(false)
	})

	it("skips needs_input and skip actions", () => {
		expect(isApplicableVolunteer(proposal({ action: "needs_input" }))).toBe(false)
		expect(isApplicableVolunteer(proposal({ action: "skip" }))).toBe(false)
	})
})
