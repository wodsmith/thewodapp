import {describe, expect, it} from 'vitest'
import type {SessionValidationResult} from '@/types'
import {computeOrganizerEntitlements} from '@/utils/organizer-entitlements'

type ValidatedSession = NonNullable<SessionValidationResult>
type SessionTeam = NonNullable<ValidatedSession['teams']>[number]

function makeTeam(overrides: Partial<SessionTeam> = {}): SessionTeam {
  return {
    id: 'team-1',
    name: 'Team 1',
    slug: 'team-1',
    type: 'gym',
    isPersonalTeam: false,
    role: {id: 'admin', name: 'admin', isSystemRole: true},
    permissions: [],
    plan: {
      id: 'plan-pending',
      name: 'Pending',
      features: [],
      limits: {},
    },
    ...overrides,
  }
}

function makeSession(
  teams: SessionTeam[] | undefined,
): SessionValidationResult {
  // Cast — we only exercise team-related fields in this helper.
  return {teams} as unknown as SessionValidationResult
}

describe('computeOrganizerEntitlements', () => {
  describe('no entitlement', () => {
    it('returns no entitlement when session is null', () => {
      const result = computeOrganizerEntitlements(null, null)

      expect(result).toEqual({
        hasHostCompetitions: false,
        isPendingApproval: false,
        isApproved: false,
        activeOrganizingTeamId: null,
      })
    })

    it('returns no entitlement when session has no teams', () => {
      const session = makeSession([])

      const result = computeOrganizerEntitlements(session, null)

      expect(result.hasHostCompetitions).toBe(false)
      expect(result.activeOrganizingTeamId).toBe(null)
    })

    it('returns no entitlement when teams is undefined', () => {
      const session = makeSession(undefined)

      const result = computeOrganizerEntitlements(session, null)

      expect(result.hasHostCompetitions).toBe(false)
    })

    it('returns no entitlement when no team has host_competitions feature', () => {
      const session = makeSession([
        makeTeam({
          id: 'team-a',
          plan: {id: 'p', name: 'P', features: ['other_feature'], limits: {}},
        }),
        makeTeam({
          id: 'team-b',
          plan: {id: 'p', name: 'P', features: [], limits: {}},
        }),
      ])

      const result = computeOrganizerEntitlements(session, 'team-a')

      expect(result.hasHostCompetitions).toBe(false)
      expect(result.activeOrganizingTeamId).toBe(null)
    })
  })

  describe('active team selection', () => {
    it('uses the cookie team when it has host_competitions', () => {
      const session = makeSession([
        makeTeam({
          id: 'team-a',
          plan: {
            id: 'p',
            name: 'P',
            features: ['host_competitions'],
            limits: {max_published_competitions: -1},
          },
        }),
        makeTeam({
          id: 'team-b',
          plan: {
            id: 'p',
            name: 'P',
            features: ['host_competitions'],
            limits: {max_published_competitions: -1},
          },
        }),
      ])

      const result = computeOrganizerEntitlements(session, 'team-b')

      expect(result.activeOrganizingTeamId).toBe('team-b')
    })

    it('falls back to the first hosting team when cookie team lacks host_competitions', () => {
      const session = makeSession([
        makeTeam({
          id: 'team-non-hosting',
          plan: {id: 'p', name: 'P', features: [], limits: {}},
        }),
        makeTeam({
          id: 'team-hosting',
          plan: {
            id: 'p',
            name: 'P',
            features: ['host_competitions'],
            limits: {max_published_competitions: -1},
          },
        }),
      ])

      const result = computeOrganizerEntitlements(session, 'team-non-hosting')

      expect(result.activeOrganizingTeamId).toBe('team-hosting')
    })

    it('falls back to the first hosting team when cookie is null', () => {
      const session = makeSession([
        makeTeam({
          id: 'team-hosting-1',
          plan: {
            id: 'p',
            name: 'P',
            features: ['host_competitions'],
            limits: {max_published_competitions: -1},
          },
        }),
        makeTeam({
          id: 'team-hosting-2',
          plan: {
            id: 'p',
            name: 'P',
            features: ['host_competitions'],
            limits: {max_published_competitions: -1},
          },
        }),
      ])

      const result = computeOrganizerEntitlements(session, null)

      expect(result.activeOrganizingTeamId).toBe('team-hosting-1')
    })

    it('falls back to the first hosting team when cookie points to an unknown team', () => {
      const session = makeSession([
        makeTeam({
          id: 'team-hosting',
          plan: {
            id: 'p',
            name: 'P',
            features: ['host_competitions'],
            limits: {max_published_competitions: -1},
          },
        }),
      ])

      const result = computeOrganizerEntitlements(session, 'stale-cookie-team')

      expect(result.activeOrganizingTeamId).toBe('team-hosting')
    })
  })

  describe('approval states', () => {
    function sessionWithLimit(
      limit: number | undefined,
    ): SessionValidationResult {
      return makeSession([
        makeTeam({
          id: 'team-hosting',
          plan: {
            id: 'p',
            name: 'P',
            features: ['host_competitions'],
            limits:
              limit === undefined ? {} : {max_published_competitions: limit},
          },
        }),
      ])
    }

    it('treats limit=0 as pending approval', () => {
      const result = computeOrganizerEntitlements(sessionWithLimit(0), null)

      expect(result.hasHostCompetitions).toBe(true)
      expect(result.isPendingApproval).toBe(true)
      expect(result.isApproved).toBe(false)
    })

    it('treats missing limit as pending approval (defaults to 0)', () => {
      const result = computeOrganizerEntitlements(
        sessionWithLimit(undefined),
        null,
      )

      expect(result.isPendingApproval).toBe(true)
      expect(result.isApproved).toBe(false)
    })

    it('treats limit=-1 as approved (unlimited)', () => {
      const result = computeOrganizerEntitlements(sessionWithLimit(-1), null)

      expect(result.isPendingApproval).toBe(false)
      expect(result.isApproved).toBe(true)
    })

    it('treats positive limit as approved', () => {
      const result = computeOrganizerEntitlements(sessionWithLimit(5), null)

      expect(result.isPendingApproval).toBe(false)
      expect(result.isApproved).toBe(true)
    })
  })

  describe('limit lookup uses the active team, not the first team', () => {
    it('reads limit from the cookie-selected team when both teams host', () => {
      const session = makeSession([
        makeTeam({
          id: 'team-pending',
          plan: {
            id: 'p',
            name: 'P',
            features: ['host_competitions'],
            limits: {max_published_competitions: 0},
          },
        }),
        makeTeam({
          id: 'team-approved',
          plan: {
            id: 'p',
            name: 'P',
            features: ['host_competitions'],
            limits: {max_published_competitions: -1},
          },
        }),
      ])

      const pickPending = computeOrganizerEntitlements(session, 'team-pending')
      const pickApproved = computeOrganizerEntitlements(
        session,
        'team-approved',
      )

      expect(pickPending.activeOrganizingTeamId).toBe('team-pending')
      expect(pickPending.isPendingApproval).toBe(true)
      expect(pickPending.isApproved).toBe(false)

      expect(pickApproved.activeOrganizingTeamId).toBe('team-approved')
      expect(pickApproved.isPendingApproval).toBe(false)
      expect(pickApproved.isApproved).toBe(true)
    })
  })
})
