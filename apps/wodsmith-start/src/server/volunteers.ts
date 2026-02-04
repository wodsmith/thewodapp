/**
 * Volunteer Management Server Functions
 * Helper functions for managing competition volunteers and their permissions
 */

import type { TeamMembership } from "@/db/schema"
import { SYSTEM_ROLES_ENUM } from "@/db/schema"
import type {
	VolunteerMembershipMetadata,
	VolunteerRoleType,
} from "@/db/schemas/volunteers"
import {
	VOLUNTEER_AVAILABILITY,
	type VolunteerAvailability,
} from "@/db/schemas/volunteers"

// ============================================================================
// VOLUNTEER ROLE TYPE HELPERS
// ============================================================================

/**
 * Parse volunteerRoleTypes from membership metadata
 * Returns empty array if no metadata or no volunteer roles
 */
export function getVolunteerRoleTypes(
	membership: TeamMembership,
): VolunteerRoleType[] {
	if (!membership.metadata) return []

	try {
		const metadata = JSON.parse(
			membership.metadata,
		) as VolunteerMembershipMetadata
		return metadata.volunteerRoleTypes ?? []
	} catch {
		return []
	}
}

/**
 * Check if a membership has the volunteer role
 */
export function isVolunteer(membership: TeamMembership): boolean {
	return (
		membership.roleId === SYSTEM_ROLES_ENUM.VOLUNTEER &&
		membership.isSystemRole
	)
}

/**
 * Check if a membership has a specific volunteer role type
 */
export function hasRoleType(
	membership: TeamMembership,
	roleType: VolunteerRoleType,
): boolean {
	const roleTypes = getVolunteerRoleTypes(membership)
	return roleTypes.includes(roleType)
}

// ============================================================================
// VOLUNTEER AVAILABILITY HELPERS
// ============================================================================

/**
 * Get the availability from volunteer membership metadata
 */
export function getVolunteerAvailability(
	metadata: VolunteerMembershipMetadata | null | undefined,
): VolunteerAvailability | undefined {
	return metadata?.availability
}

/**
 * Check if a volunteer is available for a given time slot
 * Morning heats: accept morning + all_day
 * Afternoon heats: accept afternoon + all_day
 * All day: accept any
 */
export function isVolunteerAvailableFor(
	metadata: VolunteerMembershipMetadata | null | undefined,
	timeSlot: "morning" | "afternoon",
): boolean {
	const availability = metadata?.availability

	// No availability set = assume available (backwards compatibility)
	if (!availability) return true

	// All day volunteers are always available
	if (availability === VOLUNTEER_AVAILABILITY.ALL_DAY) return true

	// Match specific time slot
	return availability === timeSlot
}

/**
 * Filter volunteers by availability for a given time slot
 */
export function filterVolunteersByAvailability<
	T extends { metadata?: string | null },
>(volunteers: T[], timeSlot: "morning" | "afternoon" | null): T[] {
	if (!timeSlot) return volunteers

	return volunteers.filter((v) => {
		const metadata = v.metadata
			? (JSON.parse(v.metadata) as VolunteerMembershipMetadata)
			: null
		return isVolunteerAvailableFor(metadata, timeSlot)
	})
}

// ============================================================================
// DIRECT INVITE DETECTION
// ============================================================================

/**
 * Determine if an invitation is a direct invite (admin-initiated)
 * Direct invites have inviteSource='direct' in metadata OR invitedBy is not null (legacy)
 */
export function isDirectInvite(
	metadata: VolunteerMembershipMetadata | null,
	invitedBy: string | null,
): boolean {
	// If invitedBy is set, it's a direct invite (legacy check)
	if (invitedBy !== null) return true

	// Check metadata for inviteSource
	if (metadata?.inviteSource === "direct") return true

	// Default: not a direct invite (it's an application)
	return false
}

/**
 * Calculate the status of a volunteer invitation based on acceptedAt and expiresAt
 * @param acceptedAt - When the invitation was accepted (null if not accepted)
 * @param expiresAt - When the invitation expires (null if no expiry)
 * @param now - Current date (for testing injection)
 */
export function calculateInviteStatus(
	acceptedAt: Date | null,
	expiresAt: Date | null,
	now: Date = new Date(),
): "pending" | "accepted" | "expired" {
	if (acceptedAt) {
		return "accepted"
	}
	if (expiresAt && expiresAt < now) {
		return "expired"
	}
	return "pending"
}
