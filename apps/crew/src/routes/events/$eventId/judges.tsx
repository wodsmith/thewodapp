// @lat: [[crew#Judge Rotations]]

import {
  createFileRoute,
  getRouteApi,
  Link,
  useNavigate,
  useSearch,
} from "@tanstack/react-router"
import {
  type CrewJudgeRotationsPageData,
  getCrewJudgeRotationsPageFn,
} from "@/server-fns/crew-judge-rotations-fns"
import { JudgeSchedulingContainer } from "./-components/judges/judge-scheduling-container"

export const Route = createFileRoute("/events/$eventId/judges")({
  loader: async ({ params }) =>
    await getCrewJudgeRotationsPageFn({ data: { eventId: params.eventId } }),
  component: EventJudgeAssignmentsPage,
})

const parentRoute = getRouteApi("/events/$eventId")

interface CrewJudgeAssignmentsAvailability {
  available: boolean
  title: string
  description: string
}

function getJudgeAssignmentsAvailability(
  page: CrewJudgeRotationsPageData | null,
): CrewJudgeAssignmentsAvailability {
  if (page && page.workouts.length > 0 && page.heats.length > 0) {
    return {
      available: true,
      title: "Judge assignments are ready",
      description: "Workouts and heats are available for judge scheduling.",
    }
  }

  return {
    available: false,
    title: "Judge assignments are not ready yet",
    description:
      "Import or create the event workouts and heat schedule before assigning judges.",
  }
}

function EventJudgeAssignmentsPage() {
  const { eventId } = parentRoute.useParams()
  const data = Route.useLoaderData()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { workout?: string }
  const availability = getJudgeAssignmentsAvailability(data.page)

  const { page } = data
  const selectedWorkoutId =
    search.workout &&
    page.workouts.some((workout) => workout.id === search.workout)
      ? search.workout
      : (page.workouts[0]?.id ?? "")

  function handleWorkoutChange(workoutId: string) {
    void navigate({
      to: ".",
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        workout: workoutId,
      }),
      replace: true,
    })
  }

  return (
    <section className="space-y-6">
      <div className="max-w-3xl">
        <h2 className="text-xl font-semibold">Judge assignments</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Drag judges onto heat lanes to plan rotations, then publish the judge
          schedule for each workout.
        </p>
      </div>

      {availability.available ? (
        <JudgeSchedulingContainer
          eventId={eventId}
          page={page}
          selectedWorkoutId={selectedWorkoutId}
          onWorkoutChange={handleWorkoutChange}
        />
      ) : (
        <JudgeAssignmentsUnavailable
          eventId={eventId}
          availability={availability}
        />
      )}
    </section>
  )
}

function JudgeAssignmentsUnavailable({
  eventId,
  availability,
}: {
  eventId: string
  availability: CrewJudgeAssignmentsAvailability
}) {
  return (
    <section className="rounded-md border bg-card p-8 shadow-sm">
      <div className="max-w-2xl">
        <h3 className="text-lg font-semibold">{availability.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {availability.description}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/events/$eventId/heats"
            params={{ eventId }}
            className="inline-flex h-10 w-fit items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Import heat schedule
          </Link>
          <Link
            to="/events/$eventId/setup"
            params={{ eventId }}
            className="inline-flex h-10 w-fit items-center rounded-md border px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            Review setup
          </Link>
        </div>
      </div>
    </section>
  )
}
