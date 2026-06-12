import { FakeDrizzleDb } from "@repo/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock database
const mockDb = new FakeDrizzleDb()
vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}))

// Mock logging
vi.mock("@/lib/logging", () => ({
  logInfo: vi.fn(),
  logWarning: vi.fn(),
}))

// Mock entitlements — the feature gate under test
const mockHasFeature = vi.fn()
vi.mock("@/server/entitlements", () => ({
  hasFeature: (...args: unknown[]) => mockHasFeature(...args),
}))

// Mock auth
const mockRequireVerifiedEmail = vi.fn()
vi.mock("@/utils/auth", () => ({
  requireVerifiedEmail: () => mockRequireVerifiedEmail(),
}))

// Mock TanStack createServerFn
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    handler: (fn: unknown) => fn,
    inputValidator: () => ({
      handler: (fn: unknown) => fn,
    }),
  }),
  createServerOnlyFn: (fn: unknown) => fn,
}))

// Mock cloudflare:workers
vi.mock("cloudflare:workers", () => ({
  env: { APP_URL: "https://test.wodsmith.com" },
}))

import {
  createCompetitionAddonFn,
  getPublicCompetitionAddonsFn,
  listCompetitionAddonsFn,
  updateCompetitionAddonFn,
} from "@/server-fns/competition-addon-fns"

type AnyFn = (args: { data: unknown }) => Promise<any>
const createAddon = createCompetitionAddonFn as unknown as AnyFn
const updateAddon = updateCompetitionAddonFn as unknown as AnyFn
const listAddons = listCompetitionAddonsFn as unknown as AnyFn
const getPublicAddons = getPublicCompetitionAddonsFn as unknown as AnyFn

const adminSession = {
  userId: "user-admin",
  user: { id: "user-admin", email: "admin@test.com" },
  teams: [{ id: "team-1", role: { id: "admin" } }],
}

const memberSession = {
  userId: "user-member",
  user: { id: "user-member", email: "member@test.com" },
  teams: [{ id: "team-1", role: { id: "member" } }],
}

const competition = {
  id: "comp-1",
  organizingTeamId: "team-1",
  timezone: "America/Denver",
  platformFeePercentage: null,
  platformFeeFixed: null,
  passStripeFeesToCustomer: false,
  passPlatformFeesToCustomer: true,
}

