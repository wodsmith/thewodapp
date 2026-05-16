/**
 * Server functions backing the AI judge-scheduling page.
 *
 * - `loadAiSchedulingContextFn`: initial page data (DTOs identical to what the
 *   agent sees, so the UI and the agent agree on heats/judges/rotations).
 * - `applyAiProposalsFn`: convert accepted proposals to real
 *   competition_judge_rotations rows. The user still presses "Publish
 *   Rotations" on the existing rotation-timeline screen to materialize the
 *   judge_heat_assignments — we deliberately don't bypass that step.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { FEATURES } from "@/config/features"
import { getDb } from "@/db"
import type { CompetitionJudgeRotation } from "@/db/schema"
import {
  competitionJudgeRotationsTable,
  competitionsTable,
  programmingTracksTable,
  teamMembershipTable,
  trackWorkoutsTable,
} from "@/db/schema"
import { createJudgeRotationId } from "@/db/schemas/common"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import {
  type EventContextDto,
  type JudgeRosterEntry,
  type PriorRotationExample,
  type ProposedRotation,
  proposedRotationSchema,
} from "@/lib/judge-scheduler/schemas"
import { proposalsToRotationInserts } from "@/lib/judge-scheduler/tools"
import { hasFeature } from "@/server/entitlements"
import {
  loadEventContext,
  loadJudgeRoster,
  loadPriorRotations,
} from "@/server/judge-scheduler/context"
import { requireTeamPermission } from "@/utils/team-auth"

const loadContextSchema = z.object({
  trackWorkoutId: z.string().min(1),
  competitionId: z.string().min(1),
  teamId: z.string().min(1),
})

const applyProposalsSchema = z.object({
  teamId: z.string().min(1),
  competitionId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
  proposals: z.array(proposedRotationSchema).min(1).max(100),
})

/**
 * Result shape that lets the UI render a paywall card when the team is not
 * entitled to AI Judge Scheduling, instead of blowing up the loader.
 */
export type AiSchedulingContextResult =
  | {
      hasAccess: true
      eventContext: EventContextDto
      roster: JudgeRosterEntry[]
      priorRotations: PriorRotationExample[]
    }
  | { hasAccess: false }

/**
 * Load everything the AI scheduling page needs in one round trip.
 * Mirrors what the agent sees — keeps the UI and the agent aligned.
 *
 * Returns `{hasAccess: false}` (rather than throwing) when the team's plan
 * doesn't include AI_JUDGE_SCHEDULING, so the UI can render an upgrade prompt.
 */
export const loadAiSchedulingContextFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => loadContextSchema.parse(data))
  .handler(async ({ data }): Promise<AiSchedulingContextResult> => {
    await requireTeamPermission(
      data.teamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    const entitled = await hasFeature(data.teamId, FEATURES.AI_JUDGE_SCHEDULING)
    if (!entitled) {
      return { hasAccess: false }
    }

    const [eventContext, roster, priorRotations] = await Promise.all([
      loadEventContext(data.trackWorkoutId),
      loadJudgeRoster(data.competitionId),
      loadPriorRotations(data.competitionId, data.trackWorkoutId),
    ])

    return { hasAccess: true, eventContext, roster, priorRotations }
  })

/**
 * Persist accepted AI proposals as competition_judge_rotations rows.
 * Returns the inserted rotations so the UI can confirm what got saved.
 */
export const applyAiProposalsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => applyProposalsSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{
      rotations: CompetitionJudgeRotation[]
      appliedCount: number
    }> => {
      await requireTeamPermission(
        data.teamId,
        TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
      )

      const entitled = await hasFeature(
        data.teamId,
        FEATURES.AI_JUDGE_SCHEDULING,
      )
      if (!entitled) {
        throw new Error("Your plan does not include AI Judge Scheduling")
      }

      const db = getDb()

      // Defense in depth: the team-permission check above only validates
      // the *caller's* team. The competitionId, trackWorkoutId, and
      // every membershipId are user input — verify each one belongs to
      // the authorized team before inserting any rotations.
      const [competition] = await db
        .select({
          id: competitionsTable.id,
          competitionTeamId: competitionsTable.competitionTeamId,
          organizingTeamId: competitionsTable.organizingTeamId,
        })
        .from(competitionsTable)
        .where(eq(competitionsTable.id, data.competitionId))
      if (
        !competition ||
        (competition.organizingTeamId !== data.teamId &&
          competition.competitionTeamId !== data.teamId)
      ) {
        throw new Error("Competition does not belong to this team")
      }

      const [workoutRow] = await db
        .select({ competitionId: programmingTracksTable.competitionId })
        .from(trackWorkoutsTable)
        .innerJoin(
          programmingTracksTable,
          eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
        )
        .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
      if (!workoutRow || workoutRow.competitionId !== data.competitionId) {
        throw new Error("Track workout does not belong to this competition")
      }

      const proposals = data.proposals as ProposedRotation[]
      const membershipIds = Array.from(
        new Set(proposals.map((p) => p.membershipId)),
      )
      if (membershipIds.length > 0) {
        const validMembers = await db
          .select({ id: teamMembershipTable.id })
          .from(teamMembershipTable)
          .where(
            and(
              inArray(teamMembershipTable.id, membershipIds),
              eq(teamMembershipTable.teamId, competition.competitionTeamId),
            ),
          )
        if (validMembers.length !== membershipIds.length) {
          throw new Error(
            "One or more proposals reference judges outside this competition's volunteer roster",
          )
        }
      }

      const inserts = proposalsToRotationInserts({
        proposals,
        competitionId: data.competitionId,
        trackWorkoutId: data.trackWorkoutId,
      })

      const rotations = await db.transaction(async (tx) => {
        const ids: string[] = []
        const rows = inserts.map((insert) => {
          const id = createJudgeRotationId()
          ids.push(id)
          return { id, ...insert }
        })

        await tx.insert(competitionJudgeRotationsTable).values(rows)

        return tx.query.competitionJudgeRotationsTable.findMany({
          where: (table, { inArray }) => inArray(table.id, ids),
        })
      })

      return { rotations, appliedCount: rotations.length }
    },
  )
