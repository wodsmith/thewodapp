// @lat: [[crew#Judge Rotations]]
import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { getDb } from "../db"
import {
  competitionHeatAssignmentsTable,
  competitionHeatsTable,
  competitionJudgeRotationsTable,
  competitionsTable,
  competitionVenuesTable,
  crewEventSettingsTable,
  judgeAssignmentVersionsTable,
  judgeHeatAssignmentsTable,
  programmingTracksTable,
  trackWorkoutsTable,
  userTable,
  workouts,
} from "../db/schema"
import { createJudgeRotationId } from "../db/schemas/common"
import {
  LANE_SHIFT_PATTERN,
  type LaneShiftPattern,
  VOLUNTEER_ROLE_TYPES,
  type VolunteerAvailability,
  type VolunteerRoleType,
} from "../db/schemas/volunteers"
import {
  assertCrewJudgeRotationReplacementAllowed,
  type CrewJudgeRotationDraft,
  type CrewJudgeRotationHeat,
  expandCrewJudgeRotationDrafts,
  getCrewJudgeHeatLaneCount,
  getCrewJudgeRotationLane,
  hasCrewJudgeRotationErrors,
  isCrewJudgeEligible,
  validateCrewJudgeRotationDrafts,
} from "../lib/crew/judge-rotations"
import {
  type CrewRosterVolunteer,
  getCrewRosterAssigneeId,
  isCrewRosterVolunteerStaffable,
} from "../lib/crew/roster-shifts"
import { loadCrewRoster } from "./crew-roster-shift.server"
import { getSessionFromCookie } from "../utils/auth"
import { requireCrewEventManagerAccess } from "./crew-auth.server"
import {
  type MaterializedJudgeAssignmentForVersion,
  publishMaterializedJudgeAssignmentsVersion,
} from "./judge-assignment-versioning.server"

type DbClient = ReturnType<typeof getDb>
type RotationQueryDb = Pick<DbClient, "select" | "query">
type CompetitionJudgeRotation =
  typeof competitionJudgeRotationsTable.$inferSelect
type JudgeAssignmentVersion = typeof judgeAssignmentVersionsTable.$inferSelect
type CrewJudgeHeatRow = {
  id: string
  trackWorkoutId: string
  heatNumber: number
  scheduledTime: Date | null
  durationMinutes: number | null
  venueName: string | null
  venueLaneCount: number | null
}
type CrewJudgeHeatLaneAssignmentRow = {
  heatId: string
  laneNumber: number | null
}

export interface CrewJudgeEvent {
  id: string
  name: string
  slug: string
  organizingTeamId: string
  competitionTeamId: string
  startDate: string
  endDate: string
  timezone: string | null
  competitionType: "in-person" | "online"
}

export interface CrewJudgeWorkout {
  id: string
  trackOrder: number
  eventStatus: string | null
  heatStatus: string | null
  defaultHeatsCount: number | null
  defaultLaneShiftPattern: LaneShiftPattern | null
  minHeatBuffer: number | null
  workout: {
    id: string
    name: string
  }
}

export interface CrewJudgeHeat extends CrewJudgeRotationHeat {
  id: string
  trackWorkoutId: string
  scheduledTime: Date | null
  durationMinutes: number | null
  venueName: string | null
  occupiedLanes: number[]
}

export interface CrewJudgeVolunteer {
  /**
   * Canonical assignee id used to key this judge across the grid and the
   * rotation / assignment data layer. For account-backed volunteers this is the
   * membership id (tmem_); for invitation-based (imported / manual) volunteers
   * it is the invitation id (tinv_). Kept named `membershipId` so the existing
   * grid components, which key judges by `membershipId`, work unchanged.
   */
  membershipId: string
  source: CrewRosterVolunteer["source"]
  sourceId: string
  invitationId: string | null
  userId: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  avatar: string | null
  volunteerRoleTypes: VolunteerRoleType[]
  credentials?: string
  availability?: VolunteerAvailability
  availabilityNotes?: string
}

