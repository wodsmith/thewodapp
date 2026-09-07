import { beforeEach, describe, expect, it, vi } from "vitest"
import type { CompetitionJudgeRotation } from "@/db/schema"
import type { ProposedRotation } from "@/lib/judge-scheduler/schemas"
import { applyAiProposalsFn } from "@/server-fns/judge-scheduler-ai-fns"
const mocks = vi.hoisted(() => ({ db: vi.fn(), access: vi.fn(), scope: vi.fn(), context: vi.fn(), roster: vi.fn() }))
vi.mock("@/db", () => ({ getDb: mocks.db }))
vi.mock("@/server/judge-scheduler/access", () => ({ loadAiSchedulingScope: mocks.scope, requireAiSchedulingTeamAccess: mocks.access }))
vi.mock("@/server/judge-scheduler/context", () => ({ loadEventContext: mocks.context, loadJudgeRoster: mocks.roster, loadPriorRotations: vi.fn() }))
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: (parse: (data: unknown) => unknown) => ({ handler: (handler: (input: { data: unknown }) => unknown) => (input: { data: unknown }) => handler({ data: parse(input.data) }) }) }) }))
const proposal: ProposedRotation = { proposalId: "proposal-1", membershipId: "judge", startingHeat: 1, startingLane: 1, heatsCount: 1, laneShiftPattern: "stay", confidence: "high", rationale: "Coverage", softViolations: [], status: "pending" }
let rows: CompetitionJudgeRotation[]
const call = (proposals = [proposal], trackWorkoutId = "event") => applyAiProposalsFn({ data: { proposals, trackWorkoutId, competitionId: "comp", teamId: "team" } })
beforeEach(() => {
  rows = []
  const db = {
    select: () => ({ from: () => ({ where: async () => [...rows] }) }),
    transaction: async (fn: (tx: unknown) => unknown) => fn(db),
    insert: () => ({ values: (inserts: CompetitionJudgeRotation[]) => {
      const persist = () => { for (const row of inserts) if (!rows.some((r) => r.id === row.id)) rows.push(row) }
      return { then: (resolve: () => void) => { persist(); resolve() }, onDuplicateKeyUpdate: async () => persist() }
    } }),
    query: { competitionJudgeRotationsTable: { findMany: async () => [...rows] } },
  }
  mocks.db.mockReturnValue(db)
  mocks.scope.mockResolvedValue({})
  mocks.access.mockResolvedValue(undefined)
  mocks.context.mockResolvedValue({ competitionId: "comp", trackWorkoutId: "event", totalHeats: 2, minHeatBuffer: 0, heats: [{ heatNumber: 1, laneCount: 2, startTime: null, occupiedLanes: [] }, { heatNumber: 2, laneCount: 2, startTime: null, occupiedLanes: [] }], existingRotations: [] })
  mocks.roster.mockResolvedValue([{ membershipId: "judge", name: "Judge", availability: "all_day", availabilityNotes: null, credentials: null, currentRotationCount: 0 }])
})
describe("AI draft retry", () => {
  // @lat: [[organizer-recovery#Idempotent proposal persistence]]
  it("replays persisted proposals without adding duplicates and can save a mixed batch", async () => {
    expect((await call()).appliedCount).toBe(1)
    const firstId = rows[0].id
    expect((await call()).appliedCount).toBe(0)
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(firstId)
    expect((await call([proposal, { ...proposal, proposalId: "proposal-2", startingHeat: 2 }])).appliedCount).toBe(1)
    expect(rows).toHaveLength(2)
  })
  it("allows later runs to reuse a short proposal id for a distinct valid rotation", async () => {
    await call()
    expect((await call([{ ...proposal, startingHeat: 2 }])).appliedCount).toBe(1)
    expect(rows).toHaveLength(2)
    expect(rows[0].id).not.toBe(rows[1].id)
  })
  it.each(["scope", "access"] as const)("checks %s even on retry before reading or writing drafts", async (gate) => {
    await call()
    mocks[gate].mockRejectedValueOnce(new Error("Forbidden"))
    await expect(call()).rejects.toThrow("Forbidden")
    expect(rows).toHaveLength(1)
  })
  it("rejects duplicates, non-roster judges, invalid lanes, and overlaps", async () => {
    await expect(call([proposal, proposal])).rejects.toThrow("Duplicate")
    await expect(call([{ ...proposal, membershipId: "outsider" }])).rejects.toThrow("roster")
    await expect(call([{ ...proposal, startingLane: 3 }])).rejects.toThrow("invalid")
    await call()
    await expect(call([{ ...proposal, proposalId: "different" }])).rejects.toThrow(/overlap/i)
    expect(rows).toHaveLength(1)
  })
})
