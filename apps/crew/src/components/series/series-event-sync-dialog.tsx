"use client"

import { useServerFn } from "@tanstack/react-start"
import {
  CheckCircle2,
  Link2,
  Loader2,
  PlusCircle,
  RotateCw,
  Search,
} from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  type CompetitionEventSyncStatus,
  getCompetitionEventSyncStatusFn,
  previewSyncEventsToCompetitionsFn,
  type SyncEventsPreviewResult,
  syncTemplateEventsToCompetitionsFn,
} from "@/server-fns/series-event-template-fns"

interface SeriesEventSyncDialogProps {
  groupId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSynced: () => Promise<void>
  selectedTemplateEventIds: string[]
  selectedTemplateEvents: Array<{
    id: string
    name: string
    childEvents?: Array<{
      id: string
      name: string
    }>
  }>
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function tokenizeSearchText(value: string): string[] {
  const normalized = normalizeSearchText(value)
  return normalized ? normalized.split(" ") : []
}

function expandSearchToken(token: string): string[] {
  switch (token) {
    case "individual":
      return ["individual", "indy"]
    case "indy":
      return ["indy", "individual"]
    case "team":
      return ["team", "partner"]
    case "partner":
      return ["partner", "team"]
    default:
      return [token]
  }
}

function addSearchTokens(tokens: Set<string>, value: string) {
  for (const token of tokenizeSearchText(value)) {
    for (const expandedToken of expandSearchToken(token)) {
      tokens.add(expandedToken)
    }
  }
}

function buildCompetitionSearchTokens(comp: CompetitionEventSyncStatus) {
  const tokens = new Set<string>()

  addSearchTokens(tokens, comp.competitionName)
  addSearchTokens(tokens, comp.status)
  for (const division of comp.divisions) {
    addSearchTokens(tokens, division.label)
    addSearchTokens(
      tokens,
      division.teamSize === 1 ? "individual indy" : "team partner",
    )
  }
  for (const event of comp.existingEvents) {
    addSearchTokens(tokens, event.name)
  }
  for (const event of comp.eventStatuses) {
    if (event.competitionEventName) {
      addSearchTokens(tokens, event.competitionEventName)
    }
    addSearchTokens(tokens, event.status)
  }

  return tokens
}

export function SeriesEventSyncDialog({
  groupId,
  open,
  onOpenChange,
  onSynced,
  selectedTemplateEventIds,
  selectedTemplateEvents,
}: SeriesEventSyncDialogProps) {
  const [syncStep, setSyncStep] = useState<"select" | "preview">("select")
  const [syncStatuses, setSyncStatuses] = useState<
    CompetitionEventSyncStatus[]
  >([])
  const [selectedCompetitionIds, setSelectedCompetitionIds] = useState<
    Set<string>
  >(new Set())
  const [syncPreview, setSyncPreview] =
    useState<SyncEventsPreviewResult | null>(null)
  const [competitionSearch, setCompetitionSearch] = useState("")
  const [isLoadingStatus, setIsLoadingStatus] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const getCompetitionSyncStatus = useServerFn(getCompetitionEventSyncStatusFn)
  const previewSyncEvents = useServerFn(previewSyncEventsToCompetitionsFn)
  const syncTemplateEvents = useServerFn(syncTemplateEventsToCompetitionsFn)

  // Load sync status when dialog opens
  useEffect(() => {
    if (!open) {
      setSyncStep("select")
      setSyncPreview(null)
      setSelectedCompetitionIds(new Set())
      setCompetitionSearch("")
      return
    }

    setIsLoadingStatus(true)
    getCompetitionSyncStatus({
      data: { groupId, templateEventIds: selectedTemplateEventIds },
    })
      .then((result) => {
        setSyncStatuses(result.competitions)
        setSelectedCompetitionIds(new Set())
      })
      .catch((e) => {
        toast.error(
          e instanceof Error ? e.message : "Failed to load sync status",
        )
        onOpenChange(false)
      })
      .finally(() => setIsLoadingStatus(false))
  }, [
    open,
    groupId,
    selectedTemplateEventIds,
    getCompetitionSyncStatus,
    onOpenChange,
  ])

  const competitionSearchTokens = useMemo(
    () => tokenizeSearchText(competitionSearch),
    [competitionSearch],
  )
  const filteredSyncStatuses = useMemo(() => {
    if (competitionSearchTokens.length === 0) return syncStatuses

    return syncStatuses.filter((comp) => {
      const searchTokens = buildCompetitionSearchTokens(comp)

      return competitionSearchTokens.every((token) =>
        expandSearchToken(token).some((expandedToken) =>
          searchTokens.has(expandedToken),
        ),
      )
    })
  }, [competitionSearchTokens, syncStatuses])

  const handleSelectAllActionable = () => {
    setSelectedCompetitionIds(
      new Set(
        filteredSyncStatuses
          .filter((c) =>
            c.eventStatuses.some((event) => event.status !== "synced"),
          )
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
          templateEventIds: selectedTemplateEventIds,
        },
      })
      setSyncPreview(preview)
      setSyncStep("preview")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load preview")
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const handleSyncConfirm = async () => {
    setIsSyncing(true)
    try {
      const result = await syncTemplateEvents({
        data: {
          groupId,
          competitionIds: Array.from(selectedCompetitionIds),
          templateEventIds: selectedTemplateEventIds,
        },
      })
      toast.success(
        `Synced ${result.synced} event${result.synced !== 1 ? "s" : ""} across competitions`,
      )
      onOpenChange(false)
      await onSynced()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to sync events")
    } finally {
      setIsSyncing(false)
    }
  }

  const eventStatusBadge = (
    status: CompetitionEventSyncStatus["eventStatuses"][number]["status"],
  ) => {
    switch (status) {
      case "synced":
        return (
          <Badge variant="outline" className="text-green-600 border-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Synced
          </Badge>
        )
      case "will-resync":
        return (
          <Badge
            variant="outline"
            className="text-orange-600 border-orange-600"
          >
            <RotateCw className="h-3 w-3 mr-1" />
            Resync
          </Badge>
        )
      case "will-map-existing":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            <Link2 className="h-3 w-3 mr-1" />
            Map existing
          </Badge>
        )
      case "will-create":
        return (
          <Badge variant="outline" className="text-gray-600 border-gray-600">
            <PlusCircle className="h-3 w-3 mr-1" />
            Create
          </Badge>
        )
      default:
        return null
    }
  }

