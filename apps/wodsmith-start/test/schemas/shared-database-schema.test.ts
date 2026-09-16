import { getTableName } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import {
  agentOAuthGrantsTable,
  agentOAuthRequestsTable,
} from "@repo/wodsmith-db"

describe("shared database schema", () => {
  // @lat: [[architecture#Deployment Schema Readiness Tests#Shared Demo Schema Ownership]]
  it("retains tables already materialized by staged feature deployments", () => {
    expect([
      getTableName(agentOAuthGrantsTable),
      getTableName(agentOAuthRequestsTable),
    ]).toEqual(["agent_oauth_grants", "agent_oauth_requests"])
  })
})
