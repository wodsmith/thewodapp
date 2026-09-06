import { drizzle } from "drizzle-orm/mysql-proxy"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  session: vi.fn(),
  invalidate: vi.fn(),
  updateSessions: vi.fn(),
  leaderboard: vi.fn(),
}))
vi.mock("@/db", () => ({ getDb: mocks.getDb }))
vi.mock("@/utils/bearer-auth", () => ({ getSessionFromBearer: mocks.session }))
vi.mock("@/utils/kv-session", () => ({
  updateAllSessionsOfUser: mocks.updateSessions,
  deleteKVSession: mocks.invalidate,
}))
vi.mock("@/utils/auth", () => ({ invalidateSession: mocks.invalidate }))
vi.mock("@/server/competition-leaderboard", () => ({
  getCompetitionLeaderboard: mocks.leaderboard,
}))

import { getGameDayRegistrations, handleGameDayRequest } from "@/server/gameday"

describe("Game Day API", () => {
  let statements: Array<{ sql: string; params: unknown[] }>
  let rows: unknown[][][]
  beforeEach(() => {
    statements = []
    rows = []
    mocks.session.mockResolvedValue(null)
    mocks.getDb.mockReturnValue(
      drizzle(async (sql, params) => {
        statements.push({ sql, params })
        return { rows: rows.shift() ?? [] }
      }),
    )
  })

  // @lat: [[gameday#Tests#API identity boundary]]
  it("rejects invalid bearer credentials and anonymous profile mutations before querying data", async () => {
    const expired = await handleGameDayRequest(
      new Request("https://wodsmith.com/api/gameday/v1/home", {
        headers: { Authorization: "Bearer expired" },
      }),
    )
    expect(expired.status).toBe(401)
    const anonymous = await handleGameDayRequest(
      new Request("https://wodsmith.com/api/gameday/v1/profile", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: "Test",
          lastName: "Athlete",
          userId: "other-user",
        }),
      }),
    )
    expect(anonymous.status).toBe(401)
    expect(mocks.getDb).not.toHaveBeenCalled()
    expect(expired.headers.get("Cache-Control")).toBe("private, no-store")
  })

  // @lat: [[gameday#Tests#Public discovery boundary]]
  it("restricts spectator discovery to published public competitions and omits athlete data", async () => {
    const response = await handleGameDayRequest(
      new Request("https://wodsmith.com/api/gameday/v1/home"),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      competitions: [],
      registrations: [],
      profile: null,
    })
    expect(statements).toHaveLength(1)
    expect(statements[0].params).toContain("published")
    expect(statements[0].params).toContain("public")
    expect(statements[0].sql).not.toContain("passwordHash")
  })

  // @lat: [[gameday#Tests#Team registration ownership]]
  it("requires active registrations and active athlete-team membership for the authenticated user", async () => {
    await getGameDayRegistrations("athlete-123")
    expect(statements).toHaveLength(1)
    expect(statements[0].sql).toContain("exists")
    expect(statements[0].sql).toContain("athleteTeamId")
    expect(statements[0].sql).toContain("isActive")
    expect(statements[0].params).toEqual(
      expect.arrayContaining(["athlete-123", "active", "published"]),
    )
    expect(statements[0].sql).not.toContain("pendingTeammates")
    expect(statements[0].sql).not.toContain("passwordHash")
  })

  // @lat: [[gameday#Tests#Draft competition boundary]]
  it("does not query or return schedules and leaderboards for unpublished competitions", async () => {
    const response = await handleGameDayRequest(
      new Request(
        "https://wodsmith.com/api/gameday/v1/competitions/draft-id/leaderboard",
      ),
    )
    expect(response.status).toBe(404)
    expect(statements).toHaveLength(1)
    expect(statements[0].params).toContain("published")
    expect(mocks.leaderboard).not.toHaveBeenCalled()
  })

  // @lat: [[gameday#Tests#Published schedule and announcement boundary]]
  it("filters unpublished heat/workout data and exposes only sent public announcements to spectators", async () => {
    rows.push([
      [
        "competition-1",
        "summit",
        "Summit",
        null,
        "2026-09-05",
        "2026-09-05",
        "America/Boise",
        "in-person",
        null,
        null,
        null,
        null,
        null,
      ],
    ])
    const response = await handleGameDayRequest(
      new Request(
        "https://wodsmith.com/api/gameday/v1/competitions/competition-1",
      ),
    )
    expect(response.status).toBe(200)
    expect(statements).toHaveLength(4)
    expect(statements[1].sql).toContain("schedulePublishedAt")
    expect(statements[1].sql).toContain("is not null")
    expect(statements[1].params).toContain("published")
    expect(statements[2].params).toContain("published")
    expect(statements[3].params).toContain("sent")
    expect(statements[3].params).toContain(JSON.stringify({ type: "public" }))
    expect(await response.json()).toMatchObject({ assignments: [] })
  })
  // @lat: [[gameday#Tests#Native leaderboard projection]]
  it("exposes only native leaderboard fields without internal identities or submission metadata", async () => {
    rows.push([["competition-1", "summit", "Summit", null, "2026-09-05", "2026-09-05", "America/Boise", "in-person", null, null, null, null, null]])
    const expected = {
      registrationId: "registration-1", athleteName: "Test Athlete",
      divisionId: "rx", divisionLabel: "RX", totalPoints: 100,
      overallRank: 1, teamName: null,
      eventResults: [{trackWorkoutId: "event-1", eventName: "Engine Room", rank: 1, formattedScore: "10:00"}],
    }
    mocks.leaderboard.mockResolvedValue({
      entries: [{...expected, userId: "internal-user", teamMembers: [{userId: "internal-teammate"}],
        eventResults: [{...expected.eventResults[0], rawScore: "600000", videoUrl: "https://private.example/video", reviewNotes: "Internal review"}]}],
      scoringConfig: {internal: true}, events: [{internal: true}],
    })
    const response = await handleGameDayRequest(new Request("https://wodsmith.com/api/gameday/v1/competitions/competition-1/leaderboard"))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({entries: [expected]})
  })

  // @lat: [[gameday#Tests#Division publication boundary]]
  it("scopes native standards to published events, competition divisions, and inherited event mappings", async () => {
    rows.push(
      [
        [
          "competition-1",
          "summit",
          "Summit",
          null,
          "2026-09-05",
          "2026-09-05",
          "America/Boise",
          "in-person",
          null,
          null,
          null,
          null,
          null,
          JSON.stringify({ divisions: { scalingGroupId: "group-1" } }),
        ],
      ],
      [],
      [
        [
          "event-child",
          "workout-1",
          "event-parent",
          "Engine Room",
          "Base instructions",
          "time",
          720,
          null,
          1,
        ],
      ],
      [
        ["rx", "RX"],
        ["scaled", "Scaled"],
      ],
      [
        ["workout-1", "rx", "24 kg kettlebell"],
        ["workout-1", "scaled", "16 kg kettlebell"],
      ],
      [["event-parent", "rx"]],
      [],
    )
    const response = await handleGameDayRequest(
      new Request(
        "https://wodsmith.com/api/gameday/v1/competitions/competition-1",
      ),
    )
    expect(response.status).toBe(200)
    const detail = await response.json()
    expect(detail).toHaveProperty("workouts.0.divisions", [
      { id: "rx", label: "RX", description: "24 kg kettlebell" },
    ])
    expect(detail).not.toHaveProperty("workouts.0.workoutId")
    expect(detail).not.toHaveProperty("competition.settings")
    expect(statements[2].params).toContain("published")
    expect(statements[3].params).toContain("group-1")
    expect(statements[4].params).toEqual(
      expect.arrayContaining(["workout-1", "rx", "scaled"]),
    )
    expect(statements[5].params).toEqual(["competition-1"])
  })

  // @lat: [[gameday#Tests#Session revocation boundary]]
  it("revokes only the validated bearer session and rejects anonymous revocation", async () => {
    const request = () =>
      new Request("https://wodsmith.com/api/gameday/v1/session", {
        method: "DELETE",
        body: JSON.stringify({ userId: "victim", sessionId: "other-device" }),
      })
    expect((await handleGameDayRequest(request())).status).toBe(401)
    expect(mocks.invalidate).not.toHaveBeenCalled()
    mocks.session.mockResolvedValue({
      id: "authenticated-session",
      userId: "athlete-123",
    })
    expect((await handleGameDayRequest(request())).status).toBe(200)
    expect(mocks.invalidate).toHaveBeenCalledExactlyOnceWith(
      "authenticated-session",
      "athlete-123",
    )
  })
})
