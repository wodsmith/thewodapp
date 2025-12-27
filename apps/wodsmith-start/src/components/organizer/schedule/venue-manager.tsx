'use client'

import {Loader2, Pencil, Plus, Trash2} from 'lucide-react'
import {useState} from 'react'
import {toast} from 'sonner'
import {Button} from '@/components/ui/button'
import {Card, CardContent} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import type {CompetitionVenue} from '@/db/schemas/competitions'
import {
  createVenueFn,
  deleteVenueFn,
  updateVenueFn,
  getVenueHeatCountFn,
} from '@/server-fns/competition-heats-fns'

interface VenueManagerProps {
  competitionId: string
  venues: CompetitionVenue[]
  onVenueUpdate?: (venue: CompetitionVenue) => void
  onVenueCreate?: (venue: CompetitionVenue) => void
  onVenueDelete?: (venueId: string) => void
}

export function VenueManager({
  competitionId,
  venues,
  onVenueUpdate,
  onVenueCreate,
  onVenueDelete,
}: VenueManagerProps) {
  // Use controlled state if callbacks provided, otherwise internal state
  const [internalVenues, setInternalVenues] = useState(venues)
  const displayVenues = onVenueUpdate ? venues : internalVenues
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingVenue, setEditingVenue] = useState<CompetitionVenue | null>(
    null,
  )
  const [newVenueName, setNewVenueName] = useState('')
  const [newLaneCount, setNewLaneCount] = useState(3)
  const [newTransitionMinutes, setNewTransitionMinutes] = useState(3)

  // Loading states (for when server functions are connected)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleCreate() {
    if (!newVenueName.trim()) return

    setIsCreating(true)
    try {
      const result = await createVenueFn({
        data: {
          competitionId,
          name: newVenueName.trim(),
          laneCount: newLaneCount,
          transitionMinutes: newTransitionMinutes,
        },
      })

      const newVenue = result.venue

      if (onVenueCreate) {
        onVenueCreate(newVenue)
      } else {
        setInternalVenues([...internalVenues, newVenue])
      }

      toast.success('Venue created')
      setNewVenueName('')
      setNewLaneCount(3)
      setNewTransitionMinutes(3)
      setIsCreateOpen(false)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create venue'
      toast.error(message)
    } finally {
      setIsCreating(false)
    }
  }

  async function handleUpdate() {
    if (!editingVenue || !editingVenue.name.trim()) return

    setIsUpdating(true)
    try {
      await updateVenueFn({
        data: {
          venueId: editingVenue.id,
          name: editingVenue.name.trim(),
          laneCount: editingVenue.laneCount,
          transitionMinutes: editingVenue.transitionMinutes,
        },
      })

      if (onVenueUpdate) {
        onVenueUpdate(editingVenue)
      } else {
        setInternalVenues(
          internalVenues.map((v) =>
            v.id === editingVenue.id ? editingVenue : v,
          ),
        )
      }

      toast.success('Venue updated')
      setEditingVenue(null)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update venue'
      toast.error(message)
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleDelete(venue: CompetitionVenue) {
    setIsDeleting(true)
    try {
      // Check if venue has heats assigned
      const {count} = await getVenueHeatCountFn({data: {venueId: venue.id}})

      const confirmMessage =
        count > 0
          ? `Delete venue "${venue.name}"? ${count} heat(s) are assigned to this venue and will be unassigned.`
          : `Delete venue "${venue.name}"?`

      if (!confirm(confirmMessage)) {
        setIsDeleting(false)
        return
      }

      await deleteVenueFn({
        data: {
          venueId: venue.id,
        },
      })

      if (onVenueDelete) {
        onVenueDelete(venue.id)
      } else {
        setInternalVenues(internalVenues.filter((v) => v.id !== venue.id))
      }

      toast.success('Venue deleted')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete venue'
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Venue List */}
      {displayVenues.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <p className="mb-4">No venues created yet.</p>
            <p className="text-sm">
              Create venues like "Main Floor" or "Outside Rig" to assign heats
              to specific locations.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayVenues.map((venue) => (
            <Card key={venue.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{venue.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {venue.laneCount} lanes • {venue.transitionMinutes}min
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingVenue(venue)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(venue)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Venue Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Venue
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Venue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="venue-name">Name</Label>
              <Input
                id="venue-name"
                value={newVenueName}
                onChange={(e) => setNewVenueName(e.target.value)}
                placeholder="Main Floor"
              />
            </div>
            <div>
              <Label htmlFor="lane-count">Number of Lanes</Label>
              <Input
                id="lane-count"
                type="number"
                min={1}
                max={100}
                value={newLaneCount}
                onChange={(e) => setNewLaneCount(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum athletes per heat at this venue
              </p>
            </div>
            <div>
              <Label htmlFor="transition-minutes">
                Transition Time (minutes)
              </Label>
              <Input
                id="transition-minutes"
                type="number"
                min={1}
                max={120}
                value={newTransitionMinutes}
                onChange={(e) =>
                  setNewTransitionMinutes(Number(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Time between heats for setup/teardown
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Venue Dialog */}
      <Dialog
        open={!!editingVenue}
        onOpenChange={(open) => !open && setEditingVenue(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Venue</DialogTitle>
          </DialogHeader>
          {editingVenue && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-venue-name">Name</Label>
                <Input
                  id="edit-venue-name"
                  value={editingVenue.name}
                  onChange={(e) =>
                    setEditingVenue({...editingVenue, name: e.target.value})
                  }
                />
              </div>
              <div>
                <Label htmlFor="edit-lane-count">Number of Lanes</Label>
                <Input
                  id="edit-lane-count"
                  type="number"
                  min={1}
                  max={100}
                  value={editingVenue.laneCount}
                  onChange={(e) =>
                    setEditingVenue({
                      ...editingVenue,
                      laneCount: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="edit-transition-minutes">
                  Transition Time (minutes)
                </Label>
                <Input
                  id="edit-transition-minutes"
                  type="number"
                  min={1}
                  max={120}
                  value={editingVenue.transitionMinutes}
                  onChange={(e) =>
                    setEditingVenue({
                      ...editingVenue,
                      transitionMinutes: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingVenue(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdate} disabled={isUpdating}>
                  {isUpdating && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
