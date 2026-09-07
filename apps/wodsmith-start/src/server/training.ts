import {
  movements,
  programmingTracksTable,
  scalingGroupsTable,
  TEAM_PERMISSIONS,
  teamMembershipTable,
  teamProgrammingTracksTable,
  teamRoleTable,
  teamTable,
  userTable,
} from "@repo/wodsmith-db/schema"
import {
  trainingCheersTable,
  trainingResultsTable,
  trainingSessionsTable,
} from "@repo/wodsmith-db/schemas/training"
import {
  and,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  or,
} from "drizzle-orm"
import { ulid } from "ulid"
import { FEATURES } from "@/config/features"
import { getDb } from "@/db"
import type {
  OwnTrainingResult,
  SaveTrainingDraftInput,
  SaveTrainingResultInput,
  TrainingContext,
  TrainingSession,
  TrainingTeam,
  TrainingTrack,
  TrainingWeek,
} from "@/lib/training/types"
import { hasFeature } from "@/server/entitlements"
import { validateWorkoutReferences } from "@/server/workout-import/persistence"
import { getSessionFromCookie } from "@/utils/auth"
import { getActiveTeamId } from "@/utils/team-auth"
import { getPublishedCrossFitDays } from "./crossfit-import"
import {
  assertTrainingRevision,
  normalizeTrainingResult,
  publicTrainingResult,
  publishedTrainingBlock,
  trainingContentSchema,
  trainingTimezone,
} from "./training-validation"

type TrainingDb = ReturnType<typeof getDb>
type TrainingTx = Parameters<Parameters<TrainingDb["transaction"]>[0]>[0]
type SessionRow = typeof trainingSessionsTable.$inferSelect
type ResultRow = typeof trainingResultsTable.$inferSelect

async function trainingUser(): Promise<string> {
  const session = await getSessionFromCookie()
  if (!session?.userId) throw new Error("NOT_AUTHORIZED: Sign in to train")
  return session.userId
}

async function trainingMemberships(userId: string, teamId?: string) {
  return getDb()
    .select({
      team: teamTable,
      membership: teamMembershipTable,
      role: teamRoleTable,
    })
    .from(teamMembershipTable)
    .innerJoin(teamTable, eq(teamMembershipTable.teamId, teamTable.id))
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
        inArray(teamTable.type, ["gym", "personal"]),
        teamId ? eq(teamTable.id, teamId) : undefined,
      ),
    )
}

function canProgramTraining(
  row: Awaited<ReturnType<typeof trainingMemberships>>[number],
): boolean {
  return row.membership.isSystemRole
    ? ["owner", "admin"].includes(row.membership.roleId)
    : !!row.role?.permissions.includes(TEAM_PERMISSIONS.MANAGE_PROGRAMMING)
}

async function eligibleTrainingTracks(
  teamId: string,
): Promise<TrainingTrack[]> {
  const rows = await getDb()
    .select({ track: programmingTracksTable })
    .from(programmingTracksTable)
    .leftJoin(
      teamProgrammingTracksTable,
      and(
        eq(teamProgrammingTracksTable.trackId, programmingTracksTable.id),
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
    .orderBy(programmingTracksTable.name)
  return rows.map(({ track }) => ({
    id: track.id,
    name: track.name,
    description: track.description,
  }))
}

export async function requireTrainingAccess(
  teamId: string,
  trackId?: string,
  programming = false,
) {
  const userId = await trainingUser()
  const memberships = await trainingMemberships(userId, teamId)
  if (!memberships.length)
    throw new Error("FORBIDDEN: Join this gym to access its training")
  if (!(await hasFeature(teamId, FEATURES.WORKOUT_TRACKING)))
    throw new Error("FORBIDDEN: Workout tracking is not enabled for this gym")
  if (programming && !memberships.some(canProgramTraining))
    throw new Error("FORBIDDEN: Programming permission is required")
  if (
    trackId &&
    !(await eligibleTrainingTracks(teamId)).some((t) => t.id === trackId)
  )
    throw new Error("FORBIDDEN: This track is not available to this gym")
  return { userId }
}

function trainingSession(row: SessionRow, coach: boolean): TrainingSession {
  return {
    id: row.id,
    teamId: row.teamId,
    trackId: row.trackId,
    trainingDate: row.trainingDate,
    timezone: row.timezone,
    revision: row.revision,
    publishedVersion: row.publishedVersion,
    draft: coach ? row.draft : null,
    published: row.published,
  }
}

async function findTrainingSession(sessionId: string): Promise<SessionRow> {
  const [row] = await getDb()
    .select()
    .from(trainingSessionsTable)
    .where(eq(trainingSessionsTable.id, sessionId))
    .limit(1)
  if (!row) throw new Error("NOT_FOUND: Training session not found")
  return row
}

async function lockTrainingSession(
  tx: TrainingTx,
  sessionId: string,
): Promise<SessionRow> {
  const [row] = await tx
    .select()
    .from(trainingSessionsTable)
    .where(eq(trainingSessionsTable.id, sessionId))
    .for("update")
  if (!row) throw new Error("NOT_FOUND: Training session not found")
  return row
}

function isDuplicateTrainingEntry(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } }
  return e.code === "ER_DUP_ENTRY" || e.cause?.code === "ER_DUP_ENTRY"
}

