import { and, asc, desc, eq, exists, inArray, isNotNull, or } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { addressesTable } from "@/db/schemas/addresses"
import {
  competitionBroadcastRecipientsTable,
  competitionBroadcastsTable,
} from "@/db/schemas/broadcasts"
import {
  competitionHeatAssignmentsTable,
  competitionHeatsTable,
  competitionRegistrationsTable,
  competitionsTable,
  competitionVenuesTable,
} from "@/db/schemas/competitions"
import { eventDivisionMappingsTable } from "@/db/schemas/event-division-mappings"
import {
  programmingTracksTable,
  trackWorkoutsTable,
} from "@/db/schemas/programming"
import {
  scalingLevelsTable,
  workoutScalingDescriptionsTable,
} from "@/db/schemas/scaling"
import { teamMembershipTable } from "@/db/schemas/teams"
import { userTable } from "@/db/schemas/users"
import { workouts } from "@/db/schemas/workouts"
import { getCompetitionLeaderboard } from "@/server/competition-leaderboard"
import { getSessionFromBearer } from "@/utils/bearer-auth"
import { parseCompetitionSettings } from "@/utils/competition-settings"
import { deleteKVSession, updateAllSessionsOfUser } from "@/utils/kv-session"

const competitionProjection = {
  id: competitionsTable.id,
  slug: competitionsTable.slug,
  name: competitionsTable.name,
  description: competitionsTable.description,
  startDate: competitionsTable.startDate,
  endDate: competitionsTable.endDate,
  timezone: competitionsTable.timezone,
  competitionType: competitionsTable.competitionType,
  bannerImageUrl: competitionsTable.bannerImageUrl,
  profileImageUrl: competitionsTable.profileImageUrl,
  city: addressesTable.city,
  region: addressesTable.stateProvince,
  address: addressesTable.streetLine1,
}

// @lat: [[gameday#Athlete access]]
export async function getGameDayRegistrations(userId: string) {
  const db = getDb()
  const membership = db
    .select({ id: teamMembershipTable.id })
    .from(teamMembershipTable)
    .where(
      and(
        eq(
          teamMembershipTable.teamId,
          competitionRegistrationsTable.athleteTeamId,
        ),
        eq(teamMembershipTable.userId, userId),
        eq(teamMembershipTable.isActive, true),
      ),
    )
  return db
    .select({
      id: competitionRegistrationsTable.id,
      competitionId: competitionRegistrationsTable.eventId,
      divisionId: competitionRegistrationsTable.divisionId,
      division: scalingLevelsTable.label,
      teamName: competitionRegistrationsTable.teamName,
      status: competitionRegistrationsTable.status,
      checkedInAt: competitionRegistrationsTable.checkedInAt,
      paymentStatus: competitionRegistrationsTable.paymentStatus,
      registeredAt: competitionRegistrationsTable.registeredAt,
    })
    .from(competitionRegistrationsTable)
    .leftJoin(
      scalingLevelsTable,
      eq(competitionRegistrationsTable.divisionId, scalingLevelsTable.id),
    )
    .innerJoin(
      competitionsTable,
      eq(competitionsTable.id, competitionRegistrationsTable.eventId),
    )
    .where(
      and(
        eq(competitionsTable.status, "published"),
        eq(competitionRegistrationsTable.status, "active"),
        or(
          eq(competitionRegistrationsTable.userId, userId),
          exists(membership),
        ),
      ),
    )
}

