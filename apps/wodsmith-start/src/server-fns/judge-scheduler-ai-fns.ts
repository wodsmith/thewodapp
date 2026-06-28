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
import { eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import type { CompetitionJudgeRotation } from "@/db/schema"
import { competitionJudgeRotationsTable } from "@/db/schema"
import { createJudgeRotationId } from "@/db/schemas/common"
import {
  type EventContextDto,
  type JudgeRosterEntry,
  type PriorRotationExample,
  type ProposedRotation,
  proposedRotationSchema,
} from "@/lib/judge-scheduler/schemas"
import {
  computeCoverageFromProposals,
  proposalsToRotationInserts,
  validateProposal,
} from "@/lib/judge-scheduler/tools"
import {
  loadAiSchedulingScope,
  requireAiSchedulingTeamAccess,
} from "@/server/judge-scheduler/access"
import {
  loadEventContext,
  loadJudgeRoster,
  loadPriorRotations,
} from "@/server/judge-scheduler/context"

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
    const scope = await loadAiSchedulingScope(data)
    try {
      await requireAiSchedulingTeamAccess({ teamId: data.teamId, scope })
    } catch (err) {
      if (err instanceof Error && err.message.includes("AI Judge Scheduling")) {
        return { hasAccess: false }
      }
      throw err
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
      const db = getDb()
      const scope = await loadAiSchedulingScope(data)
      await requireAiSchedulingTeamAccess({ teamId: data.teamId, scope })

      const proposals = data.proposals as ProposedRotation[]
      await validateAiProposalsForInsert(proposals, data.trackWorkoutId)

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

async function validateAiProposalsForInsert(
  proposals: ProposedRotation[],
  trackWorkoutId: string,
): Promise<void> {
  const proposalIds = proposals.map((p) => p.proposalId)
  if (new Set(proposalIds).size !== proposalIds.length) {
    throw new Error("Duplicate AI proposal ids are not allowed")
  }
  if (proposals.some((p) => p.status !== "pending")) {
    throw new Error("Only pending AI proposals can be saved as drafts")
  }

  const db = getDb()
  const eventContext = await loadEventContext(trackWorkoutId)
  const roster = await loadJudgeRoster(eventContext.competitionId)
  const rosterIds = new Set(roster.map((j) => j.membershipId))

  const existingRows = await db
    .select()
    .from(competitionJudgeRotationsTable)
    .where(eq(competitionJudgeRotationsTable.trackWorkoutId, trackWorkoutId))

  const existingProposals: ProposedRotation[] = existingRows.map((r) => ({
    proposalId: `existing:${r.id}`,
    membershipId: r.membershipId ?? "",
    startingHeat: r.startingHeat,
    startingLane: r.startingLane,
    heatsCount: r.heatsCount,
    laneShiftPattern: r.laneShiftPattern,
    confidence: "high",
    rationale: "Existing draft rotation",
    softViolations: [],
    status: "accepted",
  }))

  const acceptedSoFar: ProposedRotation[] = [...existingProposals]
  for (const proposal of proposals) {
    if (!rosterIds.has(proposal.membershipId)) {
      throw new Error(
        "One or more proposals reference judges outside this competition's volunteer roster",
      )
    }

    const { violations } = validateProposal({
      proposal,
      context: eventContext,
      roster,
      existingProposals: acceptedSoFar,
    })
    const blockingViolations = violations.filter(isBlockingProposalViolation)
    if (blockingViolations.length > 0) {
      throw new Error(
        `AI proposal ${proposal.proposalId} is invalid: ${blockingViolations.join("; ")}`,
      )
    }

    acceptedSoFar.push(proposal)
  }

  const coverage = computeCoverageFromProposals(acceptedSoFar, eventContext)
  const proposalIdSet = new Set(proposalIds)
  const overlappingNewProposals = coverage.overlaps.filter((overlap) =>
    overlap.proposalIds.some((id) => proposalIdSet.has(id)),
  )
  if (overlappingNewProposals.length > 0) {
    const first = overlappingNewProposals[0]
    throw new Error(
      `AI proposals overlap an existing or proposed slot at H${first?.heatNumber} L${first?.laneNumber}`,
    )
  }
}

function isBlockingProposalViolation(violation: string): boolean {
  return (
    violation.startsWith("Starting lane ") ||
    violation.startsWith("Unknown membershipId") ||
    violation.startsWith("Rotation runs past") ||
    violation.includes("which overlaps this rotation")
  )
}
