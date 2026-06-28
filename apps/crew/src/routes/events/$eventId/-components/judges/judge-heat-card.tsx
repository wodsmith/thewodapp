"use client"

import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview"
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview"
import {
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  Clock,
  GripVertical,
  Loader2,
  MapPin,
  Plus,
  Users,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  CrewJudgeHeat,
  CrewJudgeVolunteer,
} from "@/server-fns/crew-judge-rotations-fns"
import { CredentialBadge } from "./credential-badge"
import { getCrewJudgeName } from "./judge-grid-utils"

/** A judge placed into a specific lane of this heat. */
export interface HeatLaneAssignment {
  membershipId: string
  laneNumber: number
  volunteer: CrewJudgeVolunteer
}

interface DroppableLaneProps {
  laneNum: number
  onDropUnassigned: (membershipIds: string[], laneNumber: number) => void
  onDropAssigned: (
    membershipId: string,
    sourceHeatId: string,
    laneNumber: number,
  ) => void
  /** Multi-select drag selection (drives the "tap to assign" affordance). */
  selectedJudgeIds?: Set<string>
  onTapAssign?: (laneNumber: number) => void
  /** Click-to-assign mode is active when a single judge is "active". */
  clickToAssign?: boolean
  onLaneClick?: (laneNumber: number) => void
  /** Seat the active judge down this lane for every heat in the workout. */
  onSeatColumn?: (laneNumber: number) => void
}

function DroppableLane({
  laneNum,
  onDropUnassigned,
  onDropAssigned,
  selectedJudgeIds,
  onTapAssign,
  clickToAssign,
  onLaneClick,
  onSeatColumn,
}: DroppableLaneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isDraggedOver, setIsDraggedOver] = useState(false)
  const hasSelection = selectedJudgeIds && selectedJudgeIds.size > 0
  const interactive = Boolean(clickToAssign || (hasSelection && onTapAssign))

  function handleClick() {
    if (clickToAssign && onLaneClick) {
      onLaneClick(laneNum)
      return
    }
    if (hasSelection && onTapAssign) {
      onTapAssign(laneNum)
    }
  }

  useEffect(() => {
    const element = ref.current
    if (!element) return

    return dropTargetForElements({
      element,
      canDrop: ({ source }) =>
        source.data.type === "judge" || source.data.type === "assigned",
      onDragEnter: () => setIsDraggedOver(true),
      onDragLeave: () => setIsDraggedOver(false),
      onDrop: ({ source }) => {
        setIsDraggedOver(false)

        if (source.data.type === "assigned") {
          // Moving an already assigned judge
          const membershipId = source.data.membershipId as string
          const sourceHeatId = source.data.heatId as string
          if (membershipId && sourceHeatId) {
            onDropAssigned(membershipId, sourceHeatId, laneNum)
          }
        } else {
          // Dropping unassigned judge(s)
          const membershipIds = source.data.membershipIds as
            | string[]
            | undefined
          if (membershipIds && Array.isArray(membershipIds)) {
            onDropUnassigned(membershipIds, laneNum)
          }
        }
      },
    })
  }, [laneNum, onDropUnassigned, onDropAssigned])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && interactive) {
      e.preventDefault()
      handleClick()
    }
  }

  const label = isDraggedOver
    ? "Drop here"
    : clickToAssign
      ? "Click to seat"
      : hasSelection
        ? "Tap to assign"
        : "Empty"

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop target with conditional click handler
    <div
      ref={ref}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? handleClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      className={`group flex items-center gap-3 border-b border-border/50 py-1 transition-colors last:border-0 ${
        isDraggedOver
          ? "rounded border-primary bg-primary/10"
          : interactive
            ? "cursor-pointer hover:bg-primary/5"
            : ""
      }`}
    >
      {/* Spacer to align with grip handle in assigned rows - hidden on mobile */}
      <div className="hidden h-3 w-3 md:block" />
      <span className="w-6 text-sm tabular-nums text-muted-foreground">
        L{laneNum}
      </span>
      <span
        className={`flex-1 text-sm ${
          isDraggedOver
            ? "font-medium text-primary"
            : interactive
              ? "text-primary/70"
              : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      {clickToAssign && onSeatColumn ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
          title="Seat this judge down this lane for the whole workout"
          onClick={(event) => {
            event.stopPropagation()
            onSeatColumn(laneNum)
          }}
        >
          <ChevronsDown className="h-3 w-3" />
        </Button>
      ) : null}
    </div>
  )
}

interface DraggableAssignedJudgeProps {
  assignment: HeatLaneAssignment
  heatId: string
  onRemove: () => void
  isPending: boolean
}

function DraggableAssignedJudge({
  assignment,
  heatId,
  onRemove,
  isPending,
}: DraggableAssignedJudgeProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const displayName = getCrewJudgeName(assignment.volunteer)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    return draggable({
      element,
      getInitialData: () => ({
        type: "assigned",
        heatId,
        membershipId: assignment.membershipId,
        displayName,
        laneNumber: assignment.laneNumber,
      }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
      onGenerateDragPreview({ nativeSetDragImage }) {
        setCustomNativeDragPreview({
          nativeSetDragImage,
          getOffset: pointerOutsideOfPreview({ x: "16px", y: "8px" }),
          render({ container }) {
            const preview = document.createElement("div")
            preview.style.cssText = `
							background: hsl(var(--background));
							border: 2px solid hsl(var(--primary));
							border-radius: 6px;
							padding: 8px 12px;
							font-size: 14px;
							color: hsl(var(--foreground));
							box-shadow: 0 4px 12px rgba(0,0,0,0.25);
						`
            preview.textContent = displayName
            container.appendChild(preview)
          },
        })
      },
    })
  }, [heatId, assignment.membershipId, assignment.laneNumber, displayName])

  return (
    <div
      ref={ref}
      className={`flex items-center gap-3 border-b border-border/50 py-1 last:border-0 ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <GripVertical className="hidden h-3 w-3 cursor-grab text-muted-foreground active:cursor-grabbing md:block" />
      <span className="w-6 text-sm tabular-nums text-muted-foreground">
        L{assignment.laneNumber}
      </span>
      <span className="flex-1 text-sm">{displayName}</span>
      <CredentialBadge
        credentials={assignment.volunteer.credentials}
        className="text-xs"
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={onRemove}
        disabled={isPending}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}

