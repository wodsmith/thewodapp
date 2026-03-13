/**
 * Integration test: Competition Overview page
 *
 * Tests the full route rendering of /compete/$slug using TanStack Router
 * with createMemoryHistory. Server functions are mocked at module boundaries;
 * routing, loaders, and component rendering are exercised for real.
 */
import {screen, waitFor} from '@testing-library/react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import './helpers/setup'

// ============================================================================
// Module mocks — vi.mock calls are hoisted above all imports
// ============================================================================

// --- Framework: make createServerFn / createServerOnlyFn return stubs ---
// Uses plain async functions (not vi.fn) so mockReset/restoreMocks won't clear them.
// Inline server functions defined in route files will resolve to {} by default.
vi.mock('@tanstack/react-start', () => {
  const createChainable = (): Record<string, unknown> => {
    // Plain async fn that survives vitest mockReset
    const fn: Record<string, unknown> = Object.assign(
      async () => ({}),
      {
        inputValidator: () => createChainable(),
        handler: () => createChainable(),
        middleware: () => createChainable(),
        validator: () => createChainable(),
      },
    )
    return fn
  }
  return {
    useServerFn: (fn: unknown) => fn,
    createServerFn: () => createChainable(),
    createServerOnlyFn: (fn: (...args: unknown[]) => unknown) => fn,
    createMiddleware: () => ({
      server: () => ({
        client: () => async () => ({}),
      }),
    }),
  }
})

// --- UI deps that need mocking in jsdom ---
vi.mock('@/lib/posthog/provider', () => ({
  PostHogProvider: ({children}: {children: React.ReactNode}) => children,
}))
vi.mock('@/lib/posthog/utils', () => ({
  captureException: vi.fn(),
}))
vi.mock('@/lib/posthog', () => ({
  trackEvent: vi.fn(),
  captureException: vi.fn(),
}))
vi.mock('@/lib/sentry/client', () => ({
  initSentry: vi.fn(),
}))
vi.mock('@tanstack/react-devtools', () => ({
  TanStackDevtools: () => null,
}))
vi.mock('@tanstack/react-router-devtools', () => ({
  TanStackRouterDevtoolsPanel: () => null,
}))
// DarkModeToggle uses window.matchMedia which isn't available in jsdom
vi.mock('@/components/nav/dark-mode-toggle', () => ({
  DarkModeToggle: () => null,
}))

// --- Root route server fns ---
vi.mock('@/server-fns/middleware/auth', () => ({
  getOptionalSession: vi.fn().mockResolvedValue(null),
  requireSession: vi.fn(),
}))
vi.mock('@/server-fns/session-fns', () => ({
  getThemeCookieFn: vi.fn().mockResolvedValue('light'),
  getActiveTeamIdFn: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/server-fns/entitlements', () => ({
  checkWorkoutTrackingAccess: vi.fn().mockResolvedValue(false),
}))

// --- /compete layout server fns ---
vi.mock('@/utils/auth', () => ({
  getSessionFromCookie: vi.fn().mockResolvedValue(null),
}))

// --- /compete/$slug server fns ---
vi.mock('@/server-fns/competition-fns', () => ({
  getCompetitionBySlugFn: vi.fn(),
}))
vi.mock('@/server-fns/competition-divisions-fns', () => ({
  getPublicCompetitionDivisionsFn: vi.fn(),
  parseCompetitionSettings: vi.fn(),
}))
vi.mock('@/server-fns/sponsor-fns', () => ({
  getCompetitionSponsorsFn: vi.fn(),
}))
vi.mock('@/server-fns/team-fns', () => ({
  getTeamContactEmailFn: vi.fn(),
}))
vi.mock('@/server-fns/competition-detail-fns', () => ({
  getUserCompetitionRegistrationsFn: vi.fn(),
  getUserCompetitionRegistrationFn: vi.fn(),
}))
vi.mock('@/lib/env', () => ({
  getAppUrlFn: vi.fn().mockResolvedValue('http://localhost:3000'),
}))
vi.mock('@/server-fns/coupon-fns', () => ({
  getCouponByCodeFn: vi.fn().mockResolvedValue(null),
}))

// --- /compete/$slug/ (index) server fns ---
vi.mock('@/server-fns/competition-heats-fns', () => ({
  getPublicScheduleDataFn: vi.fn(),
}))
vi.mock('@/server-fns/competition-workouts-fns', () => ({
  getPublishedCompetitionWorkoutsWithDetailsFn: vi.fn(),
  getBatchWorkoutDivisionDescriptionsFn: vi.fn(),
}))
vi.mock('@/server-fns/video-submission-fns', () => ({
  getBatchSubmissionStatusFn: vi.fn(),
}))

