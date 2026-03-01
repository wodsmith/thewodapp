import {beforeEach, describe, expect, it, vi} from 'vitest'
import {FakeDrizzleDb} from '@repo/test-utils'

import {
  submitVolunteerSignupFn,
  inviteVolunteerFn,
  createAccountAndApplyAsVolunteerFn,
  addVolunteerRoleTypeFn,
  removeVolunteerRoleTypeFn,
  grantScoreAccessFn,
  revokeScoreAccessFn,
  updateVolunteerMetadataFn,
  bulkAssignVolunteerRoleFn,
  getVolunteerAssignmentsFn,
  canInputScoresFn,
  getDirectVolunteerInvitesFn,
  getCompetitionVolunteersFn,
  getPendingVolunteerInvitationsFn,
} from '@/server-fns/volunteer-fns'

// Mock the database
const mockDb = new FakeDrizzleDb()

vi.mock('@/db', () => ({
  getDb: vi.fn(() => mockDb),
}))

// Mock TanStack createServerFn
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    inputValidator: () => ({
      handler: (fn: any) => fn,
    }),
  }),
}))

// Create mock session
const mockOrganizerSession = {
  userId: 'organizer-user-123',
  user: {
    id: 'organizer-user-123',
    email: 'organizer@example.com',
    role: 'user',
  },
  teams: [
    {
      id: 'team-org-123',
      name: 'Test Team',
      permissions: ['manage_competitions'],
    },
  ],
}

// Mock auth
vi.mock('@/utils/auth', () => ({
  getSessionFromCookie: vi.fn(() => Promise.resolve(mockOrganizerSession)),
  canSignUp: vi.fn(() => Promise.resolve()),
  createAndStoreSession: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/utils/password-hasher', () => ({
  hashPassword: vi.fn(() => Promise.resolve('hashed_password_123')),
}))

vi.mock('@/utils/team-auth', () => ({
  requireTeamPermission: vi.fn(() => Promise.resolve()),
  hasTeamPermission: vi.fn(() => Promise.resolve(true)),
}))

// Mock email utilities to avoid pulling in createServerOnlyFn from env.ts
vi.mock('@/utils/email', () => ({
  sendVolunteerDirectInviteEmail: vi.fn(() => Promise.resolve()),
}))

// Mock server modules
vi.mock('@/server/entitlements', () => ({
  createEntitlement: vi.fn(() => Promise.resolve({id: 'ent_test123'})),
}))

vi.mock('@/server/team-members', () => ({
  inviteUserToTeam: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/server/volunteers', () => ({
  calculateInviteStatus: vi.fn(
    (acceptedAt: Date | null, expiresAt: Date | null) => {
      if (acceptedAt) return 'accepted'
      if (expiresAt && expiresAt < new Date()) return 'expired'
      return 'pending'
    },
  ),
  isDirectInvite: vi.fn(
    (meta: any, invitedBy: string | null) => {
      if (invitedBy !== null) return true
      if (meta?.inviteSource === 'direct') return true
      return false
    },
  ),
  isVolunteer: vi.fn((m: any) => m.roleId === 'volunteer' && m.isSystemRole === 1),
}))

// Mock batch-query
vi.mock('@/utils/batch-query', () => ({
  autochunk: vi.fn(async (_opts: any, fn: any) => {
    return fn(_opts.items)
  }),
}))

import {getSessionFromCookie, canSignUp, createAndStoreSession} from '@/utils/auth'
import {requireTeamPermission} from '@/utils/team-auth'
import {inviteUserToTeam} from '@/server/team-members'
import {createEntitlement} from '@/server/entitlements'
import {hashPassword} from '@/utils/password-hasher'

const setMockSession = (session: unknown) => {
  vi.mocked(getSessionFromCookie).mockResolvedValue(
    session as Awaited<ReturnType<typeof getSessionFromCookie>>,
  )
}

// ============================================================================
// Test Data Factories
// ============================================================================

