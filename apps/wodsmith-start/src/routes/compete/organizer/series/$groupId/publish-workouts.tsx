import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { CheckSquare, Eye, EyeOff, Loader2, Search, Square } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  bulkUpdateSeriesCompetitionEventStatusFn,
  getSeriesCompetitionEventPublishStatusFn,
  type SeriesCompetitionPublishEvent,
} from "@/server-fns/series-event-template-fns"
import { formatTrackOrder } from "@/utils/format-track-order"

type EventStatusFilter = "all" | "draft" | "published"
type EventStatus = "draft" | "published"

export const Route = createFileRoute(
  "/compete/organizer/series/$groupId/publish-workouts",
)({
  component: SeriesPublishWorkoutsPage,
  loader: async ({ params }) => {
    return getSeriesCompetitionEventPublishStatusFn({
      data: { groupId: params.groupId },
    })
  },
})

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function eventMatchesSearch(
  competitionName: string,
  event: SeriesCompetitionPublishEvent,
  search: string,
) {
  if (!search) return true
  const haystack = normalizeSearchText(
    [
      competitionName,
      event.name,
      ...event.childEvents.map((childEvent) => childEvent.name),
    ].join(" "),
  )
  return search.split(" ").every((token) => !token || haystack.includes(token))
}

function statusBadge(status: EventStatus | null) {
  const isPublished = status === "published"
  return (
    <Badge
      variant="outline"
      className={
        isPublished
          ? "border-green-600 text-green-600"
          : "border-muted-foreground/40 text-muted-foreground"
      }
    >
      {isPublished ? (
        <Eye className="mr-1 h-3 w-3" />
      ) : (
        <EyeOff className="mr-1 h-3 w-3" />
      )}
      {isPublished ? "Published" : "Draft"}
    </Badge>
  )
}

