"use client"

import { Link } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ExternalLink, Minus, Sparkles } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  autoMapSeriesDivisionsFn,
  type SeriesDivisionMappingData,
  type SeriesTemplateData,
  saveSeriesDivisionMappingsFn,
} from "@/server-fns/series-division-mapping-fns"

interface Props {
  groupId: string
  template: SeriesTemplateData
  initialMappings: SeriesDivisionMappingData[]
  onSaved?: () => Promise<void>
}

/**
 * Interactive matrix: competitions as rows, series divisions as columns.
 * Each cell is a <select> that picks which comp division maps to that
 * series division. Clicking an empty cell lets you assign a mapping.
 */
export function SeriesDivisionMapper({
  groupId,
  template,
  initialMappings,
  onSaved,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isAutoMapping, setIsAutoMapping] = useState(false)
  const [mappings, setMappings] =
    useState<SeriesDivisionMappingData[]>(initialMappings)
  // Increment to force uncontrolled <select> elements to remount with new defaultValues
  const [revision, setRevision] = useState(0)
  const [isDirty, setIsDirty] = useState(false)
  const [showOnlyUnmapped, setShowOnlyUnmapped] = useState(false)

  // Sync when parent refreshes data (e.g. after save)
  useEffect(() => {
    setMappings(initialMappings)
    setRevision((r) => r + 1)
    setIsDirty(false)
    // Turn off filter if no comps have unmapped divisions anymore
    const stillHasUnmapped = initialMappings.some((comp) =>
      comp.mappings.some((m) => m.seriesDivisionId === null),
    )
    if (!stillHasUnmapped) {
      setShowOnlyUnmapped(false)
    }
  }, [initialMappings])

  const saveMappings = useServerFn(saveSeriesDivisionMappingsFn)
  const autoMap = useServerFn(autoMapSeriesDivisionsFn)

  const handleAutoMap = async () => {
    setIsAutoMapping(true)
    try {
      const result = await autoMap({ data: { groupId } })
      setMappings(result.competitionMappings)
      setRevision((r) => r + 1)
      setIsDirty(true)
      toast.success("Auto-mapped divisions")
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to auto-map divisions",
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
        "select[data-comp-id][data-series-div-id]",
      )
      const allMappings: Array<{
        competitionId: string
        competitionDivisionId: string
        seriesDivisionId: string
      }> = []

      for (const select of selects) {
        const el = select as unknown as HTMLSelectElement
        const compId = el.dataset.compId
        const seriesDivId = el.dataset.seriesDivId
        const compDivId = el.value
        if (!compId || !seriesDivId || compDivId === "__none__") continue
        allMappings.push({
          competitionId: compId,
          competitionDivisionId: compDivId,
          seriesDivisionId: seriesDivId,
        })
      }

      await saveMappings({
        data: { groupId, mappings: allMappings },
      })
      toast.success(`Saved ${allMappings.length} division mappings`)
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
  const totalDivisions = mappings.reduce((sum, c) => sum + c.mappings.length, 0)
  const mappedCount = mappings.reduce(
    (sum, c) =>
      sum + c.mappings.filter((m) => m.seriesDivisionId !== null).length,
    0,
  )

  // Comps that have at least one division without a mapping
  const hasUnmappedDivisions = (comp: SeriesDivisionMappingData) =>
    comp.mappings.some((m) => m.seriesDivisionId === null)
  const compsWithUnmapped = mappings.filter(hasUnmappedDivisions).length

  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()}>
      <div className="space-y-4">
        {/* Actions bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {mappedCount} of {totalDivisions} divisions mapped
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
                Show only competitions with unmapped divisions (
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
                {template.divisions.map((sd) => (
                  <th
                    key={sd.id}
                    className="text-center font-medium px-2 py-2 min-w-[150px]"
                  >
                    <div className="text-xs leading-tight">{sd.label}</div>
                  </th>
                ))}
                <th className="text-center font-medium px-2 py-2 min-w-[80px]">
                  <div className="text-xs text-muted-foreground">Unmapped</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((comp) => {
                const hidden = showOnlyUnmapped && !hasUnmappedDivisions(comp)
                return (
                  <CompetitionRow
                    key={`${comp.competitionId}-${revision}`}
                    comp={comp}
                    template={template}
                    onChanged={() => setIsDirty(true)}
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
 * Each series-division cell is a controlled <select> picking which comp division maps to it.
 * Comp divisions already used in another column are disabled to prevent duplicates.
 */
function CompetitionRow({
  comp,
  template,
  onChanged,
  hidden,
}: {
  comp: SeriesDivisionMappingData
  template: SeriesTemplateData
  onChanged: () => void
  hidden?: boolean
}) {
  // Build initial state: seriesDivisionId → competitionDivisionId
  const initialSelections = () => {
    const map = new Map<string, string>()
    for (const m of comp.mappings) {
      if (m.seriesDivisionId) {
        map.set(m.seriesDivisionId, m.competitionDivisionId)
      }
    }
    return map
  }

  // Only includes mappings that are persisted in the DB
  const initialSaved = () => {
    const map = new Map<string, string>()
    for (const m of comp.mappings) {
      if (m.seriesDivisionId && m.saved) {
        map.set(m.seriesDivisionId, m.competitionDivisionId)
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

  // Set of comp division IDs currently used across all columns
  const usedCompDivIds = new Set(selections.values())

  const handleChange = (seriesDivId: string, compDivId: string) => {
    setSelections((prev) => {
      const next = new Map(prev)
      if (compDivId === "__none__") {
        next.delete(seriesDivId)
      } else {
        next.set(seriesDivId, compDivId)
      }
      return next
    })
    onChanged()
  }

  const unmappedCount = comp.mappings.filter(
    (m) => !usedCompDivIds.has(m.competitionDivisionId),
  ).length

  return (
    <tr
      className={`border-b last:border-b-0 hover:bg-muted/30 ${hidden ? "hidden" : ""}`}
    >
      <td className="px-3 py-2 sticky left-0 bg-background">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-xs truncate max-w-[160px]">
            {comp.competitionName}
          </span>
          <Link
            to="/compete/organizer/$competitionId/divisions"
            params={{ competitionId: comp.competitionId }}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </td>
      {template.divisions.map((sd) => {
        const selectedCompDivId = selections.get(sd.id) ?? "__none__"

        return (
          <td key={sd.id} className="px-1 py-1.5 text-center">
            <select
              value={selectedCompDivId}
              onChange={(e) => handleChange(sd.id, e.target.value)}
              className={`h-7 text-xs rounded-md border px-1.5 py-0.5 w-full max-w-[140px] mx-auto block focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer ${
                selectedCompDivId === "__none__"
                  ? "border-dashed border-muted-foreground/30 text-muted-foreground"
                  : savedSelections.get(sd.id) === selectedCompDivId
                    ? "border-green-300 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300"
                    : "border-orange-300 bg-orange-50 text-orange-800 dark:bg-orange-950/30 dark:text-orange-300"
              }`}
              data-comp-id={comp.competitionId}
              data-series-div-id={sd.id}
            >
              <option value="__none__">—</option>
              {comp.mappings.map((m) => {
                const isUsedElsewhere =
                  usedCompDivIds.has(m.competitionDivisionId) &&
                  selectedCompDivId !== m.competitionDivisionId
                return (
                  <option
                    key={m.competitionDivisionId}
                    value={m.competitionDivisionId}
                    disabled={isUsedElsewhere}
                  >
                    {m.competitionDivisionLabel}
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
