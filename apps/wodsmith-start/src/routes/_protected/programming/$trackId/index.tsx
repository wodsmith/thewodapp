import { createFileRoute, useRouter } from "@tanstack/react-router"
import { TrackDetailView } from "@/components/track-detail-view"
import {
  CROSSFIT_TRACK_ID,
  crossFitScheduledDate,
  sourceDateSchema,
} from "@/lib/crossfit/source"
import { getCrossFitTrackDaysFn } from "@/server-fns/crossfit-import-fns"
import {
  getProgrammingTrackByIdFn,
  getTrackWorkoutsFn,
} from "@/server-fns/programming-fns"
import { getTrackFollowStateFn } from "@/server-fns/track-follow-fns"
export const Route = createFileRoute("/_protected/programming/$trackId/")({
  validateSearch: (search: Record<string, unknown>): { date?: string } => ({
    date: sourceDateSchema.safeParse(search.date).success
      ? String(search.date)
      : undefined,
  }),
  loaderDeps: ({ search }) => ({ date: search.date }),
  loader: async ({ params, context, deps }) => {
    const date =
      deps.date ??
      (params.trackId === CROSSFIT_TRACK_ID
        ? crossFitScheduledDate(Date.now())
        : undefined)
    const [track, workouts, days, selected, state] = await Promise.all([
      getProgrammingTrackByIdFn({ data: { trackId: params.trackId } }),
      getTrackWorkoutsFn({ data: { trackId: params.trackId } }),
      getCrossFitTrackDaysFn({ data: { trackId: params.trackId } }),
      getCrossFitTrackDaysFn({ data: { trackId: params.trackId, date } }),
      getTrackFollowStateFn({ data: { trackId: params.trackId } }),
    ])
    return {
      track: track.track,
      workouts: workouts.workouts,
      days,
      selected,
      state,
      date,
      canManageImports:
        context.session?.user?.role === "admin" &&
        params.trackId === CROSSFIT_TRACK_ID,
    }
  },
  component: PublicTrackDetailPage,
})
function PublicTrackDetailPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const navigate = Route.useNavigate()
  return (
    <TrackDetailView
      data={data}
      onChanged={() => {
        void router.invalidate()
      }}
      onDateChange={(date) => {
        void navigate({ search: { date } })
      }}
    />
  )
}
