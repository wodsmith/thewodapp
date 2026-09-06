import { createServerFn } from "@tanstack/react-start"
import { and, eq, gt, inArray, isNull, ne, or } from "drizzle-orm"
import { z } from "zod"
import { FEATURES } from "@/config/features"
import { getDb } from "@/db"
import {
  programmingTracksTable,
  TEAM_PERMISSIONS,
  teamMembershipTable,
  teamProgrammingTracksTable,
  teamRoleTable,
  teamTable,
} from "@/db/schema"
import { hasFeature } from "@/server/entitlements"
import { getSessionFromCookie } from "@/utils/auth"

async function followUser() {
  const session = await getSessionFromCookie()
  if (!session?.userId) throw new Error("Sign in to follow tracks")
  return session.userId
}
async function ownedPersonalWorkspace(userId: string) {
  return getDb().query.teamTable.findFirst({
    where: and(
      eq(teamTable.isPersonalTeam, true),
      eq(teamTable.personalTeamOwnerId, userId),
    ),
  })
}
async function eligibleGyms(userId: string) {
  const rows = await getDb()
    .select({
      team: teamTable,
      membership: teamMembershipTable,
      role: teamRoleTable,
    })
    .from(teamMembershipTable)
    .innerJoin(teamTable, eq(teamTable.id, teamMembershipTable.teamId))
    .leftJoin(
      teamRoleTable,
      and(
        eq(teamRoleTable.id, teamMembershipTable.roleId),
        eq(teamRoleTable.teamId, teamTable.id),
      ),
    )
    .where(
      and(
        eq(teamMembershipTable.userId, userId),
        eq(teamMembershipTable.isActive, true),
        or(
          isNull(teamMembershipTable.expiresAt),
          gt(teamMembershipTable.expiresAt, new Date()),
        ),
        eq(teamTable.type, "gym"),
        eq(teamTable.isPersonalTeam, false),
      ),
    )
  const gyms = []
  for (const row of rows) {
    const allowed = row.membership.isSystemRole
      ? ["owner", "admin"].includes(row.membership.roleId)
      : row.role?.permissions.includes(TEAM_PERMISSIONS.MANAGE_PROGRAMMING)
    if (allowed && (await hasFeature(row.team.id, FEATURES.WORKOUT_TRACKING)))
      gyms.push({ id: row.team.id, name: row.team.name })
  }
  return gyms
}
async function assertFollowable(trackId: string) {
  const track = await getDb().query.programmingTracksTable.findFirst({
    where: eq(programmingTracksTable.id, trackId),
  })
  if (
    !track ||
    !track.isPublic ||
    track.competitionId ||
    track.type === "series-template"
  )
    throw new Error("This track is not available to follow")
  return track
}
async function setAssociation(
  teamId: string,
  trackId: string,
  active: boolean,
) {
  if (!active) {
    await getDb()
      .update(teamProgrammingTracksTable)
      .set({ isActive: 0 })
      .where(
        and(
          eq(teamProgrammingTracksTable.teamId, teamId),
          eq(teamProgrammingTracksTable.trackId, trackId),
        ),
      )
    return
  }
  await getDb()
    .insert(teamProgrammingTracksTable)
    .values({ teamId, trackId, isActive: active ? 1 : 0 })
    .onDuplicateKeyUpdate({ set: { isActive: active ? 1 : 0 } })
}
export const getTrackFollowStateFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ trackId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const userId = await followUser()
    const personal = await ownedPersonalWorkspace(userId)
    const gyms = await eligibleGyms(userId)
    const track = await getDb().query.programmingTracksTable.findFirst({
      where: eq(programmingTracksTable.id, data.trackId),
    })
    const teamIds = [
      ...(personal ? [personal.id] : []),
      ...gyms.map((gym) => gym.id),
    ]
    const associations = teamIds.length
      ? await getDb()
          .select()
          .from(teamProgrammingTracksTable)
          .where(
            and(
              eq(teamProgrammingTracksTable.trackId, data.trackId),
              eq(teamProgrammingTracksTable.isActive, 1),
              inArray(teamProgrammingTracksTable.teamId, teamIds),
            ),
          )
      : []
    const membership = personal
      ? await getDb().query.teamMembershipTable.findFirst({
          where: and(
            eq(teamMembershipTable.teamId, personal.id),
            eq(teamMembershipTable.userId, userId),
            eq(teamMembershipTable.isActive, true),
            or(
              isNull(teamMembershipTable.expiresAt),
              gt(teamMembershipTable.expiresAt, new Date()),
            ),
          ),
        })
      : null
    return {
      personalTeamId: personal?.id ?? null,
      following:
        !!personal && associations.some((a) => a.teamId === personal.id),
      trainingAvailable:
        !!personal &&
        !!membership &&
        (await hasFeature(personal.id, FEATURES.WORKOUT_TRACKING)),
      gyms: gyms.map((gym) => ({
        ...gym,
        added:
          track?.ownerTeamId === gym.id ||
          associations.some((a) => a.teamId === gym.id),
      })),
    }
  })
