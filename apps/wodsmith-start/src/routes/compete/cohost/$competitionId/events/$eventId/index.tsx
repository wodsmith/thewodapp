/**
 * Cohost Competition Event Edit Route
 *
 * Cohost page for editing a single competition event.
 * Reuses organizer UI components with cohost route paths.
 */

import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import { Plus, Video } from "lucide-react"
import { useState } from "react"
import { z } from "zod"
import {
  EVENT_DETAILS_FORM_ID,
  EventDetailsForm,
} from "@/components/events/event-details-form"
import { EventResourcesCard } from "@/components/events/event-resources-card"
import { EventJudgingSheets } from "@/components/organizer/event-judging-sheets"
import { EventSubmissionWindowCard } from "@/components/organizer/event-submission-window-card"
import { HeatSchedulePublishingCard } from "@/components/organizer/heat-schedule-publishing-card"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatTrackOrder } from "@/utils/format-track-order"

const parentRoute = getRouteApi("/compete/cohost/$competitionId")
const eventRoute = getRouteApi(
  "/compete/cohost/$competitionId/events/$eventId",
)

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/events/$eventId/",
)({
  validateSearch: z.object({
    tab: z.string().optional(),
  }),
  component: EventEditPage,
})

function EventEditPage() {
  const {
    event,
    divisions,
    movements,
    sponsors,
    divisionDescriptions,
    resources,
    judgingSheets: initialSheets,
    isOnline,
    submissionOpensAt,
    submissionClosesAt,
    timezone,
    childEvents,
  } = eventRoute.useLoaderData()
  const { competition } = parentRoute.useLoaderData()

  const [judgingSheets, setJudgingSheets] = useState(initialSheets)

  const isParentEvent = childEvents.length > 0

  if (isParentEvent) {
    return <ParentEventEditPage />
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Edit Event</h1>
          <p className="text-muted-foreground mt-1">
            Event #{formatTrackOrder(event.trackOrder)} - {event.workout.name}
          </p>
        </div>
        <Button type="submit" form={EVENT_DETAILS_FORM_ID}>
          Save Changes
        </Button>
      </div>

      {/* Event Details Form */}
      <EventDetailsForm
        event={event}
        competitionId={competition.id}
        organizingTeamId={competition.organizingTeamId}
        divisions={divisions}
        divisionDescriptions={divisionDescriptions}
        movements={movements}
        sponsors={sponsors}
      />

      {/* Event Resources */}
      <EventResourcesCard
        eventId={event.id}
        teamId={competition.organizingTeamId}
        initialResources={resources}
      />

      {/* Judging Sheets */}
      <EventJudgingSheets
        competitionId={competition.id}
        trackWorkoutId={event.id}
        sheets={judgingSheets}
        onSheetsChange={setJudgingSheets}
      />

      {/* Submission Window (online) or Heat Schedule Publishing (in-person) */}
      {isOnline ? (
        <>
          <EventSubmissionWindowCard
            competitionId={competition.id}
            eventName={event.workout.name}
            submissionOpensAt={submissionOpensAt}
            submissionClosesAt={submissionClosesAt}
            timezone={timezone}
          />

          {/* Video Submissions Review Link */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Video Submissions
              </CardTitle>
              <CardDescription>
                Review athlete video submissions for this event
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link
                  to="/compete/cohost/$competitionId/events/$eventId/submissions"
                  params={{
                    competitionId: competition.id,
                    eventId: event.id,
                  }}
                >
                  View Submissions
                </Link>
              </Button>
            </CardContent>
          </Card>
        </>
      ) : (
        <HeatSchedulePublishingCard
          trackWorkoutId={event.id}
          eventName={event.workout.name}
          competitionId={competition.id}
          organizingTeamId={competition.organizingTeamId}
        />
      )}
    </>
  )
}

/**
 * Parent event detail page — shows tabbed sub-event sections
 */
function ParentEventEditPage() {
  const {
    event,
    divisions,
    movements,
    sponsors,
    divisionDescriptions,
    resources,
    judgingSheets: initialSheets,
    childEvents,
    childDivisionDescriptions,
  } = eventRoute.useLoaderData()
  const { competition } = parentRoute.useLoaderData()
  const { tab } = Route.useSearch()

  const [judgingSheets, setJudgingSheets] = useState(initialSheets)

  const defaultTab =
    (tab && childEvents.some((c) => c.id === tab) ? tab : childEvents[0]?.id) ??
    ""
  const [activeTab, setActiveTab] = useState(defaultTab)

  const getChildFormId = (childId: string) => `event-details-form-${childId}`
  const parentFormId = `event-details-form-${event.id}`
  const activeFormId = activeTab ? getChildFormId(activeTab) : parentFormId

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{event.workout.name}</h1>
          <p className="text-muted-foreground mt-1">
            Parent event with {childEvents.length} sub-event
            {childEvents.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link
              to="/compete/cohost/$competitionId/events"
              params={{ competitionId: competition.id }}
            >
              Back to Events
            </Link>
          </Button>
          <Button type="submit" form={activeFormId}>
            Save Changes
          </Button>
        </div>
      </div>

      {/* Parent event overview card */}
      <Card>
        <CardHeader>
          <CardTitle>Parent Event Settings</CardTitle>
          <CardDescription>
            Configure the parent event name and description. Scoring is
            configured per sub-event below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventDetailsForm
            event={event}
            competitionId={competition.id}
            organizingTeamId={competition.organizingTeamId}
            divisions={divisions}
            divisionDescriptions={divisionDescriptions}
            movements={movements}
            sponsors={sponsors}
            isParentEvent
            formId={parentFormId}
          />
        </CardContent>
      </Card>

      {/* Tabbed sub-events */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sub-Events</CardTitle>
              <CardDescription>
                Each sub-event has its own workout, scoring scheme, and scaling
                descriptions.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link
                to="/compete/cohost/$competitionId/events"
                params={{ competitionId: competition.id }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Sub-Event
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-fit flex-wrap h-auto gap-1 mb-4">
              {childEvents.map((child, index) => (
                <TabsTrigger key={child.id} value={child.id}>
                  {child.workout.name || `Sub-Event ${index + 1}`}
                </TabsTrigger>
              ))}
            </TabsList>
            {childEvents.map((child) => (
              <TabsContent key={child.id} value={child.id}>
                <EventDetailsForm
                  event={child}
                  competitionId={competition.id}
                  organizingTeamId={competition.organizingTeamId}
                  divisions={divisions}
                  divisionDescriptions={
                    childDivisionDescriptions[child.workoutId] ?? []
                  }
                  movements={movements}
                  sponsors={sponsors}
                  formId={getChildFormId(child.id)}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Event Resources */}
      <EventResourcesCard
        eventId={event.id}
        teamId={competition.organizingTeamId}
        initialResources={resources}
      />

      {/* Judging Sheets */}
      <EventJudgingSheets
        competitionId={competition.id}
        trackWorkoutId={event.id}
        sheets={judgingSheets}
        onSheetsChange={setJudgingSheets}
      />
    </>
  )
}