export interface CrewJudgeHeatAssignment {
  id: string
  heatId: string
  trackWorkoutId: string
  heatNumber: number
  // Canonical assignee id (membership id or invitation id) for this assignment.
  membershipId: string
  invitationId: string | null
  rotationId: string | null
  versionId: string | null
  laneNumber: number | null
  position: VolunteerRoleType | null
  isManualOverride: boolean
  volunteer: CrewJudgeVolunteer | null
}

export interface CrewJudgeAssignmentVersion {
  id: string
  trackWorkoutId: string
  version: number
  publishedAt: Date
  publishedBy: string | null
  notes: string | null
  isActive: boolean
  publisherName: string | null
}

export interface CrewJudgeRotationsPageData {
  event: CrewJudgeEvent
  workouts: CrewJudgeWorkout[]
  heats: CrewJudgeHeat[]
  judges: CrewJudgeVolunteer[]
  rotations: CompetitionJudgeRotation[]
  activeAssignments: CrewJudgeHeatAssignment[]
  versionHistoryByWorkout: Record<string, CrewJudgeAssignmentVersion[]>
  activeVersionByWorkout: Record<string, CrewJudgeAssignmentVersion | null>
}

export interface SaveCrewJudgeRotationsInput {
  eventId: string
  trackWorkoutId: string
  membershipId: string
  laneShiftPattern: LaneShiftPattern
  rotations: Array<{
    startingHeat: number
    startingLane: number
    heatsCount: number
    notes?: string | null
  }>
}

export interface PublishCrewJudgeRotationsInput {
  eventId: string
  trackWorkoutId: string
  notes?: string | null
}

export async function getCrewJudgeRotationsPage(data: {
  eventId: string
}): Promise<{ page: CrewJudgeRotationsPageData }> {
  const event = await requireCrewJudgeEvent(data.eventId)
  await requireCrewEventManagerAccess(event, "Crew judge rotations")
  const [workoutsForEvent, heats, judges] = await Promise.all([
    loadCrewJudgeWorkouts(event.id),
    loadCrewJudgeHeats(event.id),
    loadCrewJudgeVolunteers(event.competitionTeamId),
  ])
  const trackWorkoutIds = workoutsForEvent.map((workout) => workout.id)
  const [rotations, versions] = await Promise.all([
    loadCrewJudgeRotations(trackWorkoutIds),
    loadCrewJudgeAssignmentVersions(trackWorkoutIds),
  ])
  const activeAssignments = await loadCrewJudgeActiveAssignments(
    versions.filter((version) => version.isActive).map((version) => version.id),
    judges,
  )
  const versionHistoryByWorkout = groupVersionsByWorkout(
    trackWorkoutIds,
    versions,
  )
  const activeVersionByWorkout = Object.fromEntries(
    trackWorkoutIds.map((trackWorkoutId) => [
      trackWorkoutId,
      versionHistoryByWorkout[trackWorkoutId]?.find(
        (version) => version.isActive,
      ) ?? null,
    ]),
  )

  return {
    page: {
      event,
      workouts: workoutsForEvent,
      heats,
      judges,
      rotations,
      activeAssignments,
      versionHistoryByWorkout,
      activeVersionByWorkout,
    },
  }
}

