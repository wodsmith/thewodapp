import "server-only"
import { and, eq, gt, isNull, or } from "drizzle-orm"
import { FEATURES } from "@/config/features"
import { type Database, getDb } from "@/db"
import {
  featureTable,
  planFeatureTable,
  programmingTracksTable,
  SYSTEM_ROLES_ENUM,
  TEAM_PERMISSIONS,
  teamEntitlementOverrideTable,
  teamFeatureEntitlementTable,
  teamMembershipTable,
  teamRoleTable,
  teamTable,
  userTable,
} from "@/db/schema"
import { CROSSFIT_TRACK_ID } from "@/lib/crossfit/source"
import {
  type WorkoutImportAccess,
  type WorkoutImportDestination,
  workoutImportDestinationSchema,
} from "@/lib/workout-import"

export type WorkoutImportDatabase = Pick<
  Database,
  "query" | "select" | "insert" | "update" | "delete"
>
export class WorkoutImportAccessError extends Error {
  constructor() {
    super("Workout import access required")
    this.name = "WorkoutImportAccessError"
  }
}

/** Fresh reads of the same catalog/snapshot/override records used by admin grants.
 * An inactive/expired explicit snapshot never resurrects through plan fallback.
 * Authorization must use an uncached DB connection (including inside the DO).
 */
export async function hasCurrentWorkoutFeature(
  db: WorkoutImportDatabase,
  teamId: string,
  key: string,
  now = new Date(),
): Promise<boolean> {
  const feature = await db.query.featureTable.findFirst({
    where: and(eq(featureTable.key, key), eq(featureTable.isActive, 1)),
  })
  if (!feature) return false
  const override = await db.query.teamEntitlementOverrideTable.findFirst({
    where: and(
      eq(teamEntitlementOverrideTable.teamId, teamId),
      eq(teamEntitlementOverrideTable.type, "feature"),
      eq(teamEntitlementOverrideTable.key, key),
      or(
        isNull(teamEntitlementOverrideTable.expiresAt),
        gt(teamEntitlementOverrideTable.expiresAt, now),
      ),
    ),
  })
  // Existing admin revocation takes precedence over a stale positive override.
  const snapshot = await db.query.teamFeatureEntitlementTable.findFirst({
    where: and(
      eq(teamFeatureEntitlementTable.teamId, teamId),
      eq(teamFeatureEntitlementTable.featureId, feature.id),
    ),
  })
  if (
    snapshot &&
    (snapshot.isActive !== 1 ||
      (snapshot.expiresAt && snapshot.expiresAt <= now))
  )
    return false
  if (override) return override.value === "true" || override.value === "1"
  if (snapshot) return true
  const team = await db.query.teamTable.findFirst({
    where: eq(teamTable.id, teamId),
  })
  if (!team) return false
  const planGrant = await db.query.planFeatureTable.findFirst({
    where: and(
      eq(planFeatureTable.planId, team.currentPlanId ?? "free"),
      eq(planFeatureTable.featureId, feature.id),
    ),
  })
  return !!planGrant
}

export async function requireWorkoutTeamWrite(
  userId: string,
  teamId: string,
  permission: string,
  db: WorkoutImportDatabase = getDb(),
): Promise<void> {
  const now = new Date()
  const user = await db.query.userTable.findFirst({
    where: eq(userTable.id, userId),
    columns: { id: true },
  })
  if (!user) throw new WorkoutImportAccessError()
  const membership = await db.query.teamMembershipTable.findFirst({
    where: and(
      eq(teamMembershipTable.userId, userId),
      eq(teamMembershipTable.teamId, teamId),
      eq(teamMembershipTable.isActive, true),
      or(
        isNull(teamMembershipTable.expiresAt),
        gt(teamMembershipTable.expiresAt, now),
      ),
    ),
  })
  if (!membership) throw new WorkoutImportAccessError()
  if (membership.isSystemRole) {
    if (
      membership.roleId === SYSTEM_ROLES_ENUM.OWNER ||
      membership.roleId === SYSTEM_ROLES_ENUM.ADMIN
    )
      return
    throw new WorkoutImportAccessError()
  }
  const role = await db.query.teamRoleTable.findFirst({
    where: and(
      eq(teamRoleTable.id, membership.roleId),
      eq(teamRoleTable.teamId, teamId),
    ),
  })
  if (!role?.permissions.includes(permission))
    throw new WorkoutImportAccessError()
}

export async function requireWorkoutDestinationWrite(
  input: { userId: string; destination: WorkoutImportDestination },
  db: WorkoutImportDatabase = getDb(),
): Promise<WorkoutImportAccess> {
  const destination = workoutImportDestinationSchema.parse(input.destination)
  let teamId: string
  if (destination.kind === "personal") {
    const team = await db.query.teamTable.findFirst({
      where: and(
        eq(teamTable.personalTeamOwnerId, input.userId),
        eq(teamTable.isPersonalTeam, true),
      ),
    })
    if (!team) throw new WorkoutImportAccessError()
    teamId = team.id
  } else {
    if (destination.trackId === CROSSFIT_TRACK_ID)
      throw new WorkoutImportAccessError()
    const track = await db.query.programmingTracksTable.findFirst({
      where: eq(programmingTracksTable.id, destination.trackId),
    })
    if (!track?.ownerTeamId || track.competitionId)
      throw new WorkoutImportAccessError()
    teamId = track.ownerTeamId
  }
  await requireWorkoutTeamWrite(
    input.userId,
    teamId,
    destination.kind === "track"
      ? TEAM_PERMISSIONS.MANAGE_PROGRAMMING
      : TEAM_PERMISSIONS.CREATE_COMPONENTS,
    db,
  )
  if (!(await hasCurrentWorkoutFeature(db, teamId, FEATURES.WORKOUT_TRACKING)))
    throw new WorkoutImportAccessError()
  return { userId: input.userId, teamId, destination }
}

// @lat: [[workout-import#Workout Import#Authorization]]
export async function requireWorkoutImportAccess(
  input: { userId: string; destination: WorkoutImportDestination },
  db?: WorkoutImportDatabase,
): Promise<WorkoutImportAccess> {
  try {
    if (!db)
      return await getDb().transaction(
        (tx) => requireWorkoutImportAccess(input, tx),
        { isolationLevel: "read committed" },
      )
    const scope = await requireWorkoutDestinationWrite(input, db)
    if (
      !(await hasCurrentWorkoutFeature(
        db,
        scope.teamId,
        FEATURES.AI_WORKOUT_IMPORT,
      ))
    )
      throw new WorkoutImportAccessError()
    return scope
  } catch {
    // Infrastructure failures cannot turn into permissive access responses.
    throw new WorkoutImportAccessError()
  }
}
