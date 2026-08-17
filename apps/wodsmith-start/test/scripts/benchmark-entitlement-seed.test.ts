import { describe, expect, it, vi } from "vitest"
import { seed as seedBilling } from "../../scripts/seed/seeders/02-billing"
import { seed as seedUsers } from "../../scripts/seed/seeders/03-users"
import { seed as seedMemberships } from "../../scripts/seed/seeders/05-team-memberships"
import { seed as seedTeamEntitlements } from "../../scripts/seed/seeders/06-team-entitlements"

type SeedRow = Record<string, unknown>

async function collectSeedRows(
  seed: (client: never) => Promise<void>,
): Promise<Record<string, SeedRow[]>> {
  const rowsByTable: Record<string, SeedRow[]> = {}
  const client = {
    execute: vi.fn(async (sql: string, params: unknown[]) => {
      const tableName = /INSERT IGNORE INTO `([^`]+)`/.exec(sql)?.[1]
      const columnList = /\(([^)]+)\) VALUES/.exec(sql)?.[1]
      if (!tableName || !columnList) throw new Error("Unable to parse seed SQL")

      const columns = [...columnList.matchAll(/`([^`]+)`/g)].map(
        (match) => match[1],
      )
      const rows: SeedRow[] = []
      for (let offset = 0; offset < params.length; offset += columns.length) {
        rows.push(
          Object.fromEntries(
            columns.map((column, index) => [column, params[offset + index]]),
          ),
        )
      }
      rowsByTable[tableName] = [...(rowsByTable[tableName] ?? []), ...rows]
    }),
  }

  await seed(client as never)
  return rowsByTable
}

describe("benchmark entitlement seed", () => {
  // @lat: [[competition-type-capabilities#Benchmark Rollout Gates#Seeded Demo Organizer Entitlement]]
  it("registers the feature and grants it to admin@example.com's organizer team", async () => {
    const [billingRows, userRows, membershipRows, entitlementRows] =
      await Promise.all([
        collectSeedRows(seedBilling),
        collectSeedRows(seedUsers),
        collectSeedRows(seedMemberships),
        collectSeedRows(seedTeamEntitlements),
      ])

    expect(billingRows.features).toContainEqual(
      expect.objectContaining({
        id: "feat_create_benchmarks",
        key: "create_benchmarks",
        is_active: 1,
      }),
    )
    expect(entitlementRows.team_feature_entitlements).toContainEqual(
      expect.objectContaining({
        team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1",
        feature_id: "feat_create_benchmarks",
        source: "override",
      }),
    )
    expect(userRows.users).toContainEqual(
      expect.objectContaining({
        id: "usr_demo1admin",
        email: "admin@example.com",
      }),
    )
    expect(membershipRows.team_memberships).toContainEqual(
      expect.objectContaining({
        team_id: "team_cokkpu1klwo0ulfhl1iwzpvnbox1",
        user_id: "usr_demo1admin",
        role_id: "owner",
      }),
    )
  })
})