export async function saveCrewJudgeRotationsForVolunteer(
  data: SaveCrewJudgeRotationsInput,
) {
  const db = getDb()
  const event = await requireCrewJudgeEvent(data.eventId)
  await requireCrewEventManagerAccess(event, "Crew judge rotations")
  await requireCrewJudgeWorkout(event.id, data.trackWorkoutId)
  await requireCrewJudgeAssignee(event.competitionTeamId, data.membershipId)
  const assigneeColumns = toJudgeAssigneeColumns(data.membershipId)

  const normalizedRotations = data.rotations.map((rotation) => ({
    membershipId: data.membershipId,
    startingHeat: rotation.startingHeat,
    startingLane: rotation.startingLane,
    heatsCount: rotation.heatsCount,
    laneShiftPattern: data.laneShiftPattern,
    notes: normalizeOptionalText(rotation.notes),
  }))

  if (normalizedRotations.length > 0) {
    const heats = (await loadCrewJudgeHeats(event.id)).filter(
      (heat) => heat.trackWorkoutId === data.trackWorkoutId,
    )
    const otherRotations = await db
      .select()
      .from(competitionJudgeRotationsTable)
      .where(
        eq(competitionJudgeRotationsTable.trackWorkoutId, data.trackWorkoutId),
      )
    const occupiedSlots = expandCrewJudgeRotationDrafts({
      heats,
      // Treat every other judge's rotation as occupied; exclude this judge's own
      // rows (matched by canonical assignee id) so re-saving doesn't self-block.
      rotations: otherRotations
        .filter(
          (rotation) =>
            getRotationAssigneeId(rotation) !== data.membershipId,
        )
        .map(toCrewJudgeRotationDraft),
    })
    const issues = validateCrewJudgeRotationDrafts({
      heats,
      occupiedSlots,
      rotations: normalizedRotations.map((rotation) => ({
        membershipId: rotation.membershipId,
        startingHeat: rotation.startingHeat,
        startingLane: rotation.startingLane,
        heatsCount: rotation.heatsCount,
        laneShiftPattern: rotation.laneShiftPattern,
      })),
    })

    if (hasCrewJudgeRotationErrors(issues)) {
      throw new Error(
        issues
          .filter((issue) => issue.severity === "error")
          .map((issue) => issue.message)
          .join(" "),
      )
    }
  }

  await db.transaction(async (tx) => {
    const existingRotations = await tx
      .select({ id: competitionJudgeRotationsTable.id })
      .from(competitionJudgeRotationsTable)
      .where(
        and(
          eq(
            competitionJudgeRotationsTable.trackWorkoutId,
            data.trackWorkoutId,
          ),
          assigneeColumns.invitationId
            ? eq(
                competitionJudgeRotationsTable.invitationId,
                assigneeColumns.invitationId,
              )
            : eq(
                competitionJudgeRotationsTable.membershipId,
                assigneeColumns.membershipId ?? "",
              ),
        ),
      )

    const existingRotationIds = existingRotations.map((rotation) => rotation.id)
    if (existingRotationIds.length > 0) {
      const assignmentReferences = await tx
        .select({ id: judgeHeatAssignmentsTable.id })
        .from(judgeHeatAssignmentsTable)
        .where(
          inArray(judgeHeatAssignmentsTable.rotationId, existingRotationIds),
        )
        .limit(1)

      assertCrewJudgeRotationReplacementAllowed({
        assignmentReferenceCount: assignmentReferences.length,
      })

      await tx
        .delete(competitionJudgeRotationsTable)
        .where(inArray(competitionJudgeRotationsTable.id, existingRotationIds))
    }

    if (normalizedRotations.length > 0) {
      await tx.insert(competitionJudgeRotationsTable).values(
        normalizedRotations.map((rotation) => ({
          id: createJudgeRotationId(),
          competitionId: event.id,
          trackWorkoutId: data.trackWorkoutId,
          membershipId: assigneeColumns.membershipId,
          invitationId: assigneeColumns.invitationId,
          startingHeat: rotation.startingHeat,
          startingLane: rotation.startingLane,
          heatsCount: rotation.heatsCount,
          laneShiftPattern: rotation.laneShiftPattern,
          notes: rotation.notes,
        })),
      )
    }
  })

  return {
    success: true,
    rotations: await loadCrewJudgeRotations([data.trackWorkoutId]),
  }
}

