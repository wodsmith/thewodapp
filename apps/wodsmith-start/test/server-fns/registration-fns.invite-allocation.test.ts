import { FakeDrizzleDb } from "@repo/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Integration test for the payment-init allocation guardrail added in
 * `initiateRegistrationPaymentFn`. Pinned to the over-issue race scenario
 * the business actually expects: organizers send more invites than
 * allocated spots for a (sourceId, championshipDivisionId) bucket, two
 * invitees click "Pay" within the 30-min Stripe-session window, and only
 * one should be permitted to reach Stripe Checkout.
 *
 * The pure layer (`assertInviteWithinAllocation`,
 * `extractInviteIdsFromPurchaseMetadata`) is covered by
 * `identity-allocation.test.ts`. This file exercises the **wiring** —
 * does `initiateRegistrationPaymentFn` actually call the bucket-usage
 * helper for invite-backed registrations, and does it bail out before
 * reaching Stripe when the bucket is full?
 */
// @lat: [[competition-invites#Claim allocation guardrail]]

const mockDb = new FakeDrizzleDb()

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}))

vi.mock("@/lib/logging", () => ({
  logInfo: vi.fn(),
  logWarning: vi.fn(),
  logEntityCreated: vi.fn(),
  addRequestContextAttribute: vi.fn(),
  updateRequestContext: vi.fn(),
}))

const mockRegisterForCompetition = vi.fn()
const mockNotifyRegistrationConfirmed = vi.fn()
vi.mock("@/lib/registration-stubs", () => ({
  registerForCompetition: (...args: unknown[]) =>
    mockRegisterForCompetition(...args),
  notifyRegistrationConfirmed: (...args: unknown[]) =>
    mockNotifyRegistrationConfirmed(...args),
}))

const mockGetRegistrationFee = vi.fn()
const mockBuildFeeConfig = vi.fn()
const mockCalculateCompetitionFees = vi.fn()
vi.mock("@/lib/commerce-stubs", () => ({
  getRegistrationFee: (...args: unknown[]) => mockGetRegistrationFee(...args),
  buildFeeConfig: (...args: unknown[]) => mockBuildFeeConfig(...args),
  calculateCompetitionFees: (...args: unknown[]) =>
    mockCalculateCompetitionFees(...args),
}))

vi.mock("@/lib/env", () => ({
  getAppUrl: vi.fn(() => "https://test.wodsmith.com"),
}))

const mockStripeCheckoutCreate = vi.fn()
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockStripeCheckoutCreate(...args),
      },
    },
  })),
}))

const mockGetDivisionSpotsAvailableFn = vi.fn()
const mockGetCompetitionSpotsAvailableFn = vi.fn()
vi.mock("@/server-fns/competition-divisions-fns", () => ({
  getDivisionSpotsAvailableFn: (...args: unknown[]) =>
    mockGetDivisionSpotsAvailableFn(...args),
  getCompetitionSpotsAvailableFn: (...args: unknown[]) =>
    mockGetCompetitionSpotsAvailableFn(...args),
  PENDING_PURCHASE_MAX_AGE_MINUTES: 35,
}))

vi.mock("@/utils/timezone-utils", () => ({
  DEFAULT_TIMEZONE: "America/Denver",
  hasDateStartedInTimezone: vi.fn(() => true),
  isDeadlinePassedInTimezone: vi.fn(() => false),
}))

const inviteRow: {
  id: string
  championshipCompetitionId: string
  championshipDivisionId: string
  sourceId: string | null
  email: string
  status: string
  claimToken: string
  expiresAt: Date
  activeMarker: string
} = {
  id: "cinv_alpha",
  championshipCompetitionId: "comp-456",
  championshipDivisionId: "div-rx",
  sourceId: "cisrc_qual",
  email: "alpha@example.com",
  status: "pending",
  claimToken: "tok_alpha",
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  activeMarker: "active",
}

const mockResolveInviteForClaim = vi.fn()
const mockFindActiveInviteForEmail = vi.fn()
const mockAssertInviteClaimable = vi.fn()
const mockGetBucketUsageWithHolds = vi.fn()
const mockResolveAllocationForInvite = vi.fn()

