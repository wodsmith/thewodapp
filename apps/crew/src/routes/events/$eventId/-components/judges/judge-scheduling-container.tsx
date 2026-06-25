"use client"

// @lat: [[crew#Judge Rotations]]

import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  CalendarDays,
  Loader2,
  MousePointerClick,
  Search,
  Send,
  Sparkles,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  type CrewJudgeRotationsPageData,
  publishCrewJudgeRotationsFn,
  saveCrewJudgeRotationsForVolunteerFn,
} from "@/server-fns/crew-judge-rotations-fns"
import { DraggableJudge } from "./draggable-judge"
import {
  autoFillWorkout,
  fillHeatWithAvailableJudges,
  getCrewJudgeName,
  gridCellsToRotationRows,
  type JudgeGridCell,
  JUDGE_GRID_LANE_SHIFT_PATTERN,
  rotationsToGridCells,
} from "./judge-grid-utils"
import { type HeatLaneAssignment, JudgeHeatCard } from "./judge-heat-card"
import { JudgeOverview } from "./judge-overview"

interface JudgeSchedulingContainerProps {
  eventId: string
  page: CrewJudgeRotationsPageData
  /** Currently selected workout ID (the wodsmith-start "event"). */
  selectedWorkoutId: string
  onWorkoutChange: (workoutId: string) => void
}

/**
 * Main container for Crew judge scheduling — a port of the wodsmith-start
 * organizer judging grid wired to Crew's rotation + version data layer. Grid
 * placements are kept as local cells and persisted per judge as single-heat
 * rotations; publishing materializes them through Crew's existing publish path.
 *
 * Built for FAST fill: drag a judge onto a lane, or pick an "active judge" and
 * click lanes to seat them, plus one-click bulk actions (fill a heat, seat a
 * judge down a whole lane across the workout, auto-distribute the whole grid).
 * Crew has no athlete/lane-occupancy data, so every lane of every heat is
 * always droppable and visible.
 */
