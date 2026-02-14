import {describe, expect, it} from 'vitest'
import {
  calculateInviteStatus,
  filterVolunteersByAvailability,
  getVolunteerAvailability,
  getVolunteerRoleTypes,
  hasRoleType,
  isDirectInvite,
  isVolunteer,
  isVolunteerAvailableFor,
} from '@/server/volunteers'
import {SYSTEM_ROLES_ENUM, type TeamMembership} from '@/db/schema'
import type {
  VolunteerMembershipMetadata,
  VolunteerRoleType,
} from '@/db/schemas/volunteers'
import {
  VOLUNTEER_AVAILABILITY,
  VOLUNTEER_INVITE_SOURCE,
  VOLUNTEER_ROLE_TYPES,
} from '@/db/schemas/volunteers'

// Factory to create test memberships
function createMembership(
  overrides: Partial<TeamMembership> = {},
): TeamMembership {
  return {
    id: 'mem-1',
    teamId: 'team-1',
    userId: 'user-1',
    roleId: SYSTEM_ROLES_ENUM.MEMBER,
    isSystemRole: true,
    invitedBy: null,
    invitedAt: null,
    joinedAt: new Date(),
    expiresAt: null,
    isActive: true,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    updateCounter: null,
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
    isSystemRole: true,
    metadata: JSON.stringify(metadata),
  })
}