interface JudgeHeatCardProps {
  heat: CrewJudgeHeat
  unassignedVolunteers: CrewJudgeVolunteer[]
  /** Judges currently placed in this heat (one per lane). */
  assignments: HeatLaneAssignment[]
  maxLanes: number
  /** The single "active" judge for click-to-assign, if any. */
  activeJudgeId?: string | null
  /** Persist a judge into this heat at the given lane. */
  onAssign: (membershipId: string, laneNumber: number) => void
  /** Persist multiple judges into sequential available lanes. */
  onBulkAssign: (
    placements: Array<{ membershipId: string; laneNumber: number }>,
  ) => void
  /** Remove a judge from this heat. */
  onRemove: (membershipId: string) => void
  /** Move a judge from another heat into this heat at the given lane. */
  onMove: (
    membershipId: string,
    sourceHeatId: string,
    targetLane: number,
  ) => void
  /** Click-to-assign: seat/remove the active judge at the given lane. */
  onLaneClick: (laneNumber: number) => void
  /** Seat the active judge down a lane for the whole workout. */
  onAssignActiveToColumn: (laneNumber: number) => void
  /** Fill this heat's open lanes with available judges. */
  onFillHeat: () => void
  isPending?: boolean
  selectedJudgeIds?: Set<string>
  onClearSelection?: () => void
}

/**
 * Heat card adapted for judge scheduling. Every lane of the heat's location is
 * always droppable/clickable (Crew has no athlete-lane data). Supports
 * drag-drop, click-to-assign with an active judge, and one-click heat fill.
 */
