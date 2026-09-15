// @lat: [[crew#Published Volunteer Schedule]]
import { createHash } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { getDb } from "../db"
import { competitionsTable } from "../db/schemas/competitions"
import {
  type CrewEventSettings,
  crewEventSettingsTable,
} from "../db/schemas/crew-event-settings"
import { crewPublishedSchedulesTable } from "../db/schemas/crew-published-schedules"
import {
  SYSTEM_ROLES_ENUM,
  teamInvitationTable,
  teamMembershipTable,
} from "../db/schemas/teams"
import {
  type CrewBillingPlanId,
  crewBillingPlanIds,
  resolveCrewBillingEntitlements,
} from "../lib/crew/billing-state"
import {
  buildCrewPublishedSchedule,
  type CrewPublishedSchedule,
  crewPublishedScheduleContent,
  crewPublishedScheduleSchema,
  resolveCrewPublishedScheduleIdentities,
} from "../lib/crew/published-schedule"
import {
  type CrewStaffingReportEvent,
  loadCrewStaffingMatrixInput,
  requireCrewStaffingEvent,
} from "../server-fns/crew-staffing-fns.server"
import { requireCrewDepartmentLeadFullAccess } from "./crew-department-lead.server"

const MAX_SNAPSHOT_BYTES = 2_000_000

export interface CrewPublishedScheduleManagerData {
  event: { id: string; name: string; slug: string }
  hasAccess: boolean
  sharePath: string
  published: CrewPublishedSchedule | null
  preview: CrewPublishedSchedule | null
  previewError: string | null
  draftChanged: boolean
}

export async function getCrewPublishedScheduleManager(data: {
  eventId: string
}): Promise<CrewPublishedScheduleManagerData> {
  const event = await requirePublishedScheduleManager(data.eventId)
  return loadManagerData(event)
}

