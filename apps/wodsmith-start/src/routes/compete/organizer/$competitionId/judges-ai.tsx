import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useAgent } from "agents/react"
import { Check, Loader2, RotateCcw, Send, Sparkles, X } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LANE_SHIFT_PATTERN } from "@/db/schema"
import type {
  AgentState,
  EventContextDto,
  JudgeRosterEntry,
  ProposedRotation,
} from "@/lib/judge-scheduler/schemas"
import { computeCoverageFromProposals } from "@/lib/judge-scheduler/tools"
import {
  type CompetitionWorkout,
  getCompetitionWorkoutsFn,
} from "@/server-fns/competition-workouts-fns"
import {
  applyAiProposalsFn,
  loadAiSchedulingContextFn,
} from "@/server-fns/judge-scheduler-ai-fns"
import { useSession } from "@/utils/auth-client"
import { formatTrackOrder } from "@/utils/format-track-order"

const searchParamsSchema = z.object({
  workoutId: z.string().optional(),
})

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/judges-ai",
)({
  staleTime: 10_000,
  validateSearch: searchParamsSchema,
  loaderDeps: ({ search }) => ({ workoutId: search.workoutId }),
  loader: async ({ parentMatchPromise, deps }) => {
    const parentMatch = await parentMatchPromise
    // biome-ignore lint/style/noNonNullAssertion: established pattern for parent route data
    const { competition } = parentMatch.loaderData!
    const eventsResult = await getCompetitionWorkoutsFn({
      data: {
        competitionId: competition.id,
        teamId: competition.organizingTeamId,
      },
    })
    const events = eventsResult.workouts

    const initialWorkoutId = deps.workoutId ?? events[0]?.id ?? null
    const initialContext = initialWorkoutId
      ? await loadAiSchedulingContextFn({
          data: {
            trackWorkoutId: initialWorkoutId,
            competitionId: competition.id,
            teamId: competition.organizingTeamId,
          },
        })
      : null

    return { competition, events, initialContext, initialWorkoutId }
  },
  component: JudgesAiPage,
})