export function JudgeHeatCard({
  heat,
  unassignedVolunteers,
  assignments,
  maxLanes,
  activeJudgeId,
  onAssign,
  onBulkAssign,
  onRemove,
  onMove,
  onLaneClick,
  onAssignActiveToColumn,
  onFillHeat,
  isPending = false,
  selectedJudgeIds,
  onClearSelection,
}: JudgeHeatCardProps) {
  const [isAssignOpen, setIsAssignOpen] = useState(false)
  const [selectedMembershipId, setSelectedMembershipId] = useState<string>("")
  const [selectedLane, setSelectedLane] = useState<number>(1)

  const clickToAssign = Boolean(activeJudgeId)

  // Get occupied lanes (by judges)
  const occupiedLanes = new Set(assignments.map((a) => a.laneNumber))

  // Get available lanes
  const availableLanes = Array.from(
    { length: maxLanes },
    (_, i) => i + 1,
  ).filter((lane) => !occupiedLanes.has(lane))

  const isFull = assignments.length >= maxLanes
  const [isExpanded, setIsExpanded] = useState(!isFull)

  // Format time
  function formatTime(date: Date | null): string {
    if (!date) return "No time set"
    return new Date(date).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    })
  }

  function handleAssign() {
    if (!selectedMembershipId || !selectedLane) return
    onAssign(selectedMembershipId, selectedLane)
    setIsAssignOpen(false)
    setSelectedMembershipId("")
    // Auto-select next available lane
    const nextLane =
      availableLanes.find((l) => l > selectedLane) ?? availableLanes[0]
    setSelectedLane(nextLane ?? 1)
  }

  function handleDropAssign(membershipIds: string[], startLane: number) {
    // Filter to only IDs that exist in unassigned
    const validIds = membershipIds.filter((id) =>
      unassignedVolunteers.some((v) => v.membershipId === id),
    )

    if (validIds.length === 0) return

    // Get available lanes starting from startLane
    const lanesToUse = availableLanes
      .filter((l) => l >= startLane)
      .concat(availableLanes.filter((l) => l < startLane))
      .slice(0, validIds.length)

    if (lanesToUse.length === 0) return

    // Build placements - zip IDs with lanes
    const placements: { membershipId: string; laneNumber: number }[] = []
    for (let i = 0; i < Math.min(validIds.length, lanesToUse.length); i++) {
      const membershipId = validIds[i]
      const lane = lanesToUse[i]
      if (membershipId && lane !== undefined) {
        placements.push({ membershipId, laneNumber: lane })
      }
    }

    if (placements.length === 0) return

    if (placements.length === 1 && placements[0]) {
      onAssign(placements[0].membershipId, placements[0].laneNumber)
    } else {
      onBulkAssign(placements)
    }

    // Clear selection after successful drop
    onClearSelection?.()
  }

  function handleDropAssigned(
    membershipId: string,
    sourceHeatId: string,
    targetLane: number,
  ) {
    // If lane is occupied in this heat by someone else, don't allow
    const existingInLane = assignments.find(
      (a) => a.laneNumber === targetLane && a.membershipId !== membershipId,
    )
    if (existingInLane) {
      return
    }
    onMove(membershipId, sourceHeatId, targetLane)
  }

  // Collapsed view for full heats
  if (!isExpanded) {
    return (
      <Card
        className="cursor-pointer transition-colors hover:bg-muted/50"
        onClick={() => setIsExpanded(true)}
      >
        <CardHeader className="py-3">
          <div className="flex items-center gap-3">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">
              Heat <span className="tabular-nums">{heat.heatNumber}</span>
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {heat.scheduledTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(heat.scheduledTime)}
                </span>
              )}
              {heat.venueName && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {heat.venueName}
                </span>
              )}
            </div>
            <Badge
              variant={isFull ? "default" : "outline"}
              className="tabular-nums text-xs"
            >
              {assignments.length}/{maxLanes}
            </Badge>
          </div>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsExpanded(false)}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <CardTitle className="text-base">
              Heat <span className="tabular-nums">{heat.heatNumber}</span>
            </CardTitle>
            <Badge
              variant={isFull ? "default" : "outline"}
              className="tabular-nums text-xs"
            >
              {assignments.length}/{maxLanes}
            </Badge>
          </div>
          {availableLanes.length > 0 && unassignedVolunteers.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onFillHeat}
              disabled={isPending}
              title="Fill open lanes with available judges"
            >
              <Users className="mr-2 h-4 w-4" />
              Fill heat
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {heat.scheduledTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(heat.scheduledTime)}
            </span>
          )}
          {heat.venueName && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {heat.venueName}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Lane Assignments */}
        <div className="space-y-2">
          {Array.from({ length: maxLanes }, (_, i) => i + 1).map((laneNum) => {
            const assignment = assignments.find((a) => a.laneNumber === laneNum)

            if (!assignment) {
              return (
                <DroppableLane
                  key={laneNum}
                  laneNum={laneNum}
                  onDropUnassigned={handleDropAssign}
                  onDropAssigned={handleDropAssigned}
                  selectedJudgeIds={selectedJudgeIds}
                  onTapAssign={(lane) => {
                    if (selectedJudgeIds && selectedJudgeIds.size > 0) {
                      handleDropAssign(Array.from(selectedJudgeIds), lane)
                    }
                  }}
                  clickToAssign={clickToAssign}
                  onLaneClick={onLaneClick}
                  onSeatColumn={onAssignActiveToColumn}
                />
              )
            }

            return (
              <DraggableAssignedJudge
                key={laneNum}
                assignment={assignment}
                heatId={heat.id}
                onRemove={() => onRemove(assignment.membershipId)}
                isPending={isPending}
              />
            )
          })}
        </div>

        {/* Add judge Button */}
        {availableLanes.length > 0 && unassignedVolunteers.length > 0 && (
          <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="mt-4 w-full">
                <Plus className="mr-2 h-4 w-4" />
                Assign Judge
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Judge to Heat {heat.heatNumber}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  {/* biome-ignore lint/a11y/noLabelWithoutControl: Select component handles its own labeling */}
                  <label className="text-sm font-medium">Judge</label>
                  <Select
                    value={selectedMembershipId}
                    onValueChange={setSelectedMembershipId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a judge" />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedVolunteers.map((volunteer) => (
                        <SelectItem
                          key={volunteer.membershipId}
                          value={volunteer.membershipId}
                        >
                          {getCrewJudgeName(volunteer)}{" "}
                          {volunteer.credentials &&
                            `(${volunteer.credentials})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  {/* biome-ignore lint/a11y/noLabelWithoutControl: Select component handles its own labeling */}
                  <label className="text-sm font-medium">Lane</label>
                  <Select
                    value={String(selectedLane)}
                    onValueChange={(v) => setSelectedLane(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLanes.map((lane) => (
                        <SelectItem key={lane} value={String(lane)}>
                          Lane {lane}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsAssignOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAssign}
                    disabled={
                      !selectedMembershipId || !selectedLane || isPending
                    }
                  >
                    {isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Assign
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  )
}
