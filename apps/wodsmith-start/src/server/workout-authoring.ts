import "server-only"
import { and, eq, isNull, or } from "drizzle-orm"
import { getDb } from "@/db"
import {
  competitionGroupsTable,
  competitionsTable,
  movements,
  scalingGroupsTable,
  scalingLevelsTable,
  TEAM_PERMISSIONS,
  teamTable,
} from "@/db/schema"
import type { WorkoutAuthoringContext } from "@/lib/workout-authoring"
import { parseSeriesSettings } from "@/types/competitions"
import { getSessionFromCookie } from "@/utils/auth"
import { requireCohostPermission } from "@/utils/cohost-auth"
import { parseCompetitionSettings } from "@/utils/competition-settings"
import { requireTeamPermission } from "@/utils/team-auth"
import { requireTrainingAccess } from "./training"
import { requireWorkoutTeamWrite } from "./workout-import/access"

/** Resolve ownership and scaling from stored destination context, never client catalogs. */
export async function getWorkoutAuthoringCatalog(
  context: WorkoutAuthoringContext,
) {
  const session = await getSessionFromCookie()
  if (!session?.userId) throw new Error("Not authenticated")
  const db = getDb()
  let teamId: string
  let scalingGroupId: string | null = null
  if (context.kind === "competition") {
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, context.competitionId),
    })
    if (!competition) throw new Error("Competition unavailable")
    try {
      await requireTeamPermission(
        competition.organizingTeamId,
        TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
      )
    } catch (error) {
      if (!competition.competitionTeamId) throw error
      await requireCohostPermission(competition.competitionTeamId, "editEvents")
    }
    teamId = competition.organizingTeamId
    scalingGroupId =
      parseCompetitionSettings(competition.settings)?.divisions
        ?.scalingGroupId ?? null
  } else if (context.kind === "series") {
    const group = await db.query.competitionGroupsTable.findFirst({
      where: eq(competitionGroupsTable.id, context.groupId),
    })
    if (!group) throw new Error("Series unavailable")
    teamId = group.organizingTeamId
    await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)
    scalingGroupId = parseSeriesSettings(group.settings)?.scalingGroupId ?? null
  } else {
    teamId = context.teamId
    if (context.kind === "library")
      await requireWorkoutTeamWrite(
        session.userId,
        teamId,
        TEAM_PERMISSIONS.CREATE_COMPONENTS,
      )
    else
      await requireTrainingAccess(
        teamId,
        undefined,
        context.kind === "programming",
      )
    const team = await db.query.teamTable.findFirst({
      where: eq(teamTable.id, teamId),
    })
    scalingGroupId = team?.defaultScalingGroupId ?? null
  }
  // A stale/foreign default cannot make another team's data part of a prompt.
  if (scalingGroupId) {
    const group = await db.query.scalingGroupsTable.findFirst({
      where: and(
        eq(scalingGroupsTable.id, scalingGroupId),
        or(
          eq(scalingGroupsTable.teamId, teamId),
          and(
            isNull(scalingGroupsTable.teamId),
            eq(scalingGroupsTable.isSystem, true),
          ),
        ),
      ),
    })
    if (!group)
      throw new Error(
        "The destination scaling group is unavailable. Update its scaling settings first.",
      )
  }
  const [catalogMovements, levels] = await Promise.all([
    db
      .select({ id: movements.id, name: movements.name, type: movements.type })
      .from(movements),
    scalingGroupId
      ? db
          .select({
            id: scalingLevelsTable.id,
            label: scalingLevelsTable.label,
          })
          .from(scalingLevelsTable)
          .where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))
          .orderBy(scalingLevelsTable.position)
      : Promise.resolve([]),
  ])
  return { movements: catalogMovements, scalingGroupId, levels }
}
