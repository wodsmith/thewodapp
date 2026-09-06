import { createFileRoute, redirect } from "@tanstack/react-router"

// Old bookmarks now open a preview; following this URL never schedules a workout.
export const Route = createFileRoute(
  "/_protected/workouts/$workoutId/schedule/",
)({
  validateSearch: (
    search: Record<string, unknown>,
  ): { teamId?: string; date?: string } => ({
    teamId: typeof search.teamId === "string" ? search.teamId : undefined,
    date: typeof search.date === "string" ? search.date : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/training",
      search: {
        ...search,
        view: "training",
        teamId: search.teamId,
        date: search.date,
        workoutId: params.workoutId,
      },
    })
  },
})
