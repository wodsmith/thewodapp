"use client"

import { useServerFn } from "@tanstack/react-start"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
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
import {
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
}

export function SeriesEventSyncDialog({
  groupId,
  open,
  onOpenChange,
  onSynced,
}: SeriesEventSyncDialogProps) {
  const [syncStep, setSyncStep] = useState<"select" | "preview">("select")
  const [syncStatuses, setSyncStatuses] = useState<
    Array<{
      competitionId: string
      competitionName: string
      status: "in-sync" | "behind" | "custom" | "unmapped"
    }>
  >([])
  const [selectedCompetitionIds, setSelectedCompetitionIds] = useState<Set<string>>(new Set())
  const [syncPreview, setSyncPreview] = useState<SyncEventsPreviewResult | null>(null)
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
      return
    }

    setIsLoadingStatus(true)
    getCompetitionSyncStatus({ data: { groupId } })
      .then((result) => {
        setSyncStatuses(result.competitions)
        setSelectedCompetitionIds(
          new Set(
            result.competitions
              .filter((c) => c.status === "behind" || c.status === "unmapped")
              .map((c) => c.competitionId),
          ),
        )
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed to load sync status")
        onOpenChange(false)
      })
      .finally(() => setIsLoadingStatus(false))
  }, [open, groupId, getCompetitionSyncStatus, onOpenChange])

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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[80vh] overflow-y-auto">
        {syncStep === "select" && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Select Competitions to Sync</AlertDialogTitle>
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
                <Button variant="outline" size="sm" onClick={handleSelectAllBehind}>
                  Select All Behind
                </Button>
                <div className="space-y-2">
                  {syncStatuses.map((comp) => (
                    <label
                      key={comp.competitionId}
                      className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedCompetitionIds.has(comp.competitionId)}
                        onCheckedChange={() => toggleCompetition(comp.competitionId)}
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
              <Button variant="outline" onClick={() => setSyncStep("select")}>
                Back
              </Button>
              <Button onClick={handleSyncConfirm} disabled={isSyncing}>
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