vi.mock("@/server/competition-invites/claim", () => ({
  resolveInviteForClaim: (...args: Parameters<typeof mockResolveInviteForClaim>) =>
    mockResolveInviteForClaim(...args),
  findActiveInviteForEmail: (
    ...args: Parameters<typeof mockFindActiveInviteForEmail>
  ) => mockFindActiveInviteForEmail(...args),
  assertInviteClaimable: (
    ...args: Parameters<typeof mockAssertInviteClaimable>
  ) => mockAssertInviteClaimable(...args),
  getBucketUsageWithHolds: (
    ...args: Parameters<typeof mockGetBucketUsageWithHolds>
  ) => mockGetBucketUsageWithHolds(...args),
  resolveAllocationForInvite: (
    ...args: Parameters<typeof mockResolveAllocationForInvite>
  ) => mockResolveAllocationForInvite(...args),
}))

vi.mock("@/server/competition-invites/identity", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/competition-invites/identity")
  >("@/server/competition-invites/identity")
  return actual
})

vi.mock("@/server/competition-invites/issue", () => ({
  normalizeInviteEmail: (email: string) => email.trim().toLowerCase(),
}))

vi.mock("@/server/coupons", () => ({
  validateCoupon: vi.fn(),
  recordRedemption: vi.fn(),
}))

const inviteUserSession = {
  userId: "usr_alpha",
  user: {
    id: "usr_alpha",
    email: "alpha@example.com",
  },
  teams: [],
}

vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: vi.fn(() => Promise.resolve(inviteUserSession)),
  requireVerifiedEmail: vi.fn(() => Promise.resolve(inviteUserSession)),
}))

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    handler: (fn: unknown) => fn,
    inputValidator: () => ({
      handler: (fn: unknown) => fn,
    }),
  }),
  createServerOnlyFn: (fn: unknown) => fn,
}))

vi.mock("cloudflare:workers", () => ({
  env: {
    APP_URL: "https://test.wodsmith.com",
  },
}))

import { initiateRegistrationPaymentFn } from "@/server-fns/registration-fns"

const initiatePayment = initiateRegistrationPaymentFn as unknown as (args: {
  data: {
    competitionId: string
    items: Array<{ divisionId: string }>
    inviteToken?: string
  }
}) => Promise<{
  purchaseId: string | null
  checkoutUrl: string | null
  totalCents: number
  isFree: boolean
}>

const mockCompetition = {
  id: "comp-456",
  name: "Championship Test",
  slug: "championship-test",
  organizingTeamId: "org-team-1",
  registrationOpensAt: "2025-01-01",
  registrationClosesAt: "2025-12-31",
  timezone: "America/Denver",
  defaultRegistrationFeeCents: 5000,
  defaultMaxSpotsPerDivision: null,
}

function setupMocks() {
  mockDb.reset()
  mockDb.query.competitionsTable = {
    findFirst: vi.fn().mockResolvedValue(mockCompetition),
    findMany: vi.fn().mockResolvedValue([]),
  }
  mockDb.query.competitionRegistrationsTable = {
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  }
  mockDb.query.competitionInvitesTable = {
    findFirst: vi.fn().mockResolvedValue(inviteRow),
    findMany: vi.fn().mockResolvedValue([]),
  }
  mockDb.query.scalingLevelsTable = {
    findFirst: vi.fn().mockResolvedValue({ id: "div-rx", label: "Rx" }),
    findMany: vi.fn().mockResolvedValue([]),
  }
  mockDb.query.competitionRegistrationQuestionsTable = {
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  }
  mockDb.query.teamTable = {
    findFirst: vi.fn().mockResolvedValue({
      id: "org-team-1",
      stripeAccountStatus: "VERIFIED",
      stripeConnectedAccountId: "acct_test",
      organizerFeePercentage: null,
      organizerFeeFixed: null,
    }),
    findMany: vi.fn().mockResolvedValue([]),
  }
  mockDb.query.commerceProductTable = {
    findFirst: vi.fn().mockResolvedValue({ id: "prod-1" }),
    findMany: vi.fn().mockResolvedValue([]),
  }
  mockDb.setMockReturnValue([])

  mockGetDivisionSpotsAvailableFn.mockResolvedValue({
    isFull: false,
    available: 50,
  })
  mockGetCompetitionSpotsAvailableFn.mockResolvedValue({
    isFull: false,
    available: null,
  })
  mockResolveInviteForClaim.mockResolvedValue({ invite: inviteRow })
  mockAssertInviteClaimable.mockReturnValue(undefined)
  mockResolveAllocationForInvite.mockResolvedValue(1)

  mockGetRegistrationFee.mockResolvedValue(5000)
  mockBuildFeeConfig.mockReturnValue({
    platformPercentageBasisPoints: 400,
    platformFixedCents: 200,
    stripePercentageBasisPoints: 290,
    stripeFixedCents: 30,
    passPlatformFeesToCustomer: true,
    passStripeFeesToCustomer: false,
  })
  mockCalculateCompetitionFees.mockReturnValue({
    registrationFeeCents: 5000,
    platformFeeCents: 400,
    stripeFeeCents: 175,
    totalChargeCents: 5400,
    organizerNetCents: 4825,
    stripeFeesPassedToCustomer: false,
    platformFeesPassedToCustomer: true,
  })
  mockStripeCheckoutCreate.mockResolvedValue({
    id: "cs_test",
    url: "https://checkout.stripe.com/cs_test",
  })
}

