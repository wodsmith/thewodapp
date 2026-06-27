"use client"

// @lat: [[crew#Judge Rotations#Judge Assignments Grid]]

import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import {
  ChevronLeft,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
} from "lucide-react"
import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
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
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ToggleGroup } from "@/components/ui/toggle-group"
import type { CompetitionJudgeRotation, LaneShiftPattern } from "@/db/schema"
import {
  VOLUNTEER_AVAILABILITY,
  type VolunteerAvailability,
} from "@/db/schemas/volunteers"
import {
  type CoverageStats,
  calculateCoverage,
  expandRotationToAssignments,
  filterRotationsByAvailability,
} from "@/lib/judge-rotation-utils"
import type {
  CrewJudgeHeat,
  CrewJudgeVolunteer,
} from "@/server-fns/crew-judge-rotations-fns"
import { getCrewJudgeName } from "./judge-grid-utils"
import {
  type MultiPreviewCell,
  MultiRotationEditor,
  type RotationDraft,
} from "./multi-rotation-editor"

interface RotationTimelineProps {
  eventName: string
  /** Heats for the selected workout, sorted by heat number. */
  heats: CrewJudgeHeat[]
  laneCount: number
  availableJudges: CrewJudgeVolunteer[]
  /** Rotations for the selected workout (controlled by the parent). */
  initialRotations: CompetitionJudgeRotation[]
  eventLaneShiftPattern: LaneShiftPattern
  eventDefaultHeatsCount: number
  minHeatBuffer: number
  filterEmptyLanes: boolean
  onFilterEmptyLanesChange: (value: boolean) => void
  /** Persist a volunteer's full set of rotations (replace semantics). */
  onSaveVolunteerRotations: (
    membershipId: string,
    rotations: RotationDraft[],
  ) => Promise<void>
  /** Remove all rotations for a volunteer in this workout. */
  onDeleteVolunteerRotations: (membershipId: string) => Promise<void>
}

/** Canonical assignee id for a stored rotation (membership or invitation). */
function rotationAssigneeId(
  rotation: Pick<CompetitionJudgeRotation, "membershipId" | "invitationId">,
): string {
  return rotation.membershipId ?? rotation.invitationId ?? ""
}

/**
 * Gantt-style timeline for judge rotations, ported from the wodsmith-start
 * organizer judging experience. Grid on top, action area (judge list or
 * rotation form) on the left. Mutations are persisted through Crew's
 * canonical-id-aware per-volunteer save path supplied by the parent.
 */
