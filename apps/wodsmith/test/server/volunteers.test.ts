import { describe, expect, it } from "vitest"
import {
	getVolunteerRoleTypes,
	hasRoleType,
	isVolunteer,
} from "@/server/volunteers"
import { SYSTEM_ROLES_ENUM, type TeamMembership } from "@/db/schema"
import type { VolunteerMembershipMetadata, VolunteerRoleType } from "@/db/schemas/volunteers"
import { VOLUNTEER_ROLE_TYPES } from "@/db/schemas/volunteers"

// Factory to create test memberships
function createMembership(
	overrides: Partial<TeamMembership> = {},
): TeamMembership {
	return {
		id: "mem-1",
		teamId: "team-1",
		userId: "user-1",
		roleId: SYSTEM_ROLES_ENUM.MEMBER,
		isSystemRole: 1,
		invitedBy: null,
		invitedAt: null,
		joinedAt: new Date(),
		expiresAt: null,
		isActive: 1,
		metadata: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	}
}

function createVolunteerMembership(
	roleTypes: VolunteerRoleType[] = [],
	extraMetadata: Partial<VolunteerMembershipMetadata> = {},
): TeamMembership {
	const metadata: VolunteerMembershipMetadata = {
		volunteerRoleTypes: roleTypes,
		...extraMetadata,
	}
	return createMembership({
		roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
		isSystemRole: 1,
		metadata: JSON.stringify(metadata),
	})
}

describe("getVolunteerRoleTypes", () => {
	it("returns empty array when membership has no metadata", () => {
		const membership = createMembership({ metadata: null })

		const roleTypes = getVolunteerRoleTypes(membership)

		expect(roleTypes).toEqual([])
	})

	it("returns empty array when metadata is invalid JSON", () => {
		const membership = createMembership({ metadata: "not valid json" })

		const roleTypes = getVolunteerRoleTypes(membership)

		expect(roleTypes).toEqual([])
	})

	it("returns empty array when metadata has no volunteerRoleTypes", () => {
		const membership = createMembership({ metadata: JSON.stringify({}) })

		const roleTypes = getVolunteerRoleTypes(membership)

		expect(roleTypes).toEqual([])
	})

	it("returns role types from valid metadata", () => {
		const membership = createVolunteerMembership([
			VOLUNTEER_ROLE_TYPES.JUDGE,
			VOLUNTEER_ROLE_TYPES.SCOREKEEPER,
		])

		const roleTypes = getVolunteerRoleTypes(membership)

		expect(roleTypes).toEqual([
			VOLUNTEER_ROLE_TYPES.JUDGE,
			VOLUNTEER_ROLE_TYPES.SCOREKEEPER,
		])
	})

	it("returns single role type", () => {
		const membership = createVolunteerMembership([VOLUNTEER_ROLE_TYPES.HEAD_JUDGE])

		const roleTypes = getVolunteerRoleTypes(membership)

		expect(roleTypes).toEqual([VOLUNTEER_ROLE_TYPES.HEAD_JUDGE])
	})

	it("preserves all volunteer role type values", () => {
		const allRoleTypes: VolunteerRoleType[] = [
			VOLUNTEER_ROLE_TYPES.JUDGE,
			VOLUNTEER_ROLE_TYPES.HEAD_JUDGE,
			VOLUNTEER_ROLE_TYPES.EQUIPMENT,
			VOLUNTEER_ROLE_TYPES.MEDICAL,
			VOLUNTEER_ROLE_TYPES.CHECK_IN,
			VOLUNTEER_ROLE_TYPES.STAFF,
			VOLUNTEER_ROLE_TYPES.SCOREKEEPER,
			VOLUNTEER_ROLE_TYPES.EMCEE,
			VOLUNTEER_ROLE_TYPES.FLOOR_MANAGER,
			VOLUNTEER_ROLE_TYPES.MEDIA,
			VOLUNTEER_ROLE_TYPES.GENERAL,
		]
		const membership = createVolunteerMembership(allRoleTypes)

		const roleTypes = getVolunteerRoleTypes(membership)

		expect(roleTypes).toEqual(allRoleTypes)
	})
})