const activeProduct = {
  id: "cmpprod-1",
  competitionId: "comp-1",
  name: "Event Tee",
  description: null,
  imageUrl: null,
  priceCents: 2500,
  maxPerAthlete: 2,
  availableUntil: null,
  status: "ACTIVE",
  sortOrder: 0,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

function registerTables() {
  mockDb.registerTable("competitionsTable")
  mockDb.registerTable("competitionProductsTable")
  mockDb.registerTable("competitionProductVariantsTable")
  mockDb.registerTable("teamTable")
}

describe("competition-addon-fns", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.reset()
    registerTables()
    mockRequireVerifiedEmail.mockResolvedValue(adminSession)
    mockHasFeature.mockResolvedValue(true)
  })

  describe("createCompetitionAddonFn entitlement gate", () => {
    // @lat: [[commerce#Registration Add-ons#Entitlement Gate]]
    it("rejects creation when the team lacks the registration_addons feature", async () => {
      mockHasFeature.mockResolvedValue(false)

      await expect(
        createAddon({
          data: {
            competitionId: "comp-1",
            teamId: "team-1",
            name: "Event Tee",
            priceCents: 2500,
          },
        }),
      ).rejects.toThrow(/not enabled for your account/)
      expect(mockDb.insert).not.toHaveBeenCalled()
    })

    it("creates a product with variants when entitled", async () => {
      mockDb.queueMockSingleValues([competition])

      const result = await createAddon({
        data: {
          competitionId: "comp-1",
          teamId: "team-1",
          name: "Event Tee",
          priceCents: 2500,
          variants: [
            { label: "M", stockQty: 20 },
            { label: "L", stockQty: null },
          ],
        },
      })

      expect(result.productId).toMatch(/^cmpprod_/)
      // Product insert + variants insert
      expect(mockDb.insert).toHaveBeenCalledTimes(2)
      expect(mockHasFeature).toHaveBeenCalledWith(
        "team-1",
        "registration_addons",
      )
    })

    it("rejects non-admin team members", async () => {
      mockRequireVerifiedEmail.mockResolvedValue(memberSession)

      await expect(
        createAddon({
          data: {
            competitionId: "comp-1",
            teamId: "team-1",
            name: "Event Tee",
            priceCents: 2500,
          },
        }),
      ).rejects.toThrow("Unauthorized")
    })
  })

  describe("updateCompetitionAddonFn entitlement gate", () => {
    it("rejects updates when the entitlement was revoked", async () => {
      mockHasFeature.mockResolvedValue(false)

      await expect(
        updateAddon({
          data: { productId: "cmpprod-1", teamId: "team-1", priceCents: 3000 },
        }),
      ).rejects.toThrow(/not enabled for your account/)
    })
  })

  describe("listCompetitionAddonsFn", () => {
    it("reports entitled=false while still listing existing products", async () => {
      mockHasFeature.mockResolvedValue(false)
      mockDb.queueMockSingleValues([competition])
      mockDb.query.competitionProductsTable.findMany.mockResolvedValue([
        activeProduct,
      ])
      mockDb.query.competitionProductVariantsTable.findMany.mockResolvedValue(
        [],
      )
      // Sales aggregate select chain resolves to the global return value
      mockDb.setMockReturnValue([])

      const result = await listAddons({
        data: { competitionId: "comp-1", teamId: "team-1" },
      })

      expect(result.entitled).toBe(false)
      expect(result.addons).toHaveLength(1)
      expect(result.addons[0].name).toBe("Event Tee")
    })
  })

  describe("getPublicCompetitionAddonsFn", () => {
    it("returns an empty catalog when the team lacks the entitlement", async () => {
      mockHasFeature.mockResolvedValue(false)
      mockDb.queueMockSingleValues([competition])
      mockDb.query.competitionProductsTable.findMany.mockResolvedValue([
        activeProduct,
      ])

      const result = await getPublicAddons({
        data: { competitionId: "comp-1" },
      })

      expect(result.addons).toEqual([])
    })

    it("returns an empty catalog when the organizer has no verified Stripe account", async () => {
      mockDb.queueMockSingleValues([
        competition,
        { stripeAccountStatus: "PENDING" },
      ])

      const result = await getPublicAddons({
        data: { competitionId: "comp-1" },
      })

      expect(result.addons).toEqual([])
    })

    it("returns purchasable products with all-in unit pricing", async () => {
      mockDb.queueMockSingleValues([
        competition,
        {
          stripeAccountStatus: "VERIFIED",
          organizerFeePercentage: null,
          organizerFeeFixed: null,
        },
      ])
      mockDb.query.competitionProductsTable.findMany.mockResolvedValue([
        activeProduct,
        { ...activeProduct, id: "cmpprod-2", name: "Hidden", status: "HIDDEN" },
        {
          ...activeProduct,
          id: "cmpprod-3",
          name: "Expired",
          availableUntil: "2020-01-01",
        },
      ])
      mockDb.query.competitionProductVariantsTable.findMany.mockResolvedValue([
        {
          id: "var-1",
          productId: "cmpprod-1",
          label: "M",
          stockQty: 20,
          soldQty: 20,
          sortOrder: 0,
        },
        {
          id: "var-2",
          productId: "cmpprod-1",
          label: "L",
          stockQty: 20,
          soldQty: 5,
          sortOrder: 1,
        },
      ])

      const result = await getPublicAddons({
        data: { competitionId: "comp-1" },
      })

      // HIDDEN and deadline-passed products filtered out
      expect(result.addons).toHaveLength(1)
      const addon = result.addons[0]
      // $25 + 4% platform fee (no $2 fixed on merch) = $26.00
      expect(addon.unitChargeCents).toBe(2600)
      expect(addon.variants).toEqual([
        { id: "var-1", label: "M", soldOut: true, remaining: 0 },
        { id: "var-2", label: "L", soldOut: false, remaining: 15 },
      ])
    })
  })
})