function JudgesAiPage() {
  const { competition, events, initialContext, initialWorkoutId } =
    Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const session = useSession()

  const [context, setContext] = useState(initialContext)
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(
    search.workoutId ?? initialWorkoutId,
  )
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set())
  const [isApplying, setIsApplying] = useState(false)

  const userId = session?.userId ?? "anonymous"
  const agentName = selectedWorkoutId
    ? `${selectedWorkoutId}__${userId}`
    : `idle__${userId}`

  const agent = useAgent<AgentState>({
    agent: "judge-scheduler-agent",
    name: agentName,
  })

  const status = agent.state?.status ?? "idle"
  const proposals = agent.state?.proposals ?? []
  const summary = agent.state?.summary
  const errorMessage = agent.state?.errorMessage

  const acceptedProposals = useMemo(
    () => proposals.filter((p) => !rejectedIds.has(p.proposalId)),
    [proposals, rejectedIds],
  )

  const coverage = useMemo(
    () =>
      context
        ? computeCoverageFromProposals(acceptedProposals, context.eventContext)
        : null,
    [context, acceptedProposals],
  )

  const judgesById = useMemo(() => {
    const map = new Map<string, JudgeRosterEntry>()
    for (const judge of context?.roster ?? []) {
      map.set(judge.membershipId, judge)
    }
    return map
  }, [context])

  async function handleSelectEvent(workoutId: string) {
    setSelectedWorkoutId(workoutId)
    setRejectedIds(new Set())
    navigate({
      to: "/compete/organizer/$competitionId/judges-ai",
      params: { competitionId: competition.id },
      search: { workoutId },
      replace: true,
    })
    try {
      const next = await loadAiSchedulingContextFn({
        data: {
          trackWorkoutId: workoutId,
          competitionId: competition.id,
          teamId: competition.organizingTeamId,
        },
      })
      setContext(next)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load event")
    }
  }

  async function handleGenerate() {
    if (!selectedWorkoutId) return
    setRejectedIds(new Set())
    try {
      await agent.stub.start({
        trackWorkoutId: selectedWorkoutId,
        competitionId: competition.id,
        reset: true,
      })
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start the agent",
      )
    }
  }

  async function handleReset() {
    setRejectedIds(new Set())
    try {
      await agent.stub.reset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset")
    }
  }

  async function handleApply() {
    if (!selectedWorkoutId || acceptedProposals.length === 0) return
    setIsApplying(true)
    try {
      const result = await applyAiProposalsFn({
        data: {
          teamId: competition.organizingTeamId,
          competitionId: competition.id,
          trackWorkoutId: selectedWorkoutId,
          proposals: acceptedProposals,
        },
      })
      toast.success(
        `Saved ${result.appliedCount} rotation${result.appliedCount === 1 ? "" : "s"}. Open the Volunteers tab to publish.`,
      )
      // Refresh context so the existing rotations show updated counts
      const next = await loadAiSchedulingContextFn({
        data: {
          trackWorkoutId: selectedWorkoutId,
          competitionId: competition.id,
          teamId: competition.organizingTeamId,
        },
      })
      setContext(next)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply")
    } finally {
      setIsApplying(false)
    }
  }

  const eventName = context?.eventContext.workoutName ?? ""
  const totalLanes =
    context?.eventContext.heats.reduce(
      (max: number, h: { laneCount: number }) => Math.max(max, h.laneCount),
      0,
    ) ?? 0
  const totalHeats = context?.eventContext.totalHeats ?? 0

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Judge Scheduling
          </h2>
          <p className="text-sm text-muted-foreground">
            The agent proposes rotations one at a time. Review, reject any you
            disagree with, then save the rest as draft rotations.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="ai-event-selector" className="text-sm font-medium">
          Event:
        </label>
        <Select
          value={selectedWorkoutId ?? ""}
          onValueChange={handleSelectEvent}
        >
          <SelectTrigger id="ai-event-selector" className="w-80">
            <SelectValue placeholder="Select event" />
          </SelectTrigger>
          <SelectContent>
            {events.map((event: CompetitionWorkout) => (
              <SelectItem key={event.id} value={event.id}>
                {formatTrackOrder(event.trackOrder)} - {event.workout.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={handleGenerate}
          disabled={!selectedWorkoutId || status === "thinking"}
        >
          {status === "thinking" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {status === "thinking" ? "Thinking..." : "Generate Suggestions"}
        </Button>
        {proposals.length > 0 && status !== "thinking" && (
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        )}
      </div>

      {errorMessage && (
        <Card className="border-destructive">
          <CardContent className="py-3 text-sm text-destructive">
            {errorMessage}
          </CardContent>
        </Card>
      )}

      {context && coverage && (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-base font-semibold">
                {eventName} Coverage:{" "}
                <span
                  className={
                    coverage.coveragePercent >= 100
                      ? "text-green-600"
                      : "text-orange-500"
                  }
                >
                  {coverage.coveragePercent}%
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {coverage.coveredSlots}/{coverage.totalSlots} slots covered
                {acceptedProposals.length > 0 && (
                  <> · {acceptedProposals.length} accepted proposal(s)</>
                )}
              </div>
            </div>
            <Button
              onClick={handleApply}
              disabled={isApplying || acceptedProposals.length === 0}
            >
              {isApplying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Save {acceptedProposals.length} Rotation
              {acceptedProposals.length === 1 ? "" : "s"} as Draft
            </Button>
          </div>

          {summary && status === "done" && (
            <Card>
              <CardContent className="py-3 text-sm">
                <span className="font-medium">AI summary:</span> {summary}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
            <ProposalList
              proposals={proposals}
              rejectedIds={rejectedIds}
              setRejectedIds={setRejectedIds}
              judgesById={judgesById}
              status={status}
            />
            <CoverageGrid
              eventContext={context.eventContext}
              proposals={acceptedProposals}
              totalLanes={totalLanes}
              totalHeats={totalHeats}
              coverage={coverage}
            />
          </div>
        </>
      )}

      {!context && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Select an event to begin.
          </CardContent>
        </Card>
      )}
    </section>
  )
}

function ProposalList({
  proposals,
  rejectedIds,
  setRejectedIds,
  judgesById,
  status,
}: {
  proposals: ProposedRotation[]
  rejectedIds: Set<string>
  setRejectedIds: (next: Set<string>) => void
  judgesById: Map<string, JudgeRosterEntry>
  status: AgentState["status"]
}) {
  function toggle(proposalId: string) {
    const next = new Set(rejectedIds)
    if (next.has(proposalId)) next.delete(proposalId)
    else next.add(proposalId)
    setRejectedIds(next)
  }

  return (
    <Card className="lg:sticky lg:top-4 lg:self-start">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">
            AI Proposals ({proposals.length})
          </h3>
          {status === "thinking" && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {proposals.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {status === "thinking"
              ? "The agent is thinking…"
              : "No proposals yet. Click Generate Suggestions to start."}
          </p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {proposals.map((p) => (
              <ProposalCard
                key={p.proposalId}
                proposal={p}
                judge={judgesById.get(p.membershipId)}
                rejected={rejectedIds.has(p.proposalId)}
                onToggle={() => toggle(p.proposalId)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ProposalCard({
  proposal,
  judge,
  rejected,
  onToggle,
}: {
  proposal: ProposedRotation
  judge?: JudgeRosterEntry
  rejected: boolean
  onToggle: () => void
}) {
  const lastHeat = proposal.startingHeat + proposal.heatsCount - 1
  const range =
    proposal.heatsCount === 1
      ? `H${proposal.startingHeat} · L${proposal.startingLane}`
      : `H${proposal.startingHeat}-${lastHeat} · L${proposal.startingLane}${
          proposal.laneShiftPattern === LANE_SHIFT_PATTERN.SHIFT_RIGHT
            ? "→"
            : ""
        }`
  return (
    <div
      className={`rounded-md border p-3 transition-opacity ${
        rejected ? "border-dashed opacity-50" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-sm font-medium">
            {judge?.name ?? proposal.membershipId}
          </div>
          <div className="text-xs text-muted-foreground">{range}</div>
        </div>
        <ConfidenceBadge confidence={proposal.confidence} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{proposal.rationale}</p>
      {proposal.softViolations.length > 0 && (
        <ul className="mt-2 space-y-1">
          {proposal.softViolations.map((v) => (
            <li
              key={v}
              className="text-xs text-orange-600 dark:text-orange-400"
            >
              ⚠ {v}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex justify-end">
        <Button
          size="sm"
          variant={rejected ? "outline" : "ghost"}
          onClick={onToggle}
          className="h-7 text-xs"
        >
          {rejected ? (
            <>
              <Check className="mr-1 h-3 w-3" /> Restore
            </>
          ) : (
            <>
              <X className="mr-1 h-3 w-3" /> Reject
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function ConfidenceBadge({
  confidence,
}: {
  confidence: ProposedRotation["confidence"]
}) {
  const map = {
    high: { label: "High", variant: "default" as const },
    medium: { label: "Med", variant: "secondary" as const },
    low: { label: "Low", variant: "destructive" as const },
  }
  const cfg = map[confidence]
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

function CoverageGrid({
  eventContext,
  proposals,
  totalLanes,
  totalHeats,
  coverage,
}: {
  eventContext: EventContextDto
  proposals: ProposedRotation[]
  totalLanes: number
  totalHeats: number
  coverage: ReturnType<typeof computeCoverageFromProposals>
}) {
  const cellByKey = useMemo(() => {
    const map = new Map<string, "covered" | "overlap" | "no-athlete">()
    for (const heat of eventContext.heats) {
      for (let lane = 1; lane <= totalLanes; lane++) {
        if (
          heat.occupiedLanes.length > 0 &&
          !heat.occupiedLanes.includes(lane)
        ) {
          map.set(`${heat.heatNumber}:${lane}`, "no-athlete")
        }
      }
    }
    for (const overlap of coverage.overlaps) {
      map.set(`${overlap.heatNumber}:${overlap.laneNumber}`, "overlap")
    }
    // Mark covered cells from proposals (skip if already overlap)
    for (const p of proposals) {
      const lastHeat = p.startingHeat + p.heatsCount - 1
      for (let h = p.startingHeat; h <= lastHeat; h++) {
        const heatInfo = eventContext.heats.find((x) => x.heatNumber === h)
        if (!heatInfo) continue
        let lane = p.startingLane
        if (p.laneShiftPattern === LANE_SHIFT_PATTERN.SHIFT_RIGHT) {
          const offset = h - p.startingHeat
          lane = ((p.startingLane - 1 + offset) % heatInfo.laneCount) + 1
        }
        const key = `${h}:${lane}`
        if (map.get(key) === "overlap") continue
        if (map.get(key) === "no-athlete") continue
        map.set(key, "covered")
      }
    }
    return map
  }, [eventContext, proposals, coverage, totalLanes])

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">
            Coverage: {coverage.coveragePercent}% ({coverage.coveredSlots}/
            {coverage.totalSlots})
          </h3>
          <div className="text-xs text-muted-foreground">
            {totalHeats} heats × {totalLanes} lanes
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="border bg-muted/50 p-2 text-left">Lane</th>
                {eventContext.heats.map((h) => (
                  <th
                    key={h.heatNumber}
                    className="min-w-[60px] border bg-muted/50 p-2 text-center"
                  >
                    <div>H{h.heatNumber}</div>
                    {h.startTime && (
                      <div className="text-[10px] font-normal text-muted-foreground">
                        {new Date(h.startTime).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: totalLanes }, (_, i) => i + 1).map(
                (lane) => (
                  <tr key={lane}>
                    <td className="border bg-muted/30 p-2 font-medium">
                      L{lane}
                    </td>
                    {eventContext.heats.map((h) => {
                      const state = cellByKey.get(`${h.heatNumber}:${lane}`)
                      const cls =
                        state === "covered"
                          ? "bg-emerald-200 dark:bg-emerald-900"
                          : state === "overlap"
                            ? "bg-orange-200 dark:bg-orange-900"
                            : state === "no-athlete"
                              ? "bg-muted bg-[length:6px_6px] bg-[image:repeating-linear-gradient(45deg,_transparent,_transparent_2px,_currentColor_2px,_currentColor_3px)] opacity-25"
                              : ""
                      return (
                        <td
                          key={h.heatNumber}
                          className={`h-8 border p-0 ${cls}`}
                        />
                      )
                    })}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <LegendChip color="bg-background border" label="Empty" />
          <LegendChip
            color="bg-emerald-200 dark:bg-emerald-900"
            label="Covered"
          />
          <LegendChip
            color="bg-orange-200 dark:bg-orange-900"
            label="Overlap"
          />
          <LegendChip color="bg-muted opacity-25" label="No Athlete" />
        </div>
      </CardContent>
    </Card>
  )
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded-sm border ${color}`} />
      <span>{label}</span>
    </div>
  )
}
