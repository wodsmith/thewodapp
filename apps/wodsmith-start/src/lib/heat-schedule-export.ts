/**
 * Heat schedule export — shared data shaping for CSV and PDF outputs.
 *
 * The schedule loader already returns every heat for the competition; the
 * UI filters down to a single event for display. Exports use the full
 * `heats` and `allEvents` (sub-events included) arrays so a download
 * captures every heat regardless of what's currently visible.
 */

import type { HeatWithAssignments } from "@/server-fns/competition-heats-fns"
import type { CompetitionWorkout } from "@/server-fns/competition-workouts-fns"

export interface HeatExportEvent {
  id: string
  name: string
  trackOrder: number
  parentEventId: string | null
  /** Resolved parent display name when this event is a sub-event. */
  parentEventName: string | null
}

export interface HeatExportAssignment {
  laneNumber: number
  athleteName: string
  teamName: string | null
  athleteDivision: string | null
  affiliate: string | null
}

export interface HeatExportRow {
  heatId: string
  heatNumber: number
  scheduledTime: Date | null
  durationMinutes: number | null
  venueName: string | null
  /** Heat-level division gate; null = mixed divisions. */
  heatDivision: string | null
  notes: string | null
  isPublished: boolean
  assignments: HeatExportAssignment[]
}

export interface HeatExportEventGroup {
  /** Stable key — parent event id, or the standalone event's own id. */
  key: string
  /** Display label for the group; parent name or standalone event name. */
  label: string
  /**
   * Member events in display order. A standalone event has a single
   * member (itself); a parent event has one member per sub-event.
   */
  events: Array<HeatExportEvent & { heats: HeatExportRow[] }>
}

function fullName(
  user: { firstName: string | null; lastName: string | null } | null | undefined,
): string {
  if (!user) return ""
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
}

function toExportRow(heat: HeatWithAssignments): HeatExportRow {
  const assignments: HeatExportAssignment[] = [...heat.assignments]
    .sort((a, b) => a.laneNumber - b.laneNumber)
    .map((a) => ({
      laneNumber: a.laneNumber,
      athleteName: fullName(a.registration.user),
      teamName: a.registration.teamName,
      athleteDivision: a.registration.division?.label ?? null,
      affiliate: a.registration.affiliate,
    }))

  return {
    heatId: heat.id,
    heatNumber: heat.heatNumber,
    scheduledTime: heat.scheduledTime ?? null,
    durationMinutes: heat.durationMinutes ?? null,
    venueName: heat.venue?.name ?? null,
    heatDivision: heat.division?.label ?? null,
    notes: heat.notes ?? null,
    isPublished: heat.schedulePublishedAt !== null,
    assignments,
  }
}

/**
 * Group every heat in the competition by event, preserving parent →
 * sub-event hierarchy so the consumer can render leaderboard-style
 * grouped output (parent heading with sub-event sub-headings).
 *
 * Events with no heats are omitted; standalone events without heats
 * still produce a group only if the consumer pre-includes them, but
 * this function intentionally trims to "events that actually have
 * heats" to keep exports concise.
 */
export function groupHeatsByEvent(
  heats: HeatWithAssignments[],
  allEvents: CompetitionWorkout[],
): HeatExportEventGroup[] {
  const eventsById = new Map(allEvents.map((e) => [e.id, e]))

  const heatsByEventId = new Map<string, HeatWithAssignments[]>()
  for (const heat of heats) {
    const arr = heatsByEventId.get(heat.trackWorkoutId) ?? []
    arr.push(heat)
    heatsByEventId.set(heat.trackWorkoutId, arr)
  }

  const eventsWithHeats = allEvents.filter((e) => heatsByEventId.has(e.id))

  const buildEvent = (
    e: CompetitionWorkout,
  ): HeatExportEvent & { heats: HeatExportRow[] } => {
    const parentName = e.parentEventId
      ? (eventsById.get(e.parentEventId)?.workout.name ?? null)
      : null
    const heatRows = (heatsByEventId.get(e.id) ?? [])
      .map(toExportRow)
      .sort((a, b) => a.heatNumber - b.heatNumber)
    return {
      id: e.id,
      name: e.workout.name,
      trackOrder: e.trackOrder,
      parentEventId: e.parentEventId,
      parentEventName: parentName,
      heats: heatRows,
    }
  }

  // Group consecutive events sharing a parent (mirrors the leaderboard
  // grouping in competition-leaderboard-table.tsx). Standalone events
  // each form a single-member group keyed by their own id.
  const sorted = [...eventsWithHeats].sort(
    (a, b) => a.trackOrder - b.trackOrder,
  )

  const groups: HeatExportEventGroup[] = []
  for (const e of sorted) {
    const built = buildEvent(e)
    if (e.parentEventId) {
      const last = groups[groups.length - 1]
      if (last && last.key === e.parentEventId) {
        last.events.push(built)
        continue
      }
      groups.push({
        key: e.parentEventId,
        label: built.parentEventName ?? "Parent Event",
        events: [built],
      })
    } else {
      groups.push({
        key: e.id,
        label: e.workout.name,
        events: [built],
      })
    }
  }
  return groups
}

/**
 * Flatten grouped heats into one CSV row per heat-assignment.
 * Empty heats produce a single row with blank athlete columns so
 * the export still surfaces the scheduled slot.
 */
export function buildHeatScheduleCsvRows(
  groups: HeatExportEventGroup[],
): string[][] {
  const rows: string[][] = []
  const formatTime = (d: Date | null) =>
    d
      ? d.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : ""

  for (const group of groups) {
    for (const event of group.events) {
      const eventGroup = event.parentEventId ? group.label : ""
      for (const heat of event.heats) {
        const baseCols: string[] = [
          eventGroup,
          event.name,
          String(heat.heatNumber),
          formatTime(heat.scheduledTime),
          heat.durationMinutes != null ? String(heat.durationMinutes) : "",
          heat.venueName ?? "",
          heat.heatDivision ?? "",
        ]
        if (heat.assignments.length === 0) {
          rows.push([
            ...baseCols,
            "",
            "",
            "",
            "",
            heat.isPublished ? "Yes" : "No",
            heat.notes ?? "",
          ])
          continue
        }
        for (const a of heat.assignments) {
          rows.push([
            ...baseCols,
            String(a.laneNumber),
            a.teamName ?? a.athleteName,
            a.athleteDivision ?? "",
            a.affiliate ?? "",
            heat.isPublished ? "Yes" : "No",
            heat.notes ?? "",
          ])
        }
      }
    }
  }
  return rows
}

export const HEAT_SCHEDULE_CSV_HEADERS: readonly string[] = [
  "Parent Event",
  "Event",
  "Heat #",
  "Scheduled Time",
  "Duration (min)",
  "Venue",
  "Heat Division",
  "Lane",
  "Athlete / Team",
  "Athlete Division",
  "Affiliate",
  "Published",
  "Notes",
] as const
