"use client"

import { useServerFn } from "@tanstack/react-start"
import { Loader2, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  copyEventsFromCompetitionFn,
  createSeriesTemplateTrackFn,
} from "@/server-fns/series-event-template-fns"

interface EventTemplateCreatorProps {
  groupId: string
  competitions: Array<{ id: string; name: string; eventCount: number }>
  onTemplateCreated: () => Promise<void>
}

export function EventTemplateCreator({
  groupId,
  competitions,
  onTemplateCreated,
}: EventTemplateCreatorProps) {
  const [mode, setMode] = useState<"pick" | "create">("pick")
  const [selectedCompetitionId, setSelectedCompetitionId] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const createTemplateTrack = useServerFn(createSeriesTemplateTrackFn)
  const copyEventsFromCompetition = useServerFn(copyEventsFromCompetitionFn)

  const handleCopyFromCompetition = async () => {
    if (!selectedCompetitionId) return
    setIsCreating(true)
    try {
      // First ensure template track exists
      await createTemplateTrack({ data: { groupId } })
      // Then copy events from the selected competition
      const result = await copyEventsFromCompetition({
        data: { groupId, sourceCompetitionId: selectedCompetitionId },
      })
      toast.success(`Copied ${result.copiedCount} events from competition`)
      await onTemplateCreated()
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to copy events",
      )
    } finally {
      setIsCreating(false)
    }
  }

  const handleCreateFromScratch = async () => {
    setIsCreating(true)
    try {
      await createTemplateTrack({ data: { groupId } })
      toast.success("Event template created")
      await onTemplateCreated()
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to create event template",
      )
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Event Template</CardTitle>
        <CardDescription>
          Define the standard events for this series. Choose an existing
          competition's events as a starting point, or start from scratch.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tab-like toggle */}
        <div className="flex gap-2">
          <Button
            variant={mode === "pick" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("pick")}
          >
            Copy from competition
          </Button>
          <Button
            variant={mode === "create" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("create")}
          >
            Start from scratch
          </Button>
        </div>

        {mode === "pick" ? (
          <div className="space-y-3">
            <Select
              value={selectedCompetitionId || "__none__"}
              onValueChange={(val) =>
                setSelectedCompetitionId(val === "__none__" ? "" : val)
              }
            >
              <SelectTrigger className="w-full max-w-[400px]">
                <SelectValue placeholder="Select a competition..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" disabled>
                  Select a competition...
                </SelectItem>
                {competitions.map((comp) => (
                  <SelectItem key={comp.id} value={comp.id}>
                    {comp.name}
                    {comp.eventCount > 0 && (
                      <span className="ml-1 text-muted-foreground text-xs">
                        ({comp.eventCount} event{comp.eventCount !== 1 ? "s" : ""})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {competitions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No competitions in this series yet. Add competitions first, or
                start from scratch.
              </p>
            )}
            <Button
              onClick={handleCopyFromCompetition}
              disabled={!selectedCompetitionId || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Copying...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Use as Template
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Create an empty event template. You can add events manually
              after creation.
            </p>
            <Button
              onClick={handleCreateFromScratch}
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Event Template
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
