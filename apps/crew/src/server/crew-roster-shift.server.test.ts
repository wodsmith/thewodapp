import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadCrewShiftJudgeAssignments } from "./crew-roster-shift.server"

const mocks = vi.hoisted(() => ({
  db: null as unknown,
}))

vi.mock("@/db", () => ({ getDb: () => mocks.db }))

function mockJudgeAssignmentQuery(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
  }
  chain.from.mockReturnValue(chain)
  chain.innerJoin.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  chain.orderBy.mockResolvedValue(rows)
  mocks.db = { select: vi.fn(() => chain) }
}

describe("Crew shift judge commitments", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("maps membership and invitation judges to canonical assignee IDs", async () => {
    const scheduledTime = new Date("2026-10-10T15:00:00Z")
    mockJudgeAssignmentQuery([
      {
        id: "hvol_membership",
        membershipId: "tmem_judge",
        invitationId: null,
        heatId: "heat_1",
        trackWorkoutId: "trwk_1",
        eventName: "Event 1",
        heatNumber: 1,
        scheduledTime,
        durationMinutes: 12,
        laneNumber: 2,
        position: "judge",
      },
      {
        id: "hvol_invitation",
        membershipId: null,
        invitationId: "tinv_judge",
        heatId: "heat_2",
        trackWorkoutId: "trwk_1",
        eventName: "Event 1",
        heatNumber: 2,
        scheduledTime,
        durationMinutes: 12,
        laneNumber: 3,
        position: "judge",
      },
      {
        id: "hvol_unassigned",
        membershipId: null,
        invitationId: null,
        heatId: "heat_3",
        trackWorkoutId: "trwk_1",
        eventName: "Event 1",
        heatNumber: 3,
        scheduledTime,
        durationMinutes: 12,
        laneNumber: 4,
        position: "judge",
      },
    ])

    await expect(loadCrewShiftJudgeAssignments("comp_event")).resolves.toEqual([
      expect.objectContaining({
        id: "hvol_membership",
        assigneeId: "tmem_judge",
      }),
      expect.objectContaining({
        id: "hvol_invitation",
        assigneeId: "tinv_judge",
      }),
    ])
  })
})