export async function publishCrewSchedule(data: {
  eventId: string
}): Promise<CrewPublishedScheduleManagerData> {
  const event = await requirePublishedScheduleManager(data.eventId)
  const db = getDb()
  await db.transaction(async (tx) => {
    // Billing updates and concurrent publish/unpublish requests serialize on the
    // event's existing settings row, including first publication with no row yet.
    const [settings] = await tx
      .select()
      .from(crewEventSettingsTable)
      .where(eq(crewEventSettingsTable.competitionId, event.id))
      .for("update")
      .limit(1)
    if (!settings || !isCrewSchedulePubliclyAvailable(settings)) {
      throw new Error(
        "Purchase event access before publishing the volunteer schedule.",
      )
    }
    const snapshot = await buildPreview(event)
    assertSnapshotSize(snapshot)
    const now = new Date(snapshot.publishedAt)
    await tx
      .insert(crewPublishedSchedulesTable)
      .values({
        competitionId: event.id,
        snapshot,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onDuplicateKeyUpdate({
        set: { snapshot, publishedAt: now, updatedAt: now },
      })
  })
  return loadManagerData(event)
}

export async function unpublishCrewSchedule(data: {
  eventId: string
}): Promise<CrewPublishedScheduleManagerData> {
  const event = await requirePublishedScheduleManager(data.eventId)
  const db = getDb()
  await db.transaction(async (tx) => {
    await tx
      .select({ id: crewEventSettingsTable.id })
      .from(crewEventSettingsTable)
      .where(eq(crewEventSettingsTable.competitionId, event.id))
      .for("update")
      .limit(1)
    await tx
      .delete(crewPublishedSchedulesTable)
      .where(eq(crewPublishedSchedulesTable.competitionId, event.id))
  })
  return loadManagerData(event)
}

export async function getCrewPublicSchedule(data: {
  slug: string
}): Promise<{ schedule: CrewPublishedSchedule | null }> {
  const db = getDb()
  const [row] = await db
    .select({
      settings: crewEventSettingsTable,
      snapshot: crewPublishedSchedulesTable.snapshot,
    })
    .from(competitionsTable)
    .innerJoin(
      crewEventSettingsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )
    .innerJoin(
      crewPublishedSchedulesTable,
      eq(crewPublishedSchedulesTable.competitionId, competitionsTable.id),
    )
    .where(eq(competitionsTable.slug, data.slug))
    .limit(1)
  if (!row || !isCrewSchedulePubliclyAvailable(row.settings))
    return { schedule: null }
  const schedule = parseSnapshot(row.snapshot)
  // A renamed slug must be explicitly republished before it is public again.
  return { schedule: schedule?.event.slug === data.slug ? schedule : null }
}

export function isCrewSchedulePubliclyAvailable(
  settings: Pick<
    CrewEventSettings,
    "crewOnly" | "lifecycle" | "crewBillingState" | "crewBillingPlanId"
  >,
) {
  if (!settings.crewOnly || settings.lifecycle === "archived") return false
  const planId = settings.crewBillingPlanId
  if (!planId || !crewBillingPlanIds.includes(planId as CrewBillingPlanId))
    return false
  return resolveCrewBillingEntitlements({
    state: settings.crewBillingState,
    planId: planId as CrewBillingPlanId,
  }).hasCrewEventAccess
}

async function requirePublishedScheduleManager(eventId: string) {
  const event = await requireCrewStaffingEvent(eventId)
  await requireCrewDepartmentLeadFullAccess(event)
  return event
}

async function loadManagerData(
  event: CrewStaffingReportEvent,
): Promise<CrewPublishedScheduleManagerData> {
  const db = getDb()
  const [[settings], [publishedRow], previewResult] = await Promise.all([
    db
      .select()
      .from(crewEventSettingsTable)
      .where(eq(crewEventSettingsTable.competitionId, event.id))
      .limit(1),
    db
      .select({ snapshot: crewPublishedSchedulesTable.snapshot })
      .from(crewPublishedSchedulesTable)
      .where(eq(crewPublishedSchedulesTable.competitionId, event.id))
      .limit(1),
    tryBuildManagerPreview(event),
  ])
  const published = publishedRow ? parseSnapshot(publishedRow.snapshot) : null
  const { preview, previewError } = previewResult
  return {
    event: { id: event.id, name: event.name, slug: event.slug },
    hasAccess: Boolean(settings && isCrewSchedulePubliclyAvailable(settings)),
    sharePath: `/e/${encodeURIComponent(event.slug)}/schedule`,
    published,
    preview,
    previewError,
    draftChanged:
      preview !== null &&
      (!published ||
        crewPublishedScheduleContent(published) !==
          crewPublishedScheduleContent(preview)),
  }
}

async function tryBuildManagerPreview(event: CrewStaffingReportEvent): Promise<{
  preview: CrewPublishedSchedule | null
  previewError: string | null
}> {
  try {
    const preview = await buildPreview(event)
    assertSnapshotSize(preview)
    return { preview, previewError: null }
  } catch {
    // Draft repair must not block access to an existing public release or the
    // ability to take it offline. Never send raw validation/DB errors to the UI.
    return {
      preview: null,
      previewError:
        "The draft preview is unavailable. Review the volunteer roster, shifts, and judge assignments, then refresh the preview. Contact support if the problem continues.",
    }
  }
}

async function buildPreview(event: CrewStaffingReportEvent) {
  // This loader coalesces account and invitation IDs and includes only the
  // currently active judge assignment versions, matching the print packets.
  const { input } = await loadCrewStaffingMatrixInput(event, {
    kind: "full",
    scopes: [],
  })
  // The shared roster collapses accepted invitations into memberships, while
  // existing shift/judge rows keep invitation IDs. Resolve that bridge only for
  // this public projection; account invitation and confirmation tokens stay intact.
  const db = getDb()
  const [invitations, memberships] = await Promise.all([
    db.query.teamInvitationTable.findMany({
      columns: { id: true, email: true, acceptedBy: true, status: true },
      where: and(
        eq(teamInvitationTable.teamId, event.competitionTeamId),
        eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
        eq(teamInvitationTable.isSystemRole, true),
      ),
    }),
    db.query.teamMembershipTable.findMany({
      columns: { id: true, userId: true },
      where: and(
        eq(teamMembershipTable.teamId, event.competitionTeamId),
        eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
        eq(teamMembershipTable.isSystemRole, true),
      ),
      with: { user: { columns: { email: true } } },
    }),
  ])
  return buildCrewPublishedSchedule({
    event,
    input: resolveCrewPublishedScheduleIdentities({
      input,
      invitations,
      memberships: memberships.map((member) => ({
        id: member.id,
        userId: member.userId,
        email: member.user?.email ?? null,
      })),
    }),
    publishedAt: new Date(),
    publicId: (sourceId) =>
      createHash("sha256")
        .update(`crew-public:${event.id}:${sourceId}`)
        .digest("hex")
        .slice(0, 32),
  })
}

function assertSnapshotSize(snapshot: CrewPublishedSchedule) {
  if (
    new TextEncoder().encode(JSON.stringify(snapshot)).byteLength >
    MAX_SNAPSHOT_BYTES
  ) {
    throw new Error(
      "This schedule is too large to publish. Contact support for help sharing it.",
    )
  }
}

function parseSnapshot(value: unknown): CrewPublishedSchedule | null {
  if (
    new TextEncoder().encode(JSON.stringify(value) ?? "").byteLength >
    MAX_SNAPSHOT_BYTES
  )
    return null
  const parsed = crewPublishedScheduleSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
