import { describe, it, expect } from "vitest"
import { assertTenantIsolation, assertRecordIsolation, assertAllBelongToTeam } from "./tenant"
import { FakeDatabase } from "../fakes/fake-db"

interface TestSchema extends Record<string, Record<string, unknown>> {
  workouts: {
    id: string
    teamId: string
    name: string
    createdAt: Date
    updatedAt: Date
  }
}

describe("assertTenantIsolation", () => {
  it("should pass when all records belong to expected team", async () => {
    const db = new FakeDatabase<TestSchema>()
    const teamId = "team-1"
    
    db.insert("workouts", { teamId, name: "Workout 1" })
    db.insert("workouts", { teamId, name: "Workout 2" })
    
    await expect(
      assertTenantIsolation(db, "workouts", teamId, () => 
        db.findMany("workouts", w => w.teamId === teamId)
      )
    ).resolves.not.toThrow()
  })

  it("should fail when records from other teams are present", async () => {
    const db = new FakeDatabase<TestSchema>()
    const myTeam = "team-1"
    const otherTeam = "team-2"
    
    db.insert("workouts", { teamId: myTeam, name: "Mine" })
    db.insert("workouts", { teamId: otherTeam, name: "Theirs" })
    
    // Query that incorrectly returns all workouts
    await expect(
      assertTenantIsolation(db, "workouts", myTeam, () => 
        db.findMany("workouts") // Bug: no team filter!
      )
    ).rejects.toThrow("Tenant isolation violation")
  })
})

describe("assertRecordIsolation", () => {
  it("should pass when attacker cannot access record", async () => {
    const ownerTeam = "team-1"
    const attackerTeam = "team-2"
    
    const getRecord = (teamId: string) => {
      // Simulates proper isolation - only owner can access
      return teamId === ownerTeam ? { id: "1", teamId: ownerTeam } : null
    }
    
    await expect(
      assertRecordIsolation(getRecord, ownerTeam, attackerTeam)
    ).resolves.not.toThrow()
  })

  it("should fail when attacker can access record", async () => {
    const ownerTeam = "team-1"
    const attackerTeam = "team-2"
    
    const getRecord = (_teamId: string) => {
      // Bug: returns record regardless of team
      return { id: "1", teamId: ownerTeam }
    }
    
    await expect(
      assertRecordIsolation(getRecord, ownerTeam, attackerTeam)
    ).rejects.toThrow("Record isolation violation")
  })
})

describe("assertAllBelongToTeam", () => {
  it("should pass when all items belong to team", () => {
    const teamId = "team-1"
    const items = [
      { id: "1", teamId, name: "A" },
      { id: "2", teamId, name: "B" }
    ]
    
    expect(() => assertAllBelongToTeam(items, teamId)).not.toThrow()
  })

  it("should fail when items from other teams present", () => {
    const teamId = "team-1"
    const items = [
      { id: "1", teamId, name: "A" },
      { id: "2", teamId: "team-2", name: "B" }
    ]
    
    expect(() => assertAllBelongToTeam(items, teamId)).toThrow(
      "Tenant isolation violation"
    )
  })

  it("should use custom entity name in error", () => {
    const items = [{ id: "1", teamId: "team-2", name: "A" }]
    
    expect(() => assertAllBelongToTeam(items, "team-1", "workouts")).toThrow(
      "1 workouts"
    )
  })
})
