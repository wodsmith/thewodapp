/**
 * AI Judge Scheduler — non-streaming server fn.
 *
 * Used by code paths that don't need progressive proposals (tests, server-side
 * tooling). The interactive UI uses the streaming API route at
 * /api/judge-scheduler/suggest instead.
 *
 * Proposals are buffered server-side and never written from this server fn —
 * the organizer accepts them via the existing createJudgeRotationFn flow.
 */

import "server-only"

import {createServerFn} from "@tanstack/react-start"
import {z} from "zod"
import {TEAM_PERMISSIONS} from "@/db/schemas/teams"
import {isAiHeatSchedulingEnabled} from "@/lib/env"
import {runJudgeSchedulerAgent} from "@/server/ai/judge-scheduler/agent"
import {loadEventContext} from "@/server/ai/judge-scheduler/load-context"
import {projectCoverage} from "@/server/ai/judge-scheduler/projector"
import {requireTeamPermission} from "@/utils/team-auth"

const inputSchema = z.object({
  competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
  organizingTeamId: z
    .string()
    .startsWith("team_", "Invalid organizing team ID"),
  competitionTeamId: z
    .string()
    .startsWith("team_", "Invalid competition team ID"),
  trackWorkoutId: z.string().min(1, "trackWorkoutId is required"),
  organizerInstructions: z.string().max(2000).optional(),
})

export const generateJudgeRotationSuggestionsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({data}) => {
    if (!isAiHeatSchedulingEnabled()) {
      return {ok: false as const, reason: "feature_disabled" as const}
    }
    await requireTeamPermission(
      data.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    const context = await loadEventContext({
      competitionTeamId: data.competitionTeamId,
      trackWorkoutId: data.trackWorkoutId,
    })

    const result = await runJudgeSchedulerAgent({
      context,
      organizerInstructions: data.organizerInstructions,
    })

    const proposalRotations = result.proposals.map((p) => p.proposal)
    const projected = projectCoverage(
      context.rotations,
      proposalRotations,
      context.heats,
    )

    return {
      ok: true as const,
      proposals: result.proposals,
      narrative: result.narrative,
      coverageBefore: {
        coveragePercent: context.coverage.coveragePercent,
        coveredSlots: context.coverage.coveredSlots,
        totalSlots: context.coverage.totalSlots,
      },
      coverageAfterIfAllAccepted: {
        coveragePercent: projected.coveragePercent,
        coveredSlots: projected.coveredSlots,
        totalSlots: projected.totalSlots,
      },
    }
  })
