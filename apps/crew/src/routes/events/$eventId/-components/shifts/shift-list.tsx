"use client"

import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  CalendarDays,
  Clock,
  Edit2,
  MapPin,
  Plus,
  Trash2,
  Users,
} from "lucide-react"
import { useCallback, useMemo, useState } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CrewRosterVolunteer } from "@/lib/crew/roster-shifts"
import type { CrewShiftBoardItem } from "@/server-fns/crew-roster-shift-fns"
import { deleteCrewShiftFn } from "@/server-fns/crew-roster-shift-fns"
import { formatDateTimeInTimezone } from "@/utils/timezone-utils"
import { ShiftAssignmentPanel } from "./shift-assignment-panel"
import { ShiftFormDialog } from "./shift-form-dialog"

// Get badge variant based on capacity fill
function getCapacityBadgeVariant(
  assigned: number,
  capacity: number,
): "default" | "secondary" | "destructive" | "outline" {
  if (assigned >= capacity) return "default" // Full
  if (assigned > 0) return "secondary" // Partially filled
  return "outline" // Empty
}

interface DayGroup {
  dateKey: string
  label: string
  shifts: CrewShiftBoardItem[]
}

interface ShiftListProps {
  eventId: string
  /** Event timezone — controls how shift days and times are displayed. */
  timezone: string
  /** Default calendar date (YYYY-MM-DD) for new shifts, usually the event start. */
  defaultDate?: string | null
  shifts: CrewShiftBoardItem[]
  /** Roster volunteers (from the shift board) used by the assignment panel. */
  roster: CrewRosterVolunteer[]
}

/**
 * Admin component to display all shifts for a Crew event with add/edit/delete
 * actions. Shifts are grouped by date and show name, role type, time, location,
 * and assignment counts. Clicking a shift opens the assignment panel.
 *
 * Ported from the wodsmith-start organizer shift list and adapted to Crew's
 * shift board data shapes and timezone-aware date display.
 */