export function RotationTimeline({
  eventName,
  heats: heatsWithAssignments,
  laneCount,
  availableJudges,
  initialRotations,
  eventLaneShiftPattern,
  eventDefaultHeatsCount,
  minHeatBuffer,
  filterEmptyLanes,
  onFilterEmptyLanesChange,
  onSaveVolunteerRotations,
  onDeleteVolunteerRotations,
}: RotationTimelineProps) {
  const heatsCount = heatsWithAssignments.length
  const [availabilityFilter, setAvailabilityFilter] = useState<
    "all" | VolunteerAvailability
  >("all")
  const [judgeSearchQuery, setJudgeSearchQuery] = useState("")
  const [rotations, setRotations] =
    useState<CompetitionJudgeRotation[]>(initialRotations)

  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingVolunteerId, setEditingVolunteerId] = useState<string | null>(
    null,
  )
  const [selectedRotationId, setSelectedRotationId] = useState<string | null>(
    null,
  )
  const [selectedVolunteerId, setSelectedVolunteerId] = useState<string | null>(
    null,
  )
  const [activeBlockIndex, setActiveBlockIndex] = useState(0)
  const [expandedVolunteers, setExpandedVolunteers] = useState<Set<string>>(
    new Set(),
  )
  const [initialCellPosition, setInitialCellPosition] = useState<{
    heat: number
    lane: number
  } | null>(null)
  const [externalPosition, setExternalPosition] = useState<{
    heat: number
    lane: number
    timestamp: number
  } | null>(null)
  const [previewCells, setPreviewCells] = useState<MultiPreviewCell[]>([])
  const [editingRotationCells, setEditingRotationCells] = useState<Set<string>>(
    new Set(),
  )
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingVolunteerId, setDeletingVolunteerId] = useState<string | null>(
    null,
  )
  const [isDeleting, setIsDeleting] = useState(false)

  // Sync rotations state when initialRotations prop changes (e.g. event switch
  // or after a mutation reloads the loader). Also reset UI state.
  useEffect(() => {
    setRotations(initialRotations)
    setIsEditorOpen(false)
    setEditingVolunteerId(null)
    setSelectedRotationId(null)
    setSelectedVolunteerId(null)
    setExpandedVolunteers(new Set())
    setPreviewCells([])
    setEditingRotationCells(new Set())
  }, [initialRotations])

  // Occupied lanes per heat, sourced from Crew heat occupancy.
  const occupiedLanesByHeat = useMemo(() => {
    const map = new Map<number, Set<number>>()
    for (const heat of heatsWithAssignments) {
      map.set(heat.heatNumber, new Set(heat.occupiedLanes))
    }
    return map
  }, [heatsWithAssignments])

  // Heats array for coverage calculation.
  const heats = useMemo(
    () =>
      heatsWithAssignments.map((heat) => {
        if (filterEmptyLanes) {
          return {
            heatNumber: heat.heatNumber,
            laneCount,
            occupiedLanes: new Set(heat.occupiedLanes),
          }
        }
        return { heatNumber: heat.heatNumber, laneCount }
      }),
    [heatsWithAssignments, laneCount, filterEmptyLanes],
  )

  const coverage: CoverageStats = useMemo(
    () => calculateCoverage(rotations, heats),
    [rotations, heats],
  )

  // Group rotations by canonical assignee id.
  const rotationsByVolunteer = useMemo(() => {
    const grouped = new Map<string, CompetitionJudgeRotation[]>()
    for (const rotation of rotations) {
      const assigneeId = rotationAssigneeId(rotation)
      if (!assigneeId) continue
      const existing = grouped.get(assigneeId) || []
      grouped.set(assigneeId, [...existing, rotation])
    }
    return grouped
  }, [rotations])

  // Filter rotations by availability + search.
  const filteredRotationsByVolunteer = useMemo(() => {
    const judgeAvailabilityMap = new Map<
      string,
      VolunteerAvailability | undefined
    >()
    for (const judge of availableJudges) {
      judgeAvailabilityMap.set(judge.membershipId, judge.availability)
    }

    const byAvailability = filterRotationsByAvailability(
      rotationsByVolunteer,
      availabilityFilter,
      judgeAvailabilityMap,
    )

    if (!judgeSearchQuery.trim()) return byAvailability

    const query = judgeSearchQuery.toLowerCase().trim()
    const filtered = new Map<string, CompetitionJudgeRotation[]>()
    for (const [assigneeId, rots] of byAvailability.entries()) {
      const judge = availableJudges.find((j) => j.membershipId === assigneeId)
      const fullName = judge ? getCrewJudgeName(judge).toLowerCase() : ""
      if (fullName.includes(query)) filtered.set(assigneeId, rots)
    }
    return filtered
  }, [
    rotationsByVolunteer,
    availabilityFilter,
    availableJudges,
    judgeSearchQuery,
  ])

  // Maps between display index (1-based) and actual heat number.
  const { displayToHeatNumber, heatNumberToDisplay } = useMemo(() => {
    const displayToHeat = new Map<number, number>()
    const heatToDisplay = new Map<number, number>()
    heatsWithAssignments.forEach((heat, idx) => {
      displayToHeat.set(idx + 1, heat.heatNumber)
      heatToDisplay.set(heat.heatNumber, idx + 1)
    })
    return {
      displayToHeatNumber: displayToHeat,
      heatNumberToDisplay: heatToDisplay,
    }
  }, [heatsWithAssignments])

  // Coverage grid with rotation IDs for highlighting and buffer zones.
  const coverageGrid = useMemo(() => {
    const grid = new Map<
      string,
      {
        status:
          | "empty"
          | "covered"
          | "overlap"
          | "buffer-blocked"
          | "unavailable"
        rotationIds: string[]
      }
    >()

    for (let displayIdx = 1; displayIdx <= heatsCount; displayIdx++) {
      const actualHeatNumber = displayToHeatNumber.get(displayIdx) ?? displayIdx
      for (let lane = 1; lane <= laneCount; lane++) {
        if (filterEmptyLanes) {
          const occupiedLanes = occupiedLanesByHeat.get(actualHeatNumber)
          const hasAthlete = occupiedLanes?.has(lane) ?? false
          if (!hasAthlete) {
            grid.set(`${displayIdx}:${lane}`, {
              status: "unavailable",
              rotationIds: [],
            })
            continue
          }
        }
        grid.set(`${displayIdx}:${lane}`, { status: "empty", rotationIds: [] })
      }
    }

    for (const rotation of rotations) {
      const assignments = expandRotationToAssignments(rotation, heats, {
        respectOccupiedLanes: filterEmptyLanes,
      })
      for (const assignment of assignments) {
        const displayIdx = heatNumberToDisplay.get(assignment.heatNumber)
        if (displayIdx === undefined) continue
        const key = `${displayIdx}:${assignment.laneNumber}`
        const current = grid.get(key)
        if (!current) continue

        if (current.rotationIds.length > 0) {
          grid.set(key, {
            status: "overlap",
            rotationIds: [...current.rotationIds, rotation.id],
          })
        } else {
          grid.set(key, { status: "covered", rotationIds: [rotation.id] })
        }
      }
    }

    if (editingVolunteerId) {
      const volunteerRotations = rotationsByVolunteer.get(editingVolunteerId)
      if (volunteerRotations) {
        for (const rotation of volunteerRotations) {
          const assignments = expandRotationToAssignments(rotation, heats, {
            respectOccupiedLanes: filterEmptyLanes,
          })
          if (assignments.length === 0) continue

          const displayIndices = assignments
            .map((a) => heatNumberToDisplay.get(a.heatNumber))
            .filter((idx): idx is number => idx !== undefined)
          if (displayIndices.length === 0) continue
          const rotationStart = Math.min(...displayIndices)
          const rotationEnd = Math.max(...displayIndices)
          const bufferAfterEnd = rotationEnd + minHeatBuffer
          const bufferBeforeStart = rotationStart - minHeatBuffer

          for (
            let displayIdx = bufferBeforeStart;
            displayIdx <= bufferAfterEnd;
            displayIdx++
          ) {
            if (displayIdx >= rotationStart && displayIdx <= rotationEnd)
              continue
            if (displayIdx < 1 || displayIdx > heatsCount) continue

            for (let lane = 1; lane <= laneCount; lane++) {
              const key = `${displayIdx}:${lane}`
              const current = grid.get(key)
              if (!current) continue
              if (current.status === "empty") {
                grid.set(key, {
                  status: "buffer-blocked",
                  rotationIds: current.rotationIds,
                })
              }
            }
          }
        }
      }
    }

    return grid
  }, [
    rotations,
    heats,
    heatsCount,
    laneCount,
    editingVolunteerId,
    rotationsByVolunteer,
    minHeatBuffer,
    filterEmptyLanes,
    occupiedLanesByHeat,
    displayToHeatNumber,
    heatNumberToDisplay,
  ])

  const previewCellMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const cell of previewCells) {
      map.set(`${cell.heat}:${cell.lane}`, cell.blockIndex)
    }
    return map
  }, [previewCells])

  const selectedVolunteerCells = useMemo(() => {
    if (!selectedVolunteerId) return new Set<string>()
    const volunteerRotations = rotationsByVolunteer.get(selectedVolunteerId)
    if (!volunteerRotations) return new Set<string>()

    const cellKeys = new Set<string>()
    for (const rotation of volunteerRotations) {
      const assignments = expandRotationToAssignments(rotation, heats, {
        respectOccupiedLanes: filterEmptyLanes,
      })
      for (const assignment of assignments) {
        const displayIdx = heatNumberToDisplay.get(assignment.heatNumber)
        if (displayIdx === undefined) continue
        cellKeys.add(`${displayIdx}:${assignment.laneNumber}`)
      }
    }
    return cellKeys
  }, [
    selectedVolunteerId,
    rotationsByVolunteer,
    heats,
    filterEmptyLanes,
    heatNumberToDisplay,
  ])

  const BLOCK_COLORS = [
    { bg: "bg-blue-500/30", border: "border-blue-500" },
    { bg: "bg-purple-500/30", border: "border-purple-500" },
    { bg: "bg-cyan-500/30", border: "border-cyan-500" },
    { bg: "bg-pink-500/30", border: "border-pink-500" },
    { bg: "bg-orange-500/30", border: "border-orange-500" },
  ]

  const getJudgeName = useCallback(
    (assigneeId: string) => {
      const judge = availableJudges.find((j) => j.membershipId === assigneeId)
      if (!judge) return "Unknown Judge"
      return getCrewJudgeName(judge)
    },
    [availableJudges],
  )

  /** Build a volunteer's full rotation draft set with one rotation moved. */
  const handleRotationDrop = useCallback(
    async (
      rotation: CompetitionJudgeRotation,
      targetHeat: number,
      targetLane: number,
    ) => {
      if (
        rotation.startingHeat === targetHeat &&
        rotation.startingLane === targetLane
      ) {
        return
      }

      const assigneeId = rotationAssigneeId(rotation)
      const volunteerRotations = rotationsByVolunteer.get(assigneeId) ?? []
      const next: RotationDraft[] = volunteerRotations.map((r) =>
        r.id === rotation.id
          ? {
              startingHeat: targetHeat,
              startingLane: targetLane,
              heatsCount: r.heatsCount,
              notes: r.notes ?? undefined,
            }
          : {
              startingHeat: r.startingHeat,
              startingLane: r.startingLane,
              heatsCount: r.heatsCount,
              notes: r.notes ?? undefined,
            },
      )

      try {
        await onSaveVolunteerRotations(assigneeId, next)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to move rotation",
        )
      }
    },
    [rotationsByVolunteer, onSaveVolunteerRotations],
  )

  function handleCreateRotation() {
    setEditingVolunteerId(null)
    setInitialCellPosition(null)
    setSelectedRotationId(null)
    setEditingRotationCells(new Set())
    setActiveBlockIndex(0)
    setIsEditorOpen(true)
  }

  function handleCellClick(heat: number, lane: number) {
    if (filterEmptyLanes) {
      const occupiedLanes = occupiedLanesByHeat.get(heat)
      if (!occupiedLanes?.has(lane)) return
    }

    if (isEditorOpen) {
      setExternalPosition({ heat, lane, timestamp: Date.now() })
    } else {
      setEditingVolunteerId(null)
      setInitialCellPosition({ heat, lane })
      setExternalPosition(null)
      setSelectedRotationId(null)
      setSelectedVolunteerId(null)
      setEditingRotationCells(new Set())
      setActiveBlockIndex(0)
      setIsEditorOpen(true)
    }
  }

  function cellsForVolunteer(assigneeId: string): Set<string> {
    const volunteerRotations = rotationsByVolunteer.get(assigneeId) || []
    const cellKeys = new Set<string>()
    for (const rotation of volunteerRotations) {
      const assignments = expandRotationToAssignments(rotation, heats, {
        respectOccupiedLanes: filterEmptyLanes,
      })
      for (const assignment of assignments) {
        const displayIdx = heatNumberToDisplay.get(assignment.heatNumber)
        if (displayIdx === undefined) continue
        cellKeys.add(`${displayIdx}:${assignment.laneNumber}`)
      }
    }
    return cellKeys
  }

  function handleEditVolunteerRotations(assigneeId: string) {
    setEditingRotationCells(cellsForVolunteer(assigneeId))
    setEditingVolunteerId(assigneeId)
    setInitialCellPosition(null)
    setSelectedRotationId(null)
    setSelectedVolunteerId(null)
    setActiveBlockIndex(0)
    setIsEditorOpen(true)
  }

  function handleAddRotationForVolunteer(assigneeId: string) {
    setEditingRotationCells(cellsForVolunteer(assigneeId))
    const volunteerRotations = rotationsByVolunteer.get(assigneeId) || []
    setEditingVolunteerId(assigneeId)
    setInitialCellPosition(null)
    setSelectedRotationId(null)
    setSelectedVolunteerId(null)
    setActiveBlockIndex(volunteerRotations.length)
    setIsEditorOpen(true)
  }

  function handleEditorSuccess() {
    setIsEditorOpen(false)
    setEditingVolunteerId(null)
    setInitialCellPosition(null)
    setExternalPosition(null)
    setPreviewCells([])
    setEditingRotationCells(new Set())
    setSelectedVolunteerId(null)
    setActiveBlockIndex(0)
  }

  function handleEditorCancel() {
    setIsEditorOpen(false)
    setEditingVolunteerId(null)
    setInitialCellPosition(null)
    setExternalPosition(null)
    setPreviewCells([])
    setEditingRotationCells(new Set())
    setSelectedVolunteerId(null)
    setActiveBlockIndex(0)
  }

  function toggleVolunteerExpansion(assigneeId: string) {
    const isCurrentlyExpanded = expandedVolunteers.has(assigneeId)

    setExpandedVolunteers((prev) => {
      const next = new Set(prev)
      if (next.has(assigneeId)) next.delete(assigneeId)
      else next.add(assigneeId)
      return next
    })

    if (isCurrentlyExpanded) {
      if (selectedVolunteerId === assigneeId) setSelectedVolunteerId(null)
    } else {
      setSelectedRotationId(null)
      setSelectedVolunteerId(assigneeId)
    }
  }

  function toggleRotationSelection(rotationId: string) {
    setSelectedVolunteerId(null)
    setSelectedRotationId((prev) => (prev === rotationId ? null : rotationId))
  }

  function handleDeleteVolunteerRotations(assigneeId: string) {
    setDeletingVolunteerId(assigneeId)
    setDeleteConfirmOpen(true)
  }

  async function confirmDeleteVolunteerRotations() {
    if (!deletingVolunteerId) return
    setIsDeleting(true)
    try {
      await onDeleteVolunteerRotations(deletingVolunteerId)
      toast.success("Rotations deleted")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete rotations",
      )
    } finally {
      setIsDeleting(false)
      setDeleteConfirmOpen(false)
      setDeletingVolunteerId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Rotation Timeline</h3>
          <p className="text-sm text-muted-foreground">
            {eventName} - {heatsCount} heats x {laneCount} lanes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="filter-empty-lanes"
            checked={filterEmptyLanes}
            onCheckedChange={(checked) =>
              onFilterEmptyLanesChange(checked === true)
            }
          />
          <label
            htmlFor="filter-empty-lanes"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Only show lanes with athletes
          </label>
        </div>
      </div>

      {/* Main Content: Action Panel (left) + Grid (right) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Action Area - swaps between judge list and form */}
        <Card className="lg:self-start">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              {isEditorOpen ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEditorCancel}
                    className="-ml-2 gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <CardTitle className="text-sm font-medium">
                    {editingVolunteerId ? "Edit rotations" : "Add rotation"}
                  </CardTitle>
                  <div className="w-16" />
                </>
              ) : (
                <>
                  <CardTitle className="text-sm font-medium">
                    Assigned Judges ({rotationsByVolunteer.size})
                  </CardTitle>
                  <Button size="sm" onClick={handleCreateRotation}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {isEditorOpen ? (
              <MultiRotationEditor
                maxHeats={heatsCount}
                maxLanes={laneCount}
                availableJudges={availableJudges}
                rotationsByVolunteer={rotationsByVolunteer}
                existingRotations={
                  editingVolunteerId
                    ? rotationsByVolunteer.get(editingVolunteerId)
                    : undefined
                }
                initialHeat={initialCellPosition?.heat}
                initialLane={initialCellPosition?.lane}
                externalPosition={externalPosition}
                activeBlockIndex={activeBlockIndex}
                onActiveBlockChange={setActiveBlockIndex}
                eventLaneShiftPattern={eventLaneShiftPattern}
                eventDefaultHeatsCount={eventDefaultHeatsCount}
                onSave={onSaveVolunteerRotations}
                onSuccess={handleEditorSuccess}
                onCancel={handleEditorCancel}
                onPreviewChange={setPreviewCells}
                onJudgeSelect={setSelectedVolunteerId}
              />
            ) : rotationsByVolunteer.size === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No judges assigned yet.
                <br />
                Click a cell in the grid or "Add" to assign judges.
              </p>
            ) : (
              <>
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search judges..."
                    value={judgeSearchQuery}
                    onChange={(e) => setJudgeSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-sm"
                  />
                </div>

                <div className="mb-3">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    Filter by Availability
                  </div>
                  <ToggleGroup
                    value={availabilityFilter}
                    onValueChange={(value) =>
                      setAvailabilityFilter(
                        value as "all" | VolunteerAvailability,
                      )
                    }
                    options={[
                      { value: "all", label: "All" },
                      {
                        value: VOLUNTEER_AVAILABILITY.MORNING,
                        label: "Morning",
                      },
                      {
                        value: VOLUNTEER_AVAILABILITY.AFTERNOON,
                        label: "Afternoon",
                      },
                      {
                        value: VOLUNTEER_AVAILABILITY.ALL_DAY,
                        label: "All Day",
                      },
                    ]}
                    className="justify-start"
                  />
                </div>
                <div className="max-h-[60vh] space-y-2 overflow-y-auto">
                  {Array.from(filteredRotationsByVolunteer.entries()).map(
                    ([assigneeId, volunteerRotations]) => {
                      const judgeName = getJudgeName(assigneeId)
                      const isExpanded = expandedVolunteers.has(assigneeId)

                      const heatRanges = volunteerRotations.map((r) => ({
                        start: r.startingHeat,
                        end: Math.min(
                          r.startingHeat + r.heatsCount - 1,
                          heatsCount,
                        ),
                      }))
                      const minHeat = Math.min(
                        ...heatRanges.map((r) => r.start),
                      )
                      const maxHeat = Math.max(...heatRanges.map((r) => r.end))

                      const isVolunteerSelected =
                        selectedVolunteerId === assigneeId

                      return (
                        <div
                          key={assigneeId}
                          className={`rounded-lg border transition-colors ${
                            isVolunteerSelected
                              ? "border-primary bg-primary/10 ring-1 ring-primary"
                              : "bg-muted/50"
                          }`}
                        >
                          <div className="space-y-2 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  toggleVolunteerExpansion(assigneeId)
                                }
                                className="flex flex-1 items-center gap-2 text-left"
                              >
                                <User
                                  className={`h-4 w-4 flex-shrink-0 ${
                                    isVolunteerSelected
                                      ? "text-primary"
                                      : "text-muted-foreground"
                                  }`}
                                />
                                <div className="min-w-0 flex-1">
                                  <div
                                    className={`truncate text-sm font-medium ${
                                      isVolunteerSelected ? "text-primary" : ""
                                    }`}
                                  >
                                    {judgeName} ({volunteerRotations.length}{" "}
                                    rotation
                                    {volunteerRotations.length > 1 ? "s" : ""})
                                  </div>
                                  <div className="text-xs tabular-nums text-muted-foreground">
                                    Heats {minHeat}-{maxHeat} • Lane{" "}
                                    {volunteerRotations[0]?.startingLane ?? 1}
                                    {volunteerRotations[0]?.laneShiftPattern &&
                                      volunteerRotations[0].laneShiftPattern !==
                                        "stay" && (
                                        <span className="ml-1">
                                          (
                                          {volunteerRotations[0].laneShiftPattern.replace(
                                            "_",
                                            " ",
                                          )}
                                          )
                                        </span>
                                      )}
                                  </div>
                                </div>
                                <ChevronLeft
                                  className={`h-4 w-4 transition-transform ${isExpanded ? "-rotate-90" : ""}`}
                                />
                              </button>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() =>
                                  handleEditVolunteerRotations(assigneeId)
                                }
                              >
                                <Pencil className="mr-1 h-3 w-3" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() =>
                                  handleAddRotationForVolunteer(assigneeId)
                                }
                              >
                                <Plus className="mr-1 h-3 w-3" />
                                Add rotation
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                onClick={() =>
                                  handleDeleteVolunteerRotations(assigneeId)
                                }
                                title="Delete all rotations"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="space-y-1.5 border-t px-3 pb-3 pt-2">
                              {volunteerRotations.map((rotation, idx) => {
                                const endHeat = Math.min(
                                  rotation.startingHeat +
                                    rotation.heatsCount -
                                    1,
                                  heatsCount,
                                )
                                const isSelected =
                                  selectedRotationId === rotation.id

                                return (
                                  <button
                                    key={rotation.id}
                                    type="button"
                                    onClick={() =>
                                      toggleRotationSelection(rotation.id)
                                    }
                                    className={`flex w-full items-center gap-2 rounded border p-2 text-left transition-all ${
                                      isSelected
                                        ? "border-primary bg-primary/10"
                                        : "border-border bg-background hover:bg-muted/50"
                                    }`}
                                  >
                                    <span className="text-xs">
                                      <span className="font-medium">
                                        Rotation {idx + 1}:
                                      </span>{" "}
                                      <span className="tabular-nums text-muted-foreground">
                                        H{rotation.startingHeat}-{endHeat}, L
                                        {rotation.startingLane}
                                        {rotation.laneShiftPattern ===
                                        "shift_right"
                                          ? " (shift)"
                                          : " (stay)"}
                                      </span>
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    },
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Timeline Grid */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Coverage: {coverage.coveragePercent}% ({coverage.coveredSlots}/
              {coverage.totalSlots})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="w-full">
              <div className="min-w-max">
                <div
                  className="grid gap-0 overflow-hidden rounded-lg border"
                  style={{
                    gridTemplateColumns: `60px repeat(${heatsCount}, 60px)`,
                    gridTemplateRows: `40px 24px repeat(${laneCount}, 40px)`,
                  }}
                >
                  {/* Header Row - Heat Numbers */}
                  <div className="sticky left-0 z-20 flex items-center justify-center border-b border-r bg-muted text-xs font-medium">
                    Lane
                  </div>
                  {Array.from({ length: heatsCount }, (_, i) => i + 1).map(
                    (heat) => (
                      <div
                        key={heat}
                        className="flex items-center justify-center border-b border-r bg-muted text-xs font-medium tabular-nums last:border-r-0"
                      >
                        H{heat}
                      </div>
                    ),
                  )}

                  {/* Header Row - Heat Times */}
                  <div className="sticky left-0 z-20 border-b border-r bg-muted" />
                  {heatsWithAssignments.map((heat) => {
                    const timeText = heat.scheduledTime
                      ? heat.scheduledTime.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "--"
                    return (
                      <div
                        key={`time-${heat.heatNumber}`}
                        className="flex items-center justify-center border-b border-r bg-muted text-xs tabular-nums text-muted-foreground last:border-r-0"
                      >
                        {timeText}
                      </div>
                    )
                  })}

                  {/* Lane Rows */}
                  {Array.from({ length: laneCount }, (_, i) => i + 1).map(
                    (lane) => (
                      <Fragment key={`lane-row-${lane}`}>
                        <div className="sticky left-0 z-10 flex items-center justify-center border-b border-r bg-muted text-xs font-medium tabular-nums">
                          L{lane}
                        </div>

                        {Array.from(
                          { length: heatsCount },
                          (_, i) => i + 1,
                        ).map((heat) => {
                          const key = `${heat}:${lane}`
                          const cellData = coverageGrid.get(key) || {
                            status: "empty" as const,
                            rotationIds: [],
                          }
                          const isHighlighted =
                            (selectedRotationId !== null &&
                              cellData.rotationIds.includes(
                                selectedRotationId,
                              )) ||
                            selectedVolunteerCells.has(key)
                          const previewBlockIndex = previewCellMap.get(key)
                          const isPreview = previewBlockIndex !== undefined
                          const isEditingCell = editingRotationCells.has(key)
                          const isPreviewConflict =
                            isPreview &&
                            cellData.status !== "empty" &&
                            !isEditingCell

                          return (
                            <TimelineCell
                              key={key}
                              status={cellData.status}
                              isHighlighted={isHighlighted}
                              isPreview={isPreview}
                              previewBlockIndex={previewBlockIndex}
                              blockColors={BLOCK_COLORS}
                              isPreviewConflict={isPreviewConflict}
                              isEditingCell={isEditingCell}
                              minHeatBuffer={minHeatBuffer}
                              onClick={() => handleCellClick(heat, lane)}
                              onRotationDrop={(rotation) =>
                                handleRotationDrop(rotation, heat, lane)
                              }
                            />
                          )
                        })}
                      </Fragment>
                    ),
                  )}
                </div>
              </div>
            </ScrollArea>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded border bg-background" />
                <span className="text-muted-foreground">Empty</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded border bg-emerald-500/40" />
                <span className="text-muted-foreground">Covered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded border bg-amber-500/40" />
                <span className="text-muted-foreground">Overlap</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded border bg-neutral-200 dark:bg-neutral-800 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(0,0,0,0.15)_2px,rgba(0,0,0,0.15)_4px)]" />
                <span className="text-muted-foreground">No Athlete</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded border bg-primary/60 ring-2 ring-primary" />
                <span className="text-muted-foreground">Selected</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all rotations?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all rotations for{" "}
              {deletingVolunteerId
                ? getJudgeName(deletingVolunteerId)
                : "this judge"}{" "}
              from this event. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteVolunteerRotations}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface TimelineCellProps {
  status: "empty" | "covered" | "overlap" | "buffer-blocked" | "unavailable"
  isHighlighted: boolean
  isPreview: boolean
  previewBlockIndex?: number
  blockColors: Array<{ bg: string; border: string }>
  isPreviewConflict: boolean
  isEditingCell: boolean
  minHeatBuffer: number
  onClick: () => void
  onRotationDrop: (rotation: CompetitionJudgeRotation) => void
}

function TimelineCell({
  status,
  isHighlighted,
  isPreview,
  previewBlockIndex,
  blockColors,
  isPreviewConflict,
  isEditingCell,
  minHeatBuffer,
  onClick,
  onRotationDrop,
}: TimelineCellProps) {
  const [isDraggedOver, setIsDraggedOver] = useState(false)
  const isUnavailable = status === "unavailable"

  const setRef = useCallback(
    (element: HTMLButtonElement | null) => {
      if (!element || isUnavailable) return
      return dropTargetForElements({
        element,
        canDrop: ({ source }) => source.data.type === "rotation",
        onDragEnter: () => setIsDraggedOver(true),
        onDragLeave: () => setIsDraggedOver(false),
        onDrop: ({ source }) => {
          setIsDraggedOver(false)
          const rotation = source.data.rotation as
            | CompetitionJudgeRotation
            | undefined
          if (rotation) onRotationDrop(rotation)
        },
      })
    },
    [onRotationDrop, isUnavailable],
  )

  let bgClass: string
  let title: string | undefined

  if (isUnavailable) {
    bgClass =
      "bg-neutral-200 dark:bg-neutral-800 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.1)_4px,rgba(0,0,0,0.1)_8px)] dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.1)_4px,rgba(255,255,255,0.1)_8px)] cursor-not-allowed"
    title = "No athlete assigned"
  } else if (isPreviewConflict) {
    bgClass = "bg-red-500/40 border-dashed border-2 border-red-500"
    title = "Conflict: Heat already assigned"
  } else if (isPreview && previewBlockIndex !== undefined) {
    const colors = blockColors[previewBlockIndex % blockColors.length] ?? {
      bg: "bg-blue-500/30",
      border: "border-blue-500",
    }
    bgClass = `${colors.bg} border-dashed border-2 ${colors.border}`
    title = `Preview: Block ${previewBlockIndex + 1}`
  } else if (isEditingCell) {
    bgClass = "bg-background ring-2 ring-inset ring-emerald-500"
    title = "Current assignment"
  } else if (isHighlighted) {
    bgClass = "bg-primary/50 ring-2 ring-inset ring-primary"
    title = "Selected rotation"
  } else if (status === "buffer-blocked") {
    bgClass = "bg-amber-500/20 border-amber-500/40 border-2"
    title = `Buffer zone: Requires ${minHeatBuffer} heat gap between rotations`
  } else if (status === "empty") {
    bgClass = "bg-background hover:bg-muted/50"
  } else if (status === "covered") {
    bgClass = "bg-emerald-500/30"
    title = "Covered"
  } else {
    bgClass = "bg-amber-500/30"
    title = "Overlap: Multiple judges assigned"
  }

  return (
    <button
      ref={setRef}
      type="button"
      onClick={isUnavailable ? undefined : onClick}
      title={title}
      disabled={isUnavailable}
      className={`border-b border-r transition-colors last:border-r-0 ${bgClass} ${
        isDraggedOver ? "ring-2 ring-inset ring-blue-500" : ""
      } ${isUnavailable ? "" : "cursor-pointer"}`}
    />
  )
}
