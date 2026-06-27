"use client"

import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Calendar, Clock, MapPin, Minus, Plus, User, Users } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  type CrewRosterVolunteer,
  getCrewRosterAssigneeId,
  isCrewRosterVolunteerStaffable,
  isVolunteerCompatibleWithShift,
} from "@/lib/crew/roster-shifts"
import { VOLUNTEER_ROLE_LABELS } from "@/db/schemas/volunteers"
import type { CrewShiftBoardItem } from "@/server-fns/crew-roster-shift-fns"
import {
  assignCrewVolunteerToShiftFn,
  removeCrewVolunteerShiftAssignmentFn,
} from "@/server-fns/crew-roster-shift-fns"
import { formatDateTimeInTimezone } from "@/utils/timezone-utils"

type ShiftAssignment = CrewShiftBoardItem["assignments"][number]

function formatDateRange(
  startTime: Date,
  endTime: Date,
  timezone: string,
): string {
  const datePart = formatDateTimeInTimezone(
    startTime,
    timezone,
    "EEE, MMM d, h:mm a",
  )
  const endPart = formatDateTimeInTimezone(endTime, timezone, "h:mm a")
  return `${datePart} - ${endPart}`
}

function formatShiftTimeCompact(
  startTime: Date,
  endTime: Date,
  timezone: string,
): string {
  const datePart = formatDateTimeInTimezone(startTime, timezone, "MMM d")
  const startPart = formatDateTimeInTimezone(startTime, timezone, "h:mma")
  const endPart = formatDateTimeInTimezone(endTime, timezone, "h:mma")
  return `${datePart} ${startPart.toLowerCase()}-${endPart.toLowerCase()}`
}

interface ShiftAssignmentPanelProps {
  shift: CrewShiftBoardItem | null
  allShifts: CrewShiftBoardItem[]
  /** Event timezone for displaying shift times. */
  timezone: string
  /** Assignable roster volunteers (active memberships) from the shift board. */
  roster: CrewRosterVolunteer[]
  eventId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Side panel for viewing and managing volunteer assignments for a specific shift.
 * Shows shift details, currently assigned volunteers, and available volunteers to add.
 *
 * Available volunteers come from the Crew roster (active memberships that are
 * role-compatible with the shift). Assignment changes invalidate the router so
 * the shift board reloads with fresh data.
 */
export function ShiftAssignmentPanel({
  shift,
  allShifts,
  timezone,
  roster,
  eventId,
  open,
  onOpenChange,
}: ShiftAssignmentPanelProps) {
  const router = useRouter()
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [unassigningId, setUnassigningId] = useState<string | null>(null)

  const assignVolunteer = useServerFn(assignCrewVolunteerToShiftFn)
  const unassignVolunteer = useServerFn(removeCrewVolunteerShiftAssignmentFn)

  // Staffable volunteers: active memberships plus imported / manually-added
  // (invitation-based) volunteers in a staffable status. Each is referenced by
  // its canonical assignee id (membership id or invitation id).
  const assignableVolunteers = useMemo(
    () => roster.filter((volunteer) => isCrewRosterVolunteerStaffable(volunteer)),
    [roster],
  )

  // Get assigned assignee IDs for filtering
  const assignedAssigneeIds = useMemo(() => {
    if (!shift) return new Set<string>()
    return new Set(shift.assignments.map((a) => a.assigneeId))
  }, [shift])

  // Filter available volunteers by role compatibility and exclude already assigned
  const availableVolunteers = useMemo(() => {
    if (!shift) return []
    return assignableVolunteers.filter((volunteer) => {
      const assigneeId = getCrewRosterAssigneeId(volunteer)
      if (assigneeId && assignedAssigneeIds.has(assigneeId)) {
        return false
      }
      return isVolunteerCompatibleWithShift(shift.roleType, volunteer.roleTypes)
    })
  }, [assignableVolunteers, shift, assignedAssigneeIds])

  // Build a map of assignee id -> other shifts they're assigned to
  const volunteerOtherShifts = useMemo(() => {
    if (!shift) return new Map<string, CrewShiftBoardItem[]>()
    const map = new Map<string, CrewShiftBoardItem[]>()
    for (const s of allShifts) {
      if (s.id === shift.id) continue // Exclude current shift
      for (const assignment of s.assignments) {
        const existing = map.get(assignment.assigneeId) ?? []
        existing.push(s)
        map.set(assignment.assigneeId, existing)
      }
    }
    return map
  }, [allShifts, shift])

  // Calculate capacity info
  const assignedCount = shift?.assignments.length ?? 0
  const capacity = shift?.capacity ?? 0
  const isAtCapacity = assignedCount >= capacity

  const handleAssign = useCallback(
    async (assigneeId: string) => {
      if (!shift) return

      setAssigningId(assigneeId)
      try {
        await assignVolunteer({
          data: { eventId, shiftId: shift.id, assigneeId },
        })
        toast.success("Volunteer assigned successfully")
        await router.invalidate()
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to assign volunteer",
        )
      } finally {
        setAssigningId(null)
      }
    },
    [shift, assignVolunteer, eventId, router],
  )