function SeriesPublishWorkoutsPage() {
  const { groupId } = Route.useParams()
  const loaderData = Route.useLoaderData()
  const router = useRouter()
  const bulkUpdateStatus = useServerFn(bulkUpdateSeriesCompetitionEventStatusFn)

  const [competitions, setCompetitions] = useState(loaderData.competitions)
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<EventStatusFilter>("all")
  const [pendingStatus, setPendingStatus] = useState<EventStatus | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    setCompetitions(loaderData.competitions)
  }, [loaderData.competitions])

  const allEvents = useMemo(
    () => competitions.flatMap((competition) => competition.events),
    [competitions],
  )

  useEffect(() => {
    const validIds = new Set(allEvents.map((event) => event.id))
    setSelectedEventIds((previous) => {
      const next = new Set(
        [...previous].filter((eventId) => validIds.has(eventId)),
      )
      return next.size === previous.size ? previous : next
    })
  }, [allEvents])

  const normalizedSearch = useMemo(() => normalizeSearchText(search), [search])

  const filteredCompetitions = useMemo(() => {
    const hasFilters = normalizedSearch.length > 0 || statusFilter !== "all"
    return competitions
      .map((competition) => ({
        ...competition,
        events: competition.events.filter((event) => {
          if (
            statusFilter !== "all" &&
            (event.eventStatus ?? "draft") !== statusFilter
          ) {
            return false
          }
          return eventMatchesSearch(
            competition.competition.name,
            event,
            normalizedSearch,
          )
        }),
      }))
      .filter((competition) => competition.events.length > 0 || !hasFilters)
  }, [competitions, normalizedSearch, statusFilter])

  const visibleDraftEventIds = useMemo(
    () =>
      filteredCompetitions.flatMap((competition) =>
        competition.events
          .filter((event) => event.eventStatus !== "published")
          .map((event) => event.id),
      ),
    [filteredCompetitions],
  )

  const selectedEvents = useMemo(
    () => allEvents.filter((event) => selectedEventIds.has(event.id)),
    [allEvents, selectedEventIds],
  )
  const publishedCount = allEvents.filter(
    (event) => event.eventStatus === "published",
  ).length
  const draftCount = allEvents.length - publishedCount
  const selectedChildCount = selectedEvents.reduce(
    (sum, event) => sum + event.childEvents.length,
    0,
  )

  const refreshData = async () => {
    await router.invalidate()
    const result = await getSeriesCompetitionEventPublishStatusFn({
      data: { groupId },
    })
    setCompetitions(result.competitions)
  }

  const toggleEvent = (eventId: string) => {
    setSelectedEventIds((previous) => {
      const next = new Set(previous)
      if (next.has(eventId)) {
        next.delete(eventId)
      } else {
        next.add(eventId)
      }
      return next
    })
  }

  const handleSelectVisibleDrafts = () => {
    setSelectedEventIds(new Set(visibleDraftEventIds))
  }

  const handleConfirmStatusUpdate = async () => {
    if (!pendingStatus || selectedEventIds.size === 0) return
    setIsUpdating(true)
    try {
      const result = await bulkUpdateStatus({
        data: {
          groupId,
          trackWorkoutIds: [...selectedEventIds],
          eventStatus: pendingStatus,
        },
      })
      const action = pendingStatus === "published" ? "Published" : "Unpublished"
      toast.success(
        `${action} ${result.parentUpdated} workout${
          result.parentUpdated !== 1 ? "s" : ""
        }`,
      )
      setSelectedEventIds(new Set())
      setPendingStatus(null)
      await refreshData()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update workout visibility",
      )
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Publish Workouts</CardTitle>
              <CardDescription>
                Manage visibility for workouts that already exist on
                competitions in this series.
              </CardDescription>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[20rem]">
              <div className="rounded-md border px-3 py-2">
                <div className="text-lg font-semibold tabular-nums">
                  {allEvents.length}
                </div>
                <div className="text-xs text-muted-foreground">Workouts</div>
              </div>
              <div className="rounded-md border px-3 py-2">
                <div className="text-lg font-semibold tabular-nums">
                  {publishedCount}
                </div>
                <div className="text-xs text-muted-foreground">Published</div>
              </div>
              <div className="rounded-md border px-3 py-2">
                <div className="text-lg font-semibold tabular-nums">
                  {draftCount}
                </div>
                <div className="text-xs text-muted-foreground">Draft</div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative sm:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search competitions or workouts..."
                  className="pl-9"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as EventStatusFilter)
                }
              >
                <SelectTrigger className="sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft only</SelectItem>
                  <SelectItem value="published">Published only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectVisibleDrafts}
                disabled={visibleDraftEventIds.length === 0}
              >
                <CheckSquare className="mr-2 h-4 w-4" />
                Select Visible Drafts
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedEventIds(new Set())}
                disabled={selectedEventIds.size === 0}
              >
                <Square className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedEventIds.size} event
              {selectedEventIds.size !== 1 ? "s" : ""}
              {selectedChildCount > 0
                ? ` including ${selectedChildCount} Sub event${
                    selectedChildCount !== 1 ? "s" : ""
                  }`
                : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => setPendingStatus("published")}
                disabled={selectedEventIds.size === 0}
              >
                <Eye className="mr-2 h-4 w-4" />
                Publish Selected
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPendingStatus("draft")}
                disabled={selectedEventIds.size === 0}
              >
                <EyeOff className="mr-2 h-4 w-4" />
                Unpublish Selected
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {competitions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No competitions in this series</CardTitle>
            <CardDescription>
              Add competitions to the series before publishing workouts.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : filteredCompetitions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            No workouts match the current filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredCompetitions.map((competition) => {
            const competitionPublishedCount = competition.events.filter(
              (event) => event.eventStatus === "published",
            ).length
            return (
              <Card key={competition.competition.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base">
                        <Link
                          to="/compete/organizer/$competitionId/events"
                          params={{
                            competitionId: competition.competition.id,
                          }}
                          className="hover:underline"
                        >
                          {competition.competition.name}
                        </Link>
                      </CardTitle>
                      <CardDescription>
                        {competitionPublishedCount} published,{" "}
                        {competition.events.length - competitionPublishedCount}{" "}
                        draft
                      </CardDescription>
                    </div>
                    <Badge variant="outline">
                      {competition.events.length} workout
                      {competition.events.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {competition.events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No workouts have been created for this competition.
                    </p>
                  ) : (
                    <div className="divide-y rounded-md border">
                      {competition.events.map((event) => (
                        // biome-ignore lint/a11y/noLabelWithoutControl: Radix Checkbox renders internal input
                        <label
                          key={event.id}
                          className="flex cursor-pointer items-start gap-3 px-3 py-3 hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={selectedEventIds.has(event.id)}
                            onCheckedChange={() => toggleEvent(event.id)}
                            className="mt-1"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="w-7 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                                  {formatTrackOrder(event.trackOrder)}
                                </span>
                                <span className="truncate text-sm font-medium">
                                  {event.name}
                                </span>
                              </span>
                              <span className="shrink-0">
                                {statusBadge(event.eventStatus)}
                              </span>
                            </span>
                            {event.childEvents.length > 0 ? (
                              <span className="ml-9 mt-2 flex flex-wrap gap-1">
                                {event.childEvents.map((childEvent) => (
                                  <Badge
                                    key={childEvent.id}
                                    variant="outline"
                                    className="font-normal"
                                  >
                                    {childEvent.name}
                                  </Badge>
                                ))}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <AlertDialog
        open={pendingStatus !== null}
        onOpenChange={(open) => {
          if (!open && !isUpdating) setPendingStatus(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus === "published"
                ? "Publish selected workouts?"
                : "Unpublish selected workouts?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will set {selectedEventIds.size} parent workout
              {selectedEventIds.size !== 1 ? "s" : ""}{" "}
              {pendingStatus === "published" ? "visible" : "hidden"} on their
              competition workout pages. Any sub-events under those workouts
              will be updated too.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
            <Button onClick={handleConfirmStatusUpdate} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : pendingStatus === "published" ? (
                "Publish Workouts"
              ) : (
                "Unpublish Workouts"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
