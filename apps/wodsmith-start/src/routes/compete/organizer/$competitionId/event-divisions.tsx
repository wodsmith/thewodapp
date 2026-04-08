/**
 * Event Division Mappings Route
 *
 * Organizer page for mapping which events are visible to which divisions.
 * Enables division-specific event variants — e.g., individual vs team versions
 * of the same workout with different scoring/time caps.
 *
 * When no mappings exist, all events are visible to all divisions (backwards compatible).
 */

import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Info } from "lucide-react"
import { EventDivisionMapper } from "@/components/event-division-mapper"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getEventDivisionMappingsFn } from "@/server-fns/event-division-mapping-fns"

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/event-divisions",
)({
  staleTime: 10_000,
  component: EventDivisionsPage,
  loader: async ({ params }) => {
    const mappingData = await getEventDivisionMappingsFn({
      data: { competitionId: params.competitionId },
    })

    return { mappingData }
  },
})

function EventDivisionsPage() {
  const { competitionId } = Route.useParams()
  const { mappingData } = Route.useLoaderData()
  const router = useRouter()

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Event Division Mappings
        </h2>
        <p className="text-muted-foreground">
          Control which events are visible to each division. Useful when
          individual and team divisions need different event variants.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>How it works</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>
              <strong>No mappings configured:</strong> All events are visible to
              all divisions (default behavior).
            </li>
            <li>
              <strong>Mappings configured:</strong> Only checked event-division
              pairs are active. Athletes only see events mapped to their
              division.
            </li>
            <li>
              Create separate event versions (e.g., &quot;Fran&quot; for
              individuals and &quot;Fran - Team&quot; for pairs) and map each to
              the appropriate divisions.
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Event &times; Division Matrix</CardTitle>
          <CardDescription>
            Check the boxes to map events to divisions. Click an event name to
            toggle all divisions, or click a division header to toggle all
            events.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventDivisionMapper
            competitionId={competitionId}
            data={mappingData}
            onSaved={async () => {
              // Trigger route revalidation
              await router.invalidate()
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
