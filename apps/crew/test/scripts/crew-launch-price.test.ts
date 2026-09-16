import type { Connection } from "mysql2/promise"
import { describe, expect, it, vi } from "vitest"
import {
  parseCrewPriceUpdateArgs,
  runCrewPriceUpdate,
} from "../../scripts/update-crew-price"
import { seed as seedCrew } from "../../scripts/seed/seeders/02-billing"
import { seed as seedWodsmith } from "../../../wodsmith-start/scripts/seed/seeders/02-billing"

function fixture(price = 20000) {
  const connection = {
    execute: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith("SELECT DATABASE")) return [[{ databaseName: "crew_demo" }]]
      if (sql.startsWith("SELECT price")) return [[{ price, interval: null, isActive: 1, isPublic: 1 }]]
      if (sql.startsWith("SELECT competition_id")) return [[{ eventId: "event_pending", amountCents: 20000 }]]
      if (sql.startsWith("UPDATE plans") && params?.[2] === price) {
        price = params[0] as number
        return [{ affectedRows: 1 }]
      }
      throw new Error(`Unexpected SQL: ${sql}`)
    }),
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
  }
  return { connection, db: connection as unknown as Connection }
}

describe("Crew launch price", () => {
  it.each([["Crew", seedCrew], ["WODsmith", seedWodsmith]] as const)(
    "%s seeds a 30 USD one-time public event offer",
    async (_app, seed) => {
      let plan: Record<string, unknown> | undefined
      const execute = vi.fn(async (sql: string, params: unknown[]) => {
        if (!sql.startsWith("INSERT IGNORE INTO `plans`")) return
        const columns = [...(sql.match(/\(([^)]+)\) VALUES/)?.[1] ?? "").matchAll(/`([^`]+)`/g)].map((match) => match[1])
        for (let index = 0; index < params.length; index += columns.length) {
          const row = Object.fromEntries(columns.map((column, offset) => [column, params[index + offset]]))
          if (row.id === "crew_basic") plan = row
        }
      })
      await seed({ execute } as never)
      expect(plan).toMatchObject({ price: 3000, interval: null, is_public: 1, is_active: 1 })
    },
  )

  it("defaults to a read-only report and lists frozen $200 attempts", async () => {
    const { db, connection } = fixture()
    const options = parseCrewPriceUpdateArgs(["--stage=demo"])
    expect(options.apply).toBe(false)
    expect(await runCrewPriceUpdate(db, options)).toMatchObject({
      status: "would_update", priceCents: 3000,
      pendingAtOtherPrices: [{ eventId: "event_pending", amountCents: 20000 }],
    })
    expect(connection.beginTransaction).not.toHaveBeenCalled()
    expect(connection.execute.mock.calls.every(([sql]) => sql.startsWith("SELECT"))).toBe(true)
  })

  it("updates only the catalog and is idempotent", async () => {
    const { db, connection } = fixture()
    const options = { stage: "demo", apply: true, expectedDatabase: "crew_demo" } as const
    expect(await runCrewPriceUpdate(db, options)).toMatchObject({ status: "updated" })
    expect(await runCrewPriceUpdate(db, options)).toMatchObject({ status: "already_current" })
    const writes = connection.execute.mock.calls.filter(([sql]) => !sql.startsWith("SELECT"))
    expect(writes).toHaveLength(1)
    expect(writes[0]).toEqual([expect.stringMatching(/^UPDATE plans SET price/), [3000, "crew_basic", 20000]])
    expect(connection.commit).toHaveBeenCalledTimes(2)
  })

  it("requires a reviewed database for apply and rejects an unexpected price", async () => {
    expect(() => parseCrewPriceUpdateArgs(["--stage=prod", "--apply"])).toThrow(/expected-database/)
    const { db, connection } = fixture(50000)
    await expect(runCrewPriceUpdate(db, { stage: "prod", apply: true, expectedDatabase: "wrong" })).rejects.toThrow(/expected database/)
    await expect(runCrewPriceUpdate(db, { stage: "demo", apply: true, expectedDatabase: "crew_demo" })).rejects.toThrow(/unexpected price/)
    expect(connection.commit).not.toHaveBeenCalled()
    expect(connection.rollback).toHaveBeenCalledOnce()
    expect(connection.execute.mock.calls.every(([sql]) => sql.startsWith("SELECT"))).toBe(true)
  })
})
