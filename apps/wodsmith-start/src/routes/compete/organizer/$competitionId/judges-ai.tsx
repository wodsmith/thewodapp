import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router"
import { useAgent } from "agents/react"
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Lock,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
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
import type { JudgeAssignmentVersion } from "@/db/schema"
import { LANE_SHIFT_PATTERN } from "@/db/schema"
import type { LaneShiftPattern } from "@/db/schemas/volunteers"
import type {
  ActivityEntry,
  AgentState,
  EventContextDto,
  JudgeRosterEntry,
  PriorRotationExample,
  ProposedRotation,
} from "@/lib/judge-scheduler/schemas"
import { getHeatsForCompetitionFn } from "@/server-fns/competition-heats-fns"
import {
  type CompetitionWorkout,
  getCompetitionWorkoutsFn,
} from "@/server-fns/competition-workouts-fns"
import {
  getActiveVersionFn,
  getVersionHistoryFn,
} from "@/server-fns/judge-assignment-fns"
import {
  applyAiProposalsFn,
  loadAiSchedulingContextFn,
} from "@/server-fns/judge-scheduler-ai-fns"
import {
  getJudgeHeatAssignmentsFn,
  getJudgeVolunteersFn,
  getRotationsForEventFn,
} from "@/server-fns/judge-scheduling-fns"
import { useSession } from "@/utils/auth-client"
import { formatTrackOrder } from "@/utils/format-track-order"
import { JudgeSchedulingContainer } from "./-components/judges"

interface EventDefaults {
  defaultHeatsCount: number | null
  defaultLaneShiftPattern: LaneShiftPattern | null
  minHeatBuffer: number | null
}

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

    // Fetch the AI-specific context alongside everything the manual
    // JudgeSchedulingContainer needs — heats, judges, current rotations,
    // version history. Loading both in parallel keeps the initial render
    // under one round trip and lets the manual editor work even before
    // the agent has run.
    const [
      initialResult,
      heatsResult,
      judges,
      allAssignments,
      allRotationResults,
      allVersionHistory,
      allActiveVersions,
    ] = await Promise.all([
      initialWorkoutId
        ? loadAiSchedulingContextFn({
            data: {
              trackWorkoutId: initialWorkoutId,
              competitionId: competition.id,
              teamId: competition.organizingTeamId,
            },
          })
        : Promise.resolve(null),
      getHeatsForCompetitionFn({
        data: {
          competitionId: competition.id,
          teamId: competition.organizingTeamId,
        },
      }),
      getJudgeVolunteersFn({
        data: { competitionTeamId: competition.competitionTeamId ?? "" },
      }),
      Promise.all(
        events.map((event) =>
          getJudgeHeatAssignmentsFn({ data: { trackWorkoutId: event.id } }),
        ),
      ),
      Promise.all(
        events.map((event) =>
          getRotationsForEventFn({ data: { trackWorkoutId: event.id } }),
        ),
      ),
      Promise.all(
        events.map((event) =>
          getVersionHistoryFn({ data: { trackWorkoutId: event.id } }),
        ),
      ),
      Promise.all(
        events.map((event) =>
          getActiveVersionFn({ data: { trackWorkoutId: event.id } }),
        ),
      ),
    ])

    const heats = heatsResult.heats
    const judgeAssignments = allAssignments.flat()
    const rotations = allRotationResults.flatMap((r) => r.rotations)

    const eventDefaultsMap = new Map<string, EventDefaults>()
    const versionHistoryMap = new Map<string, JudgeAssignmentVersion[]>()
    const activeVersionMap = new Map<string, JudgeAssignmentVersion | null>()
    for (const [index, event] of events.entries()) {
      const result = allRotationResults[index]
      eventDefaultsMap.set(event.id, {
        defaultHeatsCount: result?.eventDefaults?.defaultHeatsCount ?? null,
        defaultLaneShiftPattern:
          (result?.eventDefaults
            ?.defaultLaneShiftPattern as LaneShiftPattern) ?? null,
        minHeatBuffer: result?.eventDefaults?.minHeatBuffer ?? null,
      })
      versionHistoryMap.set(event.id, allVersionHistory[index] ?? [])
      activeVersionMap.set(event.id, allActiveVersions[index] ?? null)
    }

    const hasAccess = initialResult ? initialResult.hasAccess : true
    const initialContext =
      initialResult && initialResult.hasAccess ? initialResult : null

    return {
      competition,
      events,
      hasAccess,
      initialContext,
      initialWorkoutId,
      heats,
      judges,
      judgeAssignments,
      rotations,
      eventDefaultsMap,
      versionHistoryMap,
      activeVersionMap,
    }
  },
  component: JudgesAiPage,
})