  const handleUnassign = useCallback(
    async (assigneeId: string) => {
      if (!shift) return

      setUnassigningId(assigneeId)
      try {
        await unassignVolunteer({
          data: { eventId, shiftId: shift.id, assigneeId },
        })
        toast.success("Volunteer unassigned successfully")
        await router.invalidate()
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to unassign volunteer",
        )
      } finally {
        setUnassigningId(null)
      }
    },
    [shift, unassignVolunteer, eventId, router],
  )

  if (!shift) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader className="space-y-1">
          <SheetTitle>{shift.name}</SheetTitle>
          <SheetDescription>
            Manage volunteer assignments for this shift
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable content area */}
        <div className="mt-4 flex-1 overflow-y-auto">
          {/* Shift Details */}
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{shift.roleLabel}</Badge>
              <Badge
                variant={isAtCapacity ? "default" : "secondary"}
                className="ml-auto"
              >
                <Users className="mr-1 h-3 w-3" />
                {assignedCount}/{capacity} assigned
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {formatDateRange(shift.startTime, shift.endTime, timezone)}
            </div>

            {shift.location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {shift.location}
              </div>
            )}

            {shift.notes && (
              <p className="text-sm text-muted-foreground">{shift.notes}</p>
            )}
          </div>

          {/* Assigned Volunteers */}
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium">Assigned Volunteers</h3>
            {shift.assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No volunteers assigned yet
              </p>
            ) : (
              <div className="space-y-2">
                {shift.assignments.map((assignment: ShiftAssignment) => {
                  const volunteerName = assignment.volunteer.name
                  const volunteerEmail = assignment.volunteer.email.trim()

                  return (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between rounded-md border bg-card p-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{volunteerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {volunteerEmail || "No email"}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnassign(assignment.assigneeId)}
                        disabled={unassigningId === assignment.assigneeId}
                        aria-label={`Remove ${volunteerName}`}
                      >
                        <Minus className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Available Volunteers */}
          <div className="mt-6 flex-1">
            <h3 className="mb-3 text-sm font-medium">
              Available Volunteers (
              {VOLUNTEER_ROLE_LABELS[shift.roleType] ?? shift.roleLabel})
            </h3>
            {availableVolunteers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No available volunteers compatible with the {shift.roleLabel}{" "}
                role
              </p>
            ) : (
              <div className="space-y-2">
                {availableVolunteers.map((volunteer) => {
                  const volunteerName = volunteer.name
                  const assigneeId = getCrewRosterAssigneeId(volunteer)
                  const otherShifts = assigneeId
                    ? (volunteerOtherShifts.get(assigneeId) ?? [])
                    : []

                  return (
                    <div
                      key={volunteer.id}
                      className="flex items-center justify-between rounded-md border bg-card p-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{volunteerName}</p>
                          {volunteer.email.trim() && (
                            <p className="truncate text-xs text-muted-foreground">
                              {volunteer.email.trim()}
                            </p>
                          )}
                          {otherShifts.length > 0 && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                >
                                  <Calendar className="h-3 w-3 shrink-0" />
                                  <span className="underline decoration-dotted">
                                    {otherShifts.length} other shift
                                    {otherShifts.length !== 1 ? "s" : ""}
                                  </span>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-64 p-2"
                                align="start"
                              >
                                <p className="mb-2 text-xs font-medium text-muted-foreground">
                                  Assigned Shifts
                                </p>
                                <div className="space-y-1.5">
                                  {otherShifts.map((s) => (
                                    <div key={s.id} className="text-sm">
                                      <p className="font-medium">{s.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {formatShiftTimeCompact(
                                          s.startTime,
                                          s.endTime,
                                          timezone,
                                        )}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => assigneeId && handleAssign(assigneeId)}
                        disabled={
                          isAtCapacity ||
                          assigningId === assigneeId ||
                          !assigneeId
                        }
                        aria-label={`Add ${volunteerName}`}
                        title={
                          isAtCapacity
                            ? "Shift is at capacity"
                            : `Add ${volunteerName}`
                        }
                      >
                        <Plus className="h-4 w-4 text-primary" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
            {isAtCapacity && availableVolunteers.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Shift is at capacity. Remove a volunteer to add another.
              </p>
            )}
          </div>
        </div>
        {/* End scrollable content area */}
      </SheetContent>
    </Sheet>
  )
}
