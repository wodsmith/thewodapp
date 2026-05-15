import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router"
import { useAgent } from "agents/react"
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Lock,
  RotateCcw,
  Sparkles,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"
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
import type { LaneShiftPattern } from "@/db/schemas/volunteers"
import type { ActivityEntry, AgentState } from "@/lib/judge-scheduler/schemas"
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

    return {
      competition,
      events,
      hasAccess,
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

function JudgesAiPage() {
  const {
    competition,
    events,
    hasAccess: initialHasAccess,
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

  // Auto-apply AI proposals as draft rotations as they stream in.
  // Publishing is the real commit gate, so we treat each proposal as
  // low-stakes: it lands in the grid the organizer is already looking
  // at, and they can edit or delete it like any manual rotation.
  // The ref tracks which proposalIds we've already persisted so we
  // don't double-insert when the agent's state syncs again.
  const appliedProposalIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    // Clear the applied-id tracker whenever the user switches workouts
    // — the new agent instance starts a fresh proposal stream.
    appliedProposalIdsRef.current = new Set()
  }, [selectedWorkoutId])

  useEffect(() => {
    if (!selectedWorkoutId) return
    if (proposals.length === 0) return
    const pending = proposals.filter(
      (p) => !appliedProposalIdsRef.current.has(p.proposalId),
    )
    if (pending.length === 0) return
    // Debounce so a burst of streamed proposals turns into one batch
    // insert + one route invalidation rather than N round trips.
    const handle = setTimeout(async () => {
      // Mark optimistically before the call so any state echo doesn't
      // re-enqueue the same proposals.
      for (const p of pending) {
        appliedProposalIdsRef.current.add(p.proposalId)
      }
      try {
        await applyAiProposalsFn({
          data: {
            teamId: competition.organizingTeamId,
            competitionId: competition.id,
            trackWorkoutId: selectedWorkoutId,
            proposals: pending,
          },
        })
        await router.invalidate()
      } catch (err) {
        // Roll back the optimistic markers so a retry can replay.
        for (const p of pending) {
          appliedProposalIdsRef.current.delete(p.proposalId)
        }
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to save AI proposals to the grid",
        )
      }
    }, 600)
    return () => clearTimeout(handle)
  }, [proposals, selectedWorkoutId, competition.id, competition.organizingTeamId, router])

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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load event")
    }
  }

  async function handleGenerate() {
    if (!selectedWorkoutId) return
    appliedProposalIdsRef.current = new Set()
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
    appliedProposalIdsRef.current = new Set()
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

      {(status === "thinking" || thinkingLog.length > 0) && (
        <ActivityLog entries={thinkingLog} status={status} />
      )}

      {/* Unified scheduling grid — full edit / publish / versioning
       * surface. AI proposals stream straight into this grid as draft
       * rotations (auto-applied), so the organizer manipulates them
       * the same way as anything they entered by hand. Publishing the
       * draft version is the real commit gate. */}
      {selectedWorkoutId && (
        <div>
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
          />
        </div>
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

