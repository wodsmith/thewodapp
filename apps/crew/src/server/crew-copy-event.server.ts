// @lat: [[crew#Copy Prior Event Setup]]
import { asc, count, desc, eq, inArray } from "drizzle-orm"
import { getDb } from "../db"
import { competitionBroadcastsTable } from "../db/schemas/broadcasts"
import {
  createCompetitionHeatId,
  createCompetitionVenueId,
  createProgrammingTrackId,
  createTrackWorkoutId,
} from "../db/schemas/common"
import {
  competitionHeatAssignmentsTable,
  competitionHeatsTable,
  competitionRegistrationsTable,
  competitionsTable,
  competitionVenuesTable,
} from "../db/schemas/competitions"
import { crewEventSettingsTable } from "../db/schemas/crew-event-settings"
import { crewImportsTable } from "../db/schemas/crew-imports"
import {
  programmingTracksTable,
  trackWorkoutsTable,
} from "../db/schemas/programming"
import { teamInvitationTable, teamMembershipTable } from "../db/schemas/teams"
import {
  competitionJudgeRotationsTable,
  judgeHeatAssignmentsTable,
  type VolunteerRoleType,
  volunteerShiftsTable,
} from "../db/schemas/volunteers"
import { workouts } from "../db/schemas/workouts"
import {
  buildCrewCopyPriorEventPreview,
  type CrewCopyPriorEventApplyMode,
  type CrewCopyPriorEventCandidate,
  type CrewCopyPriorEventDeniedCounts,
  type CrewCopyPriorEventEventSnapshot,
  type CrewCopyPriorEventExistingCounts,
  type CrewCopyPriorEventPreview,
  type CrewCopyPriorEventSourceHeat,
  type CrewCopyPriorEventSourceShift,
  type CrewCopyPriorEventSourceTrack,
  type CrewCopyPriorEventSourceTrackWorkout,
  type CrewCopyPriorEventSourceVenue,
  filterEligibleCrewCopyPriorEvents,
  serializeCrewCopyPriorEventSettings,
} from "../lib/crew/copy-prior-event"
import { DEFAULT_TIMEZONE } from "../utils/timezone-utils"
import { requireCrewEventManagerAccess } from "./crew-auth.server"

type DbClient = ReturnType<typeof getDb>
type NewWorkout = typeof workouts.$inferInsert
type NewTrackWorkout = typeof trackWorkoutsTable.$inferInsert
type NewVolunteerShift = typeof volunteerShiftsTable.$inferInsert

interface CrewCopyPriorEventInput {
  eventId: string
  sourceEventId?: string | null
}

interface ApplyCrewCopyPriorEventInput extends CrewCopyPriorEventInput {
  sourceEventId: string
  mode: CrewCopyPriorEventApplyMode
}

interface CrewCopyPriorEventSnapshot {
  event: CrewCopyPriorEventEventSnapshot & {
    competitionTeamId: string
    lifecycle: string
  }
  venues: CrewCopyPriorEventSourceVenue[]
  tracks: CrewCopyPriorEventSourceTrack[]
  trackWorkouts: CrewCopyPriorEventSourceTrackWorkout[]
  heats: CrewCopyPriorEventSourceHeat[]
  shifts: CrewCopyPriorEventSourceShift[]
  existingCounts: CrewCopyPriorEventExistingCounts
  deniedCounts: CrewCopyPriorEventDeniedCounts
}

export interface CrewCopyPriorEventPageData {
  targetEvent: CrewCopyPriorEventCandidate
  eligibleEvents: CrewCopyPriorEventCandidate[]
  selectedSourceEventId: string | null
  preview: CrewCopyPriorEventPreview | null
}

export interface ApplyCrewCopyPriorEventResult {
  success: true
  preview: CrewCopyPriorEventPreview
  created: {
    venues: number
    tracks: number
    trackWorkouts: number
    heats: number
    shifts: number
    assumptions: boolean
  }
}

export async function getCrewCopyPriorEventPage(
  data: CrewCopyPriorEventInput,
): Promise<CrewCopyPriorEventPageData> {
  const target = await loadCopyEventSnapshot(data.eventId)
  await requireCrewEventManagerAccess(target.event, "Copy prior event setup")
  const eligibleEvents = filterEligibleCrewCopyPriorEvents(
    snapshotToCandidate(target),
    await listTeamCopyCandidates(target.event.organizingTeamId),
  )
  const selectedSourceEventId =
    eligibleEvents.find((event) => event.id === data.sourceEventId)?.id ??
    eligibleEvents[0]?.id ??
    null

  return {
    targetEvent: snapshotToCandidate(target),
    eligibleEvents,
    selectedSourceEventId,
    preview: selectedSourceEventId
      ? await buildPreview(target, selectedSourceEventId, "empty_target_only")
      : null,
  }
}