export async function publishCrewJudgeRotations(
  data: PublishCrewJudgeRotationsInput,
): Promise<{ version: JudgeAssignmentVersion }> {
  const db = getDb()
  const event = await requireCrewJudgeEvent(data.eventId)
  await requireCrewEventManagerAccess(event, "Crew judge rotations")
  await requireCrewJudgeWorkout(event.id, data.trackWorkoutId)
  await assertCrewJudgeRotationsPublishable(event.id, data.trackWorkoutId)
  const session = await getSessionFromCookie().catch(() => null)
  const version = await publishMaterializedJudgeAssignmentsVersion(
    db,
    {
      trackWorkoutId: data.trackWorkoutId,
      publishedBy: session?.userId ?? null,
      notes: normalizeOptionalText(data.notes),
    },
    (tx) => materializeCrewJudgeRotations(tx, data.trackWorkoutId),
  )

  return { version }
}

async function requireCrewJudgeEvent(eventId: string): Promise<CrewJudgeEvent> {
  const db = getDb()
  const [event] = await db
    .select({
      id: competitionsTable.id,
      name: competitionsTable.name,
      slug: competitionsTable.slug,
      organizingTeamId: competitionsTable.organizingTeamId,
      competitionTeamId: competitionsTable.competitionTeamId,
      startDate: competitionsTable.startDate,
      endDate: competitionsTable.endDate,
      timezone: competitionsTable.timezone,
      competitionType: competitionsTable.competitionType,
    })
    .from(crewEventSettingsTable)
    .innerJoin(
      competitionsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )
    .where(eq(crewEventSettingsTable.competitionId, eventId))
    .limit(1)

  if (!event) {
    throw new Error("Crew event not found")
  }

  if (!event.competitionTeamId) {
    throw new Error("Crew event does not have a competition team")
  }

  return {
    ...event,
    competitionTeamId: event.competitionTeamId,
  }
}

async function requireCrewJudgeWorkout(
  eventId: string,
  trackWorkoutId: string,
) {
  const db = getDb()
  const [workout] = await db
    .select({ id: trackWorkoutsTable.id })
    .from(trackWorkoutsTable)
    .innerJoin(
      programmingTracksTable,
      eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
    )
    .where(
      and(
        eq(trackWorkoutsTable.id, trackWorkoutId),
        eq(programmingTracksTable.competitionId, eventId),
      ),
    )
    .limit(1)

  if (!workout) {
    throw new Error("Judge rotation workout not found for this Crew event")
  }
}

/**
 * Validate that a canonical assignee id (membership tmem_ or invitation tinv_)
 * resolves to a judge-eligible, staffable volunteer on this event's competition
 * team. Resolves against the same roster the grid is built from so invitation-
 * based (imported / manual) judges are accepted just like membership-based ones.
 */
async function requireCrewJudgeAssignee(
  competitionTeamId: string,
  assigneeId: string,
) {
  const judges = await loadCrewJudgeVolunteers(competitionTeamId)
  const judge = judges.find((volunteer) => volunteer.membershipId === assigneeId)

  if (!judge) {
    throw new Error("Selected volunteer is not an eligible judge")
  }
}

async function loadCrewJudgeWorkouts(
  eventId: string,
): Promise<CrewJudgeWorkout[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: trackWorkoutsTable.id,
      trackOrder: trackWorkoutsTable.trackOrder,
      eventStatus: trackWorkoutsTable.eventStatus,
      heatStatus: trackWorkoutsTable.heatStatus,
      defaultHeatsCount: trackWorkoutsTable.defaultHeatsCount,
      defaultLaneShiftPattern: trackWorkoutsTable.defaultLaneShiftPattern,
      minHeatBuffer: trackWorkoutsTable.minHeatBuffer,
      workoutId: workouts.id,
      workoutName: workouts.name,
    })
    .from(trackWorkoutsTable)
    .innerJoin(
      programmingTracksTable,
      eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
    )
    .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
    .where(eq(programmingTracksTable.competitionId, eventId))
    .orderBy(asc(trackWorkoutsTable.trackOrder))

  return rows.map((row) => ({
    id: row.id,
    trackOrder: row.trackOrder,
    eventStatus: row.eventStatus,
    heatStatus: row.heatStatus,
    defaultHeatsCount: row.defaultHeatsCount,
    defaultLaneShiftPattern: row.defaultLaneShiftPattern as LaneShiftPattern,
    minHeatBuffer: row.minHeatBuffer,
    workout: {
      id: row.workoutId,
      name: row.workoutName,
    },
  }))
}

