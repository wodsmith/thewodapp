// @lat: [[crew#Pilot Readiness Checklist]]
import { createServerFn } from "@tanstack/react-start"
import { and, count, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "../db"
import {
  competitionHeatsTable,
  competitionsTable,
  competitionVenuesTable,
} from "../db/schemas/competitions"
import {
  CREW_IMPORT_KIND,
  CREW_IMPORT_STATUS,
  crewImportsTable,
} from "../db/schemas/crew-imports"
import { crewEventSettingsTable } from "../db/schemas/crew-event-settings"
import {
  programmingTracksTable,
  trackWorkoutsTable,
} from "../db/schemas/programming"
import {
  competitionJudgeRotationsTable,
  judgeAssignmentVersionsTable,
  judgeHeatAssignmentsTable,
} from "../db/schemas/volunteers"
import {
  calculateSetupProgress,
  parseCrewSettings,
} from "../lib/crew-event-setup"
import {
  buildCrewReadinessChecklist,
  type CrewReadinessChecklist,
  type CrewReadinessImportInput,
  type CrewReadinessJudgeInput,
  type CrewReadinessScheduleInput,
  type CrewReadinessVenueInput,
} from "../lib/crew/readiness"
import { summarizeCrewRoster } from "../lib/crew/roster-shifts"
import { requireLocalCrewOperatorAccess } from "../server/crew-local-access"
import {
  loadCrewRoster,
  loadCrewShifts,
  summarizeCrewShifts,
  type CrewShiftSummary,
} from "./crew-roster-shift-fns"

const eventIdSchema = z.string().min(1, "Event ID is required")

export interface CrewReadinessPageData {
  readiness: CrewReadinessChecklist
  facts: {
    setup: ReturnType<typeof calculateSetupProgress>
    venues: CrewReadinessVenueInput
    schedule: CrewReadinessScheduleInput
    imports: CrewReadinessImportInput
    roster: ReturnType<typeof summarizeCrewRoster>
    shifts: CrewShiftSummary
    judge: CrewReadinessJudgeInput
  }
}

export const getCrewReadinessPageFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ eventId: eventIdSchema }).parse(data),
  )
  .handler(async ({ data }): Promise<CrewReadinessPageData> => {
    requireLocalCrewOperatorAccess("Crew pilot readiness")

    const event = await requireCrewReadinessEvent(data.eventId)
    const [roster, shifts, venues, schedule, imports, judge] =
      await Promise.all([
        loadCrewRoster(event.competitionTeamId),
        loadCrewShifts(event.id),
        loadVenueSummary(event.id),
        loadScheduleSummary(event.id),
        loadImportSummary(event.id),
        loadJudgeSummary(event.id),
      ])

    const parsedSettings = parseCrewSettings(event.settingsText)
    const setup = calculateSetupProgress(parsedSettings.setup)
    const rosterSummary = summarizeCrewRoster(roster)
    const shiftSummary = summarizeCrewShifts(shifts)
    const readiness = buildCrewReadinessChecklist({
      event: {
        startDate: event.startDate,
        endDate: event.endDate,
        timezone: event.timezone,
      },
      setup,
      venues,
      schedule,
      imports,
      roster: rosterSummary,
      shifts: shiftSummary,
      judge,
    })

    return {
      readiness,
      facts: {
        setup,
        venues,
        schedule,
        imports,
        roster: rosterSummary,
        shifts: shiftSummary,
        judge,
      },
    }
  })

async function requireCrewReadinessEvent(eventId: string) {
  const db = getDb()
  const [event] = await db
    .select({
      id: competitionsTable.id,
      competitionTeamId: competitionsTable.competitionTeamId,
      startDate: competitionsTable.startDate,
      endDate: competitionsTable.endDate,
      timezone: competitionsTable.timezone,
      settingsText: crewEventSettingsTable.settings,
    })
    .from(competitionsTable)
    .leftJoin(
      crewEventSettingsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )
    .where(eq(competitionsTable.id, eventId))
    .limit(1)

  if (!event) {
    throw new Error("Crew event not found")
  }

  return event
}