describe('getVolunteerRoleTypes', () => {
  it('returns empty array when membership has no metadata', () => {
    const membership = createMembership({metadata: null})

    const roleTypes = getVolunteerRoleTypes(membership)

    expect(roleTypes).toEqual([])
  })

  it('returns empty array when metadata is invalid JSON', () => {
    const membership = createMembership({metadata: 'not valid json'})

    const roleTypes = getVolunteerRoleTypes(membership)

    expect(roleTypes).toEqual([])
  })

  it('returns empty array when metadata has no volunteerRoleTypes', () => {
    const membership = createMembership({metadata: JSON.stringify({})})

    const roleTypes = getVolunteerRoleTypes(membership)

    expect(roleTypes).toEqual([])
  })

  it('returns role types from valid metadata', () => {
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

  it('returns single role type', () => {
    const membership = createVolunteerMembership([
      VOLUNTEER_ROLE_TYPES.HEAD_JUDGE,
    ])

    const roleTypes = getVolunteerRoleTypes(membership)

    expect(roleTypes).toEqual([VOLUNTEER_ROLE_TYPES.HEAD_JUDGE])
  })

  it('preserves all volunteer role type values', () => {
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

describe('isVolunteer', () => {
  it('returns true for volunteer membership with system role', () => {
    const membership = createVolunteerMembership()

    expect(isVolunteer(membership)).toBe(true)
  })

  it('returns false for non-volunteer role', () => {
    const membership = createMembership({
      roleId: SYSTEM_ROLES_ENUM.MEMBER,
      isSystemRole: true,
    })

    expect(isVolunteer(membership)).toBe(false)
  })

  it('returns false for owner role', () => {
    const membership = createMembership({
      roleId: SYSTEM_ROLES_ENUM.OWNER,
      isSystemRole: true,
    })

    expect(isVolunteer(membership)).toBe(false)
  })

  it('returns false for admin role', () => {
    const membership = createMembership({
      roleId: SYSTEM_ROLES_ENUM.ADMIN,
      isSystemRole: true,
    })

    expect(isVolunteer(membership)).toBe(false)
  })

  it('returns false for captain role', () => {
    const membership = createMembership({
      roleId: SYSTEM_ROLES_ENUM.CAPTAIN,
      isSystemRole: true,
    })

    expect(isVolunteer(membership)).toBe(false)
  })

  it('returns false when volunteer role is not system role', () => {
    const membership = createMembership({
      roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
      isSystemRole: false, // Not a system role
    })

    expect(isVolunteer(membership)).toBe(false)
  })

  it('returns false for custom role named volunteer', () => {
    const membership = createMembership({
      roleId: 'custom-volunteer-role-id',
      isSystemRole: false,
    })

    expect(isVolunteer(membership)).toBe(false)
  })
})

describe('hasRoleType', () => {
  it('returns true when membership has the specified role type', () => {
    const membership = createVolunteerMembership([
      VOLUNTEER_ROLE_TYPES.JUDGE,
      VOLUNTEER_ROLE_TYPES.SCOREKEEPER,
    ])

    expect(hasRoleType(membership, VOLUNTEER_ROLE_TYPES.JUDGE)).toBe(true)
    expect(hasRoleType(membership, VOLUNTEER_ROLE_TYPES.SCOREKEEPER)).toBe(true)
  })

  it('returns false when membership does not have the specified role type', () => {
    const membership = createVolunteerMembership([VOLUNTEER_ROLE_TYPES.JUDGE])

    expect(hasRoleType(membership, VOLUNTEER_ROLE_TYPES.HEAD_JUDGE)).toBe(false)
    expect(hasRoleType(membership, VOLUNTEER_ROLE_TYPES.MEDICAL)).toBe(false)
  })

  it('returns false for membership with no metadata', () => {
    const membership = createMembership({metadata: null})

    expect(hasRoleType(membership, VOLUNTEER_ROLE_TYPES.JUDGE)).toBe(false)
  })

  it('returns false for membership with empty role types', () => {
    const membership = createVolunteerMembership([])

    expect(hasRoleType(membership, VOLUNTEER_ROLE_TYPES.JUDGE)).toBe(false)
  })

  it('correctly identifies head judge role type', () => {
    const judgeOnly = createVolunteerMembership([VOLUNTEER_ROLE_TYPES.JUDGE])
    const headJudge = createVolunteerMembership([
      VOLUNTEER_ROLE_TYPES.HEAD_JUDGE,
    ])
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

describe('volunteer metadata parsing edge cases', () => {
  describe('getVolunteerRoleTypes with extra metadata fields', () => {
    it('extracts role types when metadata has status field', () => {
      const metadata: VolunteerMembershipMetadata = {
        volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.JUDGE],
        status: 'pending',
      }
      const membership = createMembership({
        roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
        isSystemRole: true,
        metadata: JSON.stringify(metadata),
      })

      expect(getVolunteerRoleTypes(membership)).toEqual([
        VOLUNTEER_ROLE_TYPES.JUDGE,
      ])
    })

    it('extracts role types when metadata has signup fields', () => {
      const metadata: VolunteerMembershipMetadata = {
        volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.SCOREKEEPER],
        status: 'approved',
        signupEmail: 'volunteer@example.com',
        signupName: 'John Doe',
        signupPhone: '555-1234',
      }
      const membership = createMembership({
        roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
        isSystemRole: true,
        metadata: JSON.stringify(metadata),
      })

      expect(getVolunteerRoleTypes(membership)).toEqual([
        VOLUNTEER_ROLE_TYPES.SCOREKEEPER,
      ])
    })

    it('extracts role types when metadata has credentials', () => {
      const metadata: VolunteerMembershipMetadata = {
        volunteerRoleTypes: [
          VOLUNTEER_ROLE_TYPES.JUDGE,
          VOLUNTEER_ROLE_TYPES.HEAD_JUDGE,
        ],
        credentials: 'CrossFit L1 Judge, EMT Certified',
      }
      const membership = createMembership({
        roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
        isSystemRole: true,
        metadata: JSON.stringify(metadata),
      })

      expect(getVolunteerRoleTypes(membership)).toEqual([
        VOLUNTEER_ROLE_TYPES.JUDGE,
        VOLUNTEER_ROLE_TYPES.HEAD_JUDGE,
      ])
    })

    it('extracts role types when metadata has emergency contact', () => {
      const metadata: VolunteerMembershipMetadata = {
        volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.MEDICAL],
        emergencyContact: {
          name: 'Jane Doe',
          phone: '555-5678',
          relationship: 'spouse',
        },
      }
      const membership = createMembership({
        roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
        isSystemRole: true,
        metadata: JSON.stringify(metadata),
      })

      expect(getVolunteerRoleTypes(membership)).toEqual([
        VOLUNTEER_ROLE_TYPES.MEDICAL,
      ])
    })

    it('handles metadata with all optional fields populated', () => {
      const metadata: VolunteerMembershipMetadata = {
        volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.FLOOR_MANAGER],
        credentials: 'Event Management Certified',
        shirtSize: 'L',
        availabilityNotes: 'Available Saturday only',
        emergencyContact: {
          name: 'Emergency Contact',
          phone: '555-9999',
        },
        internalNotes: 'Experienced volunteer',
        status: 'approved',
        signupEmail: 'manager@example.com',
        signupName: 'Floor Manager',
        signupPhone: '555-0000',
      }
      const membership = createMembership({
        roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
        isSystemRole: true,
        metadata: JSON.stringify(metadata),
      })

      expect(getVolunteerRoleTypes(membership)).toEqual([
        VOLUNTEER_ROLE_TYPES.FLOOR_MANAGER,
      ])
    })
  })

  describe('hasRoleType with complex metadata', () => {
    it('finds role type in metadata with many fields', () => {
      const metadata: VolunteerMembershipMetadata = {
        volunteerRoleTypes: [
          VOLUNTEER_ROLE_TYPES.EMCEE,
          VOLUNTEER_ROLE_TYPES.MEDIA,
        ],
        status: 'approved',
        credentials: 'Professional announcer',
        availabilityNotes: 'Both days available',
      }
      const membership = createMembership({
        roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
        isSystemRole: true,
        metadata: JSON.stringify(metadata),
      })

      expect(hasRoleType(membership, VOLUNTEER_ROLE_TYPES.EMCEE)).toBe(true)
      expect(hasRoleType(membership, VOLUNTEER_ROLE_TYPES.MEDIA)).toBe(true)
      expect(hasRoleType(membership, VOLUNTEER_ROLE_TYPES.JUDGE)).toBe(false)
    })
  })

  describe('isVolunteer with metadata variations', () => {
    it('returns true regardless of metadata content', () => {
      const pendingVolunteer = createVolunteerMembership([], {
        status: 'pending',
      })
      const approvedVolunteer = createVolunteerMembership(
        [VOLUNTEER_ROLE_TYPES.JUDGE],
        {status: 'approved'},
      )
      const rejectedVolunteer = createVolunteerMembership([], {
        status: 'rejected',
      })

      expect(isVolunteer(pendingVolunteer)).toBe(true)
      expect(isVolunteer(approvedVolunteer)).toBe(true)
      expect(isVolunteer(rejectedVolunteer)).toBe(true)
    })

    it('returns true for volunteer with corrupted role types array', () => {
      // Edge case: metadata exists but roleTypes is not an array
      const membership = createMembership({
        roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
        isSystemRole: true,
        metadata: JSON.stringify({volunteerRoleTypes: 'not-an-array'}),
      })

      // isVolunteer only checks roleId and isSystemRole, not metadata validity
      expect(isVolunteer(membership)).toBe(true)
    })
  })
})

describe('getVolunteerAvailability', () => {
  it('returns undefined when metadata is null', () => {
    expect(getVolunteerAvailability(null)).toBeUndefined()
  })

  it('returns undefined when metadata is undefined', () => {
    expect(getVolunteerAvailability(undefined)).toBeUndefined()
  })

  it('returns undefined when metadata has no availability field', () => {
    const metadata: VolunteerMembershipMetadata = {
      volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.JUDGE],
    }
    expect(getVolunteerAvailability(metadata)).toBeUndefined()
  })

  it('returns morning when availability is morning', () => {
    const metadata: VolunteerMembershipMetadata = {
      volunteerRoleTypes: [],
      availability: VOLUNTEER_AVAILABILITY.MORNING,
    }
    expect(getVolunteerAvailability(metadata)).toBe(
      VOLUNTEER_AVAILABILITY.MORNING,
    )
  })

  it('returns afternoon when availability is afternoon', () => {
    const metadata: VolunteerMembershipMetadata = {
      volunteerRoleTypes: [],
      availability: VOLUNTEER_AVAILABILITY.AFTERNOON,
    }
    expect(getVolunteerAvailability(metadata)).toBe(
      VOLUNTEER_AVAILABILITY.AFTERNOON,
    )
  })

  it('returns all_day when availability is all_day', () => {
    const metadata: VolunteerMembershipMetadata = {
      volunteerRoleTypes: [],
      availability: VOLUNTEER_AVAILABILITY.ALL_DAY,
    }
    expect(getVolunteerAvailability(metadata)).toBe(
      VOLUNTEER_AVAILABILITY.ALL_DAY,
    )
  })
})

describe('isVolunteerAvailableFor', () => {
  it('returns true when metadata is null (backwards compatibility)', () => {
    expect(isVolunteerAvailableFor(null, 'morning')).toBe(true)
    expect(isVolunteerAvailableFor(null, 'afternoon')).toBe(true)
  })

  it('returns true when metadata is undefined (backwards compatibility)', () => {
    expect(isVolunteerAvailableFor(undefined, 'morning')).toBe(true)
    expect(isVolunteerAvailableFor(undefined, 'afternoon')).toBe(true)
  })

  it('returns true when availability is not set (backwards compatibility)', () => {
    const metadata: VolunteerMembershipMetadata = {
      volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.JUDGE],
    }
    expect(isVolunteerAvailableFor(metadata, 'morning')).toBe(true)
    expect(isVolunteerAvailableFor(metadata, 'afternoon')).toBe(true)
  })

  it('returns true for all_day volunteers for morning heats', () => {
    const metadata: VolunteerMembershipMetadata = {
      volunteerRoleTypes: [],
      availability: VOLUNTEER_AVAILABILITY.ALL_DAY,
    }
    expect(isVolunteerAvailableFor(metadata, 'morning')).toBe(true)
  })

  it('returns true for all_day volunteers for afternoon heats', () => {
    const metadata: VolunteerMembershipMetadata = {
      volunteerRoleTypes: [],
      availability: VOLUNTEER_AVAILABILITY.ALL_DAY,
    }
    expect(isVolunteerAvailableFor(metadata, 'afternoon')).toBe(true)
  })

  it('returns true for morning volunteers for morning heats', () => {
    const metadata: VolunteerMembershipMetadata = {
      volunteerRoleTypes: [],
      availability: VOLUNTEER_AVAILABILITY.MORNING,
    }
    expect(isVolunteerAvailableFor(metadata, 'morning')).toBe(true)
  })

  it('returns false for morning volunteers for afternoon heats', () => {
    const metadata: VolunteerMembershipMetadata = {
      volunteerRoleTypes: [],
      availability: VOLUNTEER_AVAILABILITY.MORNING,
    }
    expect(isVolunteerAvailableFor(metadata, 'afternoon')).toBe(false)
  })

  it('returns true for afternoon volunteers for afternoon heats', () => {
    const metadata: VolunteerMembershipMetadata = {
      volunteerRoleTypes: [],
      availability: VOLUNTEER_AVAILABILITY.AFTERNOON,
    }
    expect(isVolunteerAvailableFor(metadata, 'afternoon')).toBe(true)
  })

  it('returns false for afternoon volunteers for morning heats', () => {
    const metadata: VolunteerMembershipMetadata = {
      volunteerRoleTypes: [],
      availability: VOLUNTEER_AVAILABILITY.AFTERNOON,
    }
    expect(isVolunteerAvailableFor(metadata, 'morning')).toBe(false)
  })
})

describe('filterVolunteersByAvailability', () => {
  const createVolunteerWithAvailability = (
    id: string,
    availability?: string,
  ) => ({
    id,
    metadata: availability
      ? JSON.stringify({volunteerRoleTypes: [], availability})
      : null,
  })

  it('returns all volunteers when timeSlot is null', () => {
    const volunteers = [
      createVolunteerWithAvailability('v1', VOLUNTEER_AVAILABILITY.MORNING),
      createVolunteerWithAvailability('v2', VOLUNTEER_AVAILABILITY.AFTERNOON),
      createVolunteerWithAvailability('v3', VOLUNTEER_AVAILABILITY.ALL_DAY),
    ]

    const result = filterVolunteersByAvailability(volunteers, null)

    expect(result).toHaveLength(3)
    expect(result).toEqual(volunteers)
  })

  it('returns morning and all_day volunteers for morning heats', () => {
    const volunteers = [
      createVolunteerWithAvailability('v1', VOLUNTEER_AVAILABILITY.MORNING),
      createVolunteerWithAvailability('v2', VOLUNTEER_AVAILABILITY.AFTERNOON),
      createVolunteerWithAvailability('v3', VOLUNTEER_AVAILABILITY.ALL_DAY),
    ]

    const result = filterVolunteersByAvailability(volunteers, 'morning')

    expect(result).toHaveLength(2)
    expect(result.map((v) => v.id)).toEqual(['v1', 'v3'])
  })

  it('returns afternoon and all_day volunteers for afternoon heats', () => {
    const volunteers = [
      createVolunteerWithAvailability('v1', VOLUNTEER_AVAILABILITY.MORNING),
      createVolunteerWithAvailability('v2', VOLUNTEER_AVAILABILITY.AFTERNOON),
      createVolunteerWithAvailability('v3', VOLUNTEER_AVAILABILITY.ALL_DAY),
    ]

    const result = filterVolunteersByAvailability(volunteers, 'afternoon')

    expect(result).toHaveLength(2)
    expect(result.map((v) => v.id)).toEqual(['v2', 'v3'])
  })

  it('includes volunteers with no metadata (backwards compatibility)', () => {
    const volunteers = [
      createVolunteerWithAvailability('v1', VOLUNTEER_AVAILABILITY.MORNING),
      createVolunteerWithAvailability('v2'), // No metadata
      createVolunteerWithAvailability('v3', VOLUNTEER_AVAILABILITY.AFTERNOON),
    ]

    const morningResult = filterVolunteersByAvailability(volunteers, 'morning')
    expect(morningResult.map((v) => v.id)).toEqual(['v1', 'v2'])

    const afternoonResult = filterVolunteersByAvailability(
      volunteers,
      'afternoon',
    )
    expect(afternoonResult.map((v) => v.id)).toEqual(['v2', 'v3'])
  })

  it('includes volunteers with metadata but no availability field', () => {
    const volunteers = [
      createVolunteerWithAvailability('v1', VOLUNTEER_AVAILABILITY.MORNING),
      {
        id: 'v2',
        metadata: JSON.stringify({volunteerRoleTypes: []}),
      },
      createVolunteerWithAvailability('v3', VOLUNTEER_AVAILABILITY.AFTERNOON),
    ]

    const morningResult = filterVolunteersByAvailability(volunteers, 'morning')
    expect(morningResult.map((v) => v.id)).toEqual(['v1', 'v2'])
  })

  it('handles empty array', () => {
    const result = filterVolunteersByAvailability([], 'morning')
    expect(result).toHaveLength(0)
  })

  it('filters out all morning volunteers for afternoon heats', () => {
    const volunteers = [
      createVolunteerWithAvailability('v1', VOLUNTEER_AVAILABILITY.MORNING),
      createVolunteerWithAvailability('v2', VOLUNTEER_AVAILABILITY.MORNING),
    ]

    const result = filterVolunteersByAvailability(volunteers, 'afternoon')
    expect(result).toHaveLength(0)
  })

  it('filters out all afternoon volunteers for morning heats', () => {
    const volunteers = [
      createVolunteerWithAvailability('v1', VOLUNTEER_AVAILABILITY.AFTERNOON),
      createVolunteerWithAvailability('v2', VOLUNTEER_AVAILABILITY.AFTERNOON),
    ]

    const result = filterVolunteersByAvailability(volunteers, 'morning')
    expect(result).toHaveLength(0)
  })

  it('works with only all_day volunteers', () => {
    const volunteers = [
      createVolunteerWithAvailability('v1', VOLUNTEER_AVAILABILITY.ALL_DAY),
      createVolunteerWithAvailability('v2', VOLUNTEER_AVAILABILITY.ALL_DAY),
    ]

    const morningResult = filterVolunteersByAvailability(volunteers, 'morning')
    expect(morningResult).toHaveLength(2)

    const afternoonResult = filterVolunteersByAvailability(
      volunteers,
      'afternoon',
    )
    expect(afternoonResult).toHaveLength(2)
  })
})

// ============================================================================
// DIRECT INVITE DETECTION
// ============================================================================

describe('isDirectInvite', () => {
  describe('with inviteSource in metadata', () => {
    it("returns true when inviteSource is 'direct'", () => {
      const metadata: VolunteerMembershipMetadata = {
        volunteerRoleTypes: [],
        inviteSource: VOLUNTEER_INVITE_SOURCE.DIRECT,
      }

      expect(isDirectInvite(metadata, null)).toBe(true)
    })

    it("returns false when inviteSource is 'application'", () => {
      const metadata: VolunteerMembershipMetadata = {
        volunteerRoleTypes: [],
        inviteSource: VOLUNTEER_INVITE_SOURCE.APPLICATION,
      }

      expect(isDirectInvite(metadata, null)).toBe(false)
    })

    it('returns false when inviteSource is not set', () => {
      const metadata: VolunteerMembershipMetadata = {
        volunteerRoleTypes: [],
      }

      expect(isDirectInvite(metadata, null)).toBe(false)
    })
  })

  describe('with invitedBy (legacy detection)', () => {
    it('returns true when invitedBy is set, regardless of metadata', () => {
      const metadata: VolunteerMembershipMetadata = {
        volunteerRoleTypes: [],
        inviteSource: VOLUNTEER_INVITE_SOURCE.APPLICATION, // Even if metadata says application
      }

      // invitedBy takes precedence - if someone invited them, it's a direct invite
      expect(isDirectInvite(metadata, 'admin-user-id')).toBe(true)
    })

    it('returns true when invitedBy is set and metadata is null', () => {
      expect(isDirectInvite(null, 'admin-user-id')).toBe(true)
    })

    it('returns false when invitedBy is null and metadata is null', () => {
      expect(isDirectInvite(null, null)).toBe(false)
    })
  })

  describe('combined logic', () => {
    it('returns true for direct invite with invitedBy', () => {
      const metadata: VolunteerMembershipMetadata = {
        volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.JUDGE],
        inviteSource: VOLUNTEER_INVITE_SOURCE.DIRECT,
      }

      expect(isDirectInvite(metadata, 'admin-id')).toBe(true)
    })

    it('returns false for application without invitedBy', () => {
      const metadata: VolunteerMembershipMetadata = {
        volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.GENERAL],
        inviteSource: VOLUNTEER_INVITE_SOURCE.APPLICATION,
        status: 'pending',
        signupEmail: 'volunteer@example.com',
        signupName: 'Test Volunteer',
      }

      expect(isDirectInvite(metadata, null)).toBe(false)
    })

    it('returns true for legacy invite (no inviteSource but has invitedBy)', () => {
      const metadata: VolunteerMembershipMetadata = {
        volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.JUDGE],
        // No inviteSource - legacy invite before inviteSource was added
      }

      expect(isDirectInvite(metadata, 'admin-user-123')).toBe(true)
    })
  })
})

// ============================================================================
// INVITE STATUS CALCULATION
// ============================================================================

describe('calculateInviteStatus', () => {
  describe('accepted status', () => {
    it("returns 'accepted' when acceptedAt is set", () => {
      const acceptedAt = new Date('2024-01-15')
      const expiresAt = null

      expect(calculateInviteStatus(acceptedAt, expiresAt)).toBe('accepted')
    })

    it("returns 'accepted' when acceptedAt is set even if expired", () => {
      // Edge case: accepted before expiry but we're checking after expiry
      // Acceptance takes precedence
      const acceptedAt = new Date('2024-01-15')
      const expiresAt = new Date('2024-01-10') // Expires before acceptance
      const now = new Date('2024-01-20')

      expect(calculateInviteStatus(acceptedAt, expiresAt, now)).toBe('accepted')
    })

    it("returns 'accepted' when accepted recently", () => {
      const now = new Date('2024-06-15T12:00:00Z')
      const acceptedAt = new Date('2024-06-15T11:00:00Z') // 1 hour ago
      const expiresAt = new Date('2024-07-01') // Future expiry

      expect(calculateInviteStatus(acceptedAt, expiresAt, now)).toBe('accepted')
    })
  })

  describe('expired status', () => {
    it("returns 'expired' when expiresAt is in the past", () => {
      const acceptedAt = null
      const expiresAt = new Date('2024-01-01')
      const now = new Date('2024-06-15')

      expect(calculateInviteStatus(acceptedAt, expiresAt, now)).toBe('expired')
    })

    it("returns 'expired' when expiresAt is exactly now", () => {
      const now = new Date('2024-06-15T12:00:00Z')
      const acceptedAt = null
      const expiresAt = new Date('2024-06-15T11:59:59Z') // 1 second before now

      expect(calculateInviteStatus(acceptedAt, expiresAt, now)).toBe('expired')
    })

    it("returns 'pending' when expiresAt is in the future", () => {
      const now = new Date('2024-06-15')
      const acceptedAt = null
      const expiresAt = new Date('2024-07-01')

      expect(calculateInviteStatus(acceptedAt, expiresAt, now)).toBe('pending')
    })
  })

  describe('pending status', () => {
    it("returns 'pending' when not accepted and not expired", () => {
      const now = new Date('2024-06-15')
      const acceptedAt = null
      const expiresAt = new Date('2024-12-31')

      expect(calculateInviteStatus(acceptedAt, expiresAt, now)).toBe('pending')
    })

    it("returns 'pending' when not accepted and no expiry", () => {
      const acceptedAt = null
      const expiresAt = null

      expect(calculateInviteStatus(acceptedAt, expiresAt)).toBe('pending')
    })

    it("returns 'pending' for fresh invite with future expiry", () => {
      const now = new Date('2024-06-15T10:00:00Z')
      const acceptedAt = null
      const expiresAt = new Date('2024-06-22T10:00:00Z') // 7 days from now

      expect(calculateInviteStatus(acceptedAt, expiresAt, now)).toBe('pending')
    })
  })

  describe('edge cases', () => {
    it('handles null for both acceptedAt and expiresAt', () => {
      expect(calculateInviteStatus(null, null)).toBe('pending')
    })

    it('uses current date when now is not provided', () => {
      const acceptedAt = null
      // Set expiry far in future - should be pending
      const expiresAt = new Date('2099-12-31')

      expect(calculateInviteStatus(acceptedAt, expiresAt)).toBe('pending')
    })

    it('uses current date when now is not provided and invite is expired', () => {
      const acceptedAt = null
      // Set expiry in past - should be expired
      const expiresAt = new Date('2020-01-01')

      expect(calculateInviteStatus(acceptedAt, expiresAt)).toBe('expired')
    })
  })
})

// ============================================================================
// INVITE SOURCE METADATA INTEGRATION
// ============================================================================

describe('volunteer invite metadata integration', () => {
  describe('direct invite metadata structure', () => {
    it('correctly identifies direct invite with full metadata', () => {
      const metadata: VolunteerMembershipMetadata = {
        volunteerRoleTypes: [
          VOLUNTEER_ROLE_TYPES.JUDGE,
          VOLUNTEER_ROLE_TYPES.HEAD_JUDGE,
        ],
        inviteSource: VOLUNTEER_INVITE_SOURCE.DIRECT,
        availability: VOLUNTEER_AVAILABILITY.ALL_DAY,
        credentials: 'L1 Judge Certified',
      }

      expect(isDirectInvite(metadata, 'admin-123')).toBe(true)
      expect(metadata.inviteSource).toBe('direct')
    })

    it('correctly identifies application with full metadata', () => {
      const metadata: VolunteerMembershipMetadata = {
        volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.GENERAL],
        inviteSource: VOLUNTEER_INVITE_SOURCE.APPLICATION,
        status: 'pending',
        signupEmail: 'applicant@example.com',
        signupName: 'Jane Applicant',
        signupPhone: '555-1234',
        availability: VOLUNTEER_AVAILABILITY.MORNING,
        availabilityNotes: 'Available Saturday morning only',
      }

      expect(isDirectInvite(metadata, null)).toBe(false)
      expect(metadata.inviteSource).toBe('application')
      expect(metadata.status).toBe('pending')
    })
  })

  describe('status workflow', () => {
    it('pending application workflow', () => {
      // Step 1: User applies via public form
      const pendingApplication: VolunteerMembershipMetadata = {
        volunteerRoleTypes: [],
        inviteSource: VOLUNTEER_INVITE_SOURCE.APPLICATION,
        status: 'pending',
        signupEmail: 'volunteer@example.com',
        signupName: 'New Volunteer',
      }

      expect(isDirectInvite(pendingApplication, null)).toBe(false)
      expect(pendingApplication.status).toBe('pending')

      // Step 2: Admin approves (status changes to approved, invitedBy is set)
      const approvedApplication: VolunteerMembershipMetadata = {
        ...pendingApplication,
        status: 'approved',
        volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.JUDGE],
      }

      // Still an application (inviteSource doesn't change)
      expect(isDirectInvite(approvedApplication, null)).toBe(false)
      expect(approvedApplication.status).toBe('approved')
    })

    it('direct invite workflow', () => {
      // Step 1: Admin creates direct invite
      const directInvite: VolunteerMembershipMetadata = {
        volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.JUDGE],
        inviteSource: VOLUNTEER_INVITE_SOURCE.DIRECT,
      }

      expect(isDirectInvite(directInvite, 'admin-user-id')).toBe(true)

      // Step 2: User accepts and fills in availability
      const acceptedDirectInvite: VolunteerMembershipMetadata = {
        ...directInvite,
        availability: VOLUNTEER_AVAILABILITY.ALL_DAY,
        credentials: 'CrossFit L1',
        availabilityNotes: 'Available both days',
      }

      expect(isDirectInvite(acceptedDirectInvite, 'admin-user-id')).toBe(true)
    })
  })

  describe('legacy data compatibility', () => {
    it('handles legacy invite without inviteSource field', () => {
      // Old invites created before inviteSource was added
      const legacyDirectInvite: VolunteerMembershipMetadata = {
        volunteerRoleTypes: [VOLUNTEER_ROLE_TYPES.JUDGE],
        credentials: 'Experienced Judge',
        // No inviteSource field
      }

      // Without invitedBy, defaults to not direct
      expect(isDirectInvite(legacyDirectInvite, null)).toBe(false)

      // With invitedBy (legacy indicator), should be direct
      expect(isDirectInvite(legacyDirectInvite, 'old-admin-id')).toBe(true)
    })

    it('handles legacy application without inviteSource field', () => {
      const legacyApplication: VolunteerMembershipMetadata = {
        volunteerRoleTypes: [],
        status: 'pending',
        signupEmail: 'old-applicant@example.com',
        signupName: 'Old Applicant',
        // No inviteSource field
      }

      // Applications never had invitedBy set
      expect(isDirectInvite(legacyApplication, null)).toBe(false)
    })
  })
})
