import type { SQL } from "drizzle-orm"
import { MySqlDialect } from "drizzle-orm/mysql-core"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { scoreRoundsTable, scoresTable } from "@/db/schemas/scores"
import { saveCompetitionScoreFn } from "@/server-fns/competition-score-fns"

type QueryResult = unknown[]

interface RoundInput {
  score: string
  parts?: [string, string]
  status?: "scored" | "cap"
  secondaryScore?: string | null
}

interface WorkoutInput {
  scheme: string
  scoreType: string | null
  repsPerRound: number | null
  roundsToScore: number | null
  timeCap: number | null
  tiebreakScheme?: string | null
}

interface SaveInput {
  competitionId: string
  organizingTeamId: string
  trackWorkoutId: string
  workoutId: string
  registrationId: string
  userId: string
  divisionId: string | null
  score: string
  scoreStatus:
    | "scored"
    | "cap"
    | "dnf"
    | "dns"
    | "dq"
    | "withdrawn"
  tieBreakScore?: string | null
  secondaryScore?: string | null
  roundScores?: RoundInput[]
  workout: WorkoutInput
}

interface WriteDbOptions {
  finalScoreId?: string
  rejectRoundInsert?: boolean
}

function createSelectChain(
  result: QueryResult,
  options: {
    whereCalls?: unknown[]
    onResolve?: () => void
  } = {},
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  }

  chain.from.mockReturnValue(chain)
  chain.innerJoin.mockReturnValue(chain)
  chain.where.mockImplementation((condition: unknown) => {
    options.whereCalls?.push(condition)
    return chain
  })
  chain.limit.mockImplementation(async () => {
    options.onResolve?.()
    return result
  })

  return chain
}

function createWriteDb(options: WriteDbOptions = {}) {
  const operations: string[] = []
  const scoreInserts: Array<Record<string, unknown>> = []
  const scoreUpdates: Array<Record<string, unknown>> = []
  const roundInserts: Array<Array<Record<string, unknown>>> = []
  const finalScoreWhereCalls: unknown[] = []

  const tx = {
    insert: vi.fn((table: unknown) => {
      if (table === scoresTable) {
        return {
          values: vi.fn((values: Record<string, unknown>) => {
            scoreInserts.push(values)
            operations.push("score-values")
            return {
              onDuplicateKeyUpdate: vi.fn(
                async ({ set }: { set: Record<string, unknown> }) => {
                  scoreUpdates.push(set)
                  operations.push("score-upsert")
                },
              ),
            }
          }),
        }
      }

      if (table === scoreRoundsTable) {
        return {
          values: vi.fn(async (values: Array<Record<string, unknown>>) => {
            roundInserts.push(values)
            operations.push("round-insert")
            if (options.rejectRoundInsert) {
              throw new Error("round insert failed")
            }
          }),
        }
      }

      throw new Error("Unexpected insert table")
    }),
    select: vi.fn(() =>
      createSelectChain(
        [{ id: options.finalScoreId ?? "score-1" }],
        {
          whereCalls: finalScoreWhereCalls,
          onResolve: () => operations.push("score-select"),
        },
      ),
    ),
    delete: vi.fn((table: unknown) => {
      if (table !== scoreRoundsTable) {
        throw new Error("Unexpected delete table")
      }
      return {
        where: vi.fn(async () => {
          operations.push("round-delete")
        }),
      }
    }),
  }

  const db = {
    select: vi.fn((selection?: Record<string, unknown>) => {
      if (selection && "competitionType" in selection) {
        return createSelectChain([{ competitionType: "in-person" }])
      }
      if (selection && "ownerTeamId" in selection) {
        return createSelectChain([{ ownerTeamId: "owner-team" }])
      }
      throw new Error("Unexpected root select shape")
    }),
    transaction: vi.fn(
      async (callback: (transaction: typeof tx) => Promise<unknown>) => {
        operations.push("transaction-start")
        try {
          const result = await callback(tx)
          operations.push("transaction-commit")
          return result
        } catch (error) {
          operations.push("transaction-rollback")
          throw error
        }
      },
    ),
  }

  return {
    db,
    finalScoreWhereCalls,
    operations,
    roundInserts,
    scoreInserts,
    scoreUpdates,
    tx,
  }
}

function createInput(overrides: Partial<SaveInput> = {}): SaveInput {
  return {
    competitionId: "comp-1",
    organizingTeamId: "organizer-team",
    trackWorkoutId: "track-workout-1",
    workoutId: "workout-1",
    registrationId: "registration-1",
    userId: "user-1",
    divisionId: "division-1",
    score: "5:00",
    scoreStatus: "scored",
    workout: {
      scheme: "time",
      scoreType: "min",
      repsPerRound: null,
      roundsToScore: 1,
      timeCap: null,
      tiebreakScheme: null,
    },
    ...overrides,
  }
}

