import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  rows: [] as unknown[][],
  inserts: vi.fn(),
  updates: vi.fn(),
  locks: vi.fn(),
  transaction: vi.fn(),
}))
vi.mock("@/utils/auth", () => ({ requireAdmin: mocks.admin, getSessionFromCookie: vi.fn() }))
vi.mock("@/db", () => {
  const db = {
    select: () => {
      const rows = mocks.rows.shift() ?? []
      const chain: Record<string, unknown> = {
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(rows).then(resolve),
        for: (mode: string) => { mocks.locks(mode); return chain },
      }
      for (const method of ["from", "innerJoin", "where", "limit"]) chain[method] = () => chain
      return chain
    },
    transaction: (callback: (value: unknown) => unknown) => { mocks.transaction(); return callback(db) },
    insert: () => ({ values: mocks.inserts }),
    update: () => ({ set: (patch: unknown) => ({ where: () => mocks.updates(patch) }) }),
  }
  return { getDb: () => db }
})

import { grantCrewPilotAccess } from "@/server/crew-billing.server"

const scope = { id: "comp_selected", organizingTeamId: "team_selected", settingsId: "settings_selected" }
const unpaid = {
  id: "settings_selected", competitionId: "comp_selected", crewBillingState: "unpaid",
  crewBillingPlanId: null, crewBillingAmountCents: 0, crewBillingCurrency: "usd",
}

beforeEach(() => {
  mocks.admin.mockResolvedValue({ user: { id: "operator", email: "operator@example.com", role: "admin" } })
  mocks.rows = []
})

describe("Crew pilot event grants", () => {
  it("rejects non-operators before reading or writing billing", async () => {
    mocks.admin.mockRejectedValue(new Error("FORBIDDEN"))
    await expect(grantCrewPilotAccess({ eventId: "comp_selected", reason: "Pilot organizer" })).rejects.toThrow("FORBIDDEN")
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.inserts).not.toHaveBeenCalled()
    expect(mocks.updates).not.toHaveBeenCalled()
  })

  it("grants the selected event with an audited zero charge and server-derived actor", async () => {
    mocks.rows = [[scope], [unpaid], []]
    expect(await grantCrewPilotAccess({ eventId: "comp_selected", reason: "Founding organizer feedback" })).toEqual({ status: "granted" })
    expect(mocks.locks).toHaveBeenCalledWith("update")
    expect(mocks.inserts).toHaveBeenCalledWith(expect.objectContaining({
      competitionId: "comp_selected", teamId: "team_selected", eventType: "event_comped",
      planId: "crew_basic", amountCents: 0, billingState: "comped", idempotencyKey: "pilot-launch-2026",
      actorUserId: "operator", actorLabel: "operator@example.com",
      privateMetadata: { pilot: "crew-launch-2026", reason: "Founding organizer feedback" },
    }))
    expect(mocks.updates).toHaveBeenCalledWith(expect.objectContaining({
      crewBillingState: "comped", crewBillingPlanId: "crew_basic", crewBillingAmountCents: 0,
    }))
    expect(mocks.updates.mock.calls[0][0]).not.toHaveProperty("currentPlanId")
  })

  it("makes retries idempotent and does not re-grant a previously revoked pilot", async () => {
    mocks.rows = [[scope], [{ ...unpaid, crewBillingState: "refunded" }], [{ id: "existing_grant" }]]
    expect(await grantCrewPilotAccess({ eventId: "comp_selected", reason: "Repeated request" })).toEqual({ status: "already_granted" })
    expect(mocks.inserts).not.toHaveBeenCalled()
    expect(mocks.updates).not.toHaveBeenCalled()
  })

  it.each(["pending", "paid", "comped", "credited", "refunded"])("preserves an event with %s billing", async (state) => {
    mocks.rows = [[scope], [{ ...unpaid, crewBillingState: state }], []]
    await expect(grantCrewPilotAccess({ eventId: "comp_selected", reason: "Pilot organizer" })).rejects.toThrow(/unpaid event/)
    expect(mocks.inserts).not.toHaveBeenCalled()
    expect(mocks.updates).not.toHaveBeenCalled()
  })
})
