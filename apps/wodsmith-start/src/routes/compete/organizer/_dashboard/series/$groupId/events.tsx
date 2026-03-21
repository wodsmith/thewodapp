import {
  createFileRoute,
  Link,
  useRouter,
} from "@tanstack/react-router"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { useState } from "react"
import { EventTemplateCreator } from "@/components/series/event-template-creator"
import { SeriesEventSyncDialog } from "@/components/series/series-event-sync-dialog"
import { SeriesTemplateEventEditor } from "@/components/series/series-template-event-editor"
import { Button } from "@/components/ui/button"
import { getAllMovementsFn } from "@/server-fns/movement-fns"
import {
  getSeriesCompetitionsForTemplateFn,
  getSeriesTemplateEventsFn,
} from "@/server-fns/series-event-template-fns"

export const Route = createFileRoute(
  "/compete/organizer/_dashboard/series/$groupId/events",
)({
  component: SeriesEventsPage,
  loader: async ({ params }) => {
    const [templateResult, competitionsResult, movementsResult] =
      await Promise.all([
        getSeriesTemplateEventsFn({
          data: { groupId: params.groupId },
        }),
        getSeriesCompetitionsForTemplateFn({
          data: { groupId: params.groupId },
        }),
        getAllMovementsFn(),
      ])
    return {
      ...templateResult,
      competitions: competitionsResult.competitions,
      movements: movementsResult.movements,
    }
  },
})

function SeriesEventsPage() {
  const { groupId } = Route.useParams()
  const loaderData = Route.useLoaderData()
  const router = useRouter()

  const [templateTrack, setTemplateTrack] = useState(loaderData.templateTrack)
  const [events, setEvents] = useState(loaderData.events)
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false)

  const refreshData = async () => {
    await router.invalidate()
    const refreshed = await getSeriesTemplateEventsFn({
      data: { groupId },
    })
    setTemplateTrack(refreshed.templateTrack)
    setEvents(refreshed.events)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <div className="mb-4">
            <Button variant="ghost" size="sm" asChild>
              <Link
                to="/compete/organizer/series/$groupId"
                params={{ groupId }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Series
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Event Template</h1>
          <p className="text-muted-foreground mt-1">
            Define the series event template. Events defined here will be used
            as the standard across all competitions in the series.
          </p>
        </div>

        {/* Content */}
        {!templateTrack ? (
          <EventTemplateCreator
            groupId={groupId}
            competitions={loaderData.competitions}
            onTemplateCreated={refreshData}
          />
        ) : (
          <>
            <SeriesTemplateEventEditor
              groupId={groupId}
              trackId={templateTrack.id}
              events={events}
              movements={loaderData.movements}
              onEventsChanged={refreshData}
            />

            {/* Sync to Competitions */}
            {events.length > 0 && (
              <div className="flex items-center gap-2">
                <Button onClick={() => setIsSyncDialogOpen(true)}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync to Competitions
                </Button>
              </div>
            )}

            <SeriesEventSyncDialog
              groupId={groupId}
              open={isSyncDialogOpen}
              onOpenChange={setIsSyncDialogOpen}
              onSynced={refreshData}
            />
          </>
        )}
      </div>
    </div>
  )
}