// --- Registration route server fns (imported as part of route tree) ---
vi.mock('@/server-fns/registration-fns', () => ({
  cancelPendingPurchaseFn: vi.fn(),
}))
vi.mock('@/server-fns/registration-questions-fns', () => ({
  getCompetitionQuestionsFn: vi.fn(),
  QUESTION_TYPES: ['text', 'select', 'number'] as const,
}))
vi.mock('@/server-fns/waiver-fns', () => ({
  getCompetitionWaiversFn: vi.fn(),
}))

// --- Registration success route server fns ---
vi.mock('@/server-fns/athlete-profile-fns', () => ({
  getRegistrationSuccessDataFn: vi.fn(),
  updateAthleteBasicProfileFn: vi.fn(),
}))

// --- Coupon utilities ---
vi.mock('@/utils/coupon-cookie', () => ({
  setCouponSession: vi.fn(),
  clearCouponSession: vi.fn(),
  getCouponSession: vi.fn().mockReturnValue(null),
  onCouponChange: vi.fn().mockReturnValue(() => {}),
}))

// ============================================================================
// Imports (after mocks are hoisted)
// ============================================================================

import {getOptionalSession} from '@/server-fns/middleware/auth'
import {getThemeCookieFn, getActiveTeamIdFn} from '@/server-fns/session-fns'
import {checkWorkoutTrackingAccess} from '@/server-fns/entitlements'
import {getCompetitionBySlugFn} from '@/server-fns/competition-fns'
import {getPublicCompetitionDivisionsFn} from '@/server-fns/competition-divisions-fns'
import {getCompetitionSponsorsFn} from '@/server-fns/sponsor-fns'
import {getTeamContactEmailFn} from '@/server-fns/team-fns'
import {getUserCompetitionRegistrationsFn} from '@/server-fns/competition-detail-fns'
import {getPublicScheduleDataFn} from '@/server-fns/competition-heats-fns'
import {getPublishedCompetitionWorkoutsWithDetailsFn} from '@/server-fns/competition-workouts-fns'
import {getCompetitionQuestionsFn} from '@/server-fns/registration-questions-fns'
import {getCompetitionWaiversFn} from '@/server-fns/waiver-fns'
import {getAppUrlFn} from '@/lib/env'
import {renderWithRouter} from './helpers/render-with-router'

// ============================================================================
// Test data
// ============================================================================

const mockCompetition = {
  id: 'comp-1',
  name: 'Spring Throwdown 2026',
  slug: 'spring-throwdown',
  description: 'A test competition for integration testing',
  competitionType: 'in_person' as const,
  bannerImageUrl: null,
  profileImageUrl: null,
  registrationOpensAt: '2026-01-01',
  registrationClosesAt: '2026-12-31',
  timezone: 'America/Denver',
  organizingTeamId: 'team-1',
  organizingTeam: {id: 'team-1', name: 'Test Gym', avatarUrl: null},
  competitionTeamId: null,
  address: null,
  settings: null,
  passStripeFeesToCustomer: false,
  startDate: '2026-06-01',
  endDate: '2026-06-02',
  publishedAt: '2026-01-01',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

const mockDivisions = [
  {
    id: 'div-1',
    label: 'RX',
    description: null,
    registrationCount: 5,
    feeCents: 0,
    teamSize: 1,
    maxSpots: null,
    spotsAvailable: null,
  },
  {
    id: 'div-2',
    label: 'Scaled',
    description: null,
    registrationCount: 3,
    feeCents: 0,
    teamSize: 1,
    maxSpots: null,
    spotsAvailable: null,
  },
]

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  // Root route server fns (must be reset each test because mockReset clears them)
  vi.mocked(getOptionalSession).mockResolvedValue(null as never)
  vi.mocked(getThemeCookieFn).mockResolvedValue('light' as never)
  vi.mocked(getActiveTeamIdFn).mockResolvedValue(null as never)
  vi.mocked(checkWorkoutTrackingAccess).mockResolvedValue(false as never)

  // Env utility
  vi.mocked(getAppUrlFn).mockResolvedValue('http://localhost:3000' as never)

  // Configure server function return values for the /compete/$slug route
  vi.mocked(getCompetitionBySlugFn).mockResolvedValue({
    competition: mockCompetition,
  } as never)

  vi.mocked(getPublicCompetitionDivisionsFn).mockResolvedValue({
    divisions: mockDivisions,
  } as never)

  vi.mocked(getCompetitionSponsorsFn).mockResolvedValue({
    groups: [],
    ungroupedSponsors: [],
  } as never)

  vi.mocked(getTeamContactEmailFn).mockResolvedValue(null as never)

  vi.mocked(getUserCompetitionRegistrationsFn).mockResolvedValue({
    registrations: [],
  } as never)

  // Index route loaders
  vi.mocked(getPublicScheduleDataFn).mockResolvedValue({
    events: [],
  } as never)

  vi.mocked(getPublishedCompetitionWorkoutsWithDetailsFn).mockResolvedValue({
    workouts: [],
  } as never)

  // Registration route server fns (needed when route tree loads register route)
  vi.mocked(getCompetitionQuestionsFn).mockResolvedValue({
    questions: [],
  } as never)
  vi.mocked(getCompetitionWaiversFn).mockResolvedValue({
    waivers: [],
  } as never)
})

