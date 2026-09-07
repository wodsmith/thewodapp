import { createWodsmithDb, type WodsmithDb } from "@repo/wodsmith-db/mysql"
import {
  programmingTracksTable,
  teamTable,
  teamRoleTable,
  teamMembershipTable,
  teamProgrammingTracksTable,
} from "@repo/wodsmith-db/schema"
import mysql from "mysql2"
import { eq, inArray } from "drizzle-orm"
import { beforeAll, afterAll, afterEach, it, expect, vi, describe } from "vitest"
const state = vi.hoisted(() => ({
  db: null as unknown,
  userId: "follow_user",
  feature: true,
}))
vi.mock("@/db", () => ({ getDb: () => state.db }))
vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: async () => ({
    userId: state.userId,
    user: { role: "admin" },
  }),
}))
vi.mock("@/server/entitlements", () => ({
  hasFeature: async () => state.feature,
}))
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (schema: { parse: (value: unknown) => unknown }) => ({
      handler:
        (fn: (ctx: { data: unknown }) => unknown) => (ctx: { data: unknown }) =>
          fn({ data: schema.parse(ctx.data) }),
    }),
    handler: (fn: () => unknown) => fn,
  }),
}))
import {
  followTrackFn,
  getTrackFollowStateFn,
  addTrackToGymFn,
  getMyTrackLibrariesFn,
} from "@/server-fns/track-follow-fns"
const databaseUrl = process.env.TRAINING_TEST_DATABASE_URL
const teams = [
  "follow_personal",
  "follow_gym",
  "follow_event",
  "follow_expired",
]
describe.skipIf(!databaseUrl)("track follow authorization", () => {
  afterEach(() => {
    state.feature = true
  })
  let pool: ReturnType<typeof mysql.createPool>
  let db: WodsmithDb
  beforeAll(async () => {
    if (!databaseUrl) throw new Error("Disposable database required")
    const url = new URL(databaseUrl)
    if (
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      url.pathname !== "/training_test"
    )
      throw new Error("Use local training_test")
    pool = mysql.createPool(databaseUrl)
    db = createWodsmithDb(pool)
    state.db = db
    await db.insert(teamTable).values([
      {
        id: teams[0],
        name: "Personal",
        slug: teams[0],
        isPersonalTeam: true,
        personalTeamOwnerId: state.userId,
      },
      { id: teams[1], name: "Gym", slug: teams[1], type: "gym" },
      {
        id: teams[2],
        name: "Event",
        slug: teams[2],
        type: "competition_event",
      },
      { id: teams[3], name: "Expired", slug: teams[3], type: "gym" },
    ])
    await db.insert(teamMembershipTable).values(
      teams.map((teamId, index) => ({
        id: `follow_member_${index}`,
        teamId,
        userId: state.userId,
        roleId: "owner",
        isSystemRole: true,
        expiresAt: index === 3 ? new Date("2020-01-01") : null,
      })),
    )
    await db.insert(programmingTracksTable).values({
      id: "follow_track",
      name: "Public track",
      type: "team_owned",
      ownerTeamId: teams[1],
      isPublic: 1,
    })
  })
  afterAll(async () => {
    if (!pool) return
    await db
      .delete(teamProgrammingTracksTable)
      .where(inArray(teamProgrammingTracksTable.teamId, teams))
    await db
      .delete(programmingTracksTable)
      .where(eq(programmingTracksTable.id, "follow_track"))
    await db
      .delete(teamMembershipTable)
      .where(inArray(teamMembershipTable.teamId, teams))
    await db.delete(teamRoleTable).where(eq(teamRoleTable.id, "follow_coach"))
    await db.delete(teamTable).where(inArray(teamTable.id, teams))
    await pool.promise().end()
  })
  // @lat: [[training#Provider Verification#Personal and gym authorization]]
  it("resolves personal ownership and filters event and expired gyms even for site admin", async () => {
    const state = await getTrackFollowStateFn({
      data: { trackId: "follow_track" },
    })
    expect(state.personalTeamId).toBe("follow_personal")
    expect(state.gyms).toEqual([{ id: "follow_gym", name: "Gym", added: true }])
    await expect(
      addTrackToGymFn({
        data: { trackId: "follow_track", teamId: "follow_event" },
      }),
    ).rejects.toThrow("Programming permission")
    await expect(
      addTrackToGymFn({
        data: { trackId: "follow_track", teamId: "follow_expired" },
      }),
    ).rejects.toThrow("Programming permission")
    expect(() =>
      followTrackFn({
        data: {
          trackId: "follow_track",
          following: true,
          teamId: "forged",
        } as never,
      }),
    ).toThrow()
    expect(
      (await getMyTrackLibrariesFn()).gyms[0].tracks.map((track) => track.id),
    ).toEqual(["follow_track"])
  })
  it("follows idempotently without entitlement grants and unfollows without creating orphan rows", async () => {
    state.feature = false
    await followTrackFn({ data: { trackId: "follow_track", following: true } })
    await followTrackFn({ data: { trackId: "follow_track", following: true } })
    expect(
      await db
        .select()
        .from(teamProgrammingTracksTable)
        .where(eq(teamProgrammingTracksTable.teamId, "follow_personal")),
    ).toHaveLength(1)
    expect(
      (await getTrackFollowStateFn({ data: { trackId: "follow_track" } }))
        .trainingAvailable,
    ).toBe(false)
    await followTrackFn({ data: { trackId: "follow_track", following: false } })
    await followTrackFn({ data: { trackId: "missing", following: false } })
    expect(
      (await getTrackFollowStateFn({ data: { trackId: "follow_track" } }))
        .following,
    ).toBe(false)
    expect(
      await db
        .select()
        .from(teamProgrammingTracksTable)
        .where(eq(teamProgrammingTracksTable.trackId, "missing")),
    ).toHaveLength(0)
  })
  it("does not grant Training when owned membership expires", async () => {
    await db
      .update(teamMembershipTable)
      .set({ expiresAt: new Date("2020-01-01") })
      .where(eq(teamMembershipTable.id, "follow_member_0"))
    expect(
      (await getTrackFollowStateFn({ data: { trackId: "follow_track" } }))
        .trainingAvailable,
    ).toBe(false)
  })
  it("requires live programming permission for ordinary members and custom roles", async () => {
    await db
      .update(teamMembershipTable)
      .set({ roleId: "member", isSystemRole: true })
      .where(eq(teamMembershipTable.id, "follow_member_1"))
    expect(
      (await getTrackFollowStateFn({ data: { trackId: "follow_track" } })).gyms,
    ).toEqual([])
    await expect(
      addTrackToGymFn({
        data: { trackId: "follow_track", teamId: "follow_gym" },
      }),
    ).rejects.toThrow("Programming permission")
    await db
      .insert(teamRoleTable)
      .values({
        id: "follow_coach",
        teamId: "follow_gym",
        name: "Programming coach",
        permissions: ["manage_programming"],
      })
    await db
      .update(teamMembershipTable)
      .set({ roleId: "follow_coach", isSystemRole: false })
      .where(eq(teamMembershipTable.id, "follow_member_1"))
    expect(
      (
        await getTrackFollowStateFn({ data: { trackId: "follow_track" } })
      ).gyms.map((gym) => gym.id),
    ).toEqual(["follow_gym"])
    await db
      .update(teamMembershipTable)
      .set({ isActive: false })
      .where(eq(teamMembershipTable.id, "follow_member_1"))
    await expect(
      addTrackToGymFn({
        data: { trackId: "follow_track", teamId: "follow_gym" },
      }),
    ).rejects.toThrow("Programming permission")
  })
})