describe("initiateRegistrationPaymentFn — invite allocation hold", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it("blocks the second invitee when the source bucket is full of in-flight holds", async () => {
    // Allocation = 1 spot, accepted_paid = 0, but another invitee has an
    // in-flight Stripe session — bucket is full of holds.
    mockGetBucketUsageWithHolds.mockResolvedValue({
      acceptedCount: 0,
      pendingCount: 1,
      total: 1,
    })

    await expect(
      initiatePayment({
        data: {
          competitionId: "comp-456",
          items: [{ divisionId: "div-rx" }],
          inviteToken: "tok_alpha",
        },
      }),
    ).rejects.toThrow(/Spots from this qualifier are no longer available/)

    // Stripe must NOT have been touched — the gate fires before checkout
    // session creation.
    expect(mockStripeCheckoutCreate).not.toHaveBeenCalled()

    // The probe must exclude the current invite so a refresh of the same
    // invitee's payment page doesn't count itself out.
    expect(mockGetBucketUsageWithHolds).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: "cisrc_qual",
        championshipDivisionId: "div-rx",
        championshipCompetitionId: "comp-456",
        excludeInviteId: "cinv_alpha",
      }),
    )
  })

  it("permits checkout when the bucket has open spots", async () => {
    mockGetBucketUsageWithHolds.mockResolvedValue({
      acceptedCount: 0,
      pendingCount: 0,
      total: 0,
    })
    mockResolveAllocationForInvite.mockResolvedValue(1)

    const result = await initiatePayment({
      data: {
        competitionId: "comp-456",
        items: [{ divisionId: "div-rx" }],
        inviteToken: "tok_alpha",
      },
    })

    expect(result.checkoutUrl).toBe("https://checkout.stripe.com/cs_test")
    expect(mockStripeCheckoutCreate).toHaveBeenCalledTimes(1)
  })

  it("permits checkout for a bespoke invite (sourceId is null) regardless of bucket usage", async () => {
    const bespoke = { ...inviteRow, sourceId: null }
    mockResolveInviteForClaim.mockResolvedValue({ invite: bespoke })
    mockDb.query.competitionInvitesTable = {
      findFirst: vi.fn().mockResolvedValue(bespoke),
      findMany: vi.fn().mockResolvedValue([]),
    }

    const result = await initiatePayment({
      data: {
        competitionId: "comp-456",
        items: [{ divisionId: "div-rx" }],
        inviteToken: "tok_alpha",
      },
    })

    expect(result.checkoutUrl).toBe("https://checkout.stripe.com/cs_test")
    // Bespoke invites bypass — the bucket-usage probe must not be called
    // because there's no source bucket to gate.
    expect(mockGetBucketUsageWithHolds).not.toHaveBeenCalled()
  })

  it("treats allocation=0 as no-cap and admits the invite", async () => {
    // Organizer hasn't allocated this division to this source. Per
    // ADR-0012, an invite issued anyway falls back to "no cap" rather
    // than being blocked.
    mockResolveAllocationForInvite.mockResolvedValue(0)
    mockGetBucketUsageWithHolds.mockResolvedValue({
      acceptedCount: 5,
      pendingCount: 3,
      total: 8,
    })

    const result = await initiatePayment({
      data: {
        competitionId: "comp-456",
        items: [{ divisionId: "div-rx" }],
        inviteToken: "tok_alpha",
      },
    })

    expect(result.checkoutUrl).toBe("https://checkout.stripe.com/cs_test")
  })
})
