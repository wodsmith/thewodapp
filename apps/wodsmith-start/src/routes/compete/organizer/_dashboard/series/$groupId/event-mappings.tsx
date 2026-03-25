import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"
import { SeriesEventMapper } from "@/components/series-event-mapper"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  getSeriesEventMappingsFn,
  getSeriesTemplateEventsFn,
} from "@/server-fns/series-event-template-fns"

export const Route = createFileRoute(
  "/compete/organizer/_dashboard/series/$groupId/event-mappings",
)({
  component: SeriesEventMappingsPage,
  loader: async ({ params }) => {
    const [templateResult, mappingsResult] = await Promise.all([
      getSeriesTemplateEventsFn({
        data: { groupId: params.groupId },
      }),
      getSeriesEventMappingsFn({
        data: { groupId: params.groupId },
      }),
    ])
    return {
      ...templateResult,
      competitionMappings: mappingsResult.competitionMappings,
    }
  },
})

function SeriesEventMappingsPage() {
  const { groupId } = Route.useParams()
  const loaderData = Route.useLoaderData()
  const router = useRouter()

  const [competitionMappings, setCompetitionMappings] = useState(
    loaderData.competitionMappings,
  )

  const refreshData = async () => {
    await router.invalidate()
    const mappingsRefreshed = await getSeriesEventMappingsFn({
      data: { groupId },
    })
    setCompetitionMappings(mappingsRefreshed.competitionMappings)
  }

  const { templateTrack, events } = loaderData

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
          <h1 className="text-3xl font-bold">Match Events</h1>
          <p className="text-muted-foreground mt-1">
            Tell us which event in each competition matches the series
            template. Unmatched events won't count toward the leaderboard.
          </p>
        </div>

        {/* Content */}
        {!templateTrack ? (
          <Alert>
            <AlertTitle>No event template</AlertTitle>
            <AlertDescription>
              Create an event template first before matching events.{" "}
              <Link
                to="/compete/organizer/series/$groupId/events"
                params={{ groupId }}
                className="underline font-medium"
              >
                Go to Event Template
              </Link>
            </AlertDescription>
          </Alert>
        ) : events.length === 0 ? (
          <Alert>
            <AlertTitle>No events in template</AlertTitle>
            <AlertDescription>
              Add events to the template before matching events.{" "}
              <Link
                to="/compete/organizer/series/$groupId/events"
                params={{ groupId }}
                className="underline font-medium"
              >
                Go to Event Template
              </Link>
            </AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Match Competition Events</CardTitle>
              <CardDescription>
                Choose which event in each competition corresponds to each
                series template event. Unmatched events won't count toward
                the leaderboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {competitionMappings.length === 0 ? (
                <Alert variant="default" className="border-dashed">
                  <AlertTitle>No competitions in series</AlertTitle>
                  <AlertDescription>
                    Add competitions to this series first, then match
                    their events.
                  </AlertDescription>
                </Alert>
              ) : (
                <SeriesEventMapper
                  groupId={groupId}
                  template={{
                    events: events.map((e) => ({
                      id: e.id,
                      name: e.name,
                      order: e.order,
                      scoreType: e.scoreType,
                    })),
                  }}
                  initialMappings={competitionMappings}
                  onSaved={refreshData}
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