export async function applyCrewCopyPriorEvent(
  data: ApplyCrewCopyPriorEventInput,
): Promise<ApplyCrewCopyPriorEventResult> {
  if (data.mode !== "empty_target_only") {
    throw new Error("Unsupported copy mode")
  }

  const db = getDb()
  let result: ApplyCrewCopyPriorEventResult | null = null

  await db.transaction(async (tx) => {
    const client = tx as unknown as DbClient
    const target = await loadCopyEventSnapshot(data.eventId, client, true)
    await requireCrewEventManagerAccess(target.event, "Copy prior event setup")
    const source = await loadCopyEventSnapshot(data.sourceEventId, client)

    assertEligibleSource(target, source)

    const preview = buildCrewCopyPriorEventPreview({
      mode: data.mode,
      sourceEvent: source.event,
      targetEvent: target.event,
      source: {
        venues: source.venues,
        tracks: source.tracks,
        trackWorkouts: source.trackWorkouts,
        heats: source.heats,
        shifts: source.shifts,
        deniedCounts: source.deniedCounts,
      },
      targetExistingCounts: target.existingCounts,
    })
    if (!preview.canApply) {
      throw new Error("No empty target setup categories are available to copy")
    }

    const timestamp = new Date()
    const created = {
      venues: 0,
      tracks: 0,
      trackWorkouts: 0,
      heats: 0,
      shifts: 0,
      assumptions: false,
    }
    const venueIdBySourceId = new Map<string, string>()
    const trackIdBySourceId = new Map<string, string>()
    const trackWorkoutIdBySourceId = new Map<string, string>()

    for (const venue of preview.plan.venuesToCreate) {
      const venueId = createCompetitionVenueId()
      venueIdBySourceId.set(venue.sourceVenueId, venueId)
      await tx.insert(competitionVenuesTable).values({
        id: venueId,
        competitionId: target.event.id,
        name: venue.name,
        laneCount: venue.laneCount,
        transitionMinutes: venue.transitionMinutes,
        sortOrder: venue.sortOrder,
        addressId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      created.venues += 1
    }

    for (const track of preview.plan.tracksToCreate) {
      const trackId = createProgrammingTrackId()
      trackIdBySourceId.set(track.sourceTrackId, trackId)
      await tx.insert(programmingTracksTable).values({
        id: trackId,
        name: track.name,
        description: track.description,
        type: track.type,
        ownerTeamId: target.event.organizingTeamId,
        scalingGroupId: null,
        isPublic: 0,
        competitionId: target.event.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      created.tracks += 1
    }

    for (const trackWorkout of preview.plan.trackWorkoutsToCreate) {
      trackWorkoutIdBySourceId.set(
        trackWorkout.sourceTrackWorkoutId,
        createTrackWorkoutId(),
      )
    }

    for (const trackWorkout of preview.plan.trackWorkoutsToCreate) {
      const trackId = trackIdBySourceId.get(trackWorkout.trackId)
      if (!trackId) continue

      const workoutId = `workout_${createTrackWorkoutId().slice("trwk_".length)}`
      const trackWorkoutId = trackWorkoutIdBySourceId.get(
        trackWorkout.sourceTrackWorkoutId,
      )
      if (!trackWorkoutId) continue

      const workoutValues: NewWorkout = {
        id: workoutId,
        name: trackWorkout.workoutName,
        description: trackWorkout.workoutDescription,
        scope: "private",
        scheme: trackWorkout.workoutScheme as NewWorkout["scheme"],
        scoreType: trackWorkout.workoutScoreType as NewWorkout["scoreType"],
        repsPerRound: trackWorkout.workoutRepsPerRound,
        roundsToScore: trackWorkout.workoutRoundsToScore,
        teamId: target.event.organizingTeamId,
        tiebreakScheme:
          trackWorkout.workoutTiebreakScheme as NewWorkout["tiebreakScheme"],
        timeCap: trackWorkout.workoutTimeCap,
        sourceWorkoutId: trackWorkout.workoutId,
        scalingGroupId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await tx.insert(workouts).values(workoutValues)

      const trackWorkoutValues: NewTrackWorkout = {
        id: trackWorkoutId,
        trackId,
        workoutId,
        parentEventId: trackWorkout.sourceParentEventId
          ? (trackWorkoutIdBySourceId.get(trackWorkout.sourceParentEventId) ??
            null)
          : null,
        trackOrder: trackWorkout.trackOrder,
        notes: trackWorkout.notes,
        pointsMultiplier: trackWorkout.pointsMultiplier,
        heatStatus: "draft",
        eventStatus: "draft",
        sponsorId: null,
        defaultHeatsCount: trackWorkout.defaultHeatsCount,
        defaultLaneShiftPattern: trackWorkout.defaultLaneShiftPattern,
        minHeatBuffer: trackWorkout.minHeatBuffer,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await tx.insert(trackWorkoutsTable).values(trackWorkoutValues)
      created.trackWorkouts += 1
    }

    for (const heat of preview.plan.heatsToCreate) {
      const trackWorkoutId = trackWorkoutIdBySourceId.get(
        heat.sourceTrackWorkoutId,
      )
      if (!trackWorkoutId) continue

      await tx.insert(competitionHeatsTable).values({
        id: createCompetitionHeatId(),
        competitionId: target.event.id,
        trackWorkoutId,
        venueId: heat.sourceVenueId
          ? (venueIdBySourceId.get(heat.sourceVenueId) ?? null)
          : null,
        heatNumber: heat.heatNumber,
        scheduledTime: heat.scheduledTime,
        durationMinutes: heat.durationMinutes,
        divisionId: null,
        notes: heat.notes,
        schedulePublishedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      created.heats += 1
    }

    for (const shift of preview.plan.shiftsToCreate) {
      if (!shift.startTime || !shift.endTime) continue
      const shiftValues: NewVolunteerShift = {
        competitionId: target.event.id,
        name: shift.name,
        roleType: shift.roleType as VolunteerRoleType,
        startTime: shift.startTime,
        endTime: shift.endTime,
        location: shift.location,
        capacity: shift.capacity,
        notes: shift.notes,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await tx.insert(volunteerShiftsTable).values(shiftValues)
      created.shifts += 1
    }

    await tx
      .update(crewEventSettingsTable)
      .set({
        settings: serializeCrewCopyPriorEventSettings(
          target.event.settingsText,
          {
            sourceEventId: source.event.id,
            sourceEventName: source.event.name,
            appliedAt: timestamp.toISOString(),
            mode: data.mode,
            assumptionsToWrite: preview.plan.assumptionsToWrite,
            counts: {
              venues: created.venues,
              tracks: created.tracks,
              trackWorkouts: created.trackWorkouts,
              heats: created.heats,
              shifts: created.shifts,
            },
          },
        ),
        updatedAt: timestamp,
      })
      .where(eq(crewEventSettingsTable.competitionId, target.event.id))
    created.assumptions = preview.plan.assumptionsToWrite !== null

    result = {
      success: true,
      preview,
      created,
    }
  })

  if (!result) {
    throw new Error("Copy prior event setup did not complete")
  }

  return result
}

async function buildPreview(
  target: CrewCopyPriorEventSnapshot,
  sourceEventId: string,
  mode: CrewCopyPriorEventApplyMode,
) {
  const source = await loadCopyEventSnapshot(sourceEventId)
  assertEligibleSource(target, source)

  return buildCrewCopyPriorEventPreview({
    mode,
    sourceEvent: source.event,
    targetEvent: target.event,
    source: {
      venues: source.venues,
      tracks: source.tracks,
      trackWorkouts: source.trackWorkouts,
      heats: source.heats,
      shifts: source.shifts,
      deniedCounts: source.deniedCounts,
    },
    targetExistingCounts: target.existingCounts,
  })
}

async function listTeamCopyCandidates(teamId: string) {
  const db = getDb()
  const events = await db
    .select({
      id: competitionsTable.id,
      name: competitionsTable.name,
      organizingTeamId: competitionsTable.organizingTeamId,
      startDate: competitionsTable.startDate,
      endDate: competitionsTable.endDate,
      timezone: competitionsTable.timezone,
      lifecycle: crewEventSettingsTable.lifecycle,
    })
    .from(crewEventSettingsTable)
    .innerJoin(
      competitionsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )
    .where(eq(competitionsTable.organizingTeamId, teamId))
    .orderBy(desc(competitionsTable.startDate), asc(competitionsTable.name))

  return events.map((event) => ({
    ...event,
    timezone: event.timezone ?? DEFAULT_TIMEZONE,
  }))
}

async function loadCopyEventSnapshot(
  eventId: string,
  db: DbClient = getDb(),
  forUpdate = false,
): Promise<CrewCopyPriorEventSnapshot> {
  const eventQuery = db
    .select({
      id: competitionsTable.id,
      name: competitionsTable.name,
      organizingTeamId: competitionsTable.organizingTeamId,
      competitionTeamId: competitionsTable.competitionTeamId,
      startDate: competitionsTable.startDate,
      endDate: competitionsTable.endDate,
      timezone: competitionsTable.timezone,
      settingsText: crewEventSettingsTable.settings,
      lifecycle: crewEventSettingsTable.lifecycle,
    })
    .from(crewEventSettingsTable)
    .innerJoin(
      competitionsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )
    .where(eq(crewEventSettingsTable.competitionId, eventId))
    .limit(1)

  const [event] = forUpdate ? await eventQuery.for("update") : await eventQuery
  if (!event) {
    throw new Error("Crew event not found")
  }

  const [venues, tracks, trackWorkouts, heats, shifts] = await Promise.all([
    loadVenues(db, event.id),
    loadTracks(db, event.id),
    loadTrackWorkouts(db, event.id),
    loadHeats(db, event.id),
    loadShifts(db, event.id),
  ])

  return {
    event: {
      ...event,
      timezone: event.timezone ?? DEFAULT_TIMEZONE,
    },
    venues,
    tracks,
    trackWorkouts,
    heats,
    shifts,
    existingCounts: {
      venues: venues.length,
      tracks: tracks.length,
      heats: heats.length,
      shifts: shifts.length,
    },
    deniedCounts: await loadDeniedCounts(db, event.id, event.competitionTeamId),
  }
}

async function loadVenues(db: DbClient, eventId: string) {
  return await db
    .select({
      id: competitionVenuesTable.id,
      name: competitionVenuesTable.name,
      laneCount: competitionVenuesTable.laneCount,
      transitionMinutes: competitionVenuesTable.transitionMinutes,
      sortOrder: competitionVenuesTable.sortOrder,
    })
    .from(competitionVenuesTable)
    .where(eq(competitionVenuesTable.competitionId, eventId))
    .orderBy(
      asc(competitionVenuesTable.sortOrder),
      asc(competitionVenuesTable.id),
    )
}

async function loadTracks(db: DbClient, eventId: string) {
  return await db
    .select({
      id: programmingTracksTable.id,
      name: programmingTracksTable.name,
      description: programmingTracksTable.description,
      type: programmingTracksTable.type,
      scalingGroupId: programmingTracksTable.scalingGroupId,
      isPublic: programmingTracksTable.isPublic,
    })
    .from(programmingTracksTable)
    .where(eq(programmingTracksTable.competitionId, eventId))
    .orderBy(asc(programmingTracksTable.name), asc(programmingTracksTable.id))
}

async function loadTrackWorkouts(db: DbClient, eventId: string) {
  const rows = await db
    .select({
      id: trackWorkoutsTable.id,
      trackId: trackWorkoutsTable.trackId,
      workoutId: trackWorkoutsTable.workoutId,
      workoutName: workouts.name,
      workoutDescription: workouts.description,
      workoutScope: workouts.scope,
      workoutScheme: workouts.scheme,
      workoutScoreType: workouts.scoreType,
      workoutRepsPerRound: workouts.repsPerRound,
      workoutRoundsToScore: workouts.roundsToScore,
      workoutTiebreakScheme: workouts.tiebreakScheme,
      workoutTimeCap: workouts.timeCap,
      workoutScalingGroupId: workouts.scalingGroupId,
      parentEventId: trackWorkoutsTable.parentEventId,
      trackOrder: trackWorkoutsTable.trackOrder,
      notes: trackWorkoutsTable.notes,
      pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
      defaultHeatsCount: trackWorkoutsTable.defaultHeatsCount,
      defaultLaneShiftPattern: trackWorkoutsTable.defaultLaneShiftPattern,
      minHeatBuffer: trackWorkoutsTable.minHeatBuffer,
    })
    .from(trackWorkoutsTable)
    .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
    .innerJoin(
      programmingTracksTable,
      eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
    )
    .where(eq(programmingTracksTable.competitionId, eventId))
    .orderBy(asc(trackWorkoutsTable.trackOrder), asc(trackWorkoutsTable.id))

  return rows.map((row) => ({
    ...row,
    trackOrder: Number(row.trackOrder),
  }))
}

async function loadHeats(db: DbClient, eventId: string) {
  return await db
    .select({
      id: competitionHeatsTable.id,
      trackWorkoutId: competitionHeatsTable.trackWorkoutId,
      venueId: competitionHeatsTable.venueId,
      heatNumber: competitionHeatsTable.heatNumber,
      scheduledTime: competitionHeatsTable.scheduledTime,
      durationMinutes: competitionHeatsTable.durationMinutes,
      notes: competitionHeatsTable.notes,
    })
    .from(competitionHeatsTable)
    .where(eq(competitionHeatsTable.competitionId, eventId))
    .orderBy(
      asc(competitionHeatsTable.trackWorkoutId),
      asc(competitionHeatsTable.heatNumber),
    )
}

async function loadShifts(db: DbClient, eventId: string) {
  return await db
    .select({
      id: volunteerShiftsTable.id,
      name: volunteerShiftsTable.name,
      roleType: volunteerShiftsTable.roleType,
      startTime: volunteerShiftsTable.startTime,
      endTime: volunteerShiftsTable.endTime,
      location: volunteerShiftsTable.location,
      capacity: volunteerShiftsTable.capacity,
      notes: volunteerShiftsTable.notes,
    })
    .from(volunteerShiftsTable)
    .where(eq(volunteerShiftsTable.competitionId, eventId))
    .orderBy(asc(volunteerShiftsTable.startTime), asc(volunteerShiftsTable.id))
}

async function loadDeniedCounts(
  db: DbClient,
  eventId: string,
  competitionTeamId: string,
): Promise<CrewCopyPriorEventDeniedCounts> {
  const heatIds = (
    await db
      .select({ id: competitionHeatsTable.id })
      .from(competitionHeatsTable)
      .where(eq(competitionHeatsTable.competitionId, eventId))
  ).map((heat) => heat.id)

  const [
    invitations,
    memberships,
    registrations,
    imports,
    broadcasts,
    rotations,
    judgeAssignments,
    heatLaneAssignments,
  ] = await Promise.all([
    readCount(
      db
        .select({ value: count() })
        .from(teamInvitationTable)
        .where(eq(teamInvitationTable.teamId, competitionTeamId)),
    ),
    readCount(
      db
        .select({ value: count() })
        .from(teamMembershipTable)
        .where(eq(teamMembershipTable.teamId, competitionTeamId)),
    ),
    readCount(
      db
        .select({ value: count() })
        .from(competitionRegistrationsTable)
        .where(eq(competitionRegistrationsTable.eventId, eventId)),
    ),
    readCount(
      db
        .select({ value: count() })
        .from(crewImportsTable)
        .where(eq(crewImportsTable.competitionId, eventId)),
    ),
    readCount(
      db
        .select({ value: count() })
        .from(competitionBroadcastsTable)
        .where(eq(competitionBroadcastsTable.competitionId, eventId)),
    ),
    readCount(
      db
        .select({ value: count() })
        .from(competitionJudgeRotationsTable)
        .where(eq(competitionJudgeRotationsTable.competitionId, eventId)),
    ),
    heatIds.length > 0
      ? readCount(
          db
            .select({ value: count() })
            .from(judgeHeatAssignmentsTable)
            .where(inArray(judgeHeatAssignmentsTable.heatId, heatIds)),
        )
      : 0,
    heatIds.length > 0
      ? readCount(
          db
            .select({ value: count() })
            .from(competitionHeatAssignmentsTable)
            .where(inArray(competitionHeatAssignmentsTable.heatId, heatIds)),
        )
      : 0,
  ])

  return {
    volunteerIdentities: invitations + memberships,
    judgeAssignments: rotations + judgeAssignments + heatLaneAssignments,
    imports,
    payments: registrations,
    messages: broadcasts,
  }
}

async function readCount(query: Promise<Array<{ value: number }>>) {
  const [row] = await query
  return Number(row?.value ?? 0)
}

function snapshotToCandidate(
  snapshot: CrewCopyPriorEventSnapshot,
): CrewCopyPriorEventCandidate {
  return {
    id: snapshot.event.id,
    name: snapshot.event.name,
    organizingTeamId: snapshot.event.organizingTeamId,
    startDate: snapshot.event.startDate,
    endDate: snapshot.event.endDate,
    timezone: snapshot.event.timezone,
    lifecycle: snapshot.event.lifecycle,
  }
}

function assertEligibleSource(
  target: CrewCopyPriorEventSnapshot,
  source: CrewCopyPriorEventSnapshot,
) {
  if (source.event.id === target.event.id) {
    throw new Error("Choose a different source event")
  }
  if (source.event.organizingTeamId !== target.event.organizingTeamId) {
    throw new Error("Source event is not owned by the same organizing team")
  }
  if (
    target.event.startDate &&
    source.event.startDate &&
    source.event.startDate >= target.event.startDate
  ) {
    throw new Error("Source event must be earlier than the target event")
  }
  if (source.event.lifecycle === "archived") {
    throw new Error("Archived Crew events cannot be copied")
  }
}
