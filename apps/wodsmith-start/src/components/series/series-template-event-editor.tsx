"use client"

import { useServerFn } from "@tanstack/react-start"
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CreateEventDialog } from "@/components/events/create-event-dialog"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { SCORE_TYPES, WORKOUT_SCHEMES } from "@/constants"
import type { Movement } from "@/db/schemas/workouts"
import type { ScoreType } from "@/lib/scoring/types"
import type { WorkoutScheme } from "@/lib/scoring/types"
import {
  addEventToSeriesTemplateFn,
  deleteSeriesTemplateEventFn,
  reorderSeriesTemplateEventsFn,
  type SeriesTemplateEvent,
  updateSeriesTemplateEventFn,
} from "@/server-fns/series-event-template-fns"

interface SeriesTemplateEventEditorProps {
  groupId: string
  trackId: string
  events: SeriesTemplateEvent[]
  movements: Movement[]
  onEventsChanged: () => Promise<void>
  onReplaceTemplate?: () => void
}

export function SeriesTemplateEventEditor({
  groupId,
  trackId,
  events: initialEvents,
  movements,
  onEventsChanged,
  onReplaceTemplate,
}: SeriesTemplateEventEditorProps) {
  const [events, setEvents] = useState(initialEvents)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreatingEvent, setIsCreatingEvent] = useState(false)
  const [editingEvent, setEditingEvent] = useState<SeriesTemplateEvent | null>(
    null,
  )
  const [deletingEvent, setDeletingEvent] =
    useState<SeriesTemplateEvent | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const addEvent = useServerFn(addEventToSeriesTemplateFn)
  const deleteEvent = useServerFn(deleteSeriesTemplateEventFn)
  const reorderEvents = useServerFn(reorderSeriesTemplateEventsFn)

  useEffect(() => {
    setEvents(initialEvents)
  }, [initialEvents])

  const handleCreateEvent = async (data: {
    name: string
    scheme: WorkoutScheme
    scoreType?: ScoreType
    description?: string
  }) => {
    setIsCreatingEvent(true)
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
        },
      })
      setEvents((prev) => [...prev, result.event])
      setIsCreateDialogOpen(false)
      toast.success(`Event "${data.name}" added`)
      await onEventsChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create event")
    } finally {
      setIsCreatingEvent(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingEvent) return
    setIsDeleting(true)
    try {
      await deleteEvent({
        data: { trackWorkoutId: deletingEvent.id, groupId },
      })
      setEvents((prev) => prev.filter((e) => e.id !== deletingEvent.id))
      toast.success(`Event "${deletingEvent.name}" deleted`)
      setDeletingEvent(null)
      await onEventsChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete event")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleMoveUp = async (index: number) => {
    if (index === 0) return
    const topLevelEvents = events.filter((e) => !e.parentEventId)
    const newOrder = [...topLevelEvents]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index - 1]
    newOrder[index - 1] = temp

    // Include child events in order
    const orderedIds: string[] = []
    for (const parent of newOrder) {
      orderedIds.push(parent.id)
      const children = events.filter((e) => e.parentEventId === parent.id)
      for (const child of children) {
        orderedIds.push(child.id)
      }
    }

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
      await onEventsChanged()
    }
  }

  const handleMoveDown = async (index: number) => {
    const topLevelEvents = events.filter((e) => !e.parentEventId)
    if (index >= topLevelEvents.length - 1) return
    const newOrder = [...topLevelEvents]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index + 1]
    newOrder[index + 1] = temp

    const orderedIds: string[] = []
    for (const parent of newOrder) {
      orderedIds.push(parent.id)
      const children = events.filter((e) => e.parentEventId === parent.id)
      for (const child of children) {
        orderedIds.push(child.id)
      }
    }

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
      await onEventsChanged()
    }
  }

  // Group events: top-level events with their children underneath
  const topLevelEvents = events.filter((e) => !e.parentEventId)

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Series Events</CardTitle>
              <CardDescription>
                Events defined in the series template. These events can be
                synced to all competitions in the series.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Event
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-4">
                No events yet. Add events to define the series template.
              </p>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Event
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {topLevelEvents.map((event, index) => {
                const children = events.filter(
                  (e) => e.parentEventId === event.id,
                )
                return (
                  <div key={event.id}>
                    <EventRow
                      event={event}
                      index={index}
                      totalCount={topLevelEvents.length}
                      onMoveUp={() => handleMoveUp(index)}
                      onMoveDown={() => handleMoveDown(index)}
                      onEdit={() => setEditingEvent(event)}
                      onDelete={() => setDeletingEvent(event)}
                    />
                    {children.map((child) => (
                      <div key={child.id} className="ml-8">
                        <EventRow
                          event={child}
                          index={0}
                          totalCount={0}
                          onEdit={() => setEditingEvent(child)}
                          onDelete={() => setDeletingEvent(child)}
                          isChild
                        />
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}

          {onReplaceTemplate && events.length > 0 && (
            <div className="pt-4 border-t mt-4">
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
        </CardContent>
      </Card>

      {/* Create Event Dialog */}
      <CreateEventDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateEvent={handleCreateEvent}
        isCreating={isCreatingEvent}
        movements={movements}
      />

      {/* Edit Event Dialog */}
      {editingEvent && (
        <EditEventDialog
          event={editingEvent}
          groupId={groupId}
          open={!!editingEvent}
          onOpenChange={(open) => {
            if (!open) setEditingEvent(null)
          }}
          onSaved={async () => {
            setEditingEvent(null)
            await onEventsChanged()
          }}
        />
      )}

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
              Are you sure you want to delete "{deletingEvent?.name}"? This will
              also remove any competition event mappings for this template event.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─────────────────────────────────────────────────────────
// Event Row
// ─────────────────────────────────────────────────────────

function EventRow({
  event,
  index,
  totalCount,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  isChild,
}: {
  event: SeriesTemplateEvent
  index: number
  totalCount: number
  onMoveUp?: () => void
  onMoveDown?: () => void
  onEdit: () => void
  onDelete: () => void
  isChild?: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      {!isChild && (
        <div className="flex flex-col shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="text-muted-foreground hover:text-foreground disabled:opacity-25 p-0.5"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index >= totalCount - 1}
            className="text-muted-foreground hover:text-foreground disabled:opacity-25 p-0.5"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      )}
      <span className="text-xs text-muted-foreground font-mono w-6 text-center shrink-0">
        #{event.order}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{event.name}</span>
      </div>
      {event.scoreType && (
        <Badge variant="secondary" className="shrink-0">
          {event.scoreType}
        </Badge>
      )}
      {event.pointsMultiplier !== null && event.pointsMultiplier !== 100 && (
        <Badge variant="outline" className="shrink-0">
          {event.pointsMultiplier}pts
        </Badge>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={onEdit}
        className="h-8 w-8 shrink-0"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Edit Event Dialog (inline)
// ─────────────────────────────────────────────────────────

function EditEventDialog({
  event,
  groupId,
  open,
  onOpenChange,
  onSaved,
}: {
  event: SeriesTemplateEvent
  groupId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void>
}) {
  const [name, setName] = useState(event.workout.name)
  const [description, setDescription] = useState(
    event.workout.description ?? "",
  )
  const [scheme, setScheme] = useState(event.workout.scheme ?? "time")
  const [scoreType, setScoreType] = useState(event.workout.scoreType ?? "")
  const [pointsMultiplier, setPointsMultiplier] = useState(
    event.pointsMultiplier ?? 100,
  )
  const [isSaving, setIsSaving] = useState(false)

  const updateEventFn = useServerFn(updateSeriesTemplateEventFn)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setIsSaving(true)
    try {
      await updateEventFn({
        data: {
          trackWorkoutId: event.id,
          groupId,
          workout: {
            name: name.trim(),
            description: description.trim() || undefined,
            scheme: scheme as any,
            scoreType: (scoreType || null) as any,
          },
          pointsMultiplier,
        },
      })
      toast.success(`Event "${name}" updated`)
      await onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update event")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <form onSubmit={handleSubmit}>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Event</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Scheme</Label>
              <Select value={scheme} onValueChange={setScheme}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKOUT_SCHEMES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Score Type</Label>
              <Select value={scoreType || "__none__"} onValueChange={(v) => setScoreType(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {SCORE_TYPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-points">Points Multiplier</Label>
              <Input
                id="edit-points"
                type="number"
                value={pointsMultiplier}
                onChange={(e) =>
                  setPointsMultiplier(Number.parseInt(e.target.value) || 100)
                }
                min={1}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <Button type="submit" disabled={isSaving || !name.trim()}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