export async function getTrainingContext(): Promise<TrainingContext> {
  const userId = await trainingUser()
  const memberships = await trainingMemberships(userId)
  const teams: TrainingTeam[] = []
  for (const { team } of memberships) {
    if (
      teams.some((t) => t.id === team.id) ||
      !(await hasFeature(team.id, FEATURES.WORKOUT_TRACKING))
    )
      continue
    teams.push({
      id: team.id,
      name: team.isPersonalTeam ? "My training" : team.name,
      isPersonal: team.isPersonalTeam,
      timezone: trainingTimezone(team.settings),
      canProgram: memberships.some(
        (m) => m.team.id === team.id && canProgramTraining(m),
      ),
      tracks: await eligibleTrainingTracks(team.id),
    })
  }
  const activeTeamId = await getActiveTeamId()
  return {
    userId,
    activeTeamId: teams.some((t) => t.id === activeTeamId)
      ? activeTeamId
      : (teams[0]?.id ?? null),
    teams,
  }
}

async function trainingResultViews(
  rows: Array<{
    result: ResultRow
    session: SessionRow
    firstName: string | null
    lastName: string | null
  }>,
  userId: string,
  db: TrainingDb | TrainingTx = getDb(),
): Promise<OwnTrainingResult[]> {
  if (!rows.length) return []
  const cheers = await db
    .select()
    .from(trainingCheersTable)
    .where(
      inArray(
        trainingCheersTable.resultId,
        rows.map(({ result }) => result.id),
      ),
    )
  return rows.map(({ result, session, firstName, lastName }) => ({
    id: result.id,
    sessionId: result.sessionId,
    blockId: result.blockId,
    publishedVersion: result.publishedVersion,
    userId: result.userId,
    userName: [firstName, lastName].filter(Boolean).join(" ") || "Athlete",
    trainingDate: session.trainingDate,
    trackId: session.trackId,
    block: result.block,
    scoreValue: result.scoreValue,
    displayScore: result.displayScore,
    details: result.details,
    scaling: result.scaling,
    modification: result.modification,
    notes: result.notes,
    audience: result.audience,
    unit: result.unit,
    completed: result.completed,
    cheerCount: cheers.filter((c) => c.resultId === result.id).length,
    hasCheered: cheers.some(
      (c) => c.resultId === result.id && c.userId === userId,
    ),
  }))
}