async function loadCrewJudgeHeats(eventId: string): Promise<CrewJudgeHeat[]> {
  const db = getDb()
  const heatRows = await db
    .select({
      id: competitionHeatsTable.id,
      trackWorkoutId: competitionHeatsTable.trackWorkoutId,
      heatNumber: competitionHeatsTable.heatNumber,
      scheduledTime: competitionHeatsTable.scheduledTime,
      durationMinutes: competitionHeatsTable.durationMinutes,
      venueName: competitionVenuesTable.name,
      venueLaneCount: competitionVenuesTable.laneCount,
    })
    .from(competitionHeatsTable)
    .leftJoin(
      competitionVenuesTable,
      eq(competitionHeatsTable.venueId, competitionVenuesTable.id),
    )
    .where(eq(competitionHeatsTable.competitionId, eventId))
    .orderBy(
      asc(competitionHeatsTable.trackWorkoutId),
      asc(competitionHeatsTable.heatNumber),
    )

  const heatAssignmentRows = await loadCrewJudgeHeatLaneAssignments(
    db,
    heatRows.map((heat) => heat.id),
  )

  return toCrewJudgeHeats(heatRows, heatAssignmentRows)
}

/**
 * Load the judge roster for an event's competition team. Built from the same
 * union of team memberships AND team invitations the shift roster uses, so
 * imported / manually-added volunteers (stored as invitations, often without a
 * user account) appear alongside account-backed volunteers. Filtered to
 * judge-eligible role types (judge / head_judge / general — see
 * {@link isCrewJudgeEligible}) and to staffable statuses, then mapped to the
 * grid-facing shape keyed by a canonical assignee id.
 */
async function loadCrewJudgeVolunteers(
  competitionTeamId: string,
): Promise<CrewJudgeVolunteer[]> {
  const roster = await loadCrewRoster(competitionTeamId)

  return roster
    .filter(
      (volunteer) =>
        isCrewRosterVolunteerStaffable(volunteer) &&
        isCrewJudgeEligible(volunteer.roleTypes),
    )
    .map(toCrewJudgeVolunteer)
    .filter((volunteer): volunteer is CrewJudgeVolunteer => volunteer !== null)
    .sort((a, b) => getJudgeName(a).localeCompare(getJudgeName(b)))
}

/**
 * Map a roster volunteer to the grid-facing judge shape. The canonical assignee
 * id (membership id for account-backed, invitation id for imported / manual
 * volunteers) is stored in `membershipId` so the grid keeps keying judges off
 * `membershipId` unchanged. Returns null if the volunteer has no usable id.
 */
function toCrewJudgeVolunteer(
  volunteer: CrewRosterVolunteer,
): CrewJudgeVolunteer | null {
  const assigneeId = getCrewRosterAssigneeId(volunteer)
  if (!assigneeId) return null

  return {
    membershipId: assigneeId,
    source: volunteer.source,
    sourceId: volunteer.sourceId,
    invitationId: volunteer.invitationId,
    userId: null,
    // The roster collapses first/last name into a single display name; carry it
    // in firstName so getJudgeName / getCrewJudgeName render it unchanged.
    firstName: volunteer.name || null,
    lastName: null,
    email: volunteer.email || null,
    avatar: null,
    volunteerRoleTypes: volunteer.roleTypes,
    credentials: volunteer.credentials ?? undefined,
    availability: volunteer.availability ?? undefined,
    availabilityNotes: volunteer.availabilityNotes ?? undefined,
  }
}

async function loadCrewJudgeRotations(trackWorkoutIds: string[]) {
  if (trackWorkoutIds.length === 0) return []

  const db = getDb()
  return db.query.competitionJudgeRotationsTable.findMany({
    where: inArray(
      competitionJudgeRotationsTable.trackWorkoutId,
      trackWorkoutIds,
    ),
    orderBy: [
      asc(competitionJudgeRotationsTable.trackWorkoutId),
      asc(competitionJudgeRotationsTable.startingHeat),
      asc(competitionJudgeRotationsTable.startingLane),
    ],
  })
}