export const followTrackFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ trackId: z.string().min(1), following: z.boolean() }).strict(),
  )
  .handler(async ({ data }) => {
    const userId = await followUser()
    const personal = await ownedPersonalWorkspace(userId)
    if (!personal)
      throw new Error(
        "Your personal workspace is unavailable. Open account settings to finish setup.",
      )
    if (data.following) await assertFollowable(data.trackId)
    await setAssociation(personal.id, data.trackId, data.following)
    return { teamId: personal.id }
  })
export const addTrackToGymFn = createServerFn({ method: "POST" })
  .inputValidator(
    z
      .object({ trackId: z.string().min(1), teamId: z.string().min(1) })
      .strict(),
  )
  .handler(async ({ data }) => {
    const userId = await followUser()
    if (!(await eligibleGyms(userId)).some((gym) => gym.id === data.teamId))
      throw new Error(
        "Programming permission and live gym training access are required",
      )
    const track = await assertFollowable(data.trackId)
    if (track.ownerTeamId !== data.teamId)
      await setAssociation(data.teamId, data.trackId, true)
    return { teamId: data.teamId }
  })

export const getMyTrackLibrariesFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const userId = await followUser()
    const personal = await ownedPersonalWorkspace(userId)
    const gyms = await eligibleGyms(userId)
    async function tracks(teamId: string) {
      return getDb()
        .select({
          id: programmingTracksTable.id,
          name: programmingTracksTable.name,
          description: programmingTracksTable.description,
        })
        .from(programmingTracksTable)
        .leftJoin(
          teamProgrammingTracksTable,
          and(
            eq(programmingTracksTable.id, teamProgrammingTracksTable.trackId),
            eq(teamProgrammingTracksTable.teamId, teamId),
            eq(teamProgrammingTracksTable.isActive, 1),
          ),
        )
        .where(
          and(
            isNull(programmingTracksTable.competitionId),
            ne(programmingTracksTable.type, "series-template"),
            or(
              eq(programmingTracksTable.ownerTeamId, teamId),
              eq(teamProgrammingTracksTable.teamId, teamId),
            ),
          ),
        )
    }
    return {
      personal: personal
        ? { id: personal.id, tracks: await tracks(personal.id) }
        : null,
      gyms: await Promise.all(
        gyms.map(async (gym) => ({ ...gym, tracks: await tracks(gym.id) })),
      ),
    }
  },
)

export const getBrowseTracksFn = createServerFn({ method: "GET" }).handler(
  async () => {
    await followUser()
    return getDb()
      .select({
        id: programmingTracksTable.id,
        name: programmingTracksTable.name,
        description: programmingTracksTable.description,
      })
      .from(programmingTracksTable)
      .where(
        and(
          eq(programmingTracksTable.isPublic, 1),
          isNull(programmingTracksTable.competitionId),
          ne(programmingTracksTable.type, "series-template"),
        ),
      )
      .orderBy(programmingTracksTable.name)
  },
)