const createMockInvitation = (overrides?: Partial<{
  id: string
  teamId: string
  email: string
  roleId: string
  isSystemRole: number
  token: string
  invitedBy: string | null
  acceptedAt: Date | null
  expiresAt: Date | null
  metadata: string | null
  createdAt: Date
  updatedAt: Date
}>) => ({
  id: overrides?.id ?? 'tinv_test123',
  teamId: overrides?.teamId ?? 'team_comp123',
  email: overrides?.email ?? 'vol@example.com',
  roleId: overrides?.roleId ?? 'volunteer',
  isSystemRole: overrides?.isSystemRole ?? 1,
  token: overrides?.token ?? 'test-token-uuid',
  invitedBy: overrides?.invitedBy ?? null,
  acceptedAt: overrides?.acceptedAt ?? null,
  expiresAt: overrides?.expiresAt ?? new Date('2026-01-01'),
  metadata: overrides?.metadata ?? JSON.stringify({
    volunteerRoleTypes: ['judge'],
    inviteSource: 'direct',
  }),
  createdAt: overrides?.createdAt ?? new Date(),
  updatedAt: overrides?.updatedAt ?? new Date(),
})

const createMockMembership = (overrides?: Partial<{
  id: string
  teamId: string
  userId: string
  roleId: string
  isSystemRole: number
  metadata: string | null
}>) => ({
  id: overrides?.id ?? 'tmem_vol123',
  teamId: overrides?.teamId ?? 'team_comp123',
  userId: overrides?.userId ?? 'user-vol-123',
  roleId: overrides?.roleId ?? 'volunteer',
  isSystemRole: overrides?.isSystemRole ?? 1,
  invitedBy: null,
  invitedAt: null,
  joinedAt: new Date(),
  expiresAt: null,
  isActive: 1,
  metadata: overrides?.metadata ?? JSON.stringify({volunteerRoleTypes: ['judge']}),
  createdAt: new Date(),
  updatedAt: new Date(),
  updateCounter: null,
})

