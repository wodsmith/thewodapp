import { describe, expect, it } from "vitest"
import {
	audienceFilterSchema,
	buildBroadcastRecipients,
	type RawAthleteRegistrationRow,
	type RawPendingInvitationRow,
	type RawTeammateMembershipRow,
} from "@/server-fns/broadcast-fns"

// ============================================================================
// Fixtures
// ============================================================================

const soloRegistration: RawAthleteRegistrationRow = {
	id: "reg_solo1",
	userId: "user_solo1",
	athleteTeamId: null,
	email: "solo@example.com",
	firstName: "Solo",
}

const captainRegistration: RawAthleteRegistrationRow = {
	id: "reg_captain1",
	userId: "user_captain1",
	athleteTeamId: "team_athlete1",
	email: "captain@example.com",
	firstName: "Cap",
}

const teammateMembership: RawTeammateMembershipRow = {
	userId: "user_teammate1",
	teamId: "team_athlete1",
	email: "teammate@example.com",
	firstName: "Teddy",
}

const pendingInvite: RawPendingInvitationRow = {
	id: "tinv_pending1",
	teamId: "team_athlete1",
	email: "invitee@example.com",
}

// ============================================================================
// buildBroadcastRecipients
// ============================================================================

describe("buildBroadcastRecipients", () => {
	it("includes solo athletes", () => {
		const recipients = buildBroadcastRecipients({
			athleteRegistrations: [soloRegistration],
			teammateMemberships: [],
			pendingInvitations: [],
		})
		expect(recipients).toHaveLength(1)
		expect(recipients[0]).toMatchObject({
			userId: "user_solo1",
			registrationId: "reg_solo1",
			invitationId: null,
			email: "solo@example.com",
		})
	})

	it("includes team captains", () => {
		const recipients = buildBroadcastRecipients({
			athleteRegistrations: [captainRegistration],
			teammateMemberships: [],
			pendingInvitations: [],
		})
		expect(recipients).toHaveLength(1)
		expect(recipients[0].userId).toBe("user_captain1")
		expect(recipients[0].invitationId).toBeNull()
	})

	it("includes accepted non-captain teammates", () => {
		const recipients = buildBroadcastRecipients({
			athleteRegistrations: [captainRegistration],
			teammateMemberships: [teammateMembership],
			pendingInvitations: [],
		})
		expect(recipients).toHaveLength(2)
		const userIds = recipients.map((r) => r.userId)
		expect(userIds).toContain("user_captain1")
		expect(userIds).toContain("user_teammate1")
	})

	it("includes pending teammate invites in default audience", () => {
		const recipients = buildBroadcastRecipients({
			athleteRegistrations: [captainRegistration],
			teammateMemberships: [teammateMembership],
			pendingInvitations: [pendingInvite],
		})
		expect(recipients).toHaveLength(3)
		const invite = recipients.find((r) => r.invitationId === "tinv_pending1")
		expect(invite).toBeDefined()
		expect(invite?.userId).toBeNull()
		expect(invite?.email).toBe("invitee@example.com")
	})

	it("resolves pending invitee firstName from captain's pendingTeammates", () => {
		const pendingNames = new Map<string, string>()
		pendingNames.set(`team_athlete1-invitee@example.com`, "Inviter")
		const recipients = buildBroadcastRecipients({
			athleteRegistrations: [captainRegistration],
			teammateMemberships: [],
			pendingInvitations: [pendingInvite],
			pendingNames,
		})
		const invite = recipients.find((r) => r.invitationId === "tinv_pending1")
		expect(invite?.firstName).toBe("Inviter")
	})

	it("returns only invites when onlyPendingInvites is true", () => {
		const recipients = buildBroadcastRecipients({
			athleteRegistrations: [captainRegistration, soloRegistration],
			teammateMemberships: [teammateMembership],
			pendingInvitations: [pendingInvite],
			onlyPendingInvites: true,
		})
		expect(recipients).toHaveLength(1)
		expect(recipients[0].invitationId).toBe("tinv_pending1")
		expect(recipients[0].userId).toBeNull()
	})

	it("deduplicates athletes with multiple registrations by userId", () => {
		const recipients = buildBroadcastRecipients({
			athleteRegistrations: [
				soloRegistration,
				{ ...soloRegistration, id: "reg_solo1_second" },
			],
			teammateMemberships: [],
			pendingInvitations: [],
		})
		expect(recipients).toHaveLength(1)
	})

	it("prefers existing user record when invite email matches an included user", () => {
		// Invitation email matches a registered captain's email — should drop the invite.
		const matchingInvite: RawPendingInvitationRow = {
			id: "tinv_overlap",
			teamId: "team_athlete1",
			email: "captain@example.com", // same as captainRegistration
		}
		const recipients = buildBroadcastRecipients({
			athleteRegistrations: [captainRegistration],
			teammateMemberships: [],
			pendingInvitations: [matchingInvite],
		})
		expect(recipients).toHaveLength(1)
		expect(recipients[0].userId).toBe("user_captain1")
		expect(recipients[0].invitationId).toBeNull()
	})

	it("deduplicates teammate memberships that overlap with a captain registration", () => {
		// Captain is also a member of the athlete team — should dedup by userId
		const captainAsMember: RawTeammateMembershipRow = {
			userId: "user_captain1",
			teamId: "team_athlete1",
			email: "captain@example.com",
			firstName: "Cap",
		}
		const recipients = buildBroadcastRecipients({
			athleteRegistrations: [captainRegistration],
			teammateMemberships: [captainAsMember, teammateMembership],
			pendingInvitations: [],
		})
		expect(recipients).toHaveLength(2)
		const userIds = recipients.map((r) => r.userId)
		expect(userIds).toContain("user_captain1")
		expect(userIds).toContain("user_teammate1")
	})

	it("carries athleteTeamId on captain/teammate/invite rows for filter inheritance", () => {
		// athleteTeamId drives question-filter inheritance downstream, so assert
		// every non-solo row is tagged with the team and solo is null.
		const recipients = buildBroadcastRecipients({
			athleteRegistrations: [soloRegistration, captainRegistration],
			teammateMemberships: [teammateMembership],
			pendingInvitations: [pendingInvite],
		})
		const byUser = (userId: string) =>
			recipients.find((r) => r.userId === userId)
		expect(byUser("user_solo1")?.athleteTeamId).toBeNull()
		expect(byUser("user_captain1")?.athleteTeamId).toBe("team_athlete1")
		expect(byUser("user_teammate1")?.athleteTeamId).toBe("team_athlete1")
		const invite = recipients.find((r) => r.invitationId === "tinv_pending1")
		expect(invite?.athleteTeamId).toBe("team_athlete1")
	})
})

