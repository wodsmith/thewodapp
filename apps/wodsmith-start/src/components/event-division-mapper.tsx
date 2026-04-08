"use client"

import { useServerFn } from "@tanstack/react-start"
import { Check, Grid3X3, Minus } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  type EventDivisionMappingData,
  saveEventDivisionMappingsFn,
} from "@/server-fns/event-division-mapping-fns"
import { formatTrackOrder } from "@/utils/format-track-order"

interface Props {
  competitionId: string
  data: EventDivisionMappingData
  onSaved?: () => Promise<void>
}

/** Build a Set of "trackWorkoutId:divisionId" keys from mapping array */
function buildMappingSet(
  mappings: Array<{ trackWorkoutId: string; divisionId: string }>,
): Set<string> {
  return new Set(mappings.map((m) => `${m.trackWorkoutId}:${m.divisionId}`))
}

/**
 * Interactive matrix: events as rows, divisions as columns.
 * Each cell is a checkbox toggling whether that event applies to that division.
 * When no mappings are configured, all events apply to all divisions.
 */
export function EventDivisionMapper({ competitionId, data, onSaved }: Props) {
  const [isSaving, setIsSaving] = useState(false)
  const [mappingSet, setMappingSet] = useState<Set<string>>(() =>
    buildMappingSet(data.mappings),
  )
  const [savedSet, setSavedSet] = useState<Set<string>>(() =>
    buildMappingSet(data.mappings),
  )

  // Sync when parent refreshes data
  useEffect(() => {
    const newSet = buildMappingSet(data.mappings)
    setMappingSet(newSet)
    setSavedSet(newSet)
  }, [data.mappings])

  const saveMappings = useServerFn(saveEventDivisionMappingsFn)

  // Only show top-level events (not sub-events) in matrix rows
  const topLevelEvents = useMemo(
    () => data.events.filter((e) => !e.parentEventId),
    [data.events],
  )

  const isDirty = useMemo(() => {
    if (mappingSet.size !== savedSet.size) return true
    for (const key of mappingSet) {
      if (!savedSet.has(key)) return true
    }
    return false
  }, [mappingSet, savedSet])

  const toggleMapping = useCallback(
    (trackWorkoutId: string, divisionId: string) => {
      const key = `${trackWorkoutId}:${divisionId}`
      setMappingSet((prev) => {
        const next = new Set(prev)
        if (next.has(key)) {
          next.delete(key)
        } else {
          next.add(key)
        }
        return next
      })
    },
    [],
  )

  const toggleAllForEvent = useCallback(
    (trackWorkoutId: string) => {
      setMappingSet((prev) => {
        const next = new Set(prev)
        const allChecked = data.divisions.every((d) =>
          next.has(`${trackWorkoutId}:${d.divisionId}`),
        )
        for (const d of data.divisions) {
          const key = `${trackWorkoutId}:${d.divisionId}`
          if (allChecked) {
            next.delete(key)
          } else {
            next.add(key)
          }
        }
        return next
      })
    },
    [data.divisions],
  )

  const toggleAllForDivision = useCallback(
    (divisionId: string) => {
      setMappingSet((prev) => {
        const next = new Set(prev)
        const allChecked = topLevelEvents.every((e) =>
          next.has(`${e.trackWorkoutId}:${divisionId}`),
        )
        for (const e of topLevelEvents) {
          const key = `${e.trackWorkoutId}:${divisionId}`
          if (allChecked) {
            next.delete(key)
          } else {
            next.add(key)
          }
        }
        return next
      })
    },
    [topLevelEvents],
  )

  const selectAll = useCallback(() => {
    const next = new Set<string>()
    for (const e of topLevelEvents) {
      for (const d of data.divisions) {
        next.add(`${e.trackWorkoutId}:${d.divisionId}`)
      }
    }
    setMappingSet(next)
  }, [topLevelEvents, data.divisions])

  const clearAll = useCallback(() => {
    setMappingSet(new Set())
  }, [])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const mappings = Array.from(mappingSet).map((key) => {
        const [trackWorkoutId, divisionId] = key.split(":")
        return { trackWorkoutId, divisionId }
      })

      await saveMappings({
        data: { competitionId, mappings },
      })

      setSavedSet(new Set(mappingSet))
      toast.success(
        mappings.length > 0
          ? `Saved ${mappings.length} event-division mappings`
          : "Cleared all event-division mappings (all events visible to all divisions)",
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save mappings")
      return
    } finally {
      setIsSaving(false)
    }

    if (onSaved) {
      try {
        await onSaved()
      } catch (e) {
        console.error("onSaved callback failed:", e)
      }
    }
  }, [competitionId, mappingSet, saveMappings, onSaved])

  // Stats
  const totalCells = topLevelEvents.length * data.divisions.length
  const mappedCount = mappingSet.size

  if (data.events.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No events have been added to this competition yet. Add events first,
          then configure which divisions see each event.
        </AlertDescription>
      </Alert>
    )
  }

  if (data.divisions.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No divisions have been configured for this competition yet. Set up
          divisions first, then map events to divisions.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {/* Info banner */}
      {!data.hasMappings && savedSet.size === 0 && mappingSet.size === 0 && (
        <Alert>
          <Grid3X3 className="h-4 w-4" />
          <AlertDescription>
            No event-division mappings are configured. All events are currently
            visible to all divisions. Use the matrix below to restrict which
            events appear for specific divisions.
          </AlertDescription>
        </Alert>
      )}

      {/* Actions bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {mappedCount === 0
              ? "No mappings (all events visible to all divisions)"
              : `${mappedCount} of ${totalCells} event-division pairs mapped`}
          </p>
          {isDirty && (
            <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={selectAll}>
            Select All
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={clearAll}>
            Clear All
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
          >
            {isSaving ? "Saving..." : "Save Mappings"}
          </Button>
        </div>
      </div>

      {/* Interactive matrix */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left font-medium px-3 py-2 min-w-[200px] sticky left-0 bg-muted/50 z-10">
                Event
              </th>
              {data.divisions.map((d) => (
                <th
                  key={d.divisionId}
                  className="text-center font-medium px-2 py-2 min-w-[100px]"
                >
                  <button
                    type="button"
                    onClick={() => toggleAllForDivision(d.divisionId)}
                    className="hover:text-primary transition-colors cursor-pointer"
                    title={`Toggle all events for ${d.label}`}
                  >
                    <div className="text-xs leading-tight">{d.label}</div>
                    {d.teamSize > 1 && (
                      <div className="text-[10px] text-muted-foreground">
                        Team of {d.teamSize}
                      </div>
                    )}
                  </button>
                </th>
              ))}
              <th className="text-center font-medium px-2 py-2 min-w-[80px]">
                <div className="text-xs text-muted-foreground">Mapped</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {topLevelEvents.map((event) => {
              const eventMappedCount = data.divisions.filter((d) =>
                mappingSet.has(`${event.trackWorkoutId}:${d.divisionId}`),
              ).length
              const allChecked = eventMappedCount === data.divisions.length

              return (
                <tr
                  key={event.trackWorkoutId}
                  className="border-b last:border-b-0 hover:bg-muted/30"
                >
                  <td className="px-3 py-2 sticky left-0 bg-background z-10">
                    <button
                      type="button"
                      onClick={() => toggleAllForEvent(event.trackWorkoutId)}
                      className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer text-left"
                      title={`Toggle all divisions for ${event.eventName}`}
                    >
                      <span className="text-xs text-muted-foreground font-mono shrink-0">
                        {formatTrackOrder(event.trackOrder)}
                      </span>
                      <span className="font-medium text-xs truncate max-w-[160px]">
                        {event.eventName}
                      </span>
                    </button>
                  </td>
                  {data.divisions.map((d) => {
                    const key = `${event.trackWorkoutId}:${d.divisionId}`
                    const isChecked = mappingSet.has(key)
                    const wasSaved = savedSet.has(key)

                    return (
                      <td
                        key={d.divisionId}
                        className="px-2 py-1.5 text-center"
                      >
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() =>
                              toggleMapping(event.trackWorkoutId, d.divisionId)
                            }
                            className={
                              isChecked && wasSaved
                                ? "border-green-500 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                : isChecked && !wasSaved
                                  ? "border-orange-500 data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
                                  : !isChecked && wasSaved
                                    ? "border-orange-300"
                                    : ""
                            }
                          />
                        </div>
                      </td>
                    )
                  })}
                  <td className="px-2 py-2 text-center">
                    {allChecked ? (
                      <Check className="h-3 w-3 text-green-600 mx-auto" />
                    ) : eventMappedCount > 0 ? (
                      <Badge variant="outline" className="text-xs">
                        {eventMappedCount}/{data.divisions.length}
                      </Badge>
                    ) : (
                      <Minus className="h-3 w-3 text-muted-foreground/40 mx-auto" />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