export async function getTrainingWeek(input: {
  teamId: string
  trackId: string
  startDate: string
  mode: "athlete" | "coach"
}): Promise<TrainingWeek> {
  const { userId } = await requireTrainingAccess(
    input.teamId,
    input.trackId,
    input.mode === "coach",
  )
  const end = new Date(`${input.startDate}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 6)
  const sessions = await getDb()
    .select()
    .from(trainingSessionsTable)
    .where(
      and(
        eq(trainingSessionsTable.teamId, input.teamId),
        eq(trainingSessionsTable.trackId, input.trackId),
        gte(trainingSessionsTable.trainingDate, input.startDate),
        lte(trainingSessionsTable.trainingDate, end.toISOString().slice(0, 10)),
      ),
    )
    .orderBy(trainingSessionsTable.trainingDate)
  const providerDays = (
    await getPublishedCrossFitDays(getDb(), input.trackId, {
      startDate: input.startDate,
      endDate: end.toISOString().slice(0, 10),
    })
  ).filter(
    (day) =>
      !sessions.some(
        (session) =>
          session.trainingDate === day.date && session.published !== null,
      ),
  )
  if (!sessions.length)
    return { sessions: [], myResults: [], teamResults: [], providerDays }
  const rows = await getDb()
    .select({
      result: trainingResultsTable,
      session: trainingSessionsTable,
      firstName: userTable.firstName,
      lastName: userTable.lastName,
    })
    .from(trainingResultsTable)
    .innerJoin(
      trainingSessionsTable,
      eq(trainingSessionsTable.id, trainingResultsTable.sessionId),
    )
    .innerJoin(userTable, eq(userTable.id, trainingResultsTable.userId))
    .where(
      and(
        inArray(
          trainingResultsTable.sessionId,
          sessions.map((s) => s.id),
        ),
        or(
          eq(trainingResultsTable.userId, userId),
          and(
            eq(trainingResultsTable.audience, "gym"),
            eq(
              trainingResultsTable.publishedVersion,
              trainingSessionsTable.publishedVersion,
            ),
          ),
        ),
      ),
    )
  // Keep earlier own results, but never return versions newer than the fetched session snapshot.
  const versions = new Map(sessions.map((s) => [s.id, s.publishedVersion]))
  const results = await trainingResultViews(
    rows.filter(
      ({ result }) =>
        result.publishedVersion <= (versions.get(result.sessionId) ?? 0),
    ),
    userId,
  )
  return {
    providerDays,
    sessions: sessions
      .filter((s) => input.mode === "coach" || s.published !== null)
      .map((s) => trainingSession(s, input.mode === "coach")),
    myResults: results.filter((r) => r.userId === userId),
    teamResults: results.flatMap((r) => {
      if (r.publishedVersion !== versions.get(r.sessionId)) return []
      const publicResult = publicTrainingResult(r)
      return publicResult ? [publicResult] : []
    }),
  }
}

export async function saveTrainingDraft(
  input: SaveTrainingDraftInput,
): Promise<TrainingSession> {
  await requireTrainingAccess(input.teamId, input.trackId, true)
  const content = trainingContentSchema.parse(input.content)
  const db = getDb()
  try {
    return await db.transaction(async (tx) => {
      for (const block of content.blocks)
        if (block.workout)
          await validateWorkoutReferences(tx, block.workout, input.teamId)
      const [existing] = await tx
        .select()
        .from(trainingSessionsTable)
        .where(
          and(
            eq(trainingSessionsTable.teamId, input.teamId),
            eq(trainingSessionsTable.trackId, input.trackId),
            eq(trainingSessionsTable.trainingDate, input.trainingDate),
          ),
        )
        .for("update")
      assertTrainingRevision(existing?.revision ?? 0, input.expectedRevision)
      if (!existing) {
        const id = `trs_${ulid()}`
        await tx.insert(trainingSessionsTable).values({
          id,
          teamId: input.teamId,
          trackId: input.trackId,
          trainingDate: input.trainingDate,
          timezone: input.timezone,
          draft: content,
        })
        return trainingSession(await lockTrainingSession(tx, id), true)
      }
      if (existing.publishedVersion > 0 && input.timezone !== existing.timezone)
        throw new Error("The timezone of a published session cannot be changed")
      await tx
        .update(trainingSessionsTable)
        .set({
          draft: content,
          timezone: input.timezone,
          revision: existing.revision + 1,
        })
        .where(
          and(
            eq(trainingSessionsTable.id, existing.id),
            eq(trainingSessionsTable.revision, input.expectedRevision),
          ),
        )
      return trainingSession(await lockTrainingSession(tx, existing.id), true)
    })
  } catch (error) {
    if (isDuplicateTrainingEntry(error))
      throw new Error(
        "CONFLICT: A session was created for this day. Reload before saving.",
      )
    throw error
  }
}

export async function publishTrainingSession(input: {
  sessionId: string
  expectedRevision: number
}): Promise<TrainingSession> {
  const session = await findTrainingSession(input.sessionId)
  await requireTrainingAccess(session.teamId, session.trackId, true)
  return getDb().transaction(async (tx) => {
    const current = await lockTrainingSession(tx, input.sessionId)
    assertTrainingRevision(current.revision, input.expectedRevision)
    if (!current.draft) throw new Error("There is no draft to publish")
    const content = trainingContentSchema.parse(current.draft)
    for (const block of content.blocks)
      if (block.workout)
        await validateWorkoutReferences(tx, block.workout, current.teamId)
    if (!content.title || content.blocks.some((block) => !block.title))
      throw new Error(
        "Give the session and each block a title before publishing",
      )
    if (content.blocks.some((block) => !block.prescription.trim()))
      throw new Error("Give each block a prescription before publishing")
    if (!content.isRestDay && !content.blocks.length)
      throw new Error(
        "Add a training block or mark this as a rest day before publishing",
      )
    await tx
      .update(trainingSessionsTable)
      .set({
        published: content,
        draft: null,
        publishedVersion: current.publishedVersion + 1,
        revision: current.revision + 1,
      })
      .where(
        and(
          eq(trainingSessionsTable.id, current.id),
          eq(trainingSessionsTable.revision, input.expectedRevision),
        ),
      )
    return trainingSession(await lockTrainingSession(tx, current.id), true)
  })
}

export async function copyTrainingSession(input: {
  sessionId: string
  targetDate: string
  targetTrackId: string
  expectedRevision: number
}): Promise<TrainingSession> {
  const source = await findTrainingSession(input.sessionId)
  await requireTrainingAccess(source.teamId, source.trackId, true)
  await requireTrainingAccess(source.teamId, input.targetTrackId, true)
  try {
    return await getDb().transaction(async (tx) => {
      const current = await lockTrainingSession(tx, input.sessionId)
      assertTrainingRevision(current.revision, input.expectedRevision)
      const content = current.draft ?? current.published
      if (!content) throw new Error("There is no session content to copy")
      const [occupied] = await tx
        .select({ id: trainingSessionsTable.id })
        .from(trainingSessionsTable)
        .where(
          and(
            eq(trainingSessionsTable.teamId, source.teamId),
            eq(trainingSessionsTable.trackId, input.targetTrackId),
            eq(trainingSessionsTable.trainingDate, input.targetDate),
          ),
        )
      if (occupied)
        throw new Error("CONFLICT: The destination already has a session")
      const id = `trs_${ulid()}`
      await tx.insert(trainingSessionsTable).values({
        id,
        teamId: source.teamId,
        trackId: input.targetTrackId,
        trainingDate: input.targetDate,
        timezone: current.timezone,
        draft: {
          ...content,
          blocks: content.blocks.map((b) => ({ ...b, id: `trb_${ulid()}` })),
        },
      })
      return trainingSession(await lockTrainingSession(tx, id), true)
    })
  } catch (error) {
    if (isDuplicateTrainingEntry(error))
      throw new Error("CONFLICT: The destination already has a session")
    throw error
  }
}

export async function saveTrainingResult(
  input: SaveTrainingResultInput,
): Promise<OwnTrainingResult> {
  const session = await findTrainingSession(input.sessionId)
  const { userId } = await requireTrainingAccess(
    session.teamId,
    session.trackId,
  )
  return getDb().transaction(async (tx) => {
    // All result writers and publishers lock the same occurrence before checking its version.
    const current = await lockTrainingSession(tx, input.sessionId)
    const block = publishedTrainingBlock(trainingSession(current, false), input)
    const normalized = normalizeTrainingResult(block, input)
    const values = {
      block,
      ...normalized,
      details: normalized.details ?? null,
      scaling: input.scaling,
      modification: input.modification,
      notes: input.notes,
      unit: input.unit,
      completed: input.completed,
    }
    await tx
      .insert(trainingResultsTable)
      .values({
        id: `trr_${ulid()}`,
        sessionId: current.id,
        blockId: block.id,
        userId,
        publishedVersion: current.publishedVersion,
        ...values,
      })
      .onDuplicateKeyUpdate({ set: values })
    const [result] = await tx
      .select()
      .from(trainingResultsTable)
      .where(
        and(
          eq(trainingResultsTable.sessionId, current.id),
          eq(trainingResultsTable.blockId, block.id),
          eq(trainingResultsTable.userId, userId),
          eq(trainingResultsTable.publishedVersion, current.publishedVersion),
        ),
      )
    if (!result) throw new Error("Could not save this result")
    if (result.audience === "private")
      await tx
        .delete(trainingCheersTable)
        .where(eq(trainingCheersTable.resultId, result.id))
    const [user] = await tx
      .select({ firstName: userTable.firstName, lastName: userTable.lastName })
      .from(userTable)
      .where(eq(userTable.id, userId))
    return (
      await trainingResultViews(
        [
          {
            result,
            session: current,
            firstName: user?.firstName ?? null,
            lastName: user?.lastName ?? null,
          },
        ],
        userId,
        tx,
      )
    )[0]
  })
}

export async function setTrainingCheer(input: {
  resultId: string
  cheered: boolean
}): Promise<{ success: true }> {
  const [target] = await getDb()
    .select({ session: trainingSessionsTable })
    .from(trainingResultsTable)
    .innerJoin(
      trainingSessionsTable,
      eq(trainingSessionsTable.id, trainingResultsTable.sessionId),
    )
    .where(eq(trainingResultsTable.id, input.resultId))
    .limit(1)
  if (!target) throw new Error("NOT_FOUND: Result not found")
  const { userId } = await requireTrainingAccess(
    target.session.teamId,
    target.session.trackId,
  )
  return getDb().transaction(async (tx) => {
    const session = await lockTrainingSession(tx, target.session.id)
    const [result] = await tx
      .select()
      .from(trainingResultsTable)
      .where(eq(trainingResultsTable.id, input.resultId))
      .for("update")
    if (
      !result ||
      result.audience !== "gym" ||
      result.publishedVersion !== session.publishedVersion ||
      result.block.kind === "check" ||
      result.block.kind === "note"
    )
      throw new Error("NOT_FOUND: This result is not shared with the gym")
    if (result.userId === userId)
      throw new Error("You cannot cheer your own result")
    if (input.cheered)
      await tx
        .insert(trainingCheersTable)
        .values({ resultId: result.id, userId })
        .onDuplicateKeyUpdate({ set: { userId } })
    else
      await tx
        .delete(trainingCheersTable)
        .where(
          and(
            eq(trainingCheersTable.resultId, result.id),
            eq(trainingCheersTable.userId, userId),
          ),
        )
    return { success: true }
  })
}

export async function getTrainingHistory(input: {
  teamId: string
  trackId: string
}): Promise<OwnTrainingResult[]> {
  const { userId } = await requireTrainingAccess(input.teamId, input.trackId)
  const rows = await getDb()
    .select({
      result: trainingResultsTable,
      session: trainingSessionsTable,
      firstName: userTable.firstName,
      lastName: userTable.lastName,
    })
    .from(trainingResultsTable)
    .innerJoin(
      trainingSessionsTable,
      eq(trainingSessionsTable.id, trainingResultsTable.sessionId),
    )
    .innerJoin(userTable, eq(userTable.id, trainingResultsTable.userId))
    .where(
      and(
        eq(trainingSessionsTable.teamId, input.teamId),
        eq(trainingSessionsTable.trackId, input.trackId),
        eq(trainingResultsTable.userId, userId),
      ),
    )
    .orderBy(
      desc(trainingSessionsTable.trainingDate),
      desc(trainingResultsTable.updatedAt),
    )
    .limit(100)
  return trainingResultViews(rows, userId)
}

export async function getTrainingWorkoutOptions(input: { teamId: string }) {
  await requireTrainingAccess(input.teamId, undefined, true)
  const db = getDb()
  const [movementOptions, scalingGroups] = await Promise.all([
    db
      .select({ id: movements.id, name: movements.name, type: movements.type })
      .from(movements)
      .orderBy(movements.name),
    db
      .select({ id: scalingGroupsTable.id, title: scalingGroupsTable.title })
      .from(scalingGroupsTable)
      .where(
        or(
          eq(scalingGroupsTable.teamId, input.teamId),
          and(
            isNull(scalingGroupsTable.teamId),
            eq(scalingGroupsTable.isSystem, true),
          ),
        ),
      )
      .orderBy(scalingGroupsTable.title),
  ])
  return { movements: movementOptions, scalingGroups }
}