  const previewBadge = (
    mappingStatus: SyncEventsPreviewResult["competitions"][number]["events"][number]["mappingStatus"],
  ) => {
    switch (mappingStatus) {
      case "mapped":
        return <Badge variant="outline">Resync</Badge>
      case "existing-unmapped":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            Map existing
          </Badge>
        )
      case "new":
        return (
          <Badge variant="outline" className="text-green-600 border-green-600">
            New
          </Badge>
        )
      default:
        return null
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
          <Badge
            variant="outline"
            className="text-orange-600 border-orange-600"
          >
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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[80vh] overflow-y-auto">
        {syncStep === "select" && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Select Competitions to Sync</AlertDialogTitle>
              <AlertDialogDescription>
                Choose which competitions should receive{" "}
                {selectedTemplateEvents.length} selected parent template workout
                {selectedTemplateEvents.length !== 1 ? "s" : ""}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Selected workouts
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedTemplateEvents.map((event) => (
                  <span
                    key={event.id}
                    className="rounded-md border bg-background px-2.5 py-2"
                  >
                    <span className="text-sm font-medium">{event.name}</span>
                    {event.childEvents && event.childEvents.length > 0 ? (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {event.childEvents.map((childEvent) => (
                          <Badge
                            key={childEvent.id}
                            variant="outline"
                            className="text-xs font-normal"
                          >
                            {childEvent.name}
                          </Badge>
                        ))}
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>
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
                  onClick={handleSelectAllActionable}
                >
                  Select Visible with Changes
                </Button>
                <div className="space-y-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={competitionSearch}
                      onChange={(event) =>
                        setCompetitionSearch(event.target.value)
                      }
                      placeholder="Search competitions..."
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Showing {filteredSyncStatuses.length} of{" "}
                    {syncStatuses.length} competitions
                  </p>
                </div>
                <div className="space-y-2">
                  {filteredSyncStatuses.length === 0 ? (
                    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      No competitions match your search.
                    </p>
                  ) : null}
                  {filteredSyncStatuses.map((comp) => (
                    // biome-ignore lint/a11y/noLabelWithoutControl: Radix Checkbox renders internal input
                    <label
                      key={comp.competitionId}
                      className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedCompetitionIds.has(comp.competitionId)}
                        onCheckedChange={() =>
                          toggleCompetition(comp.competitionId)
                        }
                        className="mt-1"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium">
                            {comp.competitionName}
                          </span>
                          {statusBadge(comp.status)}
                        </span>
                        <span className="mt-2 flex flex-col gap-1">
                          {comp.eventStatuses.map((event) => (
                            <span
                              key={event.templateEventId}
                              className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                            >
                              {eventStatusBadge(event.status)}
                              <span className="font-medium text-foreground">
                                {event.templateEventName}
                              </span>
                              {event.competitionEventName ? (
                                <span>-&gt; {event.competitionEventName}</span>
                              ) : null}
                            </span>
                          ))}
                        </span>
                        {comp.existingEvents.length > 0 ? (
                          <span className="mt-2 block text-xs text-muted-foreground">
                            Existing events:{" "}
                            {comp.existingEvents
                              .map((event) => event.name)
                              .join(", ")}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                onClick={handlePreviewStep}
                disabled={selectedCompetitionIds.size === 0 || isLoadingPreview}
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
                {syncPreview.competitions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No changes found for the selected workouts and competitions.
                  </p>
                ) : null}
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
                          {evt.competitionEventName ? (
                            <span> -&gt; {evt.competitionEventName}</span>
                          ) : null}
                          <span className="mx-2">
                            {previewBadge(evt.mappingStatus)}
                          </span>
                          {evt.changes.join(", ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setSyncStep("select")}>
                Back
              </Button>
              <Button
                onClick={handleSyncConfirm}
                disabled={isSyncing || (syncPreview?.totalEvents ?? 0) === 0}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  `Sync ${syncPreview?.totalEvents ?? 0} Event${syncPreview?.totalEvents !== 1 ? "s" : ""}`
                )}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