async function loadCrewJudgeAssignmentVersions(trackWorkoutIds: string[]) {
  if (trackWorkoutIds.length === 0) return []

  const db = getDb()
  const rows = await db
    .select({
      id: judgeAssignmentVersionsTable.id,
      trackWorkoutId: judgeAssignmentVersionsTable.trackWorkoutId,
      version: judgeAssignmentVersionsTable.version,
      publishedAt: judgeAssignmentVersionsTable.publishedAt,
      publishedBy: judgeAssignmentVersionsTable.publishedBy,
      notes: judgeAssignmentVersionsTable.notes,
      isActive: judgeAssignmentVersionsTable.isActive,
      publisherFirstName: userTable.firstName,
      publisherLastName: userTable.lastName,
      publisherEmail: userTable.email,
    })
    .from(judgeAssignmentVersionsTable)
    .leftJoin(
      userTable,
      eq(judgeAssignmentVersionsTable.publishedBy, userTable.id),
    )
    .where(
      inArray(judgeAssignmentVersionsTable.trackWorkoutId, trackWorkoutIds),
    )
    .orderBy(
      asc(judgeAssignmentVersionsTable.trackWorkoutId),
      desc(judgeAssignmentVersionsTable.version),
    )

  return rows.map((row): CrewJudgeAssignmentVersion => {
    const publisherName = [row.publisherFirstName, row.publisherLastName]
      .filter(Boolean)
      .join(" ")

    return {
      id: row.id,
      trackWorkoutId: row.trackWorkoutId,
      version: row.version,
      publishedAt: row.publishedAt,
      publishedBy: row.publishedBy,
      notes: row.notes,
      isActive: row.isActive,
      publisherName: publisherName || row.publisherEmail || null,
    }
  })
}

async function loadCrewJudgeActiveAssignments(
  activeVersionIds: string[],
  judges: CrewJudgeVolunteer[],
): Promise<CrewJudgeHeatAssignment[]> {
  if (activeVersionIds.length === 0) return []

  const db = getDb()
  const rows = await db
    .select({
      id: judgeHeatAssignmentsTable.id,
      heatId: judgeHeatAssignmentsTable.heatId,
      trackWorkoutId: competitionHeatsTable.trackWorkoutId,
      heatNumber: competitionHeatsTable.heatNumber,
      membershipId: judgeHeatAssignmentsTable.membershipId,
      invitationId: judgeHeatAssignmentsTable.invitationId,
      rotationId: judgeHeatAssignmentsTable.rotationId,
      versionId: judgeHeatAssignmentsTable.versionId,
      laneNumber: judgeHeatAssignmentsTable.laneNumber,
      position: judgeHeatAssignmentsTable.position,
      isManualOverride: judgeHeatAssignmentsTable.isManualOverride,
    })
    .from(judgeHeatAssignmentsTable)
    .innerJoin(
      competitionHeatsTable,
      eq(judgeHeatAssignmentsTable.heatId, competitionHeatsTable.id),
    )
    .where(inArray(judgeHeatAssignmentsTable.versionId, activeVersionIds))
    .orderBy(
      asc(competitionHeatsTable.trackWorkoutId),
      asc(competitionHeatsTable.heatNumber),
      asc(judgeHeatAssignmentsTable.laneNumber),
    )
  const judgeByAssigneeId = new Map(
    judges.map((judge) => [judge.membershipId, judge]),
  )

  return rows.map((row) => {
    // The assignment references either a membership or an invitation; resolve
    // the canonical assignee id to look the judge up in the roster.
    const assigneeId = row.membershipId ?? row.invitationId ?? ""
    return {
      ...row,
      membershipId: assigneeId,
      volunteer: judgeByAssigneeId.get(assigneeId) ?? null,
    }
  })
}

