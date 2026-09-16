import { getTableColumns, getTableName } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import {
  agentOAuthGrantsTable,
  agentOAuthRequestsTable,
  trainingMutationReceiptsTable,
  workouts,
} from "@repo/wodsmith-db"

describe("shared database schema", () => {
  // @lat: [[architecture#Deployment Schema Readiness Tests#Shared Demo Schema Ownership]]
  it("retains schema already materialized by staged feature deployments", () => {
    expect([
      getTableName(agentOAuthGrantsTable),
      getTableName(agentOAuthRequestsTable),
      getTableName(trainingMutationReceiptsTable),
    ]).toEqual([
      "agent_oauth_grants",
      "agent_oauth_requests",
      "training_mutation_receipts",
    ])
    expect(getTableColumns(workouts).archivedAt?.getSQLType()).toBe("datetime(3)")
  })
})
