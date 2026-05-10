/**
 * Streaming AI judge-scheduler API route.
 *
 * POST /api/judge-scheduler/suggest
 * Body: { competitionId, organizingTeamId, competitionTeamId, trackWorkoutId,
 *         organizerInstructions? }
 *
 * Response: text/event-stream of Server-Sent Events. Event types:
 *  - "proposal"   data: { proposalId, proposal }
 *  - "conflict"   data: { proposal, conflict }
 *  - "narrative"  data: { text }                   (terminal narrative chunk)
 *  - "done"       data: { proposalCount, coverageBefore, coverageAfterIfAllAccepted }
 *  - "error"      data: { message }
 *
 * The agent's tool calls drive proposal/conflict events in real time; the
 * "done" event lands after the agent finishes and the stream then closes.
 *
 * Uses top-level imports for server-only modules (server-only file route).
 */

import {createFileRoute} from "@tanstack/react-router"
import {z} from "zod"
import {TEAM_PERMISSIONS} from "@/db/schemas/teams"
import {isAiHeatSchedulingEnabled} from "@/lib/env"
import {runJudgeSchedulerAgent} from "@/server/ai/judge-scheduler/agent"
import {loadEventContext} from "@/server/ai/judge-scheduler/load-context"
import {projectCoverage} from "@/server/ai/judge-scheduler/projector"
import {
  BroadcastingProposalCollector,
  type StreamEvent,
} from "@/server/ai/judge-scheduler/streaming-collector"
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

export const Route = createFileRoute("/api/judge-scheduler/suggest")({
  server: {
    handlers: {
      POST: async ({request}) => {
        if (!isAiHeatSchedulingEnabled()) {
          return new Response(
            JSON.stringify({error: "feature_disabled"}),
            {status: 403, headers: {"Content-Type": "application/json"}},
          )
        }

        let body: z.infer<typeof inputSchema>
        try {
          const raw = await request.json()
          body = inputSchema.parse(raw)
        } catch (e) {
          return new Response(
            JSON.stringify({
              error: e instanceof Error ? e.message : "invalid body",
            }),
            {status: 400, headers: {"Content-Type": "application/json"}},
          )
        }

        try {
          await requireTeamPermission(
            body.organizingTeamId,
            TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
          )
        } catch (e) {
          return new Response(
            JSON.stringify({
              error: e instanceof Error ? e.message : "unauthorized",
            }),
            {status: 403, headers: {"Content-Type": "application/json"}},
          )
        }

        const context = await loadEventContext({
          competitionTeamId: body.competitionTeamId,
          trackWorkoutId: body.trackWorkoutId,
        })

        const encoder = new TextEncoder()
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (event: StreamEvent) => {
              const line = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
              controller.enqueue(encoder.encode(line))
            }

            const collector = new BroadcastingProposalCollector(context, send)

            // Hand the UI the roster + starting coverage up front so it can
            // resolve membershipId → display name and show projection deltas.
            send({
              type: "init",
              data: {
                judges: context.judges.map((j) => ({
                  membershipId: j.membershipId,
                  displayName: j.displayName,
                  availability: j.availability,
                })),
                coverageBefore: {
                  coveragePercent: context.coverage.coveragePercent,
                  coveredSlots: context.coverage.coveredSlots,
                  totalSlots: context.coverage.totalSlots,
                },
              },
            })

            try {
              const result = await runJudgeSchedulerAgent({
                context,
                organizerInstructions: body.organizerInstructions,
                collector,
              })

              if (result.narrative) {
                send({type: "narrative", data: {text: result.narrative}})
              }

              const proposalRotations = collector
                .list()
                .map((p) => p.proposal)
              const projected = projectCoverage(
                context.rotations,
                proposalRotations,
                context.heats,
              )

              send({
                type: "done",
                data: {
                  proposalCount: collector.list().length,
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
                },
              })
            } catch (e) {
              send({
                type: "error",
                data: {
                  message: e instanceof Error ? e.message : "Unknown error",
                },
              })
            } finally {
              controller.close()
            }
          },
        })

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            // Disable nginx-style buffering on intermediaries.
            "X-Accel-Buffering": "no",
          },
        })
      },
    },
  },
})