function groupVersionsByWorkout(
  trackWorkoutIds: string[],
  versions: CrewJudgeAssignmentVersion[],
) {
  const grouped: Record<string, CrewJudgeAssignmentVersion[]> =
    Object.fromEntries(
      trackWorkoutIds.map((trackWorkoutId) => [trackWorkoutId, []]),
    )

  for (const version of versions) {
    grouped[version.trackWorkoutId]?.push(version)
  }

  return grouped
}

async function assertCrewJudgeRotationsPublishable(
  eventId: string,
  trackWorkoutId: string,
) {
  const [heats, rotations] = await Promise.all([
    loadCrewJudgeHeats(eventId),
    loadCrewJudgeRotations([trackWorkoutId]),
  ])
  const eventHeats = heats.filter(
    (heat) => heat.trackWorkoutId === trackWorkoutId,
  )
  const issues = validateCrewJudgeRotationDrafts({
    heats: eventHeats,
    rotations: rotations.map(toCrewJudgeRotationDraft),
  })

  if (hasCrewJudgeRotationErrors(issues)) {
    throw new Error(
      issues
        .filter((issue) => issue.severity === "error")
        .map((issue) => issue.message)
        .join(" "),
    )
  }
}

async function materializeCrewJudgeRotations(
  db: RotationQueryDb,
  trackWorkoutId: string,
): Promise<MaterializedJudgeAssignmentForVersion[]> {
  const [heats, rotations] = await Promise.all([
    loadCrewJudgeHeatsForTrackWorkout(db, trackWorkoutId),
    db.query.competitionJudgeRotationsTable.findMany({
      where: eq(competitionJudgeRotationsTable.trackWorkoutId, trackWorkoutId),
    }),
  ])
  const heatByNumber = new Map(heats.map((heat) => [heat.heatNumber, heat]))
  const seen = new Set<string>()
  const assignments: MaterializedJudgeAssignmentForVersion[] = []

  for (const rotation of rotations) {
    for (let heatIndex = 0; heatIndex < rotation.heatsCount; heatIndex++) {
      const heatNumber = rotation.startingHeat + heatIndex
      const heat = heatByNumber.get(heatNumber)
      if (!heat) continue

      const laneNumber = getCrewJudgeRotationLane({
        startingLane: rotation.startingLane,
        heatIndex,
        laneCount: heat.laneCount,
        laneShiftPattern: rotation.laneShiftPattern,
      })
      if (laneNumber < 1 || laneNumber > heat.laneCount) continue

      const assigneeId = getRotationAssigneeId(rotation)
      const key = `${heat.id}:${assigneeId}`
      if (seen.has(key)) continue
      seen.add(key)

      assignments.push({
        heatId: heat.id,
        membershipId: rotation.membershipId,
        invitationId: rotation.invitationId,
        rotationId: rotation.id,
        laneNumber,
        position: VOLUNTEER_ROLE_TYPES.JUDGE,
      })
    }
  }

  return assignments
}

async function loadCrewJudgeHeatsForTrackWorkout(
  db: RotationQueryDb,
  trackWorkoutId: string,
): Promise<CrewJudgeHeat[]> {
  const heatRows = await db
    .select({
      id: competitionHeatsTable.id,
      trackWorkoutId: competitionHeatsTable.trackWorkoutId,
      heatNumber: competitionHeatsTable.heatNumber,
      scheduledTime: competitionHeatsTable.scheduledTime,
      durationMinutes: competitionHeatsTable.durationMinutes,
      venueName: competitionVenuesTable.name,
      venueLaneCount: competitionVenuesTable.laneCount,
    })
    .from(competitionHeatsTable)
    .leftJoin(
      competitionVenuesTable,
      eq(competitionHeatsTable.venueId, competitionVenuesTable.id),
    )
    .where(eq(competitionHeatsTable.trackWorkoutId, trackWorkoutId))
    .orderBy(asc(competitionHeatsTable.heatNumber))

  const heatAssignmentRows = await loadCrewJudgeHeatLaneAssignments(
    db,
    heatRows.map((heat) => heat.id),
  )

  return toCrewJudgeHeats(heatRows, heatAssignmentRows)
}

