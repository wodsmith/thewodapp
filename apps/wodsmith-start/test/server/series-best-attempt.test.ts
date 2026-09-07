import { beforeEach, describe, expect, it, vi } from "vitest"
import { getSeriesLeaderboard } from "@/server/series-leaderboard"
const mocks = vi.hoisted(() => ({ db: vi.fn() }))
vi.mock("@/db", () => ({ getDb: mocks.db }))
const registration = (
  userId: string,
  competitionId: string,
  divisionId = `${competitionId}-rx`,
) => ({
  registration: {
    id: `${userId}-${competitionId}-${divisionId}`,
    divisionId,
    eventId: competitionId,
    teamName: null,
  },
  user: {
    id: userId,
    firstName: userId,
    lastName: "Athlete",
    email: `${userId}@example.com`,
  },
  competitionId,
  competitionName: competitionId,
})
const score = (
  id: string,
  userId: string,
  competition = "c1",
  value = 60_000,
  overrides: Record<string, unknown> = {},
) => ({
  id,
  userId,
  competitionEventId: `${competition}-event`,
  scalingLevelId: `${competition}-rx`,
  scheme: "time",
  scoreValue: value,
  status: "scored",
  sortKey: null,
  tiebreakScheme: null,
  tiebreakValue: null,
  timeCapMs: null,
  secondaryValue: null,
  ...overrides,
})
function setup(
  scores: ReturnType<typeof score>[],
  {
    scheme = "time",
    registrations = [
      registration("alice", "c1"),
      registration("alice", "c2"),
      registration("bob", "c1"),
      registration("alice", "c1", "partner"),
    ],
    rounds = [] as Array<{ scoreId: string; status: string }>,
  } = {},
) {
  const results = [
    [
      { id: "rx", label: "RX", position: 0, teamSize: 1 },
      { id: "team", label: "Partner", position: 1, teamSize: 2 },
    ],
    [
      { id: "c1", name: "First" },
      { id: "c2", name: "Second" },
    ],
    [
      {
        competitionId: "c1",
        competitionDivisionId: "c1-rx",
        seriesDivisionId: "rx",
      },
      {
        competitionId: "c2",
        competitionDivisionId: "c2-rx",
        seriesDivisionId: "rx",
      },
      {
        competitionId: "c1",
        competitionDivisionId: "partner",
        seriesDivisionId: "team",
      },
    ],
    [
      { id: "c1-track", competitionId: "c1" },
      { id: "c2-track", competitionId: "c2" },
    ],
    ["c1", "c2"].map((c) => ({
      id: `${c}-event`,
      trackId: `${c}-track`,
      trackOrder: 0,
      workoutId: "shared",
      workout: {
        name: "Shared workout",
        scheme,
        scoreType: scheme === "reps" ? "max" : "min",
      },
    })),
    registrations,
    scores,
    rounds,
  ]
  let call = 0
  mocks.db.mockReturnValue({
    query: {
      competitionGroupsTable: {
        findFirst: async () => ({
          settings: JSON.stringify({ scalingGroupId: "template" }),
        }),
      },
    },
    select: () => {
      const rows = results[call++] ?? []
      const chain: Record<string, unknown> = {
        then: (resolve: (rows: unknown[]) => void) => resolve(rows),
      }
      for (const method of [
        "from",
        "where",
        "innerJoin",
        "leftJoin",
        "orderBy",
      ])
        chain[method] = () => chain
      return chain
    },
  })
}
beforeEach(() => mocks.db.mockReset())
describe("series best eligible attempts", () => {
  // @lat: [[series-attempt-integrity#Best performance across competitions]]
  it.each([false, true])(
    "selects best time regardless of fetch order (reversed=%s) without collapsing divisions",
    async (reverse) => {
      const scores = [
        score("fast", "alice"),
        score("slow", "alice", "c2", 90_000),
        score("bob", "bob", "c1", 80_000),
        score("team", "alice", "c1", 120_000, { scalingLevelId: "partner" }),
      ]
      setup(reverse ? scores.reverse() : scores)
      const result = await getSeriesLeaderboard({ groupId: "series" })
      const alice = result.entries.find(
        (entry) => entry.userId === "alice" && entry.divisionId === "rx",
      )!
      expect(alice.eventResults[0]).toMatchObject({
        formattedScore: "1:00",
        rank: 1,
        points: 100,
      })
      expect(
        result.entries.find((entry) => entry.userId === "bob")!.eventResults[0]
          .rank,
      ).toBe(2)
      expect(
        result.entries.find((entry) => entry.divisionId === "team")!
          .eventResults[0].formattedScore,
      ).toBe("2:00")
      expect(result.entries).toHaveLength(3)
    },
  )
  // @lat: [[series-attempt-integrity#Ties and score direction]]
  it.each([false, true])(
    "uses reps direction and time tiebreaks with stable tied ranks (reversed=%s)",
    async (reverse) => {
      const scores = [
        score("a1", "alice", "c1", 100, {
          scheme: "reps",
          tiebreakScheme: "time",
          tiebreakValue: 30_000,
        }),
        score("a2", "alice", "c2", 100, {
          scheme: "reps",
          tiebreakScheme: "time",
          tiebreakValue: 40_000,
        }),
        score("b1", "bob", "c1", 100, {
          scheme: "reps",
          tiebreakScheme: "time",
          tiebreakValue: 30_000,
        }),
      ]
      setup(reverse ? scores.reverse() : scores, { scheme: "reps" })
      const { entries } = await getSeriesLeaderboard({
        groupId: "series",
        divisionId: "rx",
      })
      const alice = entries.find((e) => e.userId === "alice")!
      expect(alice.eventResults[0].formattedTiebreak).toBe("0:30")
      expect(alice.eventResults[0].rank).toBe(1)
      expect(
        entries.find((e) => e.userId === "bob")!.eventResults[0].rank,
      ).toBe(1)
    },
  )
  // @lat: [[series-attempt-integrity#Exact registration eligibility]]
  it("ignores an attempt whose competition and division do not match an active registration", async () => {
    setup(
      [
        score("valid", "alice", "c1", 60_000),
        score("unregistered", "alice", "c2", 10_000),
        score("wrong-division", "alice", "c2", 1_000, {
          scalingLevelId: "c1-rx",
        }),
        score("bob", "bob", "c1", 80_000),
      ],
      {
        registrations: [registration("alice", "c1"), registration("bob", "c1")],
      },
    )
    const { entries } = await getSeriesLeaderboard({ groupId: "series" })
    expect(
      entries.find((e) => e.userId === "alice")!.eventResults[0].formattedScore,
    ).toBe("1:00")
  })
  // @lat: [[series-attempt-integrity#Cap ordering and missing results]]
  it("prefers fewer capped rounds over a faster total and retains no-result entries", async () => {
    setup(
      [
        score("one-cap", "alice", "c1", 180_000, {
          scheme: "time-with-cap",
          status: "cap",
          timeCapMs: 120_000,
        }),
        score("two-cap", "alice", "c2", 120_000, {
          scheme: "time-with-cap",
          status: "cap",
          timeCapMs: 120_000,
        }),
      ],
      {
        scheme: "time-with-cap",
        rounds: [
          { scoreId: "one-cap", status: "scored" },
          { scoreId: "one-cap", status: "cap" },
          { scoreId: "two-cap", status: "cap" },
          { scoreId: "two-cap", status: "cap" },
        ],
      },
    )
    const { entries } = await getSeriesLeaderboard({
      groupId: "series",
      divisionId: "rx",
    })
    expect(
      entries.find((e) => e.userId === "alice")!.eventResults[0].formattedScore,
    ).toContain("3:00")
    expect(
      entries.find((e) => e.userId === "bob")!.eventResults[0],
    ).toMatchObject({ formattedScore: "—", points: 0 })
  })
  it.each([false, true])(
    "prefers higher reps and cap reps regardless of order (reversed=%s)",
    async (reverse) => {
      const reps = [
        score("best", "alice", "c1", 110, { scheme: "reps" }),
        score("worse", "alice", "c2", 100, { scheme: "reps" }),
      ]
      setup(reverse ? reps.reverse() : reps, { scheme: "reps" })
      let result = await getSeriesLeaderboard({
        groupId: "series",
        divisionId: "rx",
      })
      expect(
        result.entries.find((e) => e.userId === "alice")!.eventResults[0]
          .formattedScore,
      ).toContain("110")
      const caps = [
        score("best", "alice", "c1", 120_000, {
          scheme: "time-with-cap",
          status: "cap",
          timeCapMs: 120_000,
          secondaryValue: 90,
        }),
        score("worse", "alice", "c2", 120_000, {
          scheme: "time-with-cap",
          status: "cap",
          timeCapMs: 120_000,
          secondaryValue: 80,
        }),
      ]
      setup(reverse ? caps.reverse() : caps, { scheme: "time-with-cap" })
      result = await getSeriesLeaderboard({
        groupId: "series",
        divisionId: "rx",
      })
      expect(
        result.entries.find((e) => e.userId === "alice")!.eventResults[0]
          .formattedScore,
      ).toContain("90")
    },
  )
  it("prefers completed scores over caps and excludes missing scored values", async () => {
    setup([
      score("complete", "alice", "c1", 100_000),
      score("cap", "alice", "c2", 90_000, { status: "cap" }),
      score("missing", "alice", "c2", 0, { scoreValue: null }),
    ])
    const { entries } = await getSeriesLeaderboard({
      groupId: "series",
      divisionId: "rx",
    })
    expect(
      entries.find((e) => e.userId === "alice")!.eventResults[0].formattedScore,
    ).toBe("1:40")
  })
})