async function gameDayProfile(userId: string) {
  const [profile] = await getDb()
    .select({
      id: userTable.id,
      firstName: userTable.firstName,
      lastName: userTable.lastName,
      email: userTable.email,
      avatar: userTable.avatar,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1)
  return profile ?? null
}

async function gameDayHome(userId?: string) {
  const registrations = userId ? await getGameDayRegistrations(userId) : []
  const registeredIds = [...new Set(registrations.map((r) => r.competitionId))]
  const competitions = await getDb()
    .select(competitionProjection)
    .from(competitionsTable)
    .leftJoin(
      addressesTable,
      eq(competitionsTable.primaryAddressId, addressesTable.id),
    )
    .where(
      and(
        eq(competitionsTable.status, "published"),
        or(
          eq(competitionsTable.visibility, "public"),
          registeredIds.length
            ? inArray(competitionsTable.id, registeredIds)
            : undefined,
        ),
      ),
    )
    .orderBy(desc(competitionsTable.startDate))
  return {
    competitions,
    registrations,
    profile: userId ? await gameDayProfile(userId) : null,
  }
}

// @lat: [[gameday#Schedules and reminders]]
async function gameDayCompetition(id: string, userId?: string) {
  const db = getDb()
  const [row] = await db
    .select({ ...competitionProjection, settings: competitionsTable.settings })
    .from(competitionsTable)
    .leftJoin(
      addressesTable,
      eq(competitionsTable.primaryAddressId, addressesTable.id),
    )
    .where(
      and(
        eq(competitionsTable.status, "published"),
        or(eq(competitionsTable.id, id), eq(competitionsTable.slug, id)),
      ),
    )
    .limit(1)
  if (!row) return null
  const { settings, ...competition } = row
  const registrations = userId
    ? (await getGameDayRegistrations(userId)).filter(
        (r) => r.competitionId === competition.id,
      )
    : []
  const heats = await db
    .select({
      id: competitionHeatsTable.id,
      eventId: competitionHeatsTable.trackWorkoutId,
      eventName: workouts.name,
      heatNumber: competitionHeatsTable.heatNumber,
      startsAt: competitionHeatsTable.scheduledTime,
      durationMinutes: competitionHeatsTable.durationMinutes,
      venue: competitionVenuesTable.name,
      division: scalingLevelsTable.label,
    })
    .from(competitionHeatsTable)
    .innerJoin(
      trackWorkoutsTable,
      eq(competitionHeatsTable.trackWorkoutId, trackWorkoutsTable.id),
    )
    .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
    .leftJoin(
      competitionVenuesTable,
      eq(competitionHeatsTable.venueId, competitionVenuesTable.id),
    )
    .leftJoin(
      scalingLevelsTable,
      eq(competitionHeatsTable.divisionId, scalingLevelsTable.id),
    )
    .where(
      and(
        eq(competitionHeatsTable.competitionId, competition.id),
        isNotNull(competitionHeatsTable.schedulePublishedAt),
        eq(trackWorkoutsTable.eventStatus, "published"),
      ),
    )
    .orderBy(
      asc(competitionHeatsTable.scheduledTime),
      asc(competitionHeatsTable.heatNumber),
    )
  const assignments =
    registrations.length && heats.length
      ? await db
          .select({
            heatId: competitionHeatAssignmentsTable.heatId,
            registrationId: competitionHeatAssignmentsTable.registrationId,
            lane: competitionHeatAssignmentsTable.laneNumber,
          })
          .from(competitionHeatAssignmentsTable)
          .where(
            and(
              inArray(
                competitionHeatAssignmentsTable.registrationId,
                registrations.map((r) => r.id),
              ),
              inArray(
                competitionHeatAssignmentsTable.heatId,
                heats.map((h) => h.id),
              ),
            ),
          )
      : []
  const events = await db
    .select({
      id: trackWorkoutsTable.id,
      workoutId: workouts.id,
      parentEventId: trackWorkoutsTable.parentEventId,
      name: workouts.name,
      description: workouts.description,
      scheme: workouts.scheme,
      timeCap: workouts.timeCap,
      notes: trackWorkoutsTable.notes,
      order: trackWorkoutsTable.trackOrder,
    })
    .from(trackWorkoutsTable)
    .innerJoin(
      programmingTracksTable,
      eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
    )
    .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
    .where(
      and(
        eq(programmingTracksTable.competitionId, competition.id),
        eq(trackWorkoutsTable.eventStatus, "published"),
      ),
    )
    .orderBy(asc(trackWorkoutsTable.trackOrder))
  const scalingGroupId =
    parseCompetitionSettings(settings)?.divisions?.scalingGroupId
  const divisions =
    scalingGroupId && events.length
      ? await db
          .select({
            id: scalingLevelsTable.id,
            label: scalingLevelsTable.label,
          })
          .from(scalingLevelsTable)
          .where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))
          .orderBy(asc(scalingLevelsTable.position))
      : []
  const descriptions = divisions.length
    ? await db
        .select({
          workoutId: workoutScalingDescriptionsTable.workoutId,
          divisionId: workoutScalingDescriptionsTable.scalingLevelId,
          description: workoutScalingDescriptionsTable.description,
        })
        .from(workoutScalingDescriptionsTable)
        .where(
          and(
            inArray(
              workoutScalingDescriptionsTable.workoutId,
              events.map((event) => event.workoutId),
            ),
            inArray(
              workoutScalingDescriptionsTable.scalingLevelId,
              divisions.map((division) => division.id),
            ),
          ),
        )
    : []
  const mappings = divisions.length
    ? await db
        .select({
          eventId: eventDivisionMappingsTable.trackWorkoutId,
          divisionId: eventDivisionMappingsTable.divisionId,
        })
        .from(eventDivisionMappingsTable)
        .where(eq(eventDivisionMappingsTable.competitionId, competition.id))
    : []
  const publishedWorkouts = events.map(
    ({ workoutId, parentEventId, ...event }) => {
      const assigned = mappings
        .filter((mapping) => mapping.eventId === (parentEventId ?? event.id))
        .map((mapping) => mapping.divisionId)
      return {
        ...event,
        divisions: divisions
          .filter(
            (division) => !assigned.length || assigned.includes(division.id),
          )
          .map((division) => ({
            ...division,
            description:
              descriptions.find(
                (description) =>
                  description.workoutId === workoutId &&
                  description.divisionId === division.id,
              )?.description ?? null,
          })),
      }
    },
  )
  const recipient = userId
    ? exists(
        db
          .select({ id: competitionBroadcastRecipientsTable.id })
          .from(competitionBroadcastRecipientsTable)
          .where(
            and(
              eq(
                competitionBroadcastRecipientsTable.broadcastId,
                competitionBroadcastsTable.id,
              ),
              eq(competitionBroadcastRecipientsTable.userId, userId),
            ),
          ),
      )
    : undefined
  const announcements = await db
    .select({
      id: competitionBroadcastsTable.id,
      title: competitionBroadcastsTable.title,
      body: competitionBroadcastsTable.body,
      sentAt: competitionBroadcastsTable.sentAt,
    })
    .from(competitionBroadcastsTable)
    .where(
      and(
        eq(competitionBroadcastsTable.competitionId, competition.id),
        eq(competitionBroadcastsTable.status, "sent"),
        or(
          eq(
            competitionBroadcastsTable.audienceFilter,
            JSON.stringify({ type: "public" }),
          ),
          recipient,
        ),
      ),
    )
    .orderBy(desc(competitionBroadcastsTable.sentAt))
  return {
    competition,
    registrations,
    heats,
    assignments,
    workouts: publishedWorkouts,
    announcements,
  }
}