describe("isVolunteer", () => {
	it("returns true for volunteer membership with system role", () => {
		const membership = createVolunteerMembership()

		expect(isVolunteer(membership)).toBe(true)
	})

	it("returns false for non-volunteer role", () => {
		const membership = createMembership({
			roleId: SYSTEM_ROLES_ENUM.MEMBER,
			isSystemRole: 1,
		})

		expect(isVolunteer(membership)).toBe(false)
	})

	it("returns false for owner role", () => {
		const membership = createMembership({
			roleId: SYSTEM_ROLES_ENUM.OWNER,
			isSystemRole: 1,
		})

		expect(isVolunteer(membership)).toBe(false)
	})

	it("returns false for admin role", () => {
		const membership = createMembership({
			roleId: SYSTEM_ROLES_ENUM.ADMIN,
			isSystemRole: 1,
		})

		expect(isVolunteer(membership)).toBe(false)
	})

	it("returns false for captain role", () => {
		const membership = createMembership({
			roleId: SYSTEM_ROLES_ENUM.CAPTAIN,
			isSystemRole: 1,
		})

		expect(isVolunteer(membership)).toBe(false)
	})

	it("returns false when volunteer role is not system role", () => {
		const membership = createMembership({
			roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
			isSystemRole: 0, // Not a system role
		})

		expect(isVolunteer(membership)).toBe(false)
	})

	it("returns false for custom role named volunteer", () => {
		const membership = createMembership({
			roleId: "custom-volunteer-role-id",
			isSystemRole: 0,
		})

		expect(isVolunteer(membership)).toBe(false)
	})
})

describe("hasRoleType", () => {
	it("returns true when membership has the specified role type", () => {
		const membership = createVolunteerMembership([
			VOLUNTEER_ROLE_TYPES.JUDGE,
			VOLUNTEER_ROLE_TYPES.SCOREKEEPER,
		])

		expect(hasRoleType(membership, VOLUNTEER_ROLE_TYPES.JUDGE)).toBe(true)
		expect(hasRoleType(membership, VOLUNTEER_ROLE_TYPES.SCOREKEEPER)).toBe(true)
	})

	it("returns false when membership does not have the specified role type", () => {
		const membership = createVolunteerMembership([VOLUNTEER_ROLE_TYPES.JUDGE])

		expect(hasRoleType(membership, VOLUNTEER_ROLE_TYPES.HEAD_JUDGE)).toBe(false)
		expect(hasRoleType(membership, VOLUNTEER_ROLE_TYPES.MEDICAL)).toBe(false)
	})

	it("returns false for membership with no metadata", () => {
		const membership = createMembership({ metadata: null })

		expect(hasRoleType(membership, VOLUNTEER_ROLE_TYPES.JUDGE)).toBe(false)
	})

	it("returns false for membership with empty role types", () => {
		const membership = createVolunteerMembership([])

		expect(hasRoleType(membership, VOLUNTEER_ROLE_TYPES.JUDGE)).toBe(false)
	})

	it("correctly identifies head judge role type", () => {
		const judgeOnly = createVolunteerMembership([VOLUNTEER_ROLE_TYPES.JUDGE])
		const headJudge = createVolunteerMembership([VOLUNTEER_ROLE_TYPES.HEAD_JUDGE])
		const bothRoles = createVolunteerMembership([
			VOLUNTEER_ROLE_TYPES.JUDGE,
			VOLUNTEER_ROLE_TYPES.HEAD_JUDGE,
		])

		expect(hasRoleType(judgeOnly, VOLUNTEER_ROLE_TYPES.HEAD_JUDGE)).toBe(false)
		expect(hasRoleType(headJudge, VOLUNTEER_ROLE_TYPES.HEAD_JUDGE)).toBe(true)
		expect(hasRoleType(bothRoles, VOLUNTEER_ROLE_TYPES.JUDGE)).toBe(true)
		expect(hasRoleType(bothRoles, VOLUNTEER_ROLE_TYPES.HEAD_JUDGE)).toBe(true)
	})
})

