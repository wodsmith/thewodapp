'use client'

import {draggable} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import {pointerOutsideOfPreview} from '@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview'
import {setCustomNativeDragPreview} from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview'
import {
  Calculator,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Plus,
  Users,
} from 'lucide-react'
import {useEffect, useMemo, useRef, useState} from 'react'
import {toast} from 'sonner'
import {
  createHeatFn,
  deleteHeatFn,
  reorderHeatsFn,
  bulkCreateHeatsFn,
  getNextHeatNumberFn,
  getEventsWithHeatsFn,
  copyHeatsFromEventFn,
} from '@/server-fns/competition-heats-fns'
import {updateCompetitionWorkoutFn} from '@/server-fns/competition-workouts-fns'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type {CompetitionVenue} from '@/db/schemas/competitions'
import type {HeatWithAssignments} from '@/server-fns/competition-heats-fns'
import type {CompetitionWorkout} from '@/server-fns/competition-workouts-fns'
import {DraggableAthlete} from './draggable-athlete'
import {EventOverview} from './event-overview'
import {HeatCard} from './heat-card'
import {WorkoutPreview} from './workout-preview'

// Heat status type
type HeatStatus = 'draft' | 'published'
const HEAT_STATUS = {
  DRAFT: 'draft' as const,
  PUBLISHED: 'published' as const,
}

interface Division {
  id: string
  label: string
  position: number
  registrationCount: number
  description: string | null
  feeCents: number | null
}

interface Registration {
  id: string
  teamName: string | null
  registeredAt: Date
  user: {
    id: string
    firstName: string | null
    lastName: string | null
  }
  division: {
    id: string
    label: string
  } | null
}

interface HeatScheduleManagerProps {
  competitionId: string
  organizingTeamId: string
  competitionStartDate: Date | null
  events: CompetitionWorkout[]
  venues: CompetitionVenue[]
  heats: HeatWithAssignments[]
  divisions: Division[]
  registrations: Registration[]
  onHeatsChange?: (heats: HeatWithAssignments[]) => void
}