const profileInput = z.object({
  firstName: z.string().trim().min(2).max(255),
  lastName: z.string().trim().min(2).max(255),
})

// @lat: [[gameday#Application architecture]]
export async function handleGameDayRequest(
  request: Request,
): Promise<Response> {
  const headers = {
    "Cache-Control": "private, no-store",
    Vary: "Authorization",
  }
  const reply = (body: unknown, status = 200) =>
    Response.json(body, { status, headers })
  const path = new URL(request.url).pathname
    .replace(/^\/api\/gameday\/v1\/?/, "")
    .split("/")
    .filter(Boolean)
  try {
    const session = await getSessionFromBearer(request)
    if (request.headers.has("Authorization") && !session)
      return reply(
        { error: "Your session has expired. Please sign in again." },
        401,
      )
    if (request.method === "DELETE" && path.join("/") === "session") {
      if (!session) return reply({ error: "Please sign in" }, 401)
      await deleteKVSession(session.id, session.userId)
      return reply({ signedOut: true })
    }
    if (request.method === "GET" && path.length === 1 && path[0] === "home")
      return reply(await gameDayHome(session?.userId))
    if (
      request.method === "GET" &&
      path[0] === "competitions" &&
      path[1] &&
      path.length <= 3
    ) {
      const detail = await gameDayCompetition(
        decodeURIComponent(path[1]),
        session?.userId,
      )
      if (!detail) return reply({ error: "Competition not found" }, 404)
      if (path.length === 2) return reply(detail)
      if (path[2] === "leaderboard")
        return reply(
          await getCompetitionLeaderboard({
            competitionId: detail.competition.id,
            divisionId:
              new URL(request.url).searchParams.get("divisionId") || undefined,
          }),
        )
    }
    if (request.method === "PATCH" && path.join("/") === "profile") {
      if (!session) return reply({ error: "Please sign in" }, 401)
      const parsed = profileInput.safeParse(await request.json())
      if (!parsed.success)
        return reply(
          {
            error: "Enter a first and last name between 2 and 255 characters.",
          },
          400,
        )
      await getDb()
        .update(userTable)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(userTable.id, session.userId))
      await updateAllSessionsOfUser(session.userId)
      return reply({ profile: await gameDayProfile(session.userId) })
    }
    return reply({ error: "Not found" }, 404)
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof URIError)
      return reply({ error: "Invalid request" }, 400)
    console.error(
      "[GameDay] Request failed",
      error instanceof Error ? error.name : "UnknownError",
    )
    return reply(
      { error: "WODsmith is temporarily unavailable. Please try again." },
      500,
    )
  }
}
