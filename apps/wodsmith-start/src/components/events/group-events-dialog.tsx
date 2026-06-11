"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CompetitionWorkout } from "@/server-fns/competition-workouts-fns"

interface GroupEventsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Selected events in the order they'll become sub-events */
  events: CompetitionWorkout[]
  onGroupEvents: (name: string) => Promise<void>
  isGrouping?: boolean
}

export function GroupEventsDialog({
  open,
  onOpenChange,
  events,
  onGroupEvents,
  isGrouping,
}: GroupEventsDialogProps) {
  const [name, setName] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await onGroupEvents(name.trim())
    setName("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Group events under a parent event</DialogTitle>
            <DialogDescription>
              The selected events become sub-events of a new parent event. Heats
              are scheduled for the parent, so athletes complete all sub-events
              together in one block. Scores are still entered per sub-event.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="parent-event-name">Parent event name</Label>
              <Input
                id="parent-event-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='e.g. "Event 3: Barbell Complex"'
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">
                Sub-events ({events.length})
              </p>
              <ol className="space-y-1 rounded-md border bg-muted/50 p-3 text-sm">
                {events.map((event, index) => (
                  <li key={event.id} className="flex items-center gap-2">
                    <span className="text-muted-foreground">{index + 1}.</span>
                    <span>{event.workout.name}</span>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-muted-foreground">
                You can reorder or rename sub-events after grouping.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isGrouping}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isGrouping}>
              {isGrouping ? "Grouping..." : "Group events"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