describe("volunteer metadata parsing edge cases", () => {
	describe("getVolunteerRoleTypes with extra metadata fields", () => {
		it("extracts role types when metadata has status field", () => {
			const metadata: VolunteerMembershipMetadata = {
				volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.JUDGE],
				status: "pending",
			}
			const membership = createMembership({
				roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
				isSystemRole: 1,
				metadata: JSON.stringify(metadata),
			})

			expect(getVolunteerRoleTypes(membership)).toEqual([VOLUNTEER_ROLE_TYPES.JUDGE])
		})

		it("extracts role types when metadata has signup fields", () => {
			const metadata: VolunteerMembershipMetadata = {
				volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.SCOREKEEPER],
				status: "approved",
				signupEmail: "volunteer@example.com",
				signupName: "John Doe",
				signupPhone: "555-1234",
			}
			const membership = createMembership({
				roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
				isSystemRole: 1,
				metadata: JSON.stringify(metadata),
			})

			expect(getVolunteerRoleTypes(membership)).toEqual([VOLUNTEER_ROLE_TYPES.SCOREKEEPER])
		})

		it("extracts role types when metadata has credentials", () => {
			const metadata: VolunteerMembershipMetadata = {
				volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.JUDGE, VOLUNTEER_ROLE_TYPES.HEAD_JUDGE],
				credentials: "CrossFit L1 Judge, EMT Certified",
			}
			const membership = createMembership({
				roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
				isSystemRole: 1,
				metadata: JSON.stringify(metadata),
			})

			expect(getVolunteerRoleTypes(membership)).toEqual([
				VOLUNTEER_ROLE_TYPES.JUDGE,
				VOLUNTEER_ROLE_TYPES.HEAD_JUDGE,
			])
		})

		it("extracts role types when metadata has emergency contact", () => {
			const metadata: VolunteerMembershipMetadata = {
				volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.MEDICAL],
				emergencyContact: {
					name: "Jane Doe",
					phone: "555-5678",
					relationship: "spouse",
				},
			}
			const membership = createMembership({
				roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
				isSystemRole: 1,
				metadata: JSON.stringify(metadata),
			})

			expect(getVolunteerRoleTypes(membership)).toEqual([VOLUNTEER_ROLE_TYPES.MEDICAL])
		})

		it("handles metadata with all optional fields populated", () => {
			const metadata: VolunteerMembershipMetadata = {
				volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.FLOOR_MANAGER],
				credentials: "Event Management Certified",
				shirtSize: "L",
				availabilityNotes: "Available Saturday only",
				emergencyContact: {
					name: "Emergency Contact",
					phone: "555-9999",
				},
				internalNotes: "Experienced volunteer",
				status: "approved",
				signupEmail: "manager@example.com",
				signupName: "Floor Manager",
				signupPhone: "555-0000",
			}
			const membership = createMembership({
				roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
				isSystemRole: 1,
				metadata: JSON.stringify(metadata),
			})

			expect(getVolunteerRoleTypes(membership)).toEqual([VOLUNTEER_ROLE_TYPES.FLOOR_MANAGER])
		})
	})

	describe("hasRoleType with complex metadata", () => {
		it("finds role type in metadata with many fields", () => {
			const metadata: VolunteerMembershipMetadata = {
				volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.EMCEE, VOLUNTEER_ROLE_TYPES.MEDIA],
				status: "approved",
				credentials: "Professional announcer",
				availabilityNotes: "Both days available",
			}
			const membership = createMembership({
				roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
				isSystemRole: 1,
				metadata: JSON.stringify(metadata),
			})

			expect(hasRoleType(membership, VOLUNTEER_ROLE_TYPES.EMCEE)).toBe(true)
			expect(hasRoleType(membership, VOLUNTEER_ROLE_TYPES.MEDIA)).toBe(true)
			expect(hasRoleType(membership, VOLUNTEER_ROLE_TYPES.JUDGE)).toBe(false)
		})
	})

	describe("isVolunteer with metadata variations", () => {
		it("returns true regardless of metadata content", () => {
			const pendingVolunteer = createVolunteerMembership([], { status: "pending" })
			const approvedVolunteer = createVolunteerMembership([VOLUNTEER_ROLE_TYPES.JUDGE], { status: "approved" })
			const rejectedVolunteer = createVolunteerMembership([], { status: "rejected" })

			expect(isVolunteer(pendingVolunteer)).toBe(true)
			expect(isVolunteer(approvedVolunteer)).toBe(true)
			expect(isVolunteer(rejectedVolunteer)).toBe(true)
		})

		it("returns true for volunteer with corrupted role types array", () => {
			// Edge case: metadata exists but roleTypes is not an array
			const membership = createMembership({
				roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
				isSystemRole: 1,
				metadata: JSON.stringify({ volunteerRoleTypes: "not-an-array" }),
			})

			// isVolunteer only checks roleId and isSystemRole, not metadata validity
			expect(isVolunteer(membership)).toBe(true)
		})
	})
})