// Draggable Division Header Component
function DraggableDivisionHeader({
  divisionId,
  divisionLabel,
  athleteCount,
  registrationIds,
}: {
  divisionId: string
  divisionLabel: string
  athleteCount: number
  registrationIds: string[]
}) {
  const headerRef = useRef<HTMLHeadingElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const element = headerRef.current
    if (!element) return

    return draggable({
      element,
      getInitialData: () => ({
        type: 'division',
        divisionId,
        divisionName: divisionLabel,
        registrationIds,
      }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
      onGenerateDragPreview({nativeSetDragImage}) {
        setCustomNativeDragPreview({
          nativeSetDragImage,
          getOffset: pointerOutsideOfPreview({x: '16px', y: '8px'}),
          render({container}) {
            const preview = document.createElement('div')
            preview.style.cssText = `
							background: hsl(var(--background));
							border: 2px solid hsl(var(--primary));
							border-radius: 6px;
							padding: 8px 12px;
							font-size: 14px;
							color: hsl(var(--foreground));
							box-shadow: 0 4px 12px rgba(0,0,0,0.25);
							display: flex;
							align-items: center;
							gap: 8px;
						`

            // Division name
            const nameSpan = document.createElement('span')
            nameSpan.style.fontWeight = '600'
            nameSpan.textContent = divisionLabel
            preview.appendChild(nameSpan)

            // Athlete count in badge
            const badge = document.createElement('span')
            badge.style.cssText = `
							background: hsl(var(--muted));
							color: hsl(var(--muted-foreground));
							border-radius: 6px;
							padding: 2px 6px;
							font-size: 12px;
						`
            badge.textContent = `${athleteCount} athlete${athleteCount !== 1 ? 's' : ''}`
            preview.appendChild(badge)

            container.appendChild(preview)
          },
        })
      },
    })
  }, [divisionId, divisionLabel, registrationIds, athleteCount])

  return (
    <h4
      ref={headerRef}
      className={`text-sm font-medium mb-2 flex items-center gap-2 cursor-grab active:cursor-grabbing select-none transition-opacity ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span className="flex-1">
        {divisionLabel} ({athleteCount})
      </span>
    </h4>
  )
}

export function HeatScheduleManager({
  competitionId,
  organizingTeamId,
  competitionStartDate,
  events,
  venues,
  heats: controlledHeats,
  divisions,
  registrations,
  onHeatsChange,
}: HeatScheduleManagerProps) {
  // Support both controlled and uncontrolled state
  const [internalHeats, setInternalHeats] = useState(controlledHeats)
  const heats = onHeatsChange ? controlledHeats : internalHeats
  const setHeats = onHeatsChange ?? setInternalHeats
  const [selectedEventId, setSelectedEventId] = useState<string>(
    events[0]?.id ?? '',
  )
  const [selectedVenueId, setSelectedVenueId] = useState<string>(
    venues[0]?.id ?? '',
  )
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [filterDivisionId, setFilterDivisionId] = useState<string>('all')
  // Workout cap in minutes - user can adjust per event
  const [workoutCapMinutes, setWorkoutCapMinutes] = useState(8)
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<Set<string>>(
    new Set(),
  )
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
  // Track events locally to update heatStatus
  const [localEvents, setLocalEvents] = useState(events)

  // Loading states
  const [isUpdatingWorkout, setIsUpdatingWorkout] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [_isDeleting, setIsDeleting] = useState(false)
  const [_isReordering, setIsReordering] = useState(false)
  const [isBulkCreating, setIsBulkCreating] = useState(false)

  // Selection handlers
  function toggleAthleteSelection(id: string, shiftKey: boolean) {
    if (shiftKey && lastSelectedId && lastSelectedId !== id) {
      // Range selection
      const lastIndex = flatUnassignedIds.indexOf(lastSelectedId)
      const currentIndex = flatUnassignedIds.indexOf(id)

      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex)
        const end = Math.max(lastIndex, currentIndex)
        const rangeIds = flatUnassignedIds.slice(start, end + 1)

        setSelectedAthleteIds((prev) => {
          const next = new Set(prev)
          for (const rangeId of rangeIds) {
            next.add(rangeId)
          }
          return next
        })
        setLastSelectedId(id)
        return
      }
    }

    // Normal toggle
    setSelectedAthleteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
    setLastSelectedId(id)
  }

  function clearSelection() {
    setSelectedAthleteIds(new Set())
    setLastSelectedId(null)
  }

  // Update heat status for an event
  async function handleHeatStatusChange({
    eventId,
    newStatus,
  }: {
    eventId: string
    newStatus: HeatStatus
  }) {
    const event = localEvents.find((e) => e.id === eventId)
    if (!event || event.heatStatus === newStatus) return

    const previousStatus = event.heatStatus

    // Optimistic update
    setLocalEvents((prev) =>
      prev.map((e) => (e.id === eventId ? {...e, heatStatus: newStatus} : e)),
    )

    setIsUpdatingWorkout(true)
    try {
      await updateCompetitionWorkoutFn({
        data: {
          trackWorkoutId: eventId,
          teamId: organizingTeamId,
          heatStatus: newStatus,
        },
      })
      toast.success(
        `Heat assignments ${newStatus === 'published' ? 'published' : 'set to draft'}`,
      )
    } catch (error) {
      // Revert on error
      setLocalEvents((prev) =>
        prev.map((e) =>
          e.id === eventId ? {...e, heatStatus: previousStatus} : e,
        ),
      )
      const message =
        error instanceof Error ? error.message : 'Failed to update heat status'
      toast.error(message)
    } finally {
      setIsUpdatingWorkout(false)
    }
  }

  // Format date for datetime-local input (YYYY-MM-DDTHH:MM) in local timezone
  function formatDatetimeLocal(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  // Format time for display (e.g., "9:00 AM")
  function formatTimeDisplay(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  function getDefaultHeatTime() {
    const date = competitionStartDate
      ? new Date(competitionStartDate)
      : new Date()
    date.setHours(9, 0, 0, 0)
    return formatDatetimeLocal(date)
  }

  // Calculate next heat time based on last heat + workout cap + transition time
  function getNextHeatTime(venueId: string | null): string {
    // Get heats for this event at this venue
    const relevantHeats = heats.filter(
      (h) =>
        h.trackWorkoutId === selectedEventId &&
        h.scheduledTime &&
        (venueId ? h.venueId === venueId : true),
    )

    if (relevantHeats.length === 0) {
      return getDefaultHeatTime()
    }

    // Find the latest scheduled heat
    const latestHeat = relevantHeats.reduce((latest, heat) => {
      if (!heat.scheduledTime) return latest
      if (!latest?.scheduledTime) return heat
      return new Date(heat.scheduledTime) > new Date(latest.scheduledTime)
        ? heat
        : latest
    }, relevantHeats[0])

    if (!latestHeat?.scheduledTime) {
      return getDefaultHeatTime()
    }

    // Get transition time from venue (default 3 min)
    const venue = venueId ? venues.find((v) => v.id === venueId) : null
    const transitionMinutes = venue?.transitionMinutes ?? 3

    // Add workout cap + transition time to last heat
    const nextTime = new Date(latestHeat.scheduledTime)
    nextTime.setMinutes(
      nextTime.getMinutes() + workoutCapMinutes + transitionMinutes,
    )

    return formatDatetimeLocal(nextTime)
  }

  const [newHeatTime, setNewHeatTime] = useState(getDefaultHeatTime)
  const [newHeatVenueId, setNewHeatVenueId] = useState<string>('')
  const [newHeatDivisionId, setNewHeatDivisionId] = useState<string>('')
  const [newHeatNotes, setNewHeatNotes] = useState('')
  // Heat duration = workout cap + venue transition time
  const [newHeatDuration, setNewHeatDuration] = useState(workoutCapMinutes + 3)
  // Bulk create dialog state
  const [isBulkCreateOpen, setIsBulkCreateOpen] = useState(false)
  const [bulkHeatTimes, setBulkHeatTimes] = useState<string[]>([])
  const [bulkCreateTab, setBulkCreateTab] = useState<'new' | 'copy'>('new')
  // Copy from previous event state
  const [copySourceEventId, setCopySourceEventId] = useState<string>('')
  const [copyStartTime, setCopyStartTime] = useState<string>(getDefaultHeatTime)
  const [copyDurationMinutes, setCopyDurationMinutes] = useState(8)
  // Gap between end of last event and start of copied heats (default to venue transition)
  const [copyGapMinutes, setCopyGapMinutes] = useState<number>(3)
  // Transition time between heats within this event (default to venue transition)
  const [copyTransitionMinutes, setCopyTransitionMinutes] = useState<number>(3)
  const [eventsWithHeats, setEventsWithHeats] = useState<
    Array<{
      trackWorkoutId: string
      workoutName: string
      heatCount: number
      firstHeatTime: Date | null
      lastHeatTime: Date | null
    }>
  >([])
  const [isCopying, setIsCopying] = useState(false)
  const [isLoadingEvents, setIsLoadingEvents] = useState(false)

  // Calculate duration based on cap + venue transition
  function getHeatDuration(venueId: string | null): number {
    const venue = venueId ? venues.find((v) => v.id === venueId) : null
    const transitionMinutes = venue?.transitionMinutes ?? 3
    return workoutCapMinutes + transitionMinutes
  }

  // Handle venue change - auto-update suggested time and duration
  function handleVenueChange(venueId: string) {
    setNewHeatVenueId(venueId)
    const actualVenueId = venueId === 'none' ? null : venueId
    setNewHeatTime(getNextHeatTime(actualVenueId))
    setNewHeatDuration(getHeatDuration(actualVenueId))
  }

  // Calculate the default start time for copying heats based on the last heat across ALL events
  function getDefaultCopyStartTime(gapMinutes: number): string {
    // Get all heats across all events with scheduled times
    const allScheduledHeats = heats.filter((h) => h.scheduledTime)

    if (allScheduledHeats.length === 0) {
      return getDefaultHeatTime()
    }

    // Find the latest scheduled heat across all events
    const latestHeat = allScheduledHeats.reduce((latest, heat) => {
      if (!heat.scheduledTime) return latest
      if (!latest?.scheduledTime) return heat
      return new Date(heat.scheduledTime) > new Date(latest.scheduledTime)
        ? heat
        : latest
    }, allScheduledHeats[0])

    if (!latestHeat?.scheduledTime) {
      return getDefaultHeatTime()
    }

    // Get the duration of the last heat (or use default)
    const lastHeatDuration = latestHeat.durationMinutes ?? workoutCapMinutes + 3

    // Calculate: last heat time + its duration + gap between events
    const nextTime = new Date(latestHeat.scheduledTime)
    nextTime.setMinutes(nextTime.getMinutes() + lastHeatDuration + gapMinutes)

    return formatDatetimeLocal(nextTime)
  }

  // Compute preview of heat times for Copy from Previous tab
  const copyHeatPreviews = useMemo(() => {
    const sourceEvent = eventsWithHeats.find(
      (e) => e.trackWorkoutId === copySourceEventId,
    )
    if (!sourceEvent || !copyStartTime) return []

    const previews: Array<{
      heatNumber: number
      startTime: Date
      endTime: Date
    }> = []

    // Duration of each heat
    const heatDuration = copyDurationMinutes

    // Calculate times for each heat
    for (let i = 0; i < sourceEvent.heatCount; i++) {
      let startTime: Date

      if (i === 0) {
        // First heat starts at copyStartTime
        startTime = new Date(copyStartTime)
      } else {
        // Subsequent heats start after previous heat ends + transition time
        const prevHeat = previews[i - 1]
        if (!prevHeat) continue
        startTime = new Date(prevHeat.endTime)
        startTime.setMinutes(startTime.getMinutes() + copyTransitionMinutes)
      }

      // End time = start time + duration
      const endTime = new Date(startTime)
      endTime.setMinutes(endTime.getMinutes() + heatDuration)

      previews.push({
        heatNumber: i + 1,
        startTime,
        endTime,
      })
    }

    return previews
  }, [
    eventsWithHeats,
    copySourceEventId,
    copyStartTime,
    copyDurationMinutes,
    copyTransitionMinutes,
  ])

  // Fetch events with heats when bulk create dialog opens
  useEffect(() => {
    async function fetchEventsWithHeats() {
      if (isBulkCreateOpen && selectedEventId) {
        setIsLoadingEvents(true)
        try {
          const result = await getEventsWithHeatsFn({
            data: {
              competitionId,
              excludeTrackWorkoutId: selectedEventId,
            },
          })
          if (result?.events) {
            setEventsWithHeats(result.events)
            // Auto-select first event if available
            if (result.events.length > 0 && result.events[0]) {
              setCopySourceEventId(result.events[0].trackWorkoutId)
            }
          }
        } catch (error) {
          console.error('Failed to fetch events with heats:', error)
          setEventsWithHeats([])
        } finally {
          setIsLoadingEvents(false)
        }
      }
    }
    fetchEventsWithHeats()
  }, [isBulkCreateOpen, selectedEventId, competitionId])

  // Instance ID for heat list scoping (drag-drop)
  const [heatListInstanceId] = useState(() => Symbol('heat-list'))

  // Get the selected event
  const selectedEvent = localEvents.find((e) => e.id === selectedEventId)

  // Filter heats for the selected event, sorted by heat number
  const eventHeats = useMemo(
    () =>
      heats
        .filter((h) => h.trackWorkoutId === selectedEventId)
        .sort((a, b) => a.heatNumber - b.heatNumber),
    [heats, selectedEventId],
  )

  // Get assigned registration IDs for this event
  const assignedRegistrationIds = useMemo(() => {
    const ids = new Set<string>()
    for (const heat of eventHeats) {
      for (const assignment of heat.assignments) {
        ids.add(assignment.registration.id)
      }
    }
    return ids
  }, [eventHeats])

  // Unassigned registrations for this event
  const unassignedRegistrations = useMemo(
    () => registrations.filter((r) => !assignedRegistrationIds.has(r.id)),
    [registrations, assignedRegistrationIds],
  )

  // Group unassigned by division, filtered and sorted by registeredAt DESC (newest first)
  const unassignedByDivision = useMemo(() => {
    const filtered =
      filterDivisionId === 'all'
        ? unassignedRegistrations
        : unassignedRegistrations.filter(
            (r) => r.division?.id === filterDivisionId,
          )

    const grouped = new Map<string, Registration[]>()
    for (const reg of filtered) {
      const divId = reg.division?.id ?? 'no-division'
      const existing = grouped.get(divId) ?? []
      existing.push(reg)
      grouped.set(divId, existing)
    }

    // Sort each division by registeredAt DESC (newest first)
    for (const [divId, regs] of grouped) {
      grouped.set(
        divId,
        regs.sort(
          (a, b) =>
            new Date(b.registeredAt).getTime() -
            new Date(a.registeredAt).getTime(),
        ),
      )
    }

    return grouped
  }, [unassignedRegistrations, filterDivisionId])

  // Flat list of unassigned registration IDs for range selection
  const flatUnassignedIds = useMemo(() => {
    const ids: string[] = []
    for (const [, regs] of unassignedByDivision) {
      for (const reg of regs) {
        ids.push(reg.id)
      }
    }
    return ids
  }, [unassignedByDivision])

  // Get selected venue
  const selectedVenue = venues.find((v) => v.id === selectedVenueId)

  // Calculate required heats based on competitors and lanes
  const heatCalculation = useMemo(() => {
    const laneCount = selectedVenue?.laneCount ?? 10
    const venueName = selectedVenue?.name ?? 'No venue selected'

    const totalAthletes = registrations.length
    const unassignedCount = unassignedRegistrations.length
    const currentHeats = eventHeats.length

    // Calculate minimum heats needed for all athletes
    const minHeatsNeeded = Math.ceil(totalAthletes / laneCount)
    const remainingHeats = Math.max(0, minHeatsNeeded - currentHeats)

    // Calculate heats needed just for unassigned athletes
    const heatsForUnassigned = Math.ceil(unassignedCount / laneCount)

    return {
      totalAthletes,
      unassignedCount,
      laneCount,
      venueName,
      minHeatsNeeded,
      currentHeats,
      remainingHeats,
      heatsForUnassigned,
    }
  }, [
    registrations.length,
    unassignedRegistrations.length,
    eventHeats.length,
    selectedVenue,
  ])

  async function handleCreateHeat() {
    if (!selectedEventId) return

    const venueId =
      newHeatVenueId && newHeatVenueId !== 'none' ? newHeatVenueId : null
    const divisionId =
      newHeatDivisionId && newHeatDivisionId !== 'none'
        ? newHeatDivisionId
        : null

    setIsCreating(true)
    try {
      // Get next heat number from server
      const {nextHeatNumber} = await getNextHeatNumberFn({
        data: {trackWorkoutId: selectedEventId},
      })

      // Create heat via server function
      const result = await createHeatFn({
        data: {
          competitionId,
          trackWorkoutId: selectedEventId,
          heatNumber: nextHeatNumber,
          venueId,
          scheduledTime: newHeatTime ? new Date(newHeatTime) : null,
          durationMinutes: newHeatDuration,
          divisionId,
          notes: newHeatNotes || null,
        },
      })

      // Add the new heat to local state with full structure
      const newHeat: HeatWithAssignments = {
        ...result.heat,
        venue: venueId ? (venues.find((v) => v.id === venueId) ?? null) : null,
        division: divisionId
          ? (divisions.find((d) => d.id === divisionId) ?? null)
          : null,
        assignments: [],
      }

      const updatedHeats = [...heats, newHeat]
      setHeats(updatedHeats)
      setIsCreateOpen(false)
      toast.success('Heat created')

      // Calculate next time: current heat + duration
      if (newHeatTime) {
        const nextTime = new Date(newHeatTime)
        nextTime.setMinutes(nextTime.getMinutes() + newHeatDuration)
        setNewHeatTime(formatDatetimeLocal(nextTime))
      } else {
        setNewHeatTime(getDefaultHeatTime())
      }
      // Keep venue and division for consecutive heat creation
      setNewHeatNotes('')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create heat'
      toast.error(message)
    } finally {
      setIsCreating(false)
    }
  }

  async function handleDeleteHeat(heatId: string) {
    if (!confirm('Delete this heat? All assignments will be removed.')) return

    // Optimistic update
    const previousHeats = heats
    setHeats(heats.filter((h) => h.id !== heatId))

    setIsDeleting(true)
    try {
      await deleteHeatFn({data: {heatId}})
      toast.success('Heat deleted')
    } catch (error) {
      // Revert on error
      setHeats(previousHeats)
      const message =
        error instanceof Error ? error.message : 'Failed to delete heat'
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  function handleAssignmentChange(
    heatId: string,
    updatedAssignments: HeatWithAssignments['assignments'],
  ) {
    setHeats(
      heats.map((h) =>
        h.id === heatId ? {...h, assignments: updatedAssignments} : h,
      ),
    )
  }

  function handleMoveAssignment(
    assignmentId: string,
    sourceHeatId: string,
    targetHeatId: string,
    targetLane: number,
    assignment: HeatWithAssignments['assignments'][0],
  ) {
    // Update state for both source and target heats
    setHeats(
      heats.map((h) => {
        if (h.id === sourceHeatId) {
          // Remove from source heat
          return {
            ...h,
            assignments: h.assignments.filter((a) => a.id !== assignmentId),
          }
        }
        if (h.id === targetHeatId) {
          // Add to target heat with new lane
          return {
            ...h,
            assignments: [
              ...h.assignments,
              {...assignment, laneNumber: targetLane},
            ],
          }
        }
        return h
      }),
    )
  }

  // Handle heat reordering
  async function handleHeatReorder(sourceIndex: number, targetIndex: number) {
    const newHeats = [...eventHeats]
    const [movedHeat] = newHeats.splice(sourceIndex, 1)
    if (!movedHeat) return
    newHeats.splice(targetIndex, 0, movedHeat)

    // Optimistic update
    const orderedHeatIds = newHeats.map((h) => h.id)
    const previousHeats = heats
    const updatedEventHeats = newHeats.map((h, i) => ({
      ...h,
      heatNumber: i + 1,
    }))
    setHeats(
      heats.map((h) =>
        h.trackWorkoutId === selectedEventId
          ? (updatedEventHeats.find((uh) => uh.id === h.id) ?? h)
          : h,
      ),
    )

    setIsReordering(true)
    try {
      await reorderHeatsFn({
        data: {
          trackWorkoutId: selectedEventId,
          heatIds: orderedHeatIds,
        },
      })
      toast.success('Heats reordered')
    } catch (error) {
      // Revert on error
      setHeats(previousHeats)
      const message =
        error instanceof Error ? error.message : 'Failed to reorder heats'
      toast.error(message)
    } finally {
      setIsReordering(false)
    }
  }

  // Open bulk create dialog and initialize times
  function openBulkCreateDialog() {
    if (!selectedEventId || heatCalculation.remainingHeats <= 0) return

    const venueId = selectedVenueId || null
    const transitionMinutes = selectedVenue?.transitionMinutes ?? 3
    const duration = workoutCapMinutes + transitionMinutes

    // Generate times for each heat
    const times: string[] = []
    let currentTime = new Date(getNextHeatTime(venueId))

    for (let i = 0; i < heatCalculation.remainingHeats; i++) {
      times.push(formatDatetimeLocal(currentTime))
      currentTime = new Date(currentTime)
      currentTime.setMinutes(currentTime.getMinutes() + duration)
    }

    setBulkHeatTimes(times)
    // Reset copy tab state with smart defaults based on venue
    const defaultGap = selectedVenue?.transitionMinutes ?? 3
    const defaultTransition = selectedVenue?.transitionMinutes ?? 3
    setCopyGapMinutes(defaultGap)
    setCopyTransitionMinutes(defaultTransition)
    setCopyStartTime(getDefaultCopyStartTime(defaultGap))
    setCopyDurationMinutes(workoutCapMinutes)
    setBulkCreateTab('new')
    setIsBulkCreateOpen(true)
  }

  // Recalculate start time when gap changes
  function handleGapChange(newGap: number) {
    setCopyGapMinutes(newGap)
    setCopyStartTime(getDefaultCopyStartTime(newGap))
  }

  // Handle copying heats from another event
  async function handleCopyHeats() {
    if (!selectedEventId || !copySourceEventId) return

    setIsCopying(true)
    try {
      const result = await copyHeatsFromEventFn({
        data: {
          sourceTrackWorkoutId: copySourceEventId,
          targetTrackWorkoutId: selectedEventId,
          startTime: new Date(copyStartTime),
          durationMinutes: copyDurationMinutes,
          transitionMinutes: copyTransitionMinutes,
          copyAssignments: true,
        },
      })

      if (result?.heats) {
        // Add the new heats to the state (server returns heats with assignments already included)
        const newHeats: HeatWithAssignments[] = result.heats.map((heat) => ({
          ...heat,
          venue: heat.venueId
            ? (venues.find((v) => v.id === heat.venueId) ?? null)
            : null,
          division: heat.divisionId
            ? (divisions.find((d) => d.id === heat.divisionId) ?? null)
            : null,
        }))
        setHeats([...heats, ...newHeats])

        const totalAssignments = result.heats.reduce(
          (sum, heat) => sum + heat.assignments.length,
          0,
        )
        toast.success(
          `Copied ${result.heats.length} heat${result.heats.length !== 1 ? 's' : ''} with ${totalAssignments} athlete assignment${totalAssignments !== 1 ? 's' : ''}`,
        )

        setIsBulkCreateOpen(false)
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to copy heats'
      toast.error(message)
    } finally {
      setIsCopying(false)
    }
  }

  // Update a heat time and cascade to subsequent heats
  function updateBulkHeatTime(index: number, newTime: string) {
    const transitionMinutes = selectedVenue?.transitionMinutes ?? 3
    const duration = workoutCapMinutes + transitionMinutes

    setBulkHeatTimes((prev) => {
      const updated = [...prev]
      updated[index] = newTime

      // Cascade time changes to all subsequent heats
      let currentTime = new Date(newTime)
      for (let i = index + 1; i < updated.length; i++) {
        currentTime = new Date(currentTime)
        currentTime.setMinutes(currentTime.getMinutes() + duration)
        updated[i] = formatDatetimeLocal(currentTime)
      }

      return updated
    })
  }

  async function handleBulkCreateHeats() {
    if (!selectedEventId || bulkHeatTimes.length === 0) return

    const venueId = selectedVenueId || null
    const transitionMinutes = selectedVenue?.transitionMinutes ?? 3
    const duration = workoutCapMinutes + transitionMinutes

    setIsBulkCreating(true)
    try {
      // Prepare heats data for bulk creation
      const heatsData = bulkHeatTimes
        .filter((time): time is string => !!time)
        .map((heatTime) => ({
          scheduledTime: new Date(heatTime),
          venueId,
          divisionId: null,
          durationMinutes: duration,
        }))

      // Call bulk create server function
      const result = await bulkCreateHeatsFn({
        data: {
          competitionId,
          trackWorkoutId: selectedEventId,
          heats: heatsData,
        },
      })

      // Add the new heats to local state with full structure
      const newHeats: HeatWithAssignments[] = result.heats.map((heat) => ({
        ...heat,
        venue: selectedVenue ?? null,
        division: null,
        assignments: [],
      }))

      if (newHeats.length > 0) {
        setHeats([...heats, ...newHeats])
        toast.success(`Created ${newHeats.length} heats`)
      }

      setIsBulkCreateOpen(false)
      setBulkHeatTimes([])
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create heats'
      toast.error(message)
    } finally {
      setIsBulkCreating(false)
    }
  }

  if (localEvents.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          <p className="mb-4">No events created yet.</p>
          <p className="text-sm">
            Create events in the Events tab first, then come back to create the
            heat schedule.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Event Overview */}
      <EventOverview events={localEvents} heats={heats} />

      {/* Heat Status Row */}
      {selectedEvent && (
        <div className="flex items-center gap-3">
          <Label className="whitespace-nowrap text-sm flex items-center gap-1.5">
            {selectedEvent.heatStatus === 'published' ? (
              <Eye className="h-4 w-4 text-green-600" />
            ) : (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            )}
            Heat Assignments:
          </Label>
          <Select
            value={selectedEvent.heatStatus ?? HEAT_STATUS.DRAFT}
            onValueChange={(value) =>
              handleHeatStatusChange({
                eventId: selectedEvent.id,
                newStatus: value as HeatStatus,
              })
            }
            disabled={isUpdatingWorkout}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={HEAT_STATUS.DRAFT}>
                <span className="flex items-center gap-2">
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                  Draft
                </span>
              </SelectItem>
              <SelectItem value={HEAT_STATUS.PUBLISHED}>
                <span className="flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5 text-green-600" />
                  Published
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {selectedEvent.heatStatus === 'published'
              ? `Heat assignments for ${selectedEvent.workout.name} are visible to public`
              : `Heat assignments for ${selectedEvent.workout.name} are hidden from public`}
          </span>
        </div>
      )}

      {/* Event & Venue Selector */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="event-select" className="whitespace-nowrap">
            Event:
          </Label>
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger id="event-select" className="w-[250px]">
              <SelectValue placeholder="Select an event" />
            </SelectTrigger>
            <SelectContent>
              {localEvents.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  <span className="tabular-nums">{event.trackOrder}</span>.{' '}
                  {event.workout.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {venues.length > 0 && (
          <div className="flex items-center gap-2">
            <Label htmlFor="venue-select" className="whitespace-nowrap">
              Venue:
            </Label>
            <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
              <SelectTrigger id="venue-select" className="w-[180px]">
                <SelectValue placeholder="Select venue" />
              </SelectTrigger>
              <SelectContent>
                {venues.map((venue) => (
                  <SelectItem key={venue.id} value={venue.id}>
                    {venue.name} (
                    <span className="tabular-nums">{venue.laneCount}</span>{' '}
                    lanes)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Label htmlFor="workout-cap" className="whitespace-nowrap text-sm">
            Cap:
          </Label>
          <Input
            id="workout-cap"
            type="number"
            min={1}
            max={60}
            value={workoutCapMinutes}
            onChange={(e) => setWorkoutCapMinutes(Number(e.target.value))}
            className="w-16"
          />
          <span className="text-sm text-muted-foreground">min</span>
        </div>

        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            if (open) {
              // Initialize with selected venue and calculate next time
              const venueId = selectedVenueId || null
              setNewHeatVenueId(selectedVenueId)
              setNewHeatTime(getNextHeatTime(venueId))
              setNewHeatDuration(getHeatDuration(venueId))
            }
            setIsCreateOpen(open)
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Heat
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Create Heat for {selectedEvent?.workout.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="heat-time">Scheduled Time (optional)</Label>
                <Input
                  id="heat-time"
                  type="datetime-local"
                  value={newHeatTime}
                  onChange={(e) => setNewHeatTime(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="heat-venue">Venue (optional)</Label>
                <Select
                  value={newHeatVenueId}
                  onValueChange={handleVenueChange}
                >
                  <SelectTrigger id="heat-venue">
                    <SelectValue placeholder="Select a venue" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No venue</SelectItem>
                    {venues.map((venue) => (
                      <SelectItem key={venue.id} value={venue.id}>
                        {venue.name} (
                        <span className="tabular-nums">{venue.laneCount}</span>{' '}
                        lanes)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="heat-duration">
                  Duration (min){' '}
                  <span className="text-muted-foreground font-normal">
                    cap + transition
                  </span>
                </Label>
                <Input
                  id="heat-duration"
                  type="number"
                  min={1}
                  max={180}
                  value={newHeatDuration}
                  onChange={(e) => setNewHeatDuration(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="heat-division">
                  Division Filter (optional)
                </Label>
                <Select
                  value={newHeatDivisionId}
                  onValueChange={setNewHeatDivisionId}
                >
                  <SelectTrigger id="heat-division">
                    <SelectValue placeholder="All divisions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All divisions</SelectItem>
                    {divisions.map((div) => (
                      <SelectItem key={div.id} value={div.id}>
                        {div.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="heat-notes">Notes (optional)</Label>
                <Input
                  id="heat-notes"
                  value={newHeatNotes}
                  onChange={(e) => setNewHeatNotes(e.target.value)}
                  placeholder="e.g., Finals heat"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateHeat} disabled={isCreating}>
                  {isCreating && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Create Heat
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Heat Calculation & Bulk Add */}
        {heatCalculation.remainingHeats > 0 && selectedVenue && (
          <TooltipProvider>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground tabular-nums"
                  >
                    <Calculator className="h-4 w-4" />
                    <span>
                      {heatCalculation.totalAthletes} athletes ÷{' '}
                      {heatCalculation.laneCount} lanes ={' '}
                      {heatCalculation.minHeatsNeeded} heats
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium mb-1">Heat Calculation</p>
                  <ul className="text-xs space-y-1">
                    <li>Total athletes: {heatCalculation.totalAthletes}</li>
                    <li>
                      Venue: {heatCalculation.venueName} (
                      {heatCalculation.laneCount} lanes)
                    </li>
                    <li>Min heats needed: {heatCalculation.minHeatsNeeded}</li>
                    <li>Current heats: {heatCalculation.currentHeats}</li>
                  </ul>
                  <p className="text-xs mt-2 text-muted-foreground">
                    Note: You may need more heats to keep divisions together
                  </p>
                </TooltipContent>
              </Tooltip>
              <Button
                size="sm"
                variant="secondary"
                onClick={openBulkCreateDialog}
                disabled={isBulkCreating}
              >
                {isBulkCreating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add {heatCalculation.remainingHeats} Remaining Heat
                {heatCalculation.remainingHeats !== 1 ? 's' : ''}
              </Button>
            </div>
          </TooltipProvider>
        )}
      </div>

      {/* Bulk Create Heats Dialog */}
      <Dialog open={isBulkCreateOpen} onOpenChange={setIsBulkCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Heats</DialogTitle>
          </DialogHeader>
          <Tabs
            value={bulkCreateTab}
            onValueChange={(v) => setBulkCreateTab(v as 'new' | 'copy')}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new">Create New</TabsTrigger>
              <TabsTrigger
                value="copy"
                disabled={isLoadingEvents || eventsWithHeats.length === 0}
              >
                Copy from Previous
              </TabsTrigger>
            </TabsList>

            {/* Create New Tab */}
            <TabsContent value="new" className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Venue: {selectedVenue?.name} (
                <span className="tabular-nums">{selectedVenue?.laneCount}</span>{' '}
                lanes)
              </div>
              <div className="max-h-[300px] overflow-y-auto space-y-3">
                {bulkHeatTimes.map((time, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: index is appropriate for this editable list
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-16 tabular-nums">
                      Heat {eventHeats.length + index + 1}
                    </span>
                    <Input
                      type="datetime-local"
                      value={time}
                      onChange={(e) =>
                        updateBulkHeatTime(index, e.target.value)
                      }
                      className="flex-1"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsBulkCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBulkCreateHeats}
                  disabled={isBulkCreating}
                >
                  {isBulkCreating && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Create {bulkHeatTimes.length} Heat
                  {bulkHeatTimes.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </TabsContent>

            {/* Copy from Previous Tab */}
            <TabsContent value="copy" className="space-y-4">
              {isLoadingEvents ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">
                    Loading events...
                  </span>
                </div>
              ) : eventsWithHeats.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No other events have heats scheduled yet.
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="copy-source-event">Source Event</Label>
                    <Select
                      value={copySourceEventId}
                      onValueChange={setCopySourceEventId}
                    >
                      <SelectTrigger id="copy-source-event">
                        <SelectValue placeholder="Select an event" />
                      </SelectTrigger>
                      <SelectContent>
                        {eventsWithHeats.map((event) => (
                          <SelectItem
                            key={event.trackWorkoutId}
                            value={event.trackWorkoutId}
                          >
                            {event.workoutName} ({event.heatCount} heat
                            {event.heatCount !== 1 ? 's' : ''})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {copySourceEventId && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {(() => {
                          const sourceEvent = eventsWithHeats.find(
                            (e) => e.trackWorkoutId === copySourceEventId,
                          )
                          if (!sourceEvent) return null
                          return `Will copy ${sourceEvent.heatCount} heat${sourceEvent.heatCount !== 1 ? 's' : ''} with all athlete assignments`
                        })()}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="copy-gap">
                      Gap After Last Event (minutes)
                    </Label>
                    <Input
                      id="copy-gap"
                      type="number"
                      min={0}
                      max={120}
                      value={copyGapMinutes}
                      onChange={(e) => handleGapChange(Number(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Time between end of last heat and start of this event
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="copy-start-time">New Start Time</Label>
                    <Input
                      id="copy-start-time"
                      type="datetime-local"
                      value={copyStartTime}
                      onChange={(e) => setCopyStartTime(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      First heat will start at this time (auto-calculated from
                      gap)
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="copy-duration">
                        Event Time Cap (min)
                      </Label>
                      <Input
                        id="copy-duration"
                        type="number"
                        min={1}
                        max={180}
                        value={copyDurationMinutes}
                        onChange={(e) =>
                          setCopyDurationMinutes(Number(e.target.value))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="copy-transition">
                        Heat Transition (min)
                      </Label>
                      <Input
                        id="copy-transition"
                        type="number"
                        min={0}
                        max={60}
                        value={copyTransitionMinutes}
                        onChange={(e) =>
                          setCopyTransitionMinutes(Number(e.target.value))
                        }
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground -mt-2">
                    Each heat slot = time cap + transition
                  </p>

                  {/* Heat Preview */}
                  {copyHeatPreviews.length > 0 && (
                    <div className="mt-4">
                      <Label className="text-sm font-medium">
                        Heats to be created:
                      </Label>
                      <div className="mt-2 border rounded-md bg-muted/30 max-h-[150px] overflow-y-auto">
                        <div className="divide-y">
                          {copyHeatPreviews.map((preview) => (
                            <div
                              key={preview.heatNumber}
                              className="px-3 py-2 text-sm flex items-center justify-between"
                            >
                              <span className="font-medium tabular-nums">
                                Heat {preview.heatNumber}
                              </span>
                              <span className="text-muted-foreground tabular-nums">
                                {formatTimeDisplay(preview.startTime)} -{' '}
                                {formatTimeDisplay(preview.endTime)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsBulkCreateOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCopyHeats}
                      disabled={isCopying || !copySourceEventId}
                    >
                      {isCopying && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Copy Heats
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Workout Preview */}
      {selectedEvent && <WorkoutPreview event={selectedEvent} />}

      {/* Stats */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>{eventHeats.length} heats</span>
        <span>•</span>
        <span>{assignedRegistrationIds.size} assigned</span>
        <span>•</span>
        <span>{unassignedRegistrations.length} unassigned</span>
      </div>

      {/* Heat Grid + Unassigned Panel */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Heats Column */}
        <div className="flex-1 min-w-0 space-y-4">
          {eventHeats.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                <p>No heats for this event yet.</p>
                <p className="text-sm mt-2">Click "Add Heat" to create one.</p>
              </CardContent>
            </Card>
          ) : (
            eventHeats.map((heat, index) => (
              <HeatCard
                key={heat.id}
                heat={heat}
                competitionId={competitionId}
                organizingTeamId={organizingTeamId}
                unassignedRegistrations={unassignedRegistrations}
                maxLanes={heat.venue?.laneCount ?? 10}
                onDelete={() => handleDeleteHeat(heat.id)}
                onAssignmentChange={(assignments) =>
                  handleAssignmentChange(heat.id, assignments)
                }
                onMoveAssignment={handleMoveAssignment}
                selectedAthleteIds={selectedAthleteIds}
                onClearSelection={clearSelection}
                index={index}
                instanceId={heatListInstanceId}
                onReorder={handleHeatReorder}
              />
            ))
          )}
        </div>

        {/* Unassigned Athletes Panel - sticky on right side */}
        <div className="w-full lg:w-80 lg:shrink-0">
          <div className="lg:sticky lg:top-4">
            <Card className="max-h-[calc(100vh-8rem)] overflow-hidden flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Unassigned Athletes
                  </CardTitle>
                </div>
                <Select
                  value={filterDivisionId}
                  onValueChange={setFilterDivisionId}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Filter by division" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Divisions</SelectItem>
                    {divisions.map((div) => (
                      <SelectItem key={div.id} value={div.id}>
                        {div.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="overflow-y-auto flex-1">
                {selectedAthleteIds.size > 0 && (
                  <div className="flex items-center justify-between mb-3 pb-2 border-b">
                    <span className="text-sm font-medium text-primary">
                      {selectedAthleteIds.size} selected
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                      className="h-6 text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                )}
                {unassignedRegistrations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    All athletes are assigned to heats.
                  </p>
                ) : unassignedByDivision.size === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No athletes in this division.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {/* Division groups with draggable headers */}
                    {Array.from(unassignedByDivision.entries()).map(
                      ([divId, regs]) => {
                        const divisionLabel =
                          divisions.find((d) => d.id === divId)?.label ??
                          'No Division'

                        return (
                          <div key={divId}>
                            <DraggableDivisionHeader
                              divisionId={divId}
                              divisionLabel={divisionLabel}
                              athleteCount={regs.length}
                              registrationIds={regs.map((r) => r.id)}
                            />
                            <div className="space-y-1">
                              {regs.map((reg) => (
                                <DraggableAthlete
                                  key={reg.id}
                                  registration={reg}
                                  isSelected={selectedAthleteIds.has(reg.id)}
                                  onToggleSelect={toggleAthleteSelection}
                                  selectedCount={selectedAthleteIds.size}
                                  selectedIds={selectedAthleteIds}
                                />
                              ))}
                            </div>
                          </div>
                        )
                      },
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