async function loadCrewJudgeHeatLaneAssignments(
  db: Pick<DbClient, "select">,
  heatIds: string[],
): Promise<CrewJudgeHeatLaneAssignmentRow[]> {
  if (heatIds.length === 0) return []

  return db
    .select({
      heatId: competitionHeatAssignmentsTable.heatId,
      laneNumber: competitionHeatAssignmentsTable.laneNumber,
    })
    .from(competitionHeatAssignmentsTable)
    .where(inArray(competitionHeatAssignmentsTable.heatId, heatIds))
}

function toCrewJudgeHeats(
  heatRows: CrewJudgeHeatRow[],
  heatAssignmentRows: CrewJudgeHeatLaneAssignmentRow[],
): CrewJudgeHeat[] {
  const occupiedLanesByHeat = new Map<string, Set<number>>()

  for (const assignment of heatAssignmentRows) {
    if (!assignment.laneNumber) continue
    const lanes = occupiedLanesByHeat.get(assignment.heatId) ?? new Set()
    lanes.add(assignment.laneNumber)
    occupiedLanesByHeat.set(assignment.heatId, lanes)
  }

  return heatRows.map((heat) => {
    const occupiedLanes = Array.from(
      occupiedLanesByHeat.get(heat.id) ?? [],
    ).sort((a, b) => a - b)

    return {
      id: heat.id,
      trackWorkoutId: heat.trackWorkoutId,
      heatNumber: heat.heatNumber,
      scheduledTime: heat.scheduledTime,
      durationMinutes: heat.durationMinutes,
      venueName: heat.venueName,
      laneCount: getCrewJudgeHeatLaneCount({
        venueLaneCount: heat.venueLaneCount,
        occupiedLanes,
      }),
      occupiedLanes,
    }
  })
}

/**
 * Canonical assignee id for a stored rotation: the membership id for account-
 * backed judges, otherwise the invitation id for imported / manual judges.
 */
function getRotationAssigneeId(
  rotation: Pick<CompetitionJudgeRotation, "membershipId" | "invitationId">,
): string {
  return rotation.membershipId ?? rotation.invitationId ?? ""
}

/**
 * Split a canonical assignee id into the membership / invitation columns. An
 * invitation id (tinv_) sets invitationId; anything else is treated as a
 * membership id.
 */
function toJudgeAssigneeColumns(assigneeId: string): {
  membershipId: string | null
  invitationId: string | null
} {
  if (assigneeId.startsWith("tinv_")) {
    return { membershipId: null, invitationId: assigneeId }
  }
  return { membershipId: assigneeId, invitationId: null }
}

function toCrewJudgeRotationDraft(
  rotation: Pick<
    CompetitionJudgeRotation,
    | "id"
    | "membershipId"
    | "invitationId"
    | "startingHeat"
    | "startingLane"
    | "heatsCount"
    | "laneShiftPattern"
  >,
): CrewJudgeRotationDraft {
  return {
    id: rotation.id,
    // Use the canonical assignee id so rotation dedup / lane-conflict checks
    // work uniformly for membership- and invitation-based judges.
    membershipId: getRotationAssigneeId(rotation),
    startingHeat: rotation.startingHeat,
    startingLane: rotation.startingLane,
    heatsCount: rotation.heatsCount,
    laneShiftPattern: rotation.laneShiftPattern,
  }
}

export function getJudgeName(judge: {
  firstName: string | null
  lastName: string | null
  email?: string | null
}) {
  return (
    [judge.firstName, judge.lastName].filter(Boolean).join(" ") ||
    judge.email ||
    "Unknown judge"
  )
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export const CREW_JUDGE_LANE_SHIFT_PATTERNS = [
  LANE_SHIFT_PATTERN.STAY,
  LANE_SHIFT_PATTERN.SHIFT_RIGHT,
] as const
