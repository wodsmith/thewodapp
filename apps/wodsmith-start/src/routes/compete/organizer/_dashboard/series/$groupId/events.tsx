import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowLeft, Loader2, Plus, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { SeriesEventMapper } from "@/components/series-event-mapper"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
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
import { usePostHog } from "@/lib/posthog"
import {
  createSeriesTemplateTrackFn,
  getCompetitionEventSyncStatusFn,
  getSeriesEventMappingsFn,
  getSeriesTemplateEventsFn,
  previewSyncEventsToCompetitionsFn,
  type SyncEventsPreviewResult,
  syncTemplateEventsToCompetitionsFn,
} from "@/server-fns/series-event-template-fns"

export const Route = createFileRoute(
  "/compete/organizer/_dashboard/series/$groupId/events",
)({
  component: SeriesEventsPage,
  loader: async ({ params }) => {
    const [templateResult, mappingsResult] = await Promise.all([
      getSeriesTemplateEventsFn({
        data: { groupId: params.groupId },
      }),
      getSeriesEventMappingsFn({
        data: { groupId: params.groupId },
      }),
    ])
    return { ...templateResult, competitionMappings: mappingsResult.competitionMappings }
  },
})

function SeriesEventsPage() {
  const { groupId } = Route.useParams()
  const loaderData = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const { posthog } = usePostHog()

  const [templateTrack, setTemplateTrack] = useState(loaderData.templateTrack)
  const [events, setEvents] = useState(loaderData.events)
  const [competitionMappings, setCompetitionMappings] = useState(
    loaderData.competitionMappings,
  )
  const [isCreating, setIsCreating] = useState(false)
  const [syncStep, setSyncStep] = useState<"select" | "preview" | null>(null)
  const [syncStatuses, setSyncStatuses] = useState<
    Array<{
      competitionId: string
      competitionName: string
      status: "in-sync" | "behind" | "custom" | "unmapped"
    }>
  >([])
  const [selectedCompetitionIds, setSelectedCompetitionIds] = useState<
    Set<string>
  >(new Set())
  const [syncPreview, setSyncPreview] = useState<SyncEventsPreviewResult | null>(
    null,
  )
  const [isLoadingStatus, setIsLoadingStatus] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const createTemplateTrack = useServerFn(createSeriesTemplateTrackFn)
  const getCompetitionSyncStatus = useServerFn(getCompetitionEventSyncStatusFn)
  const previewSyncEvents = useServerFn(previewSyncEventsToCompetitionsFn)
  const syncTemplateEvents = useServerFn(syncTemplateEventsToCompetitionsFn)

  const [flagEnabled, setFlagEnabled] = useState(() =>
    posthog.isFeatureEnabled("competition-global-leaderboard"),
  )

  useEffect(() => {
    const unsubscribe = posthog.onFeatureFlags(() => {
      setFlagEnabled(posthog.isFeatureEnabled("competition-global-leaderboard"))
    })
    return unsubscribe
  }, [posthog])

  useEffect(() => {
    if (flagEnabled === false) {
      navigate({
        to: "/compete/organizer/series/$groupId",
        replace: true,
        params: { groupId },
      })
    }
  }, [flagEnabled, groupId, navigate])

  if (flagEnabled === false) return null

  const refreshData = async () => {
    await router.invalidate()
    const [refreshed, mappingsRefreshed] = await Promise.all([
      getSeriesTemplateEventsFn({
        data: { groupId },
      }),
      getSeriesEventMappingsFn({
        data: { groupId },
      }),
    ])
    setTemplateTrack(refreshed.templateTrack)
    setEvents(refreshed.events)
    setCompetitionMappings(mappingsRefreshed.competitionMappings)
  }

  const handleCreateTemplateTrack = async () => {
    setIsCreating(true)
    try {
      await createTemplateTrack({
        data: { groupId },
      })
      toast.success("Event template created")
      await refreshData()
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to create event template",
      )
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenSyncDialog = async () => {
    setIsLoadingStatus(true)
    setSyncStep("select")
    try {
      const result = await getCompetitionSyncStatus({
        data: { groupId },
      })
      setSyncStatuses(result.competitions)
      // Pre-select "behind" and "unmapped" competitions
      setSelectedCompetitionIds(
        new Set(
          result.competitions
            .filter((c) => c.status === "behind" || c.status === "unmapped")
            .map((c) => c.competitionId),
        ),
      )
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to load sync status",
      )
      setSyncStep(null)
    } finally {
      setIsLoadingStatus(false)
    }
  }

  const handleSelectAllBehind = () => {
    setSelectedCompetitionIds(
      new Set(
        syncStatuses
          .filter((c) => c.status === "behind" || c.status === "unmapped")
          .map((c) => c.competitionId),
      ),
    )
  }

  const toggleCompetition = (competitionId: string) => {
    setSelectedCompetitionIds((prev) => {
      const next = new Set(prev)
      if (next.has(competitionId)) {
        next.delete(competitionId)
      } else {
        next.add(competitionId)
      }
      return next
    })
  }

  const handlePreviewStep = async () => {
    if (selectedCompetitionIds.size === 0) return
    setIsLoadingPreview(true)
    try {
      const preview = await previewSyncEvents({
        data: {
          groupId,
          competitionIds: Array.from(selectedCompetitionIds),
        },
      })
      setSyncPreview(preview)
      setSyncStep("preview")
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to load preview",
      )
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const handleSyncConfirm = async () => {
    setSyncStep(null)
    setIsSyncing(true)
    try {
      const result = await syncTemplateEvents({
        data: {
          groupId,
          competitionIds: Array.from(selectedCompetitionIds),
        },
      })
      toast.success(
        `Synced ${result.synced} event${result.synced !== 1 ? "s" : ""} across competitions`,
      )
      await refreshData()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to sync events")
    } finally {
      setIsSyncing(false)
      setSyncPreview(null)
      setSelectedCompetitionIds(new Set())
    }
  }

  const handleCloseSyncDialog = (open: boolean) => {
    if (!open) {
      setSyncStep(null)
      setSyncPreview(null)
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "in-sync":
        return (
          <Badge variant="outline" className="text-green-600 border-green-600">
            In sync
          </Badge>
        )
      case "behind":
        return (
          <Badge variant="outline" className="text-orange-600 border-orange-600">
            Behind
          </Badge>
        )
      case "custom":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            Custom
          </Badge>
        )
      case "unmapped":
        return (
          <Badge variant="outline" className="text-gray-500 border-gray-500">
            Unmapped
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Sync Dialog */}
      <AlertDialog
        open={syncStep !== null}
        onOpenChange={handleCloseSyncDialog}
      >
        <AlertDialogContent className="max-h-[80vh] overflow-y-auto">
          {syncStep === "select" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Select Competitions to Sync
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Choose which competitions should receive the template events.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {isLoadingStatus ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : syncStatuses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No competitions found in this series.
                </p>
              ) : (
                <div className="space-y-3 py-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllBehind}
                  >
                    Select All Behind
                  </Button>
                  <div className="space-y-2">
                    {syncStatuses.map((comp) => (
                      <label
                        key={comp.competitionId}
                        className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selectedCompetitionIds.has(
                            comp.competitionId,
                          )}
                          onCheckedChange={() =>
                            toggleCompetition(comp.competitionId)
                          }
                        />
                        <span className="flex-1 text-sm font-medium">
                          {comp.competitionName}
                        </span>
                        {statusBadge(comp.status)}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button
                  onClick={handlePreviewStep}
                  disabled={
                    selectedCompetitionIds.size === 0 || isLoadingPreview
                  }
                >
                  {isLoadingPreview ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Next"
                  )}
                </Button>
              </AlertDialogFooter>
            </>
          )}
          {syncStep === "preview" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Preview Sync Changes</AlertDialogTitle>
                <AlertDialogDescription>
                  {syncPreview
                    ? `The following changes will be applied to ${syncPreview.competitions.length} competition${syncPreview.competitions.length !== 1 ? "s" : ""}:`
                    : "Loading preview..."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {syncPreview && (
                <div className="space-y-4 py-2">
                  {syncPreview.competitions.map((comp) => (
                    <div key={comp.competitionId}>
                      <span className="text-sm font-semibold">
                        {comp.competitionName}
                      </span>
                      <ul className="mt-1 space-y-1">
                        {comp.events.map((evt) => (
                          <li
                            key={evt.eventName}
                            className="text-sm text-muted-foreground ml-4"
                          >
                            <span className="font-medium text-foreground">
                              {evt.eventName}
                            </span>
                            :{" "}
                            {evt.isNew ? (
                              <span className="text-green-600 dark:text-green-400">
                                (new){" "}
                              </span>
                            ) : null}
                            {evt.changes.join(", ")}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              <AlertDialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setSyncStep("select")}
                >
                  Back
                </Button>
                <AlertDialogAction onClick={handleSyncConfirm}>
                  Sync {syncPreview?.totalEvents ?? 0} Event
                  {syncPreview?.totalEvents !== 1 ? "s" : ""}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
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
          <Card>
            <CardHeader>
              <CardTitle>No Event Template</CardTitle>
              <CardDescription>
                Create an event template to define the standard events for this
                series. Once created, you can add events and sync them to all
                competitions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleCreateTemplateTrack}
                disabled={isCreating}
              >
                <Plus className="h-4 w-4 mr-2" />
                {isCreating ? "Creating..." : "Create Event Template"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Series Events</CardTitle>
                <CardDescription>
                  Events defined in the series template. These events will be
                  synced to all competitions in the series.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No events yet. Events will appear here once they are added to
                    the template.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {events.map((event, index) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 rounded-md border p-3"
                      >
                        <span className="text-xs text-muted-foreground font-mono w-6 text-center shrink-0">
                          #{event.order ?? index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">
                            {event.name}
                          </span>
                        </div>
                        {event.scoreType && (
                          <Badge variant="secondary" className="shrink-0">
                            {event.scoreType}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sync to Competitions */}
            {events.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleOpenSyncDialog}
                  disabled={isSyncing || isLoadingStatus}
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`}
                  />
                  {isSyncing
                    ? "Syncing..."
                    : "Sync to Competitions"}
                </Button>
              </div>
            )}

            {/* Event Mappings */}
            {events.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Competition Event Mappings</CardTitle>
                  <CardDescription>
                    Map each competition's events to the series template.
                    Unmapped events are excluded from the leaderboard.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {competitionMappings.length === 0 ? (
                    <Alert variant="default" className="border-dashed">
                      <AlertTitle>No competitions in series</AlertTitle>
                      <AlertDescription>
                        Add competitions to this series first, then configure
                        event mappings.
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
          </>
        )}
      </div>
    </div>
  )
}