// ============================================================================
// Tests
// ============================================================================

describe('Competition Overview - Integration', () => {
  it('renders competition name when navigating to /compete/$slug', async () => {
    await renderWithRouter({initialUrl: '/compete/spring-throwdown'})

    await waitFor(
      () => {
        const elements = screen.getAllByText('Spring Throwdown 2026')
        expect(elements.length).toBeGreaterThan(0)
      },
      {timeout: 10000},
    )
  })

  it('renders competition tabs for navigation', async () => {
    await renderWithRouter({initialUrl: '/compete/spring-throwdown'})

    await waitFor(
      () => {
        expect(screen.getAllByText('Spring Throwdown 2026').length).toBeGreaterThan(0)
      },
      {timeout: 10000},
    )

    // CompetitionTabs renders these tab labels (may appear multiple times in responsive views)
    expect(screen.getAllByText('Event Details').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Workouts').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Schedule').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Leaderboard').length).toBeGreaterThan(0)
  })

  it('renders registration sidebar with register link', async () => {
    await renderWithRouter({initialUrl: '/compete/spring-throwdown'})

    await waitFor(
      () => {
        expect(screen.getAllByText('Spring Throwdown 2026').length).toBeGreaterThan(0)
      },
      {timeout: 10000},
    )

    // RegistrationSidebar should show a Register Now link when not registered
    const registerLink = await screen.findByRole('link', {
      name: /register/i,
    })
    expect(registerLink).toBeInTheDocument()
  })

  it('calls server functions with correct parameters', async () => {
    await renderWithRouter({initialUrl: '/compete/spring-throwdown'})

    await waitFor(
      () => {
        expect(screen.getAllByText('Spring Throwdown 2026').length).toBeGreaterThan(0)
      },
      {timeout: 10000},
    )

    // Verify the competition was fetched by slug
    expect(getCompetitionBySlugFn).toHaveBeenCalledWith({
      data: {slug: 'spring-throwdown'},
    })

    // Verify divisions were fetched for this competition
    expect(getPublicCompetitionDivisionsFn).toHaveBeenCalledWith({
      data: {competitionId: 'comp-1'},
    })
  })

  it('shows division information when divisions exist', async () => {
    await renderWithRouter({initialUrl: '/compete/spring-throwdown'})

    await waitFor(
      () => {
        expect(screen.getAllByText('Spring Throwdown 2026').length).toBeGreaterThan(0)
      },
      {timeout: 10000},
    )

    // Divisions should be shown somewhere on the page (in EventDetailsContent)
    await waitFor(() => {
      expect(screen.getByText('RX')).toBeInTheDocument()
    })
  })
})

// ============================================================================
// Competition Registration Flow - Integration Tests
// ============================================================================

const mockSession = {
  id: 'session-1',
  userId: 'user-1',
  expiresAt: Date.now() + 86400000,
  createdAt: Date.now(),
  user: {
    id: 'user-1',
    email: 'athlete@test.com',
    firstName: 'Test',
    lastName: 'Athlete',
    role: 'user',
    avatarUrl: null,
    initials: 'TA',
  },
  teams: [],
}

describe('Competition Registration Flow - Integration', () => {
  it('shows register link pointing to the registration page', async () => {
    await renderWithRouter({initialUrl: '/compete/spring-throwdown'})

    await waitFor(
      () => {
        expect(
          screen.getAllByText('Spring Throwdown 2026').length,
        ).toBeGreaterThan(0)
      },
      {timeout: 10000},
    )

    // Registration sidebar should have a link to the register page
    const registerLinks = screen.getAllByRole('link', {name: /register/i})
    expect(registerLinks.length).toBeGreaterThan(0)
    expect(registerLinks[0]).toHaveAttribute(
      'href',
      '/compete/spring-throwdown/register',
    )
  })

  it('renders registration page for authenticated user', async () => {
    vi.mocked(getOptionalSession).mockResolvedValue(mockSession as never)

    await renderWithRouter({
      initialUrl: '/compete/spring-throwdown/register',
    })

    // Wait for the page to render (competition name in breadcrumbs/hero)
    await waitFor(
      () => {
        expect(
          screen.getAllByText('Spring Throwdown 2026').length,
        ).toBeGreaterThan(0)
      },
      {timeout: 10000},
    )

    // Since parseCompetitionSettings returns undefined (no divisions configured),
    // the registration page shows "Registration Not Available"
    await waitFor(() => {
      expect(
        screen.getByText(/registration not available/i),
      ).toBeInTheDocument()
    })
  })
})