interface LoadedContext {
  hasAccess: true
  eventContext: EventContextDto
  roster: JudgeRosterEntry[]
  priorRotations: PriorRotationExample[]
}

function JudgesAiPage() {
  const {
    competition,
    events,
    hasAccess: initialHasAccess,
    initialContext,
    initialWorkoutId,
    heats,
    judges,
    judgeAssignments,
    rotations,
    eventDefaultsMap,
    versionHistoryMap,
    activeVersionMap,
  } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const router = useRouter()
  const session = useSession()

  const [hasAccess, setHasAccess] = useState(initialHasAccess)
  const [context, setContext] = useState<LoadedContext | null>(initialContext)
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(
    search.workoutId ?? initialWorkoutId,
  )

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
  const thinkingLog = agent.state?.thinkingLog ?? []
  const errorMessage = agent.state?.errorMessage

  // Proposals are NOT auto-applied. The organizer reviews each one in
  // the proposals card, optionally rejects any they disagree with, and
  // explicitly hits "Save as drafts" to convert the kept proposals
  // into draft rotations on the grid. The publish step downstream is
  // the real commit gate.
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set())
  const [isApplying, setIsApplying] = useState(false)

  const acceptedProposals = useMemo(
    () => proposals.filter((p) => !rejectedIds.has(p.proposalId)),
    [proposals, rejectedIds],
  )

  const judgesById = useMemo(() => {
    const map = new Map<string, JudgeRosterEntry>()
    for (const judge of context?.roster ?? []) {
      map.set(judge.membershipId, judge)
    }
    return map
  }, [context])

  // Reset the rejected set when the user moves to a different workout
  // — the new run starts with a fresh slate.
  useEffect(() => {
    setRejectedIds(new Set())
  }, [selectedWorkoutId])

  async function handleSelectEvent(workoutId: string) {
    setSelectedWorkoutId(workoutId)
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
      setHasAccess(next.hasAccess)
      setContext(next.hasAccess ? next : null)
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
        `Added ${result.appliedCount} draft rotation${result.appliedCount === 1 ? "" : "s"} to the grid.`,
      )
      // Clear the agent's proposal state so the card disappears now
      // that the kept proposals live as real rotations in the grid.
      await agent.stub.reset()
      await router.invalidate()
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to save proposals as drafts",
      )
    } finally {
      setIsApplying(false)
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

  if (!hasAccess) {
    return (
      <section className="space-y-6">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Judge Scheduling
          </h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Lock className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">
              AI Judge Scheduling is not enabled for this team
            </h3>
            <p className="max-w-md text-sm text-muted-foreground">
              The AI scheduling assistant proposes judge rotations one at a time
              based on each judge's availability and prior rotations. Contact
              your account admin or upgrade your plan to turn it on.
            </p>
          </CardContent>
        </Card>
      </section>
    )
  }

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
      </div>

      {errorMessage && (
        <Card className="border-destructive">
          <CardContent className="py-3 text-sm text-destructive">
            {errorMessage}
          </CardContent>
        </Card>
      )}

      {/* Unified scheduling grid — full edit / publish / versioning
       * surface. AI generation lives inside the Rotations section
       * (via rotationsHeaderSlot) so the Generate button and activity
       * narration sit right above the grid the proposals land in. */}
      {selectedWorkoutId && (
        <JudgeSchedulingContainer
          competitionId={competition.id}
          competitionSlug={competition.slug}
          organizingTeamId={competition.organizingTeamId}
          competitionType={competition.competitionType}
          events={events}
          heats={heats}
          judges={judges}
          judgeAssignments={judgeAssignments}
          rotations={rotations}
          eventDefaultsMap={eventDefaultsMap}
          versionHistoryMap={versionHistoryMap}
          activeVersionMap={activeVersionMap}
          competitionDefaultHeats={competition.defaultHeatsPerRotation ?? 4}
          competitionDefaultPattern={
            (competition.defaultLaneShiftPattern as LaneShiftPattern) ??
            "shift_right"
          }
          selectedEventId={selectedWorkoutId}
          onEventChange={handleSelectEvent}
          hideEventSelector
          rotationOverviewActionsSlot={
            <>
              <Button
                onClick={handleGenerate}
                disabled={!selectedWorkoutId || status === "thinking"}
                className="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {status === "thinking" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {status === "thinking"
                  ? "Thinking..."
                  : "Generate AI suggestions"}
              </Button>
              {proposals.length > 0 && status !== "thinking" && (
                <Button variant="outline" onClick={handleReset}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              )}
            </>
          }
          rotationsHeaderSlot={
            <>
              {(status === "thinking" || thinkingLog.length > 0) && (
                <ActivityLog entries={thinkingLog} status={status} />
              )}
              {proposals.length > 0 && (
                <AiProposalsBar
                  proposals={proposals}
                  rejectedIds={rejectedIds}
                  setRejectedIds={setRejectedIds}
                  judgesById={judgesById}
                  status={status}
                  isApplying={isApplying}
                  onApply={handleApply}
                />
              )}
            </>
          }
        />
      )}
    </section>
  )
}

