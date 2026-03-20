"use client"

import { Link } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ExternalLink, Minus, Sparkles } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  type SeriesEventMappingData,
  autoMapSeriesEventsFn,
  saveSeriesEventMappingsFn,
} from "@/server-fns/series-event-template-fns"

function mapsEqual(a: Map<string, string>, b: Map<string, string>): boolean {
  if (a.size !== b.size) return false
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false
  }
  return true
}

interface SeriesTemplateEventData {
  events: Array<{
    id: string
    name: string
    order: number
    scoreType: string | null
  }>
}

interface Props {
  groupId: string
  template: SeriesTemplateEventData
  initialMappings: SeriesEventMappingData[]
  onSaved?: () => Promise<void>
}

/**
 * Interactive matrix: competitions as rows, series template events as columns.
 * Each cell is a <select> that picks which competition event maps to that
 * template event. Clicking an empty cell lets you assign a mapping.
 */
export function SeriesEventMapper({
  groupId,
  template,
  initialMappings,
  onSaved,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isAutoMapping, setIsAutoMapping] = useState(false)
  const [mappings, setMappings] =
    useState<SeriesEventMappingData[]>(initialMappings)
  // Increment to force uncontrolled <select> elements to remount with new defaultValues
  const [revision, setRevision] = useState(0)
  // Track per-competition dirty state so reverting a change clears the banner
  const [dirtyComps, setDirtyComps] = useState<Set<string>>(() => {
    const dirty = new Set<string>()
    for (const comp of initialMappings) {
      if (comp.mappings.some((m) => !m.saved)) {
        dirty.add(comp.competition.id)
      }
    }
    return dirty
  })
  const isDirty = dirtyComps.size > 0
  const [showOnlyUnmapped, setShowOnlyUnmapped] = useState(false)

  // Sync when parent refreshes data (e.g. after save)
  useEffect(() => {
    setMappings(initialMappings)
    setRevision((r) => r + 1)
    // Recompute per-comp dirty state from fresh data
    const dirty = new Set<string>()
    for (const comp of initialMappings) {
      if (comp.mappings.some((m) => !m.saved)) {
        dirty.add(comp.competition.id)
      }
    }
    setDirtyComps(dirty)
    // Turn off filter if no comps have unmapped events anymore
    const stillHasUnmapped = initialMappings.some(
      (comp) => comp.events.length > comp.mappings.length,
    )
    if (!stillHasUnmapped) {
      setShowOnlyUnmapped(false)
    }
  }, [initialMappings])

  const saveMappings = useServerFn(saveSeriesEventMappingsFn)
  const autoMap = useServerFn(autoMapSeriesEventsFn)

  const handleAutoMap = async () => {
    setIsAutoMapping(true)
    try {
      const result = await autoMap({ data: { groupId } })
      setMappings(result.competitionMappings)
      setRevision((r) => r + 1)
      setDirtyComps(
        new Set(
          result.competitionMappings
            .filter((c) => c.mappings.some((m) => !m.saved))
            .map((c) => c.competition.id),
        ),
      )
      toast.success("Auto-mapped events")
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to auto-map events",
      )
    } finally {
      setIsAutoMapping(false)
    }
  }

  const handleSave = useCallback(async () => {
    if (!formRef.current) return
    setIsSaving(true)
    try {
      // Read all matrix selects via data attributes
      const selects = formRef.current.querySelectorAll(
        "select[data-comp-id][data-template-event-id]",
      )
      const allMappings: Array<{
        competitionId: string
        competitionEventId: string
        templateEventId: string
      }> = []

      for (const select of selects) {
        const el = select as unknown as HTMLSelectElement
        const compId = el.dataset.compId
        const templateEventId = el.dataset.templateEventId
        const compEventId = el.value
        if (!compId || !templateEventId || compEventId === "__none__") continue
        allMappings.push({
          competitionId: compId,
          competitionEventId: compEventId,
          templateEventId,
        })
      }

      await saveMappings({
        data: { groupId, mappings: allMappings },
      })
      toast.success(`Saved ${allMappings.length} event mappings`)
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
  }, [groupId, saveMappings, onSaved])

  // Stats
  const totalSlots = mappings.reduce(
    (sum, _c) => sum + template.events.length,
    0,
  )
  const mappedCount = mappings.reduce(
    (sum, _c) => sum + _c.mappings.length,
    0,
  )

  // Comps that have at least one template event without a mapping
  const hasUnmappedEvents = (comp: SeriesEventMappingData) => {
    const mappedTemplateIds = new Set(comp.mappings.map((m) => m.templateEventId))
    return template.events.some((te) => !mappedTemplateIds.has(te.id))
  }
  const compsWithUnmapped = mappings.filter(hasUnmappedEvents).length

  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()}>
      <div className="space-y-4">
        {/* Actions bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {mappedCount} of {totalSlots} events mapped
            </p>
            {isDirty && (
              <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoMap}
              disabled={isAutoMapping}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {isAutoMapping ? "Mapping..." : "Auto-Map All"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Mappings"}
            </Button>
          </div>
        </div>

        {/* Filter */}
        {compsWithUnmapped > 0 && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={showOnlyUnmapped}
                onChange={(e) => setShowOnlyUnmapped(e.target.checked)}
                className="rounded border-input"
              />
              <span className="text-muted-foreground">
                Show only competitions with unmapped events (
                {compsWithUnmapped})
              </span>
            </label>
          </div>
        )}

        {/* Interactive matrix */}
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left font-medium px-3 py-2 min-w-[180px] sticky left-0 bg-muted/50">
                  Competition
                </th>
                {template.events.map((te) => (
                  <th
                    key={te.id}
                    className="text-center font-medium px-2 py-2 min-w-[150px]"
                  >
                    <div className="text-xs leading-tight">
                      {te.name}
                      {te.scoreType && (
                        <span className="block text-[10px] text-muted-foreground">
                          {te.scoreType}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
                <th className="text-center font-medium px-2 py-2 min-w-[80px]">
                  <div className="text-xs text-muted-foreground">Unmapped</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((comp) => {
                const hidden = showOnlyUnmapped && !hasUnmappedEvents(comp)
                return (
                  <CompetitionRow
                    key={`${comp.competition.id}-${revision}`}
                    comp={comp}
                    template={template}
                    onDirtyChange={(dirty) => {
                      setDirtyComps((prev) => {
                        const next = new Set(prev)
                        if (dirty) {
                          next.add(comp.competition.id)
                        } else {
                          next.delete(comp.competition.id)
                        }
                        return next
                      })
                    }}
                    hidden={hidden}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </form>
  )
}

/**
 * A single row in the interactive matrix.
 * Each template-event cell is a <select> picking which competition event maps to it.
 * Competition events already used in another column are disabled to prevent duplicates.
 */
function CompetitionRow({
  comp,
  template,
  onDirtyChange,
  hidden,
}: {
  comp: SeriesEventMappingData
  template: SeriesTemplateEventData
  onDirtyChange: (dirty: boolean) => void
  hidden?: boolean
}) {
  // Build initial state: templateEventId -> competitionEventId
  const initialSelections = () => {
    const map = new Map<string, string>()
    for (const m of comp.mappings) {
      if (m.templateEventId) {
        map.set(m.templateEventId, m.competitionEventId)
      }
    }
    return map
  }

  // Only includes mappings that are persisted in the DB
  const initialSaved = () => {
    const map = new Map<string, string>()
    for (const m of comp.mappings) {
      if (m.saved && m.templateEventId) {
        map.set(m.templateEventId, m.competitionEventId)
      }
    }
    return map
  }

  const [selections, setSelections] = useState(initialSelections)
  // Track saved state to distinguish green (saved) vs orange (unsaved)
  const [savedSelections, setSavedSelections] = useState(initialSaved)

  // Sync when props change (e.g. after auto-map or save)
  // biome-ignore lint/correctness/useExhaustiveDependencies: derives from comp
  useEffect(() => {
    setSelections(initialSelections())
    setSavedSelections(initialSaved())
  }, [comp])

  // Set of competition event IDs currently used across all columns
  const usedCompEventIds = new Set(selections.values())

  const handleChange = (templateEventId: string, compEventId: string) => {
    setSelections((prev) => {
      const next = new Map(prev)
      if (compEventId === "__none__") {
        next.delete(templateEventId)
      } else {
        next.set(templateEventId, compEventId)
      }
      // Compare against saved state to determine if this row is dirty
      const isDirty = !mapsEqual(next, savedSelections)
      onDirtyChange(isDirty)
      return next
    })
  }

  // Count competition events not mapped to any template event
  const unmappedCount = comp.events.filter(
    (e) => !usedCompEventIds.has(e.id),
  ).length

  return (
    <tr
      className={`border-b last:border-b-0 hover:bg-muted/30 ${hidden ? "hidden" : ""}`}
    >
      <td className="px-3 py-2 sticky left-0 bg-background">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-xs truncate max-w-[160px]">
            {comp.competition.name}
          </span>
          <Link
            to="/compete/organizer/$competitionId/events"
            params={{ competitionId: comp.competition.id }}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </td>
      {template.events.map((te) => {
        const selectedCompEventId = selections.get(te.id) ?? "__none__"

        return (
          <td key={te.id} className="px-1 py-1.5 text-center">
            <select
              value={selectedCompEventId}
              onChange={(e) => handleChange(te.id, e.target.value)}
              className={`h-7 text-xs rounded-md border px-1.5 py-0.5 w-full max-w-[140px] mx-auto block focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer ${
                selectedCompEventId === "__none__" && !savedSelections.has(te.id)
                  ? "border-dashed border-muted-foreground/30 text-muted-foreground"
                  : selectedCompEventId === "__none__" && savedSelections.has(te.id)
                    ? "border-orange-300 bg-orange-50 text-orange-800 dark:bg-orange-950/30 dark:text-orange-300"
                    : savedSelections.get(te.id) === selectedCompEventId
                      ? "border-green-300 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300"
                      : "border-orange-300 bg-orange-50 text-orange-800 dark:bg-orange-950/30 dark:text-orange-300"
              }`}
              data-comp-id={comp.competition.id}
              data-template-event-id={te.id}
            >
              <option value="__none__">—</option>
              {comp.events.map((ce) => {
                const isUsedElsewhere =
                  usedCompEventIds.has(ce.id) &&
                  selectedCompEventId !== ce.id
                return (
                  <option
                    key={ce.id}
                    value={ce.id}
                    disabled={isUsedElsewhere}
                  >
                    {ce.name}
                    {ce.scoreType ? ` (${ce.scoreType})` : ""}
                    {isUsedElsewhere ? " (used)" : ""}
                  </option>
                )
              })}
            </select>
          </td>
        )
      })}
      <td className="px-2 py-2 text-center">
        {unmappedCount > 0 ? (
          <Badge
            variant="outline"
            className="text-orange-600 border-orange-300 text-xs"
          >
            {unmappedCount}
          </Badge>
        ) : (
          <Minus className="h-3 w-3 text-muted-foreground/40 mx-auto" />
        )}
      </td>
    </tr>
  )
}