function renderCondition(condition: unknown) {
  return new MySqlDialect().sqlToQuery(condition as SQL)
}

function persistedSortKey(score: Record<string, unknown>) {
  return BigInt(score.sortKey as string)
}

const SEGMENT_MAX = 2n ** 40n - 1n
const PRIMARY_SHIFT = 80n
const STATUS_SHIFT = 120n
const CAP_TIME_MASK = (1n << 32n) - 1n

let mockDb: ReturnType<typeof createWriteDb>["db"]

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
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

vi.mock("@/utils/team-auth", () => ({
  requireTeamPermission: vi.fn().mockResolvedValue(undefined),
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

describe("saveCompetitionScoreFn write characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // @lat: [[competition-score-writes#Competition Score Write Characterization#Single-round score and tiebreak encoding]]
  it("encodes a single score and time tiebreak into the persisted score", async () => {
    const write = createWriteDb()
    mockDb = write.db

    await saveCompetitionScoreFn({
      data: createInput({
        score: "5:00",
        tieBreakScore: "1:23",
        workout: {
          scheme: "time",
          scoreType: "min",
          repsPerRound: null,
          roundsToScore: 1,
          timeCap: null,
          tiebreakScheme: "time",
        },
      }),
    })

    expect(write.scoreInserts).toHaveLength(1)
    const score = write.scoreInserts[0] ?? {}
    expect(score).toMatchObject({
      scoreValue: 300_000,
      status: "scored",
      tiebreakScheme: "time",
      tiebreakValue: 83_000,
      scalingLevelId: "division-1",
    })
    expect(persistedSortKey(score) & SEGMENT_MAX).toBe(83_000n)
    expect(write.roundInserts).toEqual([])
  })

  // @lat: [[competition-score-writes#Competition Score Write Characterization#Single-round explicit CAP and invalid tiebreak]]
  it("clamps an explicit single-round CAP and silently drops an invalid tiebreak", async () => {
    const write = createWriteDb()
    mockDb = write.db

    await saveCompetitionScoreFn({
      data: createInput({
        score: "9:59",
        scoreStatus: "cap",
        secondaryScore: "150",
        tieBreakScore: "not-a-time",
        workout: {
          scheme: "time-with-cap",
          scoreType: "min",
          repsPerRound: null,
          roundsToScore: 1,
          timeCap: 600,
          tiebreakScheme: "time",
        },
      }),
    })

    const score = write.scoreInserts[0] ?? {}
    expect(score).toMatchObject({
      scoreValue: 600_000,
      status: "cap",
      secondaryValue: 150,
      tiebreakScheme: "time",
      tiebreakValue: null,
    })
    expect(persistedSortKey(score) & SEGMENT_MAX).toBe(0n)
  })

  // @lat: [[competition-score-writes#Competition Score Write Characterization#Multi-round aggregate and inferred CAP]]
  it("sums rounds, infers CAP at the configured threshold, and packs cappedRoundCount", async () => {
    const write = createWriteDb()
    mockDb = write.db

    await saveCompetitionScoreFn({
      data: createInput({
        score: "",
        tieBreakScore: "17",
        roundScores: [
          { score: "4:00", status: "cap" },
          { score: "10:02", status: "scored" },
        ],
        workout: {
          scheme: "time-with-cap",
          scoreType: "sum",
          repsPerRound: null,
          roundsToScore: 2,
          timeCap: 600,
          tiebreakScheme: "reps",
        },
      }),
    })

    const score = write.scoreInserts[0] ?? {}
    expect(score).toMatchObject({
      scoreValue: 842_000,
      status: "cap",
      tiebreakScheme: "reps",
      tiebreakValue: 17,
    })
    expect(write.roundInserts).toEqual([
      [
        {
          scoreId: "score-1",
          roundNumber: 1,
          value: 240_000,
          status: "scored",
        },
        {
          scoreId: "score-1",
          roundNumber: 2,
          value: 602_000,
          status: "cap",
        },
      ],
    ])

    const key = persistedSortKey(score)
    const primary = (key >> PRIMARY_SHIFT) & SEGMENT_MAX
    expect(key >> STATUS_SHIFT).toBe(1n)
    expect(primary >> 32n).toBe(1n)
    expect(primary & CAP_TIME_MASK).toBe(842_000n)
    expect(key & SEGMENT_MAX).toBe(SEGMENT_MAX - 17n)
  })

  // @lat: [[competition-score-writes#Competition Score Write Characterization#Unsupported multi-round CAP fields are stripped]]
  it("strips unsupported per-round CAP fields and ignores parent CAP when inferred rounds are clean", async () => {
    const write = createWriteDb()
    mockDb = write.db

    await saveCompetitionScoreFn({
      data: createInput({
        score: "",
        scoreStatus: "cap",
        secondaryScore: "99",
        roundScores: [
          { score: "4:00", status: "cap", secondaryScore: "99" },
          { score: "5:00", status: "cap", secondaryScore: "88" },
        ],
        workout: {
          scheme: "time-with-cap",
          scoreType: "sum",
          repsPerRound: null,
          roundsToScore: 2,
          timeCap: 600,
          tiebreakScheme: null,
        },
      }),
    })

    expect(write.scoreInserts[0]).toMatchObject({
      scoreValue: 540_000,
      status: "scored",
      secondaryValue: null,
    })
    expect(write.roundInserts[0]).toEqual([
      {
        scoreId: "score-1",
        roundNumber: 1,
        value: 240_000,
        status: "scored",
      },
      {
        scoreId: "score-1",
        roundNumber: 2,
        value: 300_000,
        status: "scored",
      },
    ])
  })

  // @lat: [[competition-score-writes#Competition Score Write Characterization#Division-scoped score lookup]]
  it("retrieves the upserted score within the requested division", async () => {
    const write = createWriteDb()
    mockDb = write.db

    await saveCompetitionScoreFn({ data: createInput() })

    const lookup = renderCondition(write.finalScoreWhereCalls[0])
    expect(lookup.sql).toContain("`scores`.`competitionEventId` = ?")
    expect(lookup.sql).toContain("`scores`.`userId` = ?")
    expect(lookup.sql).toContain("`scores`.`scalingLevelId` = ?")
    expect(lookup.params).toEqual([
      "track-workout-1",
      "user-1",
      "division-1",
    ])
  })

  // @lat: [[competition-score-writes#Competition Score Write Characterization#Null-division score lookup]]
  it("treats null division as its own lookup scope instead of a wildcard", async () => {
    const write = createWriteDb()
    mockDb = write.db

    await saveCompetitionScoreFn({
      data: createInput({ divisionId: null }),
    })

    const lookup = renderCondition(write.finalScoreWhereCalls[0])
    expect(lookup.sql).toContain("`scores`.`scalingLevelId` is null")
    expect(lookup.params).toEqual(["track-workout-1", "user-1"])
    expect(write.scoreInserts[0]?.scalingLevelId).toBeNull()
    expect(write.scoreUpdates[0]?.scalingLevelId).toBeNull()
  })

  // @lat: [[competition-score-writes#Competition Score Write Characterization#Atomic score and round replacement]]
  it("rolls back the score upsert and round replacement when round insertion fails", async () => {
    const write = createWriteDb({ rejectRoundInsert: true })
    mockDb = write.db

    await expect(
      saveCompetitionScoreFn({
        data: createInput({
          score: "",
          roundScores: [{ score: "4:00" }, { score: "5:00" }],
          workout: {
            scheme: "time",
            scoreType: "sum",
            repsPerRound: null,
            roundsToScore: 2,
            timeCap: null,
            tiebreakScheme: null,
          },
        }),
      }),
    ).rejects.toThrow("round insert failed")

    expect(write.operations).toEqual([
      "transaction-start",
      "score-values",
      "score-upsert",
      "score-select",
      "round-delete",
      "round-insert",
      "transaction-rollback",
    ])
  })

  // @lat: [[competition-score-writes#Competition Score Write Characterization#Single-value overwrite retains prior rounds]]
  it("does not delete prior rounds when a score is overwritten without roundScores", async () => {
    const write = createWriteDb()
    mockDb = write.db

    await saveCompetitionScoreFn({
      data: createInput({ score: "6:00", roundScores: undefined }),
    })

    expect(write.tx.delete).not.toHaveBeenCalled()
    expect(write.roundInserts).toEqual([])
    expect(write.operations).toEqual([
      "transaction-start",
      "score-values",
      "score-upsert",
      "score-select",
      "transaction-commit",
    ])
  })

  // @lat: [[competition-score-writes#Competition Score Write Characterization#Invalid round rejects the write]]
  it("rejects the entire write when any supplied round cannot be encoded", async () => {
    const write = createWriteDb()
    mockDb = write.db

    await expect(
      saveCompetitionScoreFn({
        data: createInput({
          score: "",
          roundScores: [{ score: "4:00" }, { score: "not-a-time" }],
          workout: {
            scheme: "time",
            scoreType: "sum",
            repsPerRound: null,
            roundsToScore: 2,
            timeCap: null,
            tiebreakScheme: null,
          },
        }),
      }),
    ).rejects.toThrow("Every round in roundScores must be a valid score")

    expect(write.db.transaction).not.toHaveBeenCalled()
    expect(write.scoreInserts).toEqual([])
  })
})
