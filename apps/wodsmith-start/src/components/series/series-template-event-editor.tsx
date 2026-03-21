"use client"

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine"
import {
  draggable,
  dropTargetForElements,
  type ElementDropTargetEventBasePayload,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview"
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview"
import {
  attachClosestEdge,
  type Edge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge"
import { DropIndicator } from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box"
import { Link } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { CreateEventDialog } from "@/components/events/create-event-dialog"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { Movement } from "@/db/schemas/workouts"
import type { ScoreType, WorkoutScheme } from "@/lib/scoring/types"
import {
  addEventToSeriesTemplateFn,
  deleteSeriesTemplateEventFn,
  reorderSeriesTemplateEventsFn,
  type SeriesTemplateEvent,
} from "@/server-fns/series-event-template-fns"

// ============================================================================
// Types
// ============================================================================

interface Division {
  id: string
  label: string
  position: number
}

interface DivisionDescription {
  divisionId: string
  divisionLabel: string
  description: string | null
}

interface SeriesTemplateEventEditorProps {
  groupId: string
  trackId: string
  events: SeriesTemplateEvent[]
  movements: Movement[]
  divisions?: Division[]
  divisionDescriptionsByWorkout?: Record<string, DivisionDescription[]>
  onEventsChanged: () => Promise<void>
  onReplaceTemplate?: () => void
}

// ============================================================================
// Main Component
// ============================================================================

export function SeriesTemplateEventEditor({
  groupId,
  trackId,
  events: initialEvents,
  movements,
  divisions = [],
  divisionDescriptionsByWorkout = {},
  onEventsChanged,
  onReplaceTemplate,
}: SeriesTemplateEventEditorProps) {
  const [events, setEvents] = useState(initialEvents)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [subEventParentId, setSubEventParentId] = useState<string | null>(null)
  const [deletingEvent, setDeletingEvent] =
    useState<SeriesTemplateEvent | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [topLevelInstanceId] = useState(() => Symbol("series-template-events"))
  const [subEventInstanceIds] = useState(
    () => new Map<string, symbol>(),
  )
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(
    () => new Set(),
  )

  const addEvent = useServerFn(addEventToSeriesTemplateFn)
  const deleteEvent = useServerFn(deleteSeriesTemplateEventFn)
  const reorderEvents = useServerFn(reorderSeriesTemplateEventsFn)

  // Sync props to state
  useEffect(() => {
    setEvents(initialEvents)
  }, [initialEvents])

  // Sort events by trackOrder
  const sortedEvents = [...events].sort(
    (a, b) => a.trackOrder - b.trackOrder,
  )

  // Build hierarchical event list
  const childrenByParent = new Map<string, SeriesTemplateEvent[]>()
  for (const event of sortedEvents) {
    if (event.parentEventId) {
      const siblings = childrenByParent.get(event.parentEventId) ?? []
      siblings.push(event)
      childrenByParent.set(event.parentEventId, siblings)
    }
  }
  const topLevelEvents = sortedEvents.filter((e) => !e.parentEventId)

  const getSubEventInstanceId = useCallback(
    (parentId: string) => {
      let id = subEventInstanceIds.get(parentId)
      if (!id) {
        id = Symbol(`sub-events-${parentId}`)
        subEventInstanceIds.set(parentId, id)
      }
      return id
    },
    [subEventInstanceIds],
  )

  const toggleParentCollapse = useCallback((parentId: string) => {
    setCollapsedParents((prev) => {
      const next = new Set(prev)
      if (next.has(parentId)) {
        next.delete(parentId)
      } else {
        next.add(parentId)
      }
      return next
    })
  }, [])

  const handleCreateEvent = async (data: {
    name: string
    scheme: WorkoutScheme
    scoreType?: ScoreType
    description?: string
  }) => {
    setIsCreating(true)
    try {
      const result = await addEvent({
        data: {
          groupId,
          trackId,
          workout: {
            name: data.name,
            scheme: data.scheme,
            scoreType: data.scoreType ?? null,
            description: data.description,
          },
          parentEventId: subEventParentId ?? undefined,
        },
      })
      setEvents((prev) => [...prev, result.event])
      setShowCreateDialog(false)
      setSubEventParentId(null)
      toast.success(
        subEventParentId
          ? `Created sub-event "${data.name}"`
          : `Created "${data.name}"`,
      )
      await onEventsChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create event")
    } finally {
      setIsCreating(false)
    }
  }

  const handleRemove = async (trackWorkoutId: string) => {
    const eventToRemove = events.find((e) => e.id === trackWorkoutId)
    const childrenToRemove = events.filter(
      (e) => e.parentEventId === trackWorkoutId,
    )
    // Optimistic removal
    setEvents((prev) =>
      prev.filter(
        (e) => e.id !== trackWorkoutId && e.parentEventId !== trackWorkoutId,
      ),
    )

    try {
      await deleteEvent({
        data: { trackWorkoutId, groupId },
      })
      toast.success("Event removed")
      await onEventsChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove event")
      // Revert
      if (eventToRemove) {
        setEvents((prev) => [...prev, eventToRemove, ...childrenToRemove])
      }
    }
  }

  const handleAddSubEvent = (parentEventId: string) => {
    setSubEventParentId(parentEventId)
    setShowCreateDialog(true)
  }

  const handleDrop = async (sourceIndex: number, targetIndex: number) => {
    const newEvents = [...topLevelEvents]
    const [movedItem] = newEvents.splice(sourceIndex, 1)
    if (!movedItem) return
    newEvents.splice(targetIndex, 0, movedItem)

    // Build ordered IDs including children
    const orderedIds: string[] = []
    for (const parent of newEvents) {
      orderedIds.push(parent.id)
      const children = childrenByParent.get(parent.id) ?? []
      for (const child of children) {
        orderedIds.push(child.id)
      }
    }

    const previousEvents = events
    setEvents((prev) => {
      const sorted = [...prev].sort(
        (a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id),
      )
      return sorted
    })

    try {
      await reorderEvents({
        data: { trackId, groupId, orderedEventIds: orderedIds },
      })
    } catch (e) {
      toast.error("Failed to reorder events")
      setEvents(previousEvents)
    }
  }

  const handleSubEventDrop = async (
    parentId: string,
    sourceIndex: number,
    targetIndex: number,
  ) => {
    const children = childrenByParent.get(parentId) ?? []
    if (children.length === 0) return

    const newChildren = [...children]
    const [movedItem] = newChildren.splice(sourceIndex, 1)
    if (!movedItem) return
    newChildren.splice(targetIndex, 0, movedItem)

    // Build full ordered IDs
    const orderedIds: string[] = []
    for (const parent of topLevelEvents) {
      orderedIds.push(parent.id)
      const siblings =
        parent.id === parentId
          ? newChildren
          : (childrenByParent.get(parent.id) ?? [])
      for (const child of siblings) {
        orderedIds.push(child.id)
      }
    }

    const previousEvents = events
    setEvents((prev) => {
      const sorted = [...prev].sort(
        (a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id),
      )
      return sorted
    })

    try {
      await reorderEvents({
        data: { trackId, groupId, orderedEventIds: orderedIds },
      })
    } catch (e) {
      toast.error("Failed to reorder sub-events")
      setEvents(previousEvents)
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Event
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            No events added to this template yet.
          </p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create First Event
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {topLevelEvents.map((event, index) => {
            const children = childrenByParent.get(event.id) ?? []
            const isParent = children.length > 0
            const isCollapsed = collapsedParents.has(event.id)

            return (
              <div key={event.id}>
                <div className="flex items-center gap-1">
                  {isParent && (
                    <button
                      type="button"
                      onClick={() => toggleParentCollapse(event.id)}
                      className="p-1 -ml-1 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={
                        isCollapsed
                          ? "Expand sub-events"
                          : "Collapse sub-events"
                      }
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  )}
                  <div className={`flex-1 ${!isParent ? "ml-6" : ""}`}>
                    <SeriesEventRow
                      event={event}
                      index={index}
                      groupId={groupId}
                      instanceId={topLevelInstanceId}
                      divisions={divisions}
                      divisionDescriptions={
                        divisionDescriptionsByWorkout[event.workoutId] ?? []
                      }
                      onRemove={() => handleRemove(event.id)}
                      onDrop={handleDrop}
                      onAddSubEvent={() => handleAddSubEvent(event.id)}
                      isParentEvent={isParent}
                      childCount={children.length}
                    />
                  </div>
                </div>
                {/* Sub-events */}
                {isParent && !isCollapsed && (
                  <div className="ml-10 mt-1 space-y-1 border-l-2 border-muted pl-3">
                    {children.map((child, childIndex) => (
                      <SeriesEventRow
                        key={child.id}
                        event={child}
                        index={childIndex}
                        groupId={groupId}
                        instanceId={getSubEventInstanceId(event.id)}
                        divisions={divisions}
                        divisionDescriptions={
                          divisionDescriptionsByWorkout[child.workoutId] ?? []
                        }
                        onRemove={() => handleRemove(child.id)}
                        onDrop={(sourceIndex, targetIndex) =>
                          handleSubEventDrop(event.id, sourceIndex, targetIndex)
                        }
                        isSubEvent
                      />
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground text-xs"
                      onClick={() => handleAddSubEvent(event.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Sub-Event
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {onReplaceTemplate && events.length > 0 && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReplaceTemplate}
            className="text-muted-foreground"
          >
            Replace with different template
          </Button>
        </div>
      )}

      {/* Create Event Dialog */}
      <CreateEventDialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open)
          if (!open) setSubEventParentId(null)
        }}
        onCreateEvent={handleCreateEvent}
        isCreating={isCreating}
        movements={movements}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingEvent}
        onOpenChange={(open) => {
          if (!open) setDeletingEvent(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingEvent?.name}
              &quot;? This will also remove any competition event mappings for
              this template event.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              onClick={async () => {
                if (!deletingEvent) return
                setIsDeleting(true)
                try {
                  await deleteEvent({
                    data: { trackWorkoutId: deletingEvent.id, groupId },
                  })
                  setEvents((prev) =>
                    prev.filter(
                      (e) =>
                        e.id !== deletingEvent.id &&
                        e.parentEventId !== deletingEvent.id,
                    ),
                  )
                  toast.success(`Event "${deletingEvent.name}" deleted`)
                  setDeletingEvent(null)
                  await onEventsChanged()
                } catch (e) {
                  toast.error(
                    e instanceof Error
                      ? e.message
                      : "Failed to delete event",
                  )
                } finally {
                  setIsDeleting(false)
                }
              }}
              disabled={isDeleting}
              variant="destructive"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ============================================================================
// Series Event Row (matches CompetitionEventRow pattern)
// ============================================================================

function SeriesEventRow({
  event,
  index,
  groupId,
  instanceId,
  divisions,
  divisionDescriptions,
  onRemove,
  onDrop,
  onAddSubEvent,
  isParentEvent,
  isSubEvent,
  childCount,
}: {
  event: SeriesTemplateEvent
  index: number
  groupId: string
  instanceId: symbol
  divisions: Division[]
  divisionDescriptions: DivisionDescription[]
  onRemove: () => void
  onDrop: (sourceIndex: number, targetIndex: number) => void
  onAddSubEvent?: () => void
  isParentEvent?: boolean
  isSubEvent?: boolean
  childCount?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLButtonElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null)
  const closestEdgeRef = useRef<Edge | null>(null)
  const nameRef = useRef(event.workout.name)

  // Division editing state
  const sortedDivisions = [...divisions].sort(
    (a, b) => a.position - b.position,
  )
  const [selectedDivisionId, setSelectedDivisionId] = useState<
    string | undefined
  >(sortedDivisions[0]?.id)
  const [localDescriptions, setLocalDescriptions] = useState<
    Record<string, string>
  >(() => {
    const initial: Record<string, string> = {}
    for (const desc of divisionDescriptions) {
      initial[desc.divisionId] = desc.description || ""
    }
    return initial
  })
  const [isDescriptionsOpen, setIsDescriptionsOpen] = useState(false)

  // Sync name ref
  useEffect(() => {
    nameRef.current = event.workout.name
  }, [event.workout.name])

  // Sync local descriptions when props change
  useEffect(() => {
    const newDescriptions: Record<string, string> = {}
    for (const desc of divisionDescriptions) {
      newDescriptions[desc.divisionId] = desc.description || ""
    }
    setLocalDescriptions(newDescriptions)
  }, [divisionDescriptions])

  // Drag and drop setup
  useEffect(() => {
    const element = ref.current
    const dragHandle = dragHandleRef.current
    if (!element || !dragHandle) return

    const eventData = {
      id: event.id,
      index,
      instanceId,
    }

    return combine(
      draggable({
        element: dragHandle,
        getInitialData: () => eventData,
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
        onGenerateDragPreview({ nativeSetDragImage }) {
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: pointerOutsideOfPreview({
              x: "16px",
              y: "8px",
            }),
            render({ container }) {
              const preview = document.createElement("div")
              preview.style.cssText = `
                background: hsl(var(--background));
                border: 2px solid hsl(var(--border));
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 14px;
                color: hsl(var(--foreground));
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
              `
              preview.textContent = nameRef.current || "Event"
              container.appendChild(preview)
            },
          })
        },
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => {
          return (
            source.data.instanceId === instanceId &&
            source.data.index !== index
          )
        },
        getData({ input }) {
          return attachClosestEdge(eventData, {
            element,
            input,
            allowedEdges: ["top", "bottom"],
          })
        },
        onDrag({ source, self }: ElementDropTargetEventBasePayload) {
          const isSource = source.data.index === index
          if (isSource) {
            closestEdgeRef.current = null
            setClosestEdge(null)
            return
          }

          const edge = extractClosestEdge(self.data)
          const sourceIndex = source.data.index

          if (typeof sourceIndex !== "number") return

          const isItemBeforeSource = index === sourceIndex - 1
          const isItemAfterSource = index === sourceIndex + 1

          const isDropIndicatorHidden =
            (isItemBeforeSource && edge === "bottom") ||
            (isItemAfterSource && edge === "top")

          if (isDropIndicatorHidden) {
            closestEdgeRef.current = null
            setClosestEdge(null)
            return
          }

          closestEdgeRef.current = edge
          setClosestEdge(edge)
        },
        onDragLeave: () => {
          closestEdgeRef.current = null
          setClosestEdge(null)
        },
        onDrop({ source }) {
          const sourceIndex = source.data.index
          if (typeof sourceIndex === "number" && sourceIndex !== index) {
            const edge = closestEdgeRef.current
            const targetIndex = edge === "top" ? index : index + 1
            const adjustedTargetIndex =
              sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
            onDrop(sourceIndex, adjustedTargetIndex)
          }
          closestEdgeRef.current = null
          setClosestEdge(null)
        },
      }),
    )
  }, [event.id, index, instanceId, onDrop])

  return (
    <div ref={ref} className="relative">
      {closestEdge && <DropIndicator edge={closestEdge} gap="2px" />}
      <Card
        className={`${isDragging ? "opacity-50" : ""} ${isSubEvent ? "border-dashed" : ""} group`}
      >
        <Collapsible
          open={isDescriptionsOpen}
          onOpenChange={setIsDescriptionsOpen}
        >
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-2 sm:gap-0">
              {/* Top row: drag handle, number, name, badges, actions */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Drag Handle */}
                <button
                  ref={dragHandleRef}
                  type="button"
                  className="cursor-grab active:cursor-grabbing opacity-30 group-hover:opacity-100 transition-opacity p-1 -m-1"
                  aria-label="Drag to reorder"
                >
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                </button>

                {/* Event Number */}
                <span className="text-sm font-mono text-muted-foreground shrink-0">
                  #{index + 1}
                </span>

                {/* Event Name */}
                <span className="flex-1 font-medium truncate min-w-0">
                  {event.workout.name}
                  {isParentEvent &&
                    childCount !== undefined &&
                    childCount > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground font-normal">
                        ({childCount} sub-event
                        {childCount !== 1 ? "s" : ""})
                      </span>
                    )}
                </span>

                {/* Badges - hidden on mobile */}
                <div className="hidden sm:flex items-center gap-1.5">
                  {event.workout.scheme && (
                    <span className="text-xs bg-muted px-2 py-1 rounded shrink-0">
                      {event.workout.scheme}
                    </span>
                  )}
                  {event.pointsMultiplier &&
                    event.pointsMultiplier !== 100 && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded shrink-0">
                        {event.pointsMultiplier / 100}x
                      </span>
                    )}
                </div>

                {/* Actions - hidden on mobile */}
                <div className="hidden sm:flex items-center gap-1 shrink-0">
                  {onAddSubEvent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onAddSubEvent}
                      className="text-muted-foreground hover:text-foreground text-xs h-8"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Sub-Event
                    </Button>
                  )}
                  {sortedDivisions.length > 0 && (
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`text-muted-foreground hover:text-foreground ${isDescriptionsOpen ? "bg-muted" : ""}`}
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Link
                      to="/compete/organizer/series/$groupId/events/$eventId"
                      params={{ groupId, eventId: event.id }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onRemove}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Mobile row: badges + actions */}
              <div className="flex items-center gap-1.5 sm:hidden">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  {event.workout.scheme && (
                    <span className="text-xs bg-muted px-2 py-1 rounded">
                      {event.workout.scheme}
                    </span>
                  )}
                  {event.pointsMultiplier &&
                    event.pointsMultiplier !== 100 && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                        {event.pointsMultiplier / 100}x
                      </span>
                    )}
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-auto">
                  {onAddSubEvent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onAddSubEvent}
                      className="text-muted-foreground hover:text-foreground text-xs h-8"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Sub-Event
                    </Button>
                  )}
                  {sortedDivisions.length > 0 && (
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`text-muted-foreground hover:text-foreground ${isDescriptionsOpen ? "bg-muted" : ""}`}
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Link
                      to="/compete/organizer/series/$groupId/events/$eventId"
                      params={{ groupId, eventId: event.id }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onRemove}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Division Scaling Descriptions */}
            {sortedDivisions.length > 0 && (
              <CollapsibleContent className="pt-4 mt-4 border-t space-y-3 max-w-[75ch]">
                <Tabs
                  value={selectedDivisionId}
                  onValueChange={setSelectedDivisionId}
                >
                  <TabsList className="w-fit justify-start flex-wrap h-auto gap-1">
                    {sortedDivisions.map((division) => (
                      <TabsTrigger
                        key={division.id}
                        value={division.id}
                        className="text-xs"
                      >
                        {division.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <Textarea
                  value={
                    selectedDivisionId
                      ? localDescriptions[selectedDivisionId] || ""
                      : ""
                  }
                  onChange={(e) => {
                    if (!selectedDivisionId) return
                    setLocalDescriptions((prev) => ({
                      ...prev,
                      [selectedDivisionId]: e.target.value,
                    }))
                  }}
                  placeholder={`Enter scaling description for ${sortedDivisions.find((d) => d.id === selectedDivisionId)?.label || "this division"}...`}
                  rows={10}
                  className="text-sm"
                  disabled={!selectedDivisionId}
                />
              </CollapsibleContent>
            )}
          </CardContent>
        </Collapsible>
      </Card>
    </div>
  )
}