// ============================================================================
// audienceFilterSchema
// ============================================================================

describe("audienceFilterSchema", () => {
	it("rejects pending_teammates with questionFilters", () => {
		const result = audienceFilterSchema.safeParse({
			type: "pending_teammates",
			questionFilters: [{ questionId: "q1", values: ["RX"] }],
		})
		expect(result.success).toBe(false)
		if (!result.success) {
			expect(result.error.issues[0].message).toMatch(
				/not supported for pending teammate invites/i,
			)
		}
	})

	it("accepts pending_teammates without questionFilters", () => {
		const result = audienceFilterSchema.safeParse({
			type: "pending_teammates",
		})
		expect(result.success).toBe(true)
	})

	it("accepts pending_teammates with divisionId for scoping", () => {
		const result = audienceFilterSchema.safeParse({
			type: "pending_teammates",
			divisionId: "div_rx",
		})
		expect(result.success).toBe(true)
	})

	it("requires divisionId when type=division", () => {
		const result = audienceFilterSchema.safeParse({ type: "division" })
		expect(result.success).toBe(false)
	})

	it("requires volunteerRole when type=volunteer_role", () => {
		const result = audienceFilterSchema.safeParse({ type: "volunteer_role" })
		expect(result.success).toBe(false)
	})

	it("requires divisionId when type=missing_submissions", () => {
		const result = audienceFilterSchema.safeParse({ type: "missing_submissions" })
		expect(result.success).toBe(false)
	})

	it("accepts missing_submissions with divisionId", () => {
		const result = audienceFilterSchema.safeParse({
			type: "missing_submissions",
			divisionId: "div_rx",
		})
		expect(result.success).toBe(true)
	})

	it("accepts missing_submissions with questionFilters for further narrowing", () => {
		const result = audienceFilterSchema.safeParse({
			type: "missing_submissions",
			divisionId: "div_rx",
			questionFilters: [{ questionId: "q1", values: ["male"] }],
		})
		expect(result.success).toBe(true)
	})
})
