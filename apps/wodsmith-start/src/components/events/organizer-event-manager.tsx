"use client"

import { useRouter } from "@tanstack/react-router"
import { ChevronDown, ChevronRight, Plus } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { trackEvent } from "@/lib/posthog"
import { Button } from "@/components/ui/button"
import type { Movement, Sponsor } from "@/db/schema"
import type {
  ScoreType,
  TiebreakScheme,
  WorkoutScheme,
} from "@/db/schemas/workouts"
import {
  type CompetitionWorkout,
  createWorkoutAndAddToCompetitionFn,
  removeWorkoutFromCompetitionFn,
  reorderCompetitionEventsFn,
} from "@/server-fns/competition-workouts-fns"
import { AddEventDialog } from "./add-event-dialog"
import { CompetitionEventRow } from "./competition-event-row"
import { CreateEventDialog } from "./create-event-dialog"

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
                  {isParent && (
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
                  )}
                  <div className={`flex-1 ${!isParent ? "ml-6" : ""}`}>
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
    </>
  )
}