function ActivityLog({
  entries,
  status,
}: {
  entries: ActivityEntry[]
  status: AgentState["status"]
}) {
  const [expanded, setExpanded] = useState(false)
  const recent = entries.slice(-30)
  const latest = entries[entries.length - 1]
  const scrollRef = useRef<HTMLOListElement>(null)

  // When expanded and new entries arrive, keep the latest visible.
  useEffect(() => {
    if (!expanded) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [expanded, entries.length])

  const ribbonText =
    latest?.message ??
    (status === "thinking" ? "Warming up the model…" : "Waiting to start")

  return (
    <Card>
      <CardContent className="py-0">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-start gap-2 py-2.5 text-left text-sm"
        >
          {status === "thinking" ? (
            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <span
              className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                status === "error"
                  ? "bg-destructive"
                  : status === "done"
                    ? "bg-green-500"
                    : "bg-muted-foreground/40"
              }`}
            />
          )}
          <span
            className={`min-w-0 flex-1 break-words ${
              latest ? activityClassName(latest.kind) : "text-muted-foreground"
            }`}
          >
            {ribbonText}
          </span>
          {entries.length > 0 && (
            <span className="mt-0.5 shrink-0 text-xs text-muted-foreground">
              {entries.length} step{entries.length === 1 ? "" : "s"}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </button>
        {expanded && (
          <ol
            ref={scrollRef}
            className="max-h-64 space-y-1.5 overflow-y-auto border-t py-3 text-sm"
          >
            {recent.length === 0 ? (
              <li className="text-muted-foreground">No activity yet.</li>
            ) : (
              recent.map((entry) => (
                <li key={entry.id} className="flex items-start gap-2">
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground/70">
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  <span
                    className={`min-w-0 flex-1 break-words ${activityClassName(entry.kind)}`}
                  >
                    {entry.message}
                  </span>
                </li>
              ))
            )}
            {entries.length > recent.length && (
              <li className="text-xs italic text-muted-foreground">
                …{entries.length - recent.length} earlier entries hidden
              </li>
            )}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

function activityClassName(kind: ActivityEntry["kind"]): string {
  switch (kind) {
    case "accepted":
      return "text-green-700 dark:text-green-400"
    case "rejected":
      return "text-orange-600 dark:text-orange-400"
    case "error":
      return "text-destructive"
    case "done":
      return "font-medium"
    case "tool":
      return "text-muted-foreground"
    default:
      return ""
  }
}

function AiProposalsBar({
  proposals,
  rejectedIds,
  setRejectedIds,
  judgesById,
  status,
  isApplying,
  onApply,
}: {
  proposals: ProposedRotation[]
  rejectedIds: Set<string>
  setRejectedIds: (next: Set<string>) => void
  judgesById: Map<string, JudgeRosterEntry>
  status: AgentState["status"]
  isApplying: boolean
  onApply: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const accepted = proposals.filter((p) => !rejectedIds.has(p.proposalId))

  function toggle(proposalId: string) {
    const next = new Set(rejectedIds)
    if (next.has(proposalId)) next.delete(proposalId)
    else next.add(proposalId)
    setRejectedIds(next)
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex flex-1 items-center gap-2 text-left text-sm font-medium"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span>
              {accepted.length} of {proposals.length} AI suggestion
              {proposals.length === 1 ? "" : "s"} kept
            </span>
            {status === "thinking" && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
            {expanded ? (
              <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <Button
            size="sm"
            onClick={onApply}
            disabled={isApplying || accepted.length === 0}
          >
            {isApplying ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Save {accepted.length} as drafts
          </Button>
        </div>
        {expanded && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
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