async function loadVenueSummary(
  competitionId: string,
): Promise<CrewReadinessVenueInput> {
  const db = getDb()
  const venues = await db
    .select({
      id: competitionVenuesTable.id,
      laneCount: competitionVenuesTable.laneCount,
    })
    .from(competitionVenuesTable)
    .where(eq(competitionVenuesTable.competitionId, competitionId))

  return {
    venueCount: venues.length,
    totalLaneCount: venues.reduce(
      (total, venue) => total + (venue.laneCount ?? 0),
      0,
    ),
  }
}

async function loadScheduleSummary(
  competitionId: string,
): Promise<CrewReadinessScheduleInput> {
  const db = getDb()
  const [workouts, heats] = await Promise.all([
    db
      .select({
        id: trackWorkoutsTable.id,
        eventStatus: trackWorkoutsTable.eventStatus,
      })
      .from(trackWorkoutsTable)
      .innerJoin(
        programmingTracksTable,
        eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
      )
      .where(eq(programmingTracksTable.competitionId, competitionId)),
    db
      .select({
        id: competitionHeatsTable.id,
        scheduledTime: competitionHeatsTable.scheduledTime,
        schedulePublishedAt: competitionHeatsTable.schedulePublishedAt,
      })
      .from(competitionHeatsTable)
      .where(eq(competitionHeatsTable.competitionId, competitionId)),
  ])

  return {
    workoutCount: workouts.length,
    publishedWorkoutCount: workouts.filter(
      (workout) => workout.eventStatus === "published",
    ).length,
    heatCount: heats.length,
    scheduledHeatCount: heats.filter((heat) => Boolean(heat.scheduledTime))
      .length,
    publishedHeatCount: heats.filter((heat) =>
      Boolean(heat.schedulePublishedAt),
    ).length,
  }
}

async function loadImportSummary(
  competitionId: string,
): Promise<CrewReadinessImportInput> {
  const db = getDb()
  const imports = await db
    .select({
      kind: crewImportsTable.kind,
      status: crewImportsTable.status,
    })
    .from(crewImportsTable)
    .where(eq(crewImportsTable.competitionId, competitionId))

  return imports.reduce<CrewReadinessImportInput>(
    (summary, row) => {
      if (row.kind === CREW_IMPORT_KIND.VOLUNTEERS) {
        summary.volunteerImportCount += 1
        if (row.status === CREW_IMPORT_STATUS.APPLIED) {
          summary.appliedVolunteerImportCount += 1
        }
      } else if (row.kind === CREW_IMPORT_KIND.HEAT_SCHEDULE) {
        summary.heatScheduleImportCount += 1
        if (row.status === CREW_IMPORT_STATUS.APPLIED) {
          summary.appliedHeatScheduleImportCount += 1
        }
      }
      return summary
    },
    {
      volunteerImportCount: 0,
      appliedVolunteerImportCount: 0,
      heatScheduleImportCount: 0,
      appliedHeatScheduleImportCount: 0,
    },
  )
}

async function loadJudgeSummary(
  competitionId: string,
): Promise<CrewReadinessJudgeInput> {
  const db = getDb()
  const [rotations, assignments, activeVersions] = await Promise.all([
    db
      .select({ count: count() })
      .from(competitionJudgeRotationsTable)
      .where(eq(competitionJudgeRotationsTable.competitionId, competitionId)),
    db
      .select({ count: count() })
      .from(judgeHeatAssignmentsTable)
      .innerJoin(
        competitionHeatsTable,
        eq(judgeHeatAssignmentsTable.heatId, competitionHeatsTable.id),
      )
      .where(eq(competitionHeatsTable.competitionId, competitionId)),
    db
      .select({ count: count() })
      .from(judgeAssignmentVersionsTable)
      .innerJoin(
        trackWorkoutsTable,
        eq(judgeAssignmentVersionsTable.trackWorkoutId, trackWorkoutsTable.id),
      )
      .innerJoin(
        programmingTracksTable,
        eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
      )
      .where(
        and(
          eq(programmingTracksTable.competitionId, competitionId),
          eq(judgeAssignmentVersionsTable.isActive, true),
        ),
      ),
  ])

  return {
    rotationCount: rotations[0]?.count ?? 0,
    assignmentCount: assignments[0]?.count ?? 0,
    activeVersionCount: activeVersions[0]?.count ?? 0,
  }
}