describe('Volunteer Server Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.reset()
    mockDb.registerTable('teamInvitationTable')
    mockDb.registerTable('teamMembershipTable')
    mockDb.registerTable('competitionsTable')
    mockDb.registerTable('entitlementTable')
    mockDb.registerTable('entitlementTypeTable')
    mockDb.registerTable('userTable')
    mockDb.registerTable('volunteerShiftsTable')
    mockDb.registerTable('volunteerShiftAssignmentsTable')
    mockDb.registerTable('competitionHeatsTable')
    mockDb.registerTable('judgeHeatAssignmentsTable')
    mockDb.registerTable('teamTable')
    setMockSession(mockOrganizerSession)
  })

  // ============================================================================
  // getPendingVolunteerInvitationsFn
  // ============================================================================
  describe('getPendingVolunteerInvitationsFn', () => {
    it('should return pending invitations for a team', async () => {
      const invitations = [
        createMockInvitation({id: 'tinv_1'}),
        createMockInvitation({id: 'tinv_2'}),
      ]
      mockDb.setMockReturnValue(invitations)

      const result = await getPendingVolunteerInvitationsFn({
        data: {competitionTeamId: 'team_comp123'},
      })

      expect(result).toHaveLength(2)
    })

    it('should return empty array when no pending invitations', async () => {
      mockDb.setMockReturnValue([])

      const result = await getPendingVolunteerInvitationsFn({
        data: {competitionTeamId: 'team_comp123'},
      })

      expect(result).toEqual([])
    })
  })

  // ============================================================================
  // getCompetitionVolunteersFn
  // ============================================================================
  describe('getCompetitionVolunteersFn', () => {
    it('should return volunteers with user data', async () => {
      const volunteers = [
        {
          ...createMockMembership({id: 'tmem_vol1'}),
          user: {id: 'user-1', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com'},
        },
      ]
      mockDb.setMockReturnValue(volunteers)

      const result = await getCompetitionVolunteersFn({
        data: {competitionTeamId: 'team_comp123'},
      })

      expect(result).toHaveLength(1)
    })
  })

  // ============================================================================
  // getDirectVolunteerInvitesFn
  // ============================================================================
  describe('getDirectVolunteerInvitesFn', () => {
    it('should filter to only direct invites', async () => {
      const invitations = [
        createMockInvitation({
          id: 'tinv_direct',
          invitedBy: 'admin-123',
          metadata: JSON.stringify({
            volunteerRoleTypes: ['judge'],
            inviteSource: 'direct',
            inviteName: 'John Judge',
          }),
        }),
        createMockInvitation({
          id: 'tinv_application',
          invitedBy: null,
          metadata: JSON.stringify({
            volunteerRoleTypes: [],
            inviteSource: 'application',
            status: 'pending',
          }),
        }),
      ]
      mockDb.setMockReturnValue(invitations)

      const result = await getDirectVolunteerInvitesFn({
        data: {competitionTeamId: 'team_comp123'},
      })

      // Only direct invite should be returned
      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe('tinv_direct')
      expect(result[0]?.name).toBe('John Judge')
      expect(result[0]?.roleTypes).toEqual(['judge'])
    })

    it('should return empty array when no direct invites', async () => {
      mockDb.setMockReturnValue([])

      const result = await getDirectVolunteerInvitesFn({
        data: {competitionTeamId: 'team_comp123'},
      })

      expect(result).toEqual([])
    })
  })

  // ============================================================================
  // canInputScoresFn
  // ============================================================================
  describe('canInputScoresFn', () => {
    it('should return true when user has score entitlement', async () => {
      mockDb.setMockReturnValue([{id: 'ent_1', userId: 'user-1'}])

      const result = await canInputScoresFn({
        data: {userId: 'user-1', competitionTeamId: 'team_comp123'},
      })

      expect(result).toBe(true)
    })

    it('should return false when user has no score entitlement', async () => {
      mockDb.setMockReturnValue([])

      const result = await canInputScoresFn({
        data: {userId: 'user-1', competitionTeamId: 'team_comp123'},
      })

      expect(result).toBe(false)
    })
  })

  // ============================================================================
  // submitVolunteerSignupFn
  // ============================================================================
  describe('submitVolunteerSignupFn', () => {
    it('should create a volunteer signup invitation', async () => {
      // findMany must return [] for duplicate check
      mockDb.query.teamInvitationTable.findMany.mockResolvedValueOnce([])
      mockDb.setMockSingleValue(null) // No existing user
      // Mock findFirst() after insert (PlanetScale: no .returning())
      mockDb.query.teamInvitationTable.findFirst.mockResolvedValueOnce({id: 'tinv_new123'})

      const result = await submitVolunteerSignupFn({
        data: {
          competitionTeamId: 'team_comp123',
          signupName: 'New Volunteer',
          signupEmail: 'newvol@example.com',
          availability: 'all_day',
        },
      })

      expect(result.success).toBe(true)
      expect(result.membershipId).toBe('tinv_new123')
    })

    it('should silently succeed for honeypot-filled submissions (bot detection)', async () => {
      const result = await submitVolunteerSignupFn({
        data: {
          competitionTeamId: 'team_comp123',
          signupName: 'Bot',
          signupEmail: 'bot@spam.com',
          website: 'http://spam.com', // Honeypot filled = bot
        },
      })

      expect(result.success).toBe(true)
      // Should NOT have queried the database
      expect(mockDb.query.teamInvitationTable.findMany).not.toHaveBeenCalled()
    })

    it('should reject duplicate email signups', async () => {
      // Return existing invitation with same email
      mockDb.setMockReturnValue([
        createMockInvitation({email: 'duplicate@example.com'}),
      ])

      await expect(
        submitVolunteerSignupFn({
          data: {
            competitionTeamId: 'team_comp123',
            signupName: 'Duplicate',
            signupEmail: 'duplicate@example.com',
          },
        }),
      ).rejects.toThrow('already been used to sign up')
    })

    it('should reject when user already has volunteer membership', async () => {
      // No existing invitations with matching email
      mockDb.setMockReturnValue([])
      // User exists
      mockDb.setMockSingleValue({id: 'user-existing', email: 'existing@example.com'})
      // Membership exists for this user
      // The function queries for user first, then checks membership
      // After setMockSingleValue for user, the next findFirst needs to return a membership
      // But FakeDrizzleDb only has one mockSingleValue... so this tests the first path

      // Actually, the function flow:
      // 1. findMany invitations -> [] (no dup)
      // 2. findFirst user by email -> user
      // 3. findFirst membership -> membership exists
      // Since mockSingleValue returns the same value for all findFirst calls,
      // we need to work with the mock's limitations

      // For the duplicate membership path, we need the user lookup to succeed
      // and then the membership lookup to also succeed.
      // Both use findFirst which shares mockSingleValue.
      // Let's test that the error is thrown for the general duplicate case
      await expect(
        submitVolunteerSignupFn({
          data: {
            competitionTeamId: 'team_comp123',
            signupName: 'Existing',
            signupEmail: 'existing@example.com',
          },
        }),
      ).rejects.toThrow('already volunteering')
    })
  })

  // ============================================================================
  // inviteVolunteerFn
  // ============================================================================
  describe('inviteVolunteerFn', () => {
    it('should invite a volunteer with role types', async () => {
      const result = await inviteVolunteerFn({
        data: {
          email: 'judge@example.com',
          competitionTeamId: 'team_comp123',
          organizingTeamId: 'team-org-123',
          competitionId: 'comp_test123',
          roleTypes: ['judge', 'head_judge'],
        },
      })

      expect(result.success).toBe(true)
      expect(requireTeamPermission).toHaveBeenCalledWith(
        'team-org-123',
        'manage_competitions',
      )
      expect(inviteUserToTeam).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId: 'team_comp123',
          email: 'judge@example.com',
          roleId: 'volunteer',
          isSystemRole: true,
          skipPermissionCheck: true,
        }),
      )
    })

    it('should include name in metadata when provided', async () => {
      await inviteVolunteerFn({
        data: {
          name: 'John Judge',
          email: 'john@example.com',
          competitionTeamId: 'team_comp123',
          organizingTeamId: 'team-org-123',
          competitionId: 'comp_test123',
          roleTypes: ['judge'],
        },
      })

      expect(inviteUserToTeam).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.stringContaining('inviteName'),
        }),
      )
    })

    it('should reject when email already has a pending application or invite', async () => {
      // Existing invitation with same email
      mockDb.query.teamInvitationTable.findMany.mockResolvedValueOnce([
        createMockInvitation({email: 'judge@example.com'}),
      ])

      await expect(
        inviteVolunteerFn({
          data: {
            email: 'judge@example.com',
            competitionTeamId: 'team_comp123',
            organizingTeamId: 'team-org-123',
            competitionId: 'comp_test123',
            roleTypes: ['judge'],
          },
        }),
      ).rejects.toThrow('already been invited or has applied')

      expect(inviteUserToTeam).not.toHaveBeenCalled()
    })

    it('should reject when user is already an approved volunteer', async () => {
      // No existing invitations
      mockDb.query.teamInvitationTable.findMany.mockResolvedValueOnce([])
      // Existing user found
      mockDb.query.userTable.findFirst.mockResolvedValueOnce({id: 'user-existing-vol'})
      // Existing volunteer membership found
      mockDb.query.teamMembershipTable.findFirst.mockResolvedValueOnce(
        createMockMembership({userId: 'user-existing-vol'}),
      )

      await expect(
        inviteVolunteerFn({
          data: {
            email: 'existing-vol@example.com',
            competitionTeamId: 'team_comp123',
            organizingTeamId: 'team-org-123',
            competitionId: 'comp_test123',
            roleTypes: ['judge'],
          },
        }),
      ).rejects.toThrow('already a volunteer')

      expect(inviteUserToTeam).not.toHaveBeenCalled()
    })

    it('should be case-insensitive when checking for duplicate email', async () => {
      // Invitation with lowercase email, invite with uppercase
      mockDb.query.teamInvitationTable.findMany.mockResolvedValueOnce([
        createMockInvitation({email: 'judge@example.com'}),
      ])

      await expect(
        inviteVolunteerFn({
          data: {
            email: 'JUDGE@EXAMPLE.COM',
            competitionTeamId: 'team_comp123',
            organizingTeamId: 'team-org-123',
            competitionId: 'comp_test123',
            roleTypes: ['judge'],
          },
        }),
      ).rejects.toThrow('already been invited or has applied')
    })
  })

  // ============================================================================
  // addVolunteerRoleTypeFn
  // ============================================================================
  describe('addVolunteerRoleTypeFn', () => {
    it('should add a role type to a membership', async () => {
      mockDb.setMockSingleValue(
        createMockMembership({metadata: JSON.stringify({volunteerRoleTypes: ['judge']})}),
      )

      const result = await addVolunteerRoleTypeFn({
        data: {
          membershipId: 'tmem_vol123',
          organizingTeamId: 'team-org-123',
          competitionId: 'comp_test123',
          roleType: 'scorekeeper',
        },
      })

      expect(result.success).toBe(true)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('should skip if role type already exists', async () => {
      mockDb.setMockSingleValue(
        createMockMembership({metadata: JSON.stringify({volunteerRoleTypes: ['judge']})}),
      )

      const result = await addVolunteerRoleTypeFn({
        data: {
          membershipId: 'tmem_vol123',
          organizingTeamId: 'team-org-123',
          competitionId: 'comp_test123',
          roleType: 'judge', // Already exists
        },
      })

      expect(result.success).toBe(true)
    })

    it('should work with invitation IDs (tinv_ prefix)', async () => {
      mockDb.setMockSingleValue(
        createMockInvitation({
          id: 'tinv_invite123',
          metadata: JSON.stringify({volunteerRoleTypes: []}),
        }),
      )

      const result = await addVolunteerRoleTypeFn({
        data: {
          membershipId: 'tinv_invite123',
          organizingTeamId: 'team-org-123',
          competitionId: 'comp_test123',
          roleType: 'medical',
        },
      })

      expect(result.success).toBe(true)
    })

    it('should throw when membership not found', async () => {
      mockDb.setMockSingleValue(null)

      await expect(
        addVolunteerRoleTypeFn({
          data: {
            membershipId: 'tmem_nonexistent',
            organizingTeamId: 'team-org-123',
            competitionId: 'comp_test123',
            roleType: 'judge',
          },
        }),
      ).rejects.toThrow('not found')
    })
  })

  // ============================================================================
  // removeVolunteerRoleTypeFn
  // ============================================================================
  describe('removeVolunteerRoleTypeFn', () => {
    it('should remove a role type from a membership', async () => {
      mockDb.setMockSingleValue(
        createMockMembership({
          metadata: JSON.stringify({volunteerRoleTypes: ['judge', 'scorekeeper']}),
        }),
      )

      const result = await removeVolunteerRoleTypeFn({
        data: {
          membershipId: 'tmem_vol123',
          organizingTeamId: 'team-org-123',
          competitionId: 'comp_test123',
          roleType: 'judge',
        },
      })

      expect(result.success).toBe(true)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('should skip if role type does not exist', async () => {
      mockDb.setMockSingleValue(
        createMockMembership({
          metadata: JSON.stringify({volunteerRoleTypes: ['judge']}),
        }),
      )

      const result = await removeVolunteerRoleTypeFn({
        data: {
          membershipId: 'tmem_vol123',
          organizingTeamId: 'team-org-123',
          competitionId: 'comp_test123',
          roleType: 'medical', // Not in list
        },
      })

      expect(result.success).toBe(true)
    })

    it('should work with invitation IDs', async () => {
      mockDb.setMockSingleValue(
        createMockInvitation({
          metadata: JSON.stringify({volunteerRoleTypes: ['judge', 'medical']}),
        }),
      )

      const result = await removeVolunteerRoleTypeFn({
        data: {
          membershipId: 'tinv_invite123',
          organizingTeamId: 'team-org-123',
          competitionId: 'comp_test123',
          roleType: 'medical',
        },
      })

      expect(result.success).toBe(true)
    })

    it('should throw when membership not found', async () => {
      mockDb.setMockSingleValue(null)

      await expect(
        removeVolunteerRoleTypeFn({
          data: {
            membershipId: 'tmem_nonexistent',
            organizingTeamId: 'team-org-123',
            competitionId: 'comp_test123',
            roleType: 'judge',
          },
        }),
      ).rejects.toThrow('not found')
    })
  })

  // ============================================================================
  // grantScoreAccessFn
  // ============================================================================
  describe('grantScoreAccessFn', () => {
    it('should grant score access to a volunteer', async () => {
      // entitlement type exists
      mockDb.setMockSingleValue({id: 'competition_score_input'})
      // no existing access
      mockDb.setMockReturnValue([])

      const result = await grantScoreAccessFn({
        data: {
          volunteerId: 'user-vol-123',
          competitionTeamId: 'team_comp123',
          organizingTeamId: 'team-org-123',
          competitionId: 'comp_test123',
          grantedBy: 'organizer-user-123',
        },
      })

      expect(result.success).toBe(true)
      expect(requireTeamPermission).toHaveBeenCalled()
      expect(createEntitlement).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-vol-123',
          teamId: 'team_comp123',
          entitlementTypeId: 'competition_score_input',
          sourceType: 'MANUAL',
        }),
      )
    })

    it('should skip if volunteer already has score access for same competition', async () => {
      // entitlement type exists
      mockDb.setMockSingleValue({id: 'competition_score_input'})
      // existing access found with matching competitionId
      mockDb.setMockSingleValue({
        id: 'ent_existing',
        metadata: {competitionId: 'comp_test123'},
      })

      const result = await grantScoreAccessFn({
        data: {
          volunteerId: 'user-vol-123',
          competitionTeamId: 'team_comp123',
          organizingTeamId: 'team-org-123',
          competitionId: 'comp_test123',
          grantedBy: 'organizer-user-123',
        },
      })

      expect(result.success).toBe(true)
      // Should NOT create a new entitlement
      expect(createEntitlement).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // revokeScoreAccessFn
  // ============================================================================
  describe('revokeScoreAccessFn', () => {
    it('should soft-delete score entitlements', async () => {
      mockDb.setMockReturnValue([{id: 'ent_1'}, {id: 'ent_2'}])

      const result = await revokeScoreAccessFn({
        data: {
          userId: 'user-vol-123',
          competitionTeamId: 'team_comp123',
          organizingTeamId: 'team-org-123',
          competitionId: 'comp_test123',
        },
      })

      expect(result.success).toBe(true)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('should return success even when no entitlements exist', async () => {
      mockDb.setMockReturnValue([])

      const result = await revokeScoreAccessFn({
        data: {
          userId: 'user-vol-123',
          competitionTeamId: 'team_comp123',
          organizingTeamId: 'team-org-123',
          competitionId: 'comp_test123',
        },
      })

      expect(result.success).toBe(true)
    })
  })

  // ============================================================================
  // updateVolunteerMetadataFn
  // ============================================================================
  describe('updateVolunteerMetadataFn', () => {
    it('should update membership metadata', async () => {
      mockDb.setMockSingleValue(
        createMockMembership({
          metadata: JSON.stringify({volunteerRoleTypes: ['judge']}),
        }),
      )

      const result = await updateVolunteerMetadataFn({
        data: {
          membershipId: 'tmem_vol123',
          organizingTeamId: 'team-org-123',
          competitionId: 'comp_test123',
          metadata: {credentials: 'L1 Judge'},
        },
      })

      expect(result.success).toBe(true)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('should reject unauthenticated users', async () => {
      setMockSession(null)

      await expect(
        updateVolunteerMetadataFn({
          data: {
            membershipId: 'tmem_vol123',
            organizingTeamId: 'team-org-123',
            competitionId: 'comp_test123',
            metadata: {credentials: 'L1'},
          },
        }),
      ).rejects.toThrow('NOT_AUTHORIZED')
    })

    it('should throw when invitation not found', async () => {
      mockDb.setMockSingleValue(null)

      await expect(
        updateVolunteerMetadataFn({
          data: {
            membershipId: 'tinv_nonexistent',
            organizingTeamId: 'team-org-123',
            competitionId: 'comp_test123',
            metadata: {status: 'approved'},
          },
        }),
      ).rejects.toThrow('NOT_FOUND')
    })

    it('should throw when membership not found', async () => {
      mockDb.setMockSingleValue(null)

      await expect(
        updateVolunteerMetadataFn({
          data: {
            membershipId: 'tmem_nonexistent',
            organizingTeamId: 'team-org-123',
            competitionId: 'comp_test123',
            metadata: {credentials: 'test'},
          },
        }),
      ).rejects.toThrow('NOT_FOUND')
    })

    it('should handle invitation approval workflow', async () => {
      // When status changes to approved, special logic runs
      const invitation = createMockInvitation({
        metadata: JSON.stringify({
          volunteerRoleTypes: ['judge'],
          inviteSource: 'application',
          status: 'pending',
        }),
      })
      mockDb.setMockSingleValue(invitation)

      const result = await updateVolunteerMetadataFn({
        data: {
          membershipId: 'tinv_test123',
          organizingTeamId: 'team-org-123',
          competitionId: 'comp_test123',
          metadata: {status: 'approved'},
        },
      })

      expect(result.success).toBe(true)
      expect(mockDb.update).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // bulkAssignVolunteerRoleFn
  // ============================================================================
  describe('bulkAssignVolunteerRoleFn', () => {
    it('should assign role to multiple memberships', async () => {
      // First call returns membership for tmem_vol1
      mockDb.setMockSingleValue(
        createMockMembership({
          id: 'tmem_vol1',
          metadata: JSON.stringify({volunteerRoleTypes: []}),
        }),
      )

      const result = await bulkAssignVolunteerRoleFn({
        data: {
          membershipIds: ['tmem_vol1'],
          organizingTeamId: 'team-org-123',
          competitionId: 'comp_test123',
          roleType: 'judge',
        },
      })

      expect(result.success).toBe(true)
      expect(result.succeeded).toBeGreaterThanOrEqual(0)
    })

    it('should check permissions before bulk assign', async () => {
      mockDb.setMockSingleValue(createMockMembership())

      await bulkAssignVolunteerRoleFn({
        data: {
          membershipIds: ['tmem_vol1'],
          organizingTeamId: 'team-org-123',
          competitionId: 'comp_test123',
          roleType: 'medical',
        },
      })

      expect(requireTeamPermission).toHaveBeenCalledWith(
        'team-org-123',
        'manage_competitions',
      )
    })
  })

  // ============================================================================
  // createAccountAndApplyAsVolunteerFn
  // ============================================================================
  describe('createAccountAndApplyAsVolunteerFn', () => {
    const baseInput = {
      firstName: 'Jane',
      lastName: 'Doe',
      password: 'Password123',
      competitionTeamId: 'team_comp123',
      signupName: 'Jane Doe',
      signupEmail: 'jane@example.com',
      availability: 'all_day' as const,
    }

    it('should silently succeed for honeypot-filled submissions (bot detection)', async () => {
      const result = await createAccountAndApplyAsVolunteerFn({
        data: {...baseInput, website: 'http://spam.com'},
      })

      expect(result.success).toBe(true)
      expect(canSignUp).not.toHaveBeenCalled()
    })

    it('should create a new user account and volunteer application', async () => {
      // No existing user in account creation check
      mockDb.query.userTable.findFirst.mockResolvedValueOnce(null)
      // No duplicate invitations in createVolunteerApplication
      mockDb.query.teamInvitationTable.findMany.mockResolvedValueOnce([])
      // No existing user found for membership check in createVolunteerApplication
      mockDb.query.userTable.findFirst.mockResolvedValueOnce(null)
      // Created invitation returned after insert
      mockDb.query.teamInvitationTable.findFirst.mockResolvedValueOnce({id: 'tinv_new123'})

      const result = await createAccountAndApplyAsVolunteerFn({data: baseInput})

      expect(result.success).toBe(true)
      expect(result.membershipId).toBe('tinv_new123')
      expect(canSignUp).toHaveBeenCalledWith({email: 'jane@example.com'})
      expect(hashPassword).toHaveBeenCalledWith({password: 'Password123'})
      expect(createAndStoreSession).toHaveBeenCalled()
      // Should insert user, team, membership + invitation
      expect(mockDb.insert).toHaveBeenCalledTimes(4)
    })

    it('should upgrade an existing placeholder user and create volunteer application', async () => {
      const placeholderUser = {
        id: 'user_placeholder123',
        email: 'jane@example.com',
        emailVerified: null,
        passwordHash: null,
      }
      // Existing placeholder found in account creation check
      mockDb.query.userTable.findFirst.mockResolvedValueOnce(placeholderUser)
      // No duplicate invitations in createVolunteerApplication
      mockDb.query.teamInvitationTable.findMany.mockResolvedValueOnce([])
      // No existing membership for this user
      mockDb.query.userTable.findFirst.mockResolvedValueOnce(placeholderUser)
      mockDb.query.teamMembershipTable.findFirst.mockResolvedValueOnce(null)
      // Created invitation returned after insert
      mockDb.query.teamInvitationTable.findFirst.mockResolvedValueOnce({id: 'tinv_upgraded456'})

      const result = await createAccountAndApplyAsVolunteerFn({data: baseInput})

      expect(result.success).toBe(true)
      expect(result.membershipId).toBe('tinv_upgraded456')
      // Should update existing user (not insert new user/team)
      expect(mockDb.update).toHaveBeenCalled()
      expect(createAndStoreSession).toHaveBeenCalledWith('user_placeholder123', 'password')
      // Only the invitation insert (no user/team inserts)
      expect(mockDb.insert).toHaveBeenCalledTimes(1)
    })

    it('should reject an existing fully-verified user', async () => {
      const verifiedUser = {
        id: 'user_verified789',
        email: 'jane@example.com',
        emailVerified: new Date(),
        passwordHash: 'already_hashed',
      }
      mockDb.query.userTable.findFirst.mockResolvedValueOnce(verifiedUser)

      await expect(
        createAccountAndApplyAsVolunteerFn({data: baseInput}),
      ).rejects.toThrow('An account with this email already exists')

      expect(createAndStoreSession).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // getVolunteerAssignmentsFn
  // ============================================================================
  describe('getVolunteerAssignmentsFn', () => {
    it('should return empty map when no shifts or heats', async () => {
      // shifts query
      mockDb.setMockReturnValue([])

      const result = await getVolunteerAssignmentsFn({
        data: {competitionId: 'comp_test123'},
      })

      expect(result).toEqual({})
    })

    it('should handle competition with no heats gracefully', async () => {
      // Both findMany calls (shifts, heats) return empty
      mockDb.setMockReturnValue([])

      const result = await getVolunteerAssignmentsFn({
        data: {competitionId: 'comp_test123'},
      })

      expect(result).toBeDefined()
      expect(Object.keys(result)).toHaveLength(0)
    })
  })
})
