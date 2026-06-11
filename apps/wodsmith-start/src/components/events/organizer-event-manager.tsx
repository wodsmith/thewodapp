"use client"

import { useRouter } from "@tanstack/react-router"
import { ChevronDown, ChevronRight, Layers, Plus } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { trackEvent } from "@/lib/posthog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import type { Movement, Sponsor } from "@/db/schema"
import type {
  ScoreType,
  TiebreakScheme,
  WorkoutScheme,
} from "@/db/schemas/workouts"
import {
  type CompetitionWorkout,
  createWorkoutAndAddToCompetitionFn,
  groupCompetitionEventsFn,
  removeWorkoutFromCompetitionFn,
  reorderCompetitionEventsFn,
} from "@/server-fns/competition-workouts-fns"
import { AddEventDialog } from "./add-event-dialog"
import { CompetitionEventRow } from "./competition-event-row"
import { CreateEventDialog } from "./create-event-dialog"
import { GroupEventsDialog } from "./group-events-dialog"

interface Division {
  id: string
  label: string
  position: number
  registrationCount: number
}

interface DivisionDescription {
  divisionId: string
  divisionLabel: string
  description: string | null
}

/** Optional callback overrides for mutation server fns (used by cohost routes) */
interface EventManagerOverrides {
  createWorkoutFn?: (args: {
    data: NonNullable<Parameters<typeof createWorkoutAndAddToCompetitionFn>[0]>["data"]
  }) => ReturnType<typeof createWorkoutAndAddToCompetitionFn>
  removeWorkoutFn?: (args: {
    data: NonNullable<Parameters<typeof removeWorkoutFromCompetitionFn>[0]>["data"]
  }) => ReturnType<typeof removeWorkoutFromCompetitionFn>
  reorderEventsFn?: (args: {
    data: NonNullable<Parameters<typeof reorderCompetitionEventsFn>[0]>["data"]
  }) => ReturnType<typeof reorderCompetitionEventsFn>
  groupEventsFn?: (args: {
    data: NonNullable<Parameters<typeof groupCompetitionEventsFn>[0]>["data"]
  }) => ReturnType<typeof groupCompetitionEventsFn>
}

interface OrganizerEventManagerProps {
  competitionId: string
  organizingTeamId: string
  events: CompetitionWorkout[]
  movements: Movement[]
  divisions: Division[]
  divisionDescriptionsByWorkout: Record<string, DivisionDescription[]>
  sponsors: Sponsor[]
  /** Series name if the competition is part of a series with event templates */
  seriesName?: string | null
  /** Map of competition event ID -> template event name (for series badges) */
  seriesEventMap?: Map<string, string>
  /** Override mutation fns (e.g. cohost equivalents) */
  overrides?: EventManagerOverrides
  /** Base route for event detail links (defaults to organizer route) */
  eventDetailRoute?: string
}

