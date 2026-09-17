import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SQL } from "drizzle-orm"
import { MySqlDialect } from "drizzle-orm/mysql-core"
import { scoreRoundsTable, scoresTable } from "@/db/schemas/scores"
import { deleteCompetitionScoreFn } from "@/server-fns/competition-score-fns"
import { requireTeamPermission } from "@/utils/team-auth"

type QueryResult = unknown[]

function createSelectChain(result: QueryResult, whereCalls: unknown[] = []) {
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
  chain.where.mockImplementation((condition: unknown) => {
    whereCalls.push(condition)
    return chain
  })
  chain.limit.mockResolvedValue(result)
  chain.then = (resolve, reject) =>
    Promise.resolve(result).then(resolve, reject)

  return chain
}

function createDbMock(selectResults: QueryResult[]) {
  const pendingResults = [...selectResults]
  const deleteCalls: unknown[] = []
  const txSelectWhereCalls: unknown[] = []
  const deleteWhere = vi.fn().mockResolvedValue(undefined)
  const tx = {
    select: vi.fn(() =>
      createSelectChain(pendingResults.shift() ?? [], txSelectWhereCalls),
    ),
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

  return { db, deleteCalls, deleteWhere, tx, txSelectWhereCalls }
}

function renderCondition(condition: unknown) {
  return new MySqlDialect().sqlToQuery(condition as SQL)
}

function successfulRemovalResults(input: {
  divisionId: string | null
  scoreRows: QueryResult
  userId?: string
}) {
  return [
    [{ organizingTeamId: "team-1" }],
    [{ id: "tw-1" }],
    [{ id: "comp-1", organizingTeamId: "team-1" }],
    [{ id: "tw-1", competitionId: "comp-1" }],
    [
      {
        id: "registration-1",
        competitionId: "comp-1",
        athleteId: input.userId ?? "user-1",
        divisionId: input.divisionId,
      },
    ],
    input.scoreRows,
  ]
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

  // @lat: [[organizer-dashboard#Results Entry#Clear Results#Deletes score and rounds]]
  it("deletes one owned score and its round breakdowns", async () => {
    const {
      db,
      deleteCalls,
      deleteWhere,
      tx,
      txSelectWhereCalls,
    } = createDbMock(
      successfulRemovalResults({
        divisionId: "division-1",
        scoreRows: [{ id: "score-1" }],
      }),
    )
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
    expect(txSelectWhereCalls).toHaveLength(4)
    expect(renderCondition(txSelectWhereCalls[0]).params).toEqual(["comp-1"])
    expect(renderCondition(txSelectWhereCalls[1]).params).toEqual([
      "tw-1",
      "comp-1",
    ])
    expect(renderCondition(txSelectWhereCalls[2]).params).toEqual([
      "comp-1",
      "user-1",
      "active",
      "division-1",
    ])
    const selectionWhere = renderCondition(txSelectWhereCalls[3])
    expect(selectionWhere.sql).toContain("`scores`.`competitionEventId` = ?")
    expect(selectionWhere.sql).toContain("`scores`.`userId` = ?")
    expect(selectionWhere.sql).toContain("`scores`.`scalingLevelId` = ?")
    expect(selectionWhere.params).toEqual(["tw-1", "user-1", "division-1"])

    expect(deleteWhere).toHaveBeenCalledTimes(2)
    const roundDeleteWhere = renderCondition(deleteWhere.mock.calls[0]?.[0])
    expect(roundDeleteWhere.sql).toBe("`score_rounds`.`scoreId` in (?)")
    expect(roundDeleteWhere.params).toEqual(["score-1"])
    const scoreDeleteWhere = renderCondition(deleteWhere.mock.calls[1]?.[0])
    expect(scoreDeleteWhere.sql).toBe("`scores`.`id` in (?)")
    expect(scoreDeleteWhere.params).toEqual(["score-1"])
  })

  // @lat: [[organizer-dashboard#Results Entry#Clear Results#Rejects event outside competition]]
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

  // @lat: [[organizer-dashboard#Results Entry#Clear Results#Rejects mismatched organizing team]]
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

  // @lat: [[organizer-dashboard#Results Entry#Clear Results#Missing score is idempotent]]
  it("succeeds without deletes when no score matches", async () => {
    const { db, tx } = createDbMock(
      successfulRemovalResults({
        divisionId: "division-1",
        scoreRows: [],
        userId: "user-without-score",
      }),
    )
    mockDb = db

    const result = await deleteCompetitionScoreFn({
      data: {
        organizingTeamId: "team-1",
        competitionId: "comp-1",
        trackWorkoutId: "tw-1",
        userId: "user-without-score",
        divisionId: "division-1",
      },
    })

    expect(result).toEqual({ success: true })
    expect(db.transaction).toHaveBeenCalledOnce()
    expect(tx.delete).not.toHaveBeenCalled()
  })

  // @lat: [[organizer-dashboard#Results Entry#Clear Results#Deletes null-division score]]
  it("deletes an open score with a null division", async () => {
    const { db, deleteCalls, tx } = createDbMock(
      successfulRemovalResults({
        divisionId: null,
        scoreRows: [{ id: "score-open" }],
      }),
    )
    mockDb = db

    const result = await deleteCompetitionScoreFn({
      data: {
        organizingTeamId: "team-1",
        competitionId: "comp-1",
        trackWorkoutId: "tw-1",
        userId: "user-1",
        divisionId: null,
      },
    })

    expect(result).toEqual({ success: true })
    expect(tx.select).toHaveBeenCalledTimes(4)
    expect(tx.delete).toHaveBeenCalledTimes(2)
    expect(deleteCalls).toEqual([scoreRoundsTable, scoresTable])
  })

  // @lat: [[organizer-dashboard#Results Entry#Clear Results#Deletes duplicate legacy rows in scope]]
  it("deletes every legacy duplicate in the selected open-division scope", async () => {
    const { db, deleteWhere } = createDbMock(
      successfulRemovalResults({
        divisionId: null,
        scoreRows: [{ id: "score-open-1" }, { id: "score-open-2" }],
      }),
    )
    mockDb = db

    await deleteCompetitionScoreFn({
      data: {
        organizingTeamId: "team-1",
        competitionId: "comp-1",
        trackWorkoutId: "tw-1",
        userId: "user-1",
        divisionId: null,
      },
    })

    expect(renderCondition(deleteWhere.mock.calls[0]?.[0]).params).toEqual([
      "score-open-1",
      "score-open-2",
    ])
    expect(renderCondition(deleteWhere.mock.calls[1]?.[0]).params).toEqual([
      "score-open-1",
      "score-open-2",
    ])
  })

  // @lat: [[organizer-dashboard#Results Entry#Clear Results#Authorization precedes mutation]]
  it("does not enter the transaction when authorization fails", async () => {
    const { db } = createDbMock([[{ organizingTeamId: "team-1" }]])
    mockDb = db
    vi.mocked(requireTeamPermission).mockRejectedValueOnce(
      new Error("Forbidden"),
    )

    await expect(
      deleteCompetitionScoreFn({
        data: {
          organizingTeamId: "team-1",
          competitionId: "comp-1",
          trackWorkoutId: "tw-1",
          userId: "user-1",
          divisionId: "division-1",
        },
      }),
    ).rejects.toThrow("Forbidden")

    expect(db.transaction).not.toHaveBeenCalled()
  })

  // @lat: [[organizer-dashboard#Results Entry#Clear Results#Transaction failure is not success]]
  it("does not report success when the score transaction fails", async () => {
    const { db } = createDbMock([
      [{ organizingTeamId: "team-1" }],
      [{ id: "tw-1" }],
      [{ id: "score-1" }],
    ])
    db.transaction.mockRejectedValueOnce(new Error("transaction rolled back"))
    mockDb = db

    await expect(
      deleteCompetitionScoreFn({
        data: {
          organizingTeamId: "team-1",
          competitionId: "comp-1",
          trackWorkoutId: "tw-1",
          userId: "user-1",
          divisionId: "division-1",
        },
      }),
    ).rejects.toThrow("transaction rolled back")
  })

  // @lat: [[organizer-dashboard#Results Entry#Clear Results#Requires a proven participation]]
  it("does not delete when the athlete and division have no participation", async () => {
    const results = successfulRemovalResults({
      divisionId: "division-1",
      scoreRows: [{ id: "score-1" }],
    })
    results[4] = []
    const { db, tx } = createDbMock(results)
    mockDb = db

    await expect(
      deleteCompetitionScoreFn({
        data: {
          organizingTeamId: "team-1",
          competitionId: "comp-1",
          trackWorkoutId: "tw-1",
          userId: "user-1",
          divisionId: "division-1",
        },
      }),
    ).resolves.toEqual({ success: true })

    expect(tx.delete).not.toHaveBeenCalled()
  })

  // @lat: [[organizer-dashboard#Results Entry#Clear Results#Rejects ambiguous participation]]
  it("rejects rather than choosing between duplicate registrations", async () => {
    const results = successfulRemovalResults({
      divisionId: "division-1",
      scoreRows: [{ id: "score-1" }],
    })
    results[4] = [
      {
        id: "registration-1",
        competitionId: "comp-1",
        athleteId: "user-1",
        divisionId: "division-1",
      },
      {
        id: "registration-duplicate",
        competitionId: "comp-1",
        athleteId: "user-1",
        divisionId: "division-1",
      },
    ]
    const { db, tx } = createDbMock(results)
    mockDb = db

    await expect(
      deleteCompetitionScoreFn({
        data: {
          organizingTeamId: "team-1",
          competitionId: "comp-1",
          trackWorkoutId: "tw-1",
          userId: "user-1",
          divisionId: "division-1",
        },
      }),
    ).rejects.toThrow("Multiple registrations match this score scope")

    expect(tx.delete).not.toHaveBeenCalled()
  })
})
