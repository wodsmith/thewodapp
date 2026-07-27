import { beforeEach, describe, expect, it, vi } from "vitest"
import { scoreRoundsTable, scoresTable } from "@/db/schemas/scores"
import { deleteCompetitionScoreFn } from "@/server-fns/competition-score-fns"
import { requireTeamPermission } from "@/utils/team-auth"

type QueryResult = unknown[]

function createSelectChain(result: QueryResult) {
  const chain: Record<string, ReturnType<typeof vi.fn>> & {
    then?: (
      resolve: (value: QueryResult) => void,
      reject?: (reason: unknown) => void,
    ) => Promise<void>
  } = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  }

  chain.from.mockReturnValue(chain)
  chain.innerJoin.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  chain.limit.mockResolvedValue(result)
  chain.then = (resolve, reject) =>
    Promise.resolve(result).then(resolve, reject)

  return chain
}

function createDbMock(selectResults: QueryResult[]) {
  const pendingResults = [...selectResults]
  const deleteCalls: unknown[] = []
  const deleteWhere = vi.fn().mockResolvedValue(undefined)
  const tx = {
    select: vi.fn(() => createSelectChain(pendingResults.shift() ?? [])),
    delete: vi.fn((table: unknown) => {
      deleteCalls.push(table)
      return { where: deleteWhere }
    }),
  }
  const db = {
    select: vi.fn(() => createSelectChain(pendingResults.shift() ?? [])),
    transaction: vi.fn(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
  }

  return { db, deleteCalls, tx }
}

let mockDb: ReturnType<typeof createDbMock>["db"]

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}))

vi.mock("@/utils/team-auth", () => ({
  requireTeamPermission: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/evlog", () => ({
  getEvlog: vi.fn(() => undefined),
}))

vi.mock("@/lib/logging", () => ({
  addRequestContextAttribute: vi.fn(),
  logEntityDeleted: vi.fn(),
  logEntityUpdated: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarning: vi.fn(),
  updateRequestContext: vi.fn(),
}))

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (validator: (data: unknown) => unknown) => ({
      handler:
        (handler: (context: { data: never }) => Promise<unknown>) =>
        async ({ data }: { data: unknown }) =>
          handler({ data: validator(data) as never }),
    }),
  }),
}))

describe("deleteCompetitionScoreFn", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // @lat: [[organizer-dashboard#Results Entry#Clear Results]]
  it("deletes one owned score and its round breakdowns", async () => {
    const { db, deleteCalls, tx } = createDbMock([
      [{ organizingTeamId: "team-1" }],
      [{ id: "tw-1" }],
      [{ id: "score-1" }],
    ])
    mockDb = db

    const result = await deleteCompetitionScoreFn({
      data: {
        organizingTeamId: "team-1",
        competitionId: "comp-1",
        trackWorkoutId: "tw-1",
        userId: "user-1",
        divisionId: "division-1",
      },
    })

    expect(result).toEqual({ success: true })
    expect(requireTeamPermission).toHaveBeenCalledWith(
      "team-1",
      "manage_competitions",
    )
    expect(tx.delete).toHaveBeenCalledTimes(2)
    expect(deleteCalls).toEqual([scoreRoundsTable, scoresTable])
  })

  it("rejects an event outside the competition", async () => {
    const { db } = createDbMock([
      [{ organizingTeamId: "team-1" }],
      [],
    ])
    mockDb = db

    await expect(
      deleteCompetitionScoreFn({
        data: {
          organizingTeamId: "team-1",
          competitionId: "comp-1",
          trackWorkoutId: "tw-other",
          userId: "user-1",
          divisionId: null,
        },
      }),
    ).rejects.toThrow("Event does not belong to this competition")

    expect(db.transaction).not.toHaveBeenCalled()
  })

  it("rejects a mismatched organizing team", async () => {
    const { db } = createDbMock([
      [{ organizingTeamId: "team-1" }],
    ])
    mockDb = db

    await expect(
      deleteCompetitionScoreFn({
        data: {
          organizingTeamId: "team-other",
          competitionId: "comp-1",
          trackWorkoutId: "tw-1",
          userId: "user-1",
          divisionId: "division-1",
        },
      }),
    ).rejects.toThrow("Competition does not belong to this team")

    expect(requireTeamPermission).not.toHaveBeenCalled()
    expect(db.transaction).not.toHaveBeenCalled()
  })
})