export function OrganizerEventManager({
  competitionId,
  organizingTeamId,
  events: initialEvents,
  movements,
  divisions,
  divisionDescriptionsByWorkout,
  sponsors,
  seriesName,
  seriesEventMap,
  overrides,
  eventDetailRoute,
}: OrganizerEventManagerProps) {
  const router = useRouter()
  const createWorkoutFn = overrides?.createWorkoutFn ?? createWorkoutAndAddToCompetitionFn
  const removeWorkoutFn = overrides?.removeWorkoutFn ?? removeWorkoutFromCompetitionFn
  const reorderEventsFn = overrides?.reorderEventsFn ?? reorderCompetitionEventsFn
  const groupEventsFn = overrides?.groupEventsFn ?? groupCompetitionEventsFn
  const [events, setEvents] = useState(initialEvents)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [topLevelInstanceId] = useState(() => Symbol("competition-events"))
  const [subEventInstanceIds] = useState(
    () => new Map<string, symbol>(),
  )
  const [isCreating, setIsCreating] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [subEventParentId, setSubEventParentId] = useState<string | null>(null)
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(
    () => new Set(),
  )
  const [selectedForGrouping, setSelectedForGrouping] = useState<Set<string>>(
    () => new Set(),
  )
  const [showGroupDialog, setShowGroupDialog] = useState(false)
  const [isGrouping, setIsGrouping] = useState(false)

  // Sync props to state when server data changes, but deduplicate
  useEffect(() => {
    setEvents((currentEvents) => {
      // Deduplicate by name + scheme (since new events may not have stable IDs yet)
      const serverEventKeys = new Set(
        initialEvents.map((e) => `${e.workout.name}:${e.workout.scheme}`),
      )
      const optimisticEvents = currentEvents.filter(
        (e) => !serverEventKeys.has(`${e.workout.name}:${e.workout.scheme}`),
      )

      // Merge server events with any remaining optimistic events
      return [...initialEvents, ...optimisticEvents]
    })
  }, [initialEvents])

  // Sort events by trackOrder
  const sortedEvents = [...events].sort((a, b) => a.trackOrder - b.trackOrder)

  // Build hierarchical event list: top-level = standalone + parents, children grouped under parents
  const childrenByParent = new Map<string, CompetitionWorkout[]>()
  for (const event of sortedEvents) {
    if (event.parentEventId) {
      const siblings = childrenByParent.get(event.parentEventId) ?? []
      siblings.push(event)
      childrenByParent.set(event.parentEventId, siblings)
    }
  }
  // Top-level items: standalone events (no parent, no children) + parent events (has children)
  const topLevelEvents = sortedEvents.filter((e) => !e.parentEventId)

  // Only standalone events (no children) can be grouped under a new parent —
  // sub-events can't nest more than one level deep
  const groupableEventIds = new Set(
    topLevelEvents.filter((e) => !childrenByParent.has(e.id)).map((e) => e.id),
  )
  // Selected events in display order; prunes selections that became ineligible
  const selectedGroupableEvents = topLevelEvents.filter(
    (e) => selectedForGrouping.has(e.id) && groupableEventIds.has(e.id),
  )

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

  // Get existing workout IDs for filtering in AddEventDialog
  const existingWorkoutIds = new Set(events.map((e) => e.workoutId))

  const handleCreateEvent = async (data: {
    name: string
    scheme: WorkoutScheme
    scoreType?: ScoreType
    description?: string
    roundsToScore?: number
    tiebreakScheme?: TiebreakScheme
    movementIds?: string[]
  }) => {
    setIsCreating(true)
    try {
      const result = await createWorkoutFn({
        data: {
          competitionId,
          teamId: organizingTeamId,
          name: data.name,
          scheme: data.scheme,
          scoreType: data.scoreType ?? null,
          description: data.description,
          roundsToScore: data.roundsToScore ?? null,
          tiebreakScheme: data.tiebreakScheme ?? null,
          movementIds: data.movementIds,
          parentEventId: subEventParentId ?? undefined,
        },
      })

      if (result?.trackWorkoutId) {
        trackEvent("competition_event_created", {
          competition_id: competitionId,
          event_id: result.trackWorkoutId,
          event_name: data.name,
          is_sub_event: !!subEventParentId,
        })
        toast.success(
          subEventParentId
            ? `Created sub-event "${data.name}"`
            : `Created "${data.name}"`,
        )
        setShowCreateDialog(false)
        setSubEventParentId(null)
        router.invalidate()
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create event"
      trackEvent("competition_event_created_failed", {
        competition_id: competitionId,
        error_message: message,
      })
      toast.error(message)
    } finally {
      setIsCreating(false)
    }
  }

  const handleAddWorkout = async (workout: {
    id: string
    name: string
    description: string | null
    scheme: WorkoutScheme
    scoreType: ScoreType | null
    movements?: Array<{ id: string; name: string; type: string }>
  }) => {
    setIsAdding(true)
    try {
      // Create as a remix of the existing workout
      const result = await createWorkoutFn({
        data: {
          competitionId,
          teamId: organizingTeamId,
          name: workout.name,
          scheme: workout.scheme,
          scoreType: workout.scoreType,
          description: workout.description || undefined,
          sourceWorkoutId: workout.id, // Mark as remix
          movementIds: workout.movements?.map((m) => m.id),
        },
      })

      if (result?.trackWorkoutId) {
        toast.success(`Added "${workout.name}" as a remix`)
        setShowAddDialog(false)
        router.invalidate()
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add workout",
      )
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemove = async (trackWorkoutId: string) => {
    // Optimistically remove from state (including children if this is a parent)
    const eventToRemove = events.find((e) => e.id === trackWorkoutId)
    const childrenToRemove = events.filter(
      (e) => e.parentEventId === trackWorkoutId,
    )
    setEvents((prev) =>
      prev.filter(
        (e) => e.id !== trackWorkoutId && e.parentEventId !== trackWorkoutId,
      ),
    )

    try {
      await removeWorkoutFn({
        data: {
          trackWorkoutId,
          teamId: organizingTeamId,
        },
      })
      toast.success("Event removed")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove event",
      )
      // Revert - add it back (including children)
      if (eventToRemove) {
        setEvents((prev) => [...prev, eventToRemove, ...childrenToRemove])
      }
    }
  }

  const handleAddSubEvent = async (parentEventId: string) => {
    setShowCreateDialog(true)
    // Store parent context for the create dialog
    setSubEventParentId(parentEventId)
  }

  const toggleEventSelection = useCallback((eventId: string) => {
    setSelectedForGrouping((prev) => {
      const next = new Set(prev)
      if (next.has(eventId)) {
        next.delete(eventId)
      } else {
        next.add(eventId)
      }
      return next
    })
  }, [])

  const handleGroupEvents = async (name: string) => {
    setIsGrouping(true)
    try {
      const result = await groupEventsFn({
        data: {
          competitionId,
          teamId: organizingTeamId,
          trackWorkoutIds: selectedGroupableEvents.map((e) => e.id),
          name,
        },
      })

      if (result?.trackWorkoutId) {
        trackEvent("competition_events_grouped", {
          competition_id: competitionId,
          parent_event_id: result.trackWorkoutId,
          parent_event_name: name,
          grouped_event_count: selectedGroupableEvents.length,
        })
        toast.success(
          `Grouped ${selectedGroupableEvents.length} events under "${name}"`,
        )
        setShowGroupDialog(false)
        setSelectedForGrouping(new Set())
        router.invalidate()
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to group events"
      trackEvent("competition_events_grouped_failed", {
        competition_id: competitionId,
        error_message: message,
      })
      toast.error(message)
    } finally {
      setIsGrouping(false)
    }
  }

  const handleDrop = async (sourceIndex: number, targetIndex: number) => {
    // Only reorder top-level events (standalone + parents)
    const newEvents = [...topLevelEvents]
    const [movedItem] = newEvents.splice(sourceIndex, 1)
    if (movedItem) {
      newEvents.splice(targetIndex, 0, movedItem)

      // Update trackOrder for top-level events and reassign children
      const allUpdatedEvents: CompetitionWorkout[] = []
      for (let i = 0; i < newEvents.length; i++) {
        const topEvent = { ...newEvents[i], trackOrder: i + 1 }
        allUpdatedEvents.push(topEvent)
        // Reassign children's trackOrder under new parent position
        const children = childrenByParent.get(topEvent.id) ?? []
        for (let j = 0; j < children.length; j++) {
          allUpdatedEvents.push({
            ...children[j],
            trackOrder: Number((i + 1 + 0.01 * (j + 1)).toFixed(2)),
          })
        }
      }

      // Capture previous state before optimistic update
      const previousEvents = events

      setEvents(allUpdatedEvents)

      // Persist to server — only send top-level reorders, server handles children
      const updates = newEvents.map((e, i) => ({
        trackWorkoutId: e.id,
        trackOrder: i + 1,
      }))

      try {
        await reorderEventsFn({
          data: {
            competitionId,
            teamId: organizingTeamId,
            updates,
          },
        })
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to reorder events",
        )
        // Revert to previous state
        setEvents(previousEvents)
      }
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

    // Find parent's trackOrder to calculate decimal offsets
    const parentEvent = topLevelEvents.find((e) => e.id === parentId)
    if (!parentEvent) return
    const parentOrder = Math.floor(parentEvent.trackOrder)

    // Build updated children with new decimal trackOrders
    const updatedChildren = newChildren.map((child, i) => ({
      ...child,
      trackOrder: Number((parentOrder + 0.01 * (i + 1)).toFixed(2)),
    }))

    // Optimistic update
    const previousEvents = events
    setEvents((prev) => {
      const withoutOldChildren = prev.filter(
        (e) => e.parentEventId !== parentId,
      )
      return [...withoutOldChildren, ...updatedChildren]
    })

    // Persist
    const updates = updatedChildren.map((child) => ({
      trackWorkoutId: child.id,
      trackOrder: child.trackOrder,
    }))

    try {
      await reorderEventsFn({
        data: {
          competitionId,
          teamId: organizingTeamId,
          updates,
        },
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reorder sub-events",
      )
      setEvents(previousEvents)
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Existing
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </Button>
        </div>
      </div>
      {selectedGroupableEvents.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/50 p-3">
          <div className="space-y-0.5 text-sm">
            <p className="font-medium">
              {selectedGroupableEvents.length}{" "}
              {selectedGroupableEvents.length === 1 ? "event" : "events"}{" "}
              selected
            </p>
            <p className="text-muted-foreground">
              {selectedGroupableEvents.length < 2
                ? "Select at least one more event to group them under a parent event."
                : "Group these events under a parent event (e.g. Part A / Part B) so they're scheduled together as a single event."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedForGrouping(new Set())}
            >
              Clear
            </Button>
            <Button
              size="sm"
              disabled={selectedGroupableEvents.length < 2}
              onClick={() => setShowGroupDialog(true)}
            >
              <Layers className="h-4 w-4 mr-2" />
              Group as one event
            </Button>
          </div>
        </div>
      )}
      {selectedGroupableEvents.length === 0 && groupableEventIds.size >= 2 && (
        <p className="text-xs text-muted-foreground">
          Tip: running a multi-part event? Select two or more events with the
          checkboxes to group them under a parent event so they're scheduled
          together.
        </p>
      )}
      {events.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            No events added to this competition yet.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Existing Workout
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Event
            </Button>
          </div>
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
                  {isParent ? (
                    <button
                      type="button"
                      onClick={() => toggleParentCollapse(event.id)}
                      className="p-1 -ml-1 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={isCollapsed ? "Expand sub-events" : "Collapse sub-events"}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  ) : (
                    <Checkbox
                      checked={selectedForGrouping.has(event.id)}
                      onCheckedChange={() => toggleEventSelection(event.id)}
                      aria-label={`Select ${event.workout.name} to group under a parent event`}
                      className="mx-0.5"
                    />
                  )}
                  <div className="flex-1">
                    <CompetitionEventRow
                      event={event}
                      index={index}
                      instanceId={topLevelInstanceId}
                      competitionId={competitionId}
                      organizingTeamId={organizingTeamId}
                      divisions={divisions}
                      divisionDescriptions={
                        divisionDescriptionsByWorkout[event.workoutId] ?? []
                      }
                      sponsors={sponsors}
                      onRemove={() => handleRemove(event.id)}
                      onDrop={handleDrop}
                      onAddSubEvent={() => handleAddSubEvent(event.id)}
                      isParentEvent={isParent}
                      childCount={children.length}
                      eventDetailRoute={eventDetailRoute}
                      seriesName={seriesName}
                      seriesTemplateName={seriesEventMap?.get(event.id)}
                    />
                  </div>
                </div>
                {/* Sub-events */}
                {isParent && !isCollapsed && (
                  <div className="ml-10 mt-1 space-y-1 border-l-2 border-muted pl-3">
                    {children.map((child, childIndex) => (
                      <CompetitionEventRow
                        key={child.id}
                        event={child}
                        index={childIndex}
                        instanceId={getSubEventInstanceId(event.id)}
                        competitionId={competitionId}
                        organizingTeamId={organizingTeamId}
                        divisions={divisions}
                        divisionDescriptions={
                          divisionDescriptionsByWorkout[child.workoutId] ?? []
                        }
                        sponsors={sponsors}
                        onRemove={() => handleRemove(child.id)}
                        onDrop={(sourceIndex, targetIndex) =>
                          handleSubEventDrop(event.id, sourceIndex, targetIndex)
                        }
                        isSubEvent
                        parentEventId={event.id}
                        eventDetailRoute={eventDetailRoute}
                        seriesName={seriesName}
                        seriesTemplateName={seriesEventMap?.get(child.id)}
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

      <AddEventDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAddWorkout={handleAddWorkout}
        isAdding={isAdding}
        teamId={organizingTeamId}
        existingWorkoutIds={existingWorkoutIds}
      />

      <GroupEventsDialog
        open={showGroupDialog}
        onOpenChange={setShowGroupDialog}
        events={selectedGroupableEvents}
        onGroupEvents={handleGroupEvents}
        isGrouping={isGrouping}
      />
    </>
  )
}