export function JudgeSchedulingContainer({
  eventId,
  page,
  selectedWorkoutId,
  onWorkoutChange,
}: JudgeSchedulingContainerProps) {
  const router = useRouter()
  const saveRotations = useServerFn(saveCrewJudgeRotationsForVolunteerFn)
  const publishRotations = useServerFn(publishCrewJudgeRotationsFn)

  const { workouts, heats, judges } = page

  const [availableJudgeSearch, setAvailableJudgeSearch] = useState("")
  const [selectedJudgeIds, setSelectedJudgeIds] = useState<Set<string>>(
    new Set(),
  )
  const [publishNotes, setPublishNotes] = useState("")
  const [isPublishing, setIsPublishing] = useState(false)
  const [pendingJudgeIds, setPendingJudgeIds] = useState<Set<string>>(new Set())

  // Heats for the selected workout, sorted by heat number.
  const workoutHeats = useMemo(
    () =>
      heats
        .filter((h) => h.trackWorkoutId === selectedWorkoutId)
        .sort((a, b) => a.heatNumber - b.heatNumber),
    [heats, selectedWorkoutId],
  )

  // Max lanes across this workout's heats (fallback 10). Lane count comes from
  // each heat's location/venue, never from athletes.
  const maxLanes = useMemo(() => {
    const max = workoutHeats.reduce(
      (acc, heat) => Math.max(acc, heat.laneCount),
      0,
    )
    return max > 0 ? max : 10
  }, [workoutHeats])

  // Saved rotations for the selected workout, expanded into grid cells.
  const savedGridCells = useMemo(() => {
    const workoutRotations = page.rotations.filter(
      (rotation) => rotation.trackWorkoutId === selectedWorkoutId,
    )
    return rotationsToGridCells(workoutRotations, workoutHeats)
  }, [page.rotations, selectedWorkoutId, workoutHeats])

  // Local, editable grid state. Seeded from saved rotations and re-synced when
  // the loader data or selected workout changes.
  const [gridCells, setGridCells] = useState<JudgeGridCell[]>(savedGridCells)
  useEffect(() => {
    setGridCells(savedGridCells)
  }, [savedGridCells])

  const judgeByMembershipId = useMemo(
    () => new Map(judges.map((judge) => [judge.membershipId, judge])),
    [judges],
  )

  // Cells indexed by heat number for fast per-heat lookups.
  const cellsByHeatNumber = useMemo(() => {
    const map = new Map<number, JudgeGridCell[]>()
    for (const cell of gridCells) {
      const list = map.get(cell.heatNumber) ?? []
      list.push(cell)
      map.set(cell.heatNumber, list)
    }
    return map
  }, [gridCells])

  // Judges assigned somewhere in the current workout.
  const assignedJudgeIds = useMemo(
    () => new Set(gridCells.map((cell) => cell.membershipId)),
    [gridCells],
  )

  const unassignedJudges = useMemo(
    () => judges.filter((j) => !assignedJudgeIds.has(j.membershipId)),
    [judges, assignedJudgeIds],
  )

  // All judges sorted by assignment count (ascending — least assigned first).
  const judgesByAssignmentCount = useMemo(() => {
    const counts = new Map<string, number>()
    for (const judge of judges) counts.set(judge.membershipId, 0)
    for (const cell of gridCells) {
      counts.set(cell.membershipId, (counts.get(cell.membershipId) ?? 0) + 1)
    }
    return [...judges]
      .map((judge) => ({
        ...judge,
        assignmentCount: counts.get(judge.membershipId) ?? 0,
      }))
      .sort((a, b) => a.assignmentCount - b.assignmentCount)
  }, [judges, gridCells])

  const filteredJudgesByAssignmentCount = useMemo(() => {
    if (!availableJudgeSearch.trim()) return judgesByAssignmentCount
    const query = availableJudgeSearch.toLowerCase().trim()
    return judgesByAssignmentCount.filter((judge) =>
      getCrewJudgeName(judge).toLowerCase().includes(query),
    )
  }, [judgesByAssignmentCount, availableJudgeSearch])

  const selectedWorkout = workouts.find(
    (workout) => workout.id === selectedWorkoutId,
  )
  const activeVersion = selectedWorkoutId
    ? page.activeVersionByWorkout[selectedWorkoutId]
    : null

  // "Active judge" click-to-assign mode: when exactly one judge is selected,
  // clicking lanes seats/removes that judge — faster than dragging for filling
  // many cells.
  const activeJudgeId =
    selectedJudgeIds.size === 1 ? Array.from(selectedJudgeIds)[0] : null
  const activeJudge = activeJudgeId
    ? (judgeByMembershipId.get(activeJudgeId) ?? null)
    : null

  function markJudgePending(membershipId: string, pending: boolean) {
    setPendingJudgeIds((prev) => {
      const next = new Set(prev)
      if (pending) next.add(membershipId)
      else next.delete(membershipId)
      return next
    })
  }

  /**
   * Persist a set of judges' grid cells from a single already-computed `next`
   * cell set. Each save is scoped to one membership (Crew's save fn replaces
   * that judge's rotations for the workout). Optimistic; reverts on error.
   */
  async function persistJudges(
    membershipIds: string[],
    nextCells: JudgeGridCell[],
  ) {
    const uniqueIds = Array.from(new Set(membershipIds))
    if (uniqueIds.length === 0) return
    const previousCells = gridCells
    setGridCells(nextCells)
    for (const id of uniqueIds) markJudgePending(id, true)
    try {
      await Promise.all(
        uniqueIds.map((membershipId) =>
          saveRotations({
            data: {
              eventId,
              trackWorkoutId: selectedWorkoutId,
              membershipId,
              laneShiftPattern: JUDGE_GRID_LANE_SHIFT_PATTERN,
              rotations: gridCellsToRotationRows(
                nextCells.filter((cell) => cell.membershipId === membershipId),
              ),
            },
          }),
        ),
      )
      await router.invalidate()
    } catch (error) {
      setGridCells(previousCells)
      toast.error(
        error instanceof Error ? error.message : "Failed to save judges",
      )
    } finally {
      for (const id of uniqueIds) markJudgePending(id, false)
    }
  }

  function handleAssign(
    heatNumber: number,
    membershipId: string,
    laneNumber: number,
  ) {
    const next = gridCells.filter(
      (cell) =>
        // Replace any existing cell for this judge in this heat, and free the
        // target lane if another judge sat there.
        !(
          (cell.membershipId === membershipId &&
            cell.heatNumber === heatNumber) ||
          (cell.heatNumber === heatNumber && cell.laneNumber === laneNumber)
        ),
    )
    const displaced = gridCells.filter(
      (cell) =>
        cell.heatNumber === heatNumber &&
        cell.laneNumber === laneNumber &&
        cell.membershipId !== membershipId,
    )
    next.push({ membershipId, heatNumber, laneNumber })
    void persistJudges(
      [membershipId, ...displaced.map((cell) => cell.membershipId)],
      next,
    )
  }

  function handleBulkAssign(
    heatNumber: number,
    placements: Array<{ membershipId: string; laneNumber: number }>,
  ) {
    let next = gridCells.slice()
    const touched: string[] = []
    for (const placement of placements) {
      next = next.filter(
        (cell) =>
          !(
            (cell.membershipId === placement.membershipId &&
              cell.heatNumber === heatNumber) ||
            (cell.heatNumber === heatNumber &&
              cell.laneNumber === placement.laneNumber)
          ),
      )
      next.push({
        membershipId: placement.membershipId,
        heatNumber,
        laneNumber: placement.laneNumber,
      })
      touched.push(placement.membershipId)
    }
    void persistJudges(touched, next)
  }

  function handleRemove(heatNumber: number, membershipId: string) {
    const next = gridCells.filter(
      (cell) =>
        !(cell.membershipId === membershipId && cell.heatNumber === heatNumber),
    )
    void persistJudges([membershipId], next)
  }

  function handleMove(
    membershipId: string,
    sourceHeatNumber: number,
    targetHeatNumber: number,
    targetLane: number,
  ) {
    // Free the target lane (if occupied by someone else), drop the moving
    // judge's source + target cells, then seat them at the target.
    const displaced = gridCells.filter(
      (cell) =>
        cell.heatNumber === targetHeatNumber &&
        cell.laneNumber === targetLane &&
        cell.membershipId !== membershipId,
    )
    const next = gridCells.filter(
      (cell) =>
        !(
          (cell.membershipId === membershipId &&
            (cell.heatNumber === sourceHeatNumber ||
              cell.heatNumber === targetHeatNumber)) ||
          (cell.heatNumber === targetHeatNumber &&
            cell.laneNumber === targetLane)
        ),
    )
    next.push({
      membershipId,
      heatNumber: targetHeatNumber,
      laneNumber: targetLane,
    })
    void persistJudges(
      [membershipId, ...displaced.map((cell) => cell.membershipId)],
      next,
    )
  }

  /** Click an empty lane: seat the active judge there (or remove if it's them). */
  function handleLaneClick(heatNumber: number, laneNumber: number) {
    if (!activeJudgeId) return
    const occupant = gridCells.find(
      (cell) => cell.heatNumber === heatNumber && cell.laneNumber === laneNumber,
    )
    if (occupant?.membershipId === activeJudgeId) {
      handleRemove(heatNumber, activeJudgeId)
      return
    }
    handleAssign(heatNumber, activeJudgeId, laneNumber)
  }

  /** Seat the active judge in the same lane across every heat of the workout. */
  function handleAssignActiveJudgeToColumn(laneNumber: number) {
    if (!activeJudgeId) return
    const next = gridCells.filter(
      (cell) =>
        !(
          // clear this judge everywhere in the workout, plus free that lane for
          // every heat
          cell.membershipId === activeJudgeId || cell.laneNumber === laneNumber
        ),
    )
    const displaced = gridCells.filter(
      (cell) =>
        cell.laneNumber === laneNumber && cell.membershipId !== activeJudgeId,
    )
    for (const heat of workoutHeats) {
      if (laneNumber <= heat.laneCount) {
        next.push({
          membershipId: activeJudgeId,
          heatNumber: heat.heatNumber,
          laneNumber,
        })
      }
    }
    void persistJudges(
      [activeJudgeId, ...displaced.map((cell) => cell.membershipId)],
      next,
    )
  }

  /** Fill one heat's open lanes with the least-assigned available judges. */
  function handleFillHeat(heatNumber: number) {
    const heat = workoutHeats.find((h) => h.heatNumber === heatNumber)
    if (!heat) return
    const result = fillHeatWithAvailableJudges({
      cells: gridCells,
      heat,
      // Prefer judges not yet in this heat, least-assigned first.
      judgeOrder: judgesByAssignmentCount.map((judge) => judge.membershipId),
    })
    if (result.touched.length === 0) {
      toast.info("No open lanes or no available judges for this heat")
      return
    }
    void persistJudges(result.touched, result.cells)
  }

  /** Auto-distribute available judges across every open lane in the workout. */
  function handleAutoFillWorkout() {
    const result = autoFillWorkout({
      cells: gridCells,
      heats: workoutHeats,
      judgeOrder: judgesByAssignmentCount.map((judge) => judge.membershipId),
    })
    if (result.touched.length === 0) {
      toast.info("Grid is already full or there are no judges to seat")
      return
    }
    void persistJudges(result.touched, result.cells)
  }

  function handleToggleSelect(membershipId: string, shiftKey: boolean) {
    setSelectedJudgeIds((prev) => {
      const next = new Set(prev)
      if (shiftKey && prev.size > 0) {
        const sortedJudges = judgesByAssignmentCount
        const lastSelected = Array.from(prev).pop()
        const lastIndex = sortedJudges.findIndex(
          (j) => j.membershipId === lastSelected,
        )
        const currentIndex = sortedJudges.findIndex(
          (j) => j.membershipId === membershipId,
        )
        if (lastIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex)
          const end = Math.max(lastIndex, currentIndex)
          for (let i = start; i <= end; i++) {
            const judge = sortedJudges[i]
            if (judge) next.add(judge.membershipId)
          }
          return next
        }
      }
      if (next.has(membershipId)) next.delete(membershipId)
      else next.add(membershipId)
      return next
    })
  }

  function clearSelection() {
    setSelectedJudgeIds(new Set())
  }

  async function handlePublish() {
    if (!selectedWorkoutId) return
    setIsPublishing(true)
    try {
      await publishRotations({
        data: {
          eventId,
          trackWorkoutId: selectedWorkoutId,
          notes: publishNotes,
        },
      })
      toast.success("Published judge schedule")
      setPublishNotes("")
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to publish judge schedule",
      )
    } finally {
      setIsPublishing(false)
    }
  }

  // Build per-heat assignment lists for the grid.
  function heatAssignments(heatNumber: number): HeatLaneAssignment[] {
    const cells = cellsByHeatNumber.get(heatNumber) ?? []
    return cells
      .map((cell) => {
        const volunteer = judgeByMembershipId.get(cell.membershipId)
        if (!volunteer) return null
        return {
          membershipId: cell.membershipId,
          laneNumber: cell.laneNumber,
          volunteer,
        }
      })
      .filter((value): value is HeatLaneAssignment => value !== null)
  }

  const isAnyPending = pendingJudgeIds.size > 0

  return (
    <section className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Judging Schedule</h2>
          <p className="text-sm text-muted-foreground">
            Drag judges onto lanes, or pick a judge and click lanes. Use the
            quick-fill actions to seat many at once, then publish.
          </p>
        </div>
        {selectedWorkoutId ? (
          <div className="flex flex-col gap-2 sm:min-w-80">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {activeVersion ? "Published schedule" : "Not published"}
              </span>
              <Button
                type="button"
                onClick={handlePublish}
                disabled={isPublishing}
              >
                {isPublishing ? <Loader2 className="animate-spin" /> : <Send />}
                Publish
              </Button>
            </div>
            <Textarea
              value={publishNotes}
              onChange={(event) => setPublishNotes(event.target.value)}
              placeholder="Schedule notes"
              className="min-h-16"
            />
          </div>
        ) : null}
      </div>

      {/* Workout selector + workout-wide quick fill */}
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="event-selector" className="text-sm font-medium">
          Workout:
        </label>
        <Select value={selectedWorkoutId} onValueChange={onWorkoutChange}>
          <SelectTrigger id="event-selector" className="w-80">
            <SelectValue placeholder="Select workout" />
          </SelectTrigger>
          <SelectContent>
            {workouts.map((workout) => (
              <SelectItem key={workout.id} value={workout.id}>
                Event {workout.trackOrder}: {workout.workout.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedWorkout && workoutHeats.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAutoFillWorkout}
            disabled={isAnyPending || unassignedJudges.length === 0}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Auto-fill workout
          </Button>
        ) : null}
        {isAnyPending ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving
          </span>
        ) : null}
      </div>

      {/* Active-judge hint */}
      {activeJudge ? (
        <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <MousePointerClick className="h-4 w-4 text-primary" />
          <span>
            Click any lane to seat{" "}
            <span className="font-medium">{getCrewJudgeName(activeJudge)}</span>
            . Use a lane's column button to seat them down that lane for the
            whole workout.
          </span>
          <button
            type="button"
            onClick={clearSelection}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Done
          </button>
        </div>
      ) : null}

      {/* Overview */}
      <JudgeOverview workouts={workouts} heats={heats} gridCells={gridCells} />

      {/* Main content: judges panel + heats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* Available Judges Panel */}
        <Card className="lg:sticky lg:top-4 lg:self-start">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-medium">Available Judges</h4>
              {selectedJudgeIds.size > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear ({selectedJudgeIds.size})
                </button>
              )}
            </div>
            {judges.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No judges have been added yet. Add volunteers with the Judge
                role type in the Roster section.
              </p>
            ) : (
              <>
                <p className="mb-3 text-xs text-muted-foreground">
                  Click a judge to enter click-to-assign mode, or drag them onto
                  a lane. Shift-click to multi-select for bulk drags.
                </p>
                {/* Search Input */}
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search judges..."
                    value={availableJudgeSearch}
                    onChange={(e) => setAvailableJudgeSearch(e.target.value)}
                    className="h-8 pl-8 text-sm"
                  />
                </div>
                <div className="max-h-[55vh] space-y-1.5 overflow-y-auto">
                  {filteredJudgesByAssignmentCount.map((judge) => (
                    <DraggableJudge
                      key={judge.membershipId}
                      volunteer={judge}
                      isSelected={selectedJudgeIds.has(judge.membershipId)}
                      onToggleSelect={handleToggleSelect}
                      selectedIds={selectedJudgeIds}
                      assignmentCount={judge.assignmentCount}
                      isAssignedToCurrentEvent={assignedJudgeIds.has(
                        judge.membershipId,
                      )}
                    />
                  ))}
                  {filteredJudgesByAssignmentCount.length === 0 &&
                    availableJudgeSearch && (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        No judges match "{availableJudgeSearch}"
                      </p>
                    )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Heats Grid */}
        <div className="space-y-4">
          {!selectedWorkout ? (
            <EmptyHeats message="Select a workout to schedule judges." />
          ) : workoutHeats.length === 0 ? (
            <EmptyHeats message="Create the heat schedule before assigning judges to lanes." />
          ) : (
            workoutHeats.map((heat) => (
              <JudgeHeatCard
                key={heat.id}
                heat={heat}
                unassignedVolunteers={unassignedJudges}
                assignments={heatAssignments(heat.heatNumber)}
                maxLanes={maxLanes}
                activeJudgeId={activeJudgeId}
                onAssign={(membershipId, laneNumber) =>
                  handleAssign(heat.heatNumber, membershipId, laneNumber)
                }
                onBulkAssign={(placements) =>
                  handleBulkAssign(heat.heatNumber, placements)
                }
                onRemove={(membershipId) =>
                  handleRemove(heat.heatNumber, membershipId)
                }
                onMove={(membershipId, sourceHeatId, targetLane) => {
                  const sourceHeat = workoutHeats.find(
                    (h) => h.id === sourceHeatId,
                  )
                  handleMove(
                    membershipId,
                    sourceHeat?.heatNumber ?? heat.heatNumber,
                    heat.heatNumber,
                    targetLane,
                  )
                }}
                onLaneClick={(laneNumber) =>
                  handleLaneClick(heat.heatNumber, laneNumber)
                }
                onAssignActiveToColumn={handleAssignActiveJudgeToColumn}
                onFillHeat={() => handleFillHeat(heat.heatNumber)}
                isPending={isAnyPending}
                selectedJudgeIds={selectedJudgeIds}
                onClearSelection={clearSelection}
              />
            ))
          )}
        </div>
      </div>
    </section>
  )
}

function EmptyHeats({ message }: { message: string }) {
  return (
    <div className="rounded-md border bg-card p-8 text-center shadow-sm">
      <CalendarDays className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