export function ShiftList({
  eventId,
  timezone,
  defaultDate,
  shifts,
  roster,
}: ShiftListProps) {
  const router = useRouter()

  const [deletingShiftId, setDeletingShiftId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<
    CrewShiftBoardItem | undefined
  >(undefined)
  const [assignmentPanelOpen, setAssignmentPanelOpen] = useState(false)
  const [selectedShift, setSelectedShift] = useState<CrewShiftBoardItem | null>(
    null,
  )

  const deleteShift = useServerFn(deleteCrewShiftFn)

  const handleOpenCreateDialog = useCallback(() => {
    setEditingShift(undefined)
    setFormDialogOpen(true)
  }, [])

  const handleOpenEditDialog = useCallback((shift: CrewShiftBoardItem) => {
    setEditingShift(shift)
    setFormDialogOpen(true)
  }, [])

  const handleOpenAssignmentPanel = useCallback((shift: CrewShiftBoardItem) => {
    setSelectedShift(shift)
    setAssignmentPanelOpen(true)
  }, [])

  // Group shifts by date (in the event timezone)
  const dayGroups = useMemo<DayGroup[]>(() => {
    const groups = new Map<string, DayGroup>()

    // Sort shifts by start time first
    const sortedShifts = [...shifts].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    )

    for (const shift of sortedShifts) {
      const dateKey = formatDateTimeInTimezone(
        shift.startTime,
        timezone,
        "yyyy-MM-dd",
      )
      const label = formatDateTimeInTimezone(
        shift.startTime,
        timezone,
        "EEEE, MMM d",
      )

      const existing = groups.get(dateKey)
      if (existing) {
        existing.shifts.push(shift)
      } else {
        groups.set(dateKey, { dateKey, label, shifts: [shift] })
      }
    }

    // Sort groups by date
    return Array.from(groups.values()).sort((a, b) =>
      a.dateKey.localeCompare(b.dateKey),
    )
  }, [shifts, timezone])

  const handleDelete = async () => {
    if (!deletingShiftId) return

    setIsDeleting(true)
    try {
      await deleteShift({ data: { eventId, shiftId: deletingShiftId } })
      toast.success("Shift deleted successfully")
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete shift",
      )
    } finally {
      setIsDeleting(false)
      setDeletingShiftId(null)
    }
  }

  const shiftToDelete = deletingShiftId
    ? shifts.find((s) => s.id === deletingShiftId)
    : null

  // Keep the selected shift in sync with refreshed shift data so the assignment
  // panel reflects the latest assignments after router.invalidate().
  const liveSelectedShift = selectedShift
    ? (shifts.find((s) => s.id === selectedShift.id) ?? null)
    : null

  // Empty state
  if (shifts.length === 0) {
    return (
      <div className="space-y-6">
        <ShiftListHeader onAdd={handleOpenCreateDialog} />

        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground" />
            <div>
              <h3 className="font-semibold">No volunteer shifts yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create shifts for check-in, medical, equipment, scorekeeping,
                and other event-day roles.
              </p>
            </div>
            <Button onClick={handleOpenCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Shift
            </Button>
          </CardContent>
        </Card>

        <ShiftFormDialog
          eventId={eventId}
          timezone={timezone}
          defaultDate={defaultDate}
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          shift={editingShift}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ShiftListHeader onAdd={handleOpenCreateDialog} />

      {/* Shifts grouped by date */}
      {dayGroups.map((group) => (
        <Card key={group.dateKey}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
              {group.label}
            </CardTitle>
            <CardDescription>
              {group.shifts.length} shift{group.shifts.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shift Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.shifts.map((shift) => {
                    const assignedCount = shift.assignments.length
                    const capacityVariant = getCapacityBadgeVariant(
                      assignedCount,
                      shift.capacity,
                    )

                    return (
                      <TableRow
                        key={shift.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleOpenAssignmentPanel(shift)}
                      >
                        <TableCell className="font-medium">
                          {shift.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{shift.roleLabel}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatDateTimeInTimezone(
                              shift.startTime,
                              timezone,
                              "h:mm a",
                            )}{" "}
                            -{" "}
                            {formatDateTimeInTimezone(
                              shift.endTime,
                              timezone,
                              "h:mm a",
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {shift.location ? (
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                              {shift.location}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              -
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={capacityVariant}>
                            <Users className="mr-1 h-3 w-3" />
                            {assignedCount} / {shift.capacity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenEditDialog(shift)
                              }}
                              aria-label={`Edit ${shift.name}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeletingShiftId(shift.id)
                              }}
                              aria-label={`Delete ${shift.name}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingShiftId}
        onOpenChange={(open) => !open && setDeletingShiftId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete shift</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{shiftToDelete?.name}"?
              {shiftToDelete && shiftToDelete.assignments.length > 0 && (
                <>
                  {" "}
                  This shift has {shiftToDelete.assignments.length} volunteer
                  {shiftToDelete.assignments.length !== 1 ? "s" : ""} assigned.
                  They will be unassigned from this shift.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create/Edit shift Dialog */}
      <ShiftFormDialog
        eventId={eventId}
        timezone={timezone}
        defaultDate={defaultDate}
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        shift={editingShift}
      />

      {/* Assignment Panel */}
      <ShiftAssignmentPanel
        shift={liveSelectedShift}
        allShifts={shifts}
        timezone={timezone}
        roster={roster}
        eventId={eventId}
        open={assignmentPanelOpen}
        onOpenChange={setAssignmentPanelOpen}
      />
    </div>
  )
}

function ShiftListHeader({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Volunteer shifts</h2>
        <p className="text-muted-foreground">
          Manage time-based volunteer shifts for event-day roles
        </p>
      </div>
      <Button onClick={onAdd} className="w-full sm:w-auto">
        <Plus className="mr-2 h-4 w-4" />
        Add shift
      </Button>
    </div>
  )
}
