/**
 * AI Judge Scheduler — sub-page where organizers run the agent against one
 * event and review proposed rotations before accepting them. Accepted
 * proposals land via createJudgeRotationFn, the same path used by the
 * hand-built rotation editor, so they share validation and the publish gate.
 *
 * Pre-select an event with ?event=<trackWorkoutId>.
 */
// @lat: [[organizer-dashboard#AI Judge Scheduler]]

import {createFileRoute, Link, useNavigate} from "@tanstack/react-router"
import {ArrowLeft} from "lucide-react"
import {z} from "zod"
import {AiSuggestionPanel} from "@/components/ai/judge-scheduler/ai-suggestion-panel"
import {Button} from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {getCompetitionWorkoutsFn} from "@/server-fns/competition-workouts-fns"

const searchParamsSchema = z.object({
  event: z.string().optional(),
})

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/ai-judge-scheduler",
)({
  validateSearch: searchParamsSchema,
  component: AiJudgeSchedulerPage,
  loaderDeps: ({search}) => ({event: search.event}),
  loader: async ({params, parentMatchPromise}) => {
    const parentMatch = await parentMatchPromise
    const {competition} = parentMatch.loaderData!
    if (!competition.competitionTeamId) {
      throw new Error("Competition team not found on this competition.")
    }
    const {workouts} = await getCompetitionWorkoutsFn({
      data: {
        competitionId: params.competitionId,
        teamId: competition.organizingTeamId,
      },
    })
    return {
      competition,
      events: workouts.map((w) => ({
        id: w.id,
        name: w.workout?.name ?? "Untitled event",
      })),
    }
  },
})

function AiJudgeSchedulerPage() {
  const {competition, events} = Route.useLoaderData()
  const {event: selectedEventId} = Route.useSearch()
  const navigate = useNavigate({from: Route.fullPath})

  const setSelectedEvent = (trackWorkoutId: string | undefined) => {
    navigate({
      search: (prev) => ({
        ...prev,
        event: trackWorkoutId || undefined,
      }),
    })
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-6 py-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8">
          <Link
            to="/compete/organizer/$competitionId/volunteers"
            params={{competitionId: competition.id}}
            search={{tab: "schedule" as const, event: selectedEventId}}
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to volunteers
          </Link>
        </Button>
        <h1 className="font-semibold text-2xl">AI Judge Scheduler</h1>
        <p className="text-muted-foreground text-sm">
          Pick an event and let the AI propose judge rotations to fill coverage
          gaps. Each proposal includes the agent's reason and a confidence
          signal — accept the ones you want and the rest is just suggestions.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="event" className="font-medium text-sm">
          Event
        </label>
        <Select
          value={selectedEventId ?? ""}
          onValueChange={(v) => setSelectedEvent(v || undefined)}
        >
          <SelectTrigger id="event" className="w-full">
            <SelectValue placeholder="Select an event…" />
          </SelectTrigger>
          <SelectContent>
            {events.map((evt) => (
              <SelectItem key={evt.id} value={evt.id}>
                {evt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedEventId && competition.competitionTeamId ? (
        <AiSuggestionPanel
          competitionId={competition.id}
          organizingTeamId={competition.organizingTeamId}
          competitionTeamId={competition.competitionTeamId}
          trackWorkoutId={selectedEventId}
        />
      ) : (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
          Pick an event above to start generating suggestions.
        </p>
      )}
    </div>
  )
}
